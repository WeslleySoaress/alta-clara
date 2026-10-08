"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditar } from "@/server/auditoria";
import { auth } from "@/server/auth/auth";

export async function sair() {
  const h = await headers();
  const sessao = await auth.api.getSession({ headers: h });
  await auth.api.signOut({ headers: h });
  if (sessao) await auditar({ atorUserId: sessao.user.id, acao: "sessao.sair", resultado: "permitido" });
  redirect("/entrar?motivo=encerrada");
}

/**
 * Demonstração pública: entra numa das contas fictícias com um clique.
 * Só existe com ALTA_MODO_DEMONSTRACAO=1 e só para as contas da lista —
 * a senha fica no servidor e passa pelo mesmo login (limite por IP incluído).
 */
export async function entrarDemonstracao(email: string) {
  const { CONTAS_DEMONSTRACAO, modoDemonstracao, senhaDemonstracao } = await import("@/server/demonstracao");
  const conta = CONTAS_DEMONSTRACAO.find((c) => c.email === email);
  if (!modoDemonstracao() || !conta || !senhaDemonstracao()) redirect("/entrar");
  try {
    await auth.api.signInEmail({ body: { email: conta.email, password: senhaDemonstracao() }, headers: await headers() });
  } catch {
    redirect("/entrar?motivo=demo_indisponivel");
  }
  redirect("/inicio");
}
