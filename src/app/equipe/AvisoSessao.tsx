"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { manterSessaoAcao } from "./sessao-acoes";

const AVISAR_ANTES_MS = 2 * 60_000;

/** Avisa antes de a sessão expirar por inatividade e permite continuar autenticado. */
export function AvisoSessao({ expiraEmInicial, fimAbsoluto }: { expiraEmInicial: number; fimAbsoluto: number }) {
  const [expiraEm, setExpiraEm] = useState(expiraEmInicial);
  const [agora, setAgora] = useState(() => expiraEmInicial - 1e9);

  // O layout não é renderizado de novo a cada navegação: cada troca de página
  // é atividade real, então o prazo é atualizado com o servidor.
  const caminho = usePathname();
  useEffect(() => {
    let ativo = true;
    manterSessaoAcao().then((r) => {
      if (ativo && r.ok) setExpiraEm(r.expiraEm);
    });
    return () => {
      ativo = false;
    };
  }, [caminho]);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (agora >= expiraEm) {
      // Navegação completa: a sessão já não vale no servidor.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/entrar?motivo=inatividade");
    }
  }, [agora, expiraEm]);

  const restante = expiraEm - agora;
  if (restante > AVISAR_ANTES_MS) return null;

  const minutos = Math.max(0, Math.ceil(restante / 60_000));
  const absoluto = Math.abs(fimAbsoluto - expiraEm) < 1000;

  return (
    <div role="alertdialog" aria-live="assertive" aria-labelledby="aviso-sessao" className="no-print fixed inset-x-0 top-0 z-50 border-b-2 border-warn bg-warn-soft px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p id="aviso-sessao" className="font-semibold text-ink">
          {absoluto
            ? `Sua sessão atingiu a duração máxima e termina em ${minutos} min. Salve o rascunho e entre novamente.`
            : `Por segurança, sua sessão termina em ${minutos} min sem atividade.`}
        </p>
        {!absoluto && (
          <button
            type="button"
            className="min-h-11 rounded-xl bg-primary px-4 font-bold text-primary-ink"
            onClick={async () => {
              const r = await manterSessaoAcao();
              if (r.ok) setExpiraEm(r.expiraEm);
            }}
          >
            Continuar conectado
          </button>
        )}
      </div>
    </div>
  );
}
