#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[bootstrap] %s\n' "$*"
}

require_env() {
  local var
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      echo "Missing required environment variable: $var" >&2
      exit 1
    fi
  done
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

psql_query() {
  PGPASSWORD="$POSTGRES_PASSWORD" \
    psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -Atqc "$1"
}

psql_exec() {
  PGPASSWORD="$POSTGRES_PASSWORD" \
    psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -v ON_ERROR_STOP=1 \
      -qc "$1"
}

api_call() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  shift 3 || true

  local args=(
    -fsS
    -X "$method"
    "$NOCODB_INTERNAL_URL$path"
    -H "xc-auth: $AUTH_TOKEN"
    -H "xc-gui: true"
  )

  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" --data "$data")
  fi

  curl "${args[@]}"
}

wait_for_signin() {
  local deadline
  local response

  deadline=$(( $(date +%s) + NOCODB_BOOTSTRAP_TIMEOUT_SECONDS ))

  while true; do
    response="$(curl -sS -X POST "$NOCODB_INTERNAL_URL/api/v1/auth/user/signin" \
      -H "Content-Type: application/json" \
      --data "$(jq -nc --arg email "$NC_ADMIN_EMAIL" --arg password "$NC_ADMIN_PASSWORD" '{email:$email,password:$password}')" \
      || true)"

    AUTH_TOKEN="$(printf '%s' "$response" | jq -r '.token // empty' 2>/dev/null || true)"
    if [[ -n "$AUTH_TOKEN" && "$AUTH_TOKEN" != "null" ]]; then
      log "NocoDB sign-in succeeded."
      return 0
    fi

    if (( $(date +%s) >= deadline )); then
      echo "Timed out waiting for NocoDB at $NOCODB_INTERNAL_URL" >&2
      echo "$response" >&2
      exit 1
    fi

    sleep "$NOCODB_BOOTSTRAP_POLL_INTERVAL_SECONDS"
  done
}

require_env \
  APP_SCHEMA \
  APP_POSTGRES_DB \
  NC_ADMIN_EMAIL \
  NC_ADMIN_PASSWORD \
  NOCODB_BASE_TITLE \
  NOCODB_BASE_VERSION \
  NOCODB_INTEGRATION_TITLE \
  NOCODB_INTERNAL_URL \
  NOCODB_SOURCE_ALIAS \
  POSTGRES_DB \
  POSTGRES_HOST \
  POSTGRES_PASSWORD \
  POSTGRES_PORT \
  POSTGRES_USER

AUTH_TOKEN=""
wait_for_signin

WORKSPACE_ID="$(
  curl -fsS "$NOCODB_INTERNAL_URL/api/v1/workspaces" -H "xc-auth: $AUTH_TOKEN" \
    | jq -r 'if type == "array" then .[0].id // empty else .list[0].id // empty end'
)"

if [[ -z "$WORKSPACE_ID" ]]; then
  echo "Unable to resolve the default NocoDB workspace id." >&2
  exit 1
fi

log "Using workspace $WORKSPACE_ID."

log "Setting PostgreSQL search_path for role '$POSTGRES_USER' on database '$APP_POSTGRES_DB' to '$APP_SCHEMA'."
psql_exec "ALTER ROLE \"$POSTGRES_USER\" IN DATABASE \"$APP_POSTGRES_DB\" SET search_path TO \"$APP_SCHEMA\";"

BASE_TITLE_SQL="$(sql_escape "$NOCODB_BASE_TITLE")"
INTEGRATION_TITLE_SQL="$(sql_escape "$NOCODB_INTEGRATION_TITLE")"
SOURCE_ALIAS_SQL="$(sql_escape "$NOCODB_SOURCE_ALIAS")"
WORKSPACE_ID_SQL="$(sql_escape "$WORKSPACE_ID")"

BASE_ID="$(
  psql_query "SELECT id FROM nc_bases_v2 WHERE fk_workspace_id = '$WORKSPACE_ID_SQL' AND title = '$BASE_TITLE_SQL' ORDER BY created_at ASC LIMIT 1;"
)"

if [[ -z "$BASE_ID" ]]; then
  log "Creating base '$NOCODB_BASE_TITLE'."
  BASE_ID="$(
    api_call POST "/api/v1/db/meta/projects/" "$(jq -nc \
      --arg title "$NOCODB_BASE_TITLE" \
      --arg workspace_id "$WORKSPACE_ID" \
      --arg meta "{}" \
      --arg version "$NOCODB_BASE_VERSION" \
      '{title:$title,fk_workspace_id:$workspace_id,type:"database",meta:$meta,version:($version|tonumber)}')" \
      | jq -r '.id // empty'
  )"
fi

if [[ -z "$BASE_ID" ]]; then
  echo "Unable to resolve or create the NocoDB base." >&2
  exit 1
fi

log "Using base $BASE_ID."

INTEGRATION_ID="$(
  psql_query "SELECT id FROM nc_integrations_v2 WHERE fk_workspace_id = '$WORKSPACE_ID_SQL' AND title = '$INTEGRATION_TITLE_SQL' ORDER BY created_at ASC LIMIT 1;"
)"

if [[ -z "$INTEGRATION_ID" ]]; then
  log "Creating PostgreSQL integration '$NOCODB_INTEGRATION_TITLE'."
  INTEGRATION_ID="$(
    api_call POST "/api/v2/meta/workspaces/$WORKSPACE_ID/integrations" "$(jq -nc \
      --arg title "$NOCODB_INTEGRATION_TITLE" \
      --arg host "$POSTGRES_HOST" \
      --arg port "$POSTGRES_PORT" \
      --arg user "$POSTGRES_USER" \
      --arg password "$POSTGRES_PASSWORD" \
      --arg database "$APP_POSTGRES_DB" \
      '{
        type:"database",
        sub_type:"pg",
        title:$title,
        config:{
          client:"pg",
          connection:{
            host:$host,
            port:($port|tonumber),
            user:$user,
            password:$password,
            database:$database
          }
        }
      }')" \
      | jq -r '.id // empty'
  )"
fi

if [[ -z "$INTEGRATION_ID" ]]; then
  echo "Unable to resolve or create the NocoDB PostgreSQL integration." >&2
  exit 1
fi

log "Using integration $INTEGRATION_ID."

INTEGRATION_ID_SQL="$(sql_escape "$INTEGRATION_ID")"
INTEGRATION_CONFIG_JSON="$(jq -nc \
  --arg host "$POSTGRES_HOST" \
  --arg port "$POSTGRES_PORT" \
  --arg user "$POSTGRES_USER" \
  --arg password "$POSTGRES_PASSWORD" \
  --arg database "$APP_POSTGRES_DB" \
  '{
    client:"pg",
    connection:{
      host:$host,
      port:($port|tonumber),
      user:$user,
      password:$password,
      database:$database
    }
  }')"
INTEGRATION_CONFIG_SQL="$(sql_escape "$INTEGRATION_CONFIG_JSON")"

psql_exec "
  UPDATE nc_integrations_v2
  SET config = '$INTEGRATION_CONFIG_SQL'::jsonb,
      updated_at = NOW()
  WHERE id = '$INTEGRATION_ID_SQL';
"

SOURCE_ID="$(
  psql_query "SELECT id FROM nc_sources_v2 WHERE base_id = '$(sql_escape "$BASE_ID")' ORDER BY created_at ASC LIMIT 1;"
)"

if [[ -z "$SOURCE_ID" ]]; then
  echo "Unable to resolve the auto-created NocoDB source for base $BASE_ID." >&2
  exit 1
fi

log "Rebinding source $SOURCE_ID to PostgreSQL database '$APP_POSTGRES_DB' schema '$APP_SCHEMA'."

api_call PATCH "/api/v1/db/meta/projects/$BASE_ID/bases/$SOURCE_ID" "$(jq -nc \
  --arg integration_id "$INTEGRATION_ID" \
  --arg schema "$APP_SCHEMA" \
  --arg alias "$NOCODB_SOURCE_ALIAS" \
  '{fk_integration_id:$integration_id,config:({schema:$schema}|tostring),alias:$alias}')" \
  >/dev/null

SOURCE_CONFIG_JSON="$(jq -nc --arg schema "$APP_SCHEMA" '{schema:$schema}')"
SOURCE_CONFIG_SQL="$(sql_escape "$SOURCE_CONFIG_JSON")"

psql_exec "
  UPDATE nc_sources_v2
  SET fk_integration_id = '$INTEGRATION_ID_SQL',
      alias = '$SOURCE_ALIAS_SQL',
      config = '$SOURCE_CONFIG_SQL'::jsonb,
      is_local = false,
      updated_at = NOW()
  WHERE id = '$(sql_escape "$SOURCE_ID")';
"

api_call DELETE "/api/v1/db/meta/cache" >/dev/null
META_DIFF_RESPONSE="$(api_call POST "/api/v1/db/meta/projects/$BASE_ID/meta-diff" "")"

log "Meta sync triggered for base $BASE_ID."
if [[ -n "$META_DIFF_RESPONSE" ]]; then
  log "meta-diff response: $META_DIFF_RESPONSE"
fi

deadline=$(( $(date +%s) + NOCODB_BOOTSTRAP_TIMEOUT_SECONDS ))
while true; do
  TABLES_RESPONSE="$(api_call GET "/api/v1/db/meta/projects/$BASE_ID/$SOURCE_ID/tables" "")"
  if printf '%s' "$TABLES_RESPONSE" | grep -q '"students"'; then
    log "Bootstrap completed. Business tables are visible in NocoDB."
    exit 0
  fi

  if (( $(date +%s) >= deadline )); then
    echo "Timed out waiting for NocoDB meta sync to expose the business tables." >&2
    echo "$TABLES_RESPONSE" >&2
    exit 1
  fi

  sleep "$NOCODB_BOOTSTRAP_POLL_INTERVAL_SECONDS"
done
