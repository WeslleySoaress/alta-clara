import { IconeCaminhar, IconeChuveiro, IconeCurativo, IconeLocal, IconeTigela } from "@/components/Icones";
import { IlustracaoRemedio } from "@/components/IlustracaoRemedio";
import { periodoDoHorario, ultimoDia } from "@/lib/agenda";
import { formatarDataLonga, formatarHora } from "@/lib/datas";
import type { ConteudoPlano } from "@/server/dominio/conteudo";
import { IconePeriodo } from "./IconePeriodo";

export function ListaMedicamentos({ conteudo }: { conteudo: ConteudoPlano }) {
  if (!conteudo.medicamentos.length) {
    return <p className="rounded-3xl border border-line bg-surface p-5 shadow-suave text-muted">Nenhum medicamento neste plano.</p>;
  }
  return (
    <ul className="space-y-4">
      {conteudo.medicamentos.map((med) => {
        const fim = ultimoDia(med, conteudo);
        return (
          <li key={med.id} className="rounded-3xl border border-line bg-surface p-5 shadow-suave">
            <div className="flex items-start gap-4">
              <span className="shrink-0 rounded-xl bg-bg p-1">
                <IlustracaoRemedio apresentacao={med.apresentacao} tamanho={52} />
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold">{med.nome}</h3>
                <p className="text-muted">{med.finalidade}</p>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Item rotulo="Dose">{med.dose}</Item>
              <Item rotulo="Como usar">{med.via}</Item>
              <Item rotulo="Horários" largo>
                {med.seNecessario ? (
                  <span>
                    <strong>Somente se necessário:</strong> {med.seNecessario.quando}. Intervalo mínimo de{" "}
                    {med.seNecessario.intervaloMinimoHoras} horas entre doses; no máximo {med.seNecessario.maximoPorDia}{" "}
                    por dia.
                  </span>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {med.horarios.map((h) => (
                      <li key={h} className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 font-bold text-primary">
                        <IconePeriodo periodo={periodoDoHorario(h)} tamanho={20} />
                        {formatarHora(h)}
                      </li>
                    ))}
                  </ul>
                )}
              </Item>
              <Item rotulo="Por quanto tempo" largo>
                <span className="first-letter:uppercase">
                  {fim ? `Até ${formatarDataLonga(fim)} (${med.duracaoDias} dias)` : "Uso contínuo, até nova orientação"}
                </span>
              </Item>
            </dl>

            {med.observacao && <p className="mt-4 rounded-xl bg-info-soft p-3 font-semibold text-ink">{med.observacao}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Item({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-semibold text-muted">{rotulo}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  );
}

const ICONES = {
  ferida: <IconeCurativo tamanho={26} />,
  banho: <IconeChuveiro tamanho={26} />,
  alimentacao: <IconeTigela tamanho={26} />,
  atividade: <IconeCaminhar tamanho={26} />,
  outro: <IconeLocal tamanho={26} />,
};

export function ListaCuidados({ conteudo }: { conteudo: ConteudoPlano }) {
  return (
    <ul className="grid gap-4">
      {conteudo.cuidados.map((c) => (
        <li key={c.titulo} className="flex gap-4 rounded-3xl border border-line bg-surface p-5 shadow-suave">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">{ICONES[c.categoria]}</span>
          <div>
            <h3 className="text-lg font-bold">{c.titulo}</h3>
            <p className="mt-1">{c.texto}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Retornos({ conteudo }: { conteudo: ConteudoPlano }) {
  if (!conteudo.retornos.length) return <p className="text-muted">Nenhum retorno previsto neste plano.</p>;
  return (
    <ul className="space-y-4">
      {conteudo.retornos.map((r, i) => {
        const [data, hora] = r.dataHora?.split("T") ?? [];
        return (
          <li key={i} className="rounded-3xl border border-line bg-surface p-5 shadow-suave">
            {r.dataHora ? (
              <>
                <p className="text-2xl font-extrabold first-letter:uppercase">{formatarDataLonga(data)}</p>
                <p className="text-xl font-bold text-primary">às {formatarHora(hora)}</p>
              </>
            ) : (
              <p className="rounded-xl bg-warn-soft p-3 font-bold text-warn">
                Ainda não agendado. Se ninguém entrar em contato em até 2 dias úteis, ligue para a unidade.
              </p>
            )}
            <p className="mt-3 flex items-start gap-2">
              <IconeLocal tamanho={22} className="mt-0.5 shrink-0 text-muted" />
              {r.local}
            </p>
            {r.levar.length > 0 && (
              <>
                <h3 className="mt-4 font-bold">O que levar</h3>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {r.levar.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
