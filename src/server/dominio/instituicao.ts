import { and, desc, eq, inArray } from "drizzle-orm";
import { auditar } from "../auditoria";
import { AcessoNegado, podeConsultarAuditoria, temPapel, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { auditoria, instituicao, session, user, vinculo } from "../db/schema";

// Administração institucional: gerencia vínculos, sem acesso clínico.

function instituicoesAdmin(ator: Ator) {
  return ator.mfaAtivo ? ator.vinculos.filter((v) => v.papel === "admin").map((v) => v.instituicaoId) : [];
}

export async function listarEquipe(ator: Ator) {
  const ids = instituicoesAdmin(ator);
  if (!ids.length) return [];
  return db
    .select({
      vinculoId: vinculo.id,
      instituicao: instituicao.nome,
      nome: user.name,
      email: user.email,
      papel: vinculo.papel,
      ativo: vinculo.ativo,
      desativadoEm: vinculo.desativadoEm,
      mfa: user.twoFactorEnabled,
      userId: user.id,
    })
    .from(vinculo)
    .innerJoin(user, eq(user.id, vinculo.userId))
    .innerJoin(instituicao, eq(instituicao.id, vinculo.instituicaoId))
    .where(inArray(vinculo.instituicaoId, ids))
    .orderBy(user.name);
}

/**
 * Desligamento/retirada de papel: desativa o vínculo e encerra TODAS as
 * sessões da pessoa (efeito imediato, inclusive em outros aparelhos).
 */
export async function alterarVinculo(ator: Ator, vinculoId: string, ativo: boolean) {
  const [v] = await db.select().from(vinculo).where(eq(vinculo.id, vinculoId));
  if (!v || !ator.mfaAtivo || !temPapel(ator, v.instituicaoId, "admin") || v.userId === ator.userId) {
    await auditar({ atorUserId: ator.userId, acao: "vinculo.alterar", recursoTipo: "vinculo", recursoId: vinculoId, resultado: "negado" });
    throw new AcessoNegado("vinculo.alterar");
  }
  await db.transaction(async (tx) => {
    await tx.update(vinculo).set({ ativo, desativadoEm: ativo ? null : new Date() }).where(eq(vinculo.id, vinculoId));
    if (!ativo) await tx.delete(session).where(eq(session.userId, v.userId));
    await auditar({ atorUserId: ator.userId, instituicaoId: v.instituicaoId, acao: ativo ? "vinculo.reativar" : "vinculo.desativar", recursoTipo: "vinculo", recursoId: vinculoId, resultado: "permitido" }, tx);
  });
}

/** Trilha de auditoria com exposição mínima: sem conteúdo clínico, sem nome de paciente. */
export async function consultarAuditoria(ator: Ator, filtro: { somenteNegados?: boolean } = {}) {
  const ids = [...new Set(ator.vinculos.map((v) => v.instituicaoId))].filter((i) => podeConsultarAuditoria(ator, i));
  if (!ids.length) throw new AcessoNegado("auditoria.consultar");
  await auditar({ atorUserId: ator.userId, instituicaoId: ids[0], acao: "auditoria.consultar", resultado: "permitido" });
  return db
    .select({
      id: auditoria.id,
      ocorridoEm: auditoria.ocorridoEm,
      acao: auditoria.acao,
      recursoTipo: auditoria.recursoTipo,
      recursoId: auditoria.recursoId,
      resultado: auditoria.resultado,
      ator: user.name,
    })
    .from(auditoria)
    .leftJoin(user, eq(user.id, auditoria.atorUserId))
    .where(and(inArray(auditoria.instituicaoId, ids), filtro.somenteNegados ? eq(auditoria.resultado, "negado") : undefined))
    .orderBy(desc(auditoria.ocorridoEm))
    .limit(200);
}
