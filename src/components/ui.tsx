import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const BOTAO = {
  primario: "bg-primary text-primary-ink shadow-suave hover:-translate-y-0.5 hover:shadow-forte",
  secundario: "border-2 border-primary/70 bg-surface text-primary hover:border-primary hover:bg-primary-soft",
  discreto: "text-primary underline-offset-4 hover:underline",
  perigo: "bg-danger text-surface shadow-suave hover:-translate-y-0.5",
  vivo: "bg-white text-indigo shadow-forte hover:-translate-y-0.5",
} as const;

export function classesBotao(variante: keyof typeof BOTAO = "primario", extra = "") {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${BOTAO[variante]} ${extra}`;
}

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof BOTAO }) {
  return <button type="button" {...props} className={classesBotao(variante, className)} />;
}

export function Campo({
  id,
  rotulo,
  dica,
  erro,
  acessorio,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string | null;
  acessorio?: ReactNode;
}) {
  const descricao = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block font-bold">
        {rotulo}
      </label>
      {dica && (
        <p id={`${id}-dica`} className="mt-0.5 text-sm text-muted">
          {dica}
        </p>
      )}
      <div className="mt-1.5 flex items-stretch gap-2">
        <input
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          {...props}
          className="min-h-13 w-full min-w-0 rounded-2xl border-2 border-line bg-surface px-4 text-lg text-ink shadow-suave transition focus:border-violet aria-invalid:border-danger"
        />
        {acessorio}
      </div>
      {erro && (
        <p id={`${id}-erro`} className="mt-1 font-semibold text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Aviso({ tom = "info", titulo, children }: { tom?: "info" | "warn" | "danger"; titulo?: string; children: ReactNode }) {
  const cores = {
    info: "border-info/40 bg-info-soft text-info",
    warn: "border-warn/40 bg-warn-soft text-warn",
    danger: "border-danger/50 bg-danger-soft text-danger",
  }[tom];
  return (
    <div role={tom === "danger" ? "alert" : "status"} className={`rounded-2xl border p-4 ${cores}`}>
      {titulo && <p className="font-bold">{titulo}</p>}
      <div className="text-ink">{children}</div>
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-surface p-6 shadow-suave ${className}`}>{children}</div>;
}

/** Ícone dentro de um "azulejo" colorido. */
export function Azulejo({ cor, children }: { cor: "teal" | "violet" | "coral" | "sun" | "info"; children: ReactNode }) {
  const c = {
    teal: "bg-primary-soft text-primary",
    violet: "bg-violet-soft text-violet",
    coral: "bg-coral-soft text-coral",
    sun: "bg-warn-soft text-warn",
    info: "bg-info-soft text-info",
  }[cor];
  return <span className={`grid size-13 shrink-0 place-items-center rounded-2xl ${c}`}>{children}</span>;
}
