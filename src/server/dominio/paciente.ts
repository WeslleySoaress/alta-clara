import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { partesNoFuso } from "@/lib/fuso";
import { avaliarUsoSeNecessario } from "@/lib/se-necessario";
import { auditar } from "../auditoria";
import { AcessoNegado, podeRegistrarDose, podeVerPlano, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { atendimento, instituicao, paciente, pendencia as pendenciaTabela, plano, registroDose, user } from "../db/schema";
import { conteudoPlanoSchema } from "./conteudo";
import { abrirPendencia } from "./pendencias";

/** Pacientes que o ator pode acompanhar (os próprios e os autorizados). */
function pacientesVisiveis(ator: Ator): string[] {
  return [
    ...ator.pacientesProprios,
    ...ator.cuidadorDe.filter((c) => c.escopo.includes("ver_plano")).map((c) => c.pacienteId),
  ];
}

/** Planos publicados vigentes que o paciente/cuidador pode ver. */
export async function listarPlanosVigentes(ator: Ator) {
  const ids = pacientesVisiveis(ator);
  if (!ids.length) return [];
  return db
    .select({
      planoId: plano.id,
      versao: plano.versao,
      publicadoEm: plano.publicadoEm,
      pacienteId: paciente.id,
      pacienteNome: paciente.nome,
      procedimento: atendimento.procedimento,
      instituicao: instituicao.nome,
      proprio: sql<boolean>`${paciente.userId} = ${ator.userId}`,
    })
    .from(plano)
    .innerJoin(paciente, eq(paciente.id, plano.pacienteId))
    .innerJoin(atendimento, eq(atendimento.id, plano.atendimentoId))
    .innerJoin(instituicao, eq(instituicao.id, plano.instituicaoId))
    .where(and(inArray(plano.pacienteId, ids), eq(plano.status, "publicado")));
}

/** Plano completo para a tela do paciente, com autorização por objeto. */
export async function lerPlanoDoPaciente(ator: Ator, planoId: string) {
  const [linha] = await db
    .select({
      plano,
      procedimento: atendimento.procedimento,
      instituicao: instituicao.nome,
      autorNome: sql<string>`(select name from ${user} where id = ${plano.autorId})`,
      revisorNome: sql<string | null>`(select name from ${user} where id = ${plano.revisorId})`,
    })
    .from(plano)
    .innerJoin(atendimento, eq(atendimento.id, plano.atendimentoId))
    .innerJoin(instituicao, eq(instituicao.id, plano.instituicaoId))
    .where(eq(plano.id, planoId));

  const permitido =
    linha &&
    podeVerPlano(ator, {
      instituicaoId: linha.plano.instituicaoId,
      pacienteId: linha.plano.pacienteId,
      atendimentoId: linha.plano.atendimentoId,
      status: linha.plano.status,
      autorId: linha.plano.autorId,
      equipe: [],
    }) &&
    pacientesVisiveis(ator).includes(linha.plano.pacienteId);

  await auditar({
    atorUserId: ator.userId,
    instituicaoId: linha?.plano.instituicaoId ?? null,
    acao: "plano.ler_paciente",
    recursoTipo: "plano",
    recursoId: planoId,
    resultado: permitido ? "permitido" : "negado",
  });
  if (!permitido) return null;

  // Registros de TODAS as versões do atendimento: publicar uma nova versão não
  // "apaga" o que o paciente já marcou no dia (evita dose dobrada). Se a mesma
  // dose tiver registro em duas versões, vale o mais recente.
  const todos = await db
    .select({
      itemId: registroDose.itemId,
      data: registroDose.data,
      horario: registroDose.horario,
      situacao: registroDose.situacao,
      registradoEm: registroDose.registradoEm,
      por: user.name,
      proprio: sql<boolean>`${registroDose.registradoPor} = ${ator.userId}`,
    })
    .from(registroDose)
    .innerJoin(user, eq(user.id, registroDose.registradoPor))
    .where(inArray(registroDose.planoId, planosDoAtendimento(linha.plano.atendimentoId)))
    .orderBy(asc(registroDose.registradoEm));
  const porDose = new Map(todos.map((r) => [`${r.itemId}|${r.data}|${r.horario}`, r] as const));
  const registros = [...porDose.values()].map((r) => ({ itemId: r.itemId, data: r.data, horario: r.horario, situacao: r.situacao, por: r.por, proprio: r.proprio }));

  // Versão vigente do atendimento, para avisar quem abriu uma versão antiga.
  const [vigente] =
    linha.plano.status === "publicado"
      ? [{ id: linha.plano.id }]
      : await db.select({ id: plano.id }).from(plano).where(and(eq(plano.atendimentoId, linha.plano.atendimentoId), eq(plano.status, "publicado")));

  return {
    id: linha.plano.id,
    pacienteId: linha.plano.pacienteId,
    vigenteId: vigente?.id ?? null,
    versao: linha.plano.versao,
    status: linha.plano.status,
    publicadoEm: linha.plano.publicadoEm,
    conteudo: conteudoPlanoSchema.parse(linha.plano.conteudo),
    procedimento: linha.procedimento,
    instituicao: linha.instituicao,
    autorNome: linha.autorNome,
    revisorNome: linha.revisorNome,
    podeRegistrar: linha.plano.status === "publicado" && podeRegistrarDose(ator, linha.plano.pacienteId),
    registros,
  };
}

export type Situacao = "relatou_tomada" | "nao_tomou" | "duvida";

/**
 * Registro relatado (não comprova ingestão). Idempotente: a mesma dose
 * marcada duas vezes, ou por dois cuidadores ao mesmo tempo, gera um registro.
 */
export async function registrarDose(
  ator: Ator,
  entrada: { planoId: string; itemId: string; data: string; horario: string; situacao: Situacao | null },
) {
  const [p] = await db.select().from(plano).where(eq(plano.id, entrada.planoId));
  if (!p || p.status !== "publicado" || !podeRegistrarDose(ator, p.pacienteId)) {
    await auditar({ atorUserId: ator.userId, acao: "dose.registrar", recursoTipo: "plano", recursoId: entrada.planoId, resultado: "negado" });
    throw new AcessoNegado("dose.registrar");
  }

  // A dose precisa existir na prescrição revisada desta versão.
  const conteudo = conteudoPlanoSchema.parse(p.conteudo);
  const item = conteudo.medicamentos.find((m) => m.id === entrada.itemId);
  // Horário fixo: precisa estar na prescrição. "Se necessário": só desfazer (o
  // registro de uso passa por registrarUsoSeNecessario, que aplica os limites).
  const horarioValido = item?.seNecessario ? entrada.situacao === null : item?.horarios.includes(entrada.horario);
  if (!item || !horarioValido || !/^\d{4}-\d{2}-\d{2}$/.test(entrada.data) || !/^\d{2}:\d{2}$/.test(entrada.horario)) {
    throw new AcessoNegado("dose.registrar");
  }
  const dia = (Date.parse(`${entrada.data}T00:00:00Z`) - Date.parse(`${conteudo.inicio}T00:00:00Z`)) / 86_400_000;
  if (dia < 0 || (item.duracaoDias !== null && dia >= item.duracaoDias)) throw new AcessoNegado("dose.registrar");

  if (entrada.situacao === null) {
    // Desfaz em qualquer versão do mesmo atendimento (o registro pode ser da versão anterior).
    await db
      .delete(registroDose)
      .where(
        and(
          inArray(registroDose.planoId, planosDoAtendimento(p.atendimentoId)),
          eq(registroDose.itemId, item.id),
          eq(registroDose.data, entrada.data),
          eq(registroDose.horario, entrada.horario),
        ),
      );
  } else {
    await db
      .insert(registroDose)
      .values({
        planoId: p.id,
        pacienteId: p.pacienteId,
        itemId: item.id,
        data: entrada.data,
        horario: entrada.horario,
        situacao: entrada.situacao,
        registradoPor: ator.userId,
      })
      .onConflictDoUpdate({
        target: [registroDose.planoId, registroDose.itemId, registroDose.data, registroDose.horario],
        set: { situacao: entrada.situacao, registradoPor: ator.userId, registradoEm: new Date() },
      });
  }
  if (entrada.situacao === "duvida") {
    await abrirPendencia({
      instituicaoId: p.instituicaoId,
      pacienteId: p.pacienteId,
      planoId: p.id,
      tipo: "duvida_dose",
      descricao: `Dúvida registrada sobre ${item.nome} (${entrada.data} às ${entrada.horario}).`,
      chave: `duvida:${p.id}:${item.id}:${entrada.data}:${entrada.horario}`,
      criadoPor: ator.userId,
    });
  }
  await auditar({
    atorUserId: ator.userId,
    instituicaoId: p.instituicaoId,
    acao: "dose.registrar",
    recursoTipo: "plano",
    recursoId: p.id,
    resultado: "permitido",
    detalhes: { situacao: entrada.situacao },
  });
}

const LIMITE_SOLICITACOES_ABERTAS = 5;

/** Pedido de ajuda do paciente/cuidador: vira pendência para a equipe. Não é canal de urgência. */
export async function solicitarAjuda(ator: Ator, entrada: { planoId: string; tipo: "dificuldade_medicamento" | "duvida_geral"; texto: string }) {
  const [p] = await db.select().from(plano).where(eq(plano.id, entrada.planoId));
  const pode = p && p.status === "publicado" && (ator.pacientesProprios.includes(p.pacienteId) || ator.cuidadorDe.some((c) => c.pacienteId === p.pacienteId && c.escopo.includes("ver_plano")));
  if (!pode) {
    await auditar({ atorUserId: ator.userId, acao: "pendencia.solicitar", recursoTipo: "plano", recursoId: entrada.planoId, resultado: "negado" });
    throw new AcessoNegado("pendencia.solicitar");
  }
  const texto = entrada.texto.trim().slice(0, 300);
  if (texto.length < 3) throw new AcessoNegado("pendencia.solicitar");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pendenciaTabela)
    .where(and(eq(pendenciaTabela.planoId, p.id), eq(pendenciaTabela.criadoPor, ator.userId), isNull(pendenciaTabela.resolvidaEm)));
  if (n >= LIMITE_SOLICITACOES_ABERTAS) return { ok: false as const, erro: "Você já tem 5 solicitações em aberto. Aguarde o retorno da equipe ou ligue para a unidade." };
  await abrirPendencia({ instituicaoId: p.instituicaoId, pacienteId: p.pacienteId, planoId: p.id, tipo: entrada.tipo, descricao: texto, chave: null, criadoPor: ator.userId });
  await auditar({ atorUserId: ator.userId, instituicaoId: p.instituicaoId, acao: "pendencia.solicitar", recursoTipo: "plano", recursoId: p.id, resultado: "permitido", detalhes: { tipo: entrada.tipo } });
  return { ok: true as const };
}

/** Ids das versões de plano de um atendimento (subconsulta). */
function planosDoAtendimento(atendimentoId: string) {
  return db.select({ id: plano.id }).from(plano).where(eq(plano.atendimentoId, atendimentoId));
}

export type ResultadoUso =
  | { ok: true; data: string; horario: string }
  | { ok: false; motivo: "intervalo"; proximo: string }
  | { ok: false; motivo: "maximo_dia" }
  | { ok: false; motivo: "fora_do_periodo" };

/**
 * Registra o uso de um remédio "se necessário" AGORA (hora do servidor, no fuso
 * do plano — o cliente não escolhe o horário). Aplica só os limites do plano
 * aprovado. Trava por plano+item evita que dois cuidadores furem o intervalo.
 */
export async function registrarUsoSeNecessario(ator: Ator, entrada: { planoId: string; itemId: string }, agora = new Date()): Promise<ResultadoUso> {
  const [p] = await db.select().from(plano).where(eq(plano.id, entrada.planoId));
  if (!p || p.status !== "publicado" || !podeRegistrarDose(ator, p.pacienteId)) {
    await auditar({ atorUserId: ator.userId, acao: "dose.uso_se_necessario", recursoTipo: "plano", recursoId: entrada.planoId, resultado: "negado" });
    throw new AcessoNegado("dose.uso_se_necessario");
  }
  const conteudo = conteudoPlanoSchema.parse(p.conteudo);
  const item = conteudo.medicamentos.find((m) => m.id === entrada.itemId);
  if (!item?.seNecessario) throw new AcessoNegado("dose.uso_se_necessario");
  const { data, horario } = partesNoFuso(agora, conteudo.fusoHorario);
  const dia = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${conteudo.inicio}T00:00:00Z`)) / 86_400_000;
  if (dia < 0 || (item.duracaoDias !== null && dia >= item.duracaoDias)) return { ok: false, motivo: "fora_do_periodo" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${p.atendimentoId + ":" + item.id}))`);
    const usos = await tx
      .select({ data: registroDose.data, horario: registroDose.horario })
      .from(registroDose)
      .where(
        and(
          inArray(registroDose.planoId, tx.select({ id: plano.id }).from(plano).where(eq(plano.atendimentoId, p.atendimentoId))),
          eq(registroDose.itemId, item.id),
          eq(registroDose.situacao, "relatou_tomada"),
        ),
      );
    const av = avaliarUsoSeNecessario({ usos, intervaloMinimoHoras: item.seNecessario!.intervaloMinimoHoras, maximoPorDia: item.seNecessario!.maximoPorDia, agora, fuso: conteudo.fusoHorario });
    if (!av.permitido) {
      return av.motivo === "intervalo"
        ? ({ ok: false, motivo: "intervalo", proximo: av.proximo.toISOString() } as const)
        : ({ ok: false, motivo: "maximo_dia" } as const);
    }
    await tx
      .insert(registroDose)
      .values({ planoId: p.id, pacienteId: p.pacienteId, itemId: item.id, data, horario, situacao: "relatou_tomada", registradoPor: ator.userId })
      .onConflictDoNothing();
    await auditar({ atorUserId: ator.userId, instituicaoId: p.instituicaoId, acao: "dose.uso_se_necessario", recursoTipo: "plano", recursoId: p.id, resultado: "permitido" }, tx);
    return { ok: true, data, horario } as const;
  });
}
