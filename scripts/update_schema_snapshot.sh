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

set -a
source .env
set +a

APP_SCHEMA="${APP_SCHEMA:-mis}"

normalize_dump() {
  sed \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\.set_config/d' \
    -e '/^\\/connect /d' \
    -e '/^$/d'
}

docker compose exec -T -e APP_SCHEMA="$APP_SCHEMA" postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema="$APP_SCHEMA" --schema-only --no-owner --no-privileges' \
  | normalize_dump > "$TMP_FILE"

mv "$TMP_FILE" "$SNAPSHOT_FILE"

echo "Schema snapshot updated: $SNAPSHOT_FILE"
