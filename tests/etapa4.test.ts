import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { problemaNaSenha, senhaVazada } from "@/server/auth/senha";

describe("senhas fáceis de adivinhar (mesmo longas)", () => {
  it.each([
    "aaaaaaaaaaaaaaaaaaaa",
    "abcabcabcabcabcabc",
    "senhasenhasenha",
    "123456789012345",
    "qwertyuiopasdfgh",
    "minha senha forte 2026",
    "P@ssw0rdP@ssw0rd!",
    "altaclara12345678",
    "Senha Segura 123456",
    "zyxwvutsrqponmlk",
    "flamengo1234567890",
    "abababababababab",
  ])("recusa %s", (senha) => {
    expect(problemaNaSenha(senha)).toMatch(/fácil de adivinhar/);
  });

  it.each([
    "outra frase longa para a cuidadora",
    "janela azul come pipoca",
    "girafa lendo jornal na praia",
    "kT9#vQ2!mZp4@wL8",
    "Bv3Xq_7Yt2Mn9Kp5Wr8z",
  ])("aceita %s", (senha) => {
    expect(problemaNaSenha(senha)).toBeNull();
  });

  it("recusa a parte local do e-mail, mesmo com acento ou maiúsculas", () => {
    expect(problemaNaSenha("Mariana.Souza no parque azul", "mariana.souza@exemplo.test")).toMatch(/e-mail/);
  });

  it("comprimento: mínimo 15, máximo 128", () => {
    expect(problemaNaSenha("curta demais")).toMatch(/15/);
    expect(problemaNaSenha("x".repeat(129))).toMatch(/128/);
  });
});

describe("consulta de senhas vazadas (k-anonimato)", () => {
  const original = process.env.ALTA_SENHAS_VAZADAS;
  afterEach(() => {
    process.env.ALTA_SENHAS_VAZADAS = original;
  });

  const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

  it("desligada por padrão: não faz nenhuma chamada", async () => {
    delete process.env.ALTA_SENHAS_VAZADAS;
    let chamou = false;
    const buscar = (async () => ((chamou = true), new Response(""))) as typeof fetch;
    expect(await senhaVazada("janela azul come pipoca", buscar)).toBe(false);
    expect(chamou).toBe(false);
  });

  it("envia só o prefixo de 5 caracteres e reconhece o sufixo na resposta", async () => {
    process.env.ALTA_SENHAS_VAZADAS = "hibp";
    const senha = "janela azul come pipoca";
    const h = sha1(senha);
    let url = "";
    const buscar = (async (u: string) => {
      url = u;
      return new Response(`0000000000000000000000000000000000A:0\r\n${h.slice(5)}:42\r\n`);
    }) as unknown as typeof fetch;
    expect(await senhaVazada(senha, buscar)).toBe(true);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
    expect(url).not.toContain(h.slice(5));
  });

  it("linha de preenchimento (contagem 0) não conta como vazamento", async () => {
    process.env.ALTA_SENHAS_VAZADAS = "hibp";
    const senha = "girafa lendo jornal na praia";
    const buscar = (async () => new Response(`${sha1(senha).slice(5)}:0\n`)) as unknown as typeof fetch;
    expect(await senhaVazada(senha, buscar)).toBe(false);
  });

  it("serviço fora do ar não bloqueia o cadastro", async () => {
    process.env.ALTA_SENHAS_VAZADAS = "hibp";
    const buscar = (async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await senhaVazada("girafa lendo jornal na praia", buscar)).toBe(false);
  });
});
