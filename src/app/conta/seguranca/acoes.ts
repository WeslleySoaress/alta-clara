"use server";

import { z } from "zod";
import { obterSessao } from "@/server/auth/sessao";
import { encerrarMinhaSessao, listarMinhasSessoes } from "@/server/auth/sessoes";
import { modoDemonstracao } from "@/server/demonstracao";

export async function listarSessoesAcao() {
  const s = await obterSessao();
  if ("motivo" in s) return [];
  return listarMinhasSessoes(s.ator.userId, s.sessaoId);
}

export async function encerrarSessaoAcao(sessaoId: string) {
  // Na demonstração as contas são compartilhadas: encerrar derrubaria outro visitante.
  if (modoDemonstracao()) return { ok: false };
  const s = await obterSessao();
  if ("motivo" in s) return { ok: false };
  const id = z.string().min(1).max(100).safeParse(sessaoId);
  if (!id.success || id.data === s.sessaoId) return { ok: false };
  return { ok: await encerrarMinhaSessao(s.ator.userId, id.data) };
}
