import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Marca } from "@/components/Marca";
import { obterSessao } from "@/server/auth/sessao";
import { modoDemonstracao } from "@/server/demonstracao";
import { estadoDaAtivacao } from "@/server/dominio/convites";
import { Ativacao } from "./Ativacao";

export const metadata: Metadata = { title: "Ativar acesso", robots: { index: false, follow: false } };

export default async function Page() {
  // Retomada: se o token já foi trocado pelo cookie, continua de onde parou.
  const sessaoAtivacao = (await cookies()).get("alta_ativacao")?.value;
  const andamento = sessaoAtivacao ? await estadoDaAtivacao(sessaoAtivacao) : null;
  const sessao = await obterSessao();
  const emailLogado = "motivo" in sessao ? null : sessao.email;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Marca />
      <h1 className="mt-8 text-3xl font-extrabold">Ativar seu acesso</h1>
      <div className="mt-6">
        <Ativacao
          andamento={
            andamento && andamento.estado === "valido"
              ? { instituicao: andamento.instituicao!, emailMascarado: andamento.emailMascarado!, codigoVerificado: andamento.codigoVerificado!, convite: andamento.tipo! }
              : null
          }
          contaLogada={emailLogado !== null}
          demonstracao={modoDemonstracao()}
        />
      </div>
    </main>
  );
}
