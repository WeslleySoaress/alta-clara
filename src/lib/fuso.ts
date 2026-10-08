/** Converte data e hora locais de um fuso em instante UTC (funciona no servidor e no navegador). */
export function instanteNoFuso(data: string, hhmm: string, fuso: string): Date {
  const [y, mo, d] = data.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const palpite = Date.UTC(y, mo - 1, d, h, mi);
  const deslocamento = (instante: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(instante))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - instante;
  };
  const primeiro = palpite - deslocamento(palpite);
  return new Date(palpite - deslocamento(primeiro));
}

/** Data ("YYYY-MM-DD") e hora ("HH:MM") de um instante no fuso indicado. */
export function partesNoFuso(instante: Date, fuso: string): { data: string; horario: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, horario: `${p.hour}:${p.minute}` };
}
