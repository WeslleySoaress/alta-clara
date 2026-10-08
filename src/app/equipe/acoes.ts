"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { AcessoNegado, ehProfissional } from "@/server/authz/politicas";
import { obterSessao } from "@/server/auth/sessao";
import { criarConvitePaciente } from "@/server/dominio/convites";
import { alterarVinculo } from "@/server/dominio/instituicao";
import { resolverPendencia } from "@/server/dominio/pendencias";
import { auditar } from "@/server/auditoria";
import { iaDisponivel, sugerirSimplificacao } from "@/server/integracoes/ia";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/server/db/cliente";
import { auditoria as auditoriaTabela } from "@/server/db/schema";

const LIMITE_IA_DIA = 40;
import {
  abrirNovaVersao,
  aprovarEPublicar,
  ConflitoDeVersao,
  criarRascunho,
  devolverParaRascunho,
  enviarParaRevisao,
  EstadoInvalido,
  salvarRascunho,
} from "@/server/dominio/planos";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const uuid = z.uuid();

/** Toda ação: sessão válida + perfil profissional com MFA. O resto é decidido no domínio. */
async function atorProfissional() {
  const s = await obterSessao();
  if ("motivo" in s) redirect("/entrar?motivo=inatividade");
  if (!ehProfissional(s.ator) || !s.ator.mfaAtivo) throw new AcessoNegado("equipe");
  return s.ator;
}

function traduzirErro(e: unknown): { ok: false; erro: string } {
  if (e instanceof AcessoNegado) return { ok: false, erro: "Você não tem permissão para esta ação." };
  if (e instanceof ConflitoDeVersao || e instanceof EstadoInvalido) return { ok: false, erro: e.message };
  if (e instanceof ZodError) {
    const p = e.issues[0];
    return { ok: false, erro: `Revise ${descreverCaminho(p.path)}: ${traduzirMensagem(p)}` };
  }
  console.error("[equipe] erro inesperado", e instanceof Error ? e.name : "desconhecido");
  return { ok: false, erro: "Não foi possível concluir. Tente de novo." };
}

export async function criarRascunhoAcao(atendimentoId: string, modeloId: string): Promise<Resultado> {
  let planoId: string;
  try {
    const ator = await atorProfissional();
    planoId = await criarRascunho(ator, uuid.parse(atendimentoId), uuid.parse(modeloId));
  } catch (e) {
    return traduzirErro(e);
  }
  redirect(`/equipe/planos/${planoId}`);
}

export async function salvarRascunhoAcao(planoId: string, revisao: number, conteudo: unknown): Promise<Resultado<{ revisao: number }>> {
  try {
    const ator = await atorProfissional();
    const nova = await salvarRascunho(ator, uuid.parse(planoId), z.number().int().parse(revisao), conteudo);
    return { ok: true, revisao: nova };
  } catch (e) {
    return traduzirErro(e);
  }
}

export async function enviarRevisaoAcao(planoId: string, revisao: number): Promise<Resultado> {
  try {
    const ator = await atorProfissional();
    await enviarParaRevisao(ator, uuid.parse(planoId), z.number().int().parse(revisao));
  } catch (e) {
    return traduzirErro(e);
  }
  revalidatePath(`/equipe/planos/${planoId}`);
  return { ok: true };
}

export async function devolverAcao(planoId: string, motivo: string): Promise<Resultado> {
  try {
    const ator = await atorProfissional();
    await devolverParaRascunho(ator, uuid.parse(planoId), z.string().trim().min(3).max(500).parse(motivo));
  } catch (e) {
    return traduzirErro(e);
  }
  revalidatePath(`/equipe/planos/${planoId}`);
  return { ok: true };
}

export async function publicarAcao(planoId: string, revisao: number, confirmacao: string): Promise<Resultado> {
  try {
    const ator = await atorProfissional();
    await aprovarEPublicar(ator, uuid.parse(planoId), z.number().int().parse(revisao), String(confirmacao));
  } catch (e) {
    return traduzirErro(e);
  }
  revalidatePath(`/equipe/planos/${planoId}`);
  return { ok: true };
}

export async function novaVersaoAcao(atendimentoId: string, motivo: string): Promise<Resultado> {
  let planoId: string;
  try {
    const ator = await atorProfissional();
    planoId = await abrirNovaVersao(ator, uuid.parse(atendimentoId), z.string().trim().min(3).max(500).parse(motivo));
  } catch (e) {
    return traduzirErro(e);
  }
  redirect(`/equipe/planos/${planoId}`);
}

/** Gera o convite. O token volta UMA vez para montar o QR e não é guardado. */
export async function gerarConviteAcao(atendimentoId: string): Promise<Resultado<{ token: string; expiraEm: string; emailMascarado: string; jaAtivado: boolean }>> {
  try {
    const ator = await atorProfissional();
    const c = await criarConvitePaciente(ator, uuid.parse(atendimentoId));
    return { ok: true, token: c.token, expiraEm: c.expiraEm.toISOString(), emailMascarado: c.emailMascarado, jaAtivado: c.jaAtivado };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Publique")) return { ok: false, erro: e.message };
    return traduzirErro(e);
  }
}

export async function resolverPendenciaAcao(id: string, resolucao: string): Promise<Resultado> {
  try {
    const ator = await atorProfissional();
    await resolverPendencia(ator, uuid.parse(id), z.string().trim().min(3, "Descreva o que foi feito.").max(500).parse(resolucao));
  } catch (e) {
    return traduzirErro(e);
  }
  revalidatePath("/equipe/pendencias");
  return { ok: true };
}

export async function alterarVinculoAcao(vinculoId: string, ativo: boolean): Promise<Resultado> {
  try {
    const ator = await atorProfissional();
    await alterarVinculo(ator, uuid.parse(vinculoId), ativo === true);
  } catch (e) {
    return traduzirErro(e);
  }
  revalidatePath("/equipe/admin");
  return { ok: true };
}

/** Sugestão de linguagem simples (IA). Só sugere: a equipe decide se usa. */
export async function sugerirSimplificacaoAcao(texto: string) {
  const ator = await atorProfissional().catch(() => null);
  if (!ator) return { estado: "recusada" as const, motivo: "Sem permissão." };
  // Cota diária por profissional (custo e abuso de conta comprometida).
  const [{ usos }] = await db
    .select({ usos: sql<number>`count(*)::int` })
    .from(auditoriaTabela)
    .where(and(eq(auditoriaTabela.atorUserId, ator.userId), eq(auditoriaTabela.acao, "ia.sugerir_simplificacao"), gt(auditoriaTabela.ocorridoEm, new Date(Date.now() - 86_400_000))));
  if (usos >= LIMITE_IA_DIA) return { estado: "recusada" as const, motivo: `Limite de ${LIMITE_IA_DIA} sugestões por dia atingido.` };
  const r = await sugerirSimplificacao(String(texto ?? ""));
  // Auditoria sem o texto (pode conter conteúdo clínico).
  await auditar({ atorUserId: ator.userId, acao: "ia.sugerir_simplificacao", resultado: r.estado === "ok" ? "permitido" : "erro", detalhes: { estado: r.estado } });
  return r;
}

export async function iaDisponivelAcao() {
  return iaDisponivel();
}

const NOMES: Record<string, string> = {
  medicamentos: "Medicamento",
  cuidados: "Cuidado",
  sinais: "Orientação",
  retornos: "Retorno",
  nome: "nome",
  finalidade: "para que serve",
  dose: "dose",
  via: "como usar",
  horarios: "horários",
  duracaoDias: "duração",
  seNecessario: "uso se necessário",
  intervaloMinimoHoras: "intervalo mínimo",
  maximoPorDia: "máximo por dia",
  quando: "quando usar",
  titulo: "título",
  texto: "texto",
  local: "local",
  contato: "contato",
  telefone: "telefone",
  unidade: "unidade",
  horarioAtendimento: "horário de atendimento",
  equipeResponsavel: "equipe responsável",
  inicio: "primeiro dia",
};

/** "medicamentos › 0 › dose" → "Medicamento 1 › dose" (numeração igual à da tela). */
function descreverCaminho(caminho: PropertyKey[]): string {
  const partes: string[] = [];
  for (const p of caminho) {
    if (typeof p === "number") partes[partes.length - 1] = `${partes[partes.length - 1] ?? "item"} ${p + 1}`;
    else partes.push(NOMES[String(p)] ?? String(p));
  }
  return partes.join(" › ") || "o formulário";
}

function traduzirMensagem(p: { code: string; message: string; minimum?: unknown; maximum?: unknown }): string {
  if (p.code === "too_small") return p.minimum === 1 ? "não pode ficar vazio ou zero" : `o mínimo é ${String(p.minimum)}`;
  if (p.code === "too_big") return `o máximo é ${String(p.maximum)}`;
  if (p.code === "invalid_type") return "valor inválido";
  return p.message;
}
