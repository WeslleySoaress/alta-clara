"use client";

import { formatarDataHora } from "@/lib/datas";
import { useState, useTransition, type ReactNode } from "react";
import { IconeCalendario, IconeCoracao, IconePilula, IconeSirene, IconeSol, IconeTelefone } from "@/components/Icones";
import { Azulejo } from "@/components/ui";
import { useAgora } from "@/hooks/useAgora";
import { useFala } from "@/hooks/useFala";
import { useFonte } from "@/hooks/useFonte";
import { chaveDose, type Dose } from "@/lib/agenda";
import { gerarIcs } from "@/lib/calendario";
import { partesNoFuso } from "@/lib/fuso";
import { avaliarUsoSeNecessario } from "@/lib/se-necessario";
import { BotaoOuvir } from "./BotaoOuvir";
import { Hoje } from "./Hoje";
import { ListaCuidados, ListaMedicamentos, Retornos } from "./Medicamentos";
import { Orientacoes, telLink } from "./Orientacoes";
import type { ModoPlano, PlanoVisivel, Situacao } from "./tipos";

export type AcaoRegistrarUso = (
  planoId: string,
  itemId: string,
) => Promise<{ ok: true; data: string; horario: string } | { ok: false; motivo: string; proximo?: string }>;

export type AcaoRegistrar = (entrada: {
  planoId: string;
  itemId: string;
  data: string;
  horario: string;
  situacao: Situacao | null;
}) => Promise<{ ok: boolean }>;

const NAV = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "remedios", rotulo: "Remédios" },
  { id: "cuidados", rotulo: "Cuidados" },
  { id: "ajuda", rotulo: "Ajuda" },
];

function horaFalada(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return m === 0 ? `${h} horas` : `${h} horas e ${m}`;
}

export function VisaoPlano({
  plano,
  modo,
  registrarNoServidor,
  registrarUsoNoServidor,
  cabecalho,
  avisoTopo,
  secoesExtras,
}: {
  plano: PlanoVisivel;
  modo: ModoPlano;
  registrarNoServidor?: AcaoRegistrar;
  registrarUsoNoServidor?: AcaoRegistrarUso;
  cabecalho?: ReactNode;
  /** Conteúdo logo abaixo do título (ex.: "o que mudou", confirmação de entendimento). */
  avisoTopo?: ReactNode;
  /** Seções adicionais depois do retorno (ex.: pedidos de ajuda não urgentes). */
  secoesExtras?: ReactNode;
}) {
  const { conteudo } = plano;
  const agora = useAgora();
  const fala = useFala();
  const [pendente, setPendente] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tom: "info" | "warn" | "danger"; texto: string } | null>(null);
  const [, iniciarTransicao] = useTransition();
  const [registros, setRegistros] = useState(
    () => new Map(plano.registros.map((r) => [chaveDose(r.data, r.itemId, r.horario), r.situacao] as const)),
  );
  // Autoria dos registros feitos por outra pessoa (ex.: cuidador).
  const autoria = new Map(plano.registros.filter((r) => r.por && !r.proprio).map((r) => [chaveDose(r.data, r.itemId, r.horario), r.por!] as const));
  const { fonte, alternar: alternarFonte } = useFonte();

  function registrar(dose: Dose, situacao: Situacao | null) {
    const anterior = registros.get(dose.chave);
    const proximo = new Map(registros);
    if (situacao) proximo.set(dose.chave, situacao);
    else proximo.delete(dose.chave);
    setRegistros(proximo);
    setAviso(
      situacao === "nao_tomou"
        ? { tom: "warn", texto: "Registro salvo. Não tome dose dobrada para compensar. Se tiver dúvida sobre o que fazer, ligue para a unidade." }
        : situacao === "duvida"
          ? { tom: "info", texto: `Registro salvo. A equipe não acompanha os registros em tempo real: para tirar a dúvida, ligue ${conteudo.contato.telefone} (${conteudo.contato.horarioAtendimento}).` }
          : null,
    );
    if (modo !== "paciente" || !registrarNoServidor) return;

    setPendente(dose.chave);
    iniciarTransicao(async () => {
      const r = await registrarNoServidor({
        planoId: plano.id,
        itemId: dose.medicamento.id,
        data: dose.data,
        horario: dose.horario,
        situacao,
      }).catch(() => ({ ok: false }));
      setPendente(null);
      if (!r.ok) {
        setRegistros((atual) => {
          const volta = new Map(atual);
          if (anterior) volta.set(dose.chave, anterior);
          else volta.delete(dose.chave);
          return volta;
        });
        setAviso({ tom: "danger", texto: "Não foi possível salvar o registro. Verifique a conexão e tente de novo." });
      }
    });
  }

  function registrarUso(medId: string) {
    const med = conteudo.medicamentos.find((m) => m.id === medId);
    if (!med?.seNecessario) return;
    const adicionar = (data: string, horario: string) => setRegistros((atual) => new Map(atual).set(chaveDose(data, medId, horario), "relatou_tomada"));
    const avisoLimite = (motivo: string, proximo?: string) =>
      setAviso({
        tom: "warn",
        texto:
          motivo === "intervalo" && proximo
            ? `Pelo seu plano, o próximo uso pode ser a partir das ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: conteudo.fusoHorario }).format(new Date(proximo))}.`
            : motivo === "maximo_dia"
              ? "Você já chegou ao máximo de usos por dia previsto no seu plano."
              : "Não foi possível registrar agora. Tente de novo.",
      });

    if (modo !== "paciente" || !registrarUsoNoServidor) {
      // Demonstração: mesma regra, só na memória da página.
      const agoraLocal = new Date();
      const { data, horario } = partesNoFuso(agoraLocal, conteudo.fusoHorario);
      const usos = [...registros.entries()]
        .filter(([k, v]) => v === "relatou_tomada" && k.split("|")[1] === medId)
        .map(([k]) => ({ data: k.split("|")[0], horario: k.split("|")[2] }));
      const av = avaliarUsoSeNecessario({ usos, intervaloMinimoHoras: med.seNecessario.intervaloMinimoHoras, maximoPorDia: med.seNecessario.maximoPorDia, agora: agoraLocal, fuso: conteudo.fusoHorario });
      if (!av.permitido) return avisoLimite(av.motivo, av.motivo === "intervalo" ? av.proximo.toISOString() : undefined);
      adicionar(data, horario);
      setAviso(null);
      return;
    }
    setPendente(`uso:${medId}`);
    iniciarTransicao(async () => {
      const r = await registrarUsoNoServidor(plano.id, medId).catch(() => ({ ok: false as const, motivo: "erro" }));
      setPendente(null);
      if (r.ok) {
        adicionar(r.data, r.horario);
        setAviso(null);
      } else avisoLimite(r.motivo, "proximo" in r ? r.proximo : undefined);
    });
  }

  function baixarCalendario() {
    const blob = new Blob([gerarIcs(conteudo, plano.id)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alta-clara-lembretes.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  const textoRemedios = conteudo.medicamentos
    .map((m) => {
      const quando = m.seNecessario
        ? `somente se necessário: ${m.seNecessario.quando}, com pelo menos ${m.seNecessario.intervaloMinimoHoras} horas entre as doses`
        : `às ${m.horarios.map(horaFalada).join(", ")}`;
      return `${m.nome}. ${m.finalidade} Dose: ${m.dose}, ${m.via}, ${quando}. ${m.observacao ?? ""}`;
    })
    .join(" ");
  const lista = (nivel: string) => conteudo.sinais.filter((s) => s.nivel === nivel).map((s) => s.texto).join(". ");
  const textoAjuda = `Procure atendimento de urgência conforme a orientação recebida se: ${lista("urgencia")}. Entre em contato com a unidade se: ${lista("contato")}. Cuidados previstos no seu plano: ${lista("previsto")}. Se um sintoma não aparece na lista, isso não quer dizer que está tudo bem. Em emergência, ligue 192.`;

  return (
    <div className="pb-28">
      {modo === "previa" && (
        <p className="bg-info-soft px-4 py-2 text-center font-semibold text-info">Prévia: é assim que o paciente verá este plano.</p>
      )}

      <header className="mx-auto max-w-xl px-4 pt-5">
        {cabecalho}
        <div className="painel-vivo mt-5 rounded-[2rem] p-6 shadow-forte">
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Seu plano de alta</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05]">O que preciso fazer hoje?</h1>
          <p className="mt-3 text-white/85">
            {plano.procedimento} · {plano.instituicao}
          </p>
          <div className="no-print mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={alternarFonte}
              aria-pressed={fonte === "grande"}
              className="vidro min-h-11 rounded-full px-4 text-sm font-bold text-white aria-pressed:bg-white aria-pressed:text-indigo"
            >
              Aa · Letra maior
            </button>
            <button type="button" onClick={() => window.print()} className="vidro min-h-11 rounded-full px-4 text-sm font-bold text-white">
              Imprimir
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Seções" className="no-print sticky top-0 z-10 mt-4 bg-bg/90 backdrop-blur">
        <ul className="mx-auto flex max-w-xl gap-1 overflow-x-auto px-3 py-2">
          {NAV.map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 font-bold text-ink shadow-suave hover:border-violet hover:text-violet">
                {n.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto max-w-xl space-y-12 px-4 pt-6">
        {aviso && (
          <p role={aviso.tom === "danger" ? "alert" : "status"} className={`rounded-xl p-4 font-semibold ${{ info: "bg-info-soft text-ink", warn: "bg-warn-soft text-ink", danger: "bg-danger-soft text-danger" }[aviso.tom]}`}>
            {aviso.texto}
          </p>
        )}

        {avisoTopo}

        <Secao id="hoje" titulo="Hoje" icone={<Azulejo cor="sun"><IconeSol tamanho={24} /></Azulejo>}>
          <Hoje
            conteudo={conteudo}
            agora={agora}
            registros={registros}
            autoria={autoria}
            modo={modo}
            podeRegistrar={plano.podeRegistrar}
            registrar={registrar}
            registrarUso={registrarUso}
            pendente={pendente}
          />
        </Secao>

        <Secao id="remedios" titulo="Seus remédios" icone={<Azulejo cor="teal"><IconePilula tamanho={24} /></Azulejo>} acao={<BotaoOuvir id="remedios" texto={textoRemedios} fala={fala} />}>
          <ListaMedicamentos conteudo={conteudo} />
          {conteudo.medicamentos.some((m) => m.horarios.length) && (
            <button
              type="button"
              onClick={baixarCalendario}
              className="no-print mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/60 bg-surface px-4 font-bold text-primary shadow-suave hover:border-primary"
            >
              <IconeCalendario tamanho={20} />
              Colocar horários no calendário do celular
            </button>
          )}
        </Secao>

        <Secao
          id="cuidados"
          titulo="Cuidados em casa"
          icone={<Azulejo cor="violet"><IconeCoracao tamanho={24} /></Azulejo>}
          acao={<BotaoOuvir id="cuidados" texto={conteudo.cuidados.map((c) => `${c.titulo}. ${c.texto}`).join(" ")} fala={fala} />}
        >
          <ListaCuidados conteudo={conteudo} />
        </Secao>

        <Secao id="ajuda" titulo="Quando procurar ajuda" icone={<Azulejo cor="coral"><IconeSirene tamanho={24} /></Azulejo>} acao={<BotaoOuvir id="ajuda" texto={textoAjuda} fala={fala} />}>
          <Orientacoes conteudo={conteudo} />
        </Secao>

        <Secao id="retorno" titulo="Retorno" icone={<Azulejo cor="info"><IconeCalendario tamanho={24} /></Azulejo>}>
          <Retornos conteudo={conteudo} />
        </Secao>

        {secoesExtras}

        <footer className="space-y-2 border-t border-line pt-6 text-sm text-muted">
          <p>
            <strong className="text-ink">Origem das informações:</strong> plano versão {plano.versao}
            {plano.publicadoEm && `, publicado em ${formatarDataHora(plano.publicadoEm)}`}
            . Preparado por {plano.autorNome}
            {plano.revisorNome && `, revisado por ${plano.revisorNome}`}. Equipe responsável: {conteudo.equipeResponsavel}.
          </p>
          <p>
            A leitura em voz alta usa a voz do seu aparelho; dependendo do sistema, o texto pode ser processado por um
            serviço do fabricante.
          </p>
          <p>Primeiro dia do plano em casa: {conteudo.inicio.split("-").reverse().join("/")}. Horários no fuso de Brasília.</p>
        </footer>
      </main>

      {/* Na prévia da equipe a barra fica no fim da prévia: fixa, ela cobriria a página do profissional. */}
      <div className={`no-print px-3 ${modo === "previa" ? "relative pb-4" : "fixed inset-x-0 bottom-3 z-20"}`}>
        <div className="mx-auto flex max-w-xl gap-2 rounded-3xl border border-line bg-surface/95 p-2 shadow-forte backdrop-blur">
          <a href={telLink(conteudo.contato.telefone)} className="inline-flex min-h-12 flex-none items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 font-bold text-primary">
            <IconeTelefone tamanho={20} />
            Unidade
          </a>
          <a href="#ajuda" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-danger px-3 font-bold text-surface">
            Preciso de ajuda
          </a>
        </div>
      </div>
    </div>
  );
}

function Secao({ id, titulo, icone, acao, children }: { id: string; titulo: string; icone?: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={`${id}-titulo`} className="flex items-center gap-3 text-3xl font-extrabold">
          {icone}
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
