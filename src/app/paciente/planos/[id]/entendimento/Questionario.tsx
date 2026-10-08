"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Aviso, Botao } from "@/components/ui";
import { responderEntendimentoAcao } from "../../../acoes";

type Pergunta = { id: string; enunciado: string; opcoes: { id: string; texto: string }[]; secao: string };
type Resultado = { acertos: number; total: number; resultado: { id: string; enunciado: string; secao: string; correta: boolean; respostaCerta: string }[] };

const SECAO = { remedios: "Seus remédios", ajuda: "Quando procurar ajuda" } as Record<string, string>;

/** Uma pergunta por vez (modo de simplicidade), com resposta corrigida no servidor. */
export function Questionario({ planoId, perguntas }: { planoId: string; perguntas: Pergunta[] }) {
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const atual = perguntas[indice];

  async function avancar(e: FormEvent) {
    e.preventDefault();
    if (indice < perguntas.length - 1) return setIndice(indice + 1);
    setEnviando(true);
    const r = await responderEntendimentoAcao(planoId, respostas).catch(() => ({ ok: false as const }));
    setEnviando(false);
    if (!r.ok) return setErro(true);
    setResultado(r);
  }

  if (resultado) {
    return (
      <div className="mt-6 space-y-4" role="status">
        <p className="text-xl font-bold">
          Você respondeu {resultado.total} perguntas. {resultado.acertos === resultado.total ? "Tudo de acordo com o plano." : "Alguns pontos merecem reforço."}
        </p>
        <ul className="space-y-3">
          {resultado.resultado.map((r) => (
            <li key={r.id} className={`rounded-2xl border-2 p-4 ${r.correta ? "border-primary bg-primary-soft" : "border-warn bg-warn-soft"}`}>
              <p className="font-semibold text-ink">{r.enunciado}</p>
              <p className="mt-1 text-ink">
                {r.correta ? "De acordo com o plano." : "Segundo o seu plano:"} <strong>{r.respostaCerta}</strong>
              </p>
              {!r.correta && <p className="mt-1 text-sm text-ink">Veja em “{SECAO[r.secao]}”. A equipe foi avisada para reforçar este ponto com você.</p>}
            </li>
          ))}
        </ul>
        <p className="text-muted">Acertar estas perguntas não substitui conversar com a equipe sempre que tiver dúvida.</p>
        <Link href={`/paciente/planos/${planoId}`} className="inline-block font-semibold text-primary underline">
          Voltar ao plano
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={avancar} className="mt-6 space-y-5">
      <p className="text-sm font-bold text-muted" aria-live="polite">
        Pergunta {indice + 1} de {perguntas.length}
      </p>
      <fieldset key={atual.id}>
        <legend className="text-xl font-bold">{atual.enunciado}</legend>
        <div className="mt-4 space-y-2">
          {atual.opcoes.map((o) => (
            <label key={o.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-surface px-4 has-checked:border-primary has-checked:bg-primary-soft">
              <input
                type="radio"
                name={atual.id}
                value={o.id}
                checked={respostas[atual.id] === o.id}
                onChange={() => setRespostas({ ...respostas, [atual.id]: o.id })}
                className="size-5"
              />
              <span className="text-lg">{o.texto}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {erro && <Aviso tom="danger">Não foi possível enviar. Tente de novo.</Aviso>}
      <div className="flex gap-3">
        {indice > 0 && (
          <Botao variante="secundario" onClick={() => setIndice(indice - 1)}>
            Voltar
          </Botao>
        )}
        <Botao type="submit" disabled={enviando || !respostas[atual.id]}>
          {indice < perguntas.length - 1 ? "Próxima" : "Ver resultado"}
        </Botao>
      </div>
    </form>
  );
}
