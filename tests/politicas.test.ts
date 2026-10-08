import { describe, expect, it } from "vitest";
import {
  podeAprovarEPublicar,
  podeConsultarAuditoria,
  podeEditarPlano,
  podeRegistrarDose,
  podeVerPlano,
  type Ator,
  type FatosPlano,
} from "@/server/authz/politicas";

// Matriz de permissões (funções puras): negação por padrão.

const base: Ator = { userId: "u", mfaAtivo: true, vinculos: [], pacientesProprios: [], cuidadorDe: [] };
const plano = (p: Partial<FatosPlano> = {}): FatosPlano => ({
  instituicaoId: "I1",
  pacienteId: "P1",
  atendimentoId: "AT1",
  status: "publicado",
  autorId: "autor",
  equipe: ["enf"],
  ...p,
});

describe("matriz de permissões", () => {
  it("ator sem vínculos nem pacientes não vê nada", () => {
    expect(podeVerPlano(base, plano())).toBe(false);
  });

  it("paciente vê só o próprio plano e só depois de publicado", () => {
    const pac = { ...base, pacientesProprios: ["P1"] };
    expect(podeVerPlano(pac, plano())).toBe(true);
    expect(podeVerPlano(pac, plano({ pacienteId: "P2" }))).toBe(false);
    expect(podeVerPlano(pac, plano({ status: "rascunho" }))).toBe(false);
    expect(podeVerPlano(pac, plano({ status: "em_revisao" }))).toBe(false);
  });

  it("cuidador depende do escopo concedido", () => {
    const so_ver = { ...base, cuidadorDe: [{ pacienteId: "P1", escopo: ["ver_plano"] }] };
    expect(podeVerPlano(so_ver, plano())).toBe(true);
    expect(podeRegistrarDose(so_ver, "P1")).toBe(false);
    const nada = { ...base, cuidadorDe: [{ pacienteId: "P1", escopo: [] }] };
    expect(podeVerPlano(nada, plano())).toBe(false);
  });

  it("enfermagem precisa de vínculo assistencial no atendimento", () => {
    const enf = { ...base, userId: "enf", vinculos: [{ instituicaoId: "I1", papel: "enfermagem" as const }] };
    expect(podeVerPlano(enf, plano())).toBe(true);
    expect(podeVerPlano(enf, plano({ equipe: ["outra"] }))).toBe(false);
    expect(podeVerPlano(enf, plano({ instituicaoId: "I2" }))).toBe(false);
  });

  it("profissional sem MFA não opera", () => {
    const enf = { ...base, userId: "enf", mfaAtivo: false, vinculos: [{ instituicaoId: "I1", papel: "enfermagem" as const }] };
    expect(podeVerPlano(enf, plano())).toBe(false);
    expect(podeEditarPlano(enf, plano({ status: "rascunho" }))).toBe(false);
  });

  it("admin e auditor não têm acesso clínico por padrão", () => {
    for (const papel of ["admin", "auditor"] as const) {
      const a = { ...base, vinculos: [{ instituicaoId: "I1", papel }] };
      expect(podeVerPlano(a, plano())).toBe(false);
      expect(podeEditarPlano(a, plano({ status: "rascunho" }))).toBe(false);
    }
    expect(podeConsultarAuditoria({ ...base, vinculos: [{ instituicaoId: "I1", papel: "auditor" }] }, "I1")).toBe(true);
    expect(podeConsultarAuditoria({ ...base, vinculos: [{ instituicaoId: "I1", papel: "auditor" }] }, "I2")).toBe(false);
  });

  it("separação de funções: autor não aprova a própria versão", () => {
    const rev = { ...base, userId: "rev", vinculos: [{ instituicaoId: "I1", papel: "revisor" as const }] };
    expect(podeAprovarEPublicar(rev, plano({ status: "em_revisao" }))).toBe(true);
    expect(podeAprovarEPublicar(rev, plano({ status: "em_revisao", autorId: "rev" }))).toBe(false);
    expect(podeAprovarEPublicar(rev, plano({ status: "rascunho" }))).toBe(false);
    expect(podeAprovarEPublicar(rev, plano({ status: "em_revisao", instituicaoId: "I2" }))).toBe(false);
  });

  it("plano publicado não é editável", () => {
    const enf = { ...base, userId: "enf", vinculos: [{ instituicaoId: "I1", papel: "enfermagem" as const }] };
    expect(podeEditarPlano(enf, plano({ status: "publicado" }))).toBe(false);
    expect(podeEditarPlano(enf, plano({ status: "rascunho" }))).toBe(true);
  });
});
