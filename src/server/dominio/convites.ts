import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { auditar } from "../auditoria";
import { AcessoNegado, podeConvidarPaciente, type Ator } from "../authz/politicas";
import { db, type Tx } from "../db/cliente";
import { abrirPendencia } from "./pendencias";
import { atendimento, autorizacaoCuidador, convite, equipeAtendimento, instituicao, paciente, plano } from "../db/schema";
import { enviarMensagem } from "../mensagens";

// Fluxo do QR code (seção 7 do documento de requisitos):
// 1. QR com token opaco de 256 bits. O banco guarda só o SHA-256.
// 2. GET de pré-visualização: não consome nada e não mostra dados clínicos.
// 3. POST troca o token por uma "sessão de ativação" em cookie HttpOnly e
//    envia um código ao canal validado no atendimento. O token sai da URL.
// 4. Código correto + criação/vínculo da conta consomem o convite de forma
//    atômica (UPDATE ... WHERE consumido_em IS NULL).

export const VALIDADE_CONVITE_H = 72;
const VALIDADE_CODIGO_MIN = 10;
const MAX_TENTATIVAS_CODIGO = 5;
const INTERVALO_REENVIO_S = 60;
const JANELA_CONCLUSAO_MIN = 30;
// Tetos por convite: sem eles, quem fotografou o QR teria ~21 mil palpites em 72 h.
const MAX_CODIGOS_ENVIADOS = 5;
const MAX_TENTATIVAS_TOTAIS = 15;

export const sha256 = (valor: string) => createHash("sha256").update(valor).digest();

function hmacCodigo(conviteId: string, codigo: string): Buffer {
  const segredo = process.env.BETTER_AUTH_SECRET;
  if (!segredo) throw new Error("BETTER_AUTH_SECRET ausente.");
  return createHmac("sha256", segredo).update(`${conviteId}:${codigo}`).digest();
}

export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  const [nomeDominio, ...resto] = dominio.split(".");
  return `${local[0]}***@${nomeDominio[0]}***.${resto.join(".")}`;
}

/** Profissional gera o convite de ativação do paciente. Devolve o token UMA vez. */
export async function criarConvitePaciente(ator: Ator, atendimentoId: string) {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(atendimento).where(eq(atendimento.id, atendimentoId));
    if (!a) throw new AcessoNegado("convite.criar");
    const equipe = (
      await tx.select({ u: equipeAtendimento.userId }).from(equipeAtendimento).where(eq(equipeAtendimento.atendimentoId, a.id))
    ).map((l) => l.u);
    if (!podeConvidarPaciente(ator, { instituicaoId: a.instituicaoId, equipe })) {
      await auditar({ atorUserId: ator.userId, instituicaoId: a.instituicaoId, acao: "convite.criar", recursoTipo: "atendimento", recursoId: a.id, resultado: "negado" }, tx);
      throw new AcessoNegado("convite.criar");
    }
    const [publicado] = await tx
      .select({ id: plano.id })
      .from(plano)
      .where(and(eq(plano.atendimentoId, a.id), eq(plano.status, "publicado")));
    if (!publicado) throw new Error("Publique o plano antes de gerar o convite.");

    const [pac] = await tx.select().from(paciente).where(eq(paciente.id, a.pacienteId));

    // Um convite ativo por paciente: os anteriores são revogados.
    await tx
      .update(convite)
      .set({ revogadoEm: new Date() })
      .where(and(eq(convite.pacienteId, pac.id), eq(convite.tipo, "paciente"), isNull(convite.consumidoEm), isNull(convite.revogadoEm)));

    const token = randomBytes(32).toString("base64url");
    const expiraEm = new Date(Date.now() + VALIDADE_CONVITE_H * 3_600_000);
    const [c] = await tx
      .insert(convite)
      .values({
        tipo: "paciente",
        instituicaoId: a.instituicaoId,
        pacienteId: pac.id,
        tokenHash: sha256(token),
        emailDestino: pac.emailContato,
        criadoPor: ator.userId,
        expiraEm,
      })
      .returning({ id: convite.id });
    await auditar({ atorUserId: ator.userId, instituicaoId: a.instituicaoId, acao: "convite.criar", recursoTipo: "convite", recursoId: c.id, resultado: "permitido" }, tx);
    return { token, expiraEm, jaAtivado: pac.userId !== null, emailMascarado: mascararEmail(pac.emailContato) };
  });
}

/** Revoga o convite e avisa a equipe (pendência), sem revelar nada a quem tenta. */
async function revogarPorAbuso(tx: Tx, c: { id: string; instituicaoId: string; pacienteId: string }, motivo: string) {
  await tx.update(convite).set({ revogadoEm: new Date() }).where(eq(convite.id, c.id));
  await abrirPendencia(
    { instituicaoId: c.instituicaoId, pacienteId: c.pacienteId, planoId: null, tipo: "duvida_geral", descricao: `Convite de ativação revogado automaticamente: ${motivo}. Gere um novo QR code com o paciente presente.`, chave: `convite-abuso:${c.id}`, criadoPor: null },
    tx,
  );
  await auditar({ atorUserId: null, instituicaoId: c.instituicaoId, acao: "convite.revogado_por_abuso", recursoTipo: "convite", recursoId: c.id, resultado: "negado", detalhes: { motivo } }, tx);
}

export type EstadoConvite = "valido" | "expirado" | "revogado" | "usado" | "inexistente";

function estadoDe(c: { revogadoEm: Date | null; consumidoEm: Date | null; expiraEm: Date } | undefined): EstadoConvite {
  if (!c) return "inexistente";
  if (c.consumidoEm) return "usado";
  if (c.revogadoEm) return "revogado";
  if (c.expiraEm.getTime() <= Date.now()) return "expirado";
  return "valido";
}

/** GET seguro: só informa o estado, a instituição e o e-mail mascarado. */
export async function previsualizarConvite(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { estado: "inexistente" as EstadoConvite };
  const [c] = await db
    .select({
      revogadoEm: convite.revogadoEm,
      consumidoEm: convite.consumidoEm,
      expiraEm: convite.expiraEm,
      emailDestino: convite.emailDestino,
      tipo: convite.tipo,
      instituicao: instituicao.nome,
    })
    .from(convite)
    .innerJoin(instituicao, eq(instituicao.id, convite.instituicaoId))
    .where(eq(convite.tokenHash, sha256(token)));
  const estado = estadoDe(c);
  if (estado !== "valido") return { estado };
  return { estado, tipo: c.tipo, instituicao: c.instituicao, emailMascarado: mascararEmail(c.emailDestino) };
}

/**
 * POST: troca o token da URL por uma sessão de ativação e envia o código.
 * Devolve o segredo da sessão de ativação para ir em cookie HttpOnly.
 */
export async function iniciarAtivacao(token: string): Promise<{ sessaoAtivacao: string } | { erro: EstadoConvite | "aguarde" }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { erro: "inexistente" };
  const sessaoAtivacao = randomBytes(32).toString("base64url");
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const resultado = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(convite).where(eq(convite.tokenHash, sha256(token))).for("update");
    const estado = estadoDe(c);
    if (estado !== "valido") return { erro: estado };
    const enviadoHa = c.codigoExpiraEm ? Date.now() - (c.codigoExpiraEm.getTime() - VALIDADE_CODIGO_MIN * 60_000) : Infinity;
    if (enviadoHa < INTERVALO_REENVIO_S * 1000) return { erro: "aguarde" as const };
    if (c.codigosEnviados >= MAX_CODIGOS_ENVIADOS) {
      await revogarPorAbuso(tx, c, "Limite de envios de código atingido");
      return { erro: "revogado" as const };
    }
    await tx
      .update(convite)
      .set({
        sessaoAtivacaoHash: sha256(sessaoAtivacao),
        codigoHash: hmacCodigo(c.id, codigo),
        codigoExpiraEm: new Date(Date.now() + VALIDADE_CODIGO_MIN * 60_000),
        codigoTentativas: 0,
        codigoVerificadoEm: null,
        codigosEnviados: c.codigosEnviados + 1,
      })
      .where(eq(convite.id, c.id));
    await auditar({ atorUserId: null, instituicaoId: c.instituicaoId, acao: "convite.codigo_enviado", recursoTipo: "convite", recursoId: c.id, resultado: "permitido" }, tx);
    return { email: c.emailDestino };
  });

  if ("erro" in resultado) return { erro: resultado.erro as EstadoConvite | "aguarde" };
  await enviarMensagem({
    para: resultado.email,
    assunto: "Seu código de ativação do Alta Clara",
    corpo: `Seu código é ${codigo}. Ele vale por ${VALIDADE_CODIGO_MIN} minutos.\n\nSe você não pediu este código, ignore esta mensagem.`,
  });
  return { sessaoAtivacao };
}

async function conviteDaSessao(sessaoAtivacao: string) {
  if (!sessaoAtivacao) return undefined;
  const [c] = await db
    .select({
      id: convite.id,
      instituicaoId: convite.instituicaoId,
      pacienteId: convite.pacienteId,
      emailDestino: convite.emailDestino,
      revogadoEm: convite.revogadoEm,
      consumidoEm: convite.consumidoEm,
      expiraEm: convite.expiraEm,
      codigoVerificadoEm: convite.codigoVerificadoEm,
      tipo: convite.tipo,
      instituicao: instituicao.nome,
    })
    .from(convite)
    .innerJoin(instituicao, eq(instituicao.id, convite.instituicaoId))
    .where(eq(convite.sessaoAtivacaoHash, sha256(sessaoAtivacao)));
  return c;
}

export async function estadoDaAtivacao(sessaoAtivacao: string) {
  const c = await conviteDaSessao(sessaoAtivacao);
  const estado = estadoDe(c);
  if (!c || estado !== "valido") return { estado };
  return {
    estado,
    instituicao: c.instituicao,
    emailMascarado: mascararEmail(c.emailDestino),
    tipo: c.tipo,
    codigoVerificado: c.codigoVerificadoEm !== null,
  };
}

export async function verificarCodigo(sessaoAtivacao: string, codigoDigitado: string) {
  const codigo = codigoDigitado.replace(/\D/g, "");
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(convite)
      .where(eq(convite.sessaoAtivacaoHash, sha256(sessaoAtivacao)))
      .for("update");
    if (estadoDe(c) !== "valido" || !c.codigoHash || !c.codigoExpiraEm) return { ok: false, motivo: "invalido" as const };
    if (c.codigoTentativas >= MAX_TENTATIVAS_CODIGO) return { ok: false, motivo: "tentativas" as const };
    if (c.codigoExpiraEm.getTime() < Date.now()) return { ok: false, motivo: "expirado" as const };

    if (c.tentativasTotais >= MAX_TENTATIVAS_TOTAIS) {
      await revogarPorAbuso(tx, c, "Limite de tentativas de código atingido");
      return { ok: false, motivo: "tentativas" as const };
    }
    await tx.update(convite).set({ codigoTentativas: c.codigoTentativas + 1, tentativasTotais: c.tentativasTotais + 1 }).where(eq(convite.id, c.id));
    const esperado = c.codigoHash;
    const recebido = hmacCodigo(c.id, codigo);
    const confere = codigo.length === 6 && timingSafeEqual(esperado, recebido);
    if (!confere) {
      await auditar({ atorUserId: null, instituicaoId: c.instituicaoId, acao: "convite.codigo", recursoTipo: "convite", recursoId: c.id, resultado: "negado" }, tx);
      return { ok: false, motivo: "errado" as const, restantes: MAX_TENTATIVAS_CODIGO - c.codigoTentativas - 1 };
    }
    await tx.update(convite).set({ codigoVerificadoEm: new Date(), codigoHash: null }).where(eq(convite.id, c.id));
    return { ok: true as const };
  });
}

/**
 * Consome o convite de forma atômica e vincula o paciente à conta.
 * Duas requisições simultâneas: só uma recebe a linha do UPDATE.
 */
export async function consumirConvite(sessaoAtivacao: string, userId: string, emailDaConta: string) {
  return db.transaction(async (tx) => {
    const consumidos = await tx
      .update(convite)
      .set({ consumidoEm: new Date(), consumidoPor: userId, sessaoAtivacaoHash: null })
      .where(
        and(
          eq(convite.sessaoAtivacaoHash, sha256(sessaoAtivacao)),
          isNull(convite.consumidoEm),
          isNull(convite.revogadoEm),
          gt(convite.expiraEm, new Date()),
          isNotNull(convite.codigoVerificadoEm),
          gt(convite.codigoVerificadoEm, sql`now() - make_interval(mins => ${JANELA_CONCLUSAO_MIN})`),
          sql`lower(${convite.emailDestino}) = lower(${emailDaConta})`,
        ),
      )
      .returning({
        id: convite.id,
        tipo: convite.tipo,
        pacienteId: convite.pacienteId,
        instituicaoId: convite.instituicaoId,
        escopo: convite.escopo,
        validadeAcessoDias: convite.validadeAcessoDias,
        criadoPor: convite.criadoPor,
      });
    if (consumidos.length !== 1) return { ok: false as const };
    const c = consumidos[0];

    if (c.tipo === "cuidador") {
      // O paciente não pode ser cuidador de si mesmo.
      const [pac] = await tx.select({ userId: paciente.userId }).from(paciente).where(eq(paciente.id, c.pacienteId));
      if (pac?.userId === userId) tx.rollback();
      // Renovação: uma autorização ativa por par (paciente, cuidador).
      await tx
        .update(autorizacaoCuidador)
        .set({ revogadoEm: new Date(), revogadoPor: c.criadoPor })
        .where(and(eq(autorizacaoCuidador.pacienteId, c.pacienteId), eq(autorizacaoCuidador.cuidadorUserId, userId), isNull(autorizacaoCuidador.revogadoEm)));
      await tx.insert(autorizacaoCuidador).values({
        pacienteId: c.pacienteId,
        cuidadorUserId: userId,
        escopo: c.escopo ?? ["ver_plano"],
        concedidoPor: c.criadoPor,
        conviteId: c.id,
        expiraEm: c.validadeAcessoDias ? new Date(Date.now() + c.validadeAcessoDias * 86_400_000) : null,
      });
      await auditar({ atorUserId: userId, instituicaoId: c.instituicaoId, acao: "cuidador.aceitar", recursoTipo: "convite", recursoId: c.id, resultado: "permitido" }, tx);
      return { ok: true as const, pacienteId: c.pacienteId, tipo: c.tipo };
    }

    // Vincula somente se o paciente ainda não tem conta, ou se já é esta conta.
    const vinculados = await tx
      .update(paciente)
      .set({ userId })
      .where(and(eq(paciente.id, c.pacienteId), sql`(${paciente.userId} is null or ${paciente.userId} = ${userId})`))
      .returning({ id: paciente.id });
    if (vinculados.length !== 1) {
      tx.rollback();
    }
    await auditar({ atorUserId: userId, instituicaoId: c.instituicaoId, acao: "convite.consumir", recursoTipo: "convite", recursoId: c.id, resultado: "permitido" }, tx);
    return { ok: true as const, pacienteId: c.pacienteId, tipo: c.tipo };
  });
}

/** Dados mínimos para concluir a ativação (o e-mail completo só depois do código). */
export async function dadosParaConclusao(sessaoAtivacao: string) {
  const c = await conviteDaSessao(sessaoAtivacao);
  if (!c || estadoDe(c) !== "valido" || !c.codigoVerificadoEm) return null;
  if (Date.now() - c.codigoVerificadoEm.getTime() > JANELA_CONCLUSAO_MIN * 60_000) return null;
  return { email: c.emailDestino, instituicao: c.instituicao, tipo: c.tipo };
}
