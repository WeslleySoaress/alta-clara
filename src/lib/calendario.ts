import type { ConteudoPlano } from "@/server/dominio/conteudo";

// Arquivo .ics com os horários planejados e os retornos, gerado no aparelho.
// É uma alternativa explícita do paciente; não substitui os lembretes do
// servidor nem garante entrega. Os títulos são discretos (sem nome de
// medicamento), porque podem aparecer na tela bloqueada.

const MAXIMO_DIAS_USO_CONTINUO = 90;

function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const dataHoraIcs = (data: string, hhmm: string) => `${data.replaceAll("-", "")}T${hhmm.replace(":", "")}00`;

export function gerarIcs(conteudo: ConteudoPlano, idPlano: string, agora = new Date()): string {
  const stamp = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const tz = conteudo.fusoHorario;
  const eventos: string[] = [];

  conteudo.medicamentos.forEach((med, i) => {
    const dias = med.duracaoDias ?? MAXIMO_DIAS_USO_CONTINUO;
    for (const horario of med.horarios) {
      eventos.push(
        [
          "BEGIN:VEVENT",
          `UID:${idPlano}-${med.id}-${horario.replace(":", "")}@alta-clara`,
          `DTSTAMP:${stamp}`,
          `DTSTART;TZID=${tz}:${dataHoraIcs(conteudo.inicio, horario)}`,
          "DURATION:PT10M",
          `RRULE:FREQ=DAILY;COUNT=${dias}`,
          `SUMMARY:${escapar(`Alta Clara: lembrete ${i + 1}`)}`,
          `DESCRIPTION:${escapar("Abra o Alta Clara para ver o que fazer neste horário.")}`,
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapar("Lembrete do Alta Clara")}`,
          "TRIGGER:PT0M",
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n"),
      );
    }
  });

  conteudo.retornos.forEach((r, i) => {
    if (!r.dataHora) return;
    const [data, hora] = r.dataHora.split("T");
    eventos.push(
      [
        "BEGIN:VEVENT",
        `UID:${idPlano}-retorno-${i}@alta-clara`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${dataHoraIcs(data, hora)}`,
        "DURATION:PT1H",
        `SUMMARY:${escapar("Consulta de retorno")}`,
        `LOCATION:${escapar(r.local)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapar("Amanhã: consulta de retorno")}`,
        "TRIGGER:-P1D",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n"),
    );
  });

  const vtimezone = [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Alta Clara//PT-BR", "CALSCALE:GREGORIAN", vtimezone, ...eventos, "END:VCALENDAR", ""].join("\r\n");
}
