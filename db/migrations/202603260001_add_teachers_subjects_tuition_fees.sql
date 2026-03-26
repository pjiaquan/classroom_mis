-- migrate:up

-- Migration: Add teachers, subjects, structured scheduling, and tuition fees
-- This enables proper teacher management, standardized subjects, and fee configuration

-- 1. Create teachers table
CREATE TABLE public.teachers (
    id bigserial PRIMARY KEY,
    teacher_code text NOT NULL UNIQUE,
    full_name text NOT NULL,
    phone text,
    email text,
    status text DEFAULT 'active' NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teachers_status_check CHECK (status = ANY (ARRAY['active', 'inactive', 'archived']))
);

CREATE TRIGGER trg_teachers_updated_at
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_teachers_status ON public.teachers USING btree (status);

-- 2. Create subjects table
CREATE TABLE public.subjects (
    id bigserial PRIMARY KEY,
    subject_code text NOT NULL UNIQUE,
    subject_name text NOT NULL,
    description text,
    status text DEFAULT 'active' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subjects_status_check CHECK (status = ANY (ARRAY['active', 'inactive']))
);

CREATE TRIGGER trg_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add structured scheduling columns to classes
ALTER TABLE public.classes
    ADD COLUMN teacher_id bigint REFERENCES public.teachers(id) ON DELETE SET NULL,
    ADD COLUMN subject_id bigint REFERENCES public.subjects(id) ON DELETE SET NULL,
    ADD COLUMN day_of_week smallint CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday, 1=Monday, etc.
    ADD COLUMN start_time time,
    ADD COLUMN end_time time,
    ADD COLUMN room text,
    ADD COLUMN max_capacity integer;  -- separate from current capacity for class type vs actual

-- Set max_capacity = capacity initially
UPDATE public.classes SET max_capacity = capacity WHERE max_capacity IS NULL;

-- Create index for common queries
CREATE INDEX idx_classes_teacher_id ON public.classes USING btree (teacher_id);
CREATE INDEX idx_classes_subject_id ON public.classes USING btree (subject_id);
CREATE INDEX idx_classes_day_of_week ON public.classes USING btree (day_of_week);

-- 4. Create tuition_fees table
CREATE TABLE public.tuition_fees (
    id bigserial PRIMARY KEY,
    class_id bigint REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id bigint REFERENCES public.subjects(id) ON DELETE SET NULL,
    fee_amount numeric(10,2) NOT NULL,
    fee_type text DEFAULT 'monthly' NOT NULL,  -- monthly, per_session, per_year
    billing_cycle text DEFAULT 'monthly' NOT NULL,  -- monthly, quarterly, yearly
    effective_from date NOT NULL,
    effective_to date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tuition_fees_amount_check CHECK (fee_amount >= 0),
    CONSTRAINT tuition_fees_fee_type_check CHECK (fee_type = ANY (ARRAY['monthly', 'per_session', 'per_year'])),
    CONSTRAINT tuition_fees_billing_cycle_check CHECK (billing_cycle = ANY (ARRAY['monthly', 'quarterly', 'yearly']))
);

CREATE TRIGGER trg_tuition_fees_updated_at
    BEFORE UPDATE ON public.tuition_fees
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tuition_fees_class_id ON public.tuition_fees USING btree (class_id);
CREATE INDEX idx_tuition_fees_subject_id ON public.tuition_fees USING btree (subject_id);
CREATE INDEX idx_tuition_fees_effective ON public.tuition_fees USING btree (effective_from, effective_to);

COMMENT ON TABLE public.teachers IS 'Teacher profiles for tuition center';
COMMENT ON TABLE public.subjects IS 'Standardized subject catalog (Math, English, Science, etc.)';
COMMENT ON TABLE public.tuition_fees IS 'Tuition fee configuration per class or subject';

-- migrate:down

DROP TABLE IF EXISTS public.tuition_fees;
DROP TABLE IF EXISTS public.subjects;
DROP TABLE IF EXISTS public.teachers;

ALTER TABLE public.classes
    DROP COLUMN IF EXISTS teacher_id,
    DROP COLUMN IF EXISTS subject_id,
    DROP COLUMN IF EXISTS day_of_week,
    DROP COLUMN IF EXISTS start_time,
    DROP COLUMN IF EXISTS end_time,
    DROP COLUMN IF EXISTS room,
    DROP COLUMN IF EXISTS max_capacity;
