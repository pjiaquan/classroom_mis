#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[bootstrap] %s\n' "$*"
}

LEADS_FORM_TITLE="潛在客戶填寫表單"
LEADS_FORM_SUBHEADING="請留下聯絡資料與學生資訊，我們會盡快與您聯繫。"
LEADS_FORM_SUCCESS_MSG="送出成功，我們會盡快與您聯繫。"
RESOLVED_APP_SCHEMA=""

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

app_psql_query() {
  PGPASSWORD="$POSTGRES_PASSWORD" \
    psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d "$APP_POSTGRES_DB" \
      -Atqc "$1"
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

resolve_app_schema() {
  local requested_schema_sql
  local requested_table_count
  local public_table_count

  requested_schema_sql="$(sql_escape "$APP_SCHEMA")"
  requested_table_count="$(
    app_psql_query "SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = '$requested_schema_sql'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'schema_migrations';"
  )"

  if (( ${requested_table_count:-0} > 0 )); then
    RESOLVED_APP_SCHEMA="$APP_SCHEMA"
    log "Using configured business schema '$RESOLVED_APP_SCHEMA'."
    return 0
  fi

  if [[ "$APP_SCHEMA" != "public" ]]; then
    public_table_count="$(
      app_psql_query "SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> 'schema_migrations';"
    )"

    if (( ${public_table_count:-0} > 0 )); then
      RESOLVED_APP_SCHEMA="public"
      log "Configured APP_SCHEMA '$APP_SCHEMA' has no business tables; using detected schema '$RESOLVED_APP_SCHEMA' instead."
      return 0
    fi
  fi

  RESOLVED_APP_SCHEMA="$APP_SCHEMA"
  log "Using configured business schema '$RESOLVED_APP_SCHEMA'."
}

ensure_localized_table_titles() {
  local base_id_sql
  local source_id_sql

  base_id_sql="$(sql_escape "$BASE_ID")"
  source_id_sql="$(sql_escape "$SOURCE_ID")"

  log "Applying localized table titles."

  psql_exec "
    WITH localized_tables(table_name, localized_title) AS (
      VALUES
        ('students', '學生'),
        ('classes', '班級'),
        ('enrollments', '報名紀錄'),
        ('attendance_sessions', '課程場次'),
        ('attendance', '出席紀錄'),
        ('payments', '繳費紀錄'),
        ('leads', '潛在客戶'),
        ('schema_migrations', '結構版本紀錄')
    )
    UPDATE nc_models_v2 m
    SET title = lt.localized_title,
        updated_at = NOW()
    FROM localized_tables lt
    WHERE m.base_id = '$base_id_sql'
      AND m.source_id = '$source_id_sql'
      AND m.table_name = lt.table_name
      AND m.title IS DISTINCT FROM lt.localized_title;

    WITH localized_tables(table_name, localized_title) AS (
      VALUES
        ('students', '學生'),
        ('classes', '班級'),
        ('enrollments', '報名紀錄'),
        ('attendance_sessions', '課程場次'),
        ('attendance', '出席紀錄'),
        ('payments', '繳費紀錄'),
        ('leads', '潛在客戶'),
        ('schema_migrations', '結構版本紀錄')
    )
    UPDATE nc_views_v2 v
    SET title = lt.localized_title,
        updated_at = NOW()
    FROM nc_models_v2 m
    JOIN localized_tables lt
      ON lt.table_name = m.table_name
    WHERE v.base_id = '$base_id_sql'
      AND v.source_id = '$source_id_sql'
      AND v.type = 3
      AND v.fk_model_id = m.id
      AND m.base_id = '$base_id_sql'
      AND m.source_id = '$source_id_sql'
      AND v.title IS DISTINCT FROM lt.localized_title;
  "
}

ensure_single_select_fields() {
  local base_id_sql
  local source_id_sql
  local workspace_id_sql

  base_id_sql="$(sql_escape "$BASE_ID")"
  source_id_sql="$(sql_escape "$SOURCE_ID")"
  workspace_id_sql="$(sql_escape "$WORKSPACE_ID")"

  log "Applying curated single-select metadata for enum-like fields."

  psql_exec "
    WITH configured(table_name, column_name, option_title, option_color, option_order) AS (
      VALUES
        ('students', 'status', 'active', '#2563eb', 1),
        ('students', 'status', 'paused', '#f59e0b', 2),
        ('students', 'status', 'left', '#6b7280', 3),
        ('classes', 'status', 'open', '#16a34a', 1),
        ('classes', 'status', 'full', '#dc2626', 2),
        ('classes', 'status', 'closed', '#6b7280', 3),
        ('enrollments', 'status', 'active', '#2563eb', 1),
        ('enrollments', 'status', 'completed', '#16a34a', 2),
        ('enrollments', 'status', 'dropped', '#dc2626', 3),
        ('attendance_sessions', 'status', 'open', '#2563eb', 1),
        ('attendance_sessions', 'status', 'closed', '#6b7280', 2),
        ('attendance', 'status', 'present', '#16a34a', 1),
        ('attendance', 'status', 'leave', '#f59e0b', 2),
        ('attendance', 'status', 'absent', '#dc2626', 3),
        ('payments', 'payment_type', 'tuition', '#2563eb', 1),
        ('payments', 'payment_type', 'material', '#8b5cf6', 2),
        ('payments', 'payment_type', 'registration', '#f59e0b', 3),
        ('payments', 'payment_type', 'other', '#6b7280', 4),
        ('payments', 'status', 'paid', '#16a34a', 1),
        ('payments', 'status', 'pending', '#f59e0b', 2),
        ('payments', 'status', 'refunded', '#dc2626', 3),
        ('payments', 'payment_method', 'cash', '#2563eb', 1),
        ('payments', 'payment_method', 'transfer', '#0f766e', 2),
        ('payments', 'payment_method', 'card', '#8b5cf6', 3),
        ('payments', 'payment_method', 'other', '#6b7280', 4),
        ('leads', 'source', 'walk_in', '#2563eb', 1),
        ('leads', 'source', 'referral', '#16a34a', 2),
        ('leads', 'source', 'facebook', '#1877f2', 3),
        ('leads', 'source', 'line', '#06c755', 4),
        ('leads', 'source', 'website', '#0f766e', 5),
        ('leads', 'source', 'flyer', '#f59e0b', 6),
        ('leads', 'source', 'other', '#6b7280', 7),
        ('leads', 'status', 'new', '#2563eb', 1),
        ('leads', 'status', 'trial', '#8b5cf6', 2),
        ('leads', 'status', 'enroll', '#16a34a', 3),
        ('leads', 'status', 'lost', '#dc2626', 4)
    ),
    target_columns AS (
      SELECT DISTINCT c.id AS column_id
      FROM configured cfg
      JOIN nc_models_v2 m
        ON m.base_id = '$base_id_sql'
       AND m.source_id = '$source_id_sql'
       AND m.table_name = cfg.table_name
      JOIN nc_columns_v2 c
        ON c.fk_model_id = m.id
       AND c.column_name = cfg.column_name
    )
    UPDATE nc_columns_v2 c
    SET uidt = 'SingleSelect',
        updated_at = NOW()
    FROM target_columns tc
    WHERE c.id = tc.column_id
      AND c.uidt IS DISTINCT FROM 'SingleSelect';

    WITH configured(table_name, column_name, option_title, option_color, option_order) AS (
      VALUES
        ('students', 'status', 'active', '#2563eb', 1),
        ('students', 'status', 'paused', '#f59e0b', 2),
        ('students', 'status', 'left', '#6b7280', 3),
        ('classes', 'status', 'open', '#16a34a', 1),
        ('classes', 'status', 'full', '#dc2626', 2),
        ('classes', 'status', 'closed', '#6b7280', 3),
        ('enrollments', 'status', 'active', '#2563eb', 1),
        ('enrollments', 'status', 'completed', '#16a34a', 2),
        ('enrollments', 'status', 'dropped', '#dc2626', 3),
        ('attendance_sessions', 'status', 'open', '#2563eb', 1),
        ('attendance_sessions', 'status', 'closed', '#6b7280', 2),
        ('attendance', 'status', 'present', '#16a34a', 1),
        ('attendance', 'status', 'leave', '#f59e0b', 2),
        ('attendance', 'status', 'absent', '#dc2626', 3),
        ('payments', 'payment_type', 'tuition', '#2563eb', 1),
        ('payments', 'payment_type', 'material', '#8b5cf6', 2),
        ('payments', 'payment_type', 'registration', '#f59e0b', 3),
        ('payments', 'payment_type', 'other', '#6b7280', 4),
        ('payments', 'status', 'paid', '#16a34a', 1),
        ('payments', 'status', 'pending', '#f59e0b', 2),
        ('payments', 'status', 'refunded', '#dc2626', 3),
        ('payments', 'payment_method', 'cash', '#2563eb', 1),
        ('payments', 'payment_method', 'transfer', '#0f766e', 2),
        ('payments', 'payment_method', 'card', '#8b5cf6', 3),
        ('payments', 'payment_method', 'other', '#6b7280', 4),
        ('leads', 'source', 'walk_in', '#2563eb', 1),
        ('leads', 'source', 'referral', '#16a34a', 2),
        ('leads', 'source', 'facebook', '#1877f2', 3),
        ('leads', 'source', 'line', '#06c755', 4),
        ('leads', 'source', 'website', '#0f766e', 5),
        ('leads', 'source', 'flyer', '#f59e0b', 6),
        ('leads', 'source', 'other', '#6b7280', 7),
        ('leads', 'status', 'new', '#2563eb', 1),
        ('leads', 'status', 'trial', '#8b5cf6', 2),
        ('leads', 'status', 'enroll', '#16a34a', 3),
        ('leads', 'status', 'lost', '#dc2626', 4)
    ),
    target_columns AS (
      SELECT DISTINCT c.id AS column_id
      FROM configured cfg
      JOIN nc_models_v2 m
        ON m.base_id = '$base_id_sql'
       AND m.source_id = '$source_id_sql'
       AND m.table_name = cfg.table_name
      JOIN nc_columns_v2 c
        ON c.fk_model_id = m.id
       AND c.column_name = cfg.column_name
    )
    DELETE FROM nc_col_select_options_v2 so
    WHERE so.fk_column_id IN (
      SELECT column_id
      FROM target_columns
    );

    WITH configured(table_name, column_name, option_title, option_color, option_order) AS (
      VALUES
        ('students', 'status', 'active', '#2563eb', 1),
        ('students', 'status', 'paused', '#f59e0b', 2),
        ('students', 'status', 'left', '#6b7280', 3),
        ('classes', 'status', 'open', '#16a34a', 1),
        ('classes', 'status', 'full', '#dc2626', 2),
        ('classes', 'status', 'closed', '#6b7280', 3),
        ('enrollments', 'status', 'active', '#2563eb', 1),
        ('enrollments', 'status', 'completed', '#16a34a', 2),
        ('enrollments', 'status', 'dropped', '#dc2626', 3),
        ('attendance_sessions', 'status', 'open', '#2563eb', 1),
        ('attendance_sessions', 'status', 'closed', '#6b7280', 2),
        ('attendance', 'status', 'present', '#16a34a', 1),
        ('attendance', 'status', 'leave', '#f59e0b', 2),
        ('attendance', 'status', 'absent', '#dc2626', 3),
        ('payments', 'payment_type', 'tuition', '#2563eb', 1),
        ('payments', 'payment_type', 'material', '#8b5cf6', 2),
        ('payments', 'payment_type', 'registration', '#f59e0b', 3),
        ('payments', 'payment_type', 'other', '#6b7280', 4),
        ('payments', 'status', 'paid', '#16a34a', 1),
        ('payments', 'status', 'pending', '#f59e0b', 2),
        ('payments', 'status', 'refunded', '#dc2626', 3),
        ('payments', 'payment_method', 'cash', '#2563eb', 1),
        ('payments', 'payment_method', 'transfer', '#0f766e', 2),
        ('payments', 'payment_method', 'card', '#8b5cf6', 3),
        ('payments', 'payment_method', 'other', '#6b7280', 4),
        ('leads', 'source', 'walk_in', '#2563eb', 1),
        ('leads', 'source', 'referral', '#16a34a', 2),
        ('leads', 'source', 'facebook', '#1877f2', 3),
        ('leads', 'source', 'line', '#06c755', 4),
        ('leads', 'source', 'website', '#0f766e', 5),
        ('leads', 'source', 'flyer', '#f59e0b', 6),
        ('leads', 'source', 'other', '#6b7280', 7),
        ('leads', 'status', 'new', '#2563eb', 1),
        ('leads', 'status', 'trial', '#8b5cf6', 2),
        ('leads', 'status', 'enroll', '#16a34a', 3),
        ('leads', 'status', 'lost', '#dc2626', 4)
    ),
    target_columns AS (
      SELECT DISTINCT
        cfg.table_name,
        cfg.column_name,
        cfg.option_title,
        cfg.option_color,
        cfg.option_order,
        c.id AS column_id
      FROM configured cfg
      JOIN nc_models_v2 m
        ON m.base_id = '$base_id_sql'
       AND m.source_id = '$source_id_sql'
       AND m.table_name = cfg.table_name
      JOIN nc_columns_v2 c
        ON c.fk_model_id = m.id
       AND c.column_name = cfg.column_name
    )
    INSERT INTO nc_col_select_options_v2 (
      id,
      fk_column_id,
      title,
      color,
      \"order\",
      base_id,
      fk_workspace_id,
      created_at,
      updated_at
    )
    SELECT
      'so_' || substr(md5(tc.column_id || ':' || tc.option_title), 1, 17),
      tc.column_id,
      tc.option_title,
      tc.option_color,
      tc.option_order::real,
      '$base_id_sql',
      '$workspace_id_sql',
      NOW(),
      NOW()
    FROM target_columns tc
    ORDER BY tc.table_name, tc.column_name, tc.option_order;
  "
}

ensure_leads_form_view() {
  local base_id_sql
  local source_id_sql
  local leads_model_id
  local leads_form_id
  local duplicate_form_ids
  local duplicate_form_id
  local form_payload
  local form_response
  local leads_form_title_sql
  local leads_form_subheading_sql
  local leads_form_success_msg_sql

  base_id_sql="$(sql_escape "$BASE_ID")"
  source_id_sql="$(sql_escape "$SOURCE_ID")"

  leads_model_id="$(
    psql_query "SELECT id
      FROM nc_models_v2
      WHERE base_id = '$base_id_sql'
        AND source_id = '$source_id_sql'
        AND table_name = 'leads'
      ORDER BY created_at ASC
      LIMIT 1;"
  )"

  if [[ -z "$leads_model_id" ]]; then
    log "Skipping curated leads form setup because the leads table metadata is not available yet."
    return 0
  fi

  leads_form_title_sql="$(sql_escape "$LEADS_FORM_TITLE")"
  leads_form_subheading_sql="$(sql_escape "$LEADS_FORM_SUBHEADING")"
  leads_form_success_msg_sql="$(sql_escape "$LEADS_FORM_SUCCESS_MSG")"

  leads_form_id="$(
    psql_query "SELECT id
      FROM nc_views_v2
      WHERE base_id = '$base_id_sql'
        AND source_id = '$source_id_sql'
        AND fk_model_id = '$(sql_escape "$leads_model_id")'
        AND type = 1
        AND title = '$leads_form_title_sql'
      ORDER BY created_at ASC
      LIMIT 1;"
  )"

  if [[ -z "$leads_form_id" ]]; then
    leads_form_id="$(
      psql_query "SELECT id
        FROM nc_views_v2
        WHERE base_id = '$base_id_sql'
          AND source_id = '$source_id_sql'
          AND fk_model_id = '$(sql_escape "$leads_model_id")'
          AND type = 1
        ORDER BY created_at ASC
        LIMIT 1;"
    )"
  fi

  if [[ -z "$leads_form_id" ]]; then
    log "Creating curated form view '$LEADS_FORM_TITLE' for leads."
    form_payload="$(jq -nc --arg title "$LEADS_FORM_TITLE" '{title:$title,type:1}')"
    form_response="$(
      api_call POST "/api/v2/internal/$WORKSPACE_ID/$BASE_ID?operation=formViewCreate&tableId=$leads_model_id" "$form_payload"
    )"
    leads_form_id="$(printf '%s' "$form_response" | jq -r '.id // empty')"
  fi

  if [[ -z "$leads_form_id" ]]; then
    echo "Unable to resolve or create the curated leads form view." >&2
    exit 1
  fi

  log "Configuring curated leads form view $leads_form_id."

  psql_exec "
    UPDATE nc_views_v2
    SET title = '$leads_form_title_sql',
        updated_at = NOW()
    WHERE id = '$(sql_escape "$leads_form_id")';

    UPDATE nc_form_view_v2
    SET heading = '$leads_form_title_sql',
        subheading = '$leads_form_subheading_sql',
        success_msg = '$leads_form_success_msg_sql',
        submit_another_form = true,
        show_blank_form = true,
        updated_at = NOW()
    WHERE fk_view_id = '$(sql_escape "$leads_form_id")';

    WITH lead_columns AS (
      SELECT id, column_name
      FROM nc_columns_v2
      WHERE fk_model_id = '$(sql_escape "$leads_model_id")'
    )
    UPDATE nc_form_view_columns_v2 fvc
    SET show = CASE lc.column_name
          WHEN 'parent_name' THEN true
          WHEN 'phone' THEN true
          WHEN 'child_name' THEN true
          WHEN 'child_grade' THEN true
          WHEN 'source' THEN true
          WHEN 'notes' THEN true
          ELSE false
        END,
        required = CASE lc.column_name
          WHEN 'parent_name' THEN true
          WHEN 'phone' THEN true
          WHEN 'child_grade' THEN true
          ELSE false
        END,
        label = CASE lc.column_name
          WHEN 'parent_name' THEN '家長姓名'
          WHEN 'phone' THEN '聯絡電話'
          WHEN 'child_name' THEN '學生姓名'
          WHEN 'child_grade' THEN '學生年級'
          WHEN 'notes' THEN '備註'
          ELSE NULL
        END,
        help = NULL,
        description = NULL,
        \"order\" = CASE lc.column_name
          WHEN 'parent_name' THEN 1
          WHEN 'phone' THEN 2
          WHEN 'child_name' THEN 3
          WHEN 'child_grade' THEN 4
          WHEN 'notes' THEN 5
          ELSE 100
        END,
        updated_at = NOW()
    FROM lead_columns lc
    WHERE fvc.fk_view_id = '$(sql_escape "$leads_form_id")'
      AND fvc.fk_column_id = lc.id;

    UPDATE nc_form_view_columns_v2
    SET show = false,
        required = false,
        label = NULL,
        help = NULL,
        description = NULL,
        \"order\" = 100,
        updated_at = NOW()
    WHERE fk_view_id = '$(sql_escape "$leads_form_id")'
      AND fk_column_id IN (
        SELECT id
        FROM nc_columns_v2
        WHERE fk_model_id = '$(sql_escape "$leads_model_id")'
          AND column_name = 'source'
      );
  "

  duplicate_form_ids="$(
    psql_query "SELECT id
      FROM nc_views_v2
      WHERE base_id = '$base_id_sql'
        AND source_id = '$source_id_sql'
        AND fk_model_id = '$(sql_escape "$leads_model_id")'
        AND type = 1
        AND id <> '$(sql_escape "$leads_form_id")'
      ORDER BY created_at ASC;"
  )"

  if [[ -n "$duplicate_form_ids" ]]; then
    while IFS= read -r duplicate_form_id; do
      [[ -z "$duplicate_form_id" ]] && continue
      log "Deleting extra leads form view $duplicate_form_id."
      api_call POST "/api/v2/internal/$WORKSPACE_ID/$BASE_ID?operation=viewDelete&viewId=$duplicate_form_id" "{}" >/dev/null
    done <<< "$duplicate_form_ids"
  fi
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

resolve_app_schema

if [[ "$RESOLVED_APP_SCHEMA" == "public" ]]; then
  log "Setting PostgreSQL search_path for role '$POSTGRES_USER' on database '$APP_POSTGRES_DB' to 'public'."
  psql_exec "ALTER ROLE \"$POSTGRES_USER\" IN DATABASE \"$APP_POSTGRES_DB\" SET search_path TO public;"
else
  log "Setting PostgreSQL search_path for role '$POSTGRES_USER' on database '$APP_POSTGRES_DB' to '$RESOLVED_APP_SCHEMA, public'."
  psql_exec "ALTER ROLE \"$POSTGRES_USER\" IN DATABASE \"$APP_POSTGRES_DB\" SET search_path TO \"$RESOLVED_APP_SCHEMA\", public;"
fi

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

log "Rebinding source $SOURCE_ID to PostgreSQL database '$APP_POSTGRES_DB' schema '$RESOLVED_APP_SCHEMA'."

api_call PATCH "/api/v1/db/meta/projects/$BASE_ID/bases/$SOURCE_ID" "$(jq -nc \
  --arg integration_id "$INTEGRATION_ID" \
  --arg schema "$RESOLVED_APP_SCHEMA" \
  --arg alias "$NOCODB_SOURCE_ALIAS" \
  '{fk_integration_id:$integration_id,config:({schema:$schema}|tostring),alias:$alias}')" \
  >/dev/null

SOURCE_CONFIG_JSON="$(jq -nc --arg schema "$RESOLVED_APP_SCHEMA" '{schema:$schema}')"
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
    ensure_localized_table_titles
    ensure_single_select_fields
    ensure_leads_form_view
    api_call DELETE "/api/v1/db/meta/cache" >/dev/null
    log "Bootstrap completed. Business tables, curated single-select fields, and the curated leads form are visible in NocoDB."
    exit 0
  fi

  if (( $(date +%s) >= deadline )); then
    echo "Timed out waiting for NocoDB meta sync to expose the business tables." >&2
    echo "$TABLES_RESPONSE" >&2
    exit 1
  fi

  sleep "$NOCODB_BOOTSTRAP_POLL_INTERVAL_SECONDS"
done
