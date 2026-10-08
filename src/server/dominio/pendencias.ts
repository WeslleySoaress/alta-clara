import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { auditar } from "../auditoria";
import { AcessoNegado, temPapel, type Ator } from "../authz/politicas";
import { db, type Tx } from "../db/cliente";
import { atendimento, equipeAtendimento, paciente, pendencia, plano, user } from "../db/schema";

// Pendências após a alta: tarefas operacionais para a equipe. Não
// diagnosticam, não classificam urgência e não substituem o atendimento.

export type TipoPendencia = (typeof pendencia.$inferInsert)["tipo"];

export const ROTULO_PENDENCIA: Record<TipoPendencia, string> = {
  retorno_nao_agendado: "Retorno não agendado",
  duvida_dose: "Dúvida sobre uma dose",
  entendimento: "Orientação a reforçar",
  dificuldade_medicamento: "Dificuldade para obter medicamento",
  duvida_geral: "Dúvida do paciente",
};

/** Cria se não houver outra aberta com a mesma chave (índice único parcial). */
export async function abrirPendencia(
  p: {
    instituicaoId: string;
    pacienteId: string;
    planoId: string | null;
    tipo: TipoPendencia;
    descricao: string;
    chave: string | null;
    criadoPor: string | null;
  },
  tx?: Tx,
) {
  await (tx ?? db).execute(sql`
    insert into ${pendencia} (instituicao_id, paciente_id, plano_id, tipo, descricao, chave, criado_por)
    values (${p.instituicaoId}, ${p.pacienteId}, ${p.planoId}, ${p.tipo}, ${p.descricao.slice(0, 500)}, ${p.chave}, ${p.criadoPor})
    on conflict do nothing`);
}

/** Pendências visíveis ao profissional: revisor vê a instituição; enfermagem, os pacientes da sua equipe. */
export async function listarPendencias(ator: Ator, incluirResolvidas = false) {
  if (!ator.mfaAtivo) return [];
  const instRevisor = ator.vinculos.filter((v) => v.papel === "revisor").map((v) => v.instituicaoId);
  const instEnf = ator.vinculos.filter((v) => v.papel === "enfermagem").map((v) => v.instituicaoId);
  if (!instRevisor.length && !instEnf.length) return [];

  const linhas = await db
    .select({
      id: pendencia.id,
      instituicaoId: pendencia.instituicaoId,
      tipo: pendencia.tipo,
      descricao: pendencia.descricao,
      criadoEm: pendencia.criadoEm,
      resolvidaEm: pendencia.resolvidaEm,
      resolucao: pendencia.resolucao,
      planoId: pendencia.planoId,
      atendimentoId: plano.atendimentoId,
      pacienteNome: paciente.nome,
      prontuario: paciente.prontuario,
      criadoPorNome: user.name,
      naEquipe: sql<boolean>`exists (select 1 from ${equipeAtendimento} e join ${atendimento} a on a.id = e.atendimento_id
        where a.paciente_id = ${pendencia.pacienteId} and e.user_id = ${ator.userId})`,
    })
    .from(pendencia)
    .innerJoin(paciente, eq(paciente.id, pendencia.pacienteId))
    .leftJoin(plano, eq(plano.id, pendencia.planoId))
    .leftJoin(user, eq(user.id, pendencia.criadoPor))
    .where(
      and(
        inArray(pendencia.instituicaoId, [...instRevisor, ...instEnf]),
        incluirResolvidas ? undefined : isNull(pendencia.resolvidaEm),
      ),
    )
    .orderBy(desc(pendencia.criadoEm));
  return linhas.filter((l) => instRevisor.includes(l.instituicaoId) || l.naEquipe);
}

export async function resolverPendencia(ator: Ator, id: string, resolucao: string) {
  const visiveis = await listarPendencias(ator);
  const alvo = visiveis.find((p) => p.id === id);
  if (!alvo || !temPapel(ator, alvo.instituicaoId, "enfermagem", "revisor")) {
    await auditar({ atorUserId: ator.userId, acao: "pendencia.resolver", recursoTipo: "pendencia", recursoId: id, resultado: "negado" });
    throw new AcessoNegado("pendencia.resolver");
  }
  await db
    .update(pendencia)
    .set({ resolvidaEm: new Date(), resolvidaPor: ator.userId, resolucao: resolucao.trim().slice(0, 500) })
    .where(and(eq(pendencia.id, id), isNull(pendencia.resolvidaEm)));
  await auditar({ atorUserId: ator.userId, instituicaoId: alvo.instituicaoId, acao: "pendencia.resolver", recursoTipo: "pendencia", recursoId: id, resultado: "permitido" });
}

/** Pendências abertas pelo próprio paciente/cuidador (para ele acompanhar). */
export async function pendenciasDoPlanoParaPaciente(planoId: string, ator: Ator, titular: boolean) {
  // O titular vê todos os pedidos do plano; cada cuidador, só os que ele mesmo fez.
  return db
    .select({ id: pendencia.id, tipo: pendencia.tipo, descricao: pendencia.descricao, criadoEm: pendencia.criadoEm, resolvidaEm: pendencia.resolvidaEm, resolucao: pendencia.resolucao })
    .from(pendencia)
    .where(
      and(
        eq(pendencia.planoId, planoId),
        inArray(pendencia.tipo, ["dificuldade_medicamento", "duvida_geral", "duvida_dose"]),
        titular ? undefined : eq(pendencia.criadoPor, ator.userId),
      ),
    )
    .orderBy(desc(pendencia.criadoEm))
    .limit(20);
}
