// Teste de ponta a ponta no navegador real (Chrome instalado na máquina).
// Requer: `npm run db` e `npm run dev -- --port 3100` rodando.
// ATENÇÃO: recria os dados sintéticos de desenvolvimento (seed --reset).
//
//   npx tsx scripts/e2e.ts
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { carregarAmbiente } from "./ambiente";
import jsQR from "jsqr";
import pg from "pg";
import { chromium, type Page } from "playwright-core";
import { PNG } from "pngjs";

carregarAmbiente({ operacao: true });

const BASE = process.env.E2E_URL ?? "http://localhost:3100";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SAIDA = "docs/evidencias";
mkdirSync(SAIDA, { recursive: true });

const resultados: { etapa: string; ok: boolean; detalhe?: string }[] = [];
function registrar(etapa: string, ok: boolean, detalhe?: string) {
  resultados.push({ etapa, ok, detalhe });
  console.log(`${ok ? "OK   " : "FALHA"} ${etapa}${detalhe ? ` — ${detalhe}` : ""}`);
}

/** TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos) — faz o papel do aplicativo autenticador. */
function totp(segredoBase32: string, agora = Date.now()) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of segredoBase32.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const chave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)));
  const h = createHmac("sha1", chave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function credenciais() {
  const texto = readFileSync(".dev-credenciais.md", "utf8");
  const mapa: Record<string, string> = {};
  for (const m of texto.matchAll(/\| [^|]+ \| ([^ |]+) \| `([^`]+)` \|/g)) mapa[m[1]] = m[2];
  return mapa;
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto(`${BASE}/entrar`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function configurarTotp(page: Page, senha: string) {
  await page.waitForURL(/\/conta\/seguranca/);
  await page.locator("#senha-2fa").fill(senha);
  await page.getByRole("button", { name: "Configurar" }).click();
  const segredo = (await page.locator("code").first().textContent())!.trim();
  await page.getByLabel("Digite o código mostrado no aplicativo").fill(totp(segredo));
  await page.screenshot({ path: path.join(SAIDA, "02-configurar-segundo-fator.png"), fullPage: true });
  await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
  await page.waitForURL(/\/equipe$/);
  return segredo;
}

async function entrarComTotp(page: Page, email: string, senha: string, segredo: string) {
  await entrar(page, email, senha);
  await page.waitForURL(/\/entrar\/verificacao/);
  await page.getByLabel("Código do autenticador").fill(totp(segredo));
  await page.getByRole("button", { name: "Verificar" }).click();
  await page.waitForURL(/\/equipe$/);
}

async function lerQr(page: Page, nome: string) {
  const png = PNG.sync.read(await page.getByRole("img", { name: nome }).screenshot());
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? "";
}

async function sair(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/entrar\?motivo=encerrada/);
}

async function auditarAcessibilidade(page: Page, nome: string) {
  const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.addScriptTag({ content: axe });
  const r = await page.evaluate(async () => {
    // @ts-expect-error axe é injetado na página
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return res.violations.map((v: { id: string; impact: string; nodes: unknown[] }) => ({ id: v.id, impacto: v.impact, ocorrencias: v.nodes.length }));
  });
  registrar(`acessibilidade automática (axe) em ${nome}`, r.length === 0, r.length ? JSON.stringify(r) : "sem violações WCAG A/AA detectadas");
  return r;
}

async function main() {
  console.log("Recriando dados sintéticos…");
  execSync("npm run db:seed -- --reset", { stdio: "ignore" });
  const cred = credenciais();
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_OWNER });

  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctxEquipe = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const equipe = await ctxEquipe.newPage();
  equipe.setDefaultTimeout(60_000);

  try {
    // Tela de login e teclado
    await equipe.goto(`${BASE}/entrar`);
    await equipe.screenshot({ path: path.join(SAIDA, "01-entrar.png"), fullPage: true });
    await auditarAcessibilidade(equipe, "/entrar");
    const ordem: string[] = [];
    await equipe.locator("body").click({ position: { x: 5, y: 5 } });
    for (let i = 0; i < 12; i++) {
      await equipe.keyboard.press("Tab");
      ordem.push(await equipe.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName.toLowerCase()}:${el.getAttribute("aria-label") ?? el.id ?? ""}${el.textContent?.trim().slice(0, 20) ?? ""}` : "";
      }));
    }
    const alcancaFormulario = ordem.some((o) => o.startsWith("input:email")) && ordem.some((o) => o.startsWith("input:senha")) && ordem.some((o) => o.includes("Entrar"));
    registrar("login navegável por teclado (e-mail → senha → Entrar)", alcancaFormulario, ordem.join(" | "));

    // Enfermagem: primeiro acesso exige configurar o segundo fator
    await entrar(equipe, "ana.enfermagem@norte.exemplo.test", cred["ana.enfermagem@norte.exemplo.test"]);
    const segredoAna = await configurarTotp(equipe, cred["ana.enfermagem@norte.exemplo.test"]);
    registrar("profissional sem MFA é levado a configurar TOTP antes da área da equipe", true);

    await equipe.getByRole("link", { name: "Maria Exemplo da Silva" }).click();
    await equipe.getByRole("button", { name: "Criar rascunho" }).click();
    await equipe.waitForURL(/\/equipe\/planos\//);
    await equipe.getByRole("button", { name: "+ Adicionar medicamento" }).click();
    await equipe.getByLabel("Nome e concentração").fill("Medicamento demonstrativo E2E");
    await equipe.getByLabel("Para que serve (linguagem simples)").fill("Exemplo criado pelo teste de ponta a ponta.");
    await equipe.getByLabel("Dose").fill("1 comprimido (exemplo)");
    await equipe.getByRole("button", { name: "Salvar rascunho" }).click();
    await equipe.getByText("Rascunho salvo.").waitFor();
    await equipe.screenshot({ path: path.join(SAIDA, "03-editor-rascunho.png"), fullPage: true });
    await equipe.getByRole("button", { name: "Enviar para revisão" }).click();
    await equipe.getByText("Aguardando revisão").waitFor();
    registrar("enfermagem cria rascunho a partir de modelo, inclui medicamento e envia para revisão", true);
    await sair(equipe);

    // Revisor: aprova e publica (separação de funções)
    await entrar(equipe, "bruno.revisor@norte.exemplo.test", cred["bruno.revisor@norte.exemplo.test"]);
    await configurarTotp(equipe, cred["bruno.revisor@norte.exemplo.test"]);
    await auditarAcessibilidade(equipe, "/equipe");
    await equipe.getByRole("link", { name: "Maria Exemplo da Silva" }).click();
    await equipe.waitForURL(/\/equipe\/atendimentos\//);
    const urlAtendimento = equipe.url();
    await equipe.getByRole("link", { name: "Versão 1" }).click();
    await equipe.getByLabel(/Conferi o conteúdo/).check();
    await equipe.getByLabel("Digite o prontuário do paciente para confirmar").fill("N-000999");
    await equipe.getByRole("button", { name: "Aprovar e publicar" }).click();
    await equipe.getByText("O prontuário digitado não confere").waitFor();
    registrar("publicação recusada com prontuário de outro paciente", true);
    await equipe.getByLabel("Digite o prontuário do paciente para confirmar").fill("N-000101");
    await equipe.getByRole("button", { name: "Aprovar e publicar" }).click();
    await equipe.getByText("Publicado", { exact: true }).first().waitFor();
    await equipe.screenshot({ path: path.join(SAIDA, "04-publicado-previa.png"), fullPage: true });
    registrar("revisor diferente do autor aprova e publica", true);

    await equipe.goto(urlAtendimento);
    await equipe.getByRole("button", { name: "Gerar QR code de ativação" }).click();
    const qr = equipe.getByRole("img", { name: "QR code de ativação" });
    await qr.waitFor();
    // O indicador do modo dev do Next ("Rendering…") pode cobrir um canto do QR.
    await equipe.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
    await equipe.screenshot({ path: path.join(SAIDA, "05-qr-ativacao.png"), fullPage: true });
    const png = PNG.sync.read(await qr.screenshot());
    const lido = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    const urlConvite = lido?.data ?? "";
    registrar("QR code contém só a URL de ativação com token no fragmento", /\/ativar#t=[A-Za-z0-9_-]{43}$/.test(urlConvite), urlConvite.replace(/#t=.*/, "#t=<token>"));
    await sair(equipe);

    // Paciente: ativação pelo QR code
    const ctxPaciente = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", isMobile: true, hasTouch: true });
    const paciente = await ctxPaciente.newPage();
    paciente.setDefaultTimeout(60_000);
    const requisicoes: string[] = [];
    paciente.on("request", (r) => requisicoes.push(r.url()));
    await paciente.goto(urlConvite);
    await paciente.getByRole("button", { name: "Enviar código" }).waitFor();
    registrar("pré-visualização não mostra dados clínicos", !(await paciente.content()).includes("Medicamento demonstrativo"));
    registrar("token removido da barra de endereço", !paciente.url().includes("#t="), paciente.url());
    await paciente.screenshot({ path: path.join(SAIDA, "06-ativacao-previa.png"), fullPage: true });
    await paciente.getByRole("button", { name: "Enviar código" }).click();
    await paciente.getByLabel("Código recebido").waitFor();
    const { rows } = await db.query("select corpo from mensagem_dev where para = $1 order by criado_em desc limit 1", ["maria.paciente@exemplo.test"]);
    const codigo = rows[0].corpo.match(/\d{6}/)[0];
    await paciente.getByLabel("Código recebido").fill(codigo);
    await paciente.getByRole("button", { name: "Confirmar código" }).click();
    await paciente.getByLabel("Como prefere ser chamado?").fill("Maria");
    await paciente.getByLabel("Crie uma senha").fill("uma frase de teste bem comprida");
    await paciente.getByRole("button", { name: "Criar conta e ver minhas orientações" }).click();
    await paciente.waitForURL(/\/paciente$/);
    registrar("paciente ativa a conta com código no canal validado", true);
    const token = urlConvite.split("#t=")[1];
    registrar("token do convite nunca foi enviado em URL de requisição", !requisicoes.some((u) => u.includes(token)));
    if (process.env.E2E_LOG_SERVIDOR) {
      const log = readFileSync(process.env.E2E_LOG_SERVIDOR, "utf8");
      registrar("log do servidor não contém token, código nem senha", !log.includes(token) && !log.includes(codigo) && !log.includes("uma frase de teste bem comprida"));
    }

    await paciente.getByRole("link", { name: /Minhas orientações/ }).click();
    await paciente.getByText("Medicamento demonstrativo E2E").first().waitFor();
    await paciente.screenshot({ path: path.join(SAIDA, "07-paciente-plano.png"), fullPage: true });
    await auditarAcessibilidade(paciente, "plano do paciente");
    registrar("paciente correto vê o plano publicado", true);

    const marcar = paciente.getByRole("button", { name: /Marcar Medicamento demonstrativo E2E/ }).first();
    if (await marcar.count()) {
      await marcar.click();
      await paciente.getByRole("button", { name: "Desfazer" }).first().waitFor();
      await paciente.waitForTimeout(800);
      const { rows: regs } = await db.query("select situacao from registro_dose");
      registrar("registro relatado de dose salvo no servidor", regs.length === 1 && regs[0].situacao === "relatou_tomada");
    } else {
      registrar("registro relatado de dose salvo no servidor", false, "nenhuma dose do dia disponível para marcar");
    }


    // Passkey com autenticador virtual WebAuthn (DevTools do Chrome)
    const cdp = await ctxPaciente.newCDPSession(paciente);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await paciente.goto(`${BASE}/conta/seguranca`);
    await paciente.getByRole("button", { name: "Cadastrar passkey neste aparelho" }).click();
    await paciente.getByText("Passkey cadastrada").waitFor();
    // O aviso é gravado no servidor; aguarda até 5 s em vez de consultar uma vez só.
    let avisos: unknown[] = [];
    for (let i = 0; i < 10 && avisos.length === 0; i++) {
      avisos = (await db.query("select 1 from mensagem_dev where para = $1 and assunto like 'Nova passkey%'", ["maria.paciente@exemplo.test"])).rows;
      if (!avisos.length) await paciente.waitForTimeout(500);
    }
    registrar("cadastro de passkey avisa o titular por mensagem", avisos.length === 1);
    await paciente.getByRole("button", { name: "Sair" }).click();
    await paciente.waitForURL(/\/entrar/);
    await paciente.getByRole("button", { name: "Entrar com passkey" }).click();
    await paciente.waitForURL(/\/paciente$/);
    registrar("login com passkey (autenticador WebAuthn virtual, verificação do usuário)", true);

    // Confirmação de entendimento
    await paciente.getByRole("link", { name: /Minhas orientações/ }).click();
    await paciente.getByRole("link", { name: /Confirme que entendeu/ }).click();
    await auditarAcessibilidade(paciente, "confirmação de entendimento");
    for (;;) {
      await paciente.getByText("Não sei / prefiro perguntar à equipe").click();
      const ver = paciente.getByRole("button", { name: "Ver resultado" });
      if (await ver.count()) {
        await ver.click();
        break;
      }
      await paciente.getByRole("button", { name: "Próxima" }).click();
    }
    await paciente.getByText("A equipe foi avisada").first().waitFor();
    registrar("confirmação de entendimento com 'não sei' avisa a equipe", true);

    // Círculo de cuidado: convite pelo paciente, aceite com conta própria
    await paciente.goto(`${BASE}/paciente/cuidadores`);
    await auditarAcessibilidade(paciente, "/paciente/cuidadores");
    await paciente.getByLabel("Quem é").fill("Filha Joana");
    await paciente.getByLabel("E-mail da pessoa").fill("joana.cuidadora@exemplo.test");
    await paciente.getByLabel("Registrar remédios tomados por mim").check();
    await paciente.getByRole("button", { name: "Criar convite" }).click();
    const urlCuidador = await lerQr(paciente, "QR code do convite de cuidador");
    const ctxCuidador = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const cuidador = await ctxCuidador.newPage();
    cuidador.setDefaultTimeout(60_000);
    await cuidador.goto(urlCuidador);
    await cuidador.getByText(/como cuidador/).waitFor();
    await cuidador.getByRole("button", { name: "Enviar código" }).click();
    await cuidador.getByLabel("Código recebido").waitFor();
    const { rows: m2 } = await db.query("select corpo from mensagem_dev where para = $1 order by criado_em desc limit 1", ["joana.cuidadora@exemplo.test"]);
    await cuidador.getByLabel("Código recebido").fill(m2[0].corpo.match(/\d{6}/)[0]);
    await cuidador.getByRole("button", { name: "Confirmar código" }).click();
    await cuidador.getByLabel("Como prefere ser chamado?").fill("Joana");
    await cuidador.getByLabel("Crie uma senha").fill("outra frase longa para a cuidadora");
    await cuidador.getByRole("button", { name: "Criar conta e ver minhas orientações" }).click();
    await cuidador.waitForURL(/\/paciente$/);
    await cuidador.getByText("Cuidando de Maria Exemplo da Silva").waitFor();
    registrar("cuidador aceita convite com a própria conta e vê o plano autorizado", true);
    await paciente.reload();
    await paciente.getByRole("button", { name: "Encerrar acesso" }).waitFor();
    paciente.once("dialog", (d) => d.accept());
    await paciente.getByRole("button", { name: "Encerrar acesso" }).click();
    await paciente.getByText("Ninguém além de você.").waitFor();
    await cuidador.reload();
    registrar("revogação pelo paciente remove o acesso do cuidador", (await cuidador.getByText("Cuidando de Maria").count()) === 0);

    // Equipe: pendência gerada pela confirmação de entendimento
    await entrarComTotp(equipe, "ana.enfermagem@norte.exemplo.test", cred["ana.enfermagem@norte.exemplo.test"], segredoAna);
    await equipe.getByRole("link", { name: /Pendências/ }).click();
    await equipe.getByText("Orientação a reforçar").first().waitFor();
    await auditarAcessibilidade(equipe, "/equipe/pendencias");
    await equipe.screenshot({ path: path.join(SAIDA, "09-pendencias.png"), fullPage: true });
    registrar("pendência de entendimento aparece para a enfermagem do atendimento", true);

    // Demonstração pública
    await paciente.goto(`${BASE}/demo`);
    await paciente.getByText("Medicamento demonstrativo A").first().waitFor();
    await paciente.screenshot({ path: path.join(SAIDA, "08-demo-celular.png"), fullPage: true });
    await auditarAcessibilidade(paciente, "/demo");
    const largura = await paciente.evaluate(() => document.documentElement.scrollWidth);
    registrar("demo sem rolagem horizontal em 390 px", largura <= 390, `scrollWidth=${largura}`);

    // Sem sessão: área clínica inacessível
    const anonimo = await (await navegador.newContext()).newPage();
    const resp = await anonimo.goto(`${BASE}/paciente/planos/00000000-0000-0000-0000-000000000000`);
    registrar("rota do paciente sem sessão redireciona ao login", anonimo.url().includes("/entrar"), `status final ${resp?.status()}`);
  } catch (e) {
    registrar("execução", false, e instanceof Error ? e.message.split("\n")[0] : String(e));
    await equipe.screenshot({ path: path.join(SAIDA, "erro.png"), fullPage: true }).catch(() => {});
  } finally {
    await navegador.close();
    await db.end();
  }

  writeFileSync(path.join(SAIDA, "e2e-resultado.json"), JSON.stringify({ executadoEm: new Date().toISOString(), resultados }, null, 2));
  const falhas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
  process.exit(falhas ? 1 : 0);
}

main();
