import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/cliente";
import { autorizacaoCuidador, paciente, user, vinculo } from "../db/schema";
import { modoDemonstracao } from "../demonstracao";
import type { Ator, Papel } from "./politicas";

/** Monta o ator a partir do banco. Nada vem do cliente além do id da sessão. */
export async function carregarAtor(userId: string): Promise<Ator> {
  const [u] = await db.select({ mfa: user.twoFactorEnabled }).from(user).where(eq(user.id, userId));

  const vinculos = await db
    .select({ instituicaoId: vinculo.instituicaoId, papel: vinculo.papel })
    .from(vinculo)
    .where(and(eq(vinculo.userId, userId), eq(vinculo.ativo, true)));

  const proprios = await db.select({ id: paciente.id }).from(paciente).where(eq(paciente.userId, userId));

  const cuidados = await db
    .select({ pacienteId: autorizacaoCuidador.pacienteId, escopo: autorizacaoCuidador.escopo })
    .from(autorizacaoCuidador)
    .where(
      and(
        eq(autorizacaoCuidador.cuidadorUserId, userId),
        isNull(autorizacaoCuidador.revogadoEm),
        or(isNull(autorizacaoCuidador.expiraEm), gt(autorizacaoCuidador.expiraEm, new Date())),
      ),
    );

  return {
    userId,
    // Na demonstração pública o segundo fator é dispensado (ver demonstracao.ts).
    mfaAtivo: Boolean(u?.mfa) || modoDemonstracao(),
    vinculos: vinculos.map((v) => ({ instituicaoId: v.instituicaoId, papel: v.papel as Papel })),
    pacientesProprios: proprios.map((p) => p.id),
    cuidadorDe: cuidados,
  };
}
