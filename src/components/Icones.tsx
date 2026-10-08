import type { SVGProps } from "react";

type IconeProps = SVGProps<SVGSVGElement> & { tamanho?: number };

function Base({ tamanho = 24, children, ...props }: IconeProps) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeSol = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const IconeSolTarde = (p: IconeProps) => (
  <Base {...p}>
    <path d="M17 18a5 5 0 0 0-10 0" />
    <path d="M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1" />
  </Base>
);

export const IconePrato = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="13" r="7" />
    <circle cx="12" cy="13" r="3.5" />
    <path d="M2 4v5a2 2 0 0 0 2 2V20M22 4c-1.5 0-2.5 2-2.5 4.5S20.5 12 22 12v8" />
  </Base>
);

export const IconeLua = (p: IconeProps) => (
  <Base {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
  </Base>
);

export const IconeTelefone = (p: IconeProps) => (
  <Base {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </Base>
);

export const IconeOuvir = (p: IconeProps) => (
  <Base {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </Base>
);

export const IconeParar = (p: IconeProps) => (
  <Base {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Base>
);

export const IconeCalendario = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
  </Base>
);

export const IconeCheck = (p: IconeProps) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const IconeAlerta = (p: IconeProps) => (
  <Base {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const IconeSirene = (p: IconeProps) => (
  <Base {...p}>
    <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
    <path d="M5 21h14a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4" />
  </Base>
);

export const IconeOk = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 3 3 5-6" />
  </Base>
);

export const IconeCurativo = (p: IconeProps) => (
  <Base {...p}>
    <rect x="1.5" y="8" width="21" height="8" rx="4" transform="rotate(-45 12 12)" />
    <path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01" />
  </Base>
);

export const IconeChuveiro = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 20V7a4 4 0 0 1 4-4 4 4 0 0 1 4 4M9 7h6a3 3 0 0 0-6 0" />
    <path d="M10 12v.01M13 11v.01M16 12v.01M11 15v.01M14 15v.01M17 15v.01M12 18v.01M15 18v.01" />
  </Base>
);

export const IconeTigela = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 11h18a9 9 0 0 1-18 0zM7 21h10" />
    <path d="M9 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3" />
  </Base>
);

export const IconeCaminhar = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="13" cy="4" r="2" />
    <path d="m9 21 2-6 3 3v3M7 12l2-4 4 1 3 3h3M11 15l-1-4" />
  </Base>
);

export const IconeLocal = (p: IconeProps) => (
  <Base {...p}>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </Base>
);

export const IconePessoa = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
);

export const IconeCoracao = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 20s-7-4.5-9-9.2C1.6 7.2 4 4 7.2 4c2 0 3.4 1.1 4.8 2.8C13.4 5.1 14.8 4 16.8 4 20 4 22.4 7.2 21 10.8 19 15.5 12 20 12 20z" />
  </Base>
);

export const IconeEstetoscopio = (p: IconeProps) => (
  <Base {...p}>
    <path d="M5 3v6a5 5 0 0 0 10 0V3" />
    <path d="M10 14v2a5 5 0 0 0 10 0v-2" />
    <circle cx="20" cy="12" r="2" />
  </Base>
);

export const IconePilula = (p: IconeProps) => (
  <Base {...p}>
    <rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)" />
    <path d="m8.5 8.5 7 7" />
  </Base>
);
