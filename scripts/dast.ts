// Teste dinâmico de segurança (DAST) LIMITADO à aplicação local de
// desenvolvimento (http://localhost:3100) — o único ambiente autorizado.
// Não aponte para outro endereço. Requer o E2E já executado (contas de teste).
//
//   npx tsx scripts/dast.ts
import { carregarAmbiente } from "./ambiente";
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";

carregarAmbiente({ operacao: true });

const BASE = process.env.DAST_URL ?? "http://localhost:3100";
if (new URL(BASE).hostname !== "localhost") throw new Error("Escopo: somente localhost.");

const resultados: { verificacao: string; ok: boolean; detalhe?: string }[] = [];
const registrar = (verificacao: string, ok: boolean, detalhe?: string) => {
  resultados.push({ verificacao, ok, detalhe });
  console.log(`${ok ? "OK   " : "FALHA"} ${verificacao}${detalhe ? ` — ${detalhe}` : ""}`);
};

const req = (caminho: string, init: RequestInit = {}) => fetch(`${BASE}${caminho}`, { redirect: "manual", ...init });

async function entrar(email: string, senha: string) {
  const r = await req("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: senha }),
  });
  return { status: r.status, cookies: r.headers.getSetCookie(), cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}

// Quadros de pilha reais ("    at função (arquivo:linha:coluna)"); IDs de módulo do modo dev não contam.
const temStack = (texto: string) => /\n\s+at [\w.<>$]+ \([^)]*:\d+:\d+\)/.test(texto);

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_OWNER });
  const { rows: planos } = await db.query("select id from plano where status = 'publicado' limit 1");
  const planoId: string | undefined = planos[0]?.id;

  // 1. Cabeçalhos
  for (const rota of ["/", "/entrar", "/demo", "/ativar"]) {
    const r = await req(rota);
    const h = r.headers;
    const faltando = ["content-security-policy", "referrer-policy", "x-content-type-options", "x-frame-options"].filter((k) => !h.get(k));
    registrar(`cabeçalhos de segurança em ${rota}`, faltando.length === 0, faltando.length ? `faltando: ${faltando.join(", ")}` : undefined);
    registrar(`sem X-Powered-By em ${rota}`, !h.get("x-powered-by"));
  }

  // 2. Rotas protegidas sem sessão
  for (const rota of ["/paciente", "/equipe", "/equipe/pendencias", "/equipe/admin", "/conta/seguranca"]) {
    const r = await req(rota);
    registrar(`sem sessão: ${rota} redireciona ao login`, r.status === 307 && (r.headers.get("location") ?? "").includes("/entrar"));
  }
  if (planoId) {
    const r = await req(`/equipe/planos/${planoId}/fhir`);
    registrar("sem sessão: exportação FHIR responde 404", r.status === 404);
  }

  // 3. Injeção e travessia em parâmetros de rota: nunca 500, nunca stack trace
  for (const carga of ["'%20or%201=1--", "..%2F..%2Fetc%2Fpasswd", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", "00000000-0000-0000-0000-000000000000"]) {
    const r = await req(`/demo/${carga}`);
    const corpo = await r.text();
    registrar(`carga maliciosa na rota (${decodeURIComponent(carga).slice(0, 24)})`, r.status < 500 && !temStack(corpo) && !corpo.includes("<script>alert(1)"), `status ${r.status}`);
  }

  // 4. IDOR com sessão real: cuidadora revogada tenta abrir o plano da paciente
  const cuidadora = await entrar("joana.cuidadora@exemplo.test", "outra frase longa para a cuidadora");
  if (cuidadora.status === 200 && planoId) {
    const r = await req(`/paciente/planos/${planoId}`, { headers: { cookie: cuidadora.cookie } });
    registrar("IDOR: cuidadora revogada não abre o plano (404)", r.status === 404);
    const f = await req(`/equipe/planos/${planoId}/fhir`, { headers: { cookie: cuidadora.cookie } });
    registrar("IDOR: não profissional não exporta FHIR (404)", f.status === 404);
    // Em produção o nome ganha o prefixo __Secure- (cookie só trafega por HTTPS).
    const sessao = cuidadora.cookies.find((c) => /^(__Secure-)?alta\.session_token=/.test(c));
    const producao = sessao?.startsWith("__Secure-") ?? false;
    registrar(
      `cookie de sessão HttpOnly, SameSite${producao ? " e Secure" : ""}`,
      Boolean(sessao && /HttpOnly/i.test(sessao) && /SameSite=(Lax|Strict)/i.test(sessao) && (!producao || /;\s*Secure/i.test(sessao))),
      sessao?.replace(/=[^;]+/, "=<valor>"),
    );
    // Página e prefetch (payload do next/link) de área com dados pessoais: sem cache.
    const pagina = await req("/paciente", { headers: { cookie: cuidadora.cookie } });
    registrar("área do paciente: página com no-store", /no-store/.test(pagina.headers.get("cache-control") ?? ""), pagina.headers.get("cache-control") ?? "sem cabeçalho");
    const pre = await req("/paciente", { headers: { cookie: cuidadora.cookie, rsc: "1", "next-router-prefetch": "1" } });
    registrar("área do paciente: prefetch com no-store", /no-store/.test(pre.headers.get("cache-control") ?? ""), pre.headers.get("cache-control") ?? "sem cabeçalho");
  } else {
    registrar("IDOR com sessão real", false, "conta da cuidadora não encontrada — rode o E2E antes");
  }

  // 5. CSRF / origem
  const ativ = await req("/ativar/iniciar", { method: "POST", headers: { "content-type": "application/json", origin: "https://ataque.example" }, body: JSON.stringify({ token: "x", acao: "previa" }) });
  registrar("CSRF: ativação com Origin de outro site é recusada", ativ.status === 403);
  const ativForm = await req("/ativar/iniciar", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE }, body: "token=x" });
  registrar("CSRF: ativação exige JSON (formulário simples recusado)", ativForm.status === 403);
  const loginFora = await req("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ataque.example" },
    body: JSON.stringify({ email: "x@exemplo.test", password: "y".repeat(20) }),
  });
  registrar("CSRF: login com Origin de outro site é recusado", loginFora.status === 403, `status ${loginFora.status}`);

  // 6. Redirecionamento aberto na recuperação de senha
  const redir = await req("/api/auth/request-password-reset", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "maria.paciente@exemplo.test", redirectTo: "https://ataque.example/roubar" }),
  });
  registrar("redirecionamento para domínio externo é recusado", redir.status >= 400 && redir.status < 500, `status ${redir.status}`);

  // 7. Erros sem detalhes internos
  const ruim = await req("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: "{json inválido" });
  registrar("JSON malformado não expõe stack trace", !temStack(await ruim.text()), `status ${ruim.status}`);

  // 8. Limitação de tentativas de login (por último: bloqueia este IP por 1 min)
  let bloqueou = 0;
  for (let i = 1; i <= 12; i++) {
    const r = await entrar("ninguem@exemplo.test", `senha errada numero ${i} longa`);
    if (r.status === 429) {
      bloqueou = i;
      break;
    }
  }
  registrar("força bruta: login limitado (429) em até 11 tentativas por minuto", bloqueou > 0 && bloqueou <= 11, `bloqueou na tentativa ${bloqueou}`);

  await db.end();
  mkdirSync("docs/evidencias", { recursive: true });
  writeFileSync("docs/evidencias/dast-local.json", JSON.stringify({ executadoEm: new Date().toISOString(), escopo: BASE, resultados }, null, 2));
  const falhas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
  process.exit(falhas ? 1 : 0);
}

main();
