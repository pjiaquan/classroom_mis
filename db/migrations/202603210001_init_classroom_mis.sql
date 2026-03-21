-- migrate:up

CREATE SCHEMA IF NOT EXISTS mis;
SET search_path TO mis, public;

CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  school_name TEXT,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'left')),
  join_date DATE,
  leave_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
  id BIGSERIAL PRIMARY KEY,
  class_code TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  schedule_text TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE enrollments (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  tuition_plan TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT enrollments_student_class_start_unique UNIQUE (student_id, class_id, start_date)
);

CREATE TABLE attendance_sessions (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  teacher_name TEXT NOT NULL,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_sessions_class_date_unique UNIQUE (class_id, session_date)
);

CREATE TABLE attendance (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'leave', 'absent')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_session_student_unique UNIQUE (session_id, student_id)
);

CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  payment_date DATE NOT NULL,
  billing_month DATE NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('tuition', 'material', 'registration', 'other')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leads (
  id BIGSERIAL PRIMARY KEY,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  child_name TEXT,
  child_grade TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('walk_in', 'referral', 'facebook', 'line', 'website', 'flyer', 'other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'trial', 'enroll', 'lost')),
  follow_up_date DATE,
  trial_date DATE,
  converted_student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_attendance_sessions_class_id ON attendance_sessions(class_id);
CREATE INDEX idx_attendance_sessions_session_date ON attendance_sessions(session_date);
CREATE INDEX idx_attendance_session_id ON attendance(session_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_billing_month ON payments(billing_month);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_follow_up_date ON leads(follow_up_date);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enrollments_updated_at
BEFORE UPDATE ON enrollments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_sessions_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE VIEW v_class_current_sizes AS
SELECT
  c.id AS class_id,
  c.class_code,
  c.class_name,
  c.teacher_name,
  c.capacity,
  COUNT(e.id) FILTER (
    WHERE e.status = 'active'
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  ) AS current_student_count,
  c.capacity - COUNT(e.id) FILTER (
    WHERE e.status = 'active'
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  ) AS remaining_seats
FROM classes c
LEFT JOIN enrollments e ON e.class_id = c.id
GROUP BY c.id, c.class_code, c.class_name, c.teacher_name, c.capacity;

CREATE VIEW v_monthly_revenue AS
SELECT
  DATE_TRUNC('month', payment_date)::date AS revenue_month,
  SUM(amount) FILTER (WHERE status = 'paid') AS paid_revenue,
  SUM(amount) FILTER (WHERE status = 'pending') AS pending_revenue,
  COUNT(*) AS payment_count
FROM payments
GROUP BY 1
ORDER BY 1 DESC;

CREATE VIEW v_lead_conversion AS
SELECT
  DATE_TRUNC('month', created_at)::date AS lead_month,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status = 'enroll') AS enrolled_leads,
  COUNT(*) FILTER (WHERE status = 'trial') AS trial_leads,
  COUNT(*) FILTER (WHERE status = 'lost') AS lost_leads,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'enroll') / NULLIF(COUNT(*), 0),
    2
  ) AS conversion_rate_pct
FROM leads
GROUP BY 1
ORDER BY 1 DESC;

CREATE VIEW v_dashboard_current AS
SELECT
  (SELECT COUNT(*) FROM students WHERE status = 'active') AS total_active_students,
  (SELECT COUNT(*) FROM classes WHERE status = 'open') AS total_open_classes,
  (
    SELECT COALESCE(ROUND(AVG(current_student_count)::numeric, 2), 0)
    FROM v_class_current_sizes
  ) AS avg_class_size,
  (
    SELECT COUNT(*)
    FROM students
    WHERE join_date >= DATE_TRUNC('month', CURRENT_DATE)::date
      AND join_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
  ) AS this_month_new_students,
  (
    SELECT COUNT(*)
    FROM enrollments
    WHERE status = 'dropped'
      AND end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
      AND end_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
  ) AS this_month_dropped_enrollments,
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM payments
    WHERE status = 'paid'
      AND payment_date >= DATE_TRUNC('month', CURRENT_DATE)::date
      AND payment_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
  ) AS this_month_revenue,
  (
    SELECT ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'enroll') / NULLIF(COUNT(*), 0),
      2
    )
    FROM leads
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  ) AS this_month_lead_conversion_pct;

-- migrate:down

DROP VIEW IF EXISTS mis.v_dashboard_current;
DROP VIEW IF EXISTS mis.v_lead_conversion;
DROP VIEW IF EXISTS mis.v_monthly_revenue;
DROP VIEW IF EXISTS mis.v_class_current_sizes;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON mis.leads;
DROP TRIGGER IF EXISTS trg_payments_updated_at ON mis.payments;
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON mis.attendance;
DROP TRIGGER IF EXISTS trg_attendance_sessions_updated_at ON mis.attendance_sessions;
DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON mis.enrollments;
DROP TRIGGER IF EXISTS trg_classes_updated_at ON mis.classes;
DROP TRIGGER IF EXISTS trg_students_updated_at ON mis.students;

DROP FUNCTION IF EXISTS mis.set_updated_at();

DROP TABLE IF EXISTS mis.leads;
DROP TABLE IF EXISTS mis.payments;
DROP TABLE IF EXISTS mis.attendance;
DROP TABLE IF EXISTS mis.attendance_sessions;
DROP TABLE IF EXISTS mis.enrollments;
DROP TABLE IF EXISTS mis.classes;
DROP TABLE IF EXISTS mis.students;

DROP SCHEMA IF EXISTS mis;
