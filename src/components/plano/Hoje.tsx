"use client";

import { IlustracaoRemedio } from "@/components/IlustracaoRemedio";
import {
  agoraNoFuso,
  chaveDose,
  diaDoTratamento,
  dosesDoDia,
  duracaoTotal,
  minutosAte,
  proximaDose,
  ROTULO_PERIODO,
  type Dose,
  type Periodo,
} from "@/lib/agenda";
import { diasEntre, formatarDataLonga, formatarHora, minutosDoDia } from "@/lib/datas";
import type { ConteudoPlano } from "@/server/dominio/conteudo";
import { IconePeriodo } from "./IconePeriodo";
import { avaliarUsoSeNecessario } from "@/lib/se-necessario";
import { ROTULO_SITUACAO, type ModoPlano, type Situacao } from "./tipos";

// Cor de apoio por período (o horário exato continua sendo a informação principal).
const COR_PERIODO: Record<Periodo, { borda: string; icone: string }> = {
  manha: { borda: "border-vivo-sun", icone: "bg-warn-soft text-warn" },
  almoco: { borda: "border-vivo-coral", icone: "bg-coral-soft text-coral" },
  tarde: { borda: "border-vivo-sky", icone: "bg-info-soft text-info" },
  noite: { borda: "border-vivo-violet", icone: "bg-violet-soft text-violet" },
};

function descreverEspera(minutos: number): string {
  if (minutos <= 0) return "Horário planejado agora";
  if (minutos < 60) return `Daqui a ${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `Daqui a ${h} h` : `Daqui a ${h} h ${m} min`;
}

function rotuloDia(data: string, hoje: string): string {
  const d = diasEntre(hoje, data);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  return formatarDataLonga(data).split(",")[0];
}

export function Hoje({
  conteudo,
  agora,
  registros,
  autoria,
  modo,
  podeRegistrar,
  registrar,
  registrarUso,
  pendente,
}: {
  conteudo: ConteudoPlano;
  agora: Date | null;
  registros: ReadonlyMap<string, Situacao>;
  autoria?: ReadonlyMap<string, string>;
  modo: ModoPlano;
  podeRegistrar: boolean;
  registrar: (dose: Dose, situacao: Situacao | null) => void;
  registrarUso?: (medId: string) => void;
  pendente: string | null;
}) {
  if (!agora) return <div className="h-72 animate-pulse rounded-3xl bg-surface" aria-busy="true" aria-label="Carregando" />;

  const { hoje, minutos } = agoraNoFuso(agora, conteudo.fusoHorario);
  const dia = diaDoTratamento(conteudo, hoje);
  const total = duracaoTotal(conteudo);
  const registradas = new Set(registros.keys());
  const proxima = proximaDose(conteudo, hoje, minutos, registradas);
  const doses = dosesDoDia(conteudo, hoje);
  const habilitado = podeRegistrar && modo !== "previa";

  const porPeriodo = new Map<Periodo, Dose[]>();
  for (const d of doses) porPeriodo.set(d.periodo, [...(porPeriodo.get(d.periodo) ?? []), d]);

  return (
    <div className="space-y-6">
      <p className="text-muted">
        <span className="font-semibold text-ink first-letter:uppercase">{formatarDataLonga(hoje)}</span>
        {dia >= 1 && total && dia <= total && ` · Dia ${dia} de ${total} do tratamento`}
      </p>

      {proxima ? (
        <CartaoProxima
          dose={proxima}
          minutos={minutosAte(proxima, hoje, minutos)}
          quando={rotuloDia(proxima.data, hoje)}
          habilitado={habilitado && proxima.data === hoje}
          ocupado={pendente === proxima.chave}
          onRegistrar={(s) => registrar(proxima, s)}
        />
      ) : (
        <div className="borda-viva rounded-[2rem] p-6 shadow-suave">
          <p className="text-xl font-bold">Nenhum horário de medicamento pendente.</p>
          <p className="mt-1 text-muted">Continue seguindo os cuidados abaixo.</p>
        </div>
      )}

      <UsoSeNecessario
        conteudo={conteudo}
        agora={agora}
        hoje={hoje}
        registros={registros}
        habilitado={habilitado}
        pendente={pendente}
        registrarUso={registrarUso}
        desfazer={(d) => registrar(d, null)}
      />

      {doses.length > 0 && (
        <div>
          <h3 className="mb-3 text-xl font-extrabold">Horários de hoje</h3>
          <ol className="space-y-4">
            {[...porPeriodo.entries()].map(([periodo, lista]) => (
              <li key={periodo} className={`rounded-3xl border-l-8 bg-surface p-4 shadow-suave ${COR_PERIODO[periodo].borda}`}>
                <p className="mb-2 flex items-center gap-2 font-bold">
                  <span className={`grid size-9 place-items-center rounded-xl ${COR_PERIODO[periodo].icone}`}>
                    <IconePeriodo periodo={periodo} tamanho={20} />
                  </span>
                  {ROTULO_PERIODO[periodo]}
                </p>
                <ul className="divide-y divide-line">
                  {lista.map((d) => {
                    const situacao = registros.get(d.chave);
                    return (
                      <li key={d.chave} className="flex flex-wrap items-center gap-3 py-3">
                        <span className="titulo w-12 shrink-0 text-xl font-extrabold tabular-nums">{formatarHora(d.horario)}</span>
                        <span className="hidden sm:block"><IlustracaoRemedio apresentacao={d.medicamento.apresentacao} tamanho={34} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{d.medicamento.nome}</p>
                          <p className="text-sm text-muted">
                            {d.medicamento.dose}
                            {situacao
                              ? ` · ${ROTULO_SITUACAO[situacao]}${autoria?.get(d.chave) ? ` (por ${autoria.get(d.chave)})` : ""}`
                              : minutosDoDia(d.horario) < minutos
                                ? " · sem registro"
                                : ""}
                          </p>
                        </div>
                        {habilitado && situacao && (
                          <button
                            type="button"
                            onClick={() => registrar(d, null)}
                            disabled={pendente === d.chave}
                            className="no-print min-h-11 rounded-xl px-3 text-sm font-semibold text-primary underline"
                          >
                            Desfazer
                          </button>
                        )}
                        {habilitado && !situacao && (
                          <button
                            type="button"
                            onClick={() => registrar(d, "relatou_tomada")}
                            disabled={pendente === d.chave}
                            aria-label={`Marcar ${d.medicamento.nome} das ${formatarHora(d.horario)} como tomado`}
                            className="no-print min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-ink shadow-suave"
                          >
                            Marcar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">
            O registro é o que você informa; ele ajuda a equipe, mas não confirma que o remédio foi tomado.
            {modo === "demo" && " Na demonstração, os registros somem ao recarregar a página."}
          </p>
        </div>
      )}
    </div>
  );
}

function CartaoProxima({
  dose,
  minutos,
  quando,
  habilitado,
  ocupado,
  onRegistrar,
}: {
  dose: Dose;
  minutos: number;
  quando: string;
  habilitado: boolean;
  ocupado: boolean;
  onRegistrar: (s: Situacao) => void;
}) {
  const naHora = minutos <= 0;
  const med = dose.medicamento;
  return (
    <div className="painel-vivo rounded-[2rem] p-6 shadow-forte" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#ffd166]">Próxima ação{naHora && <span className="rounded-full bg-[#ffd166] px-2 py-0.5 text-xs text-indigo">agora</span>}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="titulo text-6xl font-extrabold tabular-nums">{formatarHora(dose.horario)}</span>
        <span className="text-lg text-white/85">{quando}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-[#7ff0e2]">{descreverEspera(minutos)}</p>

      <div className="vidro mt-5 flex items-center gap-4 rounded-2xl p-4">
        <span className="shrink-0 rounded-xl bg-surface p-1">
          <IlustracaoRemedio apresentacao={med.apresentacao} tamanho={48} />
        </span>
        <div>
          <p className="text-xl font-bold">{med.nome}</p>
          <p>
            {med.dose} · {med.via}
          </p>
          {med.observacao && <p className="mt-1 text-sm text-white/85">{med.observacao}</p>}
        </div>
      </div>

      {habilitado && (
        <div className="no-print mt-5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRegistrar("relatou_tomada")}
            className="min-h-14 rounded-2xl bg-white text-lg font-bold text-indigo shadow-forte transition hover:-translate-y-0.5"
          >
            {ROTULO_SITUACAO.relatou_tomada}
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRegistrar("nao_tomou")}
            className="min-h-14 rounded-2xl border-2 border-white/60 font-bold text-white transition hover:bg-white/10"
          >
            {ROTULO_SITUACAO.nao_tomou}
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRegistrar("duvida")}
            className="min-h-14 rounded-2xl border-2 border-white/60 font-bold text-white transition hover:bg-white/10"
          >
            {ROTULO_SITUACAO.duvida}
          </button>
        </div>
      )}
    </div>
  );
}

export { chaveDose };

/** Remédios "se necessário": mostra o uso do dia e aplica os limites do plano aprovado. */
function UsoSeNecessario({
  conteudo,
  agora,
  hoje,
  registros,
  habilitado,
  pendente,
  registrarUso,
  desfazer,
}: {
  conteudo: ConteudoPlano;
  agora: Date;
  hoje: string;
  registros: ReadonlyMap<string, Situacao>;
  habilitado: boolean;
  pendente: string | null;
  registrarUso?: (medId: string) => void;
  desfazer: (dose: Dose) => void;
}) {
  const meds = conteudo.medicamentos.filter((m) => {
    if (!m.seNecessario) return false;
    const dia = diasEntre(conteudo.inicio, hoje);
    return dia >= 0 && (m.duracaoDias === null || dia < m.duracaoDias);
  });
  if (!meds.length) return null;
  const hora = (d: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: conteudo.fusoHorario }).format(d);

  return (
    <div>
      <h3 className="mb-3 text-xl font-extrabold">Se necessário</h3>
      <ul className="space-y-4">
        {meds.map((m) => {
          const sn = m.seNecessario!;
          const usos = [...registros.entries()]
            .filter(([k, v]) => v === "relatou_tomada" && k.split("|")[1] === m.id)
            .map(([k]) => ({ data: k.split("|")[0], horario: k.split("|")[2] }));
          const av = avaliarUsoSeNecessario({ usos, intervaloMinimoHoras: sn.intervaloMinimoHoras, maximoPorDia: sn.maximoPorDia, agora, fuso: conteudo.fusoHorario });
          const deHoje = usos.filter((u) => u.data === hoje).sort((a, b) => a.horario.localeCompare(b.horario));
          return (
            <li key={m.id} className="rounded-3xl border-l-8 border-vivo-teal bg-surface p-5 shadow-suave">
              <p className="text-lg font-bold">{m.nome}</p>
              <p className="text-muted">
                {sn.quando}. {m.dose}.
              </p>
              <p className="mt-2 text-sm font-semibold">
                Usado hoje: {av.usadosHoje} de {sn.maximoPorDia} · intervalo mínimo de {sn.intervaloMinimoHoras} h
              </p>
              {deHoje.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {deHoje.map((u) => (
                    <li key={u.horario} className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                      {formatarHora(u.horario)}
                      {habilitado && (
                        <button
                          type="button"
                          className="no-print min-h-8 underline"
                          aria-label={`Desfazer registro de ${m.nome} às ${formatarHora(u.horario)}`}
                          onClick={() => desfazer({ chave: chaveDose(u.data, m.id, u.horario), data: u.data, horario: u.horario, periodo: "manha", medicamento: m })}
                        >
                          desfazer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!av.permitido && (
                <p className="mt-3 rounded-2xl bg-info-soft p-3 text-ink" role="status">
                  {av.motivo === "intervalo"
                    ? `Pelo seu plano, o próximo uso pode ser a partir das ${hora(av.proximo)}.`
                    : "Você já chegou ao máximo de usos por dia previsto no seu plano."}{" "}
                  Se o sintoma não melhorar, veja “Quando procurar ajuda”.
                </p>
              )}
              {habilitado && registrarUso && (
                <button
                  type="button"
                  disabled={!av.permitido || pendente === `uso:${m.id}`}
                  onClick={() => registrarUso(m.id)}
                  className="no-print mt-3 min-h-12 w-full rounded-2xl bg-primary px-4 font-bold text-primary-ink shadow-suave transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Registrar que usei agora
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
