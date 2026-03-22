# Classroom MIS with Mathesar

This repository is designed so that `docker compose up -d --build` brings up:

- PostgreSQL
- Redis
- dbmate migrations
- Mathesar
- the public/custom form web app
- a one-time Mathesar internal database setup job

The source of truth is still PostgreSQL. Mathesar is now the default internal spreadsheet-like admin UI on top of the SQL schema. The older NocoDB integration is still kept in this repository behind the optional `nocodb` profile, but it is no longer part of the default startup path.

Mathesar should be treated as the internal admin UI, not the long-term public intake layer. Public lead capture usually needs input trimming, sanitization, and file/image workflows that are better handled by your own app or API.

## What is automated

On a fresh startup, the stack automatically does all of the following:

1. initializes PostgreSQL with the business database `APP_POSTGRES_DB`
2. applies SQL migrations to `APP_POSTGRES_DB`
3. creates business tables in `APP_SCHEMA` inside `APP_POSTGRES_DB`
4. creates or reuses the Mathesar internal database `MATHESAR_POSTGRES_DB`
5. starts Mathesar on port `8080`
6. starts the public form app on port `3001`

## Current automation boundary

This repository now auto-starts Mathesar against the same PostgreSQL cluster as the business schema.

It does not yet auto-provision the business database connection inside Mathesar itself. After first login, add a database connection in the Mathesar UI pointing at:

- host: `postgres`
- port: `5432`
- database: `APP_POSTGRES_DB` such as `classroom_mis`
- user: `POSTGRES_USER`
- password: `POSTGRES_PASSWORD`

For lead intake specifically:

- PostgreSQL now normalizes lead inputs on write so inserts from Mathesar and future custom forms follow the same cleanup rules
- if you need image upload, image replacement, stricter sanitization, anti-spam, or custom validation, build a small custom form and keep Mathesar for staff operations
- legacy NocoDB notes later in this file apply only if you explicitly run `docker compose --profile nocodb up`

## Stack

- `PostgreSQL 16`
- `Redis 7`
- `Mathesar`
- `dbmate`
- one-time `mathesar-db-setup` job for zero-manual internal DB creation
- `web/` Next.js app scaffold for public forms and future internal form builder

## Files

- `docker-compose.yml`: containers and startup order
- `.env.example`: required environment variables
- `postgres/initdb`: first-start PostgreSQL database initialization scripts
- `db/migrations`: SQL migrations
- `SCHEMA_GOVERNANCE.md`: schema ownership and recovery rules
- `OPERATIONS.md`: staging and production workflow
- `scripts/update_schema_snapshot.sh`: refresh tracked schema snapshot from live PostgreSQL
- `scripts/check_schema_drift.sh`: detect schema drift for the business schema
- `scripts/generate_migration_draft.sh`: generate a reviewed migration draft from live schema drift without touching `db/migrations`
- `scripts/seed_demo_data.sh`: insert a minimal demo dataset only when every core business table is empty
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
- upload validation before disk write, plus signed/admin-guarded download URLs

Container/runtime notes:

- `mathesar` is exposed on `http://localhost:8080`
- `web` is exposed on `http://localhost:3001`
- uploaded public-form files are persisted under `./data/form_uploads`
- `nocodb` is not started by default; enable it with `docker compose --profile nocodb up`

Recommended app env for local development outside Docker:

```env
APP_DB_HOST=127.0.0.1
APP_DB_PORT=5432
APP_DATABASE_URL=
APP_REDIS_URL=redis://:your_redis_password@127.0.0.1:6379/0
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
WEB_UPLOAD_URL_SECRET=
```

If you run the app outside Docker, point it at a reachable PostgreSQL host yourself. In Compose, the `web` service already uses the internal `postgres` hostname.

## Persistent data and paths

This project uses bind mounts under the project directory for runtime data:

- `./data/postgres`: PostgreSQL data files
- `./data/redis`: Redis persistence
- `./data/mathesar`: Mathesar static, media, and secret data
- `./data/nocodb`: optional legacy NocoDB app data stored on the host

Important:

- the business source of truth is PostgreSQL, so `./data/postgres` is the most important path
- the same PostgreSQL cluster can contain:
  - `APP_POSTGRES_DB` for business tables
  - `MATHESAR_POSTGRES_DB` for Mathesar internal data
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
ls -la data/mathesar
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
- network access to pull images

If testing locally, port `8080` must be free.

## Required env vars

Copy the sample env file first:

```bash
cp .env.example .env
```

At minimum, set strong values for:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `MATHESAR_SECRET_KEY`

For Mathesar:

- `MATHESAR_POSTGRES_DB` defaults to `mathesar_django`
- `MATHESAR_ALLOWED_HOSTS` defaults to `*` for local/internal use
- `MATHESAR_WEB_CONCURRENCY` defaults to `3`

For the internal web builder under `/admin/*`:

- `WEB_ADMIN_USER` and `WEB_ADMIN_PASSWORD` are optional overrides for the web admin login
- `WEB_ADMIN_SESSION_SECRET` is an optional signing secret for admin sessions
- `WEB_UPLOAD_URL_SECRET` is an optional signing secret for upload download URLs
- if they are left blank, the web app falls back to `NC_ADMIN_EMAIL` and `NC_ADMIN_PASSWORD`

For the public form anti-spam flow:

- set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enable Cloudflare Turnstile verification
- the public form submission rate limit uses Redis; inside Docker Compose the `web` service is already wired to the bundled `redis` service

For the optional legacy NocoDB profile:

- set `NC_AUTH_JWT_SECRET`, `NC_ADMIN_EMAIL`, `NC_ADMIN_PASSWORD`, and `NC_PUBLIC_URL`
- then start it explicitly with `docker compose --profile nocodb up -d`

If `.env` is missing, or any required variable is missing, `docker compose` now hard fails during configuration parsing with an explicit error message. It will not continue with blank values.

Default behavior:

- `APP_POSTGRES_DB=classroom_mis`
- `MATHESAR_POSTGRES_DB=mathesar_django`
- `MATHESAR_ALLOWED_HOSTS=*`
- `APP_SCHEMA=public`
- `POSTGRES_HOST=postgres`
- `POSTGRES_PORT=5432`

Important:

- the migrations in this repository currently create business tables in `public`
- keep `APP_SCHEMA=public` unless you also update the SQL migrations to create tables in a different schema

For local testing, this is enough:

```env
MATHESAR_ALLOWED_HOSTS=*
```

## First run

Default startup now gives you:

- Mathesar on `http://localhost:8080`
- the public form app on `http://localhost:3001`

If you are upgrading from an older NocoDB-first checkout, read this first:

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

### Mathesar first login

Check service state:

```bash
docker compose ps
```

Open Mathesar:

- local: `http://localhost:8080`

Mathesar should redirect you to its login page. After signing in, add a PostgreSQL server connection pointing at:

- host: `postgres`
- port: `5432`
- database: `APP_POSTGRES_DB`
- user: `POSTGRES_USER`
- password: `POSTGRES_PASSWORD`

### Legacy NocoDB notes

The remaining notes in this section apply only if you intentionally run the old integration with:

```bash
docker compose --profile nocodb up -d
```

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
| Existing environment, insert demo data into an empty business database | `bash scripts/seed_demo_data.sh` | Run only on an intentionally empty environment | Script inserts a richer demo set of students, classes, enrollments, attendance, payments, and leads |
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

If someone already added or changed a field in NocoDB, do this next:

1. Generate a review draft from the live schema change:

```bash
bash scripts/generate_migration_draft.sh describe_the_change
```

2. Review the draft in `db/migration_drafts/` and copy the final SQL into a real migration under `db/migrations/`.
3. Apply the reviewed migration:

```bash
docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up
```

4. Refresh NocoDB metadata:

```bash
docker compose run --rm bootstrap
```

5. Confirm there is no remaining drift and then refresh the tracked snapshot:

```bash
bash scripts/check_schema_drift.sh
bash scripts/update_schema_snapshot.sh
```

Do not rely on NocoDB `Meta Sync` alone to formalize schema changes. `Meta Sync` refreshes metadata, but it does not create a git-managed SQL migration for the change.
Create or refresh `db/schema.snapshot.sql` only after a clean rebuild or a reviewed migration has been applied and validated. Do not overwrite the snapshot immediately after an unreviewed live schema change in NocoDB or PostgreSQL.

Seed a richer demo dataset only when every core business table is empty:

```bash
bash scripts/seed_demo_data.sh
```

The script exits without changing data if any of these tables already contain rows: `students`, `classes`, `enrollments`, `attendance_sessions`, `attendance`, `payments`, `leads`.

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
