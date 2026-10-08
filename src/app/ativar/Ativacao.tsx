"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { concluirComSenhaAcao, verificarCodigoAcao, vincularContaAtualAcao } from "./acoes";

async function postarConvite(corpo: { token: string; acao: "previa" | "iniciar" }) {
  const r = await fetch("/ativar/iniciar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });
  return r.json();
}

type TipoConvite = "paciente" | "cuidador";

type Etapa =
  | { tipo: "lendo" }
  | { tipo: "sem_convite" }
  | { tipo: "erro"; estado: string }
  | { tipo: "previa"; instituicao: string; emailMascarado: string; convite: TipoConvite }
  | { tipo: "codigo"; instituicao: string; emailMascarado: string; convite: TipoConvite }
  | { tipo: "conta"; instituicao: string; emailMascarado: string; convite: TipoConvite };

const MENSAGENS_ESTADO: Record<string, string> = {
  expirado: "Este convite expirou. Peça um novo QR code à equipe da unidade. Suas orientações continuam guardadas.",
  revogado: "Este convite foi substituído por outro mais recente. Use o QR code mais novo que você recebeu.",
  usado: "Este convite já foi usado. Se a conta é sua, entre com seu e-mail e senha.",
  inexistente: "Não reconhecemos este QR code. Confira se a imagem está completa ou peça um novo à equipe.",
  aguarde: "Acabamos de enviar um código. Aguarde um minuto antes de pedir outro.",
  rede: "Não conseguimos falar com o servidor. Verifique a internet e abra o QR code de novo.",
};

export function Ativacao({
  andamento,
  contaLogada,
  demonstracao = false,
}: {
  andamento: { instituicao: string; emailMascarado: string; codigoVerificado: boolean; convite: TipoConvite } | null;
  contaLogada: boolean;
  demonstracao?: boolean;
}) {
  const token = useRef<string | null>(null);
  const lido = useRef(false);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "lendo" });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    // Executa uma única vez por montagem real (o modo estrito do React roda efeitos duas vezes em desenvolvimento).
    if (lido.current) return;
    lido.current = true;
    // O token vem no fragmento (#t=...), que o navegador não envia ao servidor.
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    const t = fragmento.get("t");
    if (t) {
      token.current = t;
      window.history.replaceState(window.history.state, "", "/ativar");
      postarConvite({ token: t, acao: "previa" })
        .then((r) =>
          setEtapa(
            r.estado === "valido"
              ? { tipo: "previa", instituicao: r.instituicao!, emailMascarado: r.emailMascarado!, convite: r.tipo }
              : { tipo: "erro", estado: r.estado },
          ),
        )
        .catch(() => setEtapa({ tipo: "erro", estado: "rede" }));
    } else if (andamento) {
      queueMicrotask(() =>
        setEtapa({ tipo: andamento.codigoVerificado ? "conta" : "codigo", instituicao: andamento.instituicao, emailMascarado: andamento.emailMascarado, convite: andamento.convite }),
      );
    } else {
      queueMicrotask(() => setEtapa({ tipo: "sem_convite" }));
    }
  }, [andamento]);

  async function continuar() {
    if (!token.current || etapa.tipo !== "previa") return;
    setOcupado(true);
    const r = await postarConvite({ token: token.current, acao: "iniciar" }).catch(() => ({ ok: false, erro: "inexistente" }));
    setOcupado(false);
    if (!r.ok) {
      setEtapa({ tipo: "erro", estado: r.erro });
      return;
    }
    token.current = null;
    setEtapa({ tipo: "codigo", instituicao: etapa.instituicao, emailMascarado: etapa.emailMascarado, convite: etapa.convite });
  }

  if (etapa.tipo === "lendo") return <p className="text-muted">Lendo o convite…</p>;

  if (etapa.tipo === "sem_convite") {
    return (
      <Aviso titulo="Abra pelo QR code">
        Para ativar o acesso, escaneie o QR code que a equipe entregou na sua alta. Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-primary underline">
          Entrar
        </Link>
      </Aviso>
    );
  }

  if (etapa.tipo === "erro") {
    return (
      <Aviso tom="warn" titulo="Não foi possível continuar">
        {MENSAGENS_ESTADO[etapa.estado] ?? MENSAGENS_ESTADO.inexistente}
      </Aviso>
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-primary-soft p-4">
        {etapa.convite === "cuidador" ? (
          <>
            Convite para acompanhar, como <strong>cuidador</strong>, as orientações de um paciente de{" "}
            <strong>{etapa.instituicao}</strong>. Você terá a sua própria conta.
          </>
        ) : (
          <>
            Convite de <strong>{etapa.instituicao}</strong>.
          </>
        )}
      </p>

      {etapa.tipo === "previa" && (
        <>
          <p className="text-lg">
            Vamos enviar um código para <strong>{etapa.emailMascarado}</strong>
            {etapa.convite === "cuidador" ? ", o e-mail informado no convite." : ", o contato registrado no seu atendimento."}
            Nenhuma informação de saúde aparece antes dessa confirmação.
          </p>
          <Botao className="w-full" onClick={continuar} disabled={ocupado}>
            {ocupado ? "Enviando…" : "Enviar código"}
          </Botao>
          <p className="text-sm text-muted">
            Este não é o seu e-mail ou você não tem acesso a ele? A unidade pode fazer a ativação com você, com conferência
            de identidade.
          </p>
        </>
      )}

      {etapa.tipo === "codigo" && (
        <EtapaCodigo email={etapa.emailMascarado} demonstracao={demonstracao} onOk={() => setEtapa({ ...etapa, tipo: "conta" })} />
      )}

      {etapa.tipo === "conta" && <EtapaConta contaLogada={contaLogada} />}
    </div>
  );
}

function EtapaCodigo({ email, demonstracao, onOk }: { email: string; demonstracao: boolean; onOk: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await verificarCodigoAcao(codigo);
    setOcupado(false);
    if (r.ok) return onOk();
    setErro(
      r.motivo === "tentativas"
        ? "Muitas tentativas. Escaneie o QR code de novo para receber outro código."
        : r.motivo === "expirado"
          ? "O código expirou. Escaneie o QR code de novo para receber outro."
          : r.motivo === "errado"
            ? `Código não confere. Tentativas restantes: ${"restantes" in r ? r.restantes : 0}.`
            : "Não foi possível verificar. Escaneie o QR code de novo.",
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p>
        Enviamos um código de 6 números para <strong>{email}</strong>. Ele vale por 10 minutos.
      </p>
      {demonstracao && (
        <p className="rounded-xl bg-violet-soft p-3 text-sm text-violet">
          Demonstração: o paciente é fictício, então o código está na{" "}
          <a href="/dev/mensagens" target="_blank" rel="noopener" className="font-bold underline">
            caixa de mensagens simulada
          </a>
          .
        </p>
      )}
      <Campo
        id="codigo"
        rotulo="Código recebido"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        erro={erro}
      />
      <Botao type="submit" className="w-full" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6}>
        Confirmar código
      </Botao>
      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-xl bg-warn-soft p-3 text-sm text-ink">
          Ambiente de desenvolvimento: as mensagens não saem da máquina. Veja o código em{" "}
          <a href="/dev/mensagens" target="_blank" className="font-semibold text-primary underline">
            /dev/mensagens
          </a>
          .
        </p>
      )}
    </form>
  );
}

function EtapaConta({ contaLogada }: { contaLogada: boolean }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await concluirComSenhaAcao({ nome, senha });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/paciente");
  }

  async function vincular() {
    setOcupado(true);
    const r = await vincularContaAtualAcao();
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/paciente");
  }

  return (
    <div className="space-y-6">
      <p className="font-semibold text-primary" role="status">
        Código confirmado.
      </p>
      {contaLogada && (
        <div className="space-y-2">
          <p>Você já está conectado. Se esta é a conta do convite, basta vincular.</p>
          <Botao variante="secundario" className="w-full" onClick={vincular} disabled={ocupado}>
            Vincular à minha conta
          </Botao>
        </div>
      )}
      <form onSubmit={criar} className="space-y-4">
        <h2 className="text-xl font-extrabold">Crie sua conta</h2>
        <Campo id="nome" rotulo="Como prefere ser chamado?" autoComplete="nickname" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo
          id="senha"
          rotulo="Crie uma senha"
          dica="Pelo menos 15 caracteres. Uma frase fácil de lembrar funciona bem, com espaços. Pode colar do gerenciador de senhas."
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          acessorio={
            <button type="button" onClick={() => setMostrar((v) => !v)} aria-pressed={mostrar} className="min-h-12 shrink-0 rounded-xl border-2 border-line px-3 text-sm font-bold text-primary">
              {mostrar ? "Ocultar" : "Mostrar"}
            </button>
          }
        />
        {erro && (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">
            {erro}
          </p>
        )}
        <Botao type="submit" className="w-full" disabled={ocupado || senha.length < 15 || nome.trim().length < 2}>
          {ocupado ? "Criando…" : "Criar conta e ver minhas orientações"}
        </Botao>
        <p className="text-sm text-muted">Depois de entrar, você pode cadastrar uma passkey em Segurança da conta.</p>
      </form>
    </div>
  );
}
