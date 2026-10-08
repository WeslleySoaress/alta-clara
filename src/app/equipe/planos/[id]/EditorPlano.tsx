"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Aviso, Botao, Cartao } from "@/components/ui";
import {
  apresentacoes,
  categoriasCuidado,
  niveisSinal,
  type ConteudoPlano,
  type MedicamentoPlano,
  type NivelSinal,
} from "@/server/dominio/conteudo";
import { enviarRevisaoAcao, salvarRascunhoAcao } from "../../acoes";
import { SimplificarIA } from "./SimplificarIA";

const ROTULO_APRESENTACAO = { comprimido: "Comprimido", capsula: "Cápsula", liquido: "Líquido", gotas: "Gotas", pomada: "Pomada" };
const ROTULO_CATEGORIA = { ferida: "Ferida/curativo", banho: "Banho", alimentacao: "Alimentação", atividade: "Atividade", outro: "Outro" };
const ROTULO_NIVEL: Record<NivelSinal, string> = {
  urgencia: "Procure atendimento de urgência conforme a orientação recebida",
  contato: "Entre em contato com a unidade",
  previsto: "Cuidados previstos no plano",
};

const entrada = "min-h-11 w-full rounded-lg border-2 border-line bg-surface px-3 text-ink";

/** Campo vazio vira 0 (o servidor recusa com mensagem clara); nunca força outro número. */
const numero = (v: string) => (v === "" ? 0 : Math.max(0, Math.trunc(Number(v)) || 0));

function novoMedicamento(): MedicamentoPlano {
  return {
    id: `m-${Math.random().toString(36).slice(2, 10)}`,
    nome: "",
    finalidade: "",
    apresentacao: "comprimido",
    dose: "",
    via: "pela boca",
    horarios: ["08:00"],
    duracaoDias: 7,
    seNecessario: null,
    observacao: null,
  };
}

export function EditorPlano({
  planoId,
  revisaoInicial,
  conteudoInicial,
  iaDisponivel,
}: {
  planoId: string;
  revisaoInicial: number;
  conteudoInicial: ConteudoPlano;
  iaDisponivel: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState<ConteudoPlano>(conteudoInicial);
  // Chaves estáveis: removido um item, o estado dos outros (ex.: sugestão da IA aberta) não muda de dono.
  const novaChave = () => Math.random().toString(36).slice(2);
  const [chaves, setChaves] = useState(() => ({
    cuidados: conteudoInicial.cuidados.map(novaChave),
    sinais: conteudoInicial.sinais.map(novaChave),
    retornos: conteudoInicial.retornos.map(novaChave),
  }));
  const incluirChave = (lista: "cuidados" | "sinais" | "retornos") => setChaves((k) => ({ ...k, [lista]: [...k[lista], novaChave()] }));
  const removerChave = (lista: "cuidados" | "sinais" | "retornos", i: number) => setChaves((k) => ({ ...k, [lista]: k[lista].filter((_, j) => j !== i) }));
  const [revisao, setRevisao] = useState(revisaoInicial);
  const [sujo, setSujo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "info" | "danger"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function alterar(f: (atual: ConteudoPlano) => ConteudoPlano) {
    setC((atual) => f(structuredClone(atual)));
    setSujo(true);
  }

  async function salvar(): Promise<number | null> {
    setOcupado(true);
    setMensagem(null);
    const r = await salvarRascunhoAcao(planoId, revisao, c).catch(() => ({ ok: false as const, erro: "Falha de comunicação. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) {
      setMensagem({ tom: "danger", texto: r.erro });
      return null;
    }
    setRevisao(r.revisao);
    setSujo(false);
    setMensagem({ tom: "info", texto: "Rascunho salvo." });
    return r.revisao;
  }

  async function enviar() {
    const nova = sujo ? await salvar() : revisao;
    if (nova === null) return;
    setOcupado(true);
    const r = await enviarRevisaoAcao(planoId, nova).catch(() => ({ ok: false as const, erro: "Falha de comunicação. Tente de novo." }));
    setOcupado(false);
    if (!r.ok) return setMensagem({ tom: "danger", texto: r.erro });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Aviso tom="warn" titulo="Organização das orientações, não prescrição">
        Transcreva os medicamentos da prescrição revisada. Alterar medicamento ou dose exige a autorização clínica
        correspondente. Este formulário não emite prescrição.
      </Aviso>

      <Bloco titulo="Dados gerais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Rotulo texto="Primeiro dia em casa">
            <input type="date" className={entrada} value={c.inicio} onChange={(e) => alterar((x) => ({ ...x, inicio: e.target.value }))} />
          </Rotulo>
          <Rotulo texto="Equipe responsável">
            <input className={entrada} value={c.equipeResponsavel} onChange={(e) => alterar((x) => ({ ...x, equipeResponsavel: e.target.value }))} />
          </Rotulo>
          <Rotulo texto="Unidade para contato">
            <input className={entrada} value={c.contato.unidade} onChange={(e) => alterar((x) => ({ ...x, contato: { ...x.contato, unidade: e.target.value } }))} />
          </Rotulo>
          <Rotulo texto="Telefone da unidade">
            <input className={entrada} inputMode="tel" value={c.contato.telefone} onChange={(e) => alterar((x) => ({ ...x, contato: { ...x.contato, telefone: e.target.value } }))} />
          </Rotulo>
          <Rotulo texto="Horário de atendimento" largo>
            <input className={entrada} value={c.contato.horarioAtendimento} onChange={(e) => alterar((x) => ({ ...x, contato: { ...x.contato, horarioAtendimento: e.target.value } }))} />
          </Rotulo>
        </div>
      </Bloco>

      <Bloco titulo={`Medicamentos (${c.medicamentos.length})`}>
        <div className="space-y-5">
          {c.medicamentos.map((m, i) => (
            <fieldset key={m.id} className="rounded-xl border-2 border-line p-4">
              <legend className="px-2 font-bold">Medicamento {i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Rotulo texto="Nome e concentração">
                  <input className={entrada} value={m.nome} onChange={(e) => alterar((x) => ((x.medicamentos[i].nome = e.target.value), x))} />
                </Rotulo>
                <Rotulo texto="Para que serve (linguagem simples)">
                  <input className={entrada} value={m.finalidade} onChange={(e) => alterar((x) => ((x.medicamentos[i].finalidade = e.target.value), x))} />
                </Rotulo>
                <Rotulo texto="Forma">
                  <select className={entrada} value={m.apresentacao} onChange={(e) => alterar((x) => ((x.medicamentos[i].apresentacao = e.target.value as MedicamentoPlano["apresentacao"]), x))}>
                    {apresentacoes.map((a) => (
                      <option key={a} value={a}>
                        {ROTULO_APRESENTACAO[a]}
                      </option>
                    ))}
                  </select>
                </Rotulo>
                <Rotulo texto="Dose">
                  <input className={entrada} value={m.dose} onChange={(e) => alterar((x) => ((x.medicamentos[i].dose = e.target.value), x))} />
                </Rotulo>
                <Rotulo texto="Via / como usar">
                  <input className={entrada} value={m.via} onChange={(e) => alterar((x) => ((x.medicamentos[i].via = e.target.value), x))} />
                </Rotulo>
                <Rotulo texto="Duração (dias)">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className={entrada}
                      disabled={m.duracaoDias === null}
                      value={m.duracaoDias === null || m.duracaoDias === 0 ? "" : m.duracaoDias}
                      onChange={(e) => alterar((x) => ((x.medicamentos[i].duracaoDias = numero(e.target.value)), x))}
                    />
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <input type="checkbox" checked={m.duracaoDias === null} onChange={(e) => alterar((x) => ((x.medicamentos[i].duracaoDias = e.target.checked ? null : 7), x))} />
                      Contínuo
                    </label>
                  </div>
                </Rotulo>
              </div>

              <div className="mt-4 space-y-3">
                <p className="font-bold">Regime</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`regime-${m.id}`}
                      checked={!m.seNecessario}
                      onChange={() => alterar((x) => ((x.medicamentos[i] = { ...x.medicamentos[i], seNecessario: null, horarios: ["08:00"] }), x))}
                    />
                    Horários fixos
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`regime-${m.id}`}
                      checked={Boolean(m.seNecessario)}
                      onChange={() =>
                        alterar((x) => ((x.medicamentos[i] = { ...x.medicamentos[i], horarios: [], seNecessario: { quando: "", intervaloMinimoHoras: 6, maximoPorDia: 4 } }), x))
                      }
                    />
                    Somente se necessário
                  </label>
                </div>
                {m.seNecessario ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Rotulo texto="Quando usar">
                      <input className={entrada} value={m.seNecessario.quando} onChange={(e) => alterar((x) => ((x.medicamentos[i].seNecessario!.quando = e.target.value), x))} />
                    </Rotulo>
                    <Rotulo texto="Intervalo mínimo (h)">
                      <input type="number" min={1} max={48} className={entrada} value={m.seNecessario.intervaloMinimoHoras || ""} onChange={(e) => alterar((x) => ((x.medicamentos[i].seNecessario!.intervaloMinimoHoras = numero(e.target.value)), x))} />
                    </Rotulo>
                    <Rotulo texto="Máximo por dia">
                      <input type="number" min={1} max={12} className={entrada} value={m.seNecessario.maximoPorDia || ""} onChange={(e) => alterar((x) => ((x.medicamentos[i].seNecessario!.maximoPorDia = numero(e.target.value)), x))} />
                    </Rotulo>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    {m.horarios.map((h, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <input
                          type="time"
                          aria-label={`Horário ${j + 1}`}
                          className="min-h-11 rounded-lg border-2 border-line bg-surface px-2"
                          value={h}
                          onChange={(e) => alterar((x) => ((x.medicamentos[i].horarios[j] = e.target.value), x))}
                        />
                        <button type="button" aria-label={`Remover horário ${j + 1}`} className="min-h-11 min-w-11 rounded-lg text-danger" onClick={() => alterar((x) => (x.medicamentos[i].horarios.splice(j, 1), x))}>
                          ×
                        </button>
                      </span>
                    ))}
                    <Botao variante="discreto" onClick={() => alterar((x) => (x.medicamentos[i].horarios.push("12:00"), x))}>
                      + horário
                    </Botao>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Rotulo texto="Observação para o paciente (opcional)">
                  <input className={entrada} value={m.observacao ?? ""} onChange={(e) => alterar((x) => ((x.medicamentos[i].observacao = e.target.value || null), x))} />
                </Rotulo>
              </div>
              <Botao variante="discreto" className="mt-2 px-0 text-danger" onClick={() => alterar((x) => (x.medicamentos.splice(i, 1), x))}>
                Remover medicamento
              </Botao>
            </fieldset>
          ))}
          <Botao variante="secundario" onClick={() => alterar((x) => (x.medicamentos.push(novoMedicamento()), x))}>
            + Adicionar medicamento
          </Botao>
        </div>
      </Bloco>

      <Bloco titulo="Cuidados em casa">
        <div className="space-y-3">
          {c.cuidados.map((cu, i) => (
            <div key={chaves.cuidados[i] ?? i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[10rem_1fr_auto]">
              <select aria-label="Categoria" className={entrada} value={cu.categoria} onChange={(e) => alterar((x) => ((x.cuidados[i].categoria = e.target.value as typeof cu.categoria), x))}>
                {categoriasCuidado.map((k) => (
                  <option key={k} value={k}>
                    {ROTULO_CATEGORIA[k]}
                  </option>
                ))}
              </select>
              <div className="space-y-2">
                <input aria-label="Título" className={entrada} value={cu.titulo} onChange={(e) => alterar((x) => ((x.cuidados[i].titulo = e.target.value), x))} />
                <textarea aria-label="Orientação" rows={2} className={`${entrada} py-2`} value={cu.texto} onChange={(e) => alterar((x) => ((x.cuidados[i].texto = e.target.value), x))} />
                <SimplificarIA texto={cu.texto} disponivel={iaDisponivel} onAceitar={(novo) => alterar((x) => ((x.cuidados[i].texto = novo), x))} />
              </div>
              <button type="button" className="min-h-11 rounded-lg px-3 text-danger underline" onClick={() => (removerChave("cuidados", i), alterar((x) => (x.cuidados.splice(i, 1), x)))}>
                Remover
              </button>
            </div>
          ))}
          <Botao variante="secundario" onClick={() => (incluirChave("cuidados"), alterar((x) => (x.cuidados.push({ categoria: "outro", titulo: "", texto: "" }), x)))}>
            + Adicionar cuidado
          </Botao>
        </div>
      </Bloco>

      <Bloco titulo="Quando procurar ajuda">
        <p className="mb-3 text-sm text-muted">
          O conteúdo deve vir de protocolo aprovado e individualização profissional. Inclua ao menos uma orientação de urgência.
        </p>
        <div className="space-y-5">
          {niveisSinal.map((nivel) => (
            <div key={nivel}>
              <p className="font-bold">{ROTULO_NIVEL[nivel]}</p>
              <ul className="mt-2 space-y-2">
                {c.sinais.map((s, i) =>
                  s.nivel !== nivel ? null : (
                    <li key={chaves.sinais[i] ?? i} className="flex gap-2">
                      <input aria-label={`${ROTULO_NIVEL[nivel]}: item`} className={entrada} value={s.texto} onChange={(e) => alterar((x) => ((x.sinais[i].texto = e.target.value), x))} />
                      <button type="button" aria-label="Remover item" className="min-h-11 min-w-11 rounded-lg text-danger" onClick={() => (removerChave("sinais", i), alterar((x) => (x.sinais.splice(i, 1), x)))}>
                        ×
                      </button>
                    </li>
                  ),
                )}
              </ul>
              <Botao variante="discreto" className="px-0" onClick={() => (incluirChave("sinais"), alterar((x) => (x.sinais.push({ nivel, texto: "" }), x)))}>
                + item
              </Botao>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Retornos">
        <div className="space-y-3">
          {c.retornos.map((r, i) => (
            <div key={chaves.retornos[i] ?? i} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
              <Rotulo texto="Local">
                <input className={entrada} value={r.local} onChange={(e) => alterar((x) => ((x.retornos[i].local = e.target.value), x))} />
              </Rotulo>
              <Rotulo texto="Data e hora (vazio = ainda não agendado)">
                <input type="datetime-local" className={entrada} value={r.dataHora ?? ""} onChange={(e) => alterar((x) => ((x.retornos[i].dataHora = e.target.value || null), x))} />
              </Rotulo>
              <Rotulo texto="O que levar (separe por vírgula)" largo>
                <input
                  className={entrada}
                  value={r.levar.join(", ")}
                  onChange={(e) => alterar((x) => ((x.retornos[i].levar = e.target.value.split(",").map((v) => v.trim()).filter(Boolean)), x))}
                />
              </Rotulo>
              <button type="button" className="justify-self-start text-danger underline" onClick={() => (removerChave("retornos", i), alterar((x) => (x.retornos.splice(i, 1), x)))}>
                Remover retorno
              </button>
            </div>
          ))}
          <Botao variante="secundario" onClick={() => (incluirChave("retornos"), alterar((x) => (x.retornos.push({ local: c.contato.unidade, dataHora: null, levar: [] }), x)))}>
            + Adicionar retorno
          </Botao>
        </div>
      </Bloco>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {mensagem && (
          <p role={mensagem.tom === "danger" ? "alert" : "status"} className={`mb-2 font-semibold ${mensagem.tom === "danger" ? "text-danger" : "text-primary"}`}>
            {mensagem.texto}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Botao onClick={salvar} disabled={ocupado || !sujo}>
            Salvar rascunho
          </Botao>
          <Botao variante="secundario" onClick={enviar} disabled={ocupado}>
            Enviar para revisão
          </Botao>
          <span className="text-sm text-muted">{sujo ? "Há alterações não salvas." : "Tudo salvo."}</span>
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Cartao>
      <h2 className="mb-4 text-xl font-extrabold">{titulo}</h2>
      {children}
    </Cartao>
  );
}

function Rotulo({ texto, children, largo }: { texto: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`block ${largo ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-bold">{texto}</span>
      {children}
    </label>
  );
}
