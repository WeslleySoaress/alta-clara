import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconeCheck } from "@/components/Icones";
import { IlustracaoTransicao } from "@/components/IlustracaoTransicao";
import { Marca } from "@/components/Marca";
import { Aviso } from "@/components/ui";
import { obterSessao } from "@/server/auth/sessao";
import { modoDemonstracao } from "@/server/demonstracao";
import { ContasDemonstracao } from "./ContasDemonstracao";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar" };

const MENSAGENS: Record<string, { tom: "info" | "warn"; texto: string }> = {
  inatividade: { tom: "info", texto: "Sua sessão foi encerrada após um período sem uso. Entre novamente para continuar." },
  duracao_maxima: { tom: "info", texto: "Por segurança, sessões têm duração máxima. Entre novamente para continuar." },
  encerrada: { tom: "info", texto: "Você saiu da sua conta." },
  senha_redefinida: { tom: "info", texto: "Senha alterada. Entre com a nova senha." },
  ativada: { tom: "info", texto: "Conta ativada. Entre para ver suas orientações." },
  demo_indisponivel: { tom: "warn", texto: "A conta de demonstração está indisponível agora. Tente de novo em instantes." },
};

const DESTAQUES = [
  { cor: "bg-vivo-teal", titulo: "O que fazer hoje", texto: "Remédios na hora certa, com a próxima ação em destaque." },
  { cor: "bg-vivo-sun", titulo: "Revisado pela equipe", texto: "Cada orientação mostra a versão, a data e quem revisou." },
  { cor: "bg-vivo-coral", titulo: "Quando procurar ajuda", texto: "Contatos e orientações de urgência sempre visíveis." },
];

export default async function Page(props: PageProps<"/entrar">) {
  const sessao = await obterSessao();
  if (!("motivo" in sessao)) redirect("/inicio");

  const { motivo } = await props.searchParams;
  // Só chaves próprias do mapa (evita ?motivo=__proto__ e afins).
  const mensagem = typeof motivo === "string" && Object.hasOwn(MENSAGENS, motivo) ? MENSAGENS[motivo] : undefined;

  return (
    <div className="fundo-aurora grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Marca />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Bem-vindo <span className="texto-vivo">de volta.</span>
          </h1>
          <p className="mt-3 text-lg text-muted">Acesse suas orientações de alta ou a área da equipe.</p>

          {mensagem && (
            <div className="mt-6">
              <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>
            </div>
          )}

          {modoDemonstracao() && (
            <div className="mt-8">
              <ContasDemonstracao />
            </div>
          )}

          <div className="mt-8">
            <FormEntrar esconderRecuperacao={modoDemonstracao()} />
          </div>

          <div className="mt-10 space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-suave">
            <p>
              <strong>Primeiro acesso?</strong> Use o QR code que a equipe entregou na sua alta. Ele leva à ativação da conta.
            </p>
            <p>
              <Link href="/demo" className="font-bold text-primary underline underline-offset-4">
                Ver a demonstração sem entrar
              </Link>{" "}
              <span className="text-muted">(paciente fictício, sem conta)</span>
            </p>
          </div>
        </main>
      </div>

      <aside aria-label="Sobre o Alta Clara" className="painel-vivo hidden flex-col justify-between gap-6 p-10 lg:sticky lg:top-4 lg:m-4 lg:flex lg:h-[calc(100vh-4.5rem)] lg:rounded-[2.5rem] xl:p-12">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Alta hospitalar sem dúvidas</p>
          <p className="titulo mt-3 max-w-lg text-4xl font-extrabold leading-tight text-white">Do hospital para casa, com a equipe sempre por perto.</p>
        </div>
        <IlustracaoTransicao className="flutuar-lento max-h-[42vh]" />
        <ul className="grid grid-cols-3 gap-4">
          {DESTAQUES.map((d) => (
            <li key={d.titulo} className="vidro rounded-2xl p-4 text-white">
              <span className={`grid size-8 place-items-center rounded-xl text-indigo ${d.cor}`}>
                <IconeCheck tamanho={16} />
              </span>
              <p className="mt-3 font-bold">{d.titulo}</p>
              <p className="mt-1 text-sm text-white/80">{d.texto}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
