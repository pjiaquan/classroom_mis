onnect /d
CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'standard public schema';
CREATE FUNCTION public.normalize_leads_input() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.parent_name := normalize_spaces(NEW.parent_name);
  NEW.phone := normalize_phone(NEW.phone);
  NEW.child_name := normalize_optional_text(NEW.child_name);
  NEW.child_grade := normalize_spaces(NEW.child_grade);
  NEW.assigned_to := normalize_optional_text(NEW.assigned_to);
  NEW.notes := normalize_optional_text(NEW.notes);
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.normalize_optional_text(value text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := normalize_spaces(value);
  IF normalized = '' THEN
    RETURN NULL;
  END IF;
  RETURN normalized;
END;
$$;
CREATE FUNCTION public.normalize_phone(value text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  trimmed TEXT;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  trimmed := btrim(value);
  IF trimmed = '' THEN
    RETURN '';
  END IF;
  RETURN regexp_replace(trimmed, '[[:space:]\-()]+', '', 'g');
END;
$$;
CREATE FUNCTION public.normalize_spaces(value text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(btrim(value), '\s+', ' ', 'g');
END;
$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TABLE public.attendance (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_id bigint NOT NULL,
    status text NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'leave'::text, 'absent'::text])))
);
CREATE SEQUENCE public.attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;
CREATE TABLE public.attendance_sessions (
    id bigint NOT NULL,
    class_id bigint NOT NULL,
    session_date date NOT NULL,
    teacher_name text NOT NULL,
    topic text,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT attendance_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);
CREATE SEQUENCE public.attendance_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_sessions_id_seq OWNED BY public.attendance_sessions.id;
CREATE TABLE public.classes (
    id bigint NOT NULL,
    class_code text NOT NULL,
    class_name text NOT NULL,
    teacher_name text NOT NULL,
    schedule_text text NOT NULL,
    capacity integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT classes_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT classes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'full'::text, 'closed'::text])))
);
CREATE SEQUENCE public.classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;
CREATE TABLE public.enrollments (
    id bigint NOT NULL,
    student_id bigint NOT NULL,
    class_id bigint NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    tuition_plan text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'dropped'::text])))
);
CREATE SEQUENCE public.enrollments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.enrollments_id_seq OWNED BY public.enrollments.id;
CREATE TABLE public.form_definitions (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    target_table text DEFAULT 'leads'::text NOT NULL,
    status text NOT NULL,
    theme_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    success_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_definitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);
CREATE SEQUENCE public.form_definitions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.form_definitions_id_seq OWNED BY public.form_definitions.id;
CREATE TABLE public.form_field_options (
    id bigint NOT NULL,
    form_field_id bigint NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.form_field_options_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.form_field_options_id_seq OWNED BY public.form_field_options.id;
CREATE TABLE public.form_fields (
    id bigint NOT NULL,
    form_definition_id bigint NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    placeholder text,
    help_text text,
    is_required boolean DEFAULT false NOT NULL,
    sort_order integer NOT NULL,
    width text DEFAULT 'full'::text NOT NULL,
    default_value text,
    validation_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    ui_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    mapping_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'phone'::text, 'select'::text, 'radio'::text, 'checkbox'::text, 'date'::text, 'image'::text, 'file'::text]))),
    CONSTRAINT form_fields_width_check CHECK ((width = ANY (ARRAY['full'::text, 'half'::text])))
);
CREATE SEQUENCE public.form_fields_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.form_fields_id_seq OWNED BY public.form_fields.id;
CREATE TABLE public.form_submissions (
    id bigint NOT NULL,
    form_definition_id bigint NOT NULL,
    status text NOT NULL,
    payload_json jsonb NOT NULL,
    normalized_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip inet,
    user_agent text,
    referer text,
    turnstile_success boolean DEFAULT false NOT NULL,
    source text,
    lead_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_submissions_status_check CHECK ((status = ANY (ARRAY['received'::text, 'accepted'::text, 'rejected'::text, 'spam'::text])))
);
CREATE SEQUENCE public.form_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.form_submissions_id_seq OWNED BY public.form_submissions.id;
CREATE TABLE public.leads (
    id bigint NOT NULL,
    parent_name text NOT NULL,
    phone text NOT NULL,
    child_name text,
    child_grade text NOT NULL,
    source text DEFAULT 'website'::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    follow_up_date date,
    trial_date date,
    converted_student_id bigint,
    assigned_to text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    "Email" character varying,
    CONSTRAINT leads_child_grade_not_blank CHECK ((child_grade <> ''::text)),
    CONSTRAINT leads_parent_name_not_blank CHECK ((parent_name <> ''::text)),
    CONSTRAINT leads_phone_not_blank CHECK ((phone <> ''::text)),
    CONSTRAINT leads_source_check CHECK ((source = ANY (ARRAY['walk_in'::text, 'referral'::text, 'facebook'::text, 'line'::text, 'website'::text, 'flyer'::text, 'other'::text]))),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'trial'::text, 'enroll'::text, 'lost'::text])))
);
CREATE SEQUENCE public.leads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;
CREATE TABLE public.payments (
    id bigint NOT NULL,
    student_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date NOT NULL,
    billing_month date NOT NULL,
    payment_type text NOT NULL,
    status text DEFAULT 'paid'::text NOT NULL,
    payment_method text DEFAULT 'cash'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'card'::text, 'other'::text]))),
    CONSTRAINT payments_payment_type_check CHECK ((payment_type = ANY (ARRAY['tuition'::text, 'material'::text, 'registration'::text, 'other'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['paid'::text, 'pending'::text, 'refunded'::text])))
);
CREATE SEQUENCE public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;
CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);
CREATE TABLE public.students (
    id bigint NOT NULL,
    student_code text NOT NULL,
    full_name text NOT NULL,
    grade text NOT NULL,
    school_name text,
    parent_name text NOT NULL,
    phone text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    join_date date,
    leave_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    "Avatar" text,
    CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'left'::text])))
);
CREATE SEQUENCE public.students_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;
CREATE TABLE public.submission_files (
    id bigint NOT NULL,
    form_submission_id bigint NOT NULL,
    field_key text NOT NULL,
    storage_key text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    public_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_files_file_size_bytes_check CHECK ((file_size_bytes >= 0))
);
CREATE SEQUENCE public.submission_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.submission_files_id_seq OWNED BY public.submission_files.id;
CREATE VIEW public.v_class_current_sizes AS
 SELECT c.id AS class_id,
    c.class_code,
    c.class_name,
    c.teacher_name,
    c.capacity,
    count(e.id) FILTER (WHERE ((e.status = 'active'::text) AND ((e.end_date IS NULL) OR (e.end_date >= CURRENT_DATE)))) AS current_student_count,
    (c.capacity - count(e.id) FILTER (WHERE ((e.status = 'active'::text) AND ((e.end_date IS NULL) OR (e.end_date >= CURRENT_DATE))))) AS remaining_seats
   FROM (public.classes c
     LEFT JOIN public.enrollments e ON ((e.class_id = c.id)))
  GROUP BY c.id, c.class_code, c.class_name, c.teacher_name, c.capacity;
CREATE VIEW public.v_dashboard_current AS
 SELECT ( SELECT count(*) AS count
           FROM public.students
          WHERE (students.status = 'active'::text)) AS total_active_students,
    ( SELECT count(*) AS count
           FROM public.classes
          WHERE (classes.status = 'open'::text)) AS total_open_classes,
    ( SELECT COALESCE(round(avg(v_class_current_sizes.current_student_count), 2), (0)::numeric) AS "coalesce"
           FROM public.v_class_current_sizes) AS avg_class_size,
    ( SELECT count(*) AS count
           FROM public.students
          WHERE ((students.join_date >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date) AND (students.join_date < ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval))::date))) AS this_month_new_students,
    ( SELECT count(*) AS count
           FROM public.enrollments
          WHERE ((enrollments.status = 'dropped'::text) AND (enrollments.end_date >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date) AND (enrollments.end_date < ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval))::date))) AS this_month_dropped_enrollments,
    ( SELECT COALESCE(sum(payments.amount), (0)::numeric) AS "coalesce"
           FROM public.payments
          WHERE ((payments.status = 'paid'::text) AND (payments.payment_date >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date) AND (payments.payment_date < ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval))::date))) AS this_month_revenue,
    ( SELECT round(((100.0 * (count(*) FILTER (WHERE (leads.status = 'enroll'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS round
           FROM public.leads
          WHERE ((leads.created_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)) AND (leads.created_at < (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval)))) AS this_month_lead_conversion_pct;
CREATE VIEW public.v_lead_conversion AS
 SELECT (date_trunc('month'::text, created_at))::date AS lead_month,
    count(*) AS total_leads,
    count(*) FILTER (WHERE (status = 'enroll'::text)) AS enrolled_leads,
    count(*) FILTER (WHERE (status = 'trial'::text)) AS trial_leads,
    count(*) FILTER (WHERE (status = 'lost'::text)) AS lost_leads,
    round(((100.0 * (count(*) FILTER (WHERE (status = 'enroll'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS conversion_rate_pct
   FROM public.leads
  GROUP BY ((date_trunc('month'::text, created_at))::date)
  ORDER BY ((date_trunc('month'::text, created_at))::date) DESC;
CREATE VIEW public.v_monthly_revenue AS
 SELECT (date_trunc('month'::text, (payment_date)::timestamp with time zone))::date AS revenue_month,
    sum(amount) FILTER (WHERE (status = 'paid'::text)) AS paid_revenue,
    sum(amount) FILTER (WHERE (status = 'pending'::text)) AS pending_revenue,
    count(*) AS payment_count
   FROM public.payments
  GROUP BY ((date_trunc('month'::text, (payment_date)::timestamp with time zone))::date)
  ORDER BY ((date_trunc('month'::text, (payment_date)::timestamp with time zone))::date) DESC;
ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);
ALTER TABLE ONLY public.attendance_sessions ALTER COLUMN id SET DEFAULT nextval('public.attendance_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);
ALTER TABLE ONLY public.enrollments ALTER COLUMN id SET DEFAULT nextval('public.enrollments_id_seq'::regclass);
ALTER TABLE ONLY public.form_definitions ALTER COLUMN id SET DEFAULT nextval('public.form_definitions_id_seq'::regclass);
ALTER TABLE ONLY public.form_field_options ALTER COLUMN id SET DEFAULT nextval('public.form_field_options_id_seq'::regclass);
ALTER TABLE ONLY public.form_fields ALTER COLUMN id SET DEFAULT nextval('public.form_fields_id_seq'::regclass);
ALTER TABLE ONLY public.form_submissions ALTER COLUMN id SET DEFAULT nextval('public.form_submissions_id_seq'::regclass);
ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);
ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);
ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);
ALTER TABLE ONLY public.submission_files ALTER COLUMN id SET DEFAULT nextval('public.submission_files_id_seq'::regclass);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_session_student_unique UNIQUE (session_id, student_id);
ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_class_date_unique UNIQUE (class_id, session_date);
ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);
ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_class_start_unique UNIQUE (student_id, class_id, start_date);
ALTER TABLE ONLY public.form_definitions
    ADD CONSTRAINT form_definitions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.form_definitions
    ADD CONSTRAINT form_definitions_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.form_field_options
    ADD CONSTRAINT form_field_options_field_value_unique UNIQUE (form_field_id, value);
ALTER TABLE ONLY public.form_field_options
    ADD CONSTRAINT form_field_options_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_definition_field_key_unique UNIQUE (form_definition_id, field_key);
ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);
ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_code_key UNIQUE (student_code);
ALTER TABLE ONLY public.submission_files
    ADD CONSTRAINT submission_files_pkey PRIMARY KEY (id);
CREATE INDEX idx_attendance_session_id ON public.attendance USING btree (session_id);
CREATE INDEX idx_attendance_sessions_class_id ON public.attendance_sessions USING btree (class_id);
CREATE INDEX idx_attendance_sessions_session_date ON public.attendance_sessions USING btree (session_date);
CREATE INDEX idx_attendance_student_id ON public.attendance USING btree (student_id);
CREATE INDEX idx_classes_status ON public.classes USING btree (status);
CREATE INDEX idx_enrollments_class_id ON public.enrollments USING btree (class_id);
CREATE INDEX idx_enrollments_status ON public.enrollments USING btree (status);
CREATE INDEX idx_enrollments_student_id ON public.enrollments USING btree (student_id);
CREATE INDEX idx_form_definitions_status ON public.form_definitions USING btree (status);
CREATE INDEX idx_form_field_options_field_sort_order ON public.form_field_options USING btree (form_field_id, sort_order);
CREATE INDEX idx_form_fields_definition_sort_order ON public.form_fields USING btree (form_definition_id, sort_order);
CREATE INDEX idx_form_submissions_definition_created_at ON public.form_submissions USING btree (form_definition_id, created_at DESC);
CREATE INDEX idx_form_submissions_lead_id ON public.form_submissions USING btree (lead_id);
CREATE INDEX idx_leads_follow_up_date ON public.leads USING btree (follow_up_date);
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_payments_billing_month ON public.payments USING btree (billing_month);
CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date);
CREATE INDEX idx_payments_status ON public.payments USING btree (status);
CREATE INDEX idx_payments_student_id ON public.payments USING btree (student_id);
CREATE INDEX idx_students_status ON public.students USING btree (status);
CREATE INDEX idx_submission_files_submission_id ON public.submission_files USING btree (form_submission_id);
CREATE TRIGGER trg_attendance_sessions_updated_at BEFORE UPDATE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_form_definitions_updated_at BEFORE UPDATE ON public.form_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_form_field_options_updated_at BEFORE UPDATE ON public.form_field_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_form_fields_updated_at BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_normalize_input BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.normalize_leads_input();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_submission_files_updated_at BEFORE UPDATE ON public.submission_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.attendance_sessions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.form_field_options
    ADD CONSTRAINT form_field_options_form_field_id_fkey FOREIGN KEY (form_field_id) REFERENCES public.form_fields(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_form_definition_id_fkey FOREIGN KEY (form_definition_id) REFERENCES public.form_definitions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_form_definition_id_fkey FOREIGN KEY (form_definition_id) REFERENCES public.form_definitions(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_student_id_fkey FOREIGN KEY (converted_student_id) REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.submission_files
    ADD CONSTRAINT submission_files_form_submission_id_fkey FOREIGN KEY (form_submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;
onnect /d
