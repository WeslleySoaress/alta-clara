import { formatarData } from "./Status";

/** Faixa de identificação sempre visível na área profissional (evita registrar no paciente errado). */
export function IdentificacaoPaciente({
  nome,
  nascimento,
  prontuario,
  instituicao,
  procedimento,
}: {
  nome: string;
  nascimento: string;
  prontuario: string;
  instituicao: string;
  procedimento: string;
}) {
  return (
    <div className="borda-viva rounded-3xl p-5 shadow-suave">
      <p className="text-sm font-bold uppercase tracking-wide text-muted">Paciente</p>
      <p className="text-2xl font-extrabold">{nome}</p>
      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex gap-1">
          <dt className="text-muted">Nascimento:</dt>
          <dd className="font-semibold">{formatarData(nascimento)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">Prontuário:</dt>
          <dd className="font-mono font-semibold">{prontuario}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">Atendimento:</dt>
          <dd>
            {procedimento} · {instituicao}
          </dd>
        </div>
      </dl>
    </div>
  );
}
