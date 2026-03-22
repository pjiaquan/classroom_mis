#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_FILE="$ROOT_DIR/db/schema.snapshot.sql"
TMP_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_FILE"
}

trap cleanup EXIT

cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo ".env not found. Copy .env.example to .env first." >&2
  exit 1
fi

read_env_var() {
  local key="$1"
  local raw

  raw="$(sed -n "s/^${key}=//p" .env | head -n 1)"
  if [[ -z "$raw" ]]; then
    return 1
  fi

  if [[ "$raw" =~ ^\".*\"$ || "$raw" =~ ^\'.*\'$ ]]; then
    raw="${raw:1:${#raw}-2}"
  fi

  printf '%s' "$raw"
}

APP_SCHEMA="$(read_env_var "APP_SCHEMA" || true)"
APP_POSTGRES_DB="$(read_env_var "APP_POSTGRES_DB" || true)"

APP_SCHEMA="${APP_SCHEMA:-public}"

if [[ -z "$APP_POSTGRES_DB" ]]; then
  echo "APP_POSTGRES_DB is not set in .env." >&2
  exit 1
fi

resolve_app_schema() {
  local resolved_schema

  resolved_schema="$(docker compose exec -T \
    -e REQUESTED_APP_SCHEMA="$APP_SCHEMA" \
    -e APP_POSTGRES_DB="$APP_POSTGRES_DB" \
    postgres sh -lc '
      PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" -Atqc "
        WITH requested AS (
          SELECT COUNT(*) AS table_count
          FROM information_schema.tables
          WHERE table_schema = '\''$REQUESTED_APP_SCHEMA'\''
            AND table_type = '\''BASE TABLE'\''
            AND table_name <> '\''schema_migrations'\''
        ),
        public_schema AS (
          SELECT COUNT(*) AS table_count
          FROM information_schema.tables
          WHERE table_schema = '\''public'\''
            AND table_type = '\''BASE TABLE'\''
            AND table_name <> '\''schema_migrations'\''
        )
        SELECT CASE
          WHEN (SELECT table_count FROM requested) > 0 THEN '\''$REQUESTED_APP_SCHEMA'\''
          WHEN '\''$REQUESTED_APP_SCHEMA'\'' <> '\''public'\'' AND (SELECT table_count FROM public_schema) > 0 THEN '\''public'\''
          ELSE '\''$REQUESTED_APP_SCHEMA'\''
        END;
      "
    ')"

  APP_SCHEMA="$resolved_schema"
}

normalize_dump() {
  sed \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\.set_config/d' \
    -e '/^\\/connect /d' \
    -e '/^$/d'
}

resolve_app_schema

docker compose exec -T -e APP_SCHEMA="$APP_SCHEMA" postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" --schema="$APP_SCHEMA" --schema-only --no-owner --no-privileges' \
  | normalize_dump > "$TMP_FILE"

mv "$TMP_FILE" "$SNAPSHOT_FILE"

echo "Schema snapshot updated: $SNAPSHOT_FILE"
