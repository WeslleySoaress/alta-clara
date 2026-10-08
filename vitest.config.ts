import { lerAmbiente } from "./scripts/ambiente";
import path from "node:path";
import { defineConfig } from "vitest/config";

const env = lerAmbiente({ operacao: true });
const BANCO_TESTE = "alta_clara_teste";
const trocarBanco = (url = "") => url.replace(/\/alta_clara$/, `/${BANCO_TESTE}`);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/vazio.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "",
      BETTER_AUTH_URL: "http://localhost:3100",
      PG_PORT: env.PG_PORT ?? "5433",
      PG_SUPERUSER_PASSWORD: env.PG_SUPERUSER_PASSWORD ?? "",
      DATABASE_URL: trocarBanco(env.DATABASE_URL),
      DATABASE_URL_OWNER: trocarBanco(env.DATABASE_URL_OWNER),
      BANCO_TESTE,
    },
  },
});
