import type { ConteudoPlano, MedicamentoPlano } from "../dominio/conteudo";

// Adaptador HL7 FHIR R4 (4.0.1) — EXPORTAÇÃO DE EXEMPLO, não conectada.
// Escolhemos R4 porque o SMART App Launch v2.2 se baseia nele (docs/pesquisa.md).
// Não há conexão com prontuário, nem gravação automática. Perfis nacionais
// (ex.: RNDS/BR Core) não foram aplicados; antes de integrar, é preciso
// escolher a versão e os perfis do sistema de destino.

export const FHIR_VERSAO = "4.0.1";
const SISTEMA_PRONTUARIO = "urn:alta-clara:prontuario-sintetico";
const TAG_SANDBOX = { system: "urn:alta-clara:ambiente", code: "sandbox", display: "Sandbox — dados sintéticos" };

export type DadosExportacao = {
  planoId: string;
  versao: number;
  publicadoEm: Date | null;
  paciente: { id: string; nome: string; nascimento: string; prontuario: string };
  atendimento: { id: string; procedimento: string; admissaoEm: string };
  instituicao: string;
  conteudo: ConteudoPlano;
};

type Recurso = { resourceType: string; id: string; [k: string]: unknown };

function medicationRequest(m: MedicamentoPlano, d: DadosExportacao): Recurso {
  const timing = m.seNecessario
    ? undefined
    : {
        repeat: {
          frequency: m.horarios.length,
          period: 1,
          periodUnit: "d",
          timeOfDay: m.horarios.map((h) => `${h}:00`),
          ...(m.duracaoDias ? { boundsDuration: { value: m.duracaoDias, unit: "d", system: "http://unitsofmeasure.org", code: "d" } } : {}),
        },
      };
  return {
    resourceType: "MedicationRequest",
    id: `${d.planoId.slice(0, 8)}-${m.id}`,
    meta: { tag: [TAG_SANDBOX] },
    status: "active",
    // "plan": transcrição da prescrição para o plano de alta; não é uma nova prescrição.
    intent: "plan",
    medicationCodeableConcept: { text: m.nome },
    subject: { reference: `Patient/${d.paciente.id}` },
    encounter: { reference: `Encounter/${d.atendimento.id}` },
    authoredOn: d.publicadoEm?.toISOString(),
    note: [{ text: "Transcrito da prescrição revisada para o plano de alta (Alta Clara, dados sintéticos)." }],
    dosageInstruction: [
      {
        text: `${m.dose}, ${m.via}${m.seNecessario ? `, se necessário: ${m.seNecessario.quando}` : `, às ${m.horarios.join(", ")}`}`,
        patientInstruction: [m.finalidade, m.observacao].filter(Boolean).join(" "),
        route: { text: m.via },
        ...(timing ? { timing } : {}),
        ...(m.seNecessario
          ? {
              asNeededCodeableConcept: { text: m.seNecessario.quando },
              maxDosePerPeriod: { numerator: { value: m.seNecessario.maximoPorDia }, denominator: { value: 1, unit: "d", system: "http://unitsofmeasure.org", code: "d" } },
            }
          : {}),
      },
    ],
  };
}

/** Monta um Bundle FHIR R4 do tipo "collection" com o plano publicado. */
export function planoParaFhir(d: DadosExportacao) {
  const [nome, ...sobrenomes] = d.paciente.nome.split(" ");
  const patient: Recurso = {
    resourceType: "Patient",
    id: d.paciente.id,
    meta: { tag: [TAG_SANDBOX] },
    identifier: [{ system: SISTEMA_PRONTUARIO, value: d.paciente.prontuario }],
    name: [{ given: [nome], family: sobrenomes.join(" ") }],
    birthDate: d.paciente.nascimento,
  };
  const encounter: Recurso = {
    resourceType: "Encounter",
    id: d.atendimento.id,
    meta: { tag: [TAG_SANDBOX] },
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "inpatient encounter" },
    subject: { reference: `Patient/${d.paciente.id}` },
    period: { start: d.atendimento.admissaoEm },
    reasonCode: [{ text: d.atendimento.procedimento }],
    serviceProvider: { display: d.instituicao },
  };
  const meds = d.conteudo.medicamentos.map((m) => medicationRequest(m, d));
  const carePlan: Recurso = {
    resourceType: "CarePlan",
    id: d.planoId,
    meta: { tag: [TAG_SANDBOX], versionId: String(d.versao) },
    status: "active",
    intent: "plan",
    title: "Plano de alta (Alta Clara)",
    subject: { reference: `Patient/${d.paciente.id}` },
    encounter: { reference: `Encounter/${d.atendimento.id}` },
    period: { start: d.conteudo.inicio },
    created: d.publicadoEm?.toISOString(),
    careTeam: [{ display: d.conteudo.equipeResponsavel }],
    activity: [
      ...meds.map((m) => ({ reference: { reference: `MedicationRequest/${m.id}` } })),
      ...d.conteudo.cuidados.map((c) => ({ detail: { status: "not-started", description: `${c.titulo}: ${c.texto}` } })),
      ...d.conteudo.retornos.map((r) => ({
        detail: {
          kind: "Appointment",
          status: r.dataHora ? "scheduled" : "not-started",
          description: `Retorno em ${r.local}${r.dataHora ? "" : " (a agendar)"}`,
          ...(r.dataHora ? { scheduledString: r.dataHora } : {}),
        },
      })),
    ],
    note: [
      ...d.conteudo.sinais.map((s) => ({ text: `[${s.nivel}] ${s.texto}` })),
      { text: `Contato: ${d.conteudo.contato.unidade}, ${d.conteudo.contato.telefone} (${d.conteudo.contato.horarioAtendimento}).` },
    ],
  };
  const recursos = [patient, encounter, carePlan, ...meds];
  return {
    resourceType: "Bundle",
    type: "collection",
    meta: { tag: [TAG_SANDBOX] },
    timestamp: new Date().toISOString(),
    entry: recursos.map((r) => ({ fullUrl: `urn:alta-clara:${r.resourceType}/${r.id}`, resource: r })),
  };
}
