-- migrate:up

CREATE TABLE form_definitions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  target_table TEXT NOT NULL DEFAULT 'leads',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  theme_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE form_fields (
  id BIGSERIAL PRIMARY KEY,
  form_definition_id BIGINT NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (
    field_type IN ('text', 'textarea', 'phone', 'select', 'radio', 'checkbox', 'date', 'image', 'file')
  ),
  placeholder TEXT,
  help_text TEXT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL,
  width TEXT NOT NULL DEFAULT 'full' CHECK (width IN ('full', 'half')),
  default_value TEXT,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_fields_definition_field_key_unique UNIQUE (form_definition_id, field_key)
);

CREATE TABLE form_field_options (
  id BIGSERIAL PRIMARY KEY,
  form_field_id BIGINT NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_field_options_field_value_unique UNIQUE (form_field_id, value)
);

CREATE TABLE form_submissions (
  id BIGSERIAL PRIMARY KEY,
  form_definition_id BIGINT NOT NULL REFERENCES form_definitions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('received', 'accepted', 'rejected', 'spam')),
  payload_json JSONB NOT NULL,
  normalized_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  user_agent TEXT,
  referer TEXT,
  turnstile_success BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE submission_files (
  id BIGSERIAL PRIMARY KEY,
  form_submission_id BIGINT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_definitions_status ON form_definitions(status);
CREATE INDEX idx_form_fields_definition_sort_order ON form_fields(form_definition_id, sort_order);
CREATE INDEX idx_form_field_options_field_sort_order ON form_field_options(form_field_id, sort_order);
CREATE INDEX idx_form_submissions_definition_created_at ON form_submissions(form_definition_id, created_at DESC);
CREATE INDEX idx_form_submissions_lead_id ON form_submissions(lead_id);
CREATE INDEX idx_submission_files_submission_id ON submission_files(form_submission_id);

CREATE TRIGGER trg_form_definitions_updated_at
BEFORE UPDATE ON form_definitions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_form_fields_updated_at
BEFORE UPDATE ON form_fields
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_form_field_options_updated_at
BEFORE UPDATE ON form_field_options
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_form_submissions_updated_at
BEFORE UPDATE ON form_submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_submission_files_updated_at
BEFORE UPDATE ON submission_files
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

WITH inserted_form AS (
  INSERT INTO form_definitions (
    name,
    slug,
    target_table,
    status,
    theme_json,
    settings_json,
    success_message
  )
  VALUES (
    'Lead Intake',
    'lead-intake',
    'leads',
    'published',
    '{
      "brandName": "Classroom MIS",
      "logoUrl": "",
      "fontHeading": "Manrope",
      "fontBody": "Noto Sans TC",
      "colorPrimary": "#0f766e",
      "colorAccent": "#f59e0b",
      "colorSurface": "#f8fafc",
      "backgroundStyle": "gradient-soft",
      "buttonStyle": "rounded"
    }'::jsonb,
    '{
      "turnstileRequired": true,
      "allowMultipleFiles": false,
      "maxUploadsPerField": 1
    }'::jsonb,
    '送出成功，我們會盡快與您聯繫。'
  )
  ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      target_table = EXCLUDED.target_table,
      status = EXCLUDED.status,
      theme_json = EXCLUDED.theme_json,
      settings_json = EXCLUDED.settings_json,
      success_message = EXCLUDED.success_message,
      updated_at = NOW()
  RETURNING id
), target_form AS (
  SELECT id FROM inserted_form
  UNION ALL
  SELECT id FROM form_definitions WHERE slug = 'lead-intake'
  LIMIT 1
), upserted_fields AS (
  INSERT INTO form_fields (
    form_definition_id,
    field_key,
    label,
    field_type,
    placeholder,
    help_text,
    is_required,
    sort_order,
    width,
    default_value,
    validation_json,
    ui_json,
    mapping_json
  )
  SELECT
    tf.id,
    field_key,
    label,
    field_type,
    placeholder,
    help_text,
    is_required,
    sort_order,
    width,
    default_value,
    validation_json,
    ui_json,
    mapping_json
  FROM target_form tf
  CROSS JOIN (
    VALUES
      (
        'parent_name',
        '家長姓名',
        'text',
        '請輸入家長姓名',
        NULL,
        true,
        1,
        'full',
        NULL,
        '{"minLength": 2, "maxLength": 80}'::jsonb,
        '{}'::jsonb,
        '{"target": "leads.parent_name"}'::jsonb
      ),
      (
        'phone',
        '聯絡電話',
        'phone',
        '例如 0912345678',
        NULL,
        true,
        2,
        'full',
        NULL,
        '{"minLength": 8, "maxLength": 20}'::jsonb,
        '{}'::jsonb,
        '{"target": "leads.phone"}'::jsonb
      ),
      (
        'child_name',
        '學生姓名',
        'text',
        '請輸入學生姓名',
        NULL,
        false,
        3,
        'full',
        NULL,
        '{"maxLength": 80}'::jsonb,
        '{}'::jsonb,
        '{"target": "leads.child_name"}'::jsonb
      ),
      (
        'child_grade',
        '學生年級',
        'select',
        NULL,
        NULL,
        true,
        4,
        'full',
        NULL,
        '{"allowedValues": ["K1", "K2", "K3", "G1", "G2", "G3", "G4", "G5", "G6", "other"]}'::jsonb,
        '{}'::jsonb,
        '{"target": "leads.child_grade"}'::jsonb
      ),
      (
        'source',
        '如何得知我們',
        'radio',
        NULL,
        NULL,
        true,
        5,
        'full',
        'website',
        '{"allowedValues": ["walk_in", "referral", "facebook", "line", "website", "flyer", "other"]}'::jsonb,
        '{}'::jsonb,
        '{"target": "leads.source"}'::jsonb
      ),
      (
        'notes',
        '備註',
        'textarea',
        '可填寫學習需求或方便聯絡的時段',
        NULL,
        false,
        6,
        'full',
        NULL,
        '{"maxLength": 1000}'::jsonb,
        '{"rows": 5}'::jsonb,
        '{"target": "leads.notes"}'::jsonb
      ),
      (
        'child_photo',
        '學生照片',
        'image',
        NULL,
        '可選填，支援 JPG、PNG、WEBP',
        false,
        7,
        'full',
        NULL,
        '{"maxFileSizeMb": 8, "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"]}'::jsonb,
        '{"accept": "image/jpeg,image/png,image/webp"}'::jsonb,
        '{"target": "leads.extra_json.child_photo"}'::jsonb
      )
  ) AS seeded_fields (
    field_key,
    label,
    field_type,
    placeholder,
    help_text,
    is_required,
    sort_order,
    width,
    default_value,
    validation_json,
    ui_json,
    mapping_json
  )
  ON CONFLICT (form_definition_id, field_key) DO UPDATE
  SET label = EXCLUDED.label,
      field_type = EXCLUDED.field_type,
      placeholder = EXCLUDED.placeholder,
      help_text = EXCLUDED.help_text,
      is_required = EXCLUDED.is_required,
      sort_order = EXCLUDED.sort_order,
      width = EXCLUDED.width,
      default_value = EXCLUDED.default_value,
      validation_json = EXCLUDED.validation_json,
      ui_json = EXCLUDED.ui_json,
      mapping_json = EXCLUDED.mapping_json,
      updated_at = NOW()
  RETURNING id, field_key
)
DELETE FROM form_field_options
WHERE form_field_id IN (
  SELECT id
  FROM upserted_fields
  WHERE field_key IN ('child_grade', 'source')
);

WITH target_form AS (
  SELECT id
  FROM form_definitions
  WHERE slug = 'lead-intake'
), target_fields AS (
  SELECT ff.id, ff.field_key
  FROM form_fields ff
  JOIN target_form tf
    ON tf.id = ff.form_definition_id
  WHERE ff.field_key IN ('child_grade', 'source')
)
INSERT INTO form_field_options (
  form_field_id,
  value,
  label,
  sort_order
)
SELECT
  tf.id,
  seeded.value,
  seeded.label,
  seeded.sort_order
FROM target_fields tf
JOIN (
  VALUES
    ('child_grade', 'K1', '幼兒園小班', 1),
    ('child_grade', 'K2', '幼兒園中班', 2),
    ('child_grade', 'K3', '幼兒園大班', 3),
    ('child_grade', 'G1', '國小一年級', 4),
    ('child_grade', 'G2', '國小二年級', 5),
    ('child_grade', 'G3', '國小三年級', 6),
    ('child_grade', 'G4', '國小四年級', 7),
    ('child_grade', 'G5', '國小五年級', 8),
    ('child_grade', 'G6', '國小六年級', 9),
    ('child_grade', 'other', '其他', 10),
    ('source', 'walk_in', '路過/現場詢問', 1),
    ('source', 'referral', '親友介紹', 2),
    ('source', 'facebook', 'Facebook', 3),
    ('source', 'line', 'LINE', 4),
    ('source', 'website', '官方網站', 5),
    ('source', 'flyer', '傳單', 6),
    ('source', 'other', '其他', 7)
) AS seeded(field_key, value, label, sort_order)
  ON seeded.field_key = tf.field_key
ORDER BY tf.field_key, seeded.sort_order;

-- migrate:down

DROP TRIGGER IF EXISTS trg_submission_files_updated_at ON submission_files;
DROP TRIGGER IF EXISTS trg_form_submissions_updated_at ON form_submissions;
DROP TRIGGER IF EXISTS trg_form_field_options_updated_at ON form_field_options;
DROP TRIGGER IF EXISTS trg_form_fields_updated_at ON form_fields;
DROP TRIGGER IF EXISTS trg_form_definitions_updated_at ON form_definitions;

DROP TABLE IF EXISTS submission_files;
DROP TABLE IF EXISTS form_submissions;
DROP TABLE IF EXISTS form_field_options;
DROP TABLE IF EXISTS form_fields;
DROP TABLE IF EXISTS form_definitions;
