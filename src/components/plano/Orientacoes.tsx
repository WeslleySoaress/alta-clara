import { IconeAlerta, IconeSirene, IconeTelefone } from "@/components/Icones";
import type { ConteudoPlano, NivelSinal } from "@/server/dominio/conteudo";

export const telLink = (telefone: string) => `tel:${telefone.replace(/\D/g, "")}`;

// Seção 10 do documento de requisitos: três grupos, nenhum deles afirma
// ausência de risco; "previsto" usa azul informativo, nunca verde ou "normal".
const GRUPOS: { nivel: NivelSinal; titulo: string; classes: string; icone: React.ReactNode }[] = [
  {
    nivel: "urgencia",
    titulo: "Procure atendimento de urgência conforme a orientação recebida",
    classes: "border-danger bg-danger-soft text-danger",
    icone: <IconeSirene tamanho={28} />,
  },
  {
    nivel: "contato",
    titulo: "Entre em contato com a unidade",
    classes: "border-warn bg-warn-soft text-warn",
    icone: <IconeAlerta tamanho={28} />,
  },
  {
    nivel: "previsto",
    titulo: "Cuidados previstos no seu plano",
    classes: "border-info bg-info-soft text-info",
    icone: <IconeAlerta tamanho={28} />,
  },
];

export function Orientacoes({ conteudo }: { conteudo: ConteudoPlano }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl border-2 border-line bg-surface p-4 font-semibold">
        Se um sintoma não aparece nesta lista, isso não quer dizer que está tudo bem. Em caso de dúvida ou piora,
        ligue para a unidade. Em emergência, ligue 192 (SAMU).
      </p>
      {GRUPOS.map((g) => {
        const sinais = conteudo.sinais.filter((s) => s.nivel === g.nivel);
        if (!sinais.length) return null;
        return (
          <section key={g.nivel} aria-label={g.titulo} className={`rounded-3xl border-2 p-5 shadow-suave ${g.classes}`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0">{g.icone}</span>
              <h3 className="text-xl font-extrabold">{g.titulo}</h3>
            </div>
            <ul className="mt-4 space-y-2 text-ink">
              {sinais.map((s) => (
                <li key={s.texto} className="rounded-xl bg-surface px-4 py-3 text-lg">
                  {s.texto}
                </li>
              ))}
            </ul>
            {g.nivel === "urgencia" && (
              <a
                href="tel:192"
                className="no-print mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-danger text-lg font-bold text-surface"
              >
                <IconeTelefone tamanho={22} />
                Ligar 192 (SAMU)
              </a>
            )}
            {g.nivel === "contato" && (
              <div className="mt-4">
                <a
                  href={telLink(conteudo.contato.telefone)}
                  className="no-print inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-warn text-lg font-bold text-surface"
                >
                  <IconeTelefone tamanho={22} />
                  Ligar {conteudo.contato.telefone}
                </a>
                <p className="mt-2 text-ink">
                  {conteudo.contato.unidade} · Atendimento: {conteudo.contato.horarioAtendimento}
                </p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
