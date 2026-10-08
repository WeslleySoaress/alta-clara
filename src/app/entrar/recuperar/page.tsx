import type { Metadata } from "next";
import { Marca } from "@/components/Marca";
import { FormRecuperar } from "./FormRecuperar";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Marca />
      <h1 className="mt-8 text-3xl font-extrabold">Recuperar acesso</h1>
      <p className="mt-2 text-muted">
        Enviaremos um link para redefinir a senha, se o e-mail tiver uma conta. O segundo fator continua
        sendo exigido depois da troca.
      </p>
      <div className="mt-6">
        <FormRecuperar />
      </div>
      <p className="mt-8 rounded-xl bg-info-soft p-4 text-ink">
        <strong>Sem acesso ao e-mail?</strong> A unidade de saúde pode ajudar a reativar sua conta com
        conferência de identidade presencial ou por telefone.
      </p>
    </main>
  );
}
