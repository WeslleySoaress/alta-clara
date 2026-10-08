import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Não encontramos estas orientações</h1>
      <p className="mt-4 text-lg">
        Confira se o endereço está completo ou escaneie o QR code de novo. Se o problema continuar,
        procure a unidade onde você foi atendido.
      </p>
      <Link href="/" className="mt-8 inline-block font-semibold text-primary underline">
        Página inicial
      </Link>
    </main>
  );
}
