"use server";

import { eq } from "drizzle-orm";
import { obterSessao } from "@/server/auth/sessao";
import { db } from "@/server/db/cliente";
import { session } from "@/server/db/schema";
import { avaliarSessao } from "@/server/auth/politica-sessao";
import { ehProfissional } from "@/server/authz/politicas";

/** Continuidade autenticada: só renova a atividade de uma sessão ainda válida. */
export async function manterSessaoAcao(): Promise<{ ok: true; expiraEm: number } | { ok: false }> {
  const s = await obterSessao();
  if ("motivo" in s) return { ok: false };
  const agora = new Date();
  const [linha] = await db.update(session).set({ ultimaAtividade: agora }).where(eq(session.id, s.sessaoId)).returning({ criadaEm: session.createdAt });
  const r = avaliarSessao({ criadaEm: linha.criadaEm, ultimaAtividade: agora, profissional: ehProfissional(s.ator), agora: agora.getTime() });
  return { ok: true, expiraEm: agora.getTime() + r.restanteMs };
}
