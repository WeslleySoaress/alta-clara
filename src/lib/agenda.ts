import type { MedicamentoPlano } from "@/server/dominio/conteudo";
import { adicionarDias, diasEntre, minutosDoDia } from "./datas";

/** O mínimo do plano de que a agenda precisa. */
export type PlanoAgenda = { inicio: string; medicamentos: MedicamentoPlano[] };

export type Periodo = "manha" | "almoco" | "tarde" | "noite";

export const ROTULO_PERIODO: Record<Periodo, string> = {
  manha: "Manhã",
  almoco: "Almoço",
  tarde: "Tarde",
  noite: "Noite",
};

/** Ícone auxiliar do período. O horário exato continua sendo a informação principal. */
export function periodoDoHorario(hhmm: string): Periodo {
  const min = minutosDoDia(hhmm);
  if (min >= 5 * 60 && min < 11 * 60) return "manha";
  if (min >= 11 * 60 && min < 14 * 60) return "almoco";
  if (min >= 14 * 60 && min < 18 * 60) return "tarde";
  return "noite";
}

export interface Dose {
  /** Identificador estável: data|item|horário. */
  chave: string;
  data: string;
  horario: string;
  periodo: Periodo;
  medicamento: MedicamentoPlano;
}

export const chaveDose = (data: string, itemId: string, horario: string) => `${data}|${itemId}|${horario}`;

/** Dia do tratamento, começando em 1. */
export function diaDoTratamento(plano: PlanoAgenda, data: string): number {
  return diasEntre(plano.inicio, data) + 1;
}

export function duracaoTotal(plano: PlanoAgenda): number | null {
  if (plano.medicamentos.length === 0) return null;
  const duracoes = plano.medicamentos.map((m) => m.duracaoDias);
  if (duracoes.some((d) => d === null)) return null;
  return Math.max(...(duracoes as number[]));
}

export function medicamentoAtivoEm(med: MedicamentoPlano, plano: PlanoAgenda, data: string): boolean {
  const indice = diasEntre(plano.inicio, data);
  if (indice < 0) return false;
  return med.duracaoDias === null || indice < med.duracaoDias;
}

/** Último dia (inclusive) do medicamento, ou null para uso contínuo. */
export function ultimoDia(med: MedicamentoPlano, plano: PlanoAgenda): string | null {
  return med.duracaoDias === null ? null : adicionarDias(plano.inicio, med.duracaoDias - 1);
}

/** Doses com horário planejado em um dia. Itens "se necessário" não entram. */
export function dosesDoDia(plano: PlanoAgenda, data: string): Dose[] {
  return plano.medicamentos
    .filter((m) => m.horarios.length > 0 && medicamentoAtivoEm(m, plano, data))
    .flatMap((m) =>
      m.horarios.map((horario) => ({
        chave: chaveDose(data, m.id, horario),
        data,
        horario,
        periodo: periodoDoHorario(horario),
        medicamento: m,
      })),
    )
    .sort((a, b) => minutosDoDia(a.horario) - minutosDoDia(b.horario));
}

/** Tolerância para uma dose ainda aparecer como "agora" depois do horário. */
const TOLERANCIA_MIN = 60;

/**
 * Próxima dose planejada: a primeira sem registro cujo horário não passou há
 * mais de uma hora. Procura até 2 dias à frente.
 */
export function proximaDose(
  plano: PlanoAgenda,
  hoje: string,
  minutosAgora: number,
  registradas: ReadonlySet<string>,
): Dose | null {
  for (let i = 0; i <= 2; i++) {
    const data = adicionarDias(hoje, i);
    const candidata = dosesDoDia(plano, data).find(
      (d) => !registradas.has(d.chave) && (i > 0 || minutosDoDia(d.horario) >= minutosAgora - TOLERANCIA_MIN),
    );
    if (candidata) return candidata;
  }
  return null;
}

/** Minutos de agora até a dose (negativo se o horário já passou). */
export function minutosAte(dose: Dose, hoje: string, minutosAgora: number): number {
  return diasEntre(hoje, dose.data) * 1440 + minutosDoDia(dose.horario) - minutosAgora;
}

/** Data e minutos atuais no fuso do plano, independentemente do fuso do aparelho. */
export function agoraNoFuso(agora: Date, fuso: string): { hoje: string; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const p = (t: string) => partes.find((x) => x.type === t)!.value;
  return { hoje: `${p("year")}-${p("month")}-${p("day")}`, minutos: Number(p("hour")) * 60 + Number(p("minute")) };
}
