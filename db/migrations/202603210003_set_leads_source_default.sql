-- migrate:up

ALTER TABLE leads
ALTER COLUMN source SET DEFAULT 'website';

-- migrate:down

ALTER TABLE leads
ALTER COLUMN source DROP DEFAULT;
