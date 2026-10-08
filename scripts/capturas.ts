// Capturas de tela do README, em desktop e celular, a partir da demonstração
// pública rodando localmente (build de produção com ALTA_MODO_DEMONSTRACAO=1
// e o seed `--demo`). Entra em cada perfil pelo botão da própria tela de login.
//
//   CAPTURAS_URL=http://localhost:3300 npx tsx scripts/capturas.ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium, type Browser, type Page } from "playwright-core";
import { carregarAmbiente } from "./ambiente";

carregarAmbiente({ operacao: true });

const BASE = process.env.CAPTURAS_URL ?? "http://localhost:3300";
if (new URL(BASE).hostname !== "localhost") throw new Error("Escopo: somente localhost.");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SAIDA = "docs/capturas";

type Tamanho = "desktop" | "celular";
const VIEWPORT = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

async function salvar(page: Page, tamanho: Tamanho, nome: string, inteira = false) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  let clip: { x: number; y: number; width: number; height: number; scale: number } | undefined;
  if (inteira) {
    const { width, height } = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: Math.min(document.documentElement.scrollHeight, 4000) }));
    clip = { x: 0, y: 0, width, height, scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", { format: "webp", quality: 82, captureBeyondViewport: inteira, ...(clip ? { clip } : {}) });
  const arquivo = path.join(SAIDA, tamanho, `${nome}.webp`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(arquivo, Buffer.from(data, "base64"));
  console.log(`  ${arquivo}`);
}

async function comPerfil(navegador: Browser, tamanho: Tamanho, perfil: string | null, fn: (page: Page) => Promise<void>) {
  const ctx = await navegador.newContext({ ...VIEWPORT[tamanho], locale: "pt-BR", timezoneId: "America/Sao_Paulo", colorScheme: "light" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  if (perfil) {
    await page.goto(`${BASE}/entrar`);
    await page.getByRole("button", { name: new RegExp(`^${perfil}`) }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
  }
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
}

async function main() {
  for (const t of ["desktop", "celular"]) mkdirSync(path.join(SAIDA, t), { recursive: true });
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_OWNER });
  const { rows } = await db.query(
    `select p.prontuario, pl.id, pl.status, pl.atendimento_id from plano pl join atendimento a on a.id = pl.atendimento_id join paciente p on p.id = a.paciente_id`,
  );
  await db.end();
  const maria = rows.find((r) => r.prontuario === "N-000101" && r.status === "publicado");
  const joao = rows.find((r) => r.prontuario === "N-000102");
  if (!maria || !joao) throw new Error("Rode antes: npm run db:seed -- --reset --demo");

  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    console.log("desktop");
    await comPerfil(navegador, "desktop", null, async (p) => {
      await p.goto(BASE);
      await salvar(p, "desktop", "01-inicio");
      await p.goto(`${BASE}/entrar`);
      await salvar(p, "desktop", "02-entrar-demonstracao");
    });
    await comPerfil(navegador, "desktop", "Enfermagem", async (p) => {
      await salvar(p, "desktop", "03-equipe-atendimentos");
      await p.goto(`${BASE}/equipe/atendimentos/${maria.atendimento_id}`);
      await salvar(p, "desktop", "04-atendimento-publicado");
      await p.goto(`${BASE}/equipe/pendencias`);
      await salvar(p, "desktop", "05-pendencias");
    });
    await comPerfil(navegador, "desktop", "Revisor", async (p) => {
      await p.goto(`${BASE}/equipe/planos/${joao.id}`);
      await salvar(p, "desktop", "06-revisao-do-plano");
    });
    await comPerfil(navegador, "desktop", "Paciente", async (p) => {
      await p.goto(`${BASE}/paciente/planos/${maria.id}`);
      await salvar(p, "desktop", "07-paciente-plano");
    });
    await comPerfil(navegador, "desktop", "Auditor", async (p) => {
      await p.goto(`${BASE}/equipe/auditoria`);
      await salvar(p, "desktop", "08-auditoria");
    });
    await comPerfil(navegador, "desktop", "Admin", async (p) => {
      await p.goto(`${BASE}/equipe/admin`);
      await salvar(p, "desktop", "09-admin-vinculos");
    });

    console.log("celular");
    await comPerfil(navegador, "celular", null, async (p) => {
      await p.goto(BASE);
      await salvar(p, "celular", "01-inicio");
      await p.goto(`${BASE}/demo`);
      await salvar(p, "celular", "05-demo-sem-conta");
    });
    await comPerfil(navegador, "celular", "Paciente", async (p) => {
      await salvar(p, "celular", "02-paciente-inicio");
      await p.goto(`${BASE}/paciente/planos/${maria.id}`);
      await salvar(p, "celular", "03-paciente-hoje");
      await p.getByRole("heading", { name: /Quando procurar ajuda/ }).first().scrollIntoViewIfNeeded();
      await salvar(p, "celular", "04-quando-procurar-ajuda");
    });
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
