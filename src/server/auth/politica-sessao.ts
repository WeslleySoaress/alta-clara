// Política de sessão do protótipo (escolha do projeto, a validar no fluxo real;
// ver docs/pesquisa.md — OWASP sugere 15–30 min de inatividade e 4–8 h absolutas).
export const POLITICA_SESSAO = {
  profissional: { inatividadeMin: 15, absolutaHoras: 8 },
  paciente: { inatividadeMin: 60 * 24, absolutaHoras: 24 * 7 },
} as const;

export type MotivoExpiracao = "inatividade" | "duracao_maxima";

/** Função pura: decide se a sessão expirou e quanto tempo resta. */
export function avaliarSessao(e: { criadaEm: Date; ultimaAtividade: Date | null; profissional: boolean; agora: number }) {
  const p = e.profissional ? POLITICA_SESSAO.profissional : POLITICA_SESSAO.paciente;
  const criada = e.criadaEm.getTime();
  const ultima = (e.ultimaAtividade ?? e.criadaEm).getTime();
  const fimAbsoluto = criada + p.absolutaHoras * 3_600_000;
  const fimInatividade = ultima + p.inatividadeMin * 60_000;
  let motivo: MotivoExpiracao | null = null;
  if (e.agora > fimAbsoluto) motivo = "duracao_maxima";
  else if (e.agora > fimInatividade) motivo = "inatividade";
  return { motivo, restanteMs: Math.min(fimAbsoluto, fimInatividade) - e.agora, fimAbsoluto };
}
