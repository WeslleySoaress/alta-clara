import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marca } from "@/components/Marca";
import { exigirSessao } from "@/server/auth/sessao";
import { lerQuestionario } from "@/server/dominio/entendimento";
import { Questionario } from "./Questionario";

export const metadata: Metadata = { title: "Confirme que entendeu", robots: { index: false, follow: false } };

export default async function Page(props: PageProps<"/paciente/planos/[id]/entendimento">) {
  const { ator } = await exigirSessao();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const q = await lerQuestionario(ator, id);
  if (!q) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Marca href="/paciente" compacta />
        <Link href={`/paciente/planos/${id}`} className="min-h-11 content-center font-semibold text-primary underline">
          Voltar ao plano
        </Link>
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">Confirme que entendeu</h1>
      <p className="mt-2 text-muted">
        Não é uma prova. As perguntas usam as orientações do seu próprio plano. Se algo ficar confuso, a equipe recebe um
        aviso para reforçar com você.
      </p>
      {q.perguntas.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5">Este plano ainda não tem perguntas de confirmação.</p>
      ) : (
        <Questionario planoId={id} perguntas={q.perguntas} />
      )}
    </main>
  );
}
