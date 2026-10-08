import { formatarDataHora } from "@/lib/datas";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfissional } from "@/server/auth/sessao";
import { consultarAuditoria } from "@/server/dominio/instituicao";

export const metadata: Metadata = { title: "Auditoria" };

export default async function Page(props: PageProps<"/equipe/auditoria">) {
  const { ator } = await exigirProfissional();
  if (!ator.vinculos.some((v) => v.papel === "auditor" || v.papel === "admin")) notFound();
  const { negados } = await props.searchParams;
  const eventos = await consultarAuditoria(ator, { somenteNegados: negados === "1" });

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Trilha de auditoria</h1>
      <p className="mt-1 max-w-3xl text-muted">
        Quem fez o quê, quando e com qual resultado. Sem conteúdo clínico. Esta consulta também fica registrada. Os 200 eventos
        mais recentes.
      </p>
      <p className="mt-3 flex gap-4">
        <Link href="/equipe/auditoria" className={`font-semibold underline ${negados === "1" ? "text-primary" : ""}`}>
          Todos
        </Link>
        <Link href="/equipe/auditoria?negados=1" className={`font-semibold underline ${negados === "1" ? "" : "text-primary"}`}>
          Só acessos negados
        </Link>
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Eventos de auditoria</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="p-3">Quando</th>
              <th scope="col" className="p-3">Quem</th>
              <th scope="col" className="p-3">Ação</th>
              <th scope="col" className="p-3">Recurso</th>
              <th scope="col" className="p-3">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="p-3 whitespace-nowrap">{formatarDataHora(e.ocorridoEm, true)}</td>
                <td className="p-3">{e.ator ?? "Sistema / não autenticado"}</td>
                <td className="p-3 font-mono">{e.acao}</td>
                <td className="p-3 font-mono">{e.recursoTipo ? `${e.recursoTipo} ${e.recursoId?.slice(0, 8) ?? ""}` : "—"}</td>
                <td className={`p-3 font-semibold ${e.resultado === "negado" ? "text-danger" : ""}`}>{e.resultado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
