import type { NextConfig } from "next";

const producao = process.env.NODE_ENV === "production";

// Cabeçalhos válidos para todas as respostas. A CSP com nonce e o
// Cache-Control das rotas sensíveis ficam em src/proxy.ts.
const cabecalhos = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(producao ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Sem o indicador flutuante do modo dev (cobria botões e o QR nas capturas).
  devIndicators: false,
  logging: {
    // Em desenvolvimento o Next registra os argumentos das Server Functions no
    // terminal — isso exporia códigos, senhas e tokens. Desligado.
    serverFunctions: false,
    // O link de redefinição de senha leva o token no caminho.
    incomingRequests: { ignore: [/\/api\/auth\/reset-password\//] },
  },
  serverExternalPackages: ["@node-rs/argon2", "embedded-postgres"],
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
};

export default nextConfig;
