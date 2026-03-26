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

postgres_query() {
  docker compose exec -T \
    -e APP_SCHEMA="$APP_SCHEMA" \
    -e APP_POSTGRES_DB="$APP_POSTGRES_DB" \
    postgres sh -lc \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" -Atqc "$1"' sh "$1"
}

postgres_exec() {
  docker compose exec -T \
    -e APP_SCHEMA="$APP_SCHEMA" \
    -e APP_POSTGRES_DB="$APP_POSTGRES_DB" \
    postgres sh -lc \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$APP_POSTGRES_DB" -qc "$1"' sh "$1"
}

resolve_app_schema

COUNTS_OUTPUT="$(
  postgres_query "
    SET search_path TO \"$APP_SCHEMA\", public;
    SELECT table_name || ':' || row_count
    FROM (
      SELECT 'teachers' AS table_name, COUNT(*)::bigint AS row_count FROM teachers
      UNION ALL
      SELECT 'subjects', COUNT(*)::bigint FROM subjects
      UNION ALL
      SELECT 'students' AS table_name, COUNT(*)::bigint AS row_count FROM students
      UNION ALL
      SELECT 'classes', COUNT(*)::bigint FROM classes
      UNION ALL
      SELECT 'tuition_fees', COUNT(*)::bigint FROM tuition_fees
      UNION ALL
      SELECT 'enrollments', COUNT(*)::bigint FROM enrollments
      UNION ALL
      SELECT 'attendance_sessions', COUNT(*)::bigint FROM attendance_sessions
      UNION ALL
      SELECT 'attendance', COUNT(*)::bigint FROM attendance
      UNION ALL
      SELECT 'payments', COUNT(*)::bigint FROM payments
      UNION ALL
      SELECT 'leads', COUNT(*)::bigint FROM leads
    ) counts
    ORDER BY table_name;
  "
)"

NON_EMPTY_TABLES="$(
  printf '%s\n' "$COUNTS_OUTPUT" \
    | awk -F: '$2 != 0 { print $1 ":" $2 }'
)"

if [[ -n "$NON_EMPTY_TABLES" ]]; then
  echo "Skipping demo seed because business data already exists." >&2
  echo "Current counts:" >&2
  printf '%s\n' "$COUNTS_OUTPUT" >&2
  exit 0
fi

postgres_exec "
  BEGIN;
  SET LOCAL search_path TO \"$APP_SCHEMA\", public;

  -- Seed teachers
  INSERT INTO teachers (teacher_code, full_name, phone, email, status, notes)
  VALUES
    ('T001', '林雅婷', '0933000001', 'lin@example.com', 'active', 'Demo seed teacher - Math'),
    ('T002', '張美華', '0933000002', 'zhang@example.com', 'active', 'Demo seed teacher - English'),
    ('T003', '陳建志', '0933000003', 'chen@example.com', 'active', 'Demo seed teacher - Chinese');

  -- Seed subjects
  INSERT INTO subjects (subject_code, subject_name, description, status)
  VALUES
    ('MATH', '數學', '中小學數學培訓', 'active'),
    ('ENG', '英文', '英語閱讀與會話', 'active'),
    ('CHINESE', '作文', '中文寫作訓練', 'active');

  -- Seed students
    student_code,
    full_name,
    grade,
    school_name,
    parent_name,
    phone,
    status,
    join_date,
    notes
  )
  VALUES
    ('DEMO-STU-001', '王小明', 'G4', '和平國小', '王媽媽', '0912000001', 'active', (CURRENT_DATE - INTERVAL '90 day')::date, 'Demo seed student'),
    ('DEMO-STU-002', '陳小華', 'G5', '仁愛國小', '陳爸爸', '0912000002', 'active', (CURRENT_DATE - INTERVAL '60 day')::date, 'Demo seed student'),
    ('DEMO-STU-003', '李小安', 'G3', '信義國小', '李媽媽', '0912000003', 'active', (CURRENT_DATE - INTERVAL '30 day')::date, 'Demo seed student'),
    ('DEMO-STU-004', '周小晴', 'G6', '大安國小', '周爸爸', '0912000004', 'paused', (CURRENT_DATE - INTERVAL '120 day')::date, 'Demo seed student'),
    ('DEMO-STU-005', '林子軒', 'G2', '光復國小', '林媽媽', '0912000005', 'left', (CURRENT_DATE - INTERVAL '180 day')::date, 'Demo seed student');

  INSERT INTO classes (
    class_code,
    class_name,
    teacher_name,
    teacher_id,
    subject_id,
    schedule_text,
    day_of_week,
    start_time,
    end_time,
    room,
    capacity,
    max_capacity,
    status,
    start_date,
    notes
  )
  VALUES
    ('DEMO-CLS-001', '國小數學培訓班', '林老師', 1, 1, 'Tue 19:00-21:00', 2, '19:00', '21:00', 'Room A', 12, 15, 'open', (CURRENT_DATE - INTERVAL '70 day')::date, 'Demo seed class'),
    ('DEMO-CLS-002', '國小英文閱讀班', '張老師', 2, 2, 'Sat 10:00-12:00', 6, '10:00', '12:00', 'Room B', 10, 12, 'open', (CURRENT_DATE - INTERVAL '45 day')::date, 'Demo seed class'),
    ('DEMO-CLS-003', '國小作文衝刺班', '陳老師', 3, 3, 'Thu 18:30-20:30', 4, '18:30', '20:30', 'Room A', 8, 10, 'full', (CURRENT_DATE - INTERVAL '100 day')::date, 'Demo seed class');

  -- Seed tuition fees
  INSERT INTO tuition_fees (class_id, fee_amount, fee_type, billing_cycle, effective_from, notes)
  SELECT
    c.id,
    mapped.fee_amount,
    mapped.fee_type,
    mapped.billing_cycle,
    mapped.effective_from,
    mapped.notes
  FROM (
    VALUES
      ('DEMO-CLS-001', 3200::numeric, 'monthly', 'monthly', (CURRENT_DATE - INTERVAL '70 day')::date, 'Demo seed tuition fee'),
      ('DEMO-CLS-002', 2800::numeric, 'monthly', 'monthly', (CURRENT_DATE - INTERVAL '45 day')::date, 'Demo seed tuition fee'),
      ('DEMO-CLS-003', 2600::numeric, 'monthly', 'monthly', (CURRENT_DATE - INTERVAL '100 day')::date, 'Demo seed tuition fee')
  ) AS mapped(class_code, fee_amount, fee_type, billing_cycle, effective_from, notes)
  JOIN classes c
    ON c.class_code = mapped.class_code;

  INSERT INTO enrollments (
    student_id,
    class_id,
    start_date,
    end_date,
    status,
    tuition_plan,
    notes
  )
  SELECT
    s.id,
    c.id,
    mapped.start_date,
    mapped.end_date,
    mapped.status,
    mapped.tuition_plan,
    mapped.notes
  FROM (
    VALUES
      ('DEMO-STU-001', 'DEMO-CLS-001', (CURRENT_DATE - INTERVAL '70 day')::date, NULL::date, 'active', 'monthly', 'Demo seed enrollment'),
      ('DEMO-STU-002', 'DEMO-CLS-001', (CURRENT_DATE - INTERVAL '50 day')::date, NULL::date, 'active', 'quarterly', 'Demo seed enrollment'),
      ('DEMO-STU-003', 'DEMO-CLS-002', (CURRENT_DATE - INTERVAL '28 day')::date, NULL::date, 'active', 'monthly', 'Demo seed enrollment'),
      ('DEMO-STU-004', 'DEMO-CLS-003', (CURRENT_DATE - INTERVAL '90 day')::date, NULL::date, 'active', 'semester', 'Demo seed enrollment'),
      ('DEMO-STU-005', 'DEMO-CLS-002', (CURRENT_DATE - INTERVAL '140 day')::date, (CURRENT_DATE - INTERVAL '15 day')::date, 'completed', 'monthly', 'Demo seed enrollment')
  ) AS mapped(student_code, class_code, start_date, end_date, status, tuition_plan, notes)
  JOIN students s
    ON s.student_code = mapped.student_code
  JOIN classes c
    ON c.class_code = mapped.class_code;

  INSERT INTO attendance_sessions (
    class_id,
    session_date,
    teacher_name,
    topic,
    status,
    notes
  )
  SELECT
    c.id,
    mapped.session_date,
    mapped.teacher_name,
    mapped.topic,
    mapped.status,
    mapped.notes
  FROM (
    VALUES
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '14 day')::date, '林老師', '整數四則運算', 'closed', 'Demo seed attendance session'),
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '7 day')::date, '林老師', '分數應用題', 'closed', 'Demo seed attendance session'),
      ('DEMO-CLS-002', (CURRENT_DATE - INTERVAL '6 day')::date, '張老師', '短篇閱讀理解', 'closed', 'Demo seed attendance session'),
      ('DEMO-CLS-003', (CURRENT_DATE - INTERVAL '3 day')::date, '陳老師', '記敘文寫作', 'open', 'Demo seed attendance session')
  ) AS mapped(class_code, session_date, teacher_name, topic, status, notes)
  JOIN classes c
    ON c.class_code = mapped.class_code;

  INSERT INTO attendance (
    session_id,
    student_id,
    status,
    notes
  )
  SELECT
    sess.id,
    stu.id,
    mapped.status,
    mapped.notes
  FROM (
    VALUES
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '14 day')::date, 'DEMO-STU-001', 'present', 'Demo seed attendance'),
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '14 day')::date, 'DEMO-STU-002', 'leave', 'Demo seed attendance'),
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '7 day')::date, 'DEMO-STU-001', 'present', 'Demo seed attendance'),
      ('DEMO-CLS-001', (CURRENT_DATE - INTERVAL '7 day')::date, 'DEMO-STU-002', 'absent', 'Demo seed attendance'),
      ('DEMO-CLS-002', (CURRENT_DATE - INTERVAL '6 day')::date, 'DEMO-STU-003', 'present', 'Demo seed attendance'),
      ('DEMO-CLS-003', (CURRENT_DATE - INTERVAL '3 day')::date, 'DEMO-STU-004', 'present', 'Demo seed attendance')
  ) AS mapped(class_code, session_date, student_code, status, notes)
  JOIN classes c
    ON c.class_code = mapped.class_code
  JOIN attendance_sessions sess
    ON sess.class_id = c.id
   AND sess.session_date = mapped.session_date
  JOIN students stu
    ON stu.student_code = mapped.student_code;

  INSERT INTO payments (
    student_id,
    amount,
    payment_date,
    billing_month,
    payment_type,
    status,
    payment_method,
    notes
  )
  SELECT
    s.id,
    mapped.amount,
    mapped.payment_date,
    mapped.billing_month,
    mapped.payment_type,
    mapped.status,
    mapped.payment_method,
    mapped.notes
  FROM (
    VALUES
      ('DEMO-STU-001', 3200::numeric, (CURRENT_DATE - INTERVAL '35 day')::date, DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date, 'tuition', 'paid', 'transfer', 'Demo seed payment'),
      ('DEMO-STU-001', 3200::numeric, (CURRENT_DATE - INTERVAL '5 day')::date, DATE_TRUNC('month', CURRENT_DATE)::date, 'tuition', 'paid', 'card', 'Demo seed payment'),
      ('DEMO-STU-002', 800::numeric, (CURRENT_DATE - INTERVAL '12 day')::date, DATE_TRUNC('month', CURRENT_DATE)::date, 'material', 'paid', 'cash', 'Demo seed payment'),
      ('DEMO-STU-003', 2800::numeric, (CURRENT_DATE - INTERVAL '2 day')::date, DATE_TRUNC('month', CURRENT_DATE)::date, 'tuition', 'pending', 'transfer', 'Demo seed payment'),
      ('DEMO-STU-004', 1200::numeric, (CURRENT_DATE - INTERVAL '20 day')::date, DATE_TRUNC('month', CURRENT_DATE)::date, 'registration', 'paid', 'cash', 'Demo seed payment'),
      ('DEMO-STU-005', 2600::numeric, (CURRENT_DATE - INTERVAL '40 day')::date, DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date, 'tuition', 'refunded', 'other', 'Demo seed payment')
  ) AS mapped(student_code, amount, payment_date, billing_month, payment_type, status, payment_method, notes)
  JOIN students s
    ON s.student_code = mapped.student_code;

  INSERT INTO leads (
    parent_name,
    phone,
    child_name,
    child_grade,
    source,
    status,
    follow_up_date,
    trial_date,
    converted_student_id,
    assigned_to,
    notes
  )
  SELECT
    mapped.parent_name,
    mapped.phone,
    mapped.child_name,
    mapped.child_grade,
    mapped.source,
    mapped.status,
    mapped.follow_up_date,
    mapped.trial_date,
    converted.id,
    mapped.assigned_to,
    mapped.notes
  FROM (
    VALUES
      ('黃媽媽', '0922000101', '黃小宇', 'G1', 'website', 'new', (CURRENT_DATE + INTERVAL '2 day')::date, NULL::date, NULL::text, '櫃台', 'Demo seed lead'),
      ('趙爸爸', '0922000102', '趙小涵', 'G4', 'referral', 'trial', (CURRENT_DATE + INTERVAL '1 day')::date, (CURRENT_DATE + INTERVAL '5 day')::date, NULL::text, '顧問', 'Demo seed lead'),
      ('吳媽媽', '0922000103', '吳小潔', 'G6', 'facebook', 'lost', NULL::date, NULL::date, NULL::text, '行銷', 'Demo seed lead'),
      ('許爸爸', '0922000104', '許小傑', 'G3', 'line', 'new', (CURRENT_DATE + INTERVAL '4 day')::date, NULL::date, NULL::text, '櫃台', 'Demo seed lead'),
      ('李媽媽', '0922000105', '李小安', 'G3', 'website', 'enroll', NULL::date, (CURRENT_DATE - INTERVAL '20 day')::date, 'DEMO-STU-003', '顧問', 'Converted demo lead')
  ) AS mapped(parent_name, phone, child_name, child_grade, source, status, follow_up_date, trial_date, converted_student_code, assigned_to, notes)
  LEFT JOIN students converted
    ON converted.student_code = mapped.converted_student_code;

  COMMIT;
"

echo "Richer demo seed inserted into schema '$APP_SCHEMA'."
echo "Seeded tables: teachers, subjects, students, classes, tuition_fees, enrollments, attendance_sessions, attendance, payments, leads"
