"use client";

import { formatarDataCurta, formatarDataHora } from "@/lib/datas";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { Aviso, Botao, Campo, Cartao } from "@/components/ui";
import { authCliente } from "@/lib/auth-cliente";
import { encerrarSessaoAcao, listarSessoesAcao } from "./acoes";

type Etapa = { tipo: "inicio" } | { tipo: "configurando"; qr: string; segredo: string; codigos: string[] } | { tipo: "concluido" };

const MSG_LOGIN_RECENTE = "Por segurança, saia e entre novamente antes de alterar seus métodos de acesso.";

export function SegurancaConta({ mfaAtivo, profissional }: { mfaAtivo: boolean; profissional: boolean }) {
  return (
    <div className="space-y-6">
      <SegundoFator mfaAtivo={mfaAtivo} profissional={profissional} />
      <Passkeys />
      <AlterarSenha />
      <Sessoes />
    </div>
  );
}

function SegundoFator({ mfaAtivo, profissional }: { mfaAtivo: boolean; profissional: boolean }) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: mfaAtivo ? "concluido" : "inicio" });
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function iniciar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { data, error } = await authCliente.twoFactor.enable({ password: senha });
    setEnviando(false);
    setSenha("");
    if (error || !data || data.method !== "totp") {
      setErro("Senha não confere.");
      return;
    }
    const segredo = new URL(data.totpURI).searchParams.get("secret") ?? "";
    const qr = await QRCode.toString(data.totpURI, { type: "svg", margin: 1 });
    setEtapa({ tipo: "configurando", qr, segredo, codigos: data.backupCodes });
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await authCliente.twoFactor.verifyTotp({ code: codigo.replace(/\s/g, "") });
    setEnviando(false);
    if (error) {
      setErro("Código não confere. Confira o horário do celular e tente de novo.");
      return;
    }
    setEtapa({ tipo: "concluido" });
    // Navegação completa de propósito: recarrega o estado de MFA no servidor.
    window.location.assign(profissional ? "/equipe" : "/conta/seguranca");
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Verificação em duas etapas</h2>

      {etapa.tipo === "concluido" && (
        <p className="mt-2">
          <strong className="text-primary">Ativa.</strong> Ao entrar com senha, pediremos o código do seu
          aplicativo autenticador.
        </p>
      )}

      {etapa.tipo === "inicio" && (
        <form onSubmit={iniciar} className="mt-3 space-y-4">
          <p className="text-muted">
            Use um aplicativo autenticador (por exemplo, o do seu gerenciador de senhas). Confirme sua senha para
            começar.
          </p>
          <Campo
            id="senha-2fa"
            rotulo="Senha atual"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erro}
          />
          <Botao type="submit" disabled={enviando || !senha}>
            Configurar
          </Botao>
        </form>
      )}

      {etapa.tipo === "configurando" && (
        <form onSubmit={confirmar} className="mt-3 space-y-5">
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              Escaneie o QR code com o aplicativo autenticador.
              <div
                className="mt-2 size-48 rounded-xl bg-white p-2"
                role="img"
                aria-label="QR code para cadastrar o Alta Clara no aplicativo autenticador"
                dangerouslySetInnerHTML={{ __html: etapa.qr }}
              />
              <p className="mt-2 text-sm text-muted">
                Sem câmera? Digite esta chave no aplicativo:{" "}
                <code className="break-all rounded bg-bg px-1 font-mono text-ink">{etapa.segredo}</code>
              </p>
            </li>
            <li>
              Guarde os códigos de recuperação em local seguro. Cada um funciona uma única vez e eles não serão
              mostrados de novo.
              <ul className="mt-2 grid grid-cols-2 gap-2 font-mono sm:grid-cols-3">
                {etapa.codigos.map((c) => (
                  <li key={c} className="rounded-lg bg-bg px-2 py-1 text-center">
                    {c}
                  </li>
                ))}
              </ul>
              <Botao
                variante="discreto"
                className="mt-1 px-0"
                onClick={() => {
                  const blob = new Blob([`Códigos de recuperação do Alta Clara\n\n${etapa.codigos.join("\n")}\n`], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "alta-clara-codigos-recuperacao.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Baixar códigos
              </Botao>
            </li>
            <li>
              <Campo
                id="codigo-2fa"
                rotulo="Digite o código mostrado no aplicativo"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                erro={erro}
              />
            </li>
          </ol>
          <Botao type="submit" disabled={enviando || codigo.replace(/\D/g, "").length !== 6}>
            Ativar verificação em duas etapas
          </Botao>
        </form>
      )}
    </Cartao>
  );
}

type PasskeyInfo = { id: string; name?: string | null; createdAt?: Date | string | null };

function Passkeys() {
  const [lista, setLista] = useState<PasskeyInfo[] | null>(null);
  const [mensagem, setMensagem] = useState<{ tom: "info" | "danger"; texto: string } | null>(null);

  async function carregar() {
    const { data } = await authCliente.passkey.listUserPasskeys();
    setLista((data as PasskeyInfo[] | null) ?? []);
  }

  useEffect(() => {
    let ativo = true;
    authCliente.passkey.listUserPasskeys().then(({ data }) => {
      if (ativo) setLista((data as PasskeyInfo[] | null) ?? []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function adicionar() {
    setMensagem(null);
    const r = await authCliente.passkey.addPasskey({ name: "Passkey do Alta Clara" });
    if (r?.error) {
      setMensagem({ tom: "danger", texto: r.error.status === 403 ? MSG_LOGIN_RECENTE : "Não foi possível cadastrar a passkey neste aparelho." });
      return;
    }
    setMensagem({ tom: "info", texto: "Passkey cadastrada. Enviamos um aviso para o seu e-mail." });
    await carregar();
  }

  async function remover(id: string) {
    const { error } = await authCliente.passkey.deletePasskey({ id });
    if (error) {
      setMensagem({ tom: "danger", texto: error.status === 403 ? MSG_LOGIN_RECENTE : "Não foi possível remover." });
      return;
    }
    await carregar();
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Passkeys</h2>
      <p className="mt-1 text-muted">
        Entre com a biometria ou o PIN do aparelho, sem senha. A verificação acontece no seu aparelho; o Alta Clara
        não recebe digitais nem imagens do rosto.
      </p>
      {mensagem && (
        <div className="mt-3">
          <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>
        </div>
      )}
      {lista === null ? (
        <p className="mt-3 text-muted">Carregando…</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {lista.length === 0 && <li className="py-2 text-muted">Nenhuma passkey cadastrada.</li>}
          {lista.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {p.name ?? "Passkey"}
                {p.createdAt && (
                  <span className="block text-sm text-muted">
                    Cadastrada em {formatarDataCurta(p.createdAt)}
                  </span>
                )}
              </span>
              <Botao variante="discreto" onClick={() => remover(p.id)} aria-label={`Remover ${p.name ?? "passkey"}`}>
                Remover
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <Botao variante="secundario" className="mt-3" onClick={adicionar}>
        Cadastrar passkey neste aparelho
      </Botao>
    </Cartao>
  );
}

type SessaoInfo = { id: string; aparelho: string; criadaEm: string; ultimaAtividade: string; atual: boolean };

const quando = (iso: string) => formatarDataHora(iso);

function Sessoes() {
  const [lista, setLista] = useState<SessaoInfo[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarSessoesAcao().then((l) => ativo && setLista(l));
    return () => {
      ativo = false;
    };
  }, []);

  async function encerrar(id: string) {
    const r = await encerrarSessaoAcao(id);
    setAviso(r.ok ? "Sessão encerrada." : "Não foi possível encerrar esta sessão.");
    setLista(await listarSessoesAcao());
  }

  async function encerrarOutras() {
    await authCliente.revokeOtherSessions();
    setAviso("As outras sessões foram encerradas.");
    setLista(await listarSessoesAcao());
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Onde sua conta está aberta</h2>
      <p className="mt-1 text-muted">Encerre o acesso em aparelhos que você não reconhece ou não usa mais.</p>
      {aviso && (
        <p role="status" className="mt-3 font-semibold text-primary">
          {aviso}
        </p>
      )}
      {lista === null ? (
        <p className="mt-3 text-muted">Carregando…</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {lista.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className="font-bold">{s.aparelho}</span>
                {s.atual && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-sm font-bold text-primary">este aparelho</span>}
                <span className="block text-sm text-muted">
                  Entrou em {quando(s.criadaEm)} · último uso {quando(s.ultimaAtividade)}
                </span>
              </span>
              {!s.atual && (
                <Botao variante="secundario" className="min-h-11 px-4" onClick={() => encerrar(s.id)}>
                  Encerrar
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}
      {lista && lista.length > 1 && (
        <Botao variante="secundario" className="mt-3" onClick={encerrarOutras}>
          Encerrar todas as outras
        </Botao>
      )}
    </Cartao>
  );
}

function AlterarSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [msg, setMsg] = useState<{ tom: "info" | "danger"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    const { error } = await authCliente.changePassword({ currentPassword: atual, newPassword: nova, revokeOtherSessions: true });
    setOcupado(false);
    if (error) {
      setMsg({
        tom: "danger",
        texto:
          error.status === 400 && error.message && !/invalid password/i.test(error.message)
            ? error.message
            : "Não foi possível alterar. Confira a senha atual e use pelo menos 15 caracteres.",
      });
      return;
    }
    setAtual("");
    setNova("");
    setMsg({ tom: "info", texto: "Senha alterada. As sessões em outros aparelhos foram encerradas." });
  }

  return (
    <Cartao>
      <h2 className="text-xl font-extrabold">Alterar senha</h2>
      <form onSubmit={salvar} className="mt-3 space-y-4">
        <Campo id="senha-atual" rotulo="Senha atual" type={mostrar ? "text" : "password"} autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
        <Campo
          id="senha-nova"
          rotulo="Nova senha"
          dica="Pelo menos 15 caracteres. Uma frase com espaços funciona bem; senhas muito comuns são recusadas."
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} className="size-5" /> Mostrar senhas
        </label>
        {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
        <Botao type="submit" disabled={ocupado || !atual || nova.length < 15}>
          Salvar nova senha
        </Botao>
      </form>
    </Cartao>
  );
}
