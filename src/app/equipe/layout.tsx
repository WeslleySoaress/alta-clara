import Link from "next/link";
import { Marca } from "@/components/Marca";
import { exigirProfissional } from "@/server/auth/sessao";
import { listarPendencias } from "@/server/dominio/pendencias";
import { sair } from "../entrar/acoes";
import { AvisoSessao } from "./AvisoSessao";

const ROTULO_PAPEL = { enfermagem: "Enfermagem", revisor: "Revisor clínico", admin: "Administração", auditor: "Auditoria" } as const;

export default async function Layout({ children }: LayoutProps<"/equipe">) {
  const { nome, ator, expiraEm, fimAbsoluto } = await exigirProfissional();
  const abertas = (await listarPendencias(ator)).length;
  const papeis = [...new Set(ator.vinculos.map((v) => ROTULO_PAPEL[v.papel]))].join(", ");

  return (
    <div className="flex flex-1 flex-col">
      <AvisoSessao expiraEmInicial={expiraEm} fimAbsoluto={fimAbsoluto} />
      <header className="relative border-b border-line bg-surface shadow-suave after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-linear-to-r after:from-vivo-teal after:via-vivo-violet after:to-vivo-coral">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Marca href="/equipe" compacta />
          <nav aria-label="Área da equipe" className="flex flex-wrap items-center gap-1">
            <Link href="/equipe" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-bg">
              Atendimentos
            </Link>
            <Link href="/equipe/pendencias" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold hover:bg-bg">
              Pendências
              {abertas > 0 && (
                <span className="rounded-full bg-warn-soft px-2 text-sm text-warn" aria-label={`${abertas} abertas`}>
                  {abertas}
                </span>
              )}
            </Link>
            {ator.vinculos.some((v) => v.papel === "admin") && (
              <Link href="/equipe/admin" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-bg">
                Equipe
              </Link>
            )}
            {ator.vinculos.some((v) => v.papel === "admin" || v.papel === "auditor") && (
              <Link href="/equipe/auditoria" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-bg">
                Auditoria
              </Link>
            )}
            {(ator.pacientesProprios.length > 0 || ator.cuidadorDe.length > 0) && (
              <Link href="/paciente" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-bg">
                Minhas orientações
              </Link>
            )}
            <Link href="/conta/seguranca" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-bg">
              Segurança
            </Link>
            <span className="px-3 text-sm text-muted">
              {nome} · {papeis}
            </span>
            <form action={sair}>
              <button className="min-h-11 rounded-xl px-3 font-semibold text-primary underline">Sair</button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
