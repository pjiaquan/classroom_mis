#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APP_POSTGRES_DB:-}" ]]; then
  echo "APP_POSTGRES_DB is required during PostgreSQL initialization." >&2
  exit 1
fi

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_postgres_db="$APP_POSTGRES_DB" \
  --set postgres_user="$POSTGRES_USER" \
  <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'app_postgres_db', :'postgres_user')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'app_postgres_db'
)\gexec
SQL
