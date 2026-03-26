# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Classroom Management Information System (MIS) using PostgreSQL as source of truth, with Mathesar and Directus as admin UIs and a Next.js public-facing web app.

**Key URLs when running:**
- Mathesar admin: http://localhost:8080
- Directus admin: http://localhost:8081
- Web app: http://localhost:3001

## Common Commands

### First-time Setup
```bash
cp .env.example .env
# Edit .env - set strong passwords for POSTGRES_PASSWORD, REDIS_PASSWORD, MATHESAR_SECRET_KEY
docker compose up -d --build
```

### Startup (subsequent)
```bash
docker compose up -d --build
```

### Run Migrations
```bash
docker compose run --rm migrate --wait --wait-timeout 120s --migrations-dir /db/migrations --no-dump-schema up
```

### Seed Demo Data (only when tables are empty)
```bash
bash scripts/seed_demo_data.sh
```

### Check Schema Drift
```bash
bash scripts/check_schema_drift.sh
```

## Architecture

### Services
- **PostgreSQL 16**: Primary database (port 5432)
- **Redis 7**: Caching and rate limiting (port 6379)
- **Mathesar**: Admin UI on port 8080
- **Directus**: Admin UI on port 8081 (shares PostgreSQL, uses separate `directus` database)
- **Next.js (web/)**: Public form web app on port 3001

### Key Directories
- `db/migrations/`: SQL migrations via dbmate
- `db/schema.snapshot.sql`: Tracked schema baseline for drift detection
- `scripts/`: Operational scripts (seed, drift check, migration draft generation)
- `postgres/initdb/`: PostgreSQL initialization scripts
- `web/`: Next.js 15 app with App Router

### Database Patterns
- Primary keys use `BIGSERIAL`
- `notes` and `extra_json` columns provide flexibility to avoid schema churn
- SQL views for reporting: `v_class_current_sizes`, `v_monthly_revenue`, `v_lead_conversion`, `v_dashboard_current`
- Input normalization via PostgreSQL triggers on `leads` table

### Web App Structure (`web/`)
- `web/lib/db/`: PostgreSQL repository layer
- `web/lib/forms/`: Form definitions and types
- `web/lib/anti-spam/`: Cloudflare Turnstile integration
- `web/lib/uploads/`: File upload handling with presigned URLs
- `web/lib/security/`: Rate limiting with Redis
- `web/app/forms/[slug]/`: Public form routes
- `web/app/admin/forms/`: Admin form builder

### Form System
Dynamic form builder supporting field types: text, textarea, phone, select, radio, checkbox, date, image, file. Form submissions stored in `form_submissions` with files in `submission_files`.

## Schema Governance

See `SCHEMA_GOVERNANCE.md` for schema change policies. Migrations should be placed in `db/migrations/` using dbmate. Use `scripts/generate_migration_draft.sh` to create reviewed drift drafts.
