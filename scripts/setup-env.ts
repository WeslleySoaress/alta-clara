// Gera os arquivos de ambiente com segredos aleatórios, apenas se ainda não existirem.
// Nenhum segredo fica no código-fonte nem no repositório.
//
//   .env.local           → aplicação (o Next.js só lê este)
//   .env.operacao.local  → banco, migrações, seed, backup e testes
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { ARQUIVO_APP, ARQUIVO_OPERACAO, separarAmbienteAntigo } from "./ambiente";

separarAmbienteAntigo();
if (existsSync(ARQUIVO_APP) && existsSync(ARQUIVO_OPERACAO)) {
  console.log(`${ARQUIVO_APP} e ${ARQUIVO_OPERACAO} já existem; nada foi alterado.`);
  process.exit(0);
}
if (existsSync(ARQUIVO_APP) || existsSync(ARQUIVO_OPERACAO)) {
  console.error("Só um dos arquivos de ambiente existe. Apague-o para gerar os dois de novo (as senhas precisam combinar).");
  process.exit(1);
}

const segredo = (bytes = 32) => randomBytes(bytes).toString("base64url");
const porta = 5433;
const owner = segredo(24);
const app = segredo(24);
const data = new Date().toISOString();

writeFileSync(
  ARQUIVO_APP,
  `# Gerado por scripts/setup-env.ts em ${data}
# Ambiente LOCAL de desenvolvimento. Não reutilize estes valores em outro ambiente.

BETTER_AUTH_SECRET=${segredo(32)}
BETTER_AUTH_URL=http://localhost:3100

# Usuário da aplicação: sem permissão de DDL e sem alterar a auditoria.
DATABASE_URL=postgres://alta_app:${app}@localhost:${porta}/alta_clara
`,
  { mode: 0o600 },
);

writeFileSync(
  ARQUIVO_OPERACAO,
  `# Gerado por scripts/setup-env.ts em ${data}
# Segredos de operação (banco, migrações, backup). A aplicação web NÃO lê este arquivo.

PG_PORT=${porta}
PG_SUPERUSER_PASSWORD=${segredo(24)}
DB_OWNER_PASSWORD=${owner}
DB_APP_PASSWORD=${app}

# Dono do esquema: usado só por migrações, seed e backup.
DATABASE_URL_OWNER=postgres://alta_owner:${owner}@localhost:${porta}/alta_clara
`,
  { mode: 0o600 },
);
console.log(`${ARQUIVO_APP} e ${ARQUIVO_OPERACAO} criados com segredos aleatórios.`);
