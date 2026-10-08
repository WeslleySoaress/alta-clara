import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/Marca";
import { Aviso } from "@/components/ui";
import { ehProfissional } from "@/server/authz/politicas";
import { exigirSessao } from "@/server/auth/sessao";
import { MENSAGEM_INDISPONIVEL, modoDemonstracao } from "@/server/demonstracao";
import { sair } from "../../entrar/acoes";
import { SegurancaConta } from "./SegurancaConta";

export const metadata: Metadata = { title: "Segurança da conta" };

export default async function Page(props: PageProps<"/conta/seguranca">) {
  const { ator, email } = await exigirSessao();
  const { exigir } = await props.searchParams;
  const profissional = ehProfissional(ator);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <Marca href="/inicio" compacta />
        <form action={sair}>
          <button className="min-h-11 rounded-xl px-3 font-semibold text-primary underline">Sair</button>
        </form>
      </div>

      <h1 className="mt-8 text-3xl font-extrabold">Segurança da conta</h1>
      <p className="mt-1 text-muted">{email}</p>

      {exigir === "mfa" && (
        <div className="mt-5">
          <Aviso tom="warn" titulo="Configure o segundo fator para continuar">
            Contas profissionais só acessam a área da equipe com verificação em duas etapas ativa.
          </Aviso>
        </div>
      )}

      <div className="mt-6">
        {modoDemonstracao() ? (
          <Aviso tom="info" titulo="Demonstração pública">
            {MENSAGEM_INDISPONIVEL} Troca de senha, segundo fator (TOTP), passkeys e encerramento de sessões estão
            implementados e testados — veja o relatório de testes no repositório.
          </Aviso>
        ) : (
          <SegurancaConta mfaAtivo={ator.mfaAtivo} profissional={profissional} />
        )}
      </div>

      {(!profissional || ator.mfaAtivo) && (
        <p className="mt-10">
          <Link href="/inicio" className="font-semibold text-primary underline">
            Voltar para o início
          </Link>
        </p>
      )}
    </div>
  );
}
