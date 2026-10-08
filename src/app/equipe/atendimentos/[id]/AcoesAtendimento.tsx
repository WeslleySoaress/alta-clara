"use client";

import { formatarDataHora } from "@/lib/datas";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, Cartao } from "@/components/ui";
import { criarRascunhoAcao, gerarConviteAcao, novaVersaoAcao } from "../../acoes";

export function AcoesAtendimento({
  atendimentoId,
  modelos,
  podeCriar,
  podeNovaVersao,
  podeConvidar,
  pacienteAtivado,
}: {
  atendimentoId: string;
  modelos: { id: string; nome: string }[];
  podeCriar: boolean;
  podeNovaVersao: boolean;
  podeConvidar: boolean;
  pacienteAtivado: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {podeCriar && <CriarPlano atendimentoId={atendimentoId} modelos={modelos} />}
      {podeNovaVersao && <NovaVersao atendimentoId={atendimentoId} />}
      {podeConvidar && <Convite atendimentoId={atendimentoId} pacienteAtivado={pacienteAtivado} />}
    </div>
  );
}

function CriarPlano({ atendimentoId, modelos }: { atendimentoId: string; modelos: { id: string; nome: string }[] }) {
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const r = await criarRascunhoAcao(atendimentoId, modeloId);
    setOcupado(false);
    if (r && !r.ok) setErro(r.erro);
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Criar plano a partir de um modelo</h2>
      <p className="mt-1 text-muted">
        O modelo traz cuidados e orientações para revisão. Medicamentos nunca vêm do modelo: são incluídos a partir da
        prescrição.
      </p>
      <form onSubmit={criar} className="mt-4 space-y-4">
        <div>
          <label htmlFor="modelo" className="block font-bold">
            Modelo
          </label>
          <select id="modelo" value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3">
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-warn">Modelos desta demonstração são sintéticos e não foram validados clinicamente.</p>
        </div>
        {erro && <Aviso tom="danger">{erro}</Aviso>}
        <Botao type="submit" disabled={ocupado || !modeloId}>
          Criar rascunho
        </Botao>
      </form>
    </Cartao>
  );
}

function NovaVersao({ atendimentoId }: { atendimentoId: string }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    const r = await novaVersaoAcao(atendimentoId, motivo);
    if (r && !r.ok) setErro(r.erro);
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Alterar o plano publicado</h2>
      <p className="mt-1 text-muted">
        Cria uma nova versão em rascunho. A versão publicada continua valendo para o paciente até a nova ser aprovada.
      </p>
      <form onSubmit={abrir} className="mt-4 space-y-3">
        <label htmlFor="motivo" className="block font-bold">
          Motivo da alteração
        </label>
        <textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="w-full rounded-xl border-2 border-line bg-surface p-3" />
        {erro && <Aviso tom="danger">{erro}</Aviso>}
        <Botao type="submit" variante="secundario" disabled={motivo.trim().length < 3}>
          Abrir nova versão
        </Botao>
      </form>
    </Cartao>
  );
}

function Convite({ atendimentoId, pacienteAtivado }: { atendimentoId: string; pacienteAtivado: boolean }) {
  const [qr, setQr] = useState<{ svg: string; expiraEm: string; email: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setErro(null);
    const r = await gerarConviteAcao(atendimentoId);
    if (!r.ok) return setErro(r.erro);
    // O token vai no fragmento: não é enviado ao servidor nem aparece em logs ou no Referer.
    const url = `${window.location.origin}/ativar#t=${r.token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    setQr({ svg, expiraEm: r.expiraEm, email: r.emailMascarado });
  }

  return (
    <Cartao className="lg:col-span-2">
      <h2 className="text-xl font-extrabold">Convite de acesso do paciente</h2>
      {pacienteAtivado ? (
        <p className="mt-1 text-muted">O paciente já ativou a conta e vê a versão publicada ao entrar. Um novo convite só é necessário se ele perdeu o acesso.</p>
      ) : (
        <p className="mt-1 text-muted">
          O QR code inicia a ativação: não abre dados clínicos. O paciente confirma um código enviado ao contato registrado no
          atendimento. Gerar um novo QR code invalida o anterior.
        </p>
      )}
      {erro && (
        <div className="mt-3">
          <Aviso tom="danger">{erro}</Aviso>
        </div>
      )}
      {qr ? (
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div className="size-56 rounded-xl bg-white p-2" role="img" aria-label="QR code de ativação" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <div className="max-w-sm space-y-2">
            <p>
              Válido até <strong>{formatarDataHora(qr.expiraEm)}</strong>.
            </p>
            <p>O código de confirmação irá para {qr.email}.</p>
            <p className="text-sm text-muted">
              Este QR code não será mostrado de novo. Imprima ou mostre agora; se perder, gere outro.
            </p>
            <Botao variante="secundario" onClick={() => window.print()}>
              Imprimir
            </Botao>
          </div>
        </div>
      ) : (
        <Botao className="mt-4" onClick={gerar}>
          Gerar QR code de ativação
        </Botao>
      )}
    </Cartao>
  );
}
