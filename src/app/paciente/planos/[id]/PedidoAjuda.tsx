"use client";

import { formatarDataCurta } from "@/lib/datas";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao } from "@/components/ui";
import { solicitarAjudaAcao } from "../../acoes";

type Pedido = { id: string; tipo: string; descricao: string; criadoEm: string; resolvidaEm: string | null; resolucao: string | null };

const ROTULO: Record<string, string> = {
  dificuldade_medicamento: "Dificuldade para conseguir remédio",
  duvida_geral: "Dúvida",
  duvida_dose: "Dúvida sobre uma dose",
};

export function PedidoAjuda({ planoId, pedidos, telefone }: { planoId: string; pedidos: Pedido[]; telefone: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"duvida_geral" | "dificuldade_medicamento">("duvida_geral");
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<{ tom: "info" | "danger"; texto: string } | null>(null);

  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    const r = await solicitarAjudaAcao({ planoId, tipo, texto }).catch(() => ({ ok: false as const, erro: "Falha de comunicação. Tente de novo." }));
    setEnviando(false);
    if (!r.ok) return setMsg({ tom: "danger", texto: r.erro });
    setTexto("");
    setMsg({ tom: "info", texto: "Enviado. A equipe responde em horário comercial (simulação)." });
    router.refresh();
  }

  return (
    <section id="pedidos" aria-labelledby="pedidos-titulo" className="space-y-4">
      <h2 id="pedidos-titulo" className="text-2xl font-extrabold">
        Precisa de algo que não é urgente?
      </h2>
      <p className="rounded-xl border-2 border-warn bg-warn-soft p-4 font-semibold text-ink">
        Este espaço não é acompanhado em tempo real. Para piora ou sinais de urgência, siga “Quando procurar ajuda”, ligue{" "}
        {telefone} ou 192.
      </p>
      <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <fieldset>
          <legend className="font-bold">Sobre o quê?</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="tipo" checked={tipo === "duvida_geral"} onChange={() => setTipo("duvida_geral")} /> Uma dúvida
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="tipo" checked={tipo === "dificuldade_medicamento"} onChange={() => setTipo("dificuldade_medicamento")} /> Não consigo um remédio
            </label>
          </div>
        </fieldset>
        <label htmlFor="pedido-texto" className="block font-bold">
          Conte em poucas palavras
        </label>
        <textarea id="pedido-texto" rows={3} maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-xl border-2 border-line bg-surface p-3" />
        {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
        <Botao type="submit" disabled={enviando || texto.trim().length < 3}>
          Enviar para a equipe
        </Botao>
      </form>
      {pedidos.length > 0 && (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-bold text-muted">
                {ROTULO[p.tipo] ?? p.tipo} · {formatarDataCurta(p.criadoEm)} ·{" "}
                {p.resolvidaEm ? <span className="text-primary">Respondido</span> : "Aguardando a equipe"}
              </p>
              <p className="mt-1">{p.descricao}</p>
              {p.resolucao && <p className="mt-2 rounded-lg bg-primary-soft p-2">Resposta da equipe: {p.resolucao}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
