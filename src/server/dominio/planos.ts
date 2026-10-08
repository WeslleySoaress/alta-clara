import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { auditar } from "../auditoria";
import {
  AcessoNegado,
  podeAprovarEPublicar,
  podeCriarOuEditarRascunho,
  podeDevolverParaRascunho,
  podeEditarPlano,
  podeEnviarParaRevisao,
  podeVerPlano,
  type Ator,
  type FatosPlano,
} from "../authz/politicas";
import { db, type Tx } from "../db/cliente";
import { atendimento, equipeAtendimento, instituicao, modeloProtocolo, paciente, plano } from "../db/schema";
import { conteudoPlanoSchema, type ConteudoPlano } from "./conteudo";
import { agendarLembretesDoPlano, cancelarLembretesDeOutrasVersoes } from "./lembretes";
import { abrirPendencia } from "./pendencias";

export class ConflitoDeVersao extends Error {
  constructor() {
    super("Outra pessoa alterou este plano. Recarregue a página para ver a versão atual.");
  }
}

export class EstadoInvalido extends Error {}

async function equipeDo(atendimentoId: string, tx: Tx | typeof db = db): Promise<string[]> {
  const linhas = await tx
    .select({ userId: equipeAtendimento.userId })
    .from(equipeAtendimento)
    .where(eq(equipeAtendimento.atendimentoId, atendimentoId));
  return linhas.map((l) => l.userId);
}

async function fatosDoPlano(planoId: string, tx: Tx | typeof db = db, travar = false) {
  const consulta = tx.select().from(plano).where(eq(plano.id, planoId));
  const [p] = travar ? await consulta.for("update") : await consulta;
  if (!p) return null;
  const fatos: FatosPlano = {
    instituicaoId: p.instituicaoId,
    pacienteId: p.pacienteId,
    atendimentoId: p.atendimentoId,
    status: p.status,
    autorId: p.autorId,
    editores: p.editores,
    equipe: await equipeDo(p.atendimentoId, tx),
  };
  return { plano: p, fatos };
}

/** Lê um plano com autorização por objeto. Não encontrado e negado são iguais para quem chama. */
export async function lerPlano(ator: Ator, planoId: string) {
  const r = await fatosDoPlano(planoId);
  if (!r || !podeVerPlano(ator, r.fatos)) {
    await auditar({ atorUserId: ator.userId, acao: "plano.ler", recursoTipo: "plano", recursoId: planoId, resultado: "negado" });
    return null;
  }
  return r.plano;
}

/** Atendimentos que o profissional pode ver, por instituição. */
export async function listarAtendimentosDoProfissional(ator: Ator) {
  const instituicoesRevisor = ator.mfaAtivo
    ? ator.vinculos.filter((v) => v.papel === "revisor").map((v) => v.instituicaoId)
    : [];
  const instituicoesEnfermagem = ator.mfaAtivo
    ? ator.vinculos.filter((v) => v.papel === "enfermagem").map((v) => v.instituicaoId)
    : [];
  if (!instituicoesRevisor.length && !instituicoesEnfermagem.length) return [];

  const linhas = await db
    .select({
      atendimentoId: atendimento.id,
      instituicaoId: atendimento.instituicaoId,
      instituicao: instituicao.nome,
      procedimento: atendimento.procedimento,
      unidade: atendimento.unidade,
      admissaoEm: atendimento.admissaoEm,
      pacienteNome: paciente.nome,
      pacienteNascimento: paciente.dataNascimento,
      prontuario: paciente.prontuario,
      naEquipe: sql<boolean>`exists (select 1 from ${equipeAtendimento} e where e.atendimento_id = ${atendimento.id} and e.user_id = ${ator.userId})`,
    })
    .from(atendimento)
    .innerJoin(paciente, eq(paciente.id, atendimento.pacienteId))
    .innerJoin(instituicao, eq(instituicao.id, atendimento.instituicaoId))
    .where(inArray(atendimento.instituicaoId, [...instituicoesRevisor, ...instituicoesEnfermagem]))
    .orderBy(desc(atendimento.admissaoEm));

  const visiveis = linhas.filter((l) => instituicoesRevisor.includes(l.instituicaoId) || l.naEquipe);
  if (!visiveis.length) return [];

  const versoes = await db
    .select({ atendimentoId: plano.atendimentoId, id: plano.id, versao: plano.versao, status: plano.status })
    .from(plano)
    .where(inArray(plano.atendimentoId, visiveis.map((v) => v.atendimentoId)))
    .orderBy(asc(plano.versao));

  return visiveis.map((v) => ({ ...v, planos: versoes.filter((p) => p.atendimentoId === v.atendimentoId) }));
}

/** Dados do atendimento para a área profissional, com autorização. */
export async function lerAtendimento(ator: Ator, atendimentoId: string) {
  const [a] = await db
    .select({
      id: atendimento.id,
      instituicaoId: atendimento.instituicaoId,
      instituicao: instituicao.nome,
      telefoneInstituicao: instituicao.telefone,
      procedimento: atendimento.procedimento,
      unidade: atendimento.unidade,
      admissaoEm: atendimento.admissaoEm,
      altaPrevistaEm: atendimento.altaPrevistaEm,
      pacienteId: paciente.id,
      pacienteNome: paciente.nome,
      pacienteNascimento: paciente.dataNascimento,
      prontuario: paciente.prontuario,
      pacienteAtivado: sql<boolean>`${paciente.userId} is not null`,
    })
    .from(atendimento)
    .innerJoin(paciente, eq(paciente.id, atendimento.pacienteId))
    .innerJoin(instituicao, eq(instituicao.id, atendimento.instituicaoId))
    .where(eq(atendimento.id, atendimentoId));
  if (!a) return null;
  const equipe = await equipeDo(a.id);
  const fatos = { instituicaoId: a.instituicaoId, pacienteId: a.pacienteId, atendimentoId: a.id, equipe };
  const autorizado =
    podeCriarOuEditarRascunho(ator, fatos) ||
    podeVerPlano(ator, { ...fatos, status: "rascunho", autorId: "" });
  if (!autorizado) {
    await auditar({ atorUserId: ator.userId, acao: "atendimento.ler", recursoTipo: "atendimento", recursoId: atendimentoId, resultado: "negado" });
    return null;
  }
  const versoes = await db
    .select({
      id: plano.id,
      versao: plano.versao,
      status: plano.status,
      autorId: plano.autorId,
      revisorId: plano.revisorId,
      publicadoEm: plano.publicadoEm,
      motivoAlteracao: plano.motivoAlteracao,
    })
    .from(plano)
    .where(eq(plano.atendimentoId, a.id))
    .orderBy(desc(plano.versao));
  const modelos = await db
    .select({ id: modeloProtocolo.id, nome: modeloProtocolo.nome, versao: modeloProtocolo.versao, sintetico: modeloProtocolo.sintetico })
    .from(modeloProtocolo)
    .where(eq(modeloProtocolo.instituicaoId, a.instituicaoId));
  return { ...a, equipe, versoes, modelos, podeEditar: podeCriarOuEditarRascunho(ator, fatos) };
}

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Cria o primeiro rascunho a partir de um modelo. Medicamentos nunca vêm do modelo. */
export async function criarRascunho(ator: Ator, atendimentoId: string, modeloId: string) {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(atendimento).where(eq(atendimento.id, atendimentoId)).for("update");
    if (!a) throw new AcessoNegado("plano.criar");
    const equipe = await equipeDo(a.id, tx);
    if (!podeCriarOuEditarRascunho(ator, { instituicaoId: a.instituicaoId, pacienteId: a.pacienteId, atendimentoId: a.id, equipe })) {
      await auditar({ atorUserId: ator.userId, instituicaoId: a.instituicaoId, acao: "plano.criar", recursoTipo: "atendimento", recursoId: a.id, resultado: "negado" }, tx);
      throw new AcessoNegado("plano.criar");
    }
    // O modelo precisa ser da mesma instituição do atendimento.
    const [m] = await tx
      .select()
      .from(modeloProtocolo)
      .where(and(eq(modeloProtocolo.id, modeloId), eq(modeloProtocolo.instituicaoId, a.instituicaoId)));
    if (!m) throw new AcessoNegado("plano.criar");

    await garantirSemVersaoEmEdicao(tx, a.id);
    const [inst] = await tx.select().from(instituicao).where(eq(instituicao.id, a.instituicaoId));
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${plano.versao}), 0)` })
      .from(plano)
      .where(eq(plano.atendimentoId, a.id));

    const inicio = a.altaPrevistaEm ?? hojeEmBrasilia();
    const conteudo: ConteudoPlano = {
      inicio,
      fusoHorario: "America/Sao_Paulo",
      medicamentos: [],
      cuidados: m.conteudo.cuidados,
      sinais: m.conteudo.sinais,
      retornos: m.conteudo.retornoSugeridoDias
        ? [{ local: a.unidade, dataHora: null, levar: m.conteudo.levarNoRetorno }]
        : [],
      contato: { unidade: a.unidade, telefone: inst.telefone, horarioAtendimento: "Todos os dias, 24 horas" },
      equipeResponsavel: a.unidade,
    };

    const [novo] = await tx
      .insert(plano)
      .values({
        instituicaoId: a.instituicaoId,
        atendimentoId: a.id,
        pacienteId: a.pacienteId,
        versao: Number(max) + 1,
        status: "rascunho",
        conteudo,
        modeloId: m.id,
        autorId: ator.userId,
        editores: [ator.userId],
      })
      .returning({ id: plano.id });
    await auditar({ atorUserId: ator.userId, instituicaoId: a.instituicaoId, acao: "plano.criar", recursoTipo: "plano", recursoId: novo.id, resultado: "permitido", detalhes: { versao: Number(max) + 1 } }, tx);
    return novo.id;
  });
}

/** Salva o rascunho com controle de concorrência otimista. */
export async function salvarRascunho(ator: Ator, planoId: string, revisaoEsperada: number, entrada: unknown) {
  const conteudo = conteudoPlanoSchema.parse(entrada);
  return db.transaction(async (tx) => {
    const r = await fatosDoPlano(planoId, tx, true);
    if (!r || !podeEditarPlano(ator, r.fatos)) {
      await auditar({ atorUserId: ator.userId, acao: "plano.editar", recursoTipo: "plano", recursoId: planoId, resultado: "negado" }, tx);
      throw new AcessoNegado("plano.editar");
    }
    if (r.plano.revisao !== revisaoEsperada) throw new ConflitoDeVersao();
    await tx
      .update(plano)
      .set({ conteudo, revisao: revisaoEsperada + 1, atualizadoEm: new Date(), editores: [...new Set([...r.plano.editores, ator.userId])] })
      .where(eq(plano.id, planoId));
    await auditar({ atorUserId: ator.userId, instituicaoId: r.fatos.instituicaoId, acao: "plano.editar", recursoTipo: "plano", recursoId: planoId, resultado: "permitido", detalhes: { revisao: revisaoEsperada + 1 } }, tx);
    return revisaoEsperada + 1;
  });
}

export async function enviarParaRevisao(ator: Ator, planoId: string, revisaoEsperada: number) {
  return db.transaction(async (tx) => {
    const r = await fatosDoPlano(planoId, tx, true);
    if (!r || !podeEnviarParaRevisao(ator, r.fatos)) throw new AcessoNegado("plano.enviar_revisao");
    if (r.plano.revisao !== revisaoEsperada) throw new ConflitoDeVersao();
    const conteudo = conteudoPlanoSchema.parse(r.plano.conteudo);
    if (conteudo.medicamentos.length === 0 && conteudo.cuidados.length === 0) {
      throw new EstadoInvalido("O plano está vazio.");
    }
    if (!conteudo.sinais.some((s) => s.nivel === "urgencia")) {
      throw new EstadoInvalido("Inclua ao menos uma orientação de urgência antes de enviar para revisão.");
    }
    await tx
      .update(plano)
      .set({ status: "em_revisao", enviadoRevisaoEm: new Date(), revisao: revisaoEsperada + 1 })
      .where(eq(plano.id, planoId));
    await auditar({ atorUserId: ator.userId, instituicaoId: r.fatos.instituicaoId, acao: "plano.enviar_revisao", recursoTipo: "plano", recursoId: planoId, resultado: "permitido" }, tx);
  });
}

export async function devolverParaRascunho(ator: Ator, planoId: string, motivo: string) {
  return db.transaction(async (tx) => {
    const r = await fatosDoPlano(planoId, tx, true);
    if (!r || !podeDevolverParaRascunho(ator, r.fatos)) throw new AcessoNegado("plano.devolver");
    await tx
      .update(plano)
      .set({ status: "rascunho", revisao: r.plano.revisao + 1, motivoAlteracao: motivo.slice(0, 500) })
      .where(eq(plano.id, planoId));
    await auditar({ atorUserId: ator.userId, instituicaoId: r.fatos.instituicaoId, acao: "plano.devolver", recursoTipo: "plano", recursoId: planoId, resultado: "permitido" }, tx);
  });
}

/**
 * Aprova e publica. Atômico: a versão publicada anterior vira "substituída" na
 * mesma transação. O índice único parcial impede duas versões publicadas.
 */
export async function aprovarEPublicar(ator: Ator, planoId: string, revisaoEsperada: number, confirmacao: string) {
  return db.transaction(async (tx) => {
    const r = await fatosDoPlano(planoId, tx, true);
    if (!r || !podeAprovarEPublicar(ator, r.fatos)) {
      await auditar({ atorUserId: ator.userId, acao: "plano.publicar", recursoTipo: "plano", recursoId: planoId, resultado: "negado" }, tx);
      throw new AcessoNegado("plano.publicar");
    }
    if (r.plano.revisao !== revisaoEsperada) throw new ConflitoDeVersao();

    // Confirmação explícita contra registro no paciente errado.
    const [pac] = await tx.select({ prontuario: paciente.prontuario }).from(paciente).where(eq(paciente.id, r.fatos.pacienteId));
    if (confirmacao.trim() !== pac.prontuario) {
      throw new EstadoInvalido("O prontuário digitado não confere com o paciente deste plano.");
    }

    const agora = new Date();
    await tx
      .update(plano)
      .set({ status: "substituido", substituidoEm: agora })
      .where(and(eq(plano.atendimentoId, r.fatos.atendimentoId), eq(plano.status, "publicado")));
    await tx
      .update(plano)
      .set({ status: "publicado", publicadoEm: agora, revisorId: ator.userId, revisao: revisaoEsperada + 1 })
      .where(eq(plano.id, planoId));
    await auditar({ atorUserId: ator.userId, instituicaoId: r.fatos.instituicaoId, acao: "plano.publicar", recursoTipo: "plano", recursoId: planoId, resultado: "permitido", detalhes: { versao: r.plano.versao } }, tx);

    // Lembretes: os da versão anterior são cancelados na mesma transação.
    await cancelarLembretesDeOutrasVersoes(r.fatos.atendimentoId, planoId, tx);
    await agendarLembretesDoPlano(planoId, agora, tx);

    const conteudoPublicado = conteudoPlanoSchema.parse(r.plano.conteudo);
    if (conteudoPublicado.retornos.some((x) => !x.dataHora)) {
      await abrirPendencia(
        {
          instituicaoId: r.fatos.instituicaoId,
          pacienteId: r.fatos.pacienteId,
          planoId,
          tipo: "retorno_nao_agendado",
          descricao: "Plano publicado com retorno ainda sem data. Agendar e informar o paciente.",
          chave: `retorno:${r.fatos.atendimentoId}`,
          criadoPor: null,
        },
        tx,
      );
    }
  });
}

/** Abre uma nova versão a partir da publicada. A publicada continua valendo até a nova ser aprovada. */
export async function abrirNovaVersao(ator: Ator, atendimentoId: string, motivo: string) {
  return db.transaction(async (tx) => {
    const [pub] = await tx
      .select()
      .from(plano)
      .where(and(eq(plano.atendimentoId, atendimentoId), eq(plano.status, "publicado")))
      .for("update");
    if (!pub) throw new EstadoInvalido("Não há versão publicada para alterar.");
    const equipe = await equipeDo(atendimentoId, tx);
    if (!podeCriarOuEditarRascunho(ator, { instituicaoId: pub.instituicaoId, pacienteId: pub.pacienteId, atendimentoId, equipe })) {
      throw new AcessoNegado("plano.nova_versao");
    }
    await garantirSemVersaoEmEdicao(tx, atendimentoId);
    const [{ max }] = await tx
      .select({ max: sql<number>`max(${plano.versao})` })
      .from(plano)
      .where(eq(plano.atendimentoId, atendimentoId));
    const [novo] = await tx
      .insert(plano)
      .values({
        instituicaoId: pub.instituicaoId,
        atendimentoId,
        pacienteId: pub.pacienteId,
        versao: Number(max) + 1,
        status: "rascunho",
        conteudo: pub.conteudo,
        modeloId: pub.modeloId,
        motivoAlteracao: motivo.trim().slice(0, 500) || null,
        autorId: ator.userId,
        editores: [ator.userId],
      })
      .returning({ id: plano.id });
    await auditar({ atorUserId: ator.userId, instituicaoId: pub.instituicaoId, acao: "plano.nova_versao", recursoTipo: "plano", recursoId: novo.id, resultado: "permitido", detalhes: { versao: Number(max) + 1 } }, tx);
    return novo.id;
  });
}

/** Plano com identificação do paciente e as ações permitidas ao ator, para a área profissional. */
export async function lerPlanoParaEquipe(ator: Ator, planoId: string) {
  const r = await fatosDoPlano(planoId);
  if (!r || !podeVerPlano(ator, r.fatos) || !ehProfissionalApto(ator)) {
    await auditar({ atorUserId: ator.userId, acao: "plano.ler", recursoTipo: "plano", recursoId: planoId, resultado: "negado" });
    return null;
  }
  const [id] = await db
    .select({
      pacienteNome: paciente.nome,
      pacienteNascimento: paciente.dataNascimento,
      prontuario: paciente.prontuario,
      procedimento: atendimento.procedimento,
      instituicao: instituicao.nome,
      autorNome: sql<string>`(select name from "user" where id = ${plano.autorId})`,
      revisorNome: sql<string | null>`(select name from "user" where id = ${plano.revisorId})`,
    })
    .from(plano)
    .innerJoin(paciente, eq(paciente.id, plano.pacienteId))
    .innerJoin(atendimento, eq(atendimento.id, plano.atendimentoId))
    .innerJoin(instituicao, eq(instituicao.id, plano.instituicaoId))
    .where(eq(plano.id, planoId));
  await auditar({ atorUserId: ator.userId, instituicaoId: r.fatos.instituicaoId, acao: "plano.ler", recursoTipo: "plano", recursoId: planoId, resultado: "permitido" });
  return {
    plano: r.plano,
    ...id,
    permissoes: {
      editar: podeEditarPlano(ator, r.fatos),
      enviarRevisao: podeEnviarParaRevisao(ator, r.fatos),
      publicar: podeAprovarEPublicar(ator, r.fatos),
      devolver: podeDevolverParaRascunho(ator, r.fatos),
      autorEhVoce: r.plano.autorId === ator.userId || r.plano.editores.includes(ator.userId),
    },
  };
}

async function garantirSemVersaoEmEdicao(tx: Tx, atendimentoId: string) {
  const [aberta] = await tx
    .select({ versao: plano.versao })
    .from(plano)
    .where(and(eq(plano.atendimentoId, atendimentoId), inArray(plano.status, ["rascunho", "em_revisao"])));
  if (aberta) throw new EstadoInvalido(`A versão ${aberta.versao} deste atendimento já está em edição ou revisão. Continue por ela.`);
}

function ehProfissionalApto(ator: Ator) {
  return ator.mfaAtivo && ator.vinculos.length > 0;
}
