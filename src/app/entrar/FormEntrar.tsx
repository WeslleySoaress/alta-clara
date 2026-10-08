"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { IconeCoracao, IconeEstetoscopio, IconePessoa } from "@/components/Icones";
import { Botao, Campo } from "@/components/ui";
import { authCliente } from "@/lib/auth-cliente";

// A escolha de perfil só organiza a interface (textos e dicas).
// Permissões vêm sempre do servidor.
const PERFIS = [
  { id: "paciente", rotulo: "Sou paciente", dica: "Use o e-mail cadastrado na ativação da sua conta." },
  { id: "cuidador", rotulo: "Sou cuidador", dica: "Entre com a sua própria conta de cuidador, nunca com a do paciente." },
  { id: "profissional", rotulo: "Sou profissional", dica: "Conta fornecida pela instituição. O segundo fator é obrigatório." },
] as const;

const semAssinatura = () => () => {};

const ESTILO_PERFIL = {
  paciente: { simbolo: <IconePessoa tamanho={22} />, icone: "bg-primary-soft text-primary", marcado: "has-checked:border-primary has-checked:bg-primary-soft" },
  cuidador: { simbolo: <IconeCoracao tamanho={22} />, icone: "bg-violet-soft text-violet", marcado: "has-checked:border-violet has-checked:bg-violet-soft" },
  profissional: { simbolo: <IconeEstetoscopio tamanho={22} />, icone: "bg-coral-soft text-coral", marcado: "has-checked:border-coral has-checked:bg-coral-soft" },
} as const;

export function FormEntrar({ esconderRecuperacao = false }: { esconderRecuperacao?: boolean }) {
  const [perfil, setPerfil] = useState<(typeof PERFIS)[number]["id"]>("paciente");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const suportaPasskey = useSyncExternalStore(
    semAssinatura,
    () => typeof window.PublicKeyCredential === "function",
    () => true,
  );

  async function entrarComSenha(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { data, error } = await authCliente.signIn.email({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) {
      // Mensagem única: não revela se o e-mail existe.
      setErro(
        error.status === 429
          ? "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."
          : "Não foi possível entrar com esses dados. Confira o e-mail e a senha.",
      );
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return; // o cliente redireciona
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/inicio");
  }

  async function entrarComPasskey() {
    setErro(null);
    setEnviando(true);
    const resultado = await authCliente.signIn.passkey();
    setEnviando(false);
    if (resultado?.error) {
      setErro("Não foi possível entrar com a passkey. Tente de novo ou use e-mail e senha.");
      return;
    }
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/inicio");
  }

  const dica = PERFIS.find((p) => p.id === perfil)!.dica;

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Como você vai usar o Alta Clara?</legend>
        <div className="grid grid-cols-3 gap-3">
          {PERFIS.map((p) => {
            const estilo = ESTILO_PERFIL[p.id];
            return (
              <label
                key={p.id}
                className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-2 py-3 text-center text-sm font-bold shadow-suave transition hover:-translate-y-0.5 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) ${estilo.marcado}`}
              >
                <input type="radio" name="perfil" value={p.id} checked={perfil === p.id} onChange={() => setPerfil(p.id)} className="sr-only" />
                <span className={`grid size-10 place-items-center rounded-xl ${estilo.icone}`}>{estilo.simbolo}</span>
                {p.rotulo}
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {dica}
        </p>
      </fieldset>

      {suportaPasskey ? (
        <div>
          <Botao variante="secundario" className="min-h-14 w-full text-lg" onClick={entrarComPasskey} disabled={enviando}>
            Entrar com passkey
          </Botao>
          <p className="mt-1.5 text-sm text-muted">
            Usa a biometria ou o PIN do seu aparelho. O Alta Clara não recebe sua digital nem seu rosto.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-info-soft p-3 text-sm text-ink">
          Este navegador não oferece passkeys. Use e-mail e senha abaixo.
        </p>
      )}

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={entrarComSenha} className="space-y-4" noValidate>
        <Campo
          id="email"
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          id="senha"
          rotulo="Senha"
          type={mostrarSenha ? "text" : "password"}
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          acessorio={
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-pressed={mostrarSenha}
              aria-controls="senha"
              className="min-h-12 shrink-0 rounded-xl border-2 border-line px-3 text-sm font-bold text-primary"
            >
              {mostrarSenha ? "Ocultar" : "Mostrar"}
            </button>
          }
        />
        {erro && (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 font-semibold text-danger">
            {erro}
          </p>
        )}
        <Botao type="submit" className="min-h-14 w-full text-lg" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Botao>
      </form>

      {!esconderRecuperacao && (
        <p>
          <Link href="/entrar/recuperar" className="font-semibold text-primary underline underline-offset-4">
            Esqueci minha senha
          </Link>
        </p>
      )}
    </div>
  );
}
