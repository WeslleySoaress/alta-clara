import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirProfissional } from "@/server/auth/sessao";
import { listarEquipe } from "@/server/dominio/instituicao";
import { AlternarVinculo } from "./AlternarVinculo";

export const metadata: Metadata = { title: "Equipe da instituição" };

const PAPEL = { enfermagem: "Enfermagem", revisor: "Revisor clínico", admin: "Administração", auditor: "Auditoria" } as const;

export default async function Page() {
  const { ator } = await exigirProfissional();
  if (!ator.vinculos.some((v) => v.papel === "admin")) notFound();
  const equipe = await listarEquipe(ator);

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Equipe da instituição</h1>
      <p className="mt-1 max-w-3xl text-muted">
        Desativar um vínculo retira o papel e encerra imediatamente todas as sessões da pessoa. Administração não dá acesso a
        conteúdo clínico. Contas novas são provisionadas pela instituição (nesta demonstração, pelo script de dados).
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left">
          <caption className="sr-only">Profissionais e papéis</caption>
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="p-4">Pessoa</th>
              <th scope="col" className="p-4">Papel</th>
              <th scope="col" className="p-4">Segundo fator</th>
              <th scope="col" className="p-4">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {equipe.map((p) => (
              <tr key={p.vinculoId}>
                <td className="p-4">
                  <span className="font-bold">{p.nome}</span>
                  <span className="block text-sm text-muted">{p.email}</span>
                </td>
                <td className="p-4">{PAPEL[p.papel]}</td>
                <td className="p-4">{p.mfa ? "Ativo" : "Pendente"}</td>
                <td className="p-4">
                  {p.userId === ator.userId ? (
                    <span className="text-muted">Você</span>
                  ) : (
                    <AlternarVinculo vinculoId={p.vinculoId} ativo={p.ativo} nome={p.nome} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
