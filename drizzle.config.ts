import { carregarAmbiente } from "./scripts/ambiente";
import { defineConfig } from "drizzle-kit";

carregarAmbiente({ operacao: true });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL_OWNER! },
});
