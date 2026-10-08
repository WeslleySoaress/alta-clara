"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, Campo, Cartao } from "@/components/ui";
import { devolverAcao, publicarAcao } from "../../acoes";

export function PainelRevisao({
  planoId,
  revisao,
  podePublicar,
  podeDevolver,
  autorEhVoce,
}: {
  planoId: string;
  revisao: number;
  podePublicar: boolean;
  podeDevolver: boolean;
  autorEhVoce: boolean;
}) {
  const router = useRouter();
  const [confirmacao, setConfirmacao] = useState("");
  const [conferi, setConferi] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function publicar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await publicarAcao(planoId, revisao, confirmacao);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    router.refresh();
  }

  async function devolver() {
    setOcupado(true);
    const r = await devolverAcao(planoId, motivo);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    router.refresh();
  }

  if (!podePublicar && !podeDevolver) {
    return (
      <Aviso titulo="Aguardando revisão">
        {autorEhVoce
          ? "Você preparou esta versão. Outra pessoa com perfil de revisor clínico precisa aprovar."
          : "Somente revisores clínicos da instituição podem aprovar esta versão."}
      </Aviso>
    );
  }

  return (
    <Cartao className="border-2 border-info">
      <h2 className="text-xl font-extrabold">Revisão clínica</h2>
      <p className="mt-1 text-muted">
        Confira a prévia abaixo como o paciente verá: medicamentos, doses, horários, duração e orientações de urgência.
      </p>
      {erro && (
        <div className="mt-3">
          <Aviso tom="danger">{erro}</Aviso>
        </div>
      )}
      {podePublicar && (
        <form onSubmit={publicar} className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} className="mt-1 size-5" />
            <span>Conferi o conteúdo com a prescrição e as orientações clínicas deste paciente.</span>
          </label>
          <Campo
            id="confirmacao"
            rotulo="Digite o prontuário do paciente para confirmar"
            dica="Evita publicar no paciente errado."
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="off"
          />
          <Botao type="submit" disabled={ocupado || !conferi || !confirmacao.trim()}>
            Aprovar e publicar
          </Botao>
        </form>
      )}
      {podeDevolver && (
        <div className="mt-6 space-y-3 border-t border-line pt-4">
          <label htmlFor="motivo-devolucao" className="block font-bold">
            Devolver para ajustes
          </label>
          <textarea
            id="motivo-devolucao"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-xl border-2 border-line bg-surface p-3"
            placeholder="O que precisa ser ajustado?"
          />
          <Botao variante="secundario" onClick={devolver} disabled={ocupado || motivo.trim().length < 3}>
            Devolver ao rascunho
          </Botao>
        </div>
      )}
    </Cartao>
  );
}
