import Link from "next/link";

/** Símbolo original: o arco de uma porta de hospital que vira o telhado de uma casa, com um coração-cruz. */
export function Simbolo({ tamanho = 40 }: { tamanho?: number }) {
  // Id fixo: o gradiente é idêntico em todas as instâncias da página.
  const id = "alta-clara-simbolo";
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#19d3c0" />
          <stop offset="0.55" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff7a59" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id}-g)`} />
      <path d="M9 20.5 20 11l11 9.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 19v11h14V19" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 21.5v5.5M17.25 24.25h5.5" stroke="#ffc93c" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function Marca({ href = "/", compacta = false, clara = false }: { href?: string; compacta?: boolean; clara?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3 rounded-xl">
      <Simbolo />
      <span className="leading-tight">
        <span className={`titulo block text-xl font-extrabold ${clara ? "text-white" : ""}`}>Alta Clara</span>
        {!compacta && <span className={`block text-sm ${clara ? "text-white/80" : "text-muted"}`}>Seu cuidado continua em casa</span>}
      </span>
    </Link>
  );
}
