import type { ConteudoPlano } from "@/server/dominio/conteudo";

export type Situacao = "relatou_tomada" | "nao_tomou" | "duvida";

/** `por`: quem registrou (autoria das ações do círculo de cuidado). */
export type RegistroDose = { itemId: string; data: string; horario: string; situacao: Situacao; por?: string; proprio?: boolean };

/** Tudo que a tela do plano precisa. Montado no servidor depois da autorização. */
export type PlanoVisivel = {
  id: string;
  conteudo: ConteudoPlano;
  versao: number;
  publicadoEm: string | null;
  autorNome: string;
  revisorNome: string | null;
  instituicao: string;
  procedimento: string;
  registros: RegistroDose[];
  podeRegistrar: boolean;
};

/**
 * - paciente: registros vão para o servidor (ação passada por prop);
 * - previa: o profissional vê como o paciente verá, sem registrar;
 * - demo: demonstração pública, registros ficam só na memória da página.
 */
export type ModoPlano = "paciente" | "previa" | "demo";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  relatou_tomada: "Marquei como tomado",
  nao_tomou: "Não tomei",
  duvida: "Tenho dúvida",
};
