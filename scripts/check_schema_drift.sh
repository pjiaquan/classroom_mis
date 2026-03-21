#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_FILE="$ROOT_DIR/db/schema.snapshot.sql"
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

set -a
source .env
set +a

APP_SCHEMA="${APP_SCHEMA:-mis}"
APP_POSTGRES_DB="${APP_POSTGRES_DB:-}"

if [[ -z "$APP_POSTGRES_DB" ]]; then
  echo "APP_POSTGRES_DB is not set in .env." >&2
  exit 1
fi

if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "Schema snapshot not found: $SNAPSHOT_FILE" >&2
  echo "Run: bash scripts/update_schema_snapshot.sh" >&2
  exit 1
fi

normalize_dump() {
  sed \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\.set_config/d' \
    -e '/^\\/connect /d' \
    -e '/^$/d'
}

docker compose exec -T -e APP_SCHEMA="$APP_SCHEMA" postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" --schema="$APP_SCHEMA" --schema-only --no-owner --no-privileges' \
  | normalize_dump > "$LIVE_FILE"

if diff -u "$SNAPSHOT_FILE" "$LIVE_FILE" > "$DIFF_FILE"; then
  echo "No schema drift detected."
  exit 0
fi

echo "Schema drift detected between live PostgreSQL and db/schema.snapshot.sql" >&2
cat "$DIFF_FILE" >&2
exit 1
