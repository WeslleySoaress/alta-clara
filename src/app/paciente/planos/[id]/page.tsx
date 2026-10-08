import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marca } from "@/components/Marca";
import { VisaoPlano } from "@/components/plano/VisaoPlano";
import { exigirSessao } from "@/server/auth/sessao";
import { lerPlanoDoPaciente } from "@/server/dominio/paciente";
import { pendenciasDoPlanoParaPaciente } from "@/server/dominio/pendencias";
import { registrarDoseAcao, registrarUsoAcao } from "../../acoes";
import { PedidoAjuda } from "./PedidoAjuda";

export const metadata: Metadata = { title: "Minhas orientações", robots: { index: false, follow: false } };

export default async function Page(props: PageProps<"/paciente/planos/[id]">) {
  const { ator } = await exigirSessao();
  const { id } = await props.params;
  // Mesmo resultado para "não existe" e "não é seu" (não revela existência).
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const plano = await lerPlanoDoPaciente(ator, id);
  if (!plano) notFound();
  const pedidos = await pendenciasDoPlanoParaPaciente(plano.id, ator, ator.pacientesProprios.includes(plano.pacienteId));

  return (
    <VisaoPlano
      modo="paciente"
      registrarNoServidor={registrarDoseAcao}
      registrarUsoNoServidor={registrarUsoAcao}
      plano={{
        ...plano,
        publicadoEm: plano.publicadoEm?.toISOString() ?? null,
        revisorNome: plano.revisorNome ?? null,
      }}
      cabecalho={
        <div className="flex items-center justify-between gap-3">
          <Marca href="/paciente" compacta />
          <Link href="/paciente" className="min-h-11 content-center font-semibold text-primary underline">
            Voltar
          </Link>
        </div>
      }
      avisoTopo={
        <div className="no-print grid gap-3">
          {plano.status !== "publicado" && (
            <div role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft p-4 font-semibold text-ink">
              Esta é uma versão antiga das suas orientações e não vale mais.{" "}
              {plano.vigenteId ? (
                <Link href={`/paciente/planos/${plano.vigenteId}`} className="text-danger underline">
                  Abrir a versão atual
                </Link>
              ) : (
                "Fale com a unidade para confirmar as orientações atuais."
              )}
            </div>
          )}
          {plano.versao > 1 && (
            <Link href={`/paciente/planos/${plano.id}/mudancas`} className="block rounded-2xl border-2 border-info bg-info-soft p-4 font-semibold text-ink">
              Suas orientações foram atualizadas (versão {plano.versao}). <span className="text-info underline">Ver o que mudou</span>
            </Link>
          )}
          <Link href={`/paciente/planos/${plano.id}/entendimento`} className="block rounded-2xl border border-line bg-surface p-4 font-semibold">
            Confirme que entendeu: algumas perguntas rápidas sobre o seu plano.{" "}
            <span className="text-primary underline">Começar</span>
          </Link>
        </div>
      }
      secoesExtras={
        <PedidoAjuda
          planoId={plano.id}
          telefone={plano.conteudo.contato.telefone}
          pedidos={pedidos.map((p) => ({ ...p, criadoEm: p.criadoEm.toISOString(), resolvidaEm: p.resolvidaEm?.toISOString() ?? null }))}
        />
      }
    />
  );
}
