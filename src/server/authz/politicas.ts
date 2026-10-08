// Matriz de permissões do Alta Clara. Funções puras: recebem o ator (montado
// no servidor a partir da sessão) e os fatos do recurso (lidos do banco).
// Nada aqui confia em ids, papéis ou instituição enviados pelo cliente.
// Regra geral: negação por padrão — toda função começa em `false`.

export type Papel = "enfermagem" | "revisor" | "admin" | "auditor";

export type Ator = {
  userId: string;
  /** Verdadeiro se a conta exige segundo fator (TOTP) no login. */
  mfaAtivo: boolean;
  vinculos: { instituicaoId: string; papel: Papel }[];
  /** Pacientes cuja conta é deste usuário. */
  pacientesProprios: string[];
  /** Pacientes que autorizaram este usuário como cuidador (ativos). */
  cuidadorDe: { pacienteId: string; escopo: string[] }[];
};

export type FatosPlano = {
  instituicaoId: string;
  pacienteId: string;
  atendimentoId: string;
  status: "rascunho" | "em_revisao" | "publicado" | "substituido" | "encerrado";
  autorId: string;
  /** Todos que editaram a versão. */
  editores?: string[];
  /** Profissionais com vínculo assistencial neste atendimento. */
  equipe: string[];
};

export const ESCOPOS_CUIDADOR = ["ver_plano", "registrar_dose"] as const;
export type EscopoCuidador = (typeof ESCOPOS_CUIDADOR)[number];

export function temPapel(ator: Ator, instituicaoId: string, ...papeis: Papel[]): boolean {
  return ator.vinculos.some((v) => v.instituicaoId === instituicaoId && papeis.includes(v.papel));
}

export function ehProfissional(ator: Ator): boolean {
  return ator.vinculos.length > 0;
}

/** Profissionais só operam com MFA ativo. */
function profissionalApto(ator: Ator, instituicaoId: string, ...papeis: Papel[]): boolean {
  return ator.mfaAtivo && temPapel(ator, instituicaoId, ...papeis);
}

const VISIVEL_AO_PACIENTE = new Set<FatosPlano["status"]>(["publicado", "substituido", "encerrado"]);

export function podeVerPlano(ator: Ator, p: FatosPlano): boolean {
  if (VISIVEL_AO_PACIENTE.has(p.status)) {
    if (ator.pacientesProprios.includes(p.pacienteId)) return true;
    if (ator.cuidadorDe.some((c) => c.pacienteId === p.pacienteId && c.escopo.includes("ver_plano"))) return true;
  }
  // Enfermagem: somente atendimentos em que tem vínculo assistencial.
  if (profissionalApto(ator, p.instituicaoId, "enfermagem") && p.equipe.includes(ator.userId)) return true;
  // Revisor clínico: atendimentos da própria instituição.
  if (profissionalApto(ator, p.instituicaoId, "revisor")) return true;
  // Admin e auditor não têm acesso clínico por padrão.
  return false;
}

export function podeCriarOuEditarRascunho(ator: Ator, p: Omit<FatosPlano, "status" | "autorId">): boolean {
  return profissionalApto(ator, p.instituicaoId, "enfermagem", "revisor") && (
    temPapel(ator, p.instituicaoId, "revisor") || p.equipe.includes(ator.userId)
  );
}

export function podeEditarPlano(ator: Ator, p: FatosPlano): boolean {
  return p.status === "rascunho" && podeCriarOuEditarRascunho(ator, p);
}

export function podeEnviarParaRevisao(ator: Ator, p: FatosPlano): boolean {
  return p.status === "rascunho" && podeCriarOuEditarRascunho(ator, p);
}

/** Separação de funções: ninguém que escreveu ou editou a versão a aprova. */
export function podeAprovarEPublicar(ator: Ator, p: FatosPlano): boolean {
  return (
    p.status === "em_revisao" &&
    profissionalApto(ator, p.instituicaoId, "revisor") &&
    p.autorId !== ator.userId &&
    !(p.editores ?? []).includes(ator.userId)
  );
}

export function podeDevolverParaRascunho(ator: Ator, p: FatosPlano): boolean {
  return p.status === "em_revisao" && profissionalApto(ator, p.instituicaoId, "revisor");
}

export function podeConvidarPaciente(ator: Ator, p: Pick<FatosPlano, "instituicaoId" | "equipe">): boolean {
  return profissionalApto(ator, p.instituicaoId, "enfermagem", "revisor") && (
    temPapel(ator, p.instituicaoId, "revisor") || p.equipe.includes(ator.userId)
  );
}

export function podeRegistrarDose(ator: Ator, pacienteId: string): boolean {
  if (ator.pacientesProprios.includes(pacienteId)) return true;
  return ator.cuidadorDe.some((c) => c.pacienteId === pacienteId && c.escopo.includes("registrar_dose"));
}

/** Só o próprio paciente concede ou revoga acesso de cuidadores. */
export function podeGerenciarCuidadores(ator: Ator, pacienteId: string): boolean {
  return ator.pacientesProprios.includes(pacienteId);
}

export function podeConsultarAuditoria(ator: Ator, instituicaoId: string): boolean {
  return profissionalApto(ator, instituicaoId, "auditor", "admin");
}

export class AcessoNegado extends Error {
  constructor(public readonly acao: string) {
    super("Acesso negado.");
  }
}
