import { formatarDataHora } from "@/lib/datas";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marca } from "@/components/Marca";
import { exigirSessao } from "@/server/auth/sessao";
import { historicoDoPlano } from "@/server/dominio/diferencas";

export const metadata: Metadata = { title: "O que mudou na minha alta", robots: { index: false, follow: false } };

const COR = { incluido: "border-primary", removido: "border-danger", alterado: "border-info" } as const;
const ROTULO = { incluido: "Incluído", removido: "Retirado", alterado: "Alterado" } as const;

export default async function Page(props: PageProps<"/paciente/planos/[id]/mudancas">) {
  const { ator } = await exigirSessao();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const historico = await historicoDoPlano(ator, id);
  if (!historico) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Marca href="/paciente" compacta />
        <Link href={`/paciente/planos/${id}`} className="min-h-11 content-center font-semibold text-primary underline">
          Voltar ao plano
        </Link>
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">O que mudou na minha alta?</h1>
      <p className="mt-2 text-muted">Cada versão foi revisada pela equipe antes de chegar até você. A mais recente vale a partir da data de publicação.</p>

      <ol className="mt-6 space-y-6">
        {[...historico].reverse().map((v) => (
          <li key={v.versao} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">
              Versão {v.versao} {v.atual && "· atual"}
            </p>
            <p className="mt-1 text-muted">
              {v.publicadoEm && `Publicada em ${formatarDataHora(v.publicadoEm)}. `}
              Preparada por {v.autor}
              {v.revisor && `, revisada por ${v.revisor}`}.
            </p>
            {v.motivo && <p className="mt-2 rounded-lg bg-bg p-2">Motivo informado pela equipe: {v.motivo}</p>}
            {v.mudancas === null ? (
              <p className="mt-3">Primeira versão das suas orientações.</p>
            ) : v.mudancas.length === 0 ? (
              <p className="mt-3">Sem diferenças no conteúdo em relação à versão anterior.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {v.mudancas.map((m, i) => (
                  <li key={i} className={`border-l-4 pl-3 ${COR[m.tipo]}`}>
                    <p className="text-sm font-bold text-muted">
                      {m.secao} · {ROTULO[m.tipo]}
                    </p>
                    <p className="font-semibold">{m.titulo}</p>
                    {m.antes && <p className="text-muted line-through decoration-1">Antes: {m.antes}</p>}
                    {m.depois && <p>Agora: {m.depois}</p>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
