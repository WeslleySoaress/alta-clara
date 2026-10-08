import type { PlanoVisivel } from "@/components/plano/tipos";
import { adicionarDias, hojeEmBrasilia } from "./datas";

/**
 * Plano da demonstração pública. TOTALMENTE SINTÉTICO: medicamentos,
 * pessoas, instituição e orientações são fictícios e não servem como
 * orientação clínica. As datas são relativas a hoje para não expirar.
 * Esta rota não tem caminho para dados reais.
 */
export function planoDemonstracao(): PlanoVisivel {
  const inicio = adicionarDias(hojeEmBrasilia(), -1);
  return {
    id: "demonstracao",
    versao: 2,
    publicadoEm: `${inicio}T15:40:00-03:00`,
    autorNome: "Enf. Ana Teste (fictícia)",
    revisorNome: "Dr. Bruno Teste (fictício)",
    instituicao: "Hospital Exemplo Norte (fictício)",
    procedimento: "Cirurgia abdominal (exemplo)",
    registros: [],
    podeRegistrar: true,
    conteudo: {
      inicio,
      fusoHorario: "America/Sao_Paulo",
      equipeResponsavel: "Clínica Cirúrgica — 3º andar (fictícia)",
      contato: {
        unidade: "Clínica Cirúrgica (fictícia)",
        telefone: "(11) 0000-0001",
        horarioAtendimento: "todos os dias, das 7h às 19h (simulação)",
      },
      medicamentos: [
        {
          id: "demo-a",
          nome: "Medicamento demonstrativo A",
          finalidade: "Exemplo de medicamento com horários fixos.",
          apresentacao: "capsula",
          dose: "1 cápsula (exemplo)",
          via: "pela boca, com água",
          horarios: ["06:00", "14:00", "22:00"],
          duracaoDias: 7,
          seNecessario: null,
          observacao: "[Exemplo] Siga até o fim do período indicado pela equipe.",
        },
        {
          id: "demo-b",
          nome: "Medicamento demonstrativo B",
          finalidade: "Exemplo de medicamento uma vez ao dia.",
          apresentacao: "comprimido",
          dose: "1 comprimido (exemplo)",
          via: "pela boca",
          horarios: ["08:00"],
          duracaoDias: 10,
          seNecessario: null,
          observacao: null,
        },
        {
          id: "demo-c",
          nome: "Medicamento demonstrativo C",
          finalidade: "Exemplo de uso somente se necessário.",
          apresentacao: "comprimido",
          dose: "1 comprimido (exemplo)",
          via: "pela boca",
          horarios: [],
          duracaoDias: 5,
          seNecessario: { quando: "[Exemplo] se tiver dor", intervaloMinimoHoras: 6, maximoPorDia: 4 },
          observacao: null,
        },
      ],
      cuidados: [
        { categoria: "ferida", titulo: "Corte da cirurgia", texto: "[Exemplo] Siga a orientação da equipe para limpar e secar o local." },
        { categoria: "banho", titulo: "Banho", texto: "[Exemplo] A equipe informará quando o banho está liberado." },
        { categoria: "atividade", titulo: "Esforço físico", texto: "[Exemplo] Evite carregar peso pelo período indicado pela equipe." },
      ],
      sinais: [
        { nivel: "urgencia", texto: "[Exemplo] Sinal definido pela equipe para procurar atendimento de urgência" },
        { nivel: "contato", texto: "[Exemplo] Dor que não melhora com o medicamento indicado no plano" },
        { nivel: "contato", texto: "[Exemplo] Dúvida sobre como tomar algum medicamento" },
        { nivel: "previsto", texto: "[Exemplo] Desconforto leve no local da cirurgia nos primeiros dias" },
      ],
      retornos: [
        {
          local: "Ambulatório de Cirurgia, Hospital Exemplo Norte (fictício)",
          dataHora: `${adicionarDias(inicio, 7)}T09:00`,
          levar: ["Documento com foto", "Cartão do SUS"],
        },
      ],
    },
  };
}
