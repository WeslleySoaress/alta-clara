import { z } from "zod";

// Estrutura do conteúdo de um plano de alta. Validada no servidor em toda
// gravação; o cliente nunca grava JSON livre.

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const texto = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max);

export const apresentacoes = ["comprimido", "capsula", "liquido", "gotas", "pomada"] as const;

export const medicamentoSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    nome: texto(120),
    finalidade: texto(200),
    apresentacao: z.enum(apresentacoes),
    dose: texto(80),
    via: texto(40),
    /** Horários planejados. Vazio somente para uso "se necessário". */
    horarios: z.array(hhmm).max(8),
    duracaoDias: z.number().int().min(1).max(365).nullable(),
    seNecessario: z
      .object({
        quando: texto(160),
        intervaloMinimoHoras: z.number().int().min(1).max(48),
        maximoPorDia: z.number().int().min(1).max(12),
      })
      .nullable(),
    observacao: z.string().trim().max(300).nullable(),
  })
  .refine((m) => (m.seNecessario ? m.horarios.length === 0 : m.horarios.length > 0), {
    message: "Informe horários fixos ou marque como 'se necessário', não os dois.",
    path: ["horarios"],
  });

export const categoriasCuidado = ["ferida", "banho", "alimentacao", "atividade", "outro"] as const;

export const cuidadoSchema = z.object({
  categoria: z.enum(categoriasCuidado),
  titulo: texto(80),
  texto: texto(500),
});

/**
 * Grupos de orientação (seção 10 do documento de requisitos): nenhum deles
 * afirma ausência de risco.
 */
export const niveisSinal = ["previsto", "contato", "urgencia"] as const;
export type NivelSinal = (typeof niveisSinal)[number];

export const sinalSchema = z.object({
  nivel: z.enum(niveisSinal),
  texto: texto(200),
});

export const retornoSchema = z.object({
  local: texto(160),
  /** Data e hora locais "YYYY-MM-DDTHH:MM", ou null se ainda não agendado. */
  dataHora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
  levar: z.array(texto(120)).max(10),
});

export const conteudoPlanoSchema = z.object({
  inicio: dataIso,
  fusoHorario: z.literal("America/Sao_Paulo"),
  medicamentos: z.array(medicamentoSchema).max(30),
  cuidados: z.array(cuidadoSchema).max(30),
  sinais: z.array(sinalSchema).max(40),
  retornos: z.array(retornoSchema).max(5),
  contato: z.object({
    unidade: texto(120),
    telefone: texto(30),
    horarioAtendimento: texto(120),
  }),
  equipeResponsavel: texto(160),
});

export type ConteudoPlano = z.infer<typeof conteudoPlanoSchema>;
export type MedicamentoPlano = z.infer<typeof medicamentoSchema>;

export const conteudoModeloSchema = z.object({
  procedimento: texto(160),
  cuidados: z.array(cuidadoSchema),
  sinais: z.array(sinalSchema),
  retornoSugeridoDias: z.number().int().min(1).max(180).nullable(),
  levarNoRetorno: z.array(texto(120)),
});

export type ConteudoModelo = z.infer<typeof conteudoModeloSchema>;
