#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_FILE="$ROOT_DIR/db/schema.snapshot.sql"
DRAFT_DIR="$ROOT_DIR/db/migration_drafts"
LIVE_FILE="$(mktemp)"
DIFF_FILE="$(mktemp)"

cleanup() {
  rm -f "$LIVE_FILE" "$DIFF_FILE"
}

trap cleanup EXIT

cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo ".env not found. Copy .env.example to .env first." >&2
  exit 1
fi

if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "Schema snapshot not found: $SNAPSHOT_FILE" >&2
  echo "Run: bash scripts/update_schema_snapshot.sh" >&2
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

slugify() {
  local raw="${1:-schema_drift}"
  local slug

  slug="$(printf '%s' "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g')"

  if [[ -z "$slug" ]]; then
    slug="schema_drift"
  fi

  printf '%s' "$slug"
}

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

render_commented_diff() {
  sed 's/^/-- /' "$1"
}

SLUG="$(slugify "${1:-schema_drift}")"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
RAW_DIFF_PATH="$DRAFT_DIR/${TIMESTAMP}_${SLUG}.diff"
DRAFT_SQL_PATH="$DRAFT_DIR/${TIMESTAMP}_${SLUG}.sql"
FINAL_MIGRATION_FILENAME="${TIMESTAMP}_${SLUG}.sql"

mkdir -p "$DRAFT_DIR"

resolve_app_schema

docker compose exec -T -e APP_SCHEMA="$APP_SCHEMA" postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" --schema="$APP_SCHEMA" --schema-only --no-owner --no-privileges' \
  | normalize_dump > "$LIVE_FILE"

if diff -u "$SNAPSHOT_FILE" "$LIVE_FILE" > "$DIFF_FILE"; then
  echo "No schema drift detected."
  exit 0
fi

cp "$DIFF_FILE" "$RAW_DIFF_PATH"

cat > "$DRAFT_SQL_PATH" <<EOF
-- Draft only. Review before creating a real migration.
-- Generated from schema drift between:
--   snapshot: db/schema.snapshot.sql
--   live schema: ${APP_SCHEMA} in database ${APP_POSTGRES_DB}
-- Raw diff: $(basename "$RAW_DIFF_PATH")
--
-- Review checklist:
-- 1. Confirm every change in the diff is intentional.
-- 2. Translate the reviewed diff into explicit SQL statements.
-- 3. Write a matching down migration.
-- 4. Copy the reviewed SQL into db/migrations/${FINAL_MIGRATION_FILENAME}
-- 5. Apply and validate with:
--    docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up
--    docker compose run --rm bootstrap
--    bash scripts/check_schema_drift.sh
--    bash scripts/update_schema_snapshot.sh

-- Suggested final migration file:
-- db/migrations/${FINAL_MIGRATION_FILENAME}

-- migrate:up

-- TODO: replace this section with the reviewed SQL statements.
-- Example for a new optional email column on leads:
-- ALTER TABLE leads
-- ADD COLUMN email TEXT;

-- Schema diff reference:
$(render_commented_diff "$DIFF_FILE")

-- migrate:down

-- TODO: replace this section with the reverse SQL statements.
-- Example for the leads.email case:
-- ALTER TABLE leads
-- DROP COLUMN IF EXISTS email;
EOF

echo "Schema drift detected."
echo "Draft SQL: $DRAFT_SQL_PATH"
echo "Raw diff:  $RAW_DIFF_PATH"
echo
echo "Manual review:"
echo "1. Open the draft and keep only intended schema changes."
echo "2. Copy the reviewed SQL into db/migrations/$FINAL_MIGRATION_FILENAME."
echo "3. Apply with: docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up"
echo "4. Refresh NocoDB metadata with: docker compose run --rm bootstrap"
echo "5. Validate with: bash scripts/check_schema_drift.sh"
echo "6. Update the snapshot with: bash scripts/update_schema_snapshot.sh"
