"use client";

import { useState } from "react";
import { sugerirSimplificacaoAcao } from "../../acoes";

type Estado =
  | { tipo: "parado" }
  | { tipo: "carregando" }
  | { tipo: "erro"; texto: string }
  | { tipo: "sugestao"; texto: string; pontos: string[] };

/** Sugestão de linguagem simples. Nada muda sem o profissional aceitar. */
export function SimplificarIA({ texto, disponivel, onAceitar }: { texto: string; disponivel: boolean; onAceitar: (novo: string) => void }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });

  if (!disponivel) {
    return (
      <p className="text-sm text-muted" title="Configure ANTHROPIC_API_KEY e ALTA_IA_HABILITADA=1 para habilitar.">
        Simplificação por IA indisponível neste ambiente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={estado.tipo === "carregando" || texto.trim().length < 10}
        onClick={async () => {
          setEstado({ tipo: "carregando" });
          const r = await sugerirSimplificacaoAcao(texto).catch(() => ({ estado: "recusada" as const, motivo: "Falha de comunicação." }));
          if (r.estado === "ok") setEstado({ tipo: "sugestao", texto: r.sugestao.texto_simplificado, pontos: r.sugestao.pontos_de_atencao });
          else setEstado({ tipo: "erro", texto: r.estado === "indisponivel" ? "IA indisponível." : r.motivo });
        }}
        className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline disabled:opacity-50"
      >
        {estado.tipo === "carregando" ? "Gerando sugestão…" : "Sugerir linguagem mais simples (IA)"}
      </button>
      {estado.tipo === "erro" && <p className="text-sm font-semibold text-warn">{estado.texto}</p>}
      {estado.tipo === "sugestao" && (
        <div className="rounded-xl border-2 border-info bg-info-soft p-3 text-ink">
          <p className="text-sm font-bold">Rascunho gerado por IA — revise antes de usar</p>
          <p className="mt-1">{estado.texto}</p>
          {estado.pontos.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm">
              {estado.pontos.map((p) => (
                <li key={p}>Conferir: {p}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="min-h-11 rounded-lg bg-primary px-3 text-sm font-bold text-primary-ink"
              onClick={() => {
                onAceitar(estado.texto);
                setEstado({ tipo: "parado" });
              }}
            >
              Usar este texto
            </button>
            <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold underline" onClick={() => setEstado({ tipo: "parado" })}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
