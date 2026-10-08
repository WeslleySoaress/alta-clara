import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconeCoracao, IconeOk } from "@/components/Icones";
import { Marca } from "@/components/Marca";
import { Azulejo } from "@/components/ui";
import { exigirSessao } from "@/server/auth/sessao";
import { ehProfissional } from "@/server/authz/politicas";
import { preferenciaDe } from "@/server/dominio/lembretes";
import { listarPlanosVigentes } from "@/server/dominio/paciente";
import { sair } from "../entrar/acoes";
import { PreferenciaLembretes } from "./PreferenciaLembretes";

export const metadata: Metadata = { title: "Minhas orientações" };

export default async function Page() {
  const { ator, nome, email } = await exigirSessao();
  // Profissional só é levado à equipe se não for também paciente ou cuidador.
  if (ehProfissional(ator) && !ator.pacientesProprios.length && !ator.cuidadorDe.length) redirect("/equipe");
  const planos = await listarPlanosVigentes(ator);
  const lembretesAtivos = await preferenciaDe(ator.userId);

  return (
    <div className="fundo-aurora flex-1">
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Marca compacta />
          <form action={sair}>
            <button className="min-h-11 rounded-xl px-3 font-semibold text-primary underline">Sair</button>
          </form>
        </div>

        <section className="painel-vivo mt-6 rounded-4xl p-6 shadow-forte">
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Seu cuidado continua em casa</p>
          <h1 className="mt-2 text-4xl font-extrabold">Olá, {nome.split(" ")[0]}</h1>
          <p className="mt-2 text-white/85">
            {planos.length ? "Escolha as orientações que deseja abrir." : "Quando a equipe publicar suas orientações, elas aparecem aqui."}
          </p>
        </section>

        {planos.length > 0 && (
          <ul className="mt-6 space-y-4">
            {planos.map((p) => (
              <li key={p.planoId}>
                <Link href={`/paciente/planos/${p.planoId}`} className="borda-viva block rounded-3xl p-5 shadow-suave transition hover:-translate-y-0.5 hover:shadow-forte">
                  <p className="text-sm font-bold uppercase tracking-wide text-violet">
                    {p.proprio ? "Minhas orientações" : `Cuidando de ${p.pacienteNome}`}
                  </p>
                  <p className="titulo mt-1 text-2xl font-extrabold">{p.procedimento}</p>
                  <p className="text-muted">
                    {p.instituicao} · versão {p.versao}
                  </p>
                  <p className="mt-3 font-bold text-primary">Abrir →</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {planos.length > 0 && <PreferenciaLembretes ativoInicial={lembretesAtivos} email={email} />}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {ator.pacientesProprios.length > 0 && (
            <li>
              <Link href="/paciente/cuidadores" className="flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-surface p-4 font-bold shadow-suave hover:border-violet">
                <Azulejo cor="violet">
                  <IconeCoracao tamanho={22} />
                </Azulejo>
                Quem me ajuda
              </Link>
            </li>
          )}
          <li>
            <Link href="/conta/seguranca" className="flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-surface p-4 font-bold shadow-suave hover:border-primary">
              <Azulejo cor="teal">
                <IconeOk tamanho={22} />
              </Azulejo>
              Segurança da conta
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
