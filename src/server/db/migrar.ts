// Aplica as migrações como alta_owner e depois ajusta os privilégios do
// usuário da aplicação (alta_app) segundo o princípio do menor privilégio.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Tabelas em que a aplicação só pode inserir e ler (nunca alterar ou apagar).
const SOMENTE_INSERCAO = ["auditoria"];

export async function migrarBanco(urlOwner: string) {
  const pool = new pg.Pool({ connectionString: urlOwner, max: 1 });
  try {
    // ALTA_MIGRACOES permite rodar de outra pasta (ex.: preparar um banco remoto).
    await migrate(drizzle(pool), { migrationsFolder: process.env.ALTA_MIGRACOES ?? "./drizzle" });

    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("revoke all on schema public from public");
      await c.query("grant usage on schema public to alta_app");
      await c.query("revoke all on all tables in schema public from alta_app");
      await c.query("grant select, insert, update, delete on all tables in schema public to alta_app");
      for (const t of SOMENTE_INSERCAO) {
        await c.query(`revoke update, delete, truncate on table ${t} from alta_app`);
      }
      await c.query("grant usage, select on all sequences in schema public to alta_app");
      // A tabela interna de migrações não é da conta da aplicação.
      await c.query("revoke all on all tables in schema drizzle from alta_app").catch(() => {});
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
}
