"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const semAssinatura = () => () => {};

/** Leitura em voz alta com a voz em português do próprio aparelho. */
export function useFala() {
  const suportado = useSyncExternalStore(
    semAssinatura,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [falando, setFalando] = useState<string | null>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const alternar = useCallback(
    (id: string, texto: string) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      if (falando === id) {
        setFalando(null);
        return;
      }
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = "pt-BR";
      fala.rate = 0.9;
      const voz = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith("pt-BR"));
      if (voz) fala.voice = voz;
      fala.onend = () => setFalando((atual) => (atual === id ? null : atual));
      fala.onerror = fala.onend;
      setFalando(id);
      synth.speak(fala);
    },
    [falando],
  );

  return { suportado, falando, alternar };
}
