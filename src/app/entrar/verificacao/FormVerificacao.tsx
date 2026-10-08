"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Botao, Campo } from "@/components/ui";
import { authCliente } from "@/lib/auth-cliente";

export function FormVerificacao() {
  const [usarRecuperacao, setUsarRecuperacao] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function verificar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const limpo = codigo.trim();
    const { error } = usarRecuperacao
      ? await authCliente.twoFactor.verifyBackupCode({ code: limpo })
      : await authCliente.twoFactor.verifyTotp({ code: limpo.replace(/\s/g, "") });
    setEnviando(false);
    if (error) {
      setErro(
        error.status === 429
          ? "Muitas tentativas. Aguarde um minuto."
          : "Código não confere ou a verificação expirou. Confira o código ou entre novamente.",
      );
      return;
    }
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/inicio");
  }

  return (
    <form onSubmit={verificar} className="space-y-4" noValidate>
      <Campo
        key={usarRecuperacao ? "rec" : "totp"}
        id="codigo"
        rotulo={usarRecuperacao ? "Código de recuperação" : "Código do autenticador"}
        dica={usarRecuperacao ? "Cada código de recuperação funciona uma única vez." : "Você pode colar o código."}
        inputMode={usarRecuperacao ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        erro={erro}
      />
      <Botao type="submit" className="w-full" disabled={enviando || !codigo.trim()}>
        {enviando ? "Verificando…" : "Verificar"}
      </Botao>
      <button
        type="button"
        onClick={() => {
          setUsarRecuperacao((v) => !v);
          setCodigo("");
          setErro(null);
        }}
        className="min-h-11 text-left font-semibold text-primary underline underline-offset-4"
      >
        {usarRecuperacao ? "Usar o aplicativo autenticador" : "Estou sem o autenticador: usar código de recuperação"}
      </button>
      <p className="text-sm text-muted">
        Perdeu o autenticador e os códigos? Procure o administrador da sua instituição.{" "}
        <Link href="/entrar" className="text-primary underline">
          Voltar
        </Link>
      </p>
    </form>
  );
}
