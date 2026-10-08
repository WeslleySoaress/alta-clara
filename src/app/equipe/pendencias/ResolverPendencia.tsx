"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao } from "@/components/ui";
import { resolverPendenciaAcao } from "../acoes";

export function ResolverPendencia({ id }: { id: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Registrar resolução
      </Botao>
    );
  }
  return (
    <div className="w-full max-w-lg space-y-2">
      <label htmlFor={`res-${id}`} className="block font-bold">
        O que foi feito (o paciente verá a resposta)
      </label>
      <textarea id={`res-${id}`} rows={2} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-xl border-2 border-line bg-surface p-3" />
      {erro && <p className="font-semibold text-danger">{erro}</p>}
      <div className="flex gap-2">
        <Botao
          disabled={texto.trim().length < 3}
          onClick={async () => {
            const r = await resolverPendenciaAcao(id, texto);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          }}
        >
          Concluir
        </Botao>
        <Botao variante="discreto" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
