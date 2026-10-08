import { instanteNoFuso, partesNoFuso } from "./fuso";

// Regra de uso "se necessário": aplica SOMENTE os limites escritos no plano
// aprovado (intervalo mínimo e máximo por dia). Não recomenda nada além disso.
// Função pura, usada pelo navegador (para orientar) e pelo servidor (que decide).

export type UsoRegistrado = { data: string; horario: string };

export type AvaliacaoUso =
  | { permitido: true; usadosHoje: number; ultimo: Date | null }
  | { permitido: false; motivo: "intervalo"; proximo: Date; usadosHoje: number; ultimo: Date }
  | { permitido: false; motivo: "maximo_dia"; usadosHoje: number; ultimo: Date | null };

export function avaliarUsoSeNecessario(e: {
  usos: UsoRegistrado[];
  intervaloMinimoHoras: number;
  maximoPorDia: number;
  agora: Date;
  fuso: string;
}): AvaliacaoUso {
  const hoje = partesNoFuso(e.agora, e.fuso).data;
  const instantes = e.usos.map((u) => instanteNoFuso(u.data, u.horario, e.fuso)).filter((d) => d <= e.agora);
  const ultimo = instantes.length ? new Date(Math.max(...instantes.map((d) => d.getTime()))) : null;
  const usadosHoje = e.usos.filter((u) => u.data === hoje).length;

  if (usadosHoje >= e.maximoPorDia) return { permitido: false, motivo: "maximo_dia", usadosHoje, ultimo };
  if (ultimo) {
    const proximo = new Date(ultimo.getTime() + e.intervaloMinimoHoras * 3_600_000);
    if (proximo > e.agora) return { permitido: false, motivo: "intervalo", proximo, usadosHoje, ultimo };
  }
  return { permitido: true, usadosHoje, ultimo };
}
