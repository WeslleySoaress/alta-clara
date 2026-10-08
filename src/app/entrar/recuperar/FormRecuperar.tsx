"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { authCliente } from "@/lib/auth-cliente";

export function FormRecuperar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    await authCliente.requestPasswordReset({ email: email.trim(), redirectTo: "/entrar/redefinir" });
    setEnviando(false);
    // Mesma resposta exista ou não a conta (sem enumeração).
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Aviso titulo="Pedido recebido">
        Se houver uma conta com esse e-mail, a mensagem chega em alguns minutos. O link vale por 30 minutos.{" "}
        <Link href="/entrar" className="font-semibold text-primary underline">
          Voltar para entrar
        </Link>
      </Aviso>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Campo
        id="email"
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Botao type="submit" className="w-full" disabled={enviando || !email.includes("@")}>
        {enviando ? "Enviando…" : "Enviar link"}
      </Botao>
    </form>
  );
}
