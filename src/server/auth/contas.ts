import { auth } from "./auth";
import { hashSenha, problemaNaSenhaCompleto } from "./senha";

/**
 * Cria uma conta com senha pelo adaptador interno do Better Auth.
 * Usado SOMENTE por fluxos já autorizados no servidor: ativação por convite
 * (depois do código no canal validado) e provisionamento institucional.
 * O cadastro público está desativado (emailAndPassword.disableSignUp).
 */
export async function criarContaComSenha(dados: {
  email: string;
  nome: string;
  senha: string;
}): Promise<{ userId: string } | { erro: string }> {
  const problema = await problemaNaSenhaCompleto(dados.senha, dados.email);
  if (problema) return { erro: problema };

  const ctx = await auth.$context;
  const existente = await ctx.internalAdapter.findUserByEmail(dados.email);
  if (existente) return { erro: "conta_existente" };

  const usuario = await ctx.internalAdapter.createUser({
    email: dados.email.toLowerCase(),
    name: dados.nome,
    emailVerified: true,
  }, { method: "email-password" });
  await ctx.internalAdapter.linkAccount({
    userId: usuario.id,
    providerId: "credential",
    accountId: usuario.id,
    password: await hashSenha(dados.senha),
  });
  return { userId: usuario.id };
}
