# Schema Governance

This document defines how schema changes are controlled in the Classroom MIS deployment.

## Principle

- PostgreSQL is the single source of truth for schema.
- SQL migrations are the only approved way to create, change, or remove tables and columns in production.
- NocoDB is used for data entry, search, filtering, and light UI configuration.
- NocoDB must not become the source of truth for schema design.

## Allowed and forbidden actions

Allowed for normal users:

- create and edit records
- search, filter, sort, and export data
- update attendance and payment records
- use existing forms and views

Forbidden for normal users:

- create tables
- rename tables
- add or remove columns
- change column types
- add relations directly in production

Only the system owner or technical maintainer may approve schema changes.

## Flexible fields policy

To avoid unnecessary schema churn, the main tables include:

- `notes`
- `extra_json`

Use `extra_json` for low-frequency or temporary attributes such as:

- parent preferences
- special handling notes
- internal tags
- one-off operational flags

Promote a value from `extra_json` into a real column only when at least one of these is true:

- it is used in filtering or reporting regularly
- it must be validated consistently
- it is required in imports or integrations
- staff must see it as a first-class field in daily workflows

## Standard schema change workflow

1. A user requests a field or structural change.
2. The owner decides whether it belongs in `notes`, `extra_json`, or as a real column.
3. If a real schema change is needed, create a new SQL migration.
4. Apply the migration in a non-production environment first.
5. Verify table structure and NocoDB behavior.
6. Deploy the migration to production.
7. Run `docker compose run --rm bootstrap` so NocoDB rebinds and refreshes metadata without UI work.
8. Document the reason for the change in git history or change log.

## Incident workflow when someone changes schema in NocoDB

If a user directly adds a field such as `備註` from the NocoDB UI:

1. Confirm whether the change reached PostgreSQL.
2. Record the exact table, column name, data type, nullability, and default.
3. Create a catch-up migration that formalizes the live database change.
4. Apply that migration to all lower environments.
5. Run `docker compose run --rm bootstrap` if NocoDB metadata needs to be refreshed.
6. Review permissions and remove schema edit access from users who should not have it.

Do not leave the production database ahead of git-managed migrations.

## Review checklist for new fields

Before adding a real column, check:

- Is the field actually needed beyond free-text notes?
- Does it need validation or a fixed value set?
- Will it be used in reports or dashboards?
- Does it belong in one table or imply a new related table?
- Does it affect imports, exports, or integrations?
- Does it need an index?

## Operational recommendations

- Restrict NocoDB workspace roles so very few users can edit structure.
- Review schema changes only through pull requests or tracked change requests.
- Keep a staging environment for migration testing.
- Backup PostgreSQL before any destructive schema migration.
- Periodically compare live schema against migration history.
