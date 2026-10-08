"use client";

import { useSyncExternalStore } from "react";

const INTERVALO_MS = 30_000;

function assinar(avisar: () => void) {
  const id = setInterval(avisar, INTERVALO_MS);
  return () => clearInterval(id);
}

// Arredondado ao intervalo para o valor ser estável entre leituras.
const lerAgora = () => Math.floor(Date.now() / INTERVALO_MS) * INTERVALO_MS;

/**
 * Hora atual, atualizada a cada 30 s. É null durante a renderização no
 * servidor, porque o horário que importa é o do celular do paciente.
 */
export function useAgora(): Date | null {
  const ms = useSyncExternalStore(assinar, lerAgora, () => null);
  return ms === null ? null : new Date(ms);
}
