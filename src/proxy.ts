import { NextResponse, type NextRequest } from "next/server";

// Rotas com dados pessoais ou segredos: nunca em cache compartilhado ou no
// histórico de páginas em cache do navegador.
const SENSIVEIS = ["/paciente", "/equipe", "/ativar", "/conta", "/entrar", "/dev", "/api/auth"];

const ehSensivel = (pathname: string) => SENSIVEIS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function semCache(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Prefetch do next/link: a resposta é o payload da rota (não um documento),
  // então não precisa de nonce — mas não pode ficar em cache se for sensível.
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (prefetch) {
    const response = NextResponse.next();
    return ehSensivel(pathname) ? semCache(response) : response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Em desenvolvimento o Next injeta estilos inline sem nonce.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return ehSensivel(pathname) ? semCache(response) : response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
