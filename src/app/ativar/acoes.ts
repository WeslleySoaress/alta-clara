"use server";

import { cookies, headers } from "next/headers";
import { auth } from "@/server/auth/auth";
import { criarContaComSenha } from "@/server/auth/contas";
import { obterSessao } from "@/server/auth/sessao";
import { consumirConvite, dadosParaConclusao, verificarCodigo } from "@/server/dominio/convites";

const COOKIE = "alta_ativacao";

async function lerCookie() {
  return (await cookies()).get(COOKIE)?.value ?? "";
}

export async function verificarCodigoAcao(codigo: string) {
  const sessao = await lerCookie();
  if (!sessao) return { ok: false as const, motivo: "invalido" as const };
  return verificarCodigo(sessao, String(codigo));
}

/** Cria a conta do paciente (canal já verificado), consome o convite e inicia a sessão. */
export async function concluirComSenhaAcao(entrada: { nome: string; senha: string }) {
  const sessaoAtivacao = await lerCookie();
  const dados = await dadosParaConclusao(sessaoAtivacao);
  if (!dados) return { ok: false as const, erro: "A ativação expirou. Escaneie o QR code de novo." };

  const nome = String(entrada.nome ?? "").trim().slice(0, 80);
  if (nome.length < 2) return { ok: false as const, erro: "Informe como prefere ser chamado." };

  const conta = await criarContaComSenha({ email: dados.email, nome, senha: String(entrada.senha ?? "") });
  if ("erro" in conta) {
    return {
      ok: false as const,
      erro:
        conta.erro === "conta_existente"
          ? "Já existe uma conta com este e-mail. Entre com ela e escaneie o QR code de novo para vincular."
          : conta.erro,
    };
  }

  const consumo = await consumirConvite(sessaoAtivacao, conta.userId, dados.email).catch(() => ({ ok: false as const }));
  if (!consumo.ok) {
    // Compensação: a conta recém-criada sem vínculo é removida.
    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteUser(conta.userId);
    return { ok: false as const, erro: "Este convite não está mais disponível. Peça um novo QR code à equipe." };
  }

  (await cookies()).delete({ name: COOKIE, path: "/ativar" });
  // Nova sessão (identificador novo) emitida depois da ativação.
  await auth.api.signInEmail({ body: { email: dados.email, password: String(entrada.senha) }, headers: await headers() });
  return { ok: true as const };
}

/** Para quem já tem conta com o mesmo e-mail e está logado. */
export async function vincularContaAtualAcao() {
  const sessaoAtivacao = await lerCookie();
  const dados = await dadosParaConclusao(sessaoAtivacao);
  const sessao = await obterSessao();
  if (!dados || "motivo" in sessao) return { ok: false as const, erro: "Entre na sua conta e escaneie o QR code de novo." };
  if (sessao.email.toLowerCase() !== dados.email.toLowerCase()) {
    return { ok: false as const, erro: "A conta conectada não é a do convite." };
  }
  const consumo = await consumirConvite(sessaoAtivacao, sessao.ator.userId, sessao.email).catch(() => ({ ok: false as const }));
  if (!consumo.ok) return { ok: false as const, erro: "Este convite não está mais disponível." };
  (await cookies()).delete({ name: COOKIE, path: "/ativar" });
  return { ok: true as const };
}
