// Popula o banco com DADOS SINTÉTICOS: duas instituições fictícias, equipe em
// cada perfil, pacientes e modelos. Senhas aleatórias vão para
// .dev-credenciais.md (ignorado pelo git).
//
//   npm run db:seed            cria se o banco estiver vazio
//   npm run db:seed -- --reset apaga os dados e recria
//   npm run db:seed -- --reset --demo
//       demonstração pública: senha única ALTA_DEMO_SENHA, paciente Maria com
//       conta e plano publicado, e um plano de João esperando revisão
import { carregarAmbiente } from "./ambiente";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

carregarAmbiente({ operacao: true });

const DEMO = process.argv.includes("--demo");
if (DEMO) {
  if (!process.env.ALTA_DEMO_SENHA) throw new Error("ALTA_DEMO_SENHA ausente (senha pública das contas de demonstração).");
  // As regras de domínio passam a se comportar como na demonstração (2FA dispensado).
  process.env.ALTA_MODO_DEMONSTRACAO = "1";
}

async function main() {
  const { db, pool } = await import("../src/server/db/cliente");
  const s = await import("../src/server/db/schema");
  const { criarContaComSenha } = await import("../src/server/auth/contas");
  const { MODELOS_SINTETICOS } = await import("../src/server/dominio/dados-sinteticos");
  const { sql } = await import("drizzle-orm");

  if (process.argv.includes("--reset")) {
    const owner = new (await import("pg")).default.Pool({ connectionString: process.env.DATABASE_URL_OWNER });
    await owner.query(`truncate auditoria, tentativa_login, lembrete, preferencia_lembrete, pendencia, confirmacao_entendimento, registro_dose, autorizacao_cuidador, convite, plano, modelo_protocolo,
      equipe_atendimento, atendimento, paciente, vinculo, instituicao, mensagem_dev,
      two_factor, passkey, session, account, verification, rate_limit, "user" restart identity cascade`);
    await owner.end();
    console.log("Dados apagados.");
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.instituicao);
  if (n > 0) {
    console.log("O banco já tem dados. Use --reset para recriar.");
    await pool.end();
    return;
  }

  const credenciais: string[] = [];
  const senha = () => (DEMO ? process.env.ALTA_DEMO_SENHA! : randomBytes(18).toString("base64url")); // 24 caracteres

  async function conta(email: string, nome: string) {
    const s1 = senha();
    const r = await criarContaComSenha({ email, nome, senha: s1 });
    if (!("userId" in r)) throw new Error(`Falha ao criar ${email}: ${r.erro}`);
    credenciais.push(`| ${nome} | ${email} | \`${s1}\` |`);
    return r.userId;
  }

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const instituicoes = [
    {
      nome: "Hospital Exemplo Norte (fictício)",
      dominio: "norte.exemplo.test",
      telefone: "(11) 0000-0001",
      equipe: [
        ["ana.enfermagem", "Ana Teste (Enfermagem)", "enfermagem"],
        ["bruno.revisor", "Bruno Teste (Revisor clínico)", "revisor"],
        ["carla.admin", "Carla Teste (Admin institucional)", "admin"],
        ["davi.auditor", "Davi Teste (Auditor)", "auditor"],
      ],
      pacientes: [
        { nome: "Maria Exemplo da Silva", nascimento: "1948-03-12", prontuario: "N-000101", email: "maria.paciente@exemplo.test", procedimento: "Cirurgia abdominal (exemplo)" },
        { nome: "João Fictício Souza", nascimento: "1975-11-02", prontuario: "N-000102", email: "joao.paciente@exemplo.test", procedimento: "Internação clínica (exemplo)" },
      ],
    },
    {
      nome: "Hospital Exemplo Sul (fictício)",
      dominio: "sul.exemplo.test",
      telefone: "(11) 0000-0002",
      equipe: [
        ["eva.enfermagem", "Eva Teste (Enfermagem)", "enfermagem"],
        ["fabio.revisor", "Fábio Teste (Revisor clínico)", "revisor"],
      ],
      pacientes: [
        { nome: "Helena Demonstração Lima", nascimento: "1960-07-21", prontuario: "S-000201", email: "helena.paciente@exemplo.test", procedimento: "Cirurgia abdominal (exemplo)" },
      ],
    },
  ] as const;

  const atendimentos: Record<string, string> = {};
  const modelos: Record<string, string> = {};
  const equipes: Record<string, Record<string, string>> = {};

  for (const inst of instituicoes) {
    const [i] = await db.insert(s.instituicao).values({ nome: inst.nome, telefone: inst.telefone }).returning();
    const equipe: Record<string, string> = {};
    for (const [usuario, nome, papel] of inst.equipe as readonly (readonly [string, string, "enfermagem" | "revisor" | "admin" | "auditor"])[]) {
      const id = await conta(`${usuario}@${inst.dominio}`, nome);
      equipe[papel] = id;
      equipes[inst.dominio] = equipe;
      await db.insert(s.vinculo).values({ userId: id, instituicaoId: i.id, papel });
    }
    for (const m of MODELOS_SINTETICOS) {
      const [mod] = await db.insert(s.modeloProtocolo).values({ instituicaoId: i.id, nome: m.nome, versao: 1, conteudo: m.conteudo, sintetico: true }).returning();
      modelos[`${inst.dominio}:${m.nome}`] ??= mod.id;
    }
    for (const p of inst.pacientes) {
      const [pac] = await db
        .insert(s.paciente)
        .values({ instituicaoId: i.id, nome: p.nome, dataNascimento: p.nascimento, prontuario: p.prontuario, emailContato: p.email })
        .returning();
      const [at] = await db
        .insert(s.atendimento)
        .values({ instituicaoId: i.id, pacienteId: pac.id, procedimento: p.procedimento, unidade: "Clínica Cirúrgica — 3º andar (fictícia)", admissaoEm: hoje, altaPrevistaEm: hoje })
        .returning();
      await db.insert(s.equipeAtendimento).values({ atendimentoId: at.id, userId: equipe.enfermagem! });
      atendimentos[p.prontuario] = at.id;
    }
  }

  if (DEMO) await montarDemonstracao();

  async function montarDemonstracao() {
    const { carregarAtor } = await import("../src/server/authz/ator");
    const planos = await import("../src/server/dominio/planos");
    const { eq } = await import("drizzle-orm");
    const equipe = equipes["norte.exemplo.test"];
    const ana = await carregarAtor(equipe.enfermagem);
    const bruno = await carregarAtor(equipe.revisor);
    const modeloId = Object.entries(modelos).find(([k]) => k.startsWith("norte.exemplo.test:"))![1];
    const revisaoDe = async (id: string) => (await db.select({ r: s.plano.revisao }).from(s.plano).where(eq(s.plano.id, id)))[0].r;

    // Maria: conta própria e plano publicado (Ana montou, Bruno revisou).
    const maria = await conta("maria.paciente@exemplo.test", "Maria Exemplo da Silva");
    await db.update(s.paciente).set({ userId: maria }).where(eq(s.paciente.prontuario, "N-000101"));
    const p1 = await planos.criarRascunho(ana, atendimentos["N-000101"], modeloId);
    await planos.salvarRascunho(ana, p1, await revisaoDe(p1), conteudoDemonstracao(hoje));
    await planos.enviarParaRevisao(ana, p1, await revisaoDe(p1));
    await planos.aprovarEPublicar(bruno, p1, await revisaoDe(p1), "N-000101");

    // João: plano esperando revisão, para a fila do revisor não nascer vazia.
    const p2 = await planos.criarRascunho(ana, atendimentos["N-000102"], modeloId);
    await planos.salvarRascunho(ana, p2, await revisaoDe(p2), { ...conteudoDemonstracao(hoje), medicamentos: conteudoDemonstracao(hoje).medicamentos.slice(0, 1) });
    await planos.enviarParaRevisao(ana, p2, await revisaoDe(p2));
    console.log("Demonstração: plano publicado (Maria) e plano em revisão (João).");
  }

  writeFileSync(
    ".dev-credenciais.md",
    `# Credenciais SINTÉTICAS de desenvolvimento\n\nGeradas em ${new Date().toISOString()}. Não use em outro ambiente.\n` +
      `Profissionais precisam configurar o segundo fator no primeiro acesso.\n` +
      `Pacientes são ativados pelo QR code gerado na área da equipe.\n\n| Nome | E-mail | Senha |\n|---|---|---|\n${credenciais.join("\n")}\n`,
    { mode: 0o600 },
  );
  console.log(`Dados sintéticos criados. Credenciais em .dev-credenciais.md (${credenciais.length} contas).`);
  await pool.end();
}

/** Plano fictício completo, usado só na demonstração pública. */
function conteudoDemonstracao(inicio: string) {
  return {
    inicio,
    fusoHorario: "America/Sao_Paulo" as const,
    medicamentos: [
      { id: "med-demo-a", nome: "Medicamento demonstrativo A 500 mg", finalidade: "Exemplo: proteger contra infecção depois da cirurgia", apresentacao: "comprimido" as const, dose: "1 comprimido", via: "pela boca", horarios: ["08:00", "20:00"], duracaoDias: 7, seNecessario: null, observacao: "Tome com um copo de água." },
      { id: "med-demo-b", nome: "Medicamento demonstrativo B 20 mg", finalidade: "Exemplo: proteger o estômago", apresentacao: "capsula" as const, dose: "1 cápsula", via: "pela boca", horarios: ["07:00"], duracaoDias: 14, seNecessario: null, observacao: "Em jejum, antes do café." },
      { id: "med-demo-c", nome: "Analgésico demonstrativo C", finalidade: "Exemplo: aliviar a dor", apresentacao: "comprimido" as const, dose: "1 comprimido", via: "pela boca", horarios: [], duracaoDias: 5, seNecessario: { quando: "se sentir dor", intervaloMinimoHoras: 6, maximoPorDia: 4 }, observacao: null },
    ],
    cuidados: [
      { categoria: "ferida" as const, titulo: "Corte da cirurgia", texto: "[Exemplo] Lave com água e sabão neutro, seque com toalha limpa e não coloque pomadas sem orientação." },
      { categoria: "banho" as const, titulo: "Banho", texto: "[Exemplo] Banho de chuveiro liberado. Evite banheira e piscina até o retorno." },
      { categoria: "alimentacao" as const, titulo: "Alimentação", texto: "[Exemplo] Comece com alimentos leves e beba bastante água ao longo do dia." },
      { categoria: "atividade" as const, titulo: "Esforço físico", texto: "[Exemplo] Caminhe dentro de casa. Não carregue peso por 30 dias." },
    ],
    sinais: [
      { nivel: "previsto" as const, texto: "[Exemplo] Desconforto leve no local da cirurgia nos primeiros dias" },
      { nivel: "contato" as const, texto: "[Exemplo] Dor que não melhora com o remédio indicado no plano" },
      { nivel: "contato" as const, texto: "[Exemplo] Vermelhidão ao redor do corte" },
      { nivel: "urgencia" as const, texto: "[Exemplo] Febre alta, falta de ar ou sangramento que não para" },
    ],
    retornos: [{ local: "Ambulatório de Cirurgia (fictício)", dataHora: null, levar: ["Documento com foto", "Cartão do SUS", "Este plano"] }],
    contato: { unidade: "Clínica Cirúrgica — 3º andar (fictícia)", telefone: "(11) 0000-0001", horarioAtendimento: "Todos os dias, 24 horas" },
    equipeResponsavel: "Equipe da Clínica Cirúrgica (fictícia)",
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
