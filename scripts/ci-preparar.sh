#!/usr/bin/env bash
# Prepara o banco do serviço postgres do GitHub Actions e os dois arquivos de
# ambiente, com os mesmos papéis e privilégios de scripts/db.ts.
# Valores descartáveis, exclusivos do CI: não correspondem a nenhum ambiente real.
set -euo pipefail

PORTA=5433
SUPER=ci-superusuario-descartavel
OWNER=ci-dono-descartavel
APP=ci-app-descartavel

export PGPASSWORD="$SUPER"
psql -v ON_ERROR_STOP=1 -h localhost -p "$PORTA" -U postgres -d postgres \
  -v owner_pw="$OWNER" -v app_pw="$APP" <<'SQL'
create role alta_owner with login nosuperuser nocreatedb nocreaterole nobypassrls password :'owner_pw';
create role alta_app with login nosuperuser nocreatedb nocreaterole nobypassrls password :'app_pw';
create database alta_clara owner alta_owner;
revoke all on database alta_clara from public;
grant connect on database alta_clara to alta_app;
SQL

cat > .env.local <<EOF
BETTER_AUTH_SECRET=segredo-de-integracao-continua-descartavel-com-mais-de-32-caracteres
BETTER_AUTH_URL=http://localhost:3100
DATABASE_URL=postgres://alta_app:${APP}@localhost:${PORTA}/alta_clara
EOF

cat > .env.operacao.local <<EOF
PG_PORT=${PORTA}
PG_SUPERUSER_PASSWORD=${SUPER}
DB_OWNER_PASSWORD=${OWNER}
DB_APP_PASSWORD=${APP}
DATABASE_URL_OWNER=postgres://alta_owner:${OWNER}@localhost:${PORTA}/alta_clara
EOF

npm run db:migrate
