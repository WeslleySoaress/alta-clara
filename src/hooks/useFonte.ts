"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Preferência "letra maior", salva só neste aparelho.
const CHAVE = "alta-clara:fonte";
const EVENTO = "alta-clara:fonte";
let memoria: "grande" | "normal" = "normal";

function ler(): "grande" | "normal" {
  try {
    return localStorage.getItem(CHAVE) === "grande" ? "grande" : "normal";
  } catch {
    return memoria;
  }
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useFonte() {
  const fonte = useSyncExternalStore(assinar, ler, () => "normal" as const);

  useEffect(() => {
    document.documentElement.dataset.fonte = fonte;
  }, [fonte]);

  const alternar = useCallback(() => {
    const nova = ler() === "grande" ? "normal" : "grande";
    memoria = nova;
    try {
      localStorage.setItem(CHAVE, nova);
    } catch {}
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { fonte, alternar };
}
