import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditar } from "../auditoria";
import { AcessoNegado, podeVerPlano, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { confirmacaoEntendimento, plano, user, type RespostaEntendimento } from "../db/schema";
import { conteudoPlanoSchema, type ConteudoPlano } from "./conteudo";
import { abrirPendencia } from "./pendencias";

// Confirmação de entendimento (inspirada no "teach-back" do AHRQ RED, ver
// docs/pesquisa.md). As perguntas são geradas DE FORMA DETERMINÍSTICA a partir
// do próprio plano aprovado — sem IA e sem conteúdo clínico novo. A correção
// acontece sempre no servidor. Acertar não certifica compreensão: erros e
// "não sei" viram pendência para a equipe reforçar a orientação.

export type Opcao = { id: string; texto: string };
export type Pergunta = { id: string; enunciado: string; opcoes: Opcao[]; secao: "remedios" | "ajuda"; correta: string };

const NAO_SEI: Opcao = { id: "nao-sei", texto: "Não sei / prefiro perguntar à equipe" };

const id = (...partes: string[]) => createHash("sha256").update(partes.join("|")).digest("hex").slice(0, 12);

/** Embaralha de forma estável (mesma ordem a cada carregamento). */
function embaralhar<T extends { id: string }>(itens: T[], semente: string): T[] {
  return [...itens].sort((a, b) => id(semente, a.id).localeCompare(id(semente, b.id)));
}

function deslocar(hhmm: string, horas: number) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String((h + horas + 24) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const listaHoras = (hs: string[]) => hs.map((h) => h.replace(":00", "h").replace(":", "h")).join(", ");

export function gerarPerguntas(conteudo: ConteudoPlano): Pergunta[] {
  const perguntas: Pergunta[] = [];

  for (const m of conteudo.medicamentos.filter((x) => x.horarios.length > 0).slice(0, 2)) {
    const certa = listaHoras(m.horarios);
    const candidatas = [listaHoras(m.horarios.map((h) => deslocar(h, 2))), listaHoras([m.horarios[0]]), listaHoras([...m.horarios, deslocar(m.horarios.at(-1)!, 4)])];
    const distratoras = [...new Set(candidatas)].filter((t) => t !== certa).slice(0, 2);
    const pid = id("horario", m.id);
    const opcoes = embaralhar([{ id: id(pid, certa), texto: certa }, ...distratoras.map((t) => ({ id: id(pid, t), texto: t }))], pid);
    perguntas.push({ id: pid, enunciado: `Em quais horários você deve usar ${m.nome}?`, opcoes: [...opcoes, NAO_SEI], secao: "remedios", correta: id(pid, certa) });
  }

  const sn = conteudo.medicamentos.find((x) => x.seNecessario);
  if (sn?.seNecessario) {
    const pid = id("se-necessario", sn.id);
    const certa = { id: id(pid, "sn"), texto: `Somente se necessário: ${sn.seNecessario.quando}` };
    const errada = { id: id(pid, "fixo"), texto: "Todos os dias, em horário fixo, mesmo sem precisar" };
    perguntas.push({ id: pid, enunciado: `Quando usar ${sn.nome}?`, opcoes: [...embaralhar([certa, errada], pid), NAO_SEI], secao: "remedios", correta: certa.id });
  }

  const grupos = [
    { nivel: "urgencia", texto: "Procurar atendimento de urgência, conforme a orientação recebida" },
    { nivel: "contato", texto: "Entrar em contato com a unidade" },
    { nivel: "previsto", texto: "Seguir os cuidados previstos no plano" },
  ] as const;
  for (const nivel of ["urgencia", "contato"] as const) {
    const sinal = conteudo.sinais.find((s) => s.nivel === nivel);
    if (!sinal) continue;
    const pid = id("sinal", nivel, sinal.texto);
    const opcoes = grupos.map((g) => ({ id: id(pid, g.nivel), texto: g.texto }));
    perguntas.push({
      id: pid,
      enunciado: `Se acontecer: “${sinal.texto}”. O que o seu plano orienta?`,
      opcoes: [...embaralhar(opcoes, pid), NAO_SEI],
      secao: "ajuda",
      correta: id(pid, nivel),
    });
  }
  return perguntas;
}

/** Perguntas sem a resposta certa, para enviar ao navegador. */
export function perguntasPublicas(conteudo: ConteudoPlano) {
  return gerarPerguntas(conteudo).map((p) => ({ id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, secao: p.secao }));
}

async function planoVisivel(ator: Ator, planoId: string) {
  const [p] = await db.select().from(plano).where(eq(plano.id, planoId));
  const permitido =
    p &&
    p.status === "publicado" &&
    podeVerPlano(ator, { instituicaoId: p.instituicaoId, pacienteId: p.pacienteId, atendimentoId: p.atendimentoId, status: p.status, autorId: p.autorId, equipe: [] }) &&
    (ator.pacientesProprios.includes(p.pacienteId) || ator.cuidadorDe.some((c) => c.pacienteId === p.pacienteId));
  return permitido ? p : null;
}

export async function lerQuestionario(ator: Ator, planoId: string) {
  const p = await planoVisivel(ator, planoId);
  if (!p) return null;
  const conteudo = conteudoPlanoSchema.parse(p.conteudo);
  return { versao: p.versao, perguntas: perguntasPublicas(conteudo) };
}

const respostasSchema = z.record(z.string().regex(/^[0-9a-f]{12}$/), z.string().regex(/^([0-9a-f]{12}|nao-sei)$/));

export async function responderQuestionario(ator: Ator, planoId: string, entrada: unknown) {
  const p = await planoVisivel(ator, planoId);
  if (!p) {
    await auditar({ atorUserId: ator.userId, acao: "entendimento.responder", recursoTipo: "plano", recursoId: planoId, resultado: "negado" });
    throw new AcessoNegado("entendimento.responder");
  }
  const respostas = respostasSchema.parse(entrada);
  const perguntas = gerarPerguntas(conteudoPlanoSchema.parse(p.conteudo));
  const avaliadas: RespostaEntendimento[] = perguntas.map((q) => ({
    perguntaId: q.id,
    escolha: respostas[q.id] ?? "nao-sei",
    correta: respostas[q.id] === q.correta,
  }));
  const acertos = avaliadas.filter((r) => r.correta).length;

  await db.insert(confirmacaoEntendimento).values({ planoId: p.id, pacienteId: p.pacienteId, respondidoPor: ator.userId, respostas: avaliadas, acertos, total: perguntas.length });

  const reforcar = perguntas.filter((q) => !avaliadas.find((a) => a.perguntaId === q.id)?.correta);
  if (reforcar.length) {
    await abrirPendencia({
      instituicaoId: p.instituicaoId,
      pacienteId: p.pacienteId,
      planoId: p.id,
      tipo: "entendimento",
      descricao: `Reforçar ${reforcar.length} de ${perguntas.length} pontos:\n${reforcar.map((q) => `• ${q.enunciado}`).join("\n")}`,
      chave: `entendimento:${p.id}:${ator.userId}`,
      criadoPor: ator.userId,
    });
  }
  await auditar({ atorUserId: ator.userId, instituicaoId: p.instituicaoId, acao: "entendimento.responder", recursoTipo: "plano", recursoId: p.id, resultado: "permitido", detalhes: { acertos, total: perguntas.length } });

  return {
    acertos,
    total: perguntas.length,
    resultado: perguntas.map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      secao: q.secao,
      correta: avaliadas.find((a) => a.perguntaId === q.id)!.correta,
      respostaCerta: q.opcoes.find((o) => o.id === q.correta)!.texto,
    })),
  };
}

/** Para a equipe: histórico de confirmações do plano (já autorizado pela página). */
export async function confirmacoesDoPlano(planoId: string) {
  return db
    .select({ acertos: confirmacaoEntendimento.acertos, total: confirmacaoEntendimento.total, criadoEm: confirmacaoEntendimento.criadoEm, por: user.name })
    .from(confirmacaoEntendimento)
    .innerJoin(user, eq(user.id, confirmacaoEntendimento.respondidoPor))
    .where(eq(confirmacaoEntendimento.planoId, planoId))
    .orderBy(desc(confirmacaoEntendimento.criadoEm));
}
