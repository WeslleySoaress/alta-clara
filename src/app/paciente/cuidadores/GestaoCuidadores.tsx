"use client";

import { formatarDataCurta } from "@/lib/datas";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, Campo, Cartao } from "@/components/ui";
import { cancelarConviteAcao, convidarCuidadorAcao, revogarCuidadorAcao } from "./acoes";

const ROTULO_ESCOPO: Record<string, string> = {
  ver_plano: "Ver as orientações",
  registrar_dose: "Registrar remédios tomados",
};

const dataCurta = (iso: string) => formatarDataCurta(iso);

export function GestaoCuidadores({
  pacienteId,
  instituicao,
  mostrarInstituicao,
  ativos,
  pendentes,
}: {
  pacienteId: string;
  instituicao: string;
  mostrarInstituicao: boolean;
  ativos: { id: string; nome: string; email: string; escopo: string[]; desde: string; expiraEm: string | null }[];
  pendentes: { id: string; apelido: string | null; email: string; escopo: string[] | null; expiraEm: string }[];
}) {
  const router = useRouter();
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [registrar, setRegistrar] = useState(false);
  const [validade, setValidade] = useState<"30" | "90" | "365" | "sem">("90");
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<{ svg: string; url: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [enviando, setEnviando] = useState(false);

  async function convidar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await convidarCuidadorAcao({
      pacienteId,
      apelido,
      email,
      escopo: registrar ? ["ver_plano", "registrar_dose"] : ["ver_plano"],
      validadeDias: validade === "sem" ? null : Number(validade),
    }).catch(() => ({ ok: false as const, erro: "Falha de comunicação. Tente de novo." }));
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const url = `${window.location.origin}/ativar#t=${r.token}`;
    setConvite({ url, email: r.emailMascarado, svg: await QRCode.toString(url, { type: "svg", margin: 1 }) });
    setApelido("");
    setEmail("");
    router.refresh();
  }

  async function revogar(id: string, nome: string) {
    if (!window.confirm(`Encerrar o acesso de ${nome}? A pessoa deixa de ver suas orientações imediatamente.`)) return;
    const r = await revogarCuidadorAcao(id);
    if (!r.ok) return setErro(r.erro);
    router.refresh();
  }

  async function cancelar(id: string) {
    const r = await cancelarConviteAcao(id);
    if (!r.ok) return setErro(r.erro);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {mostrarInstituicao && <h2 className="text-xl font-extrabold">{instituicao}</h2>}
      {erro && <Aviso tom="danger">{erro}</Aviso>}

      <Cartao>
        <h2 className="text-xl font-extrabold">Pessoas com acesso</h2>
        {ativos.length === 0 ? (
          <p className="mt-2 text-muted">Ninguém além de você.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {ativos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{a.nome}</p>
                  <p className="text-sm text-muted">{a.escopo.map((e) => ROTULO_ESCOPO[e] ?? e).join(" · ")}</p>
                  <p className="text-sm text-muted">
                    Desde {dataCurta(a.desde)} · {a.expiraEm ? `até ${dataCurta(a.expiraEm)}` : "até você encerrar"}
                  </p>
                </div>
                <Botao variante="perigo" onClick={() => revogar(a.id, a.nome)}>
                  Encerrar acesso
                </Botao>
              </li>
            ))}
          </ul>
        )}
        {pendentes.length > 0 && (
          <>
            <h3 className="mt-5 font-bold">Convites aguardando</h3>
            <ul className="mt-2 divide-y divide-line">
              {pendentes.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    {p.apelido} · {p.email}
                    <span className="block text-sm text-muted">Vale até {dataCurta(p.expiraEm)}</span>
                  </span>
                  <Botao variante="discreto" onClick={() => cancelar(p.id)}>
                    Cancelar convite
                  </Botao>
                </li>
              ))}
            </ul>
          </>
        )}
      </Cartao>

      {convite ? (
        <Cartao className="border-2 border-primary">
          <h2 className="text-xl font-extrabold">Convite criado</h2>
          <p className="mt-1">
            Mostre o QR code ou envie o link para a pessoa. Ela vai receber um código de confirmação em <strong>{convite.email}</strong>.
          </p>
          <div className="mt-4 size-52 rounded-xl bg-white p-2" role="img" aria-label="QR code do convite de cuidador" dangerouslySetInnerHTML={{ __html: convite.svg }} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao
              variante="secundario"
              onClick={async () => {
                await navigator.clipboard.writeText(convite.url);
                setCopiado(true);
              }}
            >
              {copiado ? "Link copiado" : "Copiar link"}
            </Botao>
            <Botao variante="discreto" onClick={() => setConvite(null)}>
              Fechar
            </Botao>
          </div>
          <p className="mt-2 text-sm text-muted">O convite vale por 72 horas e só funciona uma vez.</p>
        </Cartao>
      ) : (
        <Cartao>
          <h2 className="text-xl font-extrabold">Convidar alguém</h2>
          <form onSubmit={convidar} className="mt-3 space-y-4">
            <Campo id={`apelido-${pacienteId}`} rotulo="Quem é" dica="Ex.: Filha Ana, Vizinho João" value={apelido} onChange={(e) => setApelido(e.target.value)} />
            <Campo id={`email-${pacienteId}`} rotulo="E-mail da pessoa" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            <fieldset>
              <legend className="font-bold">O que a pessoa pode fazer</legend>
              <label className="mt-2 flex items-center gap-3">
                <input type="checkbox" checked disabled className="size-5" /> Ver as orientações
              </label>
              <label className="mt-2 flex items-center gap-3">
                <input type="checkbox" checked={registrar} onChange={(e) => setRegistrar(e.target.checked)} className="size-5" />
                Registrar remédios tomados por mim
              </label>
            </fieldset>
            <div>
              <label htmlFor={`validade-${pacienteId}`} className="font-bold">
                Por quanto tempo
              </label>
              <select
                id={`validade-${pacienteId}`}
                value={validade}
                onChange={(e) => setValidade(e.target.value as typeof validade)}
                className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3"
              >
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
                <option value="sem">Até eu encerrar</option>
              </select>
            </div>
            <Botao type="submit" disabled={enviando || apelido.trim().length < 2 || !email.includes("@")}>
              Criar convite
            </Botao>
          </form>
        </Cartao>
      )}
    </div>
  );
}
