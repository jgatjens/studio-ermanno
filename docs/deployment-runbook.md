# MVP deployment runbook

Status: local release preparation; no Cloudflare Pages or Render deployment has been created by this task. Repository is now `https://github.com/jgatjens/studio-ermanno`; the user chose free hosting and a separate production Supabase project. Follow the [Phase 12 plan](plans/phase-12-implementation.md). Stop before Phase 13.

## What the business owner supplies

1. Intended Git repository URL and account access. Sign in to GitHub locally (`gh auth login`) or use the browser; never paste login credentials into chat. The local workspace is not yet a Git repository. Confirm the target remote before initialization/push.
2. Cloudflare and Render account access, project names and hosting budget. Sign in locally. Account creation agreements, billing and permission grants may require your own action.
3. Production Supabase decision. A separate project keeps development fixtures away from real records. If reusing the current project, review its contents first and explicitly decide what belongs to the live business.
4. Confirmed identity: Minati Parrucchieri, phone 0461 765351, Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia; public email remains blank. User-approved hours are Tuesday–Saturday 08:00–12:00 and 14:00–19:00, Europe/Rome; supplied photos are approved for use. Resolve split-period model support before launch. Confirm real catalog/prices, active hairdressers and opening stock through normal Owner setup. Sample data must not become public accidentally.
5. Owner and Staff identities for the production project. Supabase Auth users need database memberships for the production Business; passwords stay with you.
6. Rotate the database password and privileged Supabase key previously shared in chat. Enter new secrets directly into local/provider secret settings. Do not send them in chat. The application does not require a privileged Supabase API key.

The coding agent can handle configuration, tests, migration commands, builds and deployment steps once access and the above decisions are available. Creating paid resources, accepting agreements, granting hosting integrations repository access, and entering/changing credentials may need a user handoff or confirmation at the actual action.

## Local release checks

Production runtime baseline: Node `22.23.2` in `web/.node-version`; Python `3.12.14` in root `.python-version`. Set these versions explicitly in the provider dashboards, rather than assuming a monorepo version file is discovered. Backend dependency constraints preserve the previously installed baseline across builds.

From `web/`:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

From `api/`, with a Python 3.12 virtual environment and development/staging configuration:

```sh
python -m pip install -r requirements.txt
python -m pytest
env RUN_DATABASE_TESTS=1 python -m pytest
python -m app.db.check
python -m alembic current
```

Use the environment's Python executable, for example `.venv-production/bin/python` in the local verification environment. Do not run the database test suite on production, or overlap it with live browser tests against the constrained session pool. Database tests use disposable schemas but still consume connections and require DDL access.

## Repository release

Review files before staging. `.env`, `.env.local`, `.venv`, `.venv-production`, build output and node_modules are ignored. Keep `.env.example` files with placeholders. Review staged changes and secret exposure before creating the release commit and pushing to the confirmed remote. Record the release revision; use that revision for both hosts. No GitHub Actions or other CI/CD pipeline is required.

## Supabase production setup

Create or select the approved project, then securely provide its PostgreSQL connection URL with encoded credentials and TLS (`sslmode=require` minimum; certificate verification where configured). The verified connection type is the session pooler on port 5432. Do not substitute transaction pooling without testing driver behavior.

Keep development configuration in `api/.env`. Store local production configuration separately in ignored `api/.env.production`, with `APP_ENV=production` and all required production settings from the matrix below. `APP_ENV_FILE` selects this file for operator commands, preserving the development file. An explicitly selected missing file is rejected. Provider deployments use their environment variables directly and do not need this local file selector.

Back up an existing database before migration. Inspect its current schema/revision and run from the intended release's `api/` directory, with target configuration loaded securely:

```sh
APP_ENV_FILE=.env.production python -m app.db.check
APP_ENV_FILE=.env.production python -m alembic current
APP_ENV_FILE=.env.production python -m alembic upgrade head
APP_ENV_FILE=.env.production python -m alembic current
```

Expected release head is `0003_split_hours`. Run this once serially, never per worker startup. If a paid Render service provides a pre-deploy command, use `python -m alembic upgrade head` there for future releases; otherwise use the explicit operator procedure. Never use `stamp` to hide a mismatch. The split-hours migration preserves existing schedules. Its downgrade refuses to remove configured breaks; resolve those schedules explicitly before rollback.

Do not run development seed in production. Provision/review the real Business and existing required configuration using a reviewed administrative procedure. Record the Business UUID privately in the operational configuration. Set `PUBLIC_BUSINESS_ID` to that UUID. Map the real Supabase user UUIDs to `admin_memberships` with `OWNER` or `STAFF` and the same business; inspect the schema's constraints and existing membership rows before writing. Do not create conflicting memberships. Retain table RLS and do not grant anonymous/browser business-table access.

In Supabase Auth URL configuration, set Site URL to the canonical frontend HTTPS origin and allow only necessary exact redirect URLs for the existing email/password flow. Do not add unsupported callback/reset routes. Confirm email confirmation/account provisioning settings. Test a valid Auth user without membership still receives 403 from protected APIs.

## Render backend

Create the approved native Python Web Service from the release repository:

| Dashboard setting | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Root directory    | `api`                                                              |
| Build command     | `pip install -r requirements.txt`                                  |
| Start command     | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log` |
| Health check path | `/health`                                                          |
| Python runtime    | Set `PYTHON_VERSION=3.12.14` explicitly                            |
| Instances/workers | One instance, one worker initially                                 |
| Deployment        | Controlled release of the tested revision                          |

No disk, Docker, provider SDK or provider-specific application logic is needed. Configure environment values directly in Render:

| Variable                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| `APP_ENV`               | `production`                                                            |
| `DATABASE_URL`          | Secret production PostgreSQL URL with TLS                               |
| `DATABASE_POOL_SIZE`    | `2` initially                                                           |
| `DATABASE_MAX_OVERFLOW` | `1` initially                                                           |
| `FRONTEND_ORIGIN`       | Exact frontend HTTPS origin, e.g. the allocated Pages production origin |
| `FRONTEND_ORIGINS`      | Additional allowed origins as a JSON array; e.g. `["https://studio-ermanno.pages.dev","https://iminatiparrucchieri.com"]`. Redeploy the API after changing it. |
| `SUPABASE_URL`          | Production Supabase project HTTPS origin                                |
| `SUPABASE_JWT_AUDIENCE` | `authenticated`                                                         |
| `PUBLIC_BUSINESS_ID`    | Existing real Business UUID                                             |

Recalculate pool budget for overlapping deployments, other database users and migrations; three connections per process is an initial limit, not a guarantee the project has enough remaining capacity. Do not increase instance/worker counts casually.

Production settings reject absent database/Auth/business configuration, non-HTTPS frontend/Auth origins and a database URL without explicit TLS. Startup errors use a generic message to avoid leaking configuration input. Correct settings in the provider dashboard; do not paste raw settings exceptions with secrets into tickets.

Check `/health` over HTTPS, independently verify database connectivity and migration revision, then verify protected access from the frontend. Health checks remain liveness-only. Basic request summaries log generated request ID, method, route template, status, duration and exception class. Production unexpected errors return a generic 500; development retains exception propagation for debugging/regression tests. Raw Uvicorn access logs are disabled by the start command. Never enable SQL echo or log bodies/headers/query strings.

## Cloudflare Pages frontend

Prefer Git integration with the approved repository; confirm the project creation mode before using Direct Upload because changing modes later is restricted. Configure:

| Dashboard setting      | Value                                 |
| ---------------------- | ------------------------------------- |
| Root directory         | `web`                                 |
| Build command          | `npm ci && npm run build`             |
| Build output directory | `dist`                                |
| Node runtime           | Set `NODE_VERSION=22.23.2` explicitly |
| Production branch      | Confirmed release branch              |

Production build environment:

```dotenv
DEPLOYMENT_ENV=production
VITE_API_BASE_URL=https://YOUR-API.onrender.com
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR-PUBLIC-KEY
```

All `VITE_*` values are visible in the browser. `DEPLOYMENT_ENV` enables build-time validation and is not exposed through the Vite browser prefix. This release requires the project's publishable key for production builds; legacy JWT anon keys are not accepted by the production guard. Keep database URLs/passwords and Supabase secret/service-role keys backend-only. Frontend environment changes require rebuilding the release.

Reserve/finalize the Pages origin before backend CORS/Auth configuration. Provider URLs suffice for initial launch. If adding a custom domain, choose a canonical origin and update frontend/backend/Auth settings together. Do not whitelist arbitrary preview origins; previews need isolated staging configuration and must not receive live credentials by default.

Native SPA fallback requires no top-level `404.html`. Verify refresh/deep links, including protected detail pages; unknown routes render the app's not-found UI, although SPA fallback can return HTTP 200. `_headers` adds basic static security headers and admin/login noindex. `robots.txt` excludes admin/login; neither mechanism grants or revokes access. Preview indexing protections must be checked on the host. Keep default asset caching and confirm old HTML does not retain incompatible JS after release. Static images deploy with the frontend; no Supabase Storage.

Canonical/sitemap/social URL work requires the confirmed hostname; do not publish placeholder URLs or claim SSR crawlability. This is not a launch dependency for an initial provider-domain deployment.

## Release smoke tests and acceptance

Follow the full [Phase 12 verification matrix](plans/phase-12-implementation.md#verification-and-acceptance). In isolated staging, prove real Owner and Staff login/restore/logout, nonmember denial, Owner client create/search, appointment create/barber conflict, repeat-safe completion/inventory, feedback submission/moderation and public availability/catalog privacy. Use disposable staging data; keep it out of real business history.

On the live deployment, verify HTTPS, browser `/health`, exact-origin CORS/preflight, database/migration revision, public routes/content/contact links, direct admin reloads and real Owner/Staff access. Use reads unless specific disposable production write checks and their reconciliation are approved. Check the hosting tier's restart/cold-start behavior and errors on temporary API failure. Do not call deployment complete until the deployed end-to-end model is verified.

Record actual deployed URLs/revision, runtime versions, test counts, migration head, live check evidence and limitations in `docs/phase-12-verification.md`. Do not record passwords, tokens or complete connection strings.

## Rollback

The free Supabase tier requires an operator-managed off-site backup process; see [official backup guidance](https://supabase.com/docs/guides/platform/backups). This release includes a native-client application backup command, with no Docker, provider SDK or background scheduler. Install PostgreSQL client tools through a trusted package manager, using a client version at least as new as the server. From `api/`, create a private ignored `.backups/` directory and run:

```sh
mkdir -p .backups
chmod 700 .backups
APP_ENV_FILE=.env.production python scripts/backup_database.py .backups/production-YYYY-MM-DD.dump --pg-dump /path/to/pg_dump
```

The command passes credentials through the subprocess environment, keeps them out of arguments/output, refuses to overwrite a file, writes with mode 0600, and removes a failed partial dump. Backups include the application `public` schema and Alembic checkpoint, without source ownership or grants. Preserve the tested migration source to restore grants/RLS configuration. Keep backups private and copy them to an approved encrypted off-site location; no off-site destination is configured by this task.

This is an **application database backup**, not a complete Supabase project backup: managed Auth identities/passwords and dashboard settings are not included. Preserve those through the provider's supported recovery procedures; after recreating identities, explicitly review and remap membership UUIDs. Record Auth origin/audience, business UUID, migration revision and application release privately alongside the recovery procedure. See [official project backup/restore instructions](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Restore into a new isolated target first, using the same tested migrations and native `pg_restore` client. Check business data, roles, hours, counts, foreign keys, RLS and the Alembic checkpoint before switching application configuration. An isolated schema rehearsal must redirect statement targets and never import the archived `public` schema over an existing database. Do not use an unreviewed text replacement for arbitrary backup contents. Full production restore requires coordinated downtime, a separately approved target and reconciliation of writes made after the backup.

Retain the previous successful provider releases and compatible environment settings. Restore the previous frontend/backend release when an application regression requires it; recheck compiled API URL, CORS, Auth origin and caching. For first launch with no prior live release, stop exposure and fix configuration instead of pretending a rollback exists.

Do not automatically downgrade the database or overwrite new business writes with a backup. Prefer a forward fix. Database recovery requires an explicit backup/restore decision, coordinated downtime and write reconciliation. Keep backup restoration instructions available to the operator.

Provider details follow the official references linked in the Phase 12 plan, checked 2026-10-05. Recheck account-specific settings and costs at deployment time.
