import { formatarDataHora } from "@/lib/datas";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdentificacaoPaciente } from "@/components/equipe/IdentificacaoPaciente";
import { StatusPlano } from "@/components/equipe/Status";
import { exigirProfissional } from "@/server/auth/sessao";
import { lerAtendimento } from "@/server/dominio/planos";
import { AcoesAtendimento } from "./AcoesAtendimento";

export const metadata: Metadata = { title: "Atendimento" };

export default async function Page(props: PageProps<"/equipe/atendimentos/[id]">) {
  const { ator } = await exigirProfissional();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await lerAtendimento(ator, id);
  if (!a) notFound();

  const emEdicao = a.versoes.find((v) => v.status === "rascunho" || v.status === "em_revisao");
  const publicado = a.versoes.find((v) => v.status === "publicado");

  return (
    <div className="space-y-8">
      <Link href="/equipe" className="font-semibold text-primary underline">
        ← Atendimentos
      </Link>
      <IdentificacaoPaciente
        nome={a.pacienteNome}
        nascimento={a.pacienteNascimento}
        prontuario={a.prontuario}
        instituicao={a.instituicao}
        procedimento={a.procedimento}
      />

      <section aria-labelledby="versoes">
        <h2 id="versoes" className="text-2xl font-extrabold">
          Plano de alta
        </h2>
        {a.versoes.length === 0 ? (
          <p className="mt-2 text-muted">Ainda não há plano para este atendimento.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {a.versoes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/equipe/planos/${v.id}`} className="font-bold text-primary underline underline-offset-4">
                    Versão {v.versao}
                  </Link>
                  {v.motivoAlteracao && <span className="block text-sm text-muted">Motivo: {v.motivoAlteracao}</span>}
                  {v.publicadoEm && (
                    <span className="block text-sm text-muted">
                      Publicada em {formatarDataHora(v.publicadoEm)}
                    </span>
                  )}
                </div>
                <StatusPlano status={v.status} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {a.podeEditar && (
        <AcoesAtendimento
          atendimentoId={a.id}
          modelos={a.modelos.map((m) => ({ id: m.id, nome: `${m.nome} (v${m.versao})` }))}
          podeCriar={a.versoes.length === 0}
          podeNovaVersao={Boolean(publicado) && !emEdicao}
          podeConvidar={Boolean(publicado)}
          pacienteAtivado={a.pacienteAtivado}
        />
      )}
    </div>
  );
}
