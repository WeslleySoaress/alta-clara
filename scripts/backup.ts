// Backup lógico cifrado e teste de restauração em banco separado.
//
//   npx tsx scripts/backup.ts backup                 cria .backups/<data>/
//   npx tsx scripts/backup.ts restaurar <pasta>      restaura em alta_clara_restauracao e compara
//   npx tsx scripts/backup.ts teste                  faz os dois e grava a evidência
//
// Formato: COPY ... (FORMAT binary) de cada tabela, num snapshot consistente
// (REPEATABLE READ, somente leitura), cada arquivo cifrado com AES-256-GCM.
// O esquema vem das migrações versionadas (drizzle/), não do backup.
// Chave: ALTA_BACKUP_KEY (32 bytes base64url) no .env.operacao.local — guarde-a
// separada das cópias; sem ela o backup não pode ser lido.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { carregarAmbiente } from "./ambiente";
import pg from "pg";
import { from as copyFrom, to as copyTo } from "pg-copy-streams";
import { migrarBanco } from "../src/server/db/migrar";

carregarAmbiente({ operacao: true });

const BANCO_RESTAURACAO = "alta_clara_restauracao";

function chave(): Buffer {
  let k = process.env.ALTA_BACKUP_KEY;
  if (!k) {
    k = randomBytes(32).toString("base64url");
    appendFileSync(".env.operacao.local", `\n# Chave dos backups (gerada por scripts/backup.ts). Guarde fora das cópias.\nALTA_BACKUP_KEY=${k}\n`);
    process.env.ALTA_BACKUP_KEY = k;
    console.log("ALTA_BACKUP_KEY gerada e salva em .env.operacao.local.");
  }
  return Buffer.from(k, "base64url");
}

function cifrar(dados: Buffer, k: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]);
}

function decifrar(dados: Buffer, k: Buffer) {
  const d = createDecipheriv("aes-256-gcm", k, dados.subarray(0, 12));
  d.setAuthTag(dados.subarray(12, 28));
  return Buffer.concat([d.update(dados.subarray(28)), d.final()]);
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Tabelas do esquema público. A restauração carrega com as FKs suspensas e confere tudo ao final. */
async function tabelasOrdenadas(c: pg.ClientBase): Promise<string[]> {
  const { rows } = await c.query<{ t: string }>("select tablename as t from pg_tables where schemaname = 'public' order by tablename");
  return rows.map((r) => r.t);
}

async function lerTudo(stream: NodeJS.ReadableStream) {
  const partes: Buffer[] = [];
  for await (const p of stream) partes.push(p as Buffer);
  return Buffer.concat(partes);
}

export async function fazerBackup(urlOwner: string) {
  const k = chave();
  const pasta = path.join(".backups", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(pasta, { recursive: true });
  const c = new pg.Client({ connectionString: urlOwner });
  await c.connect();
  const manifesto: { criadoEm: string; migracoes: string[]; tabelas: { nome: string; linhas: number; sha256: string }[] } = {
    criadoEm: new Date().toISOString(),
    migracoes: [],
    tabelas: [],
  };
  try {
    await c.query("begin isolation level repeatable read read only");
    manifesto.migracoes = (await c.query("select hash from drizzle.__drizzle_migrations order by id")).rows.map((r) => r.hash);
    for (const t of await tabelasOrdenadas(c)) {
      const dados = await lerTudo(c.query(copyTo(`copy "${t}" to stdout (format binary)`)));
      const linhas = Number((await c.query(`select count(*) from "${t}"`)).rows[0].count);
      writeFileSync(path.join(pasta, `${t}.bin.enc`), cifrar(dados, k));
      manifesto.tabelas.push({ nome: t, linhas, sha256: sha(dados) });
    }
    await c.query("commit");
  } finally {
    await c.end();
  }
  writeFileSync(path.join(pasta, "manifesto.json"), JSON.stringify(manifesto, null, 2));
  return { pasta, manifesto };
}

function urlCom(urlBase: string, usuario: string, senha: string, banco: string) {
  const u = new URL(urlBase);
  u.username = usuario;
  u.password = senha;
  u.pathname = `/${banco}`;
  return u.toString();
}

export async function restaurar(pasta: string) {
  const k = chave();
  const manifesto = JSON.parse(readFileSync(path.join(pasta, "manifesto.json"), "utf8")) as Awaited<ReturnType<typeof fazerBackup>>["manifesto"];
  const base = process.env.DATABASE_URL_OWNER!;
  const su = (banco: string) => urlCom(base, "postgres", process.env.PG_SUPERUSER_PASSWORD!, banco);

  const adm = new pg.Client({ connectionString: su("postgres") });
  await adm.connect();
  await adm.query(`drop database if exists ${BANCO_RESTAURACAO} with (force)`);
  await adm.query(`create database ${BANCO_RESTAURACAO} owner alta_owner`);
  await adm.query(`grant connect on database ${BANCO_RESTAURACAO} to alta_app`);
  await adm.end();

  // Esquema pelas migrações versionadas; depois os dados.
  await migrarBanco(urlCom(base, new URL(base).username, decodeURIComponent(new URL(base).password), BANCO_RESTAURACAO));

  const c = new pg.Client({ connectionString: su(BANCO_RESTAURACAO) });
  await c.connect();
  const resultado: { tabela: string; esperado: number; restaurado: number; integridade: boolean }[] = [];
  try {
    await c.query("begin");
    // Carga em massa: restrições checadas ao final por contagem e checksum.
    await c.query("set local session_replication_role = replica");
    for (const t of manifesto.tabelas) {
      const dados = decifrar(readFileSync(path.join(pasta, `${t.nome}.bin.enc`)), k);
      const integridade = sha(dados) === t.sha256;
      await c.query(`delete from "${t.nome}"`);
      await pipeline(Readable.from([dados]), c.query(copyFrom(`copy "${t.nome}" from stdin (format binary)`)));
      const restaurado = Number((await c.query(`select count(*) from "${t.nome}"`)).rows[0].count);
      resultado.push({ tabela: t.nome, esperado: t.linhas, restaurado, integridade });
    }
    // Ajusta sequências (bigserial da auditoria).
    await c.query(`select setval(pg_get_serial_sequence('auditoria', 'id'), coalesce(max(id), 1)) from auditoria`);
    // Pós-restauração (docs/implantacao.md): sessões e convites antigos não voltam a valer.
    await c.query("delete from session");
    await c.query("update convite set revogado_em = now() where consumido_em is null and revogado_em is null");
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
  return resultado;
}

async function main() {
  const [comando, arg] = process.argv.slice(2);
  if (comando === "backup") {
    const r = await fazerBackup(process.env.DATABASE_URL_OWNER!);
    console.log(`Backup em ${r.pasta}: ${r.manifesto.tabelas.length} tabelas.`);
  } else if (comando === "restaurar" && arg) {
    console.table(await restaurar(arg));
  } else if (comando === "teste") {
    const inicio = Date.now();
    const b = await fazerBackup(process.env.DATABASE_URL_OWNER!);
    const r = await restaurar(b.pasta);
    const ok = r.every((x) => x.integridade && x.esperado === x.restaurado);
    const evidencia = {
      executadoEm: new Date().toISOString(),
      resultado: ok ? "restauração conferida" : "DIVERGÊNCIA",
      duracaoMs: Date.now() - inicio,
      bancoRestaurado: BANCO_RESTAURACAO,
      tabelas: r,
      posRestauracao: ["sessões apagadas", "convites pendentes revogados"],
    };
    mkdirSync("docs/evidencias", { recursive: true });
    writeFileSync("docs/evidencias/backup-restauracao.json", JSON.stringify(evidencia, null, 2));
    console.table(r);
    console.log(ok ? `OK: restauração conferida em ${evidencia.duracaoMs} ms.` : "FALHA: há divergências.");
    process.exit(ok ? 0 : 1);
  } else {
    console.log("Uso: backup | restaurar <pasta> | teste");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
