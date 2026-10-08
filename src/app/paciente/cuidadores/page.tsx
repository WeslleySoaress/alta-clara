import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/Marca";
import { exigirSessao } from "@/server/auth/sessao";
import { listarCuidadores, pacientesDoTitular } from "@/server/dominio/cuidadores";
import { GestaoCuidadores } from "./GestaoCuidadores";

export const metadata: Metadata = { title: "Quem me ajuda" };

export default async function Page() {
  const { ator } = await exigirSessao();
  const pacientes = await pacientesDoTitular(ator);
  const listas = await Promise.all(pacientes.map(async (p) => ({ ...p, ...(await listarCuidadores(ator, p.id)) })));

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Marca href="/paciente" compacta />
        <Link href="/paciente" className="min-h-11 content-center font-semibold text-primary underline">
          Voltar
        </Link>
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">Quem me ajuda</h1>
      <p className="mt-2 text-muted">
        Convide alguém de confiança para acompanhar suas orientações. Cada pessoa usa a própria conta — nunca compartilhe a
        sua senha. Você escolhe o que ela pode fazer e pode encerrar o acesso a qualquer momento.
      </p>

      {listas.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5">Somente o próprio paciente pode convidar cuidadores.</p>
      ) : (
        listas.map((l) => (
          <GestaoCuidadores
            key={l.id}
            pacienteId={l.id}
            instituicao={l.instituicao}
            mostrarInstituicao={listas.length > 1}
            ativos={l.ativos.map((a) => ({ ...a, desde: a.desde.toISOString(), expiraEm: a.expiraEm?.toISOString() ?? null }))}
            pendentes={l.pendentes.map((p) => ({ ...p, expiraEm: p.expiraEm.toISOString() }))}
          />
        ))
      )}
    </div>
  );
}
