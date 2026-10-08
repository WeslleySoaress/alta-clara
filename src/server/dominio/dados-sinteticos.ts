import type { ConteudoModelo } from "./conteudo";

// TODO O CONTEÚDO ABAIXO É SINTÉTICO, criado só para demonstrar o software.
// Não é protocolo clínico e não foi validado por profissionais de saúde.
// Antes de qualquer uso real, a equipe habilitada deve escrever e validar
// os próprios modelos (seção 8 do documento de requisitos).

export const MODELOS_SINTETICOS: { nome: string; conteudo: ConteudoModelo }[] = [
  {
    nome: "Pós-operatório abdominal — modelo sintético",
    conteudo: {
      procedimento: "Cirurgia abdominal (exemplo)",
      cuidados: [
        { categoria: "ferida", titulo: "Corte da cirurgia", texto: "[Exemplo] Siga a orientação da equipe para limpar e secar o local." },
        { categoria: "banho", titulo: "Banho", texto: "[Exemplo] A equipe informará quando o banho está liberado." },
        { categoria: "alimentacao", titulo: "Alimentação", texto: "[Exemplo] Retome a alimentação conforme orientado na alta." },
        { categoria: "atividade", titulo: "Esforço físico", texto: "[Exemplo] Evite carregar peso pelo período indicado pela equipe." },
      ],
      sinais: [
        { nivel: "previsto", texto: "[Exemplo] Desconforto leve no local da cirurgia nos primeiros dias" },
        { nivel: "contato", texto: "[Exemplo] Dor que não melhora com o remédio indicado no plano" },
        { nivel: "urgencia", texto: "[Exemplo] Sinal definido pela equipe para procurar atendimento de urgência" },
      ],
      retornoSugeridoDias: 7,
      levarNoRetorno: ["Documento com foto", "Cartão do SUS"],
    },
  },
  {
    nome: "Orientações gerais de alta — modelo sintético",
    conteudo: {
      procedimento: "Internação clínica (exemplo)",
      cuidados: [
        { categoria: "atividade", titulo: "Repouso", texto: "[Exemplo] Retome as atividades aos poucos, conforme a orientação recebida." },
        { categoria: "alimentacao", titulo: "Hidratação", texto: "[Exemplo] Siga a orientação da equipe sobre líquidos." },
      ],
      sinais: [
        { nivel: "previsto", texto: "[Exemplo] Cansaço nos primeiros dias em casa" },
        { nivel: "contato", texto: "[Exemplo] Dúvida sobre como tomar algum remédio" },
        { nivel: "urgencia", texto: "[Exemplo] Piora importante, conforme os sinais combinados com a equipe" },
      ],
      retornoSugeridoDias: 14,
      levarNoRetorno: ["Documento com foto", "Lista dos remédios em uso"],
    },
  },
];
