import { and, asc, eq, inArray } from "drizzle-orm";
import { auditar } from "../auditoria";
import { podeVerPlano, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { plano, user } from "../db/schema";
import { conteudoPlanoSchema, type ConteudoPlano, type MedicamentoPlano } from "./conteudo";

export type Mudanca = {
  secao: "Remédios" | "Cuidados" | "Quando procurar ajuda" | "Retorno" | "Contato";
  tipo: "incluido" | "removido" | "alterado";
  titulo: string;
  antes?: string;
  depois?: string;
};

const horarios = (m: MedicamentoPlano) =>
  m.seNecessario ? `se necessário (${m.seNecessario.quando}; mín. ${m.seNecessario.intervaloMinimoHoras} h; máx. ${m.seNecessario.maximoPorDia}/dia)` : m.horarios.join(", ");
const duracao = (m: MedicamentoPlano) => (m.duracaoDias === null ? "uso contínuo" : `${m.duracaoDias} dias`);

const CAMPOS_MED: [string, (m: MedicamentoPlano) => string][] = [
  ["Dose", (m) => m.dose],
  ["Como usar", (m) => m.via],
  ["Horários", horarios],
  ["Duração", duracao],
  ["Observação", (m) => m.observacao ?? "—"],
  ["Para que serve", (m) => m.finalidade],
];

const ROTULO_NIVEL = { urgencia: "Urgência", contato: "Contato com a unidade", previsto: "Cuidado previsto" } as const;

/** Compara duas versões publicadas. Função pura, testável. */
export function compararConteudos(antes: ConteudoPlano, depois: ConteudoPlano): Mudanca[] {
  const mudancas: Mudanca[] = [];

  const medAntes = new Map(antes.medicamentos.map((m) => [m.id, m]));
  const medDepois = new Map(depois.medicamentos.map((m) => [m.id, m]));
  for (const [id, m] of medDepois) {
    const a = medAntes.get(id);
    if (!a) {
      mudancas.push({ secao: "Remédios", tipo: "incluido", titulo: m.nome, depois: `${m.dose} · ${horarios(m)} · ${duracao(m)}` });
      continue;
    }
    if (a.nome !== m.nome) mudancas.push({ secao: "Remédios", tipo: "alterado", titulo: "Nome do medicamento", antes: a.nome, depois: m.nome });
    for (const [rotulo, f] of CAMPOS_MED) {
      if (f(a) !== f(m)) mudancas.push({ secao: "Remédios", tipo: "alterado", titulo: `${m.nome}: ${rotulo}`, antes: f(a), depois: f(m) });
    }
  }
  for (const [id, m] of medAntes) {
    if (!medDepois.has(id)) mudancas.push({ secao: "Remédios", tipo: "removido", titulo: m.nome, antes: `${m.dose} · ${horarios(m)}` });
  }

  const cuidAntes = new Map(antes.cuidados.map((c) => [c.titulo, c.texto]));
  const cuidDepois = new Map(depois.cuidados.map((c) => [c.titulo, c.texto]));
  for (const [t, texto] of cuidDepois) {
    if (!cuidAntes.has(t)) mudancas.push({ secao: "Cuidados", tipo: "incluido", titulo: t, depois: texto });
    else if (cuidAntes.get(t) !== texto) mudancas.push({ secao: "Cuidados", tipo: "alterado", titulo: t, antes: cuidAntes.get(t), depois: texto });
  }
  for (const [t, texto] of cuidAntes) if (!cuidDepois.has(t)) mudancas.push({ secao: "Cuidados", tipo: "removido", titulo: t, antes: texto });

  const chave = (s: { nivel: string; texto: string }) => `${s.nivel}|${s.texto}`;
  const sinAntes = new Set(antes.sinais.map(chave));
  const sinDepois = new Set(depois.sinais.map(chave));
  for (const s of depois.sinais) if (!sinAntes.has(chave(s))) mudancas.push({ secao: "Quando procurar ajuda", tipo: "incluido", titulo: ROTULO_NIVEL[s.nivel], depois: s.texto });
  for (const s of antes.sinais) if (!sinDepois.has(chave(s))) mudancas.push({ secao: "Quando procurar ajuda", tipo: "removido", titulo: ROTULO_NIVEL[s.nivel], antes: s.texto });

  const ret = (r?: ConteudoPlano["retornos"][number]) => (r ? `${r.dataHora?.replace("T", " às ") ?? "a agendar"} · ${r.local}` : undefined);
  const n = Math.max(antes.retornos.length, depois.retornos.length);
  for (let i = 0; i < n; i++) {
    const a = ret(antes.retornos[i]);
    const d = ret(depois.retornos[i]);
    if (a !== d) mudancas.push({ secao: "Retorno", tipo: !a ? "incluido" : !d ? "removido" : "alterado", titulo: `Retorno ${i + 1}`, antes: a, depois: d });
  }

  if (antes.inicio !== depois.inicio) {
    const br = (d: string) => d.split("-").reverse().join("/");
    mudancas.push({ secao: "Remédios", tipo: "alterado", titulo: "Primeiro dia do tratamento em casa (muda a contagem dos dias)", antes: br(antes.inicio), depois: br(depois.inicio) });
  }
  if (antes.equipeResponsavel !== depois.equipeResponsavel) {
    mudancas.push({ secao: "Contato", tipo: "alterado", titulo: "Equipe responsável", antes: antes.equipeResponsavel, depois: depois.equipeResponsavel });
  }
  if (antes.contato.unidade !== depois.contato.unidade) {
    mudancas.push({ secao: "Contato", tipo: "alterado", titulo: "Unidade para contato", antes: antes.contato.unidade, depois: depois.contato.unidade });
  }
  if (antes.contato.telefone !== depois.contato.telefone || antes.contato.horarioAtendimento !== depois.contato.horarioAtendimento) {
    mudancas.push({
      secao: "Contato",
      tipo: "alterado",
      titulo: "Contato da unidade",
      antes: `${antes.contato.telefone} · ${antes.contato.horarioAtendimento}`,
      depois: `${depois.contato.telefone} · ${depois.contato.horarioAtendimento}`,
    });
  }
  return mudancas;
}

/** Histórico de versões publicadas do mesmo atendimento, com a comparação de cada uma com a anterior. */
export async function historicoDoPlano(ator: Ator, planoId: string) {
  const [atual] = await db.select().from(plano).where(eq(plano.id, planoId));
  const permitido =
    atual &&
    podeVerPlano(ator, { instituicaoId: atual.instituicaoId, pacienteId: atual.pacienteId, atendimentoId: atual.atendimentoId, status: atual.status, autorId: atual.autorId, equipe: [] }) &&
    (ator.pacientesProprios.includes(atual.pacienteId) || ator.cuidadorDe.some((c) => c.pacienteId === atual.pacienteId));
  await auditar({ atorUserId: ator.userId, instituicaoId: atual?.instituicaoId ?? null, acao: "plano.historico", recursoTipo: "plano", recursoId: planoId, resultado: permitido ? "permitido" : "negado" });
  if (!permitido) return null;

  const versoes = await db
    .select({ id: plano.id, versao: plano.versao, status: plano.status, conteudo: plano.conteudo, publicadoEm: plano.publicadoEm, motivo: plano.motivoAlteracao, revisorId: plano.revisorId, autorId: plano.autorId })
    .from(plano)
    .where(and(eq(plano.atendimentoId, atual.atendimentoId), inArray(plano.status, ["publicado", "substituido", "encerrado"])))
    .orderBy(asc(plano.versao));
  const nomes = new Map(
    (await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, versoes.flatMap((v) => [v.autorId, v.revisorId ?? v.autorId])))).map((u) => [u.id, u.name]),
  );
  return versoes.map((v, i) => ({
    versao: v.versao,
    publicadoEm: v.publicadoEm,
    motivo: v.motivo,
    autor: nomes.get(v.autorId) ?? "—",
    revisor: v.revisorId ? (nomes.get(v.revisorId) ?? "—") : null,
    // "Atual" é a versão vigente (publicada), não a que está sendo vista.
    atual: v.status === "publicado",
    vista: v.id === planoId,
    mudancas: i === 0 ? null : compararConteudos(conteudoPlanoSchema.parse(versoes[i - 1].conteudo), conteudoPlanoSchema.parse(v.conteudo)),
  }));
}
