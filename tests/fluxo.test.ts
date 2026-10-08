import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { ListaCuidados } from "@/components/plano/Medicamentos";
import { agoraNoFuso } from "@/lib/agenda";
import { auth } from "@/server/auth/auth";
import { AcessoNegado } from "@/server/authz/politicas";
import { db } from "@/server/db/cliente";
import * as s from "@/server/db/schema";
import {
  consumirConvite,
  criarConvitePaciente,
  iniciarAtivacao,
  previsualizarConvite,
  verificarCodigo,
} from "@/server/dominio/convites";
import { lerPlanoDoPaciente, listarPlanosVigentes, registrarDose } from "@/server/dominio/paciente";
import {
  abrirNovaVersao,
  aprovarEPublicar,
  ConflitoDeVersao,
  criarRascunho,
  enviarParaRevisao,
  EstadoInvalido,
  lerAtendimento,
  lerPlanoParaEquipe,
  salvarRascunho,
} from "@/server/dominio/planos";
import { ator, conteudoValido, montarCenario, poolOwner, SENHA } from "./cenario";

let ids: Record<string, string>;
beforeEach(async () => {
  ids = await montarCenario();
});

/** Rascunho → revisão → publicação, como no fluxo real. */
async function publicarPlano(atendimento = "atA1", sigla = "A", conteudo = conteudoValido()) {
  const enf = await ator(ids[`enfermagem${sigla}`]);
  const planoId = await criarRascunho(enf, ids[atendimento], ids[`modelo${sigla}`]);
  const rev1 = await salvarRascunho(enf, planoId, 0, conteudo);
  await enviarParaRevisao(enf, planoId, rev1);
  const revisor = await ator(ids[`revisor${sigla}`]);
  const [pac] = await db.select().from(s.plano).where(eq(s.plano.id, planoId));
  const prontuario = atendimento.endsWith("1") ? `${sigla}-001` : `${sigla}-002`;
  await aprovarEPublicar(revisor, planoId, pac.revisao, prontuario);
  return planoId;
}

describe("1. fluxo completo de alta", () => {
  it("enfermagem cria e envia; revisor publica; o paciente correto acessa", async () => {
    const planoId = await publicarPlano();
    const [p] = await db.select().from(s.plano).where(eq(s.plano.id, planoId));
    expect(p.status).toBe("publicado");
    expect(p.revisorId).toBe(ids.revisorA);
    expect(p.autorId).toBe(ids.enfermagemA);

    const visto = await lerPlanoDoPaciente(await ator(ids.userPacA1), planoId);
    expect(visto?.conteudo.medicamentos[0].nome).toBe("Medicamento demonstrativo A");
    expect(await listarPlanosVigentes(await ator(ids.userPacA1))).toHaveLength(1);
  });

  it("o autor não consegue aprovar a própria versão", async () => {
    const enf = await ator(ids.enfermagemA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    const r = await salvarRascunho(enf, planoId, 0, conteudoValido());
    await enviarParaRevisao(enf, planoId, r);
    await expect(aprovarEPublicar(enf, planoId, r + 1, "A-001")).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("publicação exige o prontuário correto (paciente errado)", async () => {
    const enf = await ator(ids.enfermagemA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    const r = await salvarRascunho(enf, planoId, 0, conteudoValido());
    await enviarParaRevisao(enf, planoId, r);
    await expect(aprovarEPublicar(await ator(ids.revisorA), planoId, r + 1, "A-002")).rejects.toBeInstanceOf(EstadoInvalido);
  });

  it("não envia para revisão sem orientação de urgência", async () => {
    const enf = await ator(ids.enfermagemA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    const sem = { ...conteudoValido(), sinais: [{ nivel: "contato" as const, texto: "x" }] };
    const r = await salvarRascunho(enf, planoId, 0, sem);
    await expect(enviarParaRevisao(enf, planoId, r)).rejects.toBeInstanceOf(EstadoInvalido);
  });

  it("edição concorrente com revisão desatualizada é rejeitada", async () => {
    const enf = await ator(ids.enfermagemA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    await salvarRascunho(enf, planoId, 0, conteudoValido());
    await expect(salvarRascunho(enf, planoId, 0, conteudoValido())).rejects.toBeInstanceOf(ConflitoDeVersao);
  });

  it("rascunho não aparece para o paciente", async () => {
    const enf = await ator(ids.enfermagemA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    expect(await lerPlanoDoPaciente(await ator(ids.userPacA1), planoId)).toBeNull();
  });
});

describe("2. paciente A não acessa dados de B", () => {
  it("não lê, não lista e não registra no plano de outro paciente", async () => {
    const planoA2 = await publicarPlano("atA2");
    const pacA1 = await ator(ids.userPacA1);
    expect(await lerPlanoDoPaciente(pacA1, planoA2)).toBeNull();
    expect(await listarPlanosVigentes(pacA1)).toHaveLength(0);
    await expect(
      registrarDose(pacA1, { planoId: planoA2, itemId: "med-a", data: "2026-10-03", horario: "08:00", situacao: "relatou_tomada" }),
    ).rejects.toBeInstanceOf(AcessoNegado);
    expect(await lerPlanoParaEquipe(pacA1, planoA2)).toBeNull();
  });

  it("tentativa negada fica na auditoria", async () => {
    const planoA2 = await publicarPlano("atA2");
    await lerPlanoDoPaciente(await ator(ids.userPacA1), planoA2);
    const negados = await db
      .select()
      .from(s.auditoria)
      .where(and(eq(s.auditoria.atorUserId, ids.userPacA1), eq(s.auditoria.resultado, "negado")));
    expect(negados.length).toBeGreaterThan(0);
  });
});

describe("3. instituição A não acessa dados de B", () => {
  it("revisor de A não lê nem publica plano de B; enfermagem de A não cria em B", async () => {
    const planoB = await publicarPlano("atB1", "B");
    const revA = await ator(ids.revisorA);
    expect(await lerPlanoParaEquipe(revA, planoB)).toBeNull();
    expect(await lerAtendimento(revA, ids.atB1)).toBeNull();
    await expect(criarRascunho(await ator(ids.enfermagemA), ids.atB2, ids.modeloB)).rejects.toBeInstanceOf(AcessoNegado);
    await expect(abrirNovaVersao(revA, ids.atB1, "teste")).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("modelo de outra instituição não pode ser usado", async () => {
    await expect(criarRascunho(await ator(ids.enfermagemA), ids.atA1, ids.modeloB)).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("admin e auditor não leem conteúdo clínico", async () => {
    const planoA = await publicarPlano();
    expect(await lerPlanoParaEquipe(await ator(ids.adminA), planoA)).toBeNull();
    expect(await lerPlanoParaEquipe(await ator(ids.auditorA), planoA)).toBeNull();
  });
});

describe("4. cuidador revogado perde acesso", () => {
  it("revogação tem efeito imediato na próxima requisição", async () => {
    const planoA1 = await publicarPlano();
    const [aut] = await db
      .insert(s.autorizacaoCuidador)
      .values({ pacienteId: ids.pacA1, cuidadorUserId: ids.cuidador, escopo: ["ver_plano", "registrar_dose"], concedidoPor: ids.userPacA1 })
      .returning();
    expect(await lerPlanoDoPaciente(await ator(ids.cuidador), planoA1)).not.toBeNull();

    await db.update(s.autorizacaoCuidador).set({ revogadoEm: new Date(), revogadoPor: ids.userPacA1 }).where(eq(s.autorizacaoCuidador.id, aut.id));
    const cuidador = await ator(ids.cuidador);
    expect(await lerPlanoDoPaciente(cuidador, planoA1)).toBeNull();
    await expect(
      registrarDose(cuidador, { planoId: planoA1, itemId: "med-a", data: "2026-10-03", horario: "08:00", situacao: "relatou_tomada" }),
    ).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("autorização expirada não vale", async () => {
    const planoA1 = await publicarPlano();
    await db.insert(s.autorizacaoCuidador).values({
      pacienteId: ids.pacA1,
      cuidadorUserId: ids.cuidador,
      escopo: ["ver_plano"],
      concedidoPor: ids.userPacA1,
      expiraEm: new Date(Date.now() - 1000),
    });
    expect(await lerPlanoDoPaciente(await ator(ids.cuidador), planoA1)).toBeNull();
  });
});

describe("5. convites", () => {
  async function conviteComCodigo() {
    await publicarPlano("atA2");
    const c = await criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2);
    const ini = await iniciarAtivacao(c.token);
    if (!("sessaoAtivacao" in ini)) throw new Error("falhou");
    const msgs = await db.select().from(s.mensagemDev).where(eq(s.mensagemDev.para, "paca2@teste.test"));
    const msg = msgs.at(-1)!;
    const codigo = msg.corpo.match(/\d{6}/)![0];
    return { token: c.token, sessao: ini.sessaoAtivacao, codigo };
  }

  it("o banco guarda só o hash do token; a pré-visualização não consome", async () => {
    await publicarPlano("atA2");
    const c = await criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2);
    expect(c.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits
    const [linha] = await db.select().from(s.convite);
    expect(Buffer.from(linha.tokenHash).equals(createHash("sha256").update(c.token).digest())).toBe(true);
    expect(JSON.stringify(linha)).not.toContain(c.token);
    await previsualizarConvite(c.token);
    await previsualizarConvite(c.token);
    expect((await previsualizarConvite(c.token)).estado).toBe("valido");
  });

  it("código errado é limitado a 5 tentativas", async () => {
    const { sessao } = await conviteComCodigo();
    for (let i = 0; i < 5; i++) expect((await verificarCodigo(sessao, "000000")).ok).toBe(false);
    const r = await verificarCodigo(sessao, "000000");
    expect(r).toMatchObject({ ok: false, motivo: "tentativas" });
  });

  it("consumo simultâneo: só uma requisição vence; reutilização é recusada", async () => {
    const { token, sessao, codigo } = await conviteComCodigo();
    expect((await verificarCodigo(sessao, codigo)).ok).toBe(true);
    const contaNova = await auth.$context.then((ctx) =>
      ctx.internalAdapter.createUser({ email: "paca2@teste.test", name: "A2", emailVerified: true }, { method: "email-password" }),
    );
    const resultados = await Promise.all([
      consumirConvite(sessao, contaNova.id, "paca2@teste.test").catch(() => ({ ok: false })),
      consumirConvite(sessao, contaNova.id, "paca2@teste.test").catch(() => ({ ok: false })),
    ]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect((await previsualizarConvite(token)).estado).toBe("usado");
    const [pac] = await db.select().from(s.paciente).where(eq(s.paciente.id, ids.pacA2));
    expect(pac.userId).toBe(contaNova.id);
  });

  it("convite com e-mail diferente da conta não é consumido", async () => {
    const { sessao, codigo } = await conviteComCodigo();
    await verificarCodigo(sessao, codigo);
    expect((await consumirConvite(sessao, ids.cuidador, "cuidador@teste.test")).ok).toBe(false);
  });

  it("expirado e revogado são tratados", async () => {
    await publicarPlano("atA2");
    const enf = await ator(ids.enfermagemA);
    const primeiro = await criarConvitePaciente(enf, ids.atA2);
    const segundo = await criarConvitePaciente(enf, ids.atA2);
    expect((await previsualizarConvite(primeiro.token)).estado).toBe("revogado");
    await poolOwner().query("update convite set expira_em = now() - interval '1 minute' where revogado_em is null");
    expect((await previsualizarConvite(segundo.token)).estado).toBe("expirado");
    expect(await iniciarAtivacao(segundo.token)).toEqual({ erro: "expirado" });
    expect((await previsualizarConvite("x".repeat(43))).estado).toBe("inexistente");
  });

  it("convite exige plano publicado e vínculo da equipe", async () => {
    await expect(criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2)).rejects.toThrow();
    await publicarPlano("atB1", "B");
    await expect(criarConvitePaciente(await ator(ids.enfermagemA), ids.atB1)).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("6. sessões", () => {
  it("sair invalida a sessão no servidor", async () => {
    const r = await auth.api.signInEmail({ body: { email: "paca1@teste.test", password: SENHA }, asResponse: true });
    const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const headers = new Headers({ cookie });
    expect(await auth.api.getSession({ headers })).not.toBeNull();
    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("profissional com MFA não recebe sessão só com a senha", async () => {
    // Ativa o TOTP de verdade para o enfermeiro A (pelo próprio Better Auth).
    await poolOwner().query(`update "user" set two_factor_enabled = false where email = 'enfermagem.a@teste.test'`);
    const login = await auth.api.signInEmail({ body: { email: "enfermagem.a@teste.test", password: SENHA }, asResponse: true });
    const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    await auth.api.enableTwoFactor({ body: { password: SENHA }, headers: new Headers({ cookie }) });
    await poolOwner().query(`update "user" set two_factor_enabled = true where email = 'enfermagem.a@teste.test'`);

    const r = await auth.api.signInEmail({ body: { email: "enfermagem.a@teste.test", password: SENHA }, asResponse: true });
    const corpo = await r.json();
    expect(corpo.twoFactorRedirect).toBe(true);
    const sessaoCookie = r.headers.getSetCookie().find((c) => c.startsWith("alta.session_token="));
    expect(sessaoCookie === undefined || /Max-Age=0/.test(sessaoCookie)).toBe(true);
  });

  it("senha errada não revela se o e-mail existe", async () => {
    const existe = await auth.api.signInEmail({ body: { email: "paca1@teste.test", password: "senha errada mas longa demais" }, asResponse: true });
    const naoExiste = await auth.api.signInEmail({ body: { email: "ninguem@teste.test", password: "senha errada mas longa demais" }, asResponse: true });
    expect(existe.status).toBe(naoExiste.status);
    expect((await existe.json()).message).toBe((await naoExiste.json()).message);
  });
});

describe("7 e 8. injeção e scripts", () => {
  it("texto com SQL é gravado literalmente e não altera nada fora do escopo", async () => {
    const malicioso = "'; drop table plano; -- \" or 1=1";
    const conteudo = conteudoValido();
    conteudo.cuidados[0].texto = malicioso;
    const planoId = await publicarPlano("atA1", "A", conteudo);
    const visto = await lerPlanoDoPaciente(await ator(ids.userPacA1), planoId);
    expect(visto?.conteudo.cuidados[0].texto).toBe(malicioso);
    const { rows } = await poolOwner().query("select count(*)::int as n from plano");
    expect(rows[0].n).toBe(1);
  });

  it("identificador malicioso não vira consulta (validação antes do banco)", async () => {
    await expect(lerPlanoDoPaciente(await ator(ids.userPacA1), "1' or '1'='1")).rejects.toThrow();
    const { rows } = await poolOwner().query("select count(*)::int as n from auditoria where resultado = 'permitido' and acao = 'plano.ler_paciente'");
    expect(rows[0].n).toBe(0);
  });

  it("conteúdo com HTML é exibido como texto, não executado", () => {
    const conteudo = conteudoValido();
    conteudo.cuidados[0].texto = "<script>alert(1)</script><img src=x onerror=alert(2)>";
    const html = renderToString(ListaCuidados({ conteudo }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("o usuário da aplicação não altera nem apaga a auditoria", async () => {
    await publicarPlano();
    // 42501 = insufficient_privilege (o Drizzle embrulha o erro do PostgreSQL em `cause`).
    const codigo = (e: unknown) => (e as { cause?: { code?: string } }).cause?.code;
    expect(codigo(await db.delete(s.auditoria).catch((e) => e))).toBe("42501");
    expect(codigo(await db.update(s.auditoria).set({ acao: "x" }).catch((e) => e))).toBe("42501");
    const { rows } = await poolOwner().query("select count(*)::int as n from auditoria");
    expect(rows[0].n).toBeGreaterThan(0);
  });
});

describe("10. nova versão", () => {
  it("publicar a nova versão substitui a anterior e preserva o histórico", async () => {
    const v1 = await publicarPlano();
    const enf = await ator(ids.enfermagemA);
    const v2 = await abrirNovaVersao(enf, ids.atA1, "ajuste de horário");
    const conteudo = conteudoValido();
    conteudo.medicamentos[0].horarios = ["09:00", "21:00"];
    const r = await salvarRascunho(enf, v2, 0, conteudo);
    await enviarParaRevisao(enf, v2, r);
    await aprovarEPublicar(await ator(ids.revisorA), v2, r + 1, "A-001");

    const planos = await db.select().from(s.plano).where(eq(s.plano.atendimentoId, ids.atA1));
    expect(planos.find((p) => p.id === v1)?.status).toBe("substituido");
    expect(planos.find((p) => p.id === v2)?.status).toBe("publicado");
    expect(planos.filter((p) => p.status === "publicado")).toHaveLength(1);

    // Registros na versão antiga não são mais aceitos.
    await expect(
      registrarDose(await ator(ids.userPacA1), { planoId: v1, itemId: "med-a", data: "2026-10-03", horario: "08:00", situacao: "relatou_tomada" }),
    ).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("11. registros de dose", () => {
  it("registro simultâneo do paciente e do cuidador gera um único evento", async () => {
    const planoId = await publicarPlano();
    await db.insert(s.autorizacaoCuidador).values({ pacienteId: ids.pacA1, cuidadorUserId: ids.cuidador, escopo: ["ver_plano", "registrar_dose"], concedidoPor: ids.userPacA1 });
    const entrada = { planoId, itemId: "med-a", data: "2026-10-03", horario: "08:00", situacao: "relatou_tomada" as const };
    await Promise.all([registrarDose(await ator(ids.userPacA1), entrada), registrarDose(await ator(ids.cuidador), entrada)]);
    const linhas = await db.select().from(s.registroDose).where(eq(s.registroDose.planoId, planoId));
    expect(linhas).toHaveLength(1);
  });

  it("dose fora da prescrição ou fora do período é recusada", async () => {
    const planoId = await publicarPlano();
    const pac = await ator(ids.userPacA1);
    const base = { planoId, itemId: "med-a", situacao: "relatou_tomada" as const };
    await expect(registrarDose(pac, { ...base, data: "2026-10-03", horario: "13:00" })).rejects.toBeInstanceOf(AcessoNegado);
    await expect(registrarDose(pac, { ...base, data: "2026-10-02", horario: "08:00" })).rejects.toBeInstanceOf(AcessoNegado);
    await expect(registrarDose(pac, { ...base, data: "2026-10-08", horario: "08:00" })).rejects.toBeInstanceOf(AcessoNegado);
    await expect(registrarDose(pac, { ...base, itemId: "inventado", data: "2026-10-03", horario: "08:00" })).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("data do plano segue o fuso de Brasília, não o do aparelho", () => {
    expect(agoraNoFuso(new Date("2026-10-04T02:30:00Z"), "America/Sao_Paulo")).toEqual({ hoje: "2026-10-03", minutos: 23 * 60 + 30 });
    expect(agoraNoFuso(new Date("2026-10-04T03:00:00Z"), "America/Sao_Paulo")).toEqual({ hoje: "2026-10-04", minutos: 0 });
  });
});

describe("13. logs e mensagens sem conteúdo clínico", () => {
  it("auditoria e mensagens não contêm nome de medicamento nem procedimento", async () => {
    await publicarPlano("atA2");
    const c = await criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2);
    await iniciarAtivacao(c.token);
    const { rows: auditoria } = await poolOwner().query("select acao, detalhes::text from auditoria");
    const { rows: mensagens } = await poolOwner().query("select assunto, corpo from mensagem_dev");
    const tudo = JSON.stringify([auditoria, mensagens]);
    expect(tudo).not.toContain("Medicamento demonstrativo");
    expect(tudo).not.toContain("Procedimento de teste");
    expect(tudo).not.toContain(c.token);
  });
});
