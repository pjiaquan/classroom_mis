# Operations

This document defines the recommended deployment flow for staging and production.

## Environments

Maintain at least two environments:

- `staging`: used for testing new migrations, automatic NocoDB bootstrap, and workflow changes
- `production`: used by staff daily

Use the same repository structure in both environments.

## Deployment rules

- Apply all schema changes through SQL migrations only.
- Test every new migration in `staging` before `production`.
- Do not let normal users change tables or columns in production NocoDB.
- Run schema drift checks before and after production deployments.
- Backup PostgreSQL before destructive or high-risk migrations.

## Recommended release flow

1. Add or modify SQL migrations in git.
2. Deploy to `staging`.
3. Run migrations in `staging`.
4. Run `docker compose run --rm bootstrap` in `staging`.
5. Validate the affected tables, views, forms, and reports.
6. Update the schema snapshot file if the result is correct.
7. Commit the snapshot update to git.
8. Backup `production`.
9. Deploy to `production`.
10. Run migrations in `production`.
11. Run `docker compose run --rm bootstrap` in `production`.
12. Run schema drift check and smoke test the main workflows.

## Snapshot and drift commands

Update the tracked schema snapshot after a valid schema change:

```bash
bash scripts/update_schema_snapshot.sh
```

Check whether production schema has drifted from the tracked snapshot:

```bash
bash scripts/check_schema_drift.sh
```

## Backup recommendation

At minimum, backup PostgreSQL before production migrations:

```bash
docker compose exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > backup_$(date +%F_%H%M%S).sql
```

Also keep periodic backups of:

- PostgreSQL volume
- NocoDB data volume
- reverse proxy configuration if used

## After someone edits schema in NocoDB

If production schema was changed directly from NocoDB:

1. Stop and document the exact change.
2. Run `bash scripts/check_schema_drift.sh`.
3. Write a catch-up migration that formalizes the live schema.
4. Apply it in `staging`.
5. Validate behavior.
6. Apply it in `production` if still needed.
7. Run `docker compose run --rm bootstrap`.
8. Update the schema snapshot.
9. Review NocoDB permissions.

## Smoke test checklist

After production deployment, verify:

- admin can sign in to NocoDB
- external PostgreSQL data source is connected
- `students`, `classes`, `enrollments`, `payments`, and `leads` are visible
- new columns from the migration appear after `docker compose run --rm bootstrap`
- insert and edit flows still work
- dashboard SQL views still load
