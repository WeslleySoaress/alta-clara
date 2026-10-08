import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditar } from "../auditoria";
import { AcessoNegado, ESCOPOS_CUIDADOR, podeGerenciarCuidadores, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { autorizacaoCuidador, convite, instituicao, lembrete, paciente, plano, user } from "../db/schema";
import { enviarMensagem } from "../mensagens";
import { mascararEmail, sha256, VALIDADE_CONVITE_H } from "./convites";

// Círculo de cuidado: só o próprio paciente convida e revoga. Cada cuidador
// usa a própria conta; o escopo e a validade ficam registrados.

export const entradaConviteCuidador = z.object({
  pacienteId: z.uuid(),
  apelido: z.string().trim().min(2, "Informe como o cuidador será identificado.").max(60),
  email: z.email("E-mail inválido.").max(200),
  escopo: z.array(z.enum(ESCOPOS_CUIDADOR)).min(1),
  validadeDias: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
});

export class EntradaInvalida extends Error {}

export async function convidarCuidador(ator: Ator, entrada: unknown) {
  const dados = entradaConviteCuidador.parse(entrada);
  if (!podeGerenciarCuidadores(ator, dados.pacienteId)) {
    await auditar({ atorUserId: ator.userId, acao: "cuidador.convidar", recursoTipo: "paciente", recursoId: dados.pacienteId, resultado: "negado" });
    throw new AcessoNegado("cuidador.convidar");
  }
  const escopo = [...new Set(["ver_plano", ...dados.escopo])];
  const [pac] = await db.select({ instituicaoId: paciente.instituicaoId }).from(paciente).where(eq(paciente.id, dados.pacienteId));
  const [eu] = await db.select({ email: user.email }).from(user).where(eq(user.id, ator.userId));
  if (eu.email.toLowerCase() === dados.email.toLowerCase()) throw new EntradaInvalida("Use o e-mail da outra pessoa, não o seu.");

  // Limites contra uso do convite para disparar e-mails a terceiros.
  const [{ pendentes }] = await db
    .select({ pendentes: sql<number>`count(*) filter (where ${convite.consumidoEm} is null and ${convite.revogadoEm} is null and ${convite.expiraEm} > now())::int` })
    .from(convite)
    .where(and(eq(convite.pacienteId, dados.pacienteId), eq(convite.tipo, "cuidador")));
  const [{ hoje }] = await db
    .select({ hoje: sql<number>`count(*)::int` })
    .from(convite)
    .where(and(eq(convite.criadoPor, ator.userId), eq(convite.tipo, "cuidador"), gt(convite.criadoEm, new Date(Date.now() - 86_400_000))));
  if (pendentes >= 5) throw new EntradaInvalida("Você já tem 5 convites aguardando. Cancele um antes de criar outro.");
  if (hoje >= 10) throw new EntradaInvalida("Limite de convites por dia atingido. Tente amanhã.");

  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + VALIDADE_CONVITE_H * 3_600_000);
  const [c] = await db
    .insert(convite)
    .values({
      tipo: "cuidador",
      instituicaoId: pac.instituicaoId,
      pacienteId: dados.pacienteId,
      tokenHash: sha256(token),
      emailDestino: dados.email.toLowerCase(),
      escopo,
      validadeAcessoDias: dados.validadeDias,
      apelidoDestino: dados.apelido,
      criadoPor: ator.userId,
      expiraEm,
    })
    .returning({ id: convite.id });
  await auditar({ atorUserId: ator.userId, instituicaoId: pac.instituicaoId, acao: "cuidador.convidar", recursoTipo: "convite", recursoId: c.id, resultado: "permitido", detalhes: { escopo: escopo.join(",") } });
  return { token, expiraEm, emailMascarado: mascararEmail(dados.email) };
}

export async function listarCuidadores(ator: Ator, pacienteId: string) {
  if (!podeGerenciarCuidadores(ator, pacienteId)) throw new AcessoNegado("cuidador.listar");
  const agora = new Date();
  const ativos = await db
    .select({
      id: autorizacaoCuidador.id,
      nome: user.name,
      email: user.email,
      escopo: autorizacaoCuidador.escopo,
      desde: autorizacaoCuidador.criadoEm,
      expiraEm: autorizacaoCuidador.expiraEm,
    })
    .from(autorizacaoCuidador)
    .innerJoin(user, eq(user.id, autorizacaoCuidador.cuidadorUserId))
    .where(
      and(
        eq(autorizacaoCuidador.pacienteId, pacienteId),
        isNull(autorizacaoCuidador.revogadoEm),
        or(isNull(autorizacaoCuidador.expiraEm), gt(autorizacaoCuidador.expiraEm, agora)),
      ),
    );
  const pendentes = await db
    .select({ id: convite.id, apelido: convite.apelidoDestino, email: convite.emailDestino, escopo: convite.escopo, expiraEm: convite.expiraEm })
    .from(convite)
    .where(
      and(
        eq(convite.pacienteId, pacienteId),
        eq(convite.tipo, "cuidador"),
        isNull(convite.consumidoEm),
        isNull(convite.revogadoEm),
        gt(convite.expiraEm, agora),
      ),
    )
    .orderBy(desc(convite.criadoEm));
  return { ativos, pendentes: pendentes.map((p) => ({ ...p, email: mascararEmail(p.email) })) };
}

/** Revogação com efeito na próxima requisição do cuidador (o ator é recarregado do banco). */
export async function revogarCuidador(ator: Ator, autorizacaoId: string) {
  const [a] = await db
    .select({ pacienteId: autorizacaoCuidador.pacienteId, cuidador: autorizacaoCuidador.cuidadorUserId, instituicaoId: paciente.instituicaoId })
    .from(autorizacaoCuidador)
    .innerJoin(paciente, eq(paciente.id, autorizacaoCuidador.pacienteId))
    .where(and(eq(autorizacaoCuidador.id, autorizacaoId), isNull(autorizacaoCuidador.revogadoEm)));
  if (!a || !podeGerenciarCuidadores(ator, a.pacienteId)) {
    await auditar({ atorUserId: ator.userId, acao: "cuidador.revogar", recursoTipo: "autorizacao_cuidador", recursoId: autorizacaoId, resultado: "negado" });
    throw new AcessoNegado("cuidador.revogar");
  }
  // Revogação e cancelamento dos lembretes juntos: ou tudo, ou nada.
  await db.transaction(async (tx) => {
    await tx.update(autorizacaoCuidador).set({ revogadoEm: new Date(), revogadoPor: ator.userId }).where(eq(autorizacaoCuidador.id, autorizacaoId));
    await tx
      .update(lembrete)
      .set({ status: "cancelado", ultimoErro: "cuidador_revogado" })
      .where(and(eq(lembrete.userId, a.cuidador), eq(lembrete.status, "agendado"), inArray(lembrete.planoId, tx.select({ id: plano.id }).from(plano).where(eq(plano.pacienteId, a.pacienteId)))));
    await auditar({ atorUserId: ator.userId, instituicaoId: a.instituicaoId, acao: "cuidador.revogar", recursoTipo: "autorizacao_cuidador", recursoId: autorizacaoId, resultado: "permitido" }, tx);
  });
  // O aviso é cortesia: se falhar, a revogação continua valendo e o paciente não vê erro.
  const [c] = await db.select({ email: user.email }).from(user).where(eq(user.id, a.cuidador));
  await enviarMensagem({
    para: c.email,
    assunto: "Seu acesso como cuidador foi encerrado",
    corpo: "A pessoa que você acompanhava encerrou seu acesso no Alta Clara. Se tiver dúvidas, fale com ela diretamente.",
  }).catch(() => {});
}

export async function cancelarConviteCuidador(ator: Ator, conviteId: string) {
  const [c] = await db.select().from(convite).where(and(eq(convite.id, conviteId), eq(convite.tipo, "cuidador")));
  if (!c || !podeGerenciarCuidadores(ator, c.pacienteId)) throw new AcessoNegado("cuidador.cancelar");
  await db.update(convite).set({ revogadoEm: new Date() }).where(eq(convite.id, conviteId));
  await auditar({ atorUserId: ator.userId, instituicaoId: c.instituicaoId, acao: "cuidador.cancelar_convite", recursoTipo: "convite", recursoId: conviteId, resultado: "permitido" });
}

/** Pacientes próprios (para a tela de cuidadores), com a instituição. */
export async function pacientesDoTitular(ator: Ator) {
  if (!ator.pacientesProprios.length) return [];
  const linhas = await db
    .select({ id: paciente.id, instituicao: instituicao.nome })
    .from(paciente)
    .innerJoin(instituicao, eq(instituicao.id, paciente.instituicaoId))
    .where(eq(paciente.userId, ator.userId));
  return linhas;
}
