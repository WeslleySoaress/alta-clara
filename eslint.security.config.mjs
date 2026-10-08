// Análise estática de segurança (SAST) com eslint-plugin-security.
// Rode: npm run check:sast
//
// Os alertas são avisos (warn) porque a maioria é falso positivo conhecido
// (índices numéricos de listas, mapas com chaves de enum fechado); a triagem
// está em docs/relatorio-testes.md. Um erro aqui significa configuração quebrada.
import nextPlugin from "@next/eslint-plugin-next";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

const configuracao = [
  { ignores: ["node_modules/**", ".next/**", "drizzle/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    // O plugin do Next só é registrado (sem regras ativas) para que os
    // comentários eslint-disable da configuração principal sejam reconhecidos.
    plugins: { security, "@next/next": nextPlugin },
    rules: Object.fromEntries(Object.keys(security.rules).map((r) => [`security/${r}`, "warn"])),
  },
];
export default configuracao;
