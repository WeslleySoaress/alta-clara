#!/bin/sh
# Executado uma vez pelo contêiner postgres na criação do volume.
# Cria os papéis com os mesmos privilégios usados por scripts/db.ts.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" \
  -v owner_pw="$DB_OWNER_PASSWORD" -v app_pw="$DB_APP_PASSWORD" <<'SQL'
create role alta_owner with login nosuperuser nocreatedb nocreaterole nobypassrls password :'owner_pw';
create role alta_app with login nosuperuser nocreatedb nocreaterole nobypassrls password :'app_pw';
create database alta_clara owner alta_owner;
revoke all on database alta_clara from public;
grant connect on database alta_clara to alta_app;
SQL
