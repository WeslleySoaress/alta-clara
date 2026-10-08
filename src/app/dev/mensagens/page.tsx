import { formatarDataHora } from "@/lib/datas";
import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/server/db/cliente";
import { mensagemDev } from "@/server/db/schema";
import { modoDemonstracao } from "@/server/demonstracao";

export const metadata: Metadata = { title: "Caixa de mensagens (desenvolvimento)", robots: { index: false, follow: false } };

/**
 * ADAPTADOR LOCAL DE DESENVOLVIMENTO. Mostra as mensagens que, em produção,
 * iriam por e-mail/SMS. Não existe em produção (404), exceto na demonstração
 * pública, onde todo destinatário é fictício e a redefinição de senha está
 * desligada (ver src/server/demonstracao.ts).
 */
export default async function Page() {
  const demonstracao = modoDemonstracao();
  if (!demonstracao) {
    if (process.env.NODE_ENV === "production") notFound();
    // Mesmo em desenvolvimento, só para quem acessa pelo próprio computador:
    // a caixa contém links de redefinição e códigos de ativação.
    const host = ((await headers()).get("host") ?? "").split(":")[0];
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) notFound();
  }
  const mensagens = await db.select().from(mensagemDev).orderBy(desc(mensagemDev.criadoEm)).limit(30);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <p className="rounded-xl bg-warn-soft p-3 font-semibold text-warn">
        {demonstracao
          ? "Demonstração pública: aqui aparecem os e-mails e SMS que iriam para as pessoas fictícias — por exemplo, o código de ativação do paciente. Nenhuma mensagem é enviada de verdade."
          : "Ferramenta de desenvolvimento: substitui o envio real de e-mail. Nada aqui sai da máquina."}
      </p>
      <h1 className="mt-6 text-3xl font-extrabold">Caixa de mensagens{demonstracao ? " simulada" : ""}</h1>
      <ul className="mt-6 space-y-4">
        {mensagens.length === 0 && <li className="text-muted">Nenhuma mensagem.</li>}
        {mensagens.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">
              Para <strong className="text-ink">{m.para}</strong> · {formatarDataHora(m.criadoEm, true)}
            </p>
            <p className="mt-1 text-lg font-bold">{m.assunto}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{m.corpo}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
