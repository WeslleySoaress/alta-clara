"use client";

import { IconeOuvir, IconeParar } from "@/components/Icones";

export function BotaoOuvir({
  id,
  texto,
  fala,
}: {
  id: string;
  texto: string;
  fala: { suportado: boolean; falando: string | null; alternar: (id: string, texto: string) => void };
}) {
  if (!fala.suportado) return null;
  const ativo = fala.falando === id;

  return (
    <button
      type="button"
      onClick={() => fala.alternar(id, texto)}
      aria-pressed={ativo}
      className="no-print inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-primary hover:bg-primary-soft aria-pressed:bg-primary aria-pressed:text-primary-ink"
    >
      {ativo ? <IconeParar tamanho={18} /> : <IconeOuvir tamanho={18} />}
      {ativo ? "Parar" : "Ouvir"}
    </button>
  );
}
