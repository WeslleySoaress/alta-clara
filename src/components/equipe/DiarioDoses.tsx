import { formatarDataHora, formatarHora } from "@/lib/datas";
import type { ResumoItem } from "@/server/dominio/diario";

const ROTULO = { relatou_tomada: "Relatou que tomou", nao_tomou: "Não tomou", duvida: "Dúvida" } as const;

/** Resumo do que paciente/cuidador relataram — não comprova ingestão. */
export function DiarioDoses({
  resumo,
  recentes,
}: {
  resumo: ResumoItem[];
  recentes: { nome: string; data: string; horario: string; situacao: keyof typeof ROTULO; por: string; registradoEm: string }[];
}) {
  return (
    <section aria-labelledby="diario" className="rounded-3xl border border-line bg-surface p-6 shadow-suave">
      <h2 id="diario" className="text-xl font-extrabold">
        Diário de doses relatadas
      </h2>
      <p className="mt-1 text-sm text-muted">
        O que paciente e cuidadores informaram no aplicativo. Registro não comprova que o remédio foi tomado; use para conversar
        com o paciente.
      </p>
      {resumo.length === 0 ? (
        <p className="mt-3 text-muted">Sem medicamentos neste plano.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Resumo por medicamento</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="p-2">Medicamento</th>
                <th scope="col" className="p-2">Previstas até agora</th>
                <th scope="col" className="p-2">Relatou que tomou</th>
                <th scope="col" className="p-2">Não tomou</th>
                <th scope="col" className="p-2">Dúvida</th>
                <th scope="col" className="p-2">Sem registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resumo.map((r) => (
                <tr key={r.itemId}>
                  <th scope="row" className="p-2 font-bold">
                    {r.nome}
                    {r.seNecessario && <span className="block text-xs font-normal text-muted">se necessário (só usos relatados)</span>}
                  </th>
                  <td className="p-2">{r.seNecessario ? "—" : r.previstas}</td>
                  <td className="p-2 font-semibold text-primary">{r.relatadas}</td>
                  <td className={`p-2 font-semibold ${r.naoTomadas ? "text-warn" : ""}`}>{r.naoTomadas}</td>
                  <td className={`p-2 font-semibold ${r.duvidas ? "text-info" : ""}`}>{r.duvidas}</td>
                  <td className="p-2">{r.seNecessario ? "—" : r.semRegistro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recentes.length > 0 && (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">Últimos registros ({recentes.length})</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {recentes.map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <strong>{r.nome}</strong> · dose de {r.data.split("-").reverse().join("/")} às {formatarHora(r.horario)} · {ROTULO[r.situacao]}
                </span>
                <span className="text-muted">
                  por {r.por} em {formatarDataHora(r.registradoEm)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
