"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AcessoNegado } from "@/server/authz/politicas";
import { obterSessao } from "@/server/auth/sessao";
import { responderQuestionario } from "@/server/dominio/entendimento";
import { agendarLembretesDoPlano, definirPreferenciaLembrete } from "@/server/dominio/lembretes";
import { listarPlanosVigentes, registrarDose, registrarUsoSeNecessario, solicitarAjuda } from "@/server/dominio/paciente";

const entradaSchema = z.object({
  planoId: z.uuid(),
  itemId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario: z.string().regex(/^\d{2}:\d{2}$/),
  situacao: z.enum(["relatou_tomada", "nao_tomou", "duvida"]).nullable(),
});

/** Ação de servidor: autentica, valida e autoriza de novo, sem confiar no cliente. */
export async function registrarDoseAcao(entrada: unknown): Promise<{ ok: boolean }> {
  const sessao = await obterSessao();
  if ("motivo" in sessao) return { ok: false };
  const dados = entradaSchema.safeParse(entrada);
  if (!dados.success) return { ok: false };
  try {
    await registrarDose(sessao.ator, dados.data);
    return { ok: true };
  } catch (e) {
    if (e instanceof AcessoNegado) return { ok: false };
    throw e;
  }
}

const ajudaSchema = z.object({
  planoId: z.uuid(),
  tipo: z.enum(["dificuldade_medicamento", "duvida_geral"]),
  texto: z.string().trim().min(3, "Escreva um pouco mais.").max(300, "Use até 300 caracteres."),
});

export async function solicitarAjudaAcao(entrada: unknown): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await obterSessao();
  if ("motivo" in sessao) return { ok: false, erro: "Sua sessão expirou. Entre novamente." };
  const dados = ajudaSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: dados.error.issues[0].message };
  try {
    const r = await solicitarAjuda(sessao.ator, dados.data);
    if (r.ok) revalidatePath(`/paciente/planos/${dados.data.planoId}`);
    return r;
  } catch (e) {
    if (e instanceof AcessoNegado) return { ok: false, erro: "Não foi possível enviar." };
    throw e;
  }
}

export async function responderEntendimentoAcao(planoId: string, respostas: unknown) {
  const sessao = await obterSessao();
  if ("motivo" in sessao) return { ok: false as const };
  try {
    const r = await responderQuestionario(sessao.ator, z.uuid().parse(planoId), respostas);
    return { ok: true as const, ...r };
  } catch (e) {
    if (e instanceof AcessoNegado || e instanceof z.ZodError) return { ok: false as const };
    throw e;
  }
}

export async function definirLembretesAcao(ativo: boolean) {
  const sessao = await obterSessao();
  if ("motivo" in sessao) return { ok: false as const };
  await definirPreferenciaLembrete(sessao.ator.userId, ativo === true);
  if (ativo === true) {
    for (const p of await listarPlanosVigentes(sessao.ator)) await agendarLembretesDoPlano(p.planoId);
  }
  revalidatePath("/paciente");
  return { ok: true as const };
}

/** Uso de remédio "se necessário": o servidor usa a própria hora e aplica os limites do plano. */
export async function registrarUsoAcao(planoId: string, itemId: string) {
  const sessao = await obterSessao();
  if ("motivo" in sessao) return { ok: false as const, motivo: "sessao" as const };
  const ids = z.object({ planoId: z.uuid(), itemId: z.string().regex(/^[a-z0-9-]{1,40}$/) }).safeParse({ planoId, itemId });
  if (!ids.success) return { ok: false as const, motivo: "invalido" as const };
  try {
    return await registrarUsoSeNecessario(sessao.ator, ids.data);
  } catch (e) {
    if (e instanceof AcessoNegado) return { ok: false as const, motivo: "invalido" as const };
    throw e;
  }
}
