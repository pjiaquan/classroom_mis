#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd docker

NC_ADMIN_EMAIL="$(read_env_var "NC_ADMIN_EMAIL")"
NC_ADMIN_PASSWORD="$(read_env_var "NC_ADMIN_PASSWORD")"
NC_PUBLIC_URL="$(read_env_var "NC_PUBLIC_URL")"
NOCODB_BASE_TITLE="$(read_env_var "NOCODB_BASE_TITLE")"

NOCODB_TEST_URL="${NOCODB_TEST_URL:-${NC_PUBLIC_URL:-http://127.0.0.1:8080}}"
SUFFIX="$(date +%s)"
TODAY="$(date +%F)"
BILLING_MONTH="$(date +%Y-%m-01)"

AUTH_TOKEN=""
BASE_ID=""

STUDENTS_TABLE_ID=""
CLASSES_TABLE_ID=""
ENROLLMENTS_TABLE_ID=""
ATTENDANCE_SESSIONS_TABLE_ID=""
ATTENDANCE_TABLE_ID=""
PAYMENTS_TABLE_ID=""
LEADS_TABLE_ID=""

STUDENT_ID=""
CLASS_ID=""
ENROLLMENT_ID=""
ATTENDANCE_SESSION_ID=""
ATTENDANCE_ID=""
PAYMENT_ID=""
LEAD_ID=""
TEST_SUCCEEDED="false"

log() {
  printf '[test_nocodb_inserts] %s\n' "$*" >&2
}

postgres_query() {
  docker compose exec -T postgres sh -lc \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "$1"' sh "$1"
}

api_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local -a args=(
    -fsS
    -X "$method"
    "$NOCODB_TEST_URL$path"
    -H "xc-auth: $AUTH_TOKEN"
    -H "xc-gui: true"
  )

  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" --data "$data")
  fi

  curl "${args[@]}"
}

delete_record() {
  local table_id="$1"
  local record_id="$2"
  local label="$3"

  if [[ -z "$table_id" || -z "$record_id" ]]; then
    return 0
  fi

  log "Deleting $label record $record_id."
  curl -fsS -X DELETE \
    "$NOCODB_TEST_URL/api/v1/db/data/noco/$BASE_ID/$table_id/$record_id" \
    -H "xc-auth: $AUTH_TOKEN" \
    -H "xc-gui: true" \
    >/dev/null || true
}

cleanup() {
  if [[ "$TEST_SUCCEEDED" == "true" ]]; then
    log "Test completed successfully. Cleaning up test records."
  else
    log "Test failed. Cleaning up any records created before the failure."
  fi

  delete_record "$ATTENDANCE_TABLE_ID" "$ATTENDANCE_ID" "attendance"
  delete_record "$PAYMENTS_TABLE_ID" "$PAYMENT_ID" "payments"
  delete_record "$ENROLLMENTS_TABLE_ID" "$ENROLLMENT_ID" "enrollments"
  delete_record "$ATTENDANCE_SESSIONS_TABLE_ID" "$ATTENDANCE_SESSION_ID" "attendance_sessions"
  delete_record "$LEADS_TABLE_ID" "$LEAD_ID" "leads"
  delete_record "$CLASSES_TABLE_ID" "$CLASS_ID" "classes"
  delete_record "$STUDENTS_TABLE_ID" "$STUDENT_ID" "students"
}

trap cleanup EXIT

AUTH_TOKEN="$(
  curl -fsS -X POST "$NOCODB_TEST_URL/api/v1/auth/user/signin" \
    -H "Content-Type: application/json" \
    --data "$(jq -nc --arg email "$NC_ADMIN_EMAIL" --arg password "$NC_ADMIN_PASSWORD" '{email:$email,password:$password}')" \
    | jq -r '.token // empty'
)"

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "Failed to sign in to NocoDB at $NOCODB_TEST_URL." >&2
  exit 1
fi

BASE_ID="$(
  postgres_query "SELECT id
    FROM nc_bases_v2
    WHERE title = '$(printf "%s" "$NOCODB_BASE_TITLE" | sed "s/'/''/g")'
    ORDER BY created_at ASC
    LIMIT 1;"
)"

if [[ -z "$BASE_ID" ]]; then
  echo "Unable to resolve base id for '$NOCODB_BASE_TITLE'." >&2
  exit 1
fi

resolve_table_id() {
  local table_name="$1"
  postgres_query "SELECT id
    FROM nc_models_v2
    WHERE base_id = '$(printf "%s" "$BASE_ID" | sed "s/'/''/g")'
      AND table_name = '$(printf "%s" "$table_name" | sed "s/'/''/g")'
      AND type = 'table'
    ORDER BY created_at ASC
    LIMIT 1;"
}

STUDENTS_TABLE_ID="$(resolve_table_id "students")"
CLASSES_TABLE_ID="$(resolve_table_id "classes")"
ENROLLMENTS_TABLE_ID="$(resolve_table_id "enrollments")"
ATTENDANCE_SESSIONS_TABLE_ID="$(resolve_table_id "attendance_sessions")"
ATTENDANCE_TABLE_ID="$(resolve_table_id "attendance")"
PAYMENTS_TABLE_ID="$(resolve_table_id "payments")"
LEADS_TABLE_ID="$(resolve_table_id "leads")"

for table_var in \
  STUDENTS_TABLE_ID \
  CLASSES_TABLE_ID \
  ENROLLMENTS_TABLE_ID \
  ATTENDANCE_SESSIONS_TABLE_ID \
  ATTENDANCE_TABLE_ID \
  PAYMENTS_TABLE_ID \
  LEADS_TABLE_ID; do
  if [[ -z "${!table_var}" ]]; then
    echo "Missing table id for $table_var." >&2
    exit 1
  fi
done

create_record() {
  local output_var="$1"
  local table_id="$2"
  local label="$3"
  local payload="$4"
  local response
  local record_id

  response="$(api_request POST "/api/v1/db/data/noco/$BASE_ID/$table_id" "$payload")"
  record_id="$(printf '%s' "$response" | jq -r '.Id // .id // empty')"

  if [[ -z "$record_id" ]]; then
    echo "Failed to create $label." >&2
    echo "$response" >&2
    exit 1
  fi

  log "Created $label record $record_id."
  printf -v "$output_var" '%s' "$record_id"
}

create_record STUDENT_ID "$STUDENTS_TABLE_ID" "students" "$(jq -nc \
  --arg student_code "TEST-STUDENT-$SUFFIX" \
  --arg full_name "測試學生-$SUFFIX" \
  --arg grade "小四" \
  --arg parent_name "測試家長-$SUFFIX" \
  --arg phone "091200${SUFFIX: -4}" \
  '{StudentCode:$student_code,FullName:$full_name,Grade:$grade,ParentName:$parent_name,Phone:$phone}')"

create_record CLASS_ID "$CLASSES_TABLE_ID" "classes" "$(jq -nc \
  --arg class_code "TEST-CLASS-$SUFFIX" \
  --arg class_name "測試班級-$SUFFIX" \
  --arg teacher_name "測試老師" \
  --arg schedule_text "週六 10:00-12:00" \
  '{ClassCode:$class_code,ClassName:$class_name,TeacherName:$teacher_name,ScheduleText:$schedule_text,Capacity:8}')"

create_record ENROLLMENT_ID "$ENROLLMENTS_TABLE_ID" "enrollments" "$(jq -nc \
  --argjson student_id "$STUDENT_ID" \
  --argjson class_id "$CLASS_ID" \
  --arg start_date "$TODAY" \
  '{StudentId:$student_id,ClassId:$class_id,StartDate:$start_date}')"

create_record ATTENDANCE_SESSION_ID "$ATTENDANCE_SESSIONS_TABLE_ID" "attendance_sessions" "$(jq -nc \
  --argjson class_id "$CLASS_ID" \
  --arg session_date "$TODAY" \
  --arg teacher_name "測試老師" \
  '{ClassId:$class_id,SessionDate:$session_date,TeacherName:$teacher_name}')"

create_record ATTENDANCE_ID "$ATTENDANCE_TABLE_ID" "attendance" "$(jq -nc \
  --argjson session_id "$ATTENDANCE_SESSION_ID" \
  --argjson student_id "$STUDENT_ID" \
  '{SessionId:$session_id,StudentId:$student_id,Status:"present"}')"

create_record PAYMENT_ID "$PAYMENTS_TABLE_ID" "payments" "$(jq -nc \
  --argjson student_id "$STUDENT_ID" \
  --arg payment_date "$TODAY" \
  --arg billing_month "$BILLING_MONTH" \
  '{StudentId:$student_id,Amount:1200,PaymentDate:$payment_date,BillingMonth:$billing_month,PaymentType:"tuition",PaymentMethod:"cash"}')"

create_record LEAD_ID "$LEADS_TABLE_ID" "leads" "$(jq -nc \
  --arg parent_name "測試家長-$SUFFIX" \
  --arg phone "092200${SUFFIX: -4}" \
  --arg child_grade "小四" \
  '{ParentName:$parent_name,Phone:$phone,ChildGrade:$child_grade}')"

TEST_SUCCEEDED="true"
log "Every writable business table accepted a create request through the NocoDB data API."
