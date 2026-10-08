import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { gerarIcs } from "@/lib/calendario";
import { avaliarUsoSeNecessario } from "@/lib/se-necessario";
import { auth } from "@/server/auth/auth";
import { encerrarMinhaSessao } from "@/server/auth/sessoes";
import { AcessoNegado } from "@/server/authz/politicas";
import { db } from "@/server/db/cliente";
import * as s from "@/server/db/schema";
import { compararConteudos } from "@/server/dominio/diferencas";
import { diarioParaEquipe } from "@/server/dominio/diario";
import { convidarCuidador } from "@/server/dominio/cuidadores";
import { criarConvitePaciente, iniciarAtivacao, verificarCodigo } from "@/server/dominio/convites";
import { agendarLembretesDoPlano, definirPreferenciaLembrete, processarLembretes } from "@/server/dominio/lembretes";
import { lerPlanoDoPaciente, registrarDose, registrarUsoSeNecessario, solicitarAjuda } from "@/server/dominio/paciente";
import { pendenciasDoPlanoParaPaciente } from "@/server/dominio/pendencias";
import { abrirNovaVersao, aprovarEPublicar, criarRascunho, enviarParaRevisao, EstadoInvalido, salvarRascunho } from "@/server/dominio/planos";
import { ator, conteudoValido, montarCenario, poolOwner, SENHA } from "./cenario";

let ids: Record<string, string>;
beforeEach(async () => {
  ids = await montarCenario();
});

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function conteudoComSeNecessario() {
  const c = conteudoValido(hojeSP());
  c.medicamentos.push({
    id: "med-sn",
    nome: "Medicamento demonstrativo C",
    finalidade: "Exemplo",
    apresentacao: "comprimido",
    dose: "1 comprimido",
    via: "pela boca",
    horarios: [],
    duracaoDias: 5,
    seNecessario: { quando: "se dor", intervaloMinimoHoras: 6, maximoPorDia: 3 },
    observacao: null,
  });
  return c;
}

async function publicar(conteudo = conteudoValido(hojeSP()), atendimento = "atA1") {
  const enf = await ator(ids.enfermagemA);
  const planoId = await criarRascunho(enf, ids[atendimento], ids.modeloA);
  const r = await salvarRascunho(enf, planoId, 0, conteudo);
  await enviarParaRevisao(enf, planoId, r);
  await aprovarEPublicar(await ator(ids.revisorA), planoId, r + 1, atendimento === "atA1" ? "A-001" : "A-002");
  return planoId;
}

const loginBruto = (email: string, password: string) =>
  auth.handler(
    new Request("http://localhost:3100/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3100", "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ email, password }),
    }),
  );

describe("bloqueio progressivo por conta (mesmo trocando de IP)", () => {
  it("após 5 falhas a conta espera, mesmo com a senha certa; e-mail inexistente se comporta igual", async () => {
    for (let i = 0; i < 5; i++) expect((await loginBruto("paca1@teste.test", "senha errada mas bem comprida")).status).toBe(401);
    expect((await loginBruto("paca1@teste.test", SENHA)).status).toBe(429);
    for (let i = 0; i < 5; i++) await loginBruto("fantasma@teste.test", "senha errada mas bem comprida");
    expect((await loginBruto("fantasma@teste.test", "senha errada mas bem comprida")).status).toBe(429);
    await poolOwner().query("update tentativa_login set bloqueado_ate = now() - interval '1 second'");
    expect((await loginBruto("paca1@teste.test", SENHA)).status).toBe(200);
    const { rows } = await poolOwner().query("select count(*)::int as n from tentativa_login");
    expect(rows[0].n).toBe(1); // a conta certa foi limpa no sucesso; só o fantasma continua
  });
});

describe("rotas da biblioteca de autenticação", () => {
  async function cookie(email: string) {
    const r = await auth.api.signInEmail({ body: { email, password: SENHA }, asResponse: true });
    return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }
  const chamar = (caminho: string, cookieHeader: string, corpo?: unknown) =>
    auth.handler(
      new Request(`http://localhost:3100/api/auth${caminho}`, {
        method: corpo ? "POST" : "GET",
        headers: { cookie: cookieHeader, origin: "http://localhost:3100", "content-type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
      }),
    );

  it("trocar o próprio nome está desativado (autoria não pode ser falsificada)", async () => {
    const r = await chamar("/update-user", await cookie("paca1@teste.test"), { name: "Dra. Fulana" });
    expect(r.status).toBe(404);
  });

  it("senha comum é recusada também na troca de senha", async () => {
    const r = await chamar("/change-password", await cookie("paca1@teste.test"), { currentPassword: SENHA, newPassword: "aaaaaaaaaaaaaaaaaaaa" });
    expect(r.status).toBe(400);
  });

  it("'confiar neste aparelho' no segundo fator é recusado", async () => {
    const r = await chamar("/two-factor/verify-totp", "", { code: "000000", trustDevice: true });
    expect(r.status).toBe(400);
  });

  it("inatividade de 15 min também vale nas rotas /api/auth/* (profissional)", async () => {
    await poolOwner().query(`update "user" set two_factor_enabled = false where id = $1`, [ids.revisorA]);
    const c = await cookie("revisor.a@teste.test");
    expect((await chamar("/get-session", c)).status).toBe(200);
    await poolOwner().query(`update session set ultima_atividade = now() - interval '20 minutes' where user_id = $1`, [ids.revisorA]);
    expect((await chamar("/get-session", c)).status).toBe(401);
    expect(await db.select().from(s.session).where(eq(s.session.userId, ids.revisorA))).toHaveLength(0);
  });

  it("não é possível encerrar a sessão de outra pessoa", async () => {
    await cookie("paca1@teste.test");
    const [alheia] = await db.select().from(s.session).where(eq(s.session.userId, ids.userPacA1));
    expect(await encerrarMinhaSessao(ids.userPacB1, alheia.id)).toBe(false);
    expect(await db.select().from(s.session).where(eq(s.session.id, alheia.id))).toHaveLength(1);
  });

  it("novo acesso gera aviso por mensagem", async () => {
    await cookie("paca1@teste.test");
    const msgs = await db.select().from(s.mensagemDev).where(eq(s.mensagemDev.para, "paca1@teste.test"));
    expect(msgs.some((m) => m.assunto.startsWith("Novo acesso"))).toBe(true);
  });
});

describe("separação de funções com vários editores", () => {
  it("revisor que editou a versão não pode aprová-la, mesmo se outra pessoa editar depois", async () => {
    const enf = await ator(ids.enfermagemA);
    const rev = await ator(ids.revisorA);
    const planoId = await criarRascunho(enf, ids.atA1, ids.modeloA);
    const r1 = await salvarRascunho(rev, planoId, 0, conteudoValido()); // revisor altera a prescrição
    const r2 = await salvarRascunho(enf, planoId, r1, conteudoValido()); // enfermagem faz edição trivial
    await enviarParaRevisao(enf, planoId, r2);
    await expect(aprovarEPublicar(rev, planoId, r2 + 1, "A-001")).rejects.toBeInstanceOf(AcessoNegado);
    await aprovarEPublicar(await ator(ids.revisor2A), planoId, r2 + 1, "A-001");
    const [p] = await db.select().from(s.plano).where(eq(s.plano.id, planoId));
    expect(p.autorId).toBe(ids.enfermagemA); // autor não é sobrescrito
    expect(p.editores.sort()).toEqual([ids.enfermagemA, ids.revisorA].sort());
  });

  it("criar rascunho com outro em edição dá mensagem clara", async () => {
    const enf = await ator(ids.enfermagemA);
    await criarRascunho(enf, ids.atA1, ids.modeloA);
    await expect(criarRascunho(enf, ids.atA1, ids.modeloA)).rejects.toBeInstanceOf(EstadoInvalido);
  });
});

describe("convite: tetos contra força bruta do código", () => {
  it("15 tentativas acumuladas revogam o convite e avisam a equipe", async () => {
    await publicar(conteudoValido(hojeSP()), "atA2");
    const c = await criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2);
    let total = 0;
    for (let rodada = 0; rodada < 4 && total < 16; rodada++) {
      await poolOwner().query("update convite set codigo_expira_em = now() - interval '20 minutes' where revogado_em is null");
      const ini = await iniciarAtivacao(c.token);
      if (!("sessaoAtivacao" in ini)) break;
      for (let i = 0; i < 5; i++) {
        await verificarCodigo(ini.sessaoAtivacao, "000000");
        total++;
      }
    }
    const [linha] = await db.select().from(s.convite);
    expect(linha.revogadoEm).not.toBeNull();
    expect(linha.tentativasTotais).toBeLessThanOrEqual(15);
    const pend = await db.select().from(s.pendencia).where(eq(s.pendencia.pacienteId, ids.pacA2));
    expect(pend.some((p) => p.descricao.includes("revogado automaticamente"))).toBe(true);
  });

  it("no máximo 5 envios de código por convite", async () => {
    await publicar(conteudoValido(hojeSP()), "atA2");
    const c = await criarConvitePaciente(await ator(ids.enfermagemA), ids.atA2);
    const resultados = [];
    for (let i = 0; i < 6; i++) {
      await poolOwner().query("update convite set codigo_expira_em = now() - interval '20 minutes' where revogado_em is null");
      resultados.push(await iniciarAtivacao(c.token));
    }
    expect(resultados.filter((r) => "sessaoAtivacao" in r)).toHaveLength(5);
    expect(resultados[5]).toEqual({ erro: "revogado" });
  });
});

describe("remédio 'se necessário'", () => {
  it("aplica intervalo mínimo e máximo por dia do plano, com a hora do servidor", async () => {
    const planoId = await publicar(conteudoComSeNecessario());
    const pac = await ator(ids.userPacA1);
    const base = new Date();
    const r1 = await registrarUsoSeNecessario(pac, { planoId, itemId: "med-sn" }, base);
    expect(r1.ok).toBe(true);
    const r2 = await registrarUsoSeNecessario(pac, { planoId, itemId: "med-sn" }, new Date(base.getTime() + 60_000));
    expect(r2).toMatchObject({ ok: false, motivo: "intervalo" });
    // Medicamento de horário fixo não passa por aqui.
    await expect(registrarUsoSeNecessario(pac, { planoId, itemId: "med-a" })).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("dois registros simultâneos não furam o intervalo", async () => {
    const planoId = await publicar(conteudoComSeNecessario());
    const pac = await ator(ids.userPacA1);
    const r = await Promise.all([registrarUsoSeNecessario(pac, { planoId, itemId: "med-sn" }), registrarUsoSeNecessario(pac, { planoId, itemId: "med-sn" })]);
    const linhas = await db.select().from(s.registroDose).where(eq(s.registroDose.itemId, "med-sn"));
    expect(linhas).toHaveLength(1);
    expect(r.filter((x) => x.ok)).toHaveLength(1);
  });

  it("regra pura: máximo por dia e próximo horário permitido", () => {
    const fuso = "America/Sao_Paulo";
    const agora = new Date("2026-10-04T20:00:00Z"); // 17h em Brasília
    const usos = [
      { data: "2026-10-04", horario: "06:00" },
      { data: "2026-10-04", horario: "12:00" },
      { data: "2026-10-04", horario: "16:00" },
    ];
    expect(avaliarUsoSeNecessario({ usos, intervaloMinimoHoras: 6, maximoPorDia: 3, agora, fuso })).toMatchObject({ permitido: false, motivo: "maximo_dia" });
    const av = avaliarUsoSeNecessario({ usos: usos.slice(0, 2), intervaloMinimoHoras: 6, maximoPorDia: 3, agora: new Date("2026-10-04T16:00:00Z"), fuso });
    expect(av).toMatchObject({ permitido: false, motivo: "intervalo" });
    if (!av.permitido && av.motivo === "intervalo") expect(av.proximo.toISOString()).toBe("2026-10-04T21:00:00.000Z"); // 18h em Brasília
  });
});

describe("registros entre versões e diário da equipe", () => {
  it("nova versão não apaga o que o paciente já marcou no dia", async () => {
    const v1 = await publicar();
    const pac = await ator(ids.userPacA1);
    await registrarDose(pac, { planoId: v1, itemId: "med-a", data: hojeSP(), horario: "08:00", situacao: "relatou_tomada" });
    const enf = await ator(ids.enfermagemA);
    const v2 = await abrirNovaVersao(enf, ids.atA1, "ajuste");
    const r = await salvarRascunho(enf, v2, 0, conteudoValido(hojeSP()));
    await enviarParaRevisao(enf, v2, r);
    await aprovarEPublicar(await ator(ids.revisorA), v2, r + 1, "A-001");
    const visto = await lerPlanoDoPaciente(pac, v2);
    expect(visto!.registros).toContainEqual(expect.objectContaining({ itemId: "med-a", horario: "08:00", situacao: "relatou_tomada" }));
    // Desfazer na versão nova remove o registro feito na anterior.
    await registrarDose(pac, { planoId: v2, itemId: "med-a", data: hojeSP(), horario: "08:00", situacao: null });
    expect(await db.select().from(s.registroDose)).toHaveLength(0);
    // A versão antiga avisa qual é a vigente.
    expect((await lerPlanoDoPaciente(pac, v1))!.vigenteId).toBe(v2);
  });

  it("diário resume o que foi relatado", async () => {
    const planoId = await publicar(conteudoComSeNecessario());
    const pac = await ator(ids.userPacA1);
    await registrarUsoSeNecessario(pac, { planoId, itemId: "med-sn" });
    const [p] = await db.select().from(s.plano).where(eq(s.plano.id, planoId));
    const d = await diarioParaEquipe(p.atendimentoId, conteudoComSeNecessario(), new Date());
    expect(d.resumo.find((r) => r.itemId === "med-sn")).toMatchObject({ relatadas: 1, seNecessario: true });
    expect(d.recentes).toHaveLength(1);
  });
});

describe("lembretes: religar e reservas", () => {
  it("desligar e religar volta a agendar", async () => {
    await definirPreferenciaLembrete(ids.userPacA1, true);
    const planoId = await publicar();
    const antes = (await db.select().from(s.lembrete).where(eq(s.lembrete.planoId, planoId))).length;
    expect(antes).toBeGreaterThan(0);
    await definirPreferenciaLembrete(ids.userPacA1, false);
    await definirPreferenciaLembrete(ids.userPacA1, true);
    await agendarLembretesDoPlano(planoId);
    const agendados = await db.select().from(s.lembrete).where(and(eq(s.lembrete.planoId, planoId), eq(s.lembrete.status, "agendado")));
    expect(agendados.length).toBe(antes);
  });

  it("reserva antiga (processador que caiu) volta para a fila; reserva recente não é reenviada", async () => {
    await definirPreferenciaLembrete(ids.userPacA1, true);
    const planoId = await publicar();
    const [l1, l2] = await db.select().from(s.lembrete).where(eq(s.lembrete.planoId, planoId)).limit(2);
    await poolOwner().query(`update lembrete set status = 'enviando', reservado_em = now() - interval '30 minutes', agendado_para = now() - interval '2 minutes' where id = $1`, [l1.id]);
    await poolOwner().query(`update lembrete set status = 'enviando', reservado_em = now(), agendado_para = now() - interval '2 minutes' where id = $1`, [l2.id]);
    const enviados: string[] = [];
    await processarLembretes(new Date(), async (m) => {
      enviados.push(m.para);
    });
    expect(enviados).toHaveLength(1);
    const [depois2] = await db.select().from(s.lembrete).where(eq(s.lembrete.id, l2.id));
    expect(depois2.status).toBe("enviando");
  });
});

describe("cuidadores e pedidos de ajuda", () => {
  it("no máximo 5 convites de cuidador aguardando", async () => {
    const pac = await ator(ids.userPacA1);
    for (let i = 0; i < 5; i++) await convidarCuidador(pac, { pacienteId: ids.pacA1, apelido: `Pessoa ${i}`, email: `p${i}@teste.test`, escopo: ["ver_plano"], validadeDias: 30 });
    await expect(convidarCuidador(pac, { pacienteId: ids.pacA1, apelido: "Sexta", email: "p6@teste.test", escopo: ["ver_plano"], validadeDias: 30 })).rejects.toThrow(/5 convites/);
  });

  it("cuidador vê só os próprios pedidos; o titular vê todos", async () => {
    const planoId = await publicar();
    await db.insert(s.autorizacaoCuidador).values({ pacienteId: ids.pacA1, cuidadorUserId: ids.cuidador, escopo: ["ver_plano"], concedidoPor: ids.userPacA1 });
    const pac = await ator(ids.userPacA1);
    const cuid = await ator(ids.cuidador);
    await solicitarAjuda(pac, { planoId, tipo: "duvida_geral", texto: "pergunta do paciente" });
    await solicitarAjuda(cuid, { planoId, tipo: "duvida_geral", texto: "pergunta do cuidador" });
    expect(await pendenciasDoPlanoParaPaciente(planoId, pac, true)).toHaveLength(2);
    const doCuidador = await pendenciasDoPlanoParaPaciente(planoId, cuid, false);
    expect(doCuidador.map((p) => p.descricao)).toEqual(["pergunta do cuidador"]);
  });
});

describe("outros ajustes", () => {
  it("'O que mudou' detecta mudança do primeiro dia e da unidade", () => {
    const a = conteudoValido("2026-10-03");
    const b = structuredClone(a);
    b.inicio = "2026-10-05";
    b.contato.unidade = "Outra unidade";
    const m = compararConteudos(a, b);
    expect(m.some((x) => x.titulo.startsWith("Primeiro dia"))).toBe(true);
    expect(m.some((x) => x.titulo === "Unidade para contato")).toBe(true);
  });

  it("calendário .ics traz o bloco de fuso exigido pela RFC 5545", () => {
    const ics = gerarIcs(conteudoValido("2026-10-03"), "teste");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/Sao_Paulo");
  });
});
