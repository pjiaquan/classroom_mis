-- migrate:up

CREATE OR REPLACE FUNCTION normalize_spaces(value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN regexp_replace(btrim(value), '\s+', ' ', 'g');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_optional_text(value TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := normalize_spaces(value);

  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  RETURN normalized;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_phone(value TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_leads_input()
RETURNS TRIGGER AS $$
BEGIN
  NEW.parent_name := normalize_spaces(NEW.parent_name);
  NEW.phone := normalize_phone(NEW.phone);
  NEW.child_name := normalize_optional_text(NEW.child_name);
  NEW.child_grade := normalize_spaces(NEW.child_grade);
  NEW.assigned_to := normalize_optional_text(NEW.assigned_to);
  NEW.notes := normalize_optional_text(NEW.notes);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE leads
SET parent_name = normalize_spaces(parent_name),
    phone = normalize_phone(phone),
    child_name = normalize_optional_text(child_name),
    child_grade = normalize_spaces(child_grade),
    assigned_to = normalize_optional_text(assigned_to),
    notes = normalize_optional_text(notes);

ALTER TABLE leads
ADD CONSTRAINT leads_parent_name_not_blank CHECK (parent_name <> ''),
ADD CONSTRAINT leads_phone_not_blank CHECK (phone <> ''),
ADD CONSTRAINT leads_child_grade_not_blank CHECK (child_grade <> '');

DROP TRIGGER IF EXISTS trg_leads_normalize_input ON leads;

CREATE TRIGGER trg_leads_normalize_input
BEFORE INSERT OR UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION normalize_leads_input();

-- migrate:down

DROP TRIGGER IF EXISTS trg_leads_normalize_input ON leads;

ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_parent_name_not_blank,
DROP CONSTRAINT IF EXISTS leads_phone_not_blank,
DROP CONSTRAINT IF EXISTS leads_child_grade_not_blank;

DROP FUNCTION IF EXISTS normalize_leads_input();
DROP FUNCTION IF EXISTS normalize_phone(TEXT);
DROP FUNCTION IF EXISTS normalize_optional_text(TEXT);
DROP FUNCTION IF EXISTS normalize_spaces(TEXT);
