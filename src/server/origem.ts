/**
 * Proteção contra CSRF para Route Handlers que alteram estado: exige JSON e
 * cabeçalho Origin igual ao do próprio site. (Server Actions já fazem essa
 * verificação no Next.js; Route Handlers não.)
 */
export function requisicaoDaPropriaOrigem(request: Request): boolean {
  const origem = request.headers.get("origin");
  const esperado = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  const tipo = request.headers.get("content-type") ?? "";
  return origem === esperado && tipo.startsWith("application/json");
}
