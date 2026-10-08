"use client";

import { useState } from "react";
import { definirLembretesAcao } from "./acoes";

export function PreferenciaLembretes({ ativoInicial, email }: { ativoInicial: boolean; email: string }) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [ocupado, setOcupado] = useState(false);

  return (
    <section aria-labelledby="lembretes-titulo" className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <h2 id="lembretes-titulo" className="text-xl font-extrabold">
        Lembretes por e-mail
      </h2>
      <p className="mt-1 text-muted">
        Enviamos um aviso discreto para {email} nos horários planejados (sem nome de remédio). Lembretes podem atrasar ou não
        chegar — por falta de rede, filtros de e-mail ou modo econômico do celular. Não confie só neles.
      </p>
      <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          aria-checked={ativo}
          checked={ativo}
          disabled={ocupado}
          onChange={async (e) => {
            const novo = e.target.checked;
            setOcupado(true);
            const r = await definirLembretesAcao(novo).catch(() => ({ ok: false as const }));
            setOcupado(false);
            if (r.ok) setAtivo(novo);
          }}
          className="size-6"
        />
        <span className="font-semibold">{ativo ? "Lembretes ligados" : "Lembretes desligados"}</span>
      </label>
    </section>
  );
}
