import { and, desc, eq, gt } from "drizzle-orm";
import { auditar } from "../auditoria";
import { db } from "../db/cliente";
import { session } from "../db/schema";
import { descreverAparelho } from "./aparelho";

// Sessões do próprio usuário, identificadas por id — o token da sessão nunca
// vai para o navegador (a lista padrão da biblioteca expõe tokens ao JS).

export async function listarMinhasSessoes(userId: string, sessaoAtualId: string) {
  const linhas = await db
    .select({ id: session.id, userAgent: session.userAgent, criadaEm: session.createdAt, ultimaAtividade: session.ultimaAtividade })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.createdAt));
  return linhas.map((l) => ({
    id: l.id,
    aparelho: descreverAparelho(l.userAgent),
    criadaEm: l.criadaEm.toISOString(),
    ultimaAtividade: (l.ultimaAtividade ?? l.criadaEm).toISOString(),
    atual: l.id === sessaoAtualId,
  }));
}

/** Encerra uma sessão do próprio usuário (a condição por userId impede encerrar a de outra pessoa). */
export async function encerrarMinhaSessao(userId: string, sessaoId: string) {
  const r = await db.delete(session).where(and(eq(session.id, sessaoId), eq(session.userId, userId))).returning({ id: session.id });
  await auditar({ atorUserId: userId, acao: "sessao.encerrar_outra", recursoTipo: "sessao", resultado: r.length ? "permitido" : "negado" });
  return r.length === 1;
}
