import { asc, eq, inArray } from "drizzle-orm";
import { dosesDoDia } from "@/lib/agenda";
import { adicionarDias, diasEntre } from "@/lib/datas";
import { partesNoFuso } from "@/lib/fuso";
import { db } from "../db/cliente";
import { plano, registroDose, user } from "../db/schema";
import type { ConteudoPlano } from "./conteudo";

// Diário de doses RELATADAS para a equipe. Registro relatado não comprova
// ingestão; serve para a equipe perceber dificuldades e conversar com o
// paciente. Chamado somente depois da autorização da página (lerPlanoParaEquipe).

export type ResumoItem = {
  itemId: string;
  nome: string;
  seNecessario: boolean;
  previstas: number;
  relatadas: number;
  naoTomadas: number;
  duvidas: number;
  semRegistro: number;
};

export async function diarioParaEquipe(atendimentoId: string, conteudo: ConteudoPlano, agora = new Date()) {
  const registros = await db
    .select({ itemId: registroDose.itemId, data: registroDose.data, horario: registroDose.horario, situacao: registroDose.situacao, por: user.name, registradoEm: registroDose.registradoEm })
    .from(registroDose)
    .innerJoin(user, eq(user.id, registroDose.registradoPor))
    .where(inArray(registroDose.planoId, db.select({ id: plano.id }).from(plano).where(eq(plano.atendimentoId, atendimentoId))))
    .orderBy(asc(registroDose.registradoEm));

  // Vale o registro mais recente de cada dose.
  const porDose = new Map(registros.map((r) => [`${r.itemId}|${r.data}|${r.horario}`, r] as const));
  const { data: hoje, horario: agoraHHMM } = partesNoFuso(agora, conteudo.fusoHorario);

  const resumo: ResumoItem[] = conteudo.medicamentos.map((m) => ({
    itemId: m.id,
    nome: m.nome,
    seNecessario: Boolean(m.seNecessario),
    previstas: 0,
    relatadas: 0,
    naoTomadas: 0,
    duvidas: 0,
    semRegistro: 0,
  }));
  const porItem = new Map(resumo.map((r) => [r.itemId, r]));

  // Doses previstas do primeiro dia até agora (as futuras não contam).
  const dias = Math.max(0, Math.min(diasEntre(conteudo.inicio, hoje), 365));
  for (let i = 0; i <= dias; i++) {
    const data = adicionarDias(conteudo.inicio, i);
    for (const d of dosesDoDia(conteudo, data)) {
      if (data === hoje && d.horario > agoraHHMM) continue;
      const r = porItem.get(d.medicamento.id)!;
      r.previstas++;
      const reg = porDose.get(`${d.medicamento.id}|${data}|${d.horario}`);
      if (!reg) r.semRegistro++;
      else if (reg.situacao === "relatou_tomada") r.relatadas++;
      else if (reg.situacao === "nao_tomou") r.naoTomadas++;
      else r.duvidas++;
    }
  }
  // Uso "se necessário": só conta o que foi relatado.
  for (const reg of porDose.values()) {
    const r = porItem.get(reg.itemId);
    if (r?.seNecessario && reg.situacao === "relatou_tomada") r.relatadas++;
  }

  const recentes = [...porDose.values()]
    .sort((a, b) => b.registradoEm.getTime() - a.registradoEm.getTime())
    .slice(0, 30)
    .map((r) => ({ ...r, nome: porItem.get(r.itemId)?.nome ?? r.itemId, registradoEm: r.registradoEm.toISOString() }));

  return { resumo, recentes };
}
