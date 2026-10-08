import { formatarDataHora } from "@/lib/datas";
import type { Metadata } from "next";
import Link from "next/link";
import { exigirProfissional } from "@/server/auth/sessao";
import { listarPendencias, ROTULO_PENDENCIA } from "@/server/dominio/pendencias";
import { ResolverPendencia } from "./ResolverPendencia";

export const metadata: Metadata = { title: "Pendências" };

// Faixa colorida por tipo, para a equipe bater o olho na fila.
const COR_TIPO: Record<keyof typeof ROTULO_PENDENCIA, { faixa: string; selo: string }> = {
  retorno_nao_agendado: { faixa: "border-l-vivo-sun", selo: "bg-warn-soft text-warn" },
  duvida_dose: { faixa: "border-l-vivo-coral", selo: "bg-coral-soft text-coral" },
  entendimento: { faixa: "border-l-vivo-violet", selo: "bg-violet-soft text-violet" },
  dificuldade_medicamento: { faixa: "border-l-vivo-coral", selo: "bg-coral-soft text-coral" },
  duvida_geral: { faixa: "border-l-vivo-teal", selo: "bg-primary-soft text-primary" },
};

export default async function Page() {
  const { ator } = await exigirProfissional();
  const pendencias = await listarPendencias(ator);

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Pendências após a alta</h1>
      <p className="mt-1 max-w-3xl text-muted">
        Tarefas operacionais geradas pelo sistema ou pedidas pelo paciente/cuidador. Não são triagem: o paciente é orientado a
        procurar urgência ou ligar para a unidade quando necessário.
      </p>
      {pendencias.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5">Nenhuma pendência aberta.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {pendencias.map((p) => (
            <li key={p.id} className={`rounded-2xl border border-l-8 border-line bg-surface p-5 shadow-suave ${COR_TIPO[p.tipo].faixa}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`rounded-full px-3 py-1 text-sm font-bold ${COR_TIPO[p.tipo].selo}`}>{ROTULO_PENDENCIA[p.tipo]}</p>
                <p className="text-sm text-muted">{formatarDataHora(p.criadoEm)}</p>
              </div>
              <p className="mt-1">
                <strong className="titulo text-lg">{p.pacienteNome}</strong> · prontuário <span className="font-mono">{p.prontuario}</span>
                {p.criadoPorNome ? ` · enviado por ${p.criadoPorNome}` : " · gerado pelo sistema"}
              </p>
              {/* Texto escrito pelo paciente: exibido como texto, nunca interpretado. */}
              <p className="mt-2 whitespace-pre-line rounded-xl bg-bg p-3">{p.descricao}</p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {p.planoId && (
                  <Link href={`/equipe/planos/${p.planoId}`} className="min-h-11 content-center font-semibold text-primary underline">
                    Abrir plano
                  </Link>
                )}
                <ResolverPendencia id={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
