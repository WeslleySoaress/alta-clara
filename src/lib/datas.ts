// Datas de calendário ("YYYY-MM-DD") são tratadas como UTC para que somar dias
// nunca dependa do fuso horário de quem executa o código.

export function adicionarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Data local de um instante, "YYYY-MM-DD". */
export function dataLocal(agora: Date): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Hoje no fuso de Brasília, para uso no servidor. */
export function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function formatarDataLonga(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${data}T00:00:00Z`));
}

export function minutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatarHora(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// Formatação de instantes SEMPRE no fuso de Brasília: o mesmo texto no servidor
// (que pode estar em UTC) e no navegador — sem hora errada nem erro de hidratação.
const FUSO_PADRAO = "America/Sao_Paulo";

export function formatarDataHora(instante: Date | string, segundos = false): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: segundos ? "medium" : "short", timeZone: FUSO_PADRAO }).format(new Date(instante));
}

export function formatarDataCurta(instante: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO_PADRAO }).format(new Date(instante));
}
