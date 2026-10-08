"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { AcessoNegado } from "@/server/authz/politicas";
import { obterSessao } from "@/server/auth/sessao";
import { cancelarConviteCuidador, convidarCuidador, EntradaInvalida, revogarCuidador } from "@/server/dominio/cuidadores";

async function ator() {
  const s = await obterSessao();
  if ("motivo" in s) throw new AcessoNegado("sessao");
  return s.ator;
}

function erro(e: unknown) {
  if (e instanceof ZodError) return { ok: false as const, erro: e.issues[0].message };
  if (e instanceof EntradaInvalida) return { ok: false as const, erro: e.message };
  if (e instanceof AcessoNegado) return { ok: false as const, erro: "Você não tem permissão para esta ação." };
  throw e;
}

export async function convidarCuidadorAcao(entrada: unknown) {
  try {
    const r = await convidarCuidador(await ator(), entrada);
    revalidatePath("/paciente/cuidadores");
    return { ok: true as const, token: r.token, expiraEm: r.expiraEm.toISOString(), emailMascarado: r.emailMascarado };
  } catch (e) {
    return erro(e);
  }
}

export async function revogarCuidadorAcao(autorizacaoId: string) {
  try {
    await revogarCuidador(await ator(), z.uuid().parse(autorizacaoId));
    revalidatePath("/paciente/cuidadores");
    return { ok: true as const };
  } catch (e) {
    return erro(e);
  }
}

export async function cancelarConviteAcao(conviteId: string) {
  try {
    await cancelarConviteCuidador(await ator(), z.uuid().parse(conviteId));
    revalidatePath("/paciente/cuidadores");
    return { ok: true as const };
  } catch (e) {
    return erro(e);
  }
}
