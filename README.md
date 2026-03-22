# Classroom MIS with NocoDB

This repository is designed so that `docker compose up -d --build` brings up:

- PostgreSQL
- Redis
- dbmate migrations
- NocoDB
- the public/custom form web app
- an automatic bootstrap job that creates or reuses the NocoDB base, binds it to the business PostgreSQL database, and triggers metadata sync

The source of truth is still PostgreSQL. NocoDB is an interface on top of the SQL schema, but it now uses a separate internal metadata database so that base sync no longer imports `nc_*` tables.

NocoDB should be treated as the internal admin UI, not the long-term public intake layer. Public lead capture usually needs input trimming, sanitization, and file/image workflows that are better handled by your own app or API.

## What is automated

On a fresh startup, the stack automatically does all of the following:

1. initializes PostgreSQL with two databases:
   - `POSTGRES_DB` for NocoDB internal metadata
   - `APP_POSTGRES_DB` for business tables
2. applies SQL migrations to `APP_POSTGRES_DB`
3. creates business tables in `APP_SCHEMA` inside `APP_POSTGRES_DB`
4. starts NocoDB with the admin account from `.env`
5. signs in to NocoDB through the API
6. finds the default workspace
7. creates or reuses the base named by `NOCODB_BASE_TITLE`
8. creates or reuses the PostgreSQL integration named by `NOCODB_INTEGRATION_TITLE`
9. rebinds the base source to PostgreSQL database `APP_POSTGRES_DB` and schema `APP_SCHEMA`
10. sets the PostgreSQL role search path for `APP_POSTGRES_DB` to `APP_SCHEMA`
11. clears NocoDB metadata cache
12. runs metadata sync until business tables are visible
13. creates or reuses a curated `Lead Intake Form` view on the `Leads` table and applies a user-facing field layout

No manual NocoDB UI bootstrap is required for:

- base creation
- external PostgreSQL connection
- initial metadata sync
- initial lead intake form creation

## Current automation boundary

This repository now auto-creates one curated NocoDB form view:

- `Lead Intake Form` on `Leads`
- single-select dropdown metadata for enum-like fields such as `status`, `source`, `payment_type`, and `payment_method`

It does not yet auto-create other custom UI metadata such as:

- additional form layouts
- custom grid views
- Kanban views
- shared links

For lead intake specifically:

- PostgreSQL now normalizes lead inputs on write so inserts from NocoDB and future custom forms follow the same cleanup rules
- if you need image upload, image replacement, stricter sanitization, anti-spam, or custom validation, build a small custom form and keep NocoDB for staff operations

## Stack

- `PostgreSQL 16`
- `Redis 7`
- `NocoDB`
- `dbmate`
- custom `bootstrap` container for zero-manual NocoDB setup
- `web/` Next.js app scaffold for public forms and future internal form builder

## Files

- `docker-compose.yml`: containers and startup order
- `.env.example`: required environment variables
- `postgres/initdb`: first-start PostgreSQL database initialization scripts
- `bootstrap/Dockerfile`: image used by the bootstrap job
- `scripts/bootstrap_nocodb.sh`: automatic NocoDB base and source bootstrap
- `db/migrations`: SQL migrations
- `SCHEMA_GOVERNANCE.md`: schema ownership and recovery rules
- `OPERATIONS.md`: staging and production workflow
- `scripts/update_schema_snapshot.sh`: refresh tracked schema snapshot from live PostgreSQL
- `scripts/check_schema_drift.sh`: detect schema drift for the business schema
- `scripts/generate_migration_draft.sh`: generate a reviewed migration draft from live schema drift without touching `db/migrations`
- `scripts/test_nocodb_inserts.sh`: smoke test that creates and cleans up records through the NocoDB data API for every writable business table
- `web`: customer-facing form app scaffold and admin builder surface

## Form app scaffold

This repository now includes a `web/` scaffold for a dedicated public form app:

- public form route: `/forms/:slug`
- submission endpoint: `/forms/:slug/submit`
- form definition API: `/api/forms/:slug`
- upload intent endpoint: `/api/uploads/presign`
- internal builder routes under `/admin/forms`

The app is now included in Docker Compose and listens on port `3001` by default.
The database schema for dynamic forms is added through migrations and seeded with one published `lead-intake` form definition.

The app now also includes:

- a real PostgreSQL repository layer with mock fallback when the form tables are not available yet
- multipart public form submission into `form_submissions` and `leads`
- local file persistence under `data/form_uploads`
- uploaded file metadata stored in `submission_files`

Container/runtime notes:

- `nocodb` is exposed on `http://localhost:8080`
- `web` is exposed on `http://localhost:3001`
- uploaded public-form files are persisted under `./data/form_uploads`

Recommended app env for local development outside Docker:

```env
APP_DB_HOST=127.0.0.1
APP_DB_PORT=5432
APP_DATABASE_URL=
TURNSTILE_SECRET_KEY=
```

If you run the app outside Docker, point it at a reachable PostgreSQL host yourself. In Compose, the `web` service already uses the internal `postgres` hostname.

## Persistent data and paths

This project uses bind mounts under the project directory for runtime data:

- `./data/postgres`: PostgreSQL data files
- `./data/redis`: Redis persistence
- `./data/nocodb`: NocoDB app data stored on the host

Important:

- the business source of truth is PostgreSQL, so `./data/postgres` is the most important path
- the same PostgreSQL cluster contains two databases:
  - `POSTGRES_DB` for NocoDB internal metadata
  - `APP_POSTGRES_DB` for business tables scanned by NocoDB
- PostgreSQL is configured with `PGDATA=/var/lib/postgresql/data/pgdata`, so the bind-mounted `./data/postgres` directory can safely contain mount-point metadata or a tracked `.gitkeep`
- `docker compose down` stops containers but keeps these directories and their data
- `docker compose down -v` does not reset bind-mounted directories
- if you want a full local reset, you must stop the stack and delete `./data/postgres`, `./data/redis`, and `./data/nocodb`

The repository files are mounted or copied from these paths:

- [docker-compose.yml](/home/risc4/workspace/projects/classroom_mis/docker-compose.yml): service definitions
- [db](/home/risc4/workspace/projects/classroom_mis/db): SQL migrations and schema snapshot
- [scripts](/home/risc4/workspace/projects/classroom_mis/scripts): bootstrap and maintenance scripts
- [bootstrap](/home/risc4/workspace/projects/classroom_mis/bootstrap): bootstrap container build context
- [data](/home/risc4/workspace/projects/classroom_mis/data): local bind-mounted runtime data, created by Docker on first run

You can inspect these directories directly on the host after the first run, for example:

```bash
ls -la data
ls -la data/postgres
ls -la data/nocodb
```

If you need file-level backups, back up at least:

- the PostgreSQL database using `pg_dump`
- the `.env` file kept on that machine
- the git repository contents
- the `data/` directory if you want full local-state recovery

## Prerequisites

Before the first run, make sure the host has:

- Docker
- Docker Compose v2
- network access to pull images and build the bootstrap image

If testing locally, port `8080` must be free.

## Required env vars

Copy the sample env file first:

```bash
cp .env.example .env
```

At minimum, set strong values for:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `NC_AUTH_JWT_SECRET`
- `NC_ADMIN_EMAIL`
- `NC_ADMIN_PASSWORD`
- `NC_PUBLIC_URL`

If `.env` is missing, or any required variable is missing, `docker compose` now hard fails during configuration parsing with an explicit error message. It will not continue with blank values.

Default behavior:

- `POSTGRES_DB=nocodb`
- `APP_POSTGRES_DB=classroom_mis`
- `APP_SCHEMA=public`
- `POSTGRES_HOST=postgres`
- `POSTGRES_PORT=5432`
- `NOCODB_INTERNAL_URL=http://nocodb:8080`
- `NOCODB_BASE_TITLE=Classroom MIS`
- `NOCODB_INTEGRATION_TITLE=Classroom MIS PostgreSQL`
- `NOCODB_SOURCE_ALIAS=Primary`

Important:

- the migrations in this repository currently create business tables in `public`
- keep `APP_SCHEMA=public` unless you also update the SQL migrations to create tables in a different schema

For local testing, this is enough:

```env
NC_PUBLIC_URL=http://localhost:8080
```

## First run

Important upgrade warning:

- if you are upgrading from any earlier checkout that used a single PostgreSQL database for both NocoDB metadata and classroom tables, you must reset `./data/postgres` and `./data/nocodb`
- changing `.env` alone is not enough, because `POSTGRES_USER`, `POSTGRES_DB`, and the `postgres/initdb` scripts only apply when PostgreSQL initializes a brand new data directory
- if you reuse the old PostgreSQL data directory, services may hang or fail with errors such as:
  - `role "nocodb" does not exist`
  - only `nc_*` tables appear in the auto-created base

If you previously started an older version of this repository that used a single PostgreSQL database for both NocoDB metadata and classroom tables, first stop the old stack and remove the old state:

```bash
docker compose down
```

Then delete at least `./data/postgres` and `./data/nocodb` before starting again. The new dual-database layout is applied only during PostgreSQL cluster initialization.

Recommended reset sequence for that upgrade:

```bash
docker compose down
rm -rf data/postgres data/nocodb
mkdir -p data/postgres data/nocodb
docker compose up -d --build
```

Then start the current version:

```bash
docker compose up -d --build
```

For a fresh environment or any full reset, use only `docker compose up -d --build`.

Do not use `docker compose run --rm bootstrap` as a substitute for first startup validation. That command is for metadata rebinding or debugging on an already initialized environment, and it can pull `migrate` into the dependency chain again.

If you previously hit this PostgreSQL error:

```text
initdb: error: directory "/var/lib/postgresql/data" exists but is not empty
```

that was caused by trying to initialize PostgreSQL directly in the bind-mounted root. The current compose file avoids that by setting `PGDATA` to a child directory. If the old failed initialization left local files behind, stop the stack and clear `./data/postgres` before starting again.

If you hit migration replay or duplicate-table problems on an older checkout, the current stack avoids that by forcing `dbmate` to use `public.schema_migrations` regardless of `APP_SCHEMA`. If your local database is disposable, clear `./data/postgres` and restart the stack so migrations run cleanly from the beginning.

Check service state:

```bash
docker compose ps
```

Check migration logs:

```bash
docker compose logs migrate
```

Check bootstrap logs:

```bash
docker compose logs bootstrap
```

Check NocoDB logs:

```bash
docker compose logs nocodb
```

Open NocoDB:

- local: `http://localhost:8080`
- server: the URL in `NC_PUBLIC_URL`

Sign in with:

- email: `NC_ADMIN_EMAIL`
- password: `NC_ADMIN_PASSWORD`

You should already see the auto-created base. No manual base or datasource setup should be needed.

If `bootstrap` exits before creating the base, inspect its logs first. The most common early-start failure is that NocoDB was not yet ready to accept sign-in requests. The stack now waits for the NocoDB healthcheck before starting `bootstrap`, and the bootstrap script retries empty or invalid sign-in responses until the timeout is reached.

If you see a base but only `nc_*` tables, you are almost certainly still using an old single-database PostgreSQL data directory. Reset `./data/postgres` and `./data/nocodb` so PostgreSQL can recreate the separate internal and business databases from scratch.

If you see only `schema_migrations`, the integration is reaching the business database but NocoDB has not exposed the application tables yet. In the current layout, business tables live in `APP_SCHEMA` and `dbmate` still keeps its migration ledger in `public.schema_migrations`.

If NocoDB still shows only `schema_migrations`, do not try to salvage that base by hand from the UI. Recreate the environment with a clean bootstrap instead:

```bash
docker compose down
rm -rf data/postgres data/nocodb
mkdir -p data/postgres data/nocodb
docker compose up -d --build
```

Then verify:

```bash
docker compose ps
docker compose logs migrate
docker compose logs bootstrap
docker compose logs nocodb
```

And confirm the business database contains the expected tables:

```bash
docker exec classroom-mis-postgres \
  psql -U nocodb -d classroom_mis -Atqc \
  "select schemaname || '.' || tablename from pg_tables where schemaname in ('public') order by 1;"
```

Expected result includes:

- `public.students`
- `public.classes`
- `public.enrollments`
- `public.attendance_sessions`
- `public.attendance`
- `public.payments`
- `public.leads`
- `public.schema_migrations`

## Operation Matrix

| Scenario | Commands to run | Extra manual action | What to confirm |
| --- | --- | --- | --- |
| New environment, first deployment | `cp .env.example .env` then `docker compose up -d --build` | Update `.env` first | `migrate` and `bootstrap` both exit with code `0`, then NocoDB shows the auto-created base and business tables |
| Daily usage, no schema change | none | Staff just use NocoDB | Login works, normal create/edit/export flows work |
| Existing environment, app restart only | `docker compose up -d` | none | `postgres`, `redis`, and `nocodb` are `Up` |
| Existing environment, changed SQL migrations | `docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up` then `docker compose run --rm bootstrap` | none | New tables or columns appear in NocoDB after bootstrap completes |
| Existing environment, changed only NocoDB metadata binding needs refresh | `docker compose run --rm bootstrap` | none | Base still points to schema `APP_SCHEMA` and tables are visible |
| Existing environment, verify every writable table can create records through NocoDB | `bash scripts/test_nocodb_inserts.sh` | none | Script exits successfully after creating and cleaning up test records |
| Update tracked schema snapshot after validated schema change | `bash scripts/update_schema_snapshot.sh` | Commit the updated snapshot file if you use git | `db/schema.snapshot.sql` matches the current business schema |
| Check schema drift | `bash scripts/check_schema_drift.sh` | none | Command exits successfully with `No schema drift detected.` |
| Reset a disposable local test environment | `docker compose down` then delete `data/` and run `docker compose up -d --build` | Only do this if you are okay deleting local bind-mounted data | Fresh stack recreates the schema, base, and sync state automatically |

Important:

- do not use `docker compose run --rm bootstrap` for fresh-environment validation
- use `docker compose run --rm bootstrap` only after the environment is already initialized and you specifically need to rebind metadata or debug bootstrap behavior
- `migrate` is intentionally forced to use `public.schema_migrations`, even when `APP_SCHEMA` is not `public`

## What happens on startup

The startup order is:

1. `postgres` starts
2. `redis` starts
3. `migrate` waits for PostgreSQL and applies SQL files from `db/migrations`
4. `nocodb` starts after migrations succeed
5. `bootstrap` signs in to NocoDB, binds the base to PostgreSQL schema `APP_SCHEMA`, and waits for business tables to appear

## Expected service states

After a successful `docker compose up -d --build`, this is normal:

- `classroom-mis-postgres`: `Up`
- `classroom-mis-redis`: `Up`
- `classroom-mis-nocodb`: `Up`
- `classroom-mis-migrate`: `Exited (0)`
- `classroom-mis-bootstrap`: `Exited (0)`

The `migrate` and `bootstrap` containers are one-time jobs. `Exited (0)` is expected.

## What to confirm after startup

Confirm all of the following:

- `.env` uses non-default passwords and secrets
- `docker compose ps` shows `postgres`, `redis`, and `nocodb` as `Up`
- `migrate` exited with code `0`
- `bootstrap` exited with code `0`
- NocoDB admin login works
- the base named by `NOCODB_BASE_TITLE` exists automatically
- the imported tables are from `APP_SCHEMA` and not from NocoDB metadata tables
- these tables are visible:
  - `students`
  - `classes`
  - `enrollments`
  - `attendance_sessions`
  - `attendance`
  - `payments`
  - `leads`
- these SQL views are visible:
  - `v_class_current_sizes`
  - `v_monthly_revenue`
  - `v_lead_conversion`
  - `v_dashboard_current`
- the `Leads` table contains a curated `Lead Intake Form` view with only the intake fields shown
- you can create and edit records from NocoDB
- new or edited lead records are auto-trimmed by PostgreSQL and required lead fields cannot be blank after trimming
- CSV/XLSX export works
- normal users do not have schema-edit permissions

## Ongoing schema changes

Create a new migration:

```bash
docker compose run --rm migrate new add_something
```

Generate a review-only draft from live schema drift when someone changed schema directly in PostgreSQL or NocoDB:

```bash
bash scripts/generate_migration_draft.sh add_something
```

This writes review-only files into `db/migration_drafts/`. It does not create or apply a real migration automatically.

Apply migrations:

```bash
docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up
```

Re-run the automatic NocoDB metadata binding and sync:

```bash
docker compose run --rm bootstrap
```

There is no need to open NocoDB and click `Meta Sync` manually.

## Drift detection

After a migration is validated, update the tracked schema snapshot:

```bash
bash scripts/update_schema_snapshot.sh
```

Check whether live PostgreSQL has drifted from the tracked app schema:

```bash
bash scripts/check_schema_drift.sh
```

These scripts dump only the business schema in `APP_SCHEMA`, not NocoDB's own metadata tables.

## Common commands

Start:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

Stop the stack:

```bash
docker compose down
```

Restart NocoDB:

```bash
docker compose restart nocodb
```

Re-run automatic bootstrap:

```bash
docker compose run --rm bootstrap
```

View bootstrap logs:

```bash
docker compose logs -f bootstrap
```

View NocoDB logs:

```bash
docker compose logs -f nocodb
```

View PostgreSQL logs:

```bash
docker compose logs -f postgres
```

## Common failure points

If startup fails, check these first:

- `.env` exists
- all required values in `.env` are set
- port `8080` is not already in use
- Docker can pull required images
- the bootstrap image can be built
- `NC_ADMIN_EMAIL` and `NC_ADMIN_PASSWORD` are valid enough for NocoDB to create the admin user
- `bootstrap` can sign in to `NOCODB_INTERNAL_URL`
- `APP_SCHEMA` matches the schema created by migrations

In the current repository state, that means `APP_SCHEMA` should stay `public`.

If `bootstrap` fails, inspect:

```bash
docker compose logs bootstrap
```

If you changed old test data that lived in `public`, stop the stack, remove the local bind-mounted data, and start again:

```bash
docker compose down
rm -rf data/postgres data/nocodb
docker compose up -d --build
```
