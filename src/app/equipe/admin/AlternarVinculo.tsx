"use client";

import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui";
import { alterarVinculoAcao } from "../acoes";

export function AlternarVinculo({ vinculoId, ativo, nome }: { vinculoId: string; ativo: boolean; nome: string }) {
  const router = useRouter();
  return (
    <span className="flex flex-wrap items-center gap-3">
      <span className={ativo ? "font-semibold text-primary" : "text-muted"}>{ativo ? "Ativo" : "Desativado"}</span>
      <Botao
        variante={ativo ? "perigo" : "secundario"}
        onClick={async () => {
          if (ativo && !window.confirm(`Desativar o vínculo de ${nome}? As sessões abertas serão encerradas agora.`)) return;
          const r = await alterarVinculoAcao(vinculoId, !ativo);
          if (r.ok) router.refresh();
          else window.alert(r.erro);
        }}
      >
        {ativo ? "Desativar" : "Reativar"}
      </Botao>
    </span>
  );
}
