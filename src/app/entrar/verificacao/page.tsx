import type { Metadata } from "next";
import { Marca } from "@/components/Marca";
import { FormVerificacao } from "./FormVerificacao";

export const metadata: Metadata = { title: "Verificação adicional" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Marca />
      <h1 className="mt-8 text-3xl font-extrabold">Verificação adicional</h1>
      <p className="mt-2 text-muted">
        Abra o aplicativo autenticador cadastrado na sua conta e digite o código de 6 números.
      </p>
      <div className="mt-6">
        <FormVerificacao />
      </div>
    </main>
  );
}
