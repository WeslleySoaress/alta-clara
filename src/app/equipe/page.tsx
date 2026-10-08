import type { Metadata } from "next";
import Link from "next/link";
import { formatarData, StatusPlano } from "@/components/equipe/Status";
import { exigirProfissional } from "@/server/auth/sessao";
import { listarAtendimentosDoProfissional } from "@/server/dominio/planos";

export const metadata: Metadata = { title: "Atendimentos" };

export default async function Page() {
  const { ator } = await exigirProfissional();
  const atendimentos = await listarAtendimentosDoProfissional(ator);
  const semAcessoClinico = ator.vinculos.every((v) => v.papel === "admin" || v.papel === "auditor");

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Atendimentos</h1>
      <p className="mt-1 text-muted">Pacientes com alta em preparo ou publicada, conforme seu vínculo assistencial.</p>

      {semAcessoClinico ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5">
          Seu perfil (administração ou auditoria) não tem acesso a conteúdo clínico por padrão.
        </p>
      ) : atendimentos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5">Nenhum atendimento vinculado a você.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Atendimentos disponíveis</caption>
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="p-4">Paciente</th>
                <th scope="col" className="p-4">Prontuário</th>
                <th scope="col" className="p-4">Procedimento</th>
                <th scope="col" className="p-4">Plano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {atendimentos.map((a) => {
                const ultimo = a.planos.at(-1);
                return (
                  <tr key={a.atendimentoId}>
                    <td className="p-4">
                      <Link href={`/equipe/atendimentos/${a.atendimentoId}`} className="font-bold text-primary underline underline-offset-4">
                        {a.pacienteNome}
                      </Link>
                      <span className="block text-sm text-muted">Nasc. {formatarData(a.pacienteNascimento)}</span>
                    </td>
                    <td className="p-4 font-mono">{a.prontuario}</td>
                    <td className="p-4">
                      {a.procedimento}
                      <span className="block text-sm text-muted">{a.instituicao}</span>
                    </td>
                    <td className="p-4">
                      {ultimo ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPlano status={ultimo.status} /> <span className="text-sm text-muted">v{ultimo.versao}</span>
                        </span>
                      ) : (
                        <span className="text-muted">Sem plano</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
