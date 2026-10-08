import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// Texto corrido: fonte criada pelo Braille Institute para leitores com baixa visão.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  // O Next ainda não tem métricas desta fonte para gerar o fallback ajustado.
  adjustFontFallback: false,
});

// Títulos: grotesca expressiva, usada só em tamanhos grandes.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "Alta Clara", template: "%s · Alta Clara" },
  description: "Seu cuidado continua em casa. Orientações de alta claras, revisadas pela equipe.",
  // A demonstração pública não deve aparecer em buscadores como se fosse um serviço de saúde.
  ...(process.env.ALTA_MODO_DEMONSTRACAO === "1" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1030" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Renderização dinâmica: cada resposta recebe o nonce da CSP (src/proxy.ts).
  await headers();

  return (
    <html lang="pt-BR" className={`${atkinson.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <p role="note" className="no-print flex items-center justify-center gap-2 bg-indigo px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-white">
          <span aria-hidden="true" className="inline-block size-2 rounded-full bg-vivo-sun" />
          Demonstração — dados fictícios. Não insira dados reais de saúde.
        </p>
        {children}
        <footer className="px-4 pb-28 pt-6 text-center text-sm text-muted print:pb-0">
          © {new Date().getFullYear()} Weslley Soares. Todos os direitos reservados.
        </footer>
      </body>
    </html>
  );
}
