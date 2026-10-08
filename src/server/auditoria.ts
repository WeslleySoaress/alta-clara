import { db, type Tx } from "./db/cliente";
import { auditoria } from "./db/schema";

export type EventoAuditoria = {
  atorUserId: string | null;
  instituicaoId?: string | null;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
  resultado: "permitido" | "negado" | "erro";
  /** Somente metadados (ids, versões, motivos). Nunca conteúdo clínico. */
  detalhes?: Record<string, string | number | boolean | null>;
};

export async function auditar(evento: EventoAuditoria, tx?: Tx) {
  await (tx ?? db).insert(auditoria).values({
    atorUserId: evento.atorUserId,
    instituicaoId: evento.instituicaoId ?? null,
    acao: evento.acao,
    recursoTipo: evento.recursoTipo,
    recursoId: evento.recursoId,
    resultado: evento.resultado,
    detalhes: evento.detalhes,
  });
}
