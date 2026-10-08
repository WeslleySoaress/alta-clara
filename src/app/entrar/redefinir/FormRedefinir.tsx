"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { authCliente } from "@/lib/auth-cliente";

export function FormRedefinir() {
  const token = useRef<string | null>(null);
  const [semToken, setSemToken] = useState(false);
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Lê o token uma vez e o retira da barra de endereço e do histórico.
  useEffect(() => {
    const url = new URL(window.location.href);
    token.current = url.searchParams.get("token");
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname);
    if (!token.current) queueMicrotask(() => setSemToken(true));
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!token.current) return;
    setErro(null);
    setEnviando(true);
    const { error } = await authCliente.resetPassword({ newPassword: senha, token: token.current });
    setEnviando(false);
    if (error) {
      setErro(
        error.status === 400 && /password/i.test(error.message ?? "")
          ? "Use pelo menos 15 caracteres. Uma frase com espaços funciona bem."
          : "Este link é inválido ou expirou. Peça um novo.",
      );
      return;
    }
    // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/entrar?motivo=senha_redefinida");
  }

  if (semToken) {
    return (
      <Aviso tom="warn" titulo="Link incompleto ou já usado">
        <Link href="/entrar/recuperar" className="font-semibold text-primary underline">
          Peça um novo link
        </Link>
        .
      </Aviso>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Campo
        id="nova-senha"
        rotulo="Nova senha"
        dica="Pelo menos 15 caracteres. Pode usar espaços e colar do seu gerenciador de senhas."
        type={mostrar ? "text" : "password"}
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        erro={erro}
        acessorio={
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-pressed={mostrar}
            className="min-h-12 shrink-0 rounded-xl border-2 border-line px-3 text-sm font-bold text-primary"
          >
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        }
      />
      <Botao type="submit" className="w-full" disabled={enviando || senha.length < 15}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </Botao>
    </form>
  );
}
