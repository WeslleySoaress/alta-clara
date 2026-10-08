// Verifica o contraste (WCAG 2.2, critério 1.4.3: 4,5:1 para texto normal)
// de todos os pares de cores usados na interface. Rode: npx tsx scripts/contraste.ts
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const PARES: [string, string, string][] = [
  ["claro: texto / fundo", "#0E1B3D", "#F6F8FC"],
  ["claro: texto secundário / fundo", "#4A5677", "#F6F8FC"],
  ["claro: texto secundário / cartão", "#4A5677", "#FFFFFF"],
  ["claro: primária / fundo", "#08786F", "#F6F8FC"],
  ["claro: branco / botão primário", "#FFFFFF", "#08786F"],
  ["claro: primária / apoio", "#08786F", "#D7F5EF"],
  ["claro: violeta / apoio", "#5B3FD1", "#ECE7FF"],
  ["claro: coral / apoio", "#B4321F", "#FFE8E2"],
  ["claro: informação", "#2849B8", "#E5ECFF"],
  ["claro: contato com a unidade", "#7F4D00", "#FFF1CC"],
  ["claro: urgência", "#B42318", "#FFE4E0"],
  ["claro: branco / botão urgência", "#FFFFFF", "#B42318"],
  ["painel vivo: branco / índigo", "#FFFFFF", "#141E55"],
  ["painel vivo: girassol / índigo", "#FFD166", "#141E55"],
  ["painel vivo: verde-água / índigo", "#7FF0E2", "#141E55"],
  ["painel vivo: branco / violeta (região mais clara)", "#FFFFFF", "#6A4FE0"],
  ["botão branco: índigo / branco", "#141E55", "#FFFFFF"],
  ["selo: índigo / verde-água vivo", "#141E55", "#19D3C0"],
  ["selo: índigo / girassol vivo", "#141E55", "#FFC93C"],
  ["selo: índigo / coral vivo", "#141E55", "#FF7A59"],
  ["escuro: texto / fundo", "#EEF1FF", "#0A1030"],
  ["escuro: texto secundário / cartão", "#AEB8DD", "#121A42"],
  ["escuro: primária / fundo", "#45E0CF", "#0A1030"],
  ["escuro: texto / botão primário", "#04302C", "#45E0CF"],
  ["escuro: informação", "#9DB4FF", "#18235A"],
  ["escuro: contato com a unidade", "#FFC857", "#33250A"],
  ["escuro: urgência", "#FF8D80", "#3D1520"],
  ["escuro: cartão / botão urgência", "#121A42", "#FF8D80"],
  ["escuro: violeta / cartão", "#B9A8FF", "#121A42"],
  ["escuro: coral / cartão", "#FF9C85", "#121A42"],
];

let falhas = 0;
for (const [nome, a, b] of PARES) {
  const r = razao(a, b);
  if (r < 4.5) falhas++;
  console.log(`${r >= 4.5 ? "OK  " : "FALHA"} ${r.toFixed(2).padStart(5)}:1  ${nome}`);
}
process.exit(falhas ? 1 : 0);
