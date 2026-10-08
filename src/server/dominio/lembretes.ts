import { and, eq, gt, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { auditar } from "../auditoria";
import { db, type Tx } from "../db/cliente";
import { autorizacaoCuidador, lembrete, paciente, plano, preferenciaLembrete, user } from "../db/schema";
import { enviarMensagem } from "../mensagens";
import { conteudoPlanoSchema } from "./conteudo";

// Lembretes agendados no servidor (seção 16 do documento de requisitos):
// fuso do plano, cancelamento por nova versão, idempotência (índice único),
// tentativas limitadas e mensagem discreta. "Enviado" ≠ visto ou seguido.

export const DIAS_A_FRENTE = 7;
export const MAX_TENTATIVAS = 3;
/** Lembrete atrasado mais que isso não é enviado (evita aviso fora de hora). */
export const ATRASO_MAXIMO_MIN = 60;
const RESERVA_EXPIRA_MS = 10 * 60_000;

export { instanteNoFuso } from "@/lib/fuso";
import { instanteNoFuso } from "@/lib/fuso";

function dataNoFuso(instante: Date, fuso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(instante);
}

function somarDias(data: string, n: number) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Quem recebe lembretes deste paciente: o próprio e cuidadores ativos, se escolheram receber. */
async function destinatarios(pacienteId: string, tx: Tx | typeof db = db): Promise<string[]> {
  const agora = new Date();
  const [pac] = await tx.select({ userId: paciente.userId }).from(paciente).where(eq(paciente.id, pacienteId));
  const cuidadores = await tx
    .select({ userId: autorizacaoCuidador.cuidadorUserId })
    .from(autorizacaoCuidador)
    .where(
      and(
        eq(autorizacaoCuidador.pacienteId, pacienteId),
        isNull(autorizacaoCuidador.revogadoEm),
        or(isNull(autorizacaoCuidador.expiraEm), gt(autorizacaoCuidador.expiraEm, agora)),
      ),
    );
  const candidatos = [pac?.userId, ...cuidadores.map((c) => c.userId)].filter((x): x is string => Boolean(x));
  if (!candidatos.length) return [];
  const ativos = await tx
    .select({ userId: preferenciaLembrete.userId })
    .from(preferenciaLembrete)
    .where(and(inArray(preferenciaLembrete.userId, candidatos), eq(preferenciaLembrete.ativo, true)));
  return ativos.map((a) => a.userId);
}

/** Cria (idempotente) os lembretes dos próximos dias para um plano publicado. */
export async function agendarLembretesDoPlano(planoId: string, agora = new Date(), tx: Tx | typeof db = db) {
  const [p] = await tx.select().from(plano).where(eq(plano.id, planoId));
  if (!p || p.status !== "publicado") return 0;
  const conteudo = conteudoPlanoSchema.parse(p.conteudo);
  const usuarios = await destinatarios(p.pacienteId, tx);
  if (!usuarios.length) return 0;

  const hoje = dataNoFuso(agora, conteudo.fusoHorario);
  const linhas: (typeof lembrete.$inferInsert)[] = [];
  for (let i = 0; i < DIAS_A_FRENTE; i++) {
    const data = somarDias(hoje, i);
    const indice = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${conteudo.inicio}T00:00:00Z`)) / 86_400_000;
    if (indice < 0) continue;
    for (const m of conteudo.medicamentos) {
      if (!m.horarios.length || (m.duracaoDias !== null && indice >= m.duracaoDias)) continue;
      for (const h of m.horarios) {
        const instante = instanteNoFuso(data, h, conteudo.fusoHorario);
        if (instante <= agora) continue;
        for (const userId of usuarios) linhas.push({ planoId: p.id, userId, itemId: m.id, agendadoPara: instante });
      }
    }
  }
  if (!linhas.length) return 0;
  const criadas = await tx
    .insert(lembrete)
    .values(linhas)
    .onConflictDoUpdate({
      target: [lembrete.planoId, lembrete.userId, lembrete.itemId, lembrete.agendadoPara],
      set: { status: "agendado", tentativas: 0, ultimoErro: null, reservadoEm: null },
      // Só reativa o que foi cancelado por escolha do usuário ou revogação — nunca reenvia o que já saiu.
      setWhere: sql`${lembrete.status} = 'cancelado' and ${lembrete.ultimoErro} in ('desativado_pelo_usuario', 'cuidador_revogado')`,
    })
    .returning({ id: lembrete.id });
  return criadas.length;
}

/** Nova versão publicada: cancela os lembretes pendentes das versões anteriores do mesmo atendimento. */
export async function cancelarLembretesDeOutrasVersoes(atendimentoId: string, planoVigenteId: string, tx: Tx | typeof db = db) {
  const r = await tx
    .update(lembrete)
    .set({ status: "cancelado", ultimoErro: "substituido_por_nova_versao" })
    .where(
      and(
        eq(lembrete.status, "agendado"),
        ne(lembrete.planoId, planoVigenteId),
        inArray(lembrete.planoId, tx.select({ id: plano.id }).from(plano).where(eq(plano.atendimentoId, atendimentoId))),
      ),
    )
    .returning({ id: lembrete.id });
  return r.length;
}

/** Liga ou desliga os lembretes do próprio usuário. */
export async function definirPreferenciaLembrete(userId: string, ativo: boolean) {
  await db
    .insert(preferenciaLembrete)
    .values({ userId, ativo })
    .onConflictDoUpdate({ target: preferenciaLembrete.userId, set: { ativo, atualizadoEm: new Date() } });
  if (!ativo) {
    await db.update(lembrete).set({ status: "cancelado", ultimoErro: "desativado_pelo_usuario" }).where(and(eq(lembrete.userId, userId), eq(lembrete.status, "agendado")));
  }
  await auditar({ atorUserId: userId, acao: "lembrete.preferencia", resultado: "permitido", detalhes: { ativo } });
}

export async function preferenciaDe(userId: string) {
  const [p] = await db.select({ ativo: preferenciaLembrete.ativo }).from(preferenciaLembrete).where(eq(preferenciaLembrete.userId, userId));
  return p?.ativo ?? false;
}

/** Mensagem discreta: sem nome de medicamento, diagnóstico ou procedimento. */
export const TEXTO_LEMBRETE = "Lembrete do Alta Clara: há um horário planejado agora. Abra o aplicativo para ver o que fazer.";

/**
 * Processa os lembretes vencidos. Cada lembrete é RESERVADO (status "enviando")
 * na mesma transação em que é selecionado: outro processador, ou um ciclo
 * sobreposto, não o pega de novo. Reservas antigas (processo que caiu) voltam
 * para a fila depois de 10 min. Revalida tudo antes de enviar.
 */
export async function processarLembretes(agora = new Date(), enviar = enviarMensagem) {
  const resumo = { enviados: 0, cancelados: 0, falhas: 0 };
  await db
    .update(lembrete)
    .set({ status: "agendado", reservadoEm: null })
    .where(and(eq(lembrete.status, "enviando"), lte(lembrete.reservadoEm, new Date(agora.getTime() - RESERVA_EXPIRA_MS))));
  const lote = await db.transaction(async (tx) => {
    const devidos = await tx
      .select({ id: lembrete.id, planoId: lembrete.planoId, userId: lembrete.userId, agendadoPara: lembrete.agendadoPara, tentativas: lembrete.tentativas })
      .from(lembrete)
      .where(and(eq(lembrete.status, "agendado"), lte(lembrete.agendadoPara, agora)))
      .limit(50)
      .for("update", { skipLocked: true });
    const resultado: { id: string; email: string | null; motivo: string | null; tentativas: number }[] = [];
    for (const l of devidos) {
      const [p] = await tx.select({ status: plano.status, pacienteId: plano.pacienteId }).from(plano).where(eq(plano.id, l.planoId));
      let motivo: string | null = null;
      if (!p || p.status !== "publicado") motivo = "plano_nao_vigente";
      else if (agora.getTime() - l.agendadoPara.getTime() > ATRASO_MAXIMO_MIN * 60_000) motivo = "atrasado";
      else if (!(await destinatarios(p.pacienteId, tx)).includes(l.userId)) motivo = "sem_autorizacao_ou_desativado";
      const [u] = await tx.select({ email: user.email }).from(user).where(eq(user.id, l.userId));
      resultado.push({ id: l.id, email: u?.email ?? null, motivo, tentativas: l.tentativas });
      // Marca a tentativa antes de enviar: se o processo cair, não repete além do limite.
      await tx.update(lembrete).set({ tentativas: sql`${lembrete.tentativas} + 1`, status: "enviando", reservadoEm: agora }).where(eq(lembrete.id, l.id));
    }
    return resultado;
  });

  for (const l of lote) {
    if (l.motivo || !l.email) {
      await db.update(lembrete).set({ status: "cancelado", ultimoErro: l.motivo ?? "sem_email" }).where(eq(lembrete.id, l.id));
      resumo.cancelados++;
      continue;
    }
    try {
      await enviar({ para: l.email, assunto: "Lembrete do Alta Clara", corpo: TEXTO_LEMBRETE });
      await db.update(lembrete).set({ status: "enviado", enviadoEm: new Date() }).where(eq(lembrete.id, l.id));
      resumo.enviados++;
    } catch (e) {
      const esgotou = l.tentativas + 1 >= MAX_TENTATIVAS;
      await db
        .update(lembrete)
        .set({ status: esgotou ? "falhou" : "agendado", ultimoErro: e instanceof Error ? e.name : "erro" })
        .where(eq(lembrete.id, l.id));
      resumo.falhas++;
    }
  }
  return resumo;
}

/** Mantém a janela de 7 dias para todos os planos publicados (rodado pelo processador). */
export async function renovarAgendas(agora = new Date()) {
  const publicados = await db.select({ id: plano.id }).from(plano).where(eq(plano.status, "publicado"));
  let criados = 0;
  for (const p of publicados) {
    try {
      criados += await agendarLembretesDoPlano(p.id, agora);
    } catch (e) {
      console.error("[lembretes] falha ao renovar um plano:", e instanceof Error ? e.name : "erro");
    }
  }
  return criados;
}
