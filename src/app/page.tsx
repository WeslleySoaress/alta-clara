import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconeAlerta,
  IconeCalendario,
  IconeCaminhar,
  IconeCheck,
  IconeOk,
  IconeOuvir,
  IconeSol,
} from "@/components/Icones";
import { Marca } from "@/components/Marca";
import { PreviaCelular } from "@/components/PreviaCelular";
import { Azulejo, classesBotao } from "@/components/ui";

const PASSOS = [
  { n: "1", cor: "bg-vivo-teal", titulo: "A equipe prepara", texto: "Enfermagem parte de um modelo e transcreve a prescrição revisada em um formulário rápido." },
  { n: "2", cor: "bg-vivo-sun", titulo: "Outra pessoa revisa", texto: "Um revisor clínico confere a prévia e publica. Quem escreve não aprova a própria versão." },
  { n: "3", cor: "bg-vivo-coral", titulo: "O cuidado segue em casa", texto: "Paciente e cuidador recebem o plano pelo QR code, com lembretes e um canal para dúvidas." },
];

const RECURSOS: { cor: "teal" | "violet" | "coral" | "sun" | "info"; icone: ReactNode; titulo: string; texto: string }[] = [
  { cor: "sun", icone: <IconeSol tamanho={26} />, titulo: "Próxima ação em destaque", texto: "Horários exatos, com sol, prato e lua como apoio. Um toque registra o que foi feito." },
  { cor: "coral", icone: <IconeAlerta tamanho={26} />, titulo: "Quando procurar ajuda", texto: "Três grupos definidos pela equipe, sempre visíveis, sem falsa tranquilização." },
  { cor: "violet", icone: <IconeCaminhar tamanho={26} />, titulo: "Círculo de cuidado", texto: "Cuidadores com conta própria, escopo e validade. O paciente encerra o acesso quando quiser." },
  { cor: "teal", icone: <IconeOk tamanho={26} />, titulo: "Confirme que entendeu", texto: "Perguntas geradas do próprio plano. O que ficou confuso vira tarefa para a equipe." },
  { cor: "info", icone: <IconeCalendario tamanho={26} />, titulo: "O que mudou na minha alta", texto: "Cada versão mostra o antes e o depois, quem revisou e por quê." },
  { cor: "sun", icone: <IconeOuvir tamanho={26} />, titulo: "Para todo mundo ler", texto: "Leitura em voz alta, letra maior, alto contraste e impressão legível." },
];

const SEGURANCA = [
  "Passkeys e verificação em duas etapas",
  "QR code que não abre dados clínicos",
  "Cada versão com autor e revisor",
  "Auditoria sem conteúdo clínico",
  "Sem rastreadores nas páginas do paciente",
  "Lembretes discretos, sem nome de remédio",
];

export default function Home() {
  return (
    <div className="fundo-aurora flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Marca />
        <nav aria-label="Página inicial" className="flex items-center gap-2">
          <a href="#como-funciona" className="hidden min-h-11 items-center rounded-xl px-3 font-semibold text-muted hover:text-ink md:inline-flex">
            Como funciona
          </a>
          <a href="#recursos" className="hidden min-h-11 items-center rounded-xl px-3 font-semibold text-muted hover:text-ink md:inline-flex">
            Recursos
          </a>
          <Link href="/entrar" className={classesBotao("secundario", "min-h-11 px-5")}>
            Entrar
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        {/* Herói */}
        <section aria-labelledby="titulo-heroi" className="painel-vivo rounded-[2.5rem] px-6 py-12 sm:px-12 lg:py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="surgir">
              <p className="vidro inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white">
                <span aria-hidden="true" className="size-2 rounded-full bg-vivo-teal" />
                Alta hospitalar para paciente, cuidador e equipe
              </p>
              <h1 id="titulo-heroi" className="mt-6 text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
                Seu cuidado continua <span className="text-[#ffd166]">em casa.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/85 sm:text-xl">
                A equipe organiza e revisa a alta em minutos. Em casa, o paciente sabe o que fazer hoje, quando tomar cada
                remédio e quando procurar ajuda — e quem cuida dele também.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/demo" className={classesBotao("vivo", "min-h-14 px-7 text-lg")}>
                  Ver demonstração
                </Link>
                <Link href="/entrar" className="inline-flex min-h-14 items-center rounded-2xl border-2 border-white/60 px-7 text-lg font-bold text-white transition hover:bg-white/10">
                  Entrar
                </Link>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/85">
                {["Revisado por profissional", "Leitura em voz alta", "Funciona no celular"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-vivo-teal text-indigo">
                      <IconeCheck tamanho={13} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <PreviaCelular className="surgir" />
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" aria-labelledby="titulo-como" className="mt-24">
          <p className="text-sm font-bold uppercase tracking-widest text-violet">Como funciona</p>
          <h2 id="titulo-como" className="mt-2 max-w-2xl text-4xl font-extrabold sm:text-5xl">
            Do leito para casa, <span className="texto-vivo">sem perder nada pelo caminho.</span>
          </h2>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
            <span aria-hidden="true" className="absolute left-8 right-8 top-8 hidden h-1 rounded-full bg-linear-to-r from-vivo-teal via-vivo-violet to-vivo-coral md:block" />
            {PASSOS.map((p) => (
              <li key={p.n} className="relative rounded-3xl border border-line bg-surface p-6 shadow-suave">
                <span className={`titulo relative grid size-16 place-items-center rounded-2xl text-2xl font-extrabold text-indigo shadow-forte ${p.cor}`}>{p.n}</span>
                <h3 className="mt-5 text-2xl font-extrabold">{p.titulo}</h3>
                <p className="mt-2 text-muted">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Recursos */}
        <section id="recursos" aria-labelledby="titulo-recursos" className="mt-24">
          <p className="text-sm font-bold uppercase tracking-widest text-coral">Recursos</p>
          <h2 id="titulo-recursos" className="mt-2 max-w-2xl text-4xl font-extrabold sm:text-5xl">
            Pensado para quem acabou de sair do hospital.
          </h2>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <li key={r.titulo} className="group rounded-3xl border border-line bg-surface p-6 shadow-suave transition hover:-translate-y-1 hover:shadow-forte">
                <Azulejo cor={r.cor}>{r.icone}</Azulejo>
                <h3 className="mt-5 text-xl font-extrabold">{r.titulo}</h3>
                <p className="mt-2 text-muted">{r.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Segurança */}
        <section aria-labelledby="titulo-seguranca" className="painel-vivo mt-24 rounded-[2.5rem] px-6 py-12 sm:px-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Privacidade e segurança</p>
              <h2 id="titulo-seguranca" className="mt-2 text-4xl font-extrabold sm:text-5xl">Dado de saúde é sério.</h2>
              <p className="mt-4 text-lg text-white/85">
                Cada acesso é verificado no servidor, para cada pessoa e cada plano. O que foi testado — e o que ainda não foi — está
                documentado no projeto.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SEGURANCA.map((s) => (
                <li key={s} className="vidro flex items-start gap-3 rounded-2xl p-4 font-semibold text-white">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-vivo-teal text-indigo">
                    <IconeCheck tamanho={14} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-16 rounded-3xl border border-warn/40 bg-warn-soft p-5 text-ink">
          <strong>Projeto de portfólio.</strong> Todo o conteúdo é sintético. O Alta Clara não foi validado para uso clínico e não
          deve receber dados reais de saúde.
        </p>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Marca compacta />
          <p>Dados fictícios · Criado por Weslley Soares</p>
        </div>
      </footer>
    </div>
  );
}
