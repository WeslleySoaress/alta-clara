import type { Metadata } from "next";
import { Marca } from "@/components/Marca";
import { VisaoPlano } from "@/components/plano/VisaoPlano";
import { planoDemonstracao } from "@/lib/demo-plano";

export const metadata: Metadata = {
  title: "Demonstração",
  robots: { index: false, follow: false },
};

/** Demonstração pública e isolada: só conteúdo sintético, sem banco e sem conta. */
export default function Page() {
  return (
    <VisaoPlano
      plano={planoDemonstracao()}
      modo="demo"
      cabecalho={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Marca compacta />
          <span className="rounded-full bg-warn-soft px-3 py-1 text-sm font-bold text-warn">Paciente fictício</span>
        </div>
      }
    />
  );
}
