import { lerAmbiente } from "../scripts/ambiente";
import pg from "pg";
import { migrarBanco } from "../src/server/db/migrar";

// Cria (se preciso) o banco de testes no mesmo PostgreSQL local e aplica as
// migrações com os mesmos privilégios da aplicação. Requer `npm run db` rodando.
export default async function setup() {
  // O globalSetup roda fora dos workers: lê os arquivos de ambiente diretamente.
  const env = lerAmbiente({ operacao: true });
  const nome = "alta_clara_teste";
  const urlOwner = (env.DATABASE_URL_OWNER ?? "").replace(/\/alta_clara$/, `/${nome}`);
  const su = new pg.Client({
    host: "localhost",
    port: Number(env.PG_PORT ?? 5433),
    user: "postgres",
    password: env.PG_SUPERUSER_PASSWORD,
    database: "postgres",
  });
  try {
    await su.connect();
  } catch {
    throw new Error("PostgreSQL local indisponível. Rode `npm run db` em outro terminal antes dos testes.");
  }
  const { rows } = await su.query("select 1 from pg_database where datname = $1", [nome]);
  if (!rows.length) {
    const { rows: q } = await su.query("select format('create database %I owner alta_owner', $1::text) as q", [nome]);
    await su.query(q[0].q);
  }
  const { rows: g } = await su.query("select format('grant connect on database %I to alta_app', $1::text) as q", [nome]);
  await su.query(g[0].q);
  await su.end();

  await migrarBanco(urlOwner);
}
