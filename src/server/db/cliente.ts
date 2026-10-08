import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// Conexão com o usuário da aplicação (alta_app): sem DDL e sem permissão para
// alterar ou apagar eventos de auditoria. Ver scripts/migrate.ts.
// Segredos de operação ficam em .env.operacao.local e não devem chegar ao
// processo web (ver scripts/ambiente.ts).
const SEGREDOS_DE_OPERACAO = ["DATABASE_URL_OWNER", "PG_SUPERUSER_PASSWORD", "DB_OWNER_PASSWORD", "ALTA_BACKUP_KEY"];

function conferirSeparacao(url: string) {
  // Scripts de operação (seed) usam as duas conexões de propósito.
  if (process.env.NODE_ENV === "test" || process.env.ALTA_PROCESSO_OPERACAO === "1") return;
  const problemas = SEGREDOS_DE_OPERACAO.filter((k) => process.env[k]);
  const usuario = decodeURIComponent(new URL(url).username);
  if (usuario === "alta_owner" || usuario === "postgres") problemas.push(`DATABASE_URL com o usuário ${usuario}`);
  if (!problemas.length) return;
  const msg = `A aplicação recebeu segredos de operação (${problemas.join(", ")}). Mova-os para .env.operacao.local.`;
  if (process.env.NODE_ENV === "production") throw new Error(msg);
  console.warn(`[alta-clara] ${msg}`);
}

function criarPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente. Rode `npm run setup` e `npm run db`.");
  conferirSeparacao(url);
  return new pg.Pool({ connectionString: url, max: 10 });
}

const global_ = globalThis as unknown as { __altaPool?: pg.Pool };
export const pool = global_.__altaPool ?? criarPool();
if (process.env.NODE_ENV !== "production") global_.__altaPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
