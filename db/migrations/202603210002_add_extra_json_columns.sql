-- migrate:up

ALTER TABLE mis.students
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.classes
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.enrollments
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.attendance_sessions
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.attendance
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.payments
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mis.leads
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down

ALTER TABLE mis.leads
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.payments
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.attendance
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.attendance_sessions
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.enrollments
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.classes
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE mis.students
DROP COLUMN IF EXISTS extra_json;
