import type { apresentacoes } from "@/server/dominio/conteudo";

type Apresentacao = (typeof apresentacoes)[number];

// Ícones genéricos da FORMA do medicamento (cápsula, comprimido...). Não
// imitam embalagens nem cores de produtos reais e não servem para identificar
// o medicamento: a identificação é sempre o nome e a dose prescritos.
export function IlustracaoRemedio({ apresentacao, tamanho = 56 }: { apresentacao: Apresentacao; tamanho?: number }) {
  const contorno = "var(--ink)";
  const preenchimento = "var(--primary-soft)";

  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true">
      {apresentacao === "capsula" && (
        <g transform="rotate(-35 32 32)">
          <rect x="10" y="22" width="44" height="20" rx="10" fill="var(--surface)" stroke={contorno} strokeWidth="2.5" />
          <path d="M32 22h12a10 10 0 0 1 0 20H32z" fill={preenchimento} stroke={contorno} strokeWidth="2.5" />
        </g>
      )}
      {apresentacao === "comprimido" && (
        <g>
          <circle cx="32" cy="32" r="20" fill={preenchimento} stroke={contorno} strokeWidth="2.5" />
          <path d="M18 32h28" stroke={contorno} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {apresentacao === "liquido" && (
        <g>
          <rect x="24" y="6" width="16" height="8" rx="2" fill="var(--surface)" stroke={contorno} strokeWidth="2.5" />
          <path d="M20 18h24v36a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="var(--surface)" stroke={contorno} strokeWidth="2.5" />
          <path d="M21.5 34h21v20a2.5 2.5 0 0 1-2.5 2.5H24a2.5 2.5 0 0 1-2.5-2.5z" fill={preenchimento} />
        </g>
      )}
      {apresentacao === "gotas" && (
        <path d="M32 8s-14 16-14 28a14 14 0 0 0 28 0C46 24 32 8 32 8z" fill={preenchimento} stroke={contorno} strokeWidth="2.5" />
      )}
      {apresentacao === "pomada" && (
        <g transform="rotate(-30 32 32)">
          <path d="M12 24h32l8 4v8l-8 4H12z" fill={preenchimento} stroke={contorno} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="52" y="28" width="6" height="8" rx="1.5" fill="var(--surface)" stroke={contorno} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}
