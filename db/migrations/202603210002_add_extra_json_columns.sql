-- migrate:up

ALTER TABLE students
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE classes
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE enrollments
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE attendance_sessions
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE attendance
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payments
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads
ADD COLUMN extra_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down

ALTER TABLE leads
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE payments
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE attendance
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE attendance_sessions
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE enrollments
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE classes
DROP COLUMN IF EXISTS extra_json;

ALTER TABLE students
DROP COLUMN IF EXISTS extra_json;
