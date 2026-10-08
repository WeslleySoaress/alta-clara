// Ambiente separado por processo.
//
//   .env.local           → aplicação e processador de lembretes (o Next.js só lê este)
//   .env.operacao.local  → banco, migrações, seed, backup e testes
//
// A aplicação não recebe a URL do dono do esquema, a senha do superusuário
// nem a chave dos backups: quem invade o processo web não ganha DDL nem lê
// cópias antigas.
import { config, parse } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const ARQUIVO_APP = ".env.local";
export const ARQUIVO_OPERACAO = ".env.operacao.local";

export const CHAVES_OPERACAO = [
  "PG_PORT",
  "PG_SUPERUSER_PASSWORD",
  "DB_OWNER_PASSWORD",
  "DB_APP_PASSWORD",
  "DATABASE_URL_OWNER",
  "ALTA_BACKUP_KEY",
] as const;

const ehOperacao = (linha: string) => CHAVES_OPERACAO.some((c) => linha.trimStart().startsWith(`${c}=`));

/** Move chaves de operação de um .env.local antigo para o arquivo próprio (uma vez). */
export function separarAmbienteAntigo() {
  if (!existsSync(ARQUIVO_APP)) return;
  const linhas = readFileSync(ARQUIVO_APP, "utf8").split(/\r?\n/);
  const mover = linhas.filter(ehOperacao);
  if (!mover.length) return;

  const existentes = existsSync(ARQUIVO_OPERACAO) ? parse(readFileSync(ARQUIVO_OPERACAO)) : {};
  const novas = mover.filter((l) => !(l.split("=")[0].trim() in existentes));
  if (novas.length) {
    const cabecalho = existsSync(ARQUIVO_OPERACAO)
      ? readFileSync(ARQUIVO_OPERACAO, "utf8").trimEnd() + "\n"
      : "# Segredos de operação (banco, migrações, backup). A aplicação web NÃO lê este arquivo.\n";
    writeFileSync(ARQUIVO_OPERACAO, cabecalho + novas.join("\n") + "\n", { mode: 0o600 });
  }
  writeFileSync(ARQUIVO_APP, linhas.filter((l) => !ehOperacao(l)).join("\n"), { mode: 0o600 });
  console.log(`Segredos de operação movidos de ${ARQUIVO_APP} para ${ARQUIVO_OPERACAO}.`);
}

/** Valores dos dois arquivos, sem tocar em process.env. */
export function lerAmbiente(opcoes: { operacao: boolean }): Record<string, string> {
  separarAmbienteAntigo();
  const ler = (arq: string) => (existsSync(arq) ? parse(readFileSync(arq)) : {});
  return { ...ler(ARQUIVO_APP), ...(opcoes.operacao ? ler(ARQUIVO_OPERACAO) : {}) };
}

/** Carrega em process.env: só o da aplicação, ou também o de operação. */
export function carregarAmbiente(opcoes: { operacao: boolean }) {
  separarAmbienteAntigo();
  const caminhos = opcoes.operacao ? [ARQUIVO_APP, ARQUIVO_OPERACAO] : [ARQUIVO_APP];
  config({ path: caminhos.filter(existsSync), override: true, quiet: true });
  if (opcoes.operacao) process.env.ALTA_PROCESSO_OPERACAO = "1";
}
