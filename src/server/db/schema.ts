import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ConteudoPlano, ConteudoModelo } from "../dominio/conteudo";
import { user } from "./auth-schema";

export * from "./auth-schema";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

const criadoEm = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ── Instituições e vínculos profissionais ──────────────────────────────────

export const instituicao = pgTable("instituicao", {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  telefone: text().notNull(),
  criadoEm: criadoEm(),
});

export const papelProfissional = pgEnum("papel_profissional", [
  "enfermagem",
  "revisor",
  "admin",
  "auditor",
]);

/** Papel de um profissional em uma instituição. Só a instituição concede. */
export const vinculo = pgTable(
  "vinculo",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull().references(() => user.id),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    papel: papelProfissional().notNull(),
    ativo: boolean().notNull().default(true),
    concedidoPor: text().references(() => user.id),
    criadoEm: criadoEm(),
    desativadoEm: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex().on(t.userId, t.instituicaoId, t.papel)],
);

// ── Pacientes e atendimentos ───────────────────────────────────────────────

export const paciente = pgTable(
  "paciente",
  {
    id: uuid().primaryKey().defaultRandom(),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    nome: text().notNull(),
    dataNascimento: date().notNull(),
    prontuario: text().notNull(),
    /** Canal validado no atendimento, usado para o código de ativação. */
    emailContato: text().notNull(),
    /** Conta vinculada depois da ativação. */
    userId: text().references(() => user.id),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex().on(t.instituicaoId, t.prontuario), index().on(t.userId)],
);

export const atendimento = pgTable(
  "atendimento",
  {
    id: uuid().primaryKey().defaultRandom(),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    procedimento: text().notNull(),
    unidade: text().notNull(),
    admissaoEm: date().notNull(),
    altaPrevistaEm: date(),
    criadoEm: criadoEm(),
  },
  (t) => [index().on(t.pacienteId)],
);

/** Vínculo assistencial: profissionais que cuidam de um atendimento. */
export const equipeAtendimento = pgTable(
  "equipe_atendimento",
  {
    atendimentoId: uuid().notNull().references(() => atendimento.id),
    userId: text().notNull().references(() => user.id),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex().on(t.atendimentoId, t.userId)],
);

// ── Modelos e planos de alta ───────────────────────────────────────────────

export const modeloProtocolo = pgTable("modelo_protocolo", {
  id: uuid().primaryKey().defaultRandom(),
  instituicaoId: uuid().notNull().references(() => instituicao.id),
  nome: text().notNull(),
  versao: integer().notNull(),
  conteudo: jsonb().$type<ConteudoModelo>().notNull(),
  /** Modelos de demonstração são sintéticos e não validados clinicamente. */
  sintetico: boolean().notNull().default(true),
  criadoEm: criadoEm(),
});

export const statusPlano = pgEnum("status_plano", [
  "rascunho",
  "em_revisao",
  "publicado",
  "substituido",
  "encerrado",
]);

/**
 * Cada linha é uma versão do plano de alta. Depois de publicada, a versão é
 * imutável: alterações criam uma nova versão que substitui a anterior.
 */
export const plano = pgTable(
  "plano",
  {
    id: uuid().primaryKey().defaultRandom(),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    atendimentoId: uuid().notNull().references(() => atendimento.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    versao: integer().notNull(),
    status: statusPlano().notNull().default("rascunho"),
    conteudo: jsonb().$type<ConteudoPlano>().notNull(),
    modeloId: uuid().references(() => modeloProtocolo.id),
    motivoAlteracao: text(),
    autorId: text().notNull().references(() => user.id),
    /** Todos que editaram esta versão: nenhum deles pode aprová-la (separação de funções). */
    editores: jsonb().$type<string[]>().notNull().default([]),
    revisorId: text().references(() => user.id),
    enviadoRevisaoEm: timestamp({ withTimezone: true }),
    publicadoEm: timestamp({ withTimezone: true }),
    substituidoEm: timestamp({ withTimezone: true }),
    /** Controle de concorrência otimista para edições do rascunho. */
    revisao: integer().notNull().default(0),
    criadoEm: criadoEm(),
    atualizadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex().on(t.atendimentoId, t.versao),
    // No máximo uma versão publicada e um rascunho/revisão por atendimento.
    uniqueIndex("plano_um_publicado").on(t.atendimentoId).where(sql`status = 'publicado'`),
    uniqueIndex("plano_um_em_edicao")
      .on(t.atendimentoId)
      .where(sql`status in ('rascunho', 'em_revisao')`),
    index().on(t.pacienteId),
  ],
);

// ── Convites (QR code) e cuidadores ────────────────────────────────────────

export const tipoConvite = pgEnum("tipo_convite", ["paciente", "cuidador"]);

/**
 * Convite de ativação. O token aparece só no QR code; o banco guarda apenas
 * o SHA-256 dele. O código enviado ao canal validado também fica só em hash.
 */
export const convite = pgTable(
  "convite",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: tipoConvite().notNull(),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    tokenHash: bytea().notNull(),
    emailDestino: text().notNull(),
    /** Para convites de cuidador: o que ele poderá fazer. */
    escopo: jsonb().$type<string[]>(),
    /** Convite de cuidador: por quantos dias o acesso valerá depois de aceito (null = até revogar). */
    validadeAcessoDias: integer(),
    /** Convite de cuidador: nome que o paciente deu (ex.: "Filha Ana"). */
    apelidoDestino: text(),
    criadoPor: text().notNull().references(() => user.id),
    criadoEm: criadoEm(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    revogadoEm: timestamp({ withTimezone: true }),
    // Etapa de verificação (depois que o token sai da URL).
    sessaoAtivacaoHash: bytea(),
    codigoHash: bytea(),
    codigoExpiraEm: timestamp({ withTimezone: true }),
    codigoTentativas: integer().notNull().default(0),
    /** Tetos por convite contra força bruta do código ao longo da validade. */
    codigosEnviados: integer().notNull().default(0),
    tentativasTotais: integer().notNull().default(0),
    codigoVerificadoEm: timestamp({ withTimezone: true }),
    consumidoEm: timestamp({ withTimezone: true }),
    consumidoPor: text().references(() => user.id),
  },
  (t) => [uniqueIndex().on(t.tokenHash), uniqueIndex().on(t.sessaoAtivacaoHash)],
);

export const autorizacaoCuidador = pgTable(
  "autorizacao_cuidador",
  {
    id: uuid().primaryKey().defaultRandom(),
    pacienteId: uuid().notNull().references(() => paciente.id),
    cuidadorUserId: text().notNull().references(() => user.id),
    escopo: jsonb().$type<string[]>().notNull(),
    concedidoPor: text().notNull().references(() => user.id),
    conviteId: uuid().references(() => convite.id),
    criadoEm: criadoEm(),
    expiraEm: timestamp({ withTimezone: true }),
    revogadoEm: timestamp({ withTimezone: true }),
    revogadoPor: text().references(() => user.id),
  },
  (t) => [
    uniqueIndex("cuidador_ativo_unico")
      .on(t.pacienteId, t.cuidadorUserId)
      .where(sql`revogado_em is null`),
  ],
);

// ── Registros relatados pelo paciente/cuidador ─────────────────────────────

export const situacaoDose = pgEnum("situacao_dose", ["relatou_tomada", "nao_tomou", "duvida"]);

/**
 * O que o paciente ou cuidador RELATOU. Não comprova ingestão.
 * A chave única torna o registro idempotente: dois cuidadores marcando a
 * mesma dose atualizam o mesmo registro em vez de duplicar.
 */
export const registroDose = pgTable(
  "registro_dose",
  {
    id: uuid().primaryKey().defaultRandom(),
    planoId: uuid().notNull().references(() => plano.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    itemId: text().notNull(),
    data: date().notNull(),
    horario: text().notNull(),
    situacao: situacaoDose().notNull(),
    observacao: text(),
    registradoPor: text().notNull().references(() => user.id),
    registradoEm: criadoEm(),
  },
  (t) => [uniqueIndex().on(t.planoId, t.itemId, t.data, t.horario)],
);

// ── Confirmação de entendimento, pendências e lembretes ────────────────────

export type RespostaEntendimento = { perguntaId: string; escolha: string; correta: boolean };

/** Respostas às perguntas do plano. Uma resposta certa isolada não certifica compreensão. */
export const confirmacaoEntendimento = pgTable(
  "confirmacao_entendimento",
  {
    id: uuid().primaryKey().defaultRandom(),
    planoId: uuid().notNull().references(() => plano.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    respondidoPor: text().notNull().references(() => user.id),
    respostas: jsonb().$type<RespostaEntendimento[]>().notNull(),
    acertos: integer().notNull(),
    total: integer().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index().on(t.planoId)],
);

export const tipoPendencia = pgEnum("tipo_pendencia", [
  "retorno_nao_agendado",
  "duvida_dose",
  "entendimento",
  "dificuldade_medicamento",
  "duvida_geral",
]);

/** Tarefas operacionais para a equipe. Não diagnosticam nem classificam urgência. */
export const pendencia = pgTable(
  "pendencia",
  {
    id: uuid().primaryKey().defaultRandom(),
    instituicaoId: uuid().notNull().references(() => instituicao.id),
    pacienteId: uuid().notNull().references(() => paciente.id),
    planoId: uuid().references(() => plano.id),
    tipo: tipoPendencia().notNull(),
    /** Texto curto escrito pelo paciente/cuidador ou gerado pelo sistema. */
    descricao: text().notNull(),
    /** Chave para não duplicar pendências geradas automaticamente. */
    chave: text(),
    criadoPor: text().references(() => user.id),
    criadoEm: criadoEm(),
    resolvidaEm: timestamp({ withTimezone: true }),
    resolvidaPor: text().references(() => user.id),
    resolucao: text(),
  },
  (t) => [
    index().on(t.instituicaoId, t.resolvidaEm),
    uniqueIndex("pendencia_chave_aberta").on(t.chave).where(sql`resolvida_em is null and chave is not null`),
  ],
);

export const statusLembrete = pgEnum("status_lembrete", ["agendado", "enviando", "enviado", "cancelado", "falhou"]);

/**
 * Lembrete agendado no servidor. "Enviado" significa que a mensagem saiu
 * para o provedor — não que foi vista ou seguida.
 */
export const lembrete = pgTable(
  "lembrete",
  {
    id: uuid().primaryKey().defaultRandom(),
    planoId: uuid().notNull().references(() => plano.id),
    userId: text().notNull().references(() => user.id),
    itemId: text().notNull(),
    /** Instante exato (UTC) calculado a partir do horário local e do fuso do plano. */
    agendadoPara: timestamp({ withTimezone: true }).notNull(),
    status: statusLembrete().notNull().default("agendado"),
    tentativas: integer().notNull().default(0),
    ultimoErro: text(),
    enviadoEm: timestamp({ withTimezone: true }),
    /** Reserva do processador que está enviando (evita envio em dobro). */
    reservadoEm: timestamp({ withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    // Idempotência: o mesmo lembrete nunca é criado duas vezes.
    uniqueIndex().on(t.planoId, t.userId, t.itemId, t.agendadoPara),
    index().on(t.status, t.agendadoPara),
  ],
);

/** Quem quer receber lembretes (opção do próprio usuário). */
export const preferenciaLembrete = pgTable("preferencia_lembrete", {
  userId: text().primaryKey().references(() => user.id),
  ativo: boolean().notNull().default(false),
  atualizadoEm: criadoEm(),
});

// ── Auditoria e mensagens ──────────────────────────────────────────────────

export const resultadoAuditoria = pgEnum("resultado_auditoria", ["permitido", "negado", "erro"]);

/**
 * Quem fez o quê, quando, onde e com qual resultado — sem conteúdo clínico.
 * O usuário da aplicação só tem INSERT e SELECT nesta tabela.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    ocorridoEm: criadoEm(),
    atorUserId: text(),
    instituicaoId: uuid(),
    acao: text().notNull(),
    recursoTipo: text(),
    recursoId: text(),
    resultado: resultadoAuditoria().notNull(),
    detalhes: jsonb().$type<Record<string, string | number | boolean | null>>(),
  },
  (t) => [index().on(t.instituicaoId, t.ocorridoEm), index().on(t.atorUserId, t.ocorridoEm)],
);

/**
 * ADAPTADOR LOCAL DE DESENVOLVIMENTO: substitui o envio real de e-mail.
 * As mensagens aparecem em /dev/mensagens e nunca saem da máquina.
 */
export const mensagemDev = pgTable("mensagem_dev", {
  id: uuid().primaryKey().defaultRandom(),
  para: text().notNull(),
  assunto: text().notNull(),
  corpo: text().notNull(),
  criadoEm: criadoEm(),
});

/**
 * Tentativas de login por conta (chave = SHA-256 do e-mail digitado, exista a
 * conta ou não — não revela existência). Complementa o limite por IP, que
 * sozinho prejudica redes hospitalares compartilhadas. Bloqueio sempre
 * temporário: nunca impede o paciente de entrar de forma permanente.
 */
export const tentativaLogin = pgTable("tentativa_login", {
  chave: bytea().primaryKey(),
  falhas: integer().notNull().default(0),
  janelaInicio: timestamp({ withTimezone: true }).notNull().defaultNow(),
  bloqueadoAte: timestamp({ withTimezone: true }),
});
