// PostgreSQL local sem Docker, usando os binários oficiais empacotados pelo
// embedded-postgres. Quem tiver Docker pode usar docker-compose.yml no lugar.
//
//   npm run db        inicia o banco e mantém rodando (Ctrl+C para parar)
import { carregarAmbiente } from "./ambiente";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

carregarAmbiente({ operacao: true });

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} ausente. Rode "npm run setup" primeiro.`);
  return valor;
}

const porta = Number(exigir("PG_PORT"));
const senhaSuper = exigir("PG_SUPERUSER_PASSWORD");
const diretorio = path.resolve(".pgdata");

const servidor = new EmbeddedPostgres({
  databaseDir: diretorio,
  port: porta,
  user: "postgres",
  password: senhaSuper,
  authMethod: "scram-sha-256",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

async function prepararPapeis() {
  const cliente = new pg.Client({
    host: "localhost",
    port: porta,
    user: "postgres",
    password: senhaSuper,
    database: "postgres",
  });
  await cliente.connect();
  try {
    // Senhas vêm do .env.local; format('%L') faz o escape correto do literal.
    for (const [papel, senha] of [
      ["alta_owner", exigir("DB_OWNER_PASSWORD")],
      ["alta_app", exigir("DB_APP_PASSWORD")],
    ]) {
      const { rows } = await cliente.query("select 1 from pg_roles where rolname = $1", [papel]);
      const comando = rows.length ? "alter" : "create";
      const { rows: sql } = await cliente.query(
        `select format('${comando} role %I with login nosuperuser nocreatedb nocreaterole nobypassrls password %L', $1::text, $2::text) as q`,
        [papel, senha],
      );
      await cliente.query(sql[0].q);
    }
    const { rows } = await cliente.query("select 1 from pg_database where datname = 'alta_clara'");
    if (!rows.length) await cliente.query("create database alta_clara owner alta_owner");
    await cliente.query("revoke all on database alta_clara from public");
    await cliente.query("grant connect on database alta_clara to alta_app");
  } finally {
    await cliente.end();
  }
}

async function main() {
  if (!existsSync(path.join(diretorio, "PG_VERSION"))) {
    console.log("Criando cluster PostgreSQL em .pgdata ...");
    await servidor.initialise();
  }
  await servidor.start();
  await prepararPapeis();
  console.log(`PostgreSQL rodando em localhost:${porta} (banco alta_clara). Ctrl+C para parar.`);

  const parar = async () => {
    await servidor.stop();
    process.exit(0);
  };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
  setInterval(() => {}, 1 << 30);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
