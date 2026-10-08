import { eq, inArray } from "drizzle-orm";
import pg from "pg";
import { criarContaComSenha } from "@/server/auth/contas";
import { carregarAtor } from "@/server/authz/ator";
import { db } from "@/server/db/cliente";
import * as s from "@/server/db/schema";
import type { ConteudoPlano } from "@/server/dominio/conteudo";
import { MODELOS_SINTETICOS } from "@/server/dominio/dados-sinteticos";

// Cenário sintético para os testes: duas instituições (A e B), equipe com
// todos os perfis, pacientes e um cuidador. Recriado do zero a cada teste.

export const SENHA = "uma frase longa de teste com espacos";

let owner: pg.Pool | null = null;
export function poolOwner() {
  owner ??= new pg.Pool({ connectionString: process.env.DATABASE_URL_OWNER, max: 2 });
  return owner;
}

export async function limparBanco() {
  await poolOwner().query(`truncate auditoria, tentativa_login, lembrete, preferencia_lembrete, pendencia, confirmacao_entendimento, registro_dose, autorizacao_cuidador, convite, plano, modelo_protocolo,
    equipe_atendimento, atendimento, paciente, vinculo, instituicao, mensagem_dev,
    two_factor, passkey, session, account, verification, rate_limit, "user" restart identity cascade`);
}

async function conta(email: string, nome = email.split("@")[0]) {
  const r = await criarContaComSenha({ email, nome, senha: SENHA });
  if (!("userId" in r)) throw new Error(r.erro);
  return r.userId;
}

export async function montarCenario() {
  await limparBanco();
  const ids: Record<string, string> = {};

  for (const sigla of ["A", "B"] as const) {
    const [inst] = await db.insert(s.instituicao).values({ nome: `Instituição ${sigla} (teste)`, telefone: "(11) 0000-0000" }).returning();
    ids[`inst${sigla}`] = inst.id;
    for (const papel of ["enfermagem", "revisor", "revisor2", "admin", "auditor"] as const) {
      const id = await conta(`${papel}.${sigla.toLowerCase()}@teste.test`);
      ids[`${papel}${sigla}`] = id;
      await db.insert(s.vinculo).values({ userId: id, instituicaoId: inst.id, papel: papel === "revisor2" ? "revisor" : papel });
    }
    const [modelo] = await db
      .insert(s.modeloProtocolo)
      .values({ instituicaoId: inst.id, nome: MODELOS_SINTETICOS[0].nome, versao: 1, conteudo: MODELOS_SINTETICOS[0].conteudo })
      .returning();
    ids[`modelo${sigla}`] = modelo.id;

    for (const n of [1, 2]) {
      const chave = `pac${sigla}${n}`;
      const [p] = await db
        .insert(s.paciente)
        .values({
          instituicaoId: inst.id,
          nome: `Paciente ${sigla}${n}`,
          dataNascimento: "1950-01-01",
          prontuario: `${sigla}-00${n}`,
          emailContato: `${chave.toLowerCase()}@teste.test`,
        })
        .returning();
      ids[chave] = p.id;
      const [at] = await db
        .insert(s.atendimento)
        .values({ instituicaoId: inst.id, pacienteId: p.id, procedimento: "Procedimento de teste", unidade: "Unidade de teste", admissaoEm: "2026-10-01", altaPrevistaEm: "2026-10-03" })
        .returning();
      ids[`at${sigla}${n}`] = at.id;
      await db.insert(s.equipeAtendimento).values({ atendimentoId: at.id, userId: ids[`enfermagem${sigla}`] });
    }
  }

  // Profissionais com MFA ativo (o fluxo de TOTP é coberto no teste de ponta a ponta).
  const profissionais = Object.entries(ids).filter(([k]) => /^(enfermagem|revisor|revisor2|admin|auditor)[AB]$/.test(k)).map(([, v]) => v);
  await db.update(s.user).set({ twoFactorEnabled: true }).where(inArray(s.user.id, profissionais));

  // Contas de pacientes já vinculadas (A1 e B1) e um cuidador.
  ids.userPacA1 = await conta("paca1@teste.test");
  ids.userPacB1 = await conta("pacb1@teste.test");
  ids.cuidador = await conta("cuidador@teste.test");
  await db.update(s.paciente).set({ userId: ids.userPacA1 }).where(eq(s.paciente.id, ids.pacA1));
  await db.update(s.paciente).set({ userId: ids.userPacB1 }).where(eq(s.paciente.id, ids.pacB1));

  return ids;
}

export const ator = (userId: string) => carregarAtor(userId);

export function conteudoValido(inicio = "2026-10-03"): ConteudoPlano {
  return {
    inicio,
    fusoHorario: "America/Sao_Paulo",
    medicamentos: [
      {
        id: "med-a",
        nome: "Medicamento demonstrativo A",
        finalidade: "Exemplo",
        apresentacao: "capsula",
        dose: "1 cápsula",
        via: "pela boca",
        horarios: ["08:00", "20:00"],
        duracaoDias: 5,
        seNecessario: null,
        observacao: null,
      },
    ],
    cuidados: [{ categoria: "outro", titulo: "Cuidado", texto: "Texto de exemplo" }],
    sinais: [
      { nivel: "urgencia", texto: "Sinal de urgência de exemplo" },
      { nivel: "contato", texto: "Sinal de contato de exemplo" },
    ],
    retornos: [],
    contato: { unidade: "Unidade de teste", telefone: "(11) 0000-0000", horarioAtendimento: "24 h" },
    equipeResponsavel: "Equipe de teste",
  };
}
