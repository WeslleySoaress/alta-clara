import type { Metadata } from "next";
import { Marca } from "@/components/Marca";
import { FormRedefinir } from "./FormRedefinir";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Marca />
      <h1 className="mt-8 text-3xl font-extrabold">Criar nova senha</h1>
      <div className="mt-6">
        <FormRedefinir />
      </div>
    </main>
  );
}
