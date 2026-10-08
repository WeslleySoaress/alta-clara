const ROTULOS = {
  rascunho: ["Rascunho", "bg-bg text-ink border-line"],
  em_revisao: ["Em revisão", "bg-info-soft text-info border-info"],
  publicado: ["Publicado", "bg-primary-soft text-primary border-primary"],
  substituido: ["Substituído", "bg-bg text-muted border-line"],
  encerrado: ["Encerrado", "bg-bg text-muted border-line"],
} as const;

export function StatusPlano({ status }: { status: keyof typeof ROTULOS }) {
  const [rotulo, classes] = ROTULOS[status];
  return <span className={`inline-flex rounded-full border px-3 py-0.5 text-sm font-bold ${classes}`}>{rotulo}</span>;
}

export function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}
