import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/cliente";
import { tentativaLogin } from "../db/schema";

// Limitação progressiva por conta (ASVS V6: proteção contra força bruta).
// Política do protótipo: janela de 30 min; 5 falhas → espera de 1 min;
// 10 ou mais → espera de 15 min. Nunca há bloqueio permanente.

const JANELA_MS = 30 * 60_000;

const chaveDe = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest();

export function esperaPara(falhas: number): number {
  if (falhas >= 10) return 15 * 60_000;
  if (falhas >= 5) return 60_000;
  return 0;
}

/** Instante até quando o login desta conta está suspenso, ou null. */
export async function bloqueioAtivo(email: string, agora = new Date()): Promise<Date | null> {
  if (!email) return null;
  const [t] = await db.select({ ate: tentativaLogin.bloqueadoAte }).from(tentativaLogin).where(eq(tentativaLogin.chave, chaveDe(email)));
  return t?.ate && t.ate > agora ? t.ate : null;
}

export async function registrarFalha(email: string, agora = new Date()) {
  if (!email) return;
  const chave = chaveDe(email);
  // Atômico: reinicia a contagem se a janela venceu; senão incrementa.
  const [linha] = await db
    .insert(tentativaLogin)
    .values({ chave, falhas: 1, janelaInicio: agora })
    .onConflictDoUpdate({
      target: tentativaLogin.chave,
      set: {
        falhas: sql`case when ${tentativaLogin.janelaInicio} < ${new Date(agora.getTime() - JANELA_MS)} then 1 else ${tentativaLogin.falhas} + 1 end`,
        janelaInicio: sql`case when ${tentativaLogin.janelaInicio} < ${new Date(agora.getTime() - JANELA_MS)} then ${agora} else ${tentativaLogin.janelaInicio} end`,
      },
    })
    .returning({ falhas: tentativaLogin.falhas });
  const espera = esperaPara(linha.falhas);
  if (espera) await db.update(tentativaLogin).set({ bloqueadoAte: new Date(agora.getTime() + espera) }).where(eq(tentativaLogin.chave, chave));
}

export async function limparFalhas(email: string) {
  if (email) await db.delete(tentativaLogin).where(eq(tentativaLogin.chave, chaveDe(email)));
}
