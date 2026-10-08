import { CONTAS_DEMONSTRACAO } from "@/server/demonstracao";
import { entrarDemonstracao } from "./acoes";

/** Painel da demonstração pública: um clique por perfil, sem digitar senha. */
export function ContasDemonstracao() {
  return (
    <section aria-labelledby="titulo-demo" className="borda-viva rounded-3xl p-5 shadow-suave">
      <p className="text-sm font-bold uppercase tracking-widest text-violet">Demonstração pública</p>
      <h2 id="titulo-demo" className="titulo mt-1 text-2xl font-extrabold">
        Entre com um perfil fictício
      </h2>
      <p className="mt-1 text-sm text-muted">Tudo aqui é inventado e volta ao estado inicial todos os dias.</p>
      <ul className="mt-4 grid gap-2">
        {CONTAS_DEMONSTRACAO.map((c) => (
          <li key={c.email}>
            <form action={entrarDemonstracao.bind(null, c.email)}>
              <button className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-suave">
                <span>
                  <span className="block font-bold">{c.perfil}</span>
                  <span className="block text-sm text-muted">{c.descricao}</span>
                </span>
                <span aria-hidden className="shrink-0 whitespace-nowrap font-bold text-primary">
                  Entrar →
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
