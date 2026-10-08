import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auditar } from "@/server/auditoria";
import { obterSessao } from "@/server/auth/sessao";
import { ehProfissional } from "@/server/authz/politicas";
import { db } from "@/server/db/cliente";
import { atendimento, paciente } from "@/server/db/schema";
import { conteudoPlanoSchema } from "@/server/dominio/conteudo";
import { lerPlanoParaEquipe } from "@/server/dominio/planos";
import { planoParaFhir } from "@/server/integracoes/fhir";

/** Exportação FHIR R4 de exemplo (sandbox). Leitura: não altera estado. */
export async function GET(_request: Request, ctx: RouteContext<"/equipe/planos/[id]/fhir">) {
  const naoEncontrado = () => NextResponse.json({ erro: "não encontrado" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const s = await obterSessao();
  if ("motivo" in s || !ehProfissional(s.ator) || !s.ator.mfaAtivo) return naoEncontrado();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return naoEncontrado();
  const dados = await lerPlanoParaEquipe(s.ator, id);
  if (!dados || dados.plano.status !== "publicado") return naoEncontrado();

  const [pac] = await db.select().from(paciente).where(eq(paciente.id, dados.plano.pacienteId));
  const [at] = await db.select().from(atendimento).where(eq(atendimento.id, dados.plano.atendimentoId));
  const bundle = planoParaFhir({
    planoId: dados.plano.id,
    versao: dados.plano.versao,
    publicadoEm: dados.plano.publicadoEm,
    paciente: { id: pac.id, nome: pac.nome, nascimento: pac.dataNascimento, prontuario: pac.prontuario },
    atendimento: { id: at.id, procedimento: at.procedimento, admissaoEm: at.admissaoEm },
    instituicao: dados.instituicao,
    conteudo: conteudoPlanoSchema.parse(dados.plano.conteudo),
  });
  await auditar({ atorUserId: s.ator.userId, instituicaoId: dados.plano.instituicaoId, acao: "plano.exportar_fhir", recursoTipo: "plano", recursoId: id, resultado: "permitido" });
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="alta-clara-plano-v${dados.plano.versao}-fhir-r4-sandbox.json"`,
      "Cache-Control": "no-store",
    },
  });
}
