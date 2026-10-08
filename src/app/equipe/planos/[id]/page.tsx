import { formatarDataHora } from "@/lib/datas";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdentificacaoPaciente } from "@/components/equipe/IdentificacaoPaciente";
import { StatusPlano } from "@/components/equipe/Status";
import { VisaoPlano } from "@/components/plano/VisaoPlano";
import { exigirProfissional } from "@/server/auth/sessao";
import { conteudoPlanoSchema } from "@/server/dominio/conteudo";
import { confirmacoesDoPlano } from "@/server/dominio/entendimento";
import { lerPlanoParaEquipe } from "@/server/dominio/planos";
import { iaDisponivel } from "@/server/integracoes/ia";
import { DiarioDoses } from "@/components/equipe/DiarioDoses";
import { diarioParaEquipe } from "@/server/dominio/diario";
import { EditorPlano } from "./EditorPlano";
import { PainelRevisao } from "./PainelRevisao";

export const metadata: Metadata = { title: "Plano de alta" };

export default async function Page(props: PageProps<"/equipe/planos/[id]">) {
  const { ator } = await exigirProfissional();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const dados = await lerPlanoParaEquipe(ator, id);
  if (!dados) notFound();

  const { plano, permissoes } = dados;
  const conteudo = conteudoPlanoSchema.parse(plano.conteudo);
  const confirmacoes = plano.status === "publicado" ? await confirmacoesDoPlano(plano.id) : [];
  const diario = plano.status === "publicado" ? await diarioParaEquipe(plano.atendimentoId, conteudo) : null;

  return (
    <div className="space-y-6">
      <Link href={`/equipe/atendimentos/${plano.atendimentoId}`} className="font-semibold text-primary underline">
        ← Atendimento
      </Link>
      <IdentificacaoPaciente
        nome={dados.pacienteNome}
        nascimento={dados.pacienteNascimento}
        prontuario={dados.prontuario}
        instituicao={dados.instituicao}
        procedimento={dados.procedimento}
      />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">Plano — versão {plano.versao}</h1>
        <StatusPlano status={plano.status} />
      </div>
      <p className="text-muted">
        Autor: {dados.autorNome}
        {dados.revisorNome && ` · Revisor: ${dados.revisorNome}`}
        {plano.motivoAlteracao && ` · Observação: ${plano.motivoAlteracao}`}
      </p>

      {plano.status === "publicado" && (
        <section aria-labelledby="conf" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="conf" className="text-xl font-extrabold">Confirmação de entendimento</h2>
          {confirmacoes.length === 0 ? (
            <p className="mt-1 text-muted">O paciente ainda não respondeu às perguntas de confirmação.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {confirmacoes.map((c, i) => (
                <li key={i}>
                  {formatarDataHora(c.criadoEm)} · {c.por}: {c.acertos} de {c.total} de acordo com o plano
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted">Resultado isolado não certifica compreensão. Pontos a reforçar aparecem em Pendências.</p>
          <p className="mt-4 border-t border-line pt-4">
            <a href={`/equipe/planos/${plano.id}/fhir`} className="font-semibold text-primary underline">
              Exportar em HL7 FHIR R4 (exemplo, sandbox)
            </a>
            <span className="block text-sm text-muted">Arquivo de exemplo com dados sintéticos. Não há conexão nem gravação em prontuário.</span>
          </p>
        </section>
      )}

      {diario && <DiarioDoses resumo={diario.resumo} recentes={diario.recentes} />}

      {plano.status === "rascunho" && permissoes.editar ? (
        <EditorPlano planoId={plano.id} revisaoInicial={plano.revisao} conteudoInicial={conteudo} iaDisponivel={iaDisponivel()} />
      ) : (
        <>
          {plano.status === "em_revisao" && (
            <PainelRevisao
              planoId={plano.id}
              revisao={plano.revisao}
              podePublicar={permissoes.publicar}
              podeDevolver={permissoes.devolver}
              autorEhVoce={permissoes.autorEhVoce}
            />
          )}
          <div className="overflow-hidden rounded-3xl border-2 border-line bg-bg">
            <VisaoPlano
              modo="previa"
              plano={{
                id: plano.id,
                conteudo,
                versao: plano.versao,
                publicadoEm: plano.publicadoEm?.toISOString() ?? null,
                autorNome: dados.autorNome,
                revisorNome: dados.revisorNome ?? null,
                instituicao: dados.instituicao,
                procedimento: dados.procedimento,
                registros: [],
                podeRegistrar: false,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
