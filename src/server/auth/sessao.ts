import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auditar } from "../auditoria";
import { carregarAtor } from "../authz/ator";
import { ehProfissional, type Ator } from "../authz/politicas";
import { db } from "../db/cliente";
import { session as sessaoTabela } from "../db/schema";
import { auth } from "./auth";
import { avaliarSessao, type MotivoExpiracao } from "./politica-sessao";

export { POLITICA_SESSAO } from "./politica-sessao";

const GRAVAR_ATIVIDADE_A_CADA_MS = 60_000;

export type SessaoAtual = {
  sessaoId: string;
  ator: Ator;
  email: string;
  nome: string;
  /** Instante (ms) em que a sessão expira se não houver atividade, para o aviso. */
  expiraEm: number;
  fimAbsoluto: number;
};

export type MotivoSemSessao = "sem_sessao" | MotivoExpiracao;

/** Valida a sessão no servidor, aplica a política por perfil e devolve o ator. */
export const obterSessao = cache(async (): Promise<SessaoAtual | { motivo: MotivoSemSessao }> => {
  // O hook da biblioteca pode recusar (sessão expirada já apagada): trata como expirada.
  let dados: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    dados = await auth.api.getSession({ headers: await headers() });
  } catch {
    return { motivo: "inatividade" };
  }
  if (!dados) return { motivo: "sem_sessao" };

  const ator = await carregarAtor(dados.user.id);
  const agora = Date.now();
  const ultimaAtividade = (dados.session as { ultimaAtividade?: Date | null }).ultimaAtividade ?? null;
  const avaliacao = avaliarSessao({
    criadaEm: new Date(dados.session.createdAt),
    ultimaAtividade: ultimaAtividade ? new Date(ultimaAtividade) : null,
    profissional: ehProfissional(ator),
    agora,
  });

  if (avaliacao.motivo) {
    // Revogação efetiva: a sessão é apagada no servidor.
    await db.delete(sessaoTabela).where(eq(sessaoTabela.id, dados.session.id));
    await auditar({ atorUserId: ator.userId, acao: "sessao.expirada", resultado: "permitido", detalhes: { motivo: avaliacao.motivo } });
    return { motivo: avaliacao.motivo };
  }

  const ultima = new Date(ultimaAtividade ?? dados.session.createdAt).getTime();
  const gravar = agora - ultima > GRAVAR_ATIVIDADE_A_CADA_MS;
  if (gravar) {
    await db.update(sessaoTabela).set({ ultimaAtividade: new Date(agora) }).where(eq(sessaoTabela.id, dados.session.id));
  }

  const novaAvaliacao = avaliarSessao({
    criadaEm: new Date(dados.session.createdAt),
    ultimaAtividade: new Date(gravar ? agora : ultima),
    profissional: ehProfissional(ator),
    agora,
  });
  return {
    sessaoId: dados.session.id,
    ator,
    email: dados.user.email,
    nome: dados.user.name,
    expiraEm: agora + novaAvaliacao.restanteMs,
    fimAbsoluto: novaAvaliacao.fimAbsoluto,
  };
});

/** Para páginas: redireciona ao login quando não há sessão válida. */
export async function exigirSessao(): Promise<SessaoAtual> {
  const s = await obterSessao();
  if ("motivo" in s) redirect(s.motivo === "sem_sessao" ? "/entrar" : `/entrar?motivo=${s.motivo}`);
  return s;
}

/** Para a área profissional: exige vínculo ativo e MFA configurado. */
export async function exigirProfissional(): Promise<SessaoAtual> {
  const s = await exigirSessao();
  if (!ehProfissional(s.ator)) redirect("/paciente");
  if (!s.ator.mfaAtivo) redirect("/conta/seguranca?exigir=mfa");
  return s;
}
