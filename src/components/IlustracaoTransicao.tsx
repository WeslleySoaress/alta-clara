/** Ilustração original: do hospital para casa por um caminho de cuidado. Decorativa. */
export function IlustracaoTransicao({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 320" className={`h-auto w-full ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="ilus-sol" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ffc93c" />
        </linearGradient>
        <linearGradient id="ilus-hosp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6f7f5" />
        </linearGradient>
        <linearGradient id="ilus-casa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4e0" />
          <stop offset="1" stopColor="#ffe1cf" />
        </linearGradient>
        <linearGradient id="ilus-caminho" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#19d3c0" />
          <stop offset="0.5" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff7a59" />
        </linearGradient>
      </defs>

      {/* Céu: sol e nuvens */}
      <circle cx="430" cy="62" r="34" fill="url(#ilus-sol)" />
      <circle cx="430" cy="62" r="48" fill="none" stroke="#ffc93c" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="3 9" />
      <g fill="#ffffff" fillOpacity="0.85">
        <ellipse cx="120" cy="52" rx="34" ry="11" />
        <ellipse cx="146" cy="44" rx="20" ry="12" />
        <ellipse cx="300" cy="86" rx="26" ry="8" />
      </g>

      {/* Chão */}
      <ellipse cx="260" cy="292" rx="250" ry="26" fill="#19d3c0" fillOpacity="0.22" />

      {/* Hospital */}
      <g>
        <rect x="40" y="110" width="150" height="170" rx="14" fill="url(#ilus-hosp)" />
        <rect x="92" y="84" width="46" height="38" rx="10" fill="#ffffff" />
        <path d="M115 92v22M104 103h22" stroke="#ff7a59" strokeWidth="6" strokeLinecap="round" />
        {[0, 1, 2].map((l) =>
          [0, 1, 2].map((c) => (
            <rect key={`${l}${c}`} x={62 + c * 40} y={134 + l * 32} width="26" height="18" rx="5" fill={(l + c) % 3 === 0 ? "#7c5cff" : "#19d3c0"} fillOpacity={(l + c) % 2 ? 0.55 : 0.85} />
          )),
        )}
        <rect x="98" y="236" width="34" height="44" rx="8" fill="#141e55" />
        <circle cx="124" cy="258" r="2.5" fill="#ffc93c" />
      </g>

      {/* Caminho de cuidado */}
      <path d="M150 292 C 230 300, 250 220, 330 228 S 390 270, 400 270" fill="none" stroke="url(#ilus-caminho)" strokeWidth="7" strokeLinecap="round" strokeDasharray="1 16" />

      {/* Cápsula no caminho */}
      <g transform="translate(232 238) rotate(-25)">
        <rect x="-20" y="-9" width="40" height="18" rx="9" fill="#ffffff" />
        <path d="M0 -9h11a9 9 0 0 1 0 18H0z" fill="#ff7a59" />
      </g>
      {/* Coração no caminho */}
      <path d="M318 196c-6-8-20-4-18 7 2 9 18 18 18 18s16-9 18-18c2-11-12-15-18-7z" fill="#ff7a59" />

      {/* Casa */}
      <g>
        <path d="M352 182 425 120l73 62" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="368" y="176" width="114" height="104" rx="10" fill="url(#ilus-casa)" />
        <rect x="410" y="218" width="30" height="62" rx="6" fill="#7c5cff" />
        <circle cx="433" cy="250" r="2.5" fill="#ffc93c" />
        <rect x="382" y="194" width="22" height="20" rx="4" fill="#19d3c0" fillOpacity="0.8" />
        <rect x="448" y="194" width="22" height="20" rx="4" fill="#19d3c0" fillOpacity="0.8" />
        {/* Flores */}
        <g>
          <circle cx="380" cy="272" r="7" fill="#ffc93c" />
          <circle cx="470" cy="270" r="7" fill="#ff7a59" />
          <circle cx="458" cy="276" r="5" fill="#ffc93c" />
        </g>
      </g>

      {/* Sinais de "+" flutuando */}
      <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round">
        <path d="M248 120v14M241 127h14" />
        <path d="M486 150v10M481 155h10" />
        <path d="M30 70v10M25 75h10" />
      </g>
    </svg>
  );
}
