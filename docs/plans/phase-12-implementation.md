# Phase 12 — MVP Deployment

## Goal and source of truth

Deploy the validated MVP to Cloudflare Pages (React/Vite), Render (FastAPI), and Supabase (PostgreSQL and Auth). The deployed frontend must support the existing end-to-end Owner workflows and Staff reads. This document is a plan only: it does not create hosting resources, publish code, change credentials, or mark deployment complete.

Follow [Phase 12 in the roadmap](../mvp-implementation-phases.md#phase-12--mvp-deployment), [deployment checklist](../mvp-task-checklist.md#phase-12--mvp-deployment), [architecture](../architecture.md), [tech stack](../tech-stack.md), and [Phase 11 verification](../phase-11-verification.md). Phase 12 is the last initial MVP phase. Phase 13 is later work.

## Scope and boundaries

- Configure production environment variables, HTTPS origins, CORS, Auth, migrations, health checks, and basic production logging.
- Add only small deployment configuration and operational fixes needed for reliable hosting; preserve business behavior and backend portability.
- Keep Supabase limited to PostgreSQL and Auth. Images remain static frontend assets.
- Keep application services independent of Render and Cloudflare. Use standard ASGI, SQLAlchemy, Alembic, and environment settings.
- Do not add AWS Lambda, Docker, CI/CD pipelines, new business features, roles, booking, payments, notifications, upload management, advanced monitoring, or a permissions framework.
- Provider-native builds are sufficient. Start with a controlled release of a tested revision; do not enable unattended production promotion before release checks pass.

## Current baseline and launch inputs

Phase 11 recorded 281 backend tests with PostgreSQL enabled, 127 frontend tests, passing TypeScript checks and frontend build. These are historical results, not Phase 12 verification. Alembic head is currently `0002_phase7`. Real Staff reads/privacy/logout were verified; the complete real Owner workflow remains a launch check.

The workspace currently has no Git repository metadata. Before publishing, obtain or establish the intended repository/remote, review tracked files for secrets, and identify a tested release revision. Do not initialize or push a repository as part of this planning task.

Required implementation inputs:

- Cloudflare and Render account access, project/service names, chosen region, hosting tier and budget.
- Canonical frontend HTTPS origin and backend HTTPS URL. Provider domains can serve the first MVP release; a purchased domain is not required.
- Explicit decision on production Supabase project: prefer isolation from development; do not silently turn the current fixture database into production.
- Production Business UUID, verified identity/contact details, currency/timezone, services, products, stock baselines, hairdressers and hours.
- Real Owner and Staff Auth accounts mapped to the intended Business memberships. An Auth user alone is insufficient.
- Confirm publication rights for supplied photographs. The confirmed address is Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia. Sample business name/contact information and seed hours/catalog are not approved production facts.
- Rotate the database password and privileged Supabase key previously shared in chat before launch. Update only their required secret consumers; never copy them into this document, source control, build output, or browser configuration.

Choose hosting tiers deliberately. If a tier can sleep or restrict migration tooling, document cold-start behavior and the operational fallback before launch; do not create paid resources without authorization.

## Deployment configuration

### Frontend: Cloudflare Pages

Use the existing `web/` application with root directory `web`, build command `npm ci && npm run build`, and output directory `dist`. Pin a tested Node 22 patch at least 22.12 through the provider runtime configuration; verify it against the installed Vite version. Preserve the package lock and avoid dependency upgrades just for deployment.

Prefer Git integration once the repository is available. If Direct Upload is selected instead, document that choice before project creation: project deployment mode has migration restrictions. Do not add a separate deployment pipeline.

Keep native SPA fallback working: do not add a top-level `404.html` that disables fallback. Verify direct navigation and refresh on public routes, `/login`, `/admin`, and an existing appointment/client detail route. Unknown routes must still render the app's not-found state. SPA fallback can return HTTP 200 for unknown URLs; document that limitation.

Use provider caching defaults initially; do not apply blanket long-lived caching to HTML or API responses. Verify hashed assets update after a release and static responsive WebP images load. Add only necessary static security headers, testing Auth/API connectivity if CSP is introduced. Keep admin/login and preview pages out of indexing; robots directives are not access control. Any canonical/sitemap configuration must use the confirmed hostname. Do not introduce SSR or prerendering in this phase.

### Backend: Render

Use a native Python Web Service, root directory `api`, build command `pip install -r requirements.txt`, and start command:

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log
```

Start with one worker and one service instance. No reload, persistent disk, local sessions, or filesystem business storage. Pin a supported Python runtime after verifying the suite on that exact runtime; Python 3.12 is the proposed target, while the existing local 3.9 environment is not production verification. Keep any provider manifest outside `app/`; dashboard settings plus a documented runbook are sufficient if no manifest is needed.

Configure health path `/health`. Its successful response proves process liveness only: it does not prove PostgreSQL or migrations are ready. Check database access separately during release verification.

### Environment matrix

| Setting                  | Location              | Production value / handling                                      |
| ------------------------ | --------------------- | ---------------------------------------------------------------- |
| `APP_ENV`                | Backend               | `production`                                                     |
| `DATABASE_URL`           | Backend secret        | Supabase PostgreSQL URL, TLS enabled, password encoded correctly |
| `FRONTEND_ORIGIN`        | Backend               | Exact canonical frontend HTTPS origin, without a path            |
| `SUPABASE_URL`           | Backend               | Production Auth project URL                                      |
| `SUPABASE_JWT_AUDIENCE`  | Backend               | `authenticated`, matching project tokens                         |
| `PUBLIC_BUSINESS_ID`     | Backend               | Actual production Business UUID                                  |
| `VITE_API_BASE_URL`      | Frontend build        | Render API HTTPS base URL                                        |
| `VITE_SUPABASE_URL`      | Frontend build        | Same production Auth project URL                                 |
| `VITE_SUPABASE_ANON_KEY` | Frontend build        | Public/publishable Auth key; existing variable name is retained  |
| Node/Python version      | Hosting configuration | Explicit tested runtime versions                                 |

Frontend `VITE_*` values are public and compiled into the bundle. Changes require a rebuild. Never include database credentials, Supabase secret/service-role keys, or privileged tokens there. The current backend validates JWTs through issuer/JWKS and does not need a Supabase privileged API key. `SEED_TIMEZONE` is development seed configuration, not production Business timezone.

Update `.env.example` documentation with placeholders only. Keep actual files ignored. Fail clearly on missing deployment configuration; no localhost fallback for a production frontend build. Add focused checks for any new production validation.

## PostgreSQL and migrations

Retain the verified Supabase session pooler on port 5432 with TLS for the long-lived backend, unless a separately tested connection choice is required. Do not switch to transaction pooling on 6543 without testing driver/prepared-statement behavior. All database access remains centralized in the existing SQLAlchemy engine.

The development session pool has already hit a connection limit during overlapping browser and database tests. Add minimal portable, validated environment settings for SQLAlchemy pool size and overflow if needed for hosting. Proposed initial budget is pool size 2 plus overflow 1 per process; confirm actual project limits and reserve capacity for migrations, administration and other consumers. Account for overlapping deployments as well as workers/instances. Do not multiply workers or enable autoscaling without recalculating this budget. Preserve `pool_pre_ping` and connection timeout.

Before a production migration, confirm target project/database, take a recoverable backup using available Supabase/export tooling, record current Alembic revision, and verify the release's migration head. A new empty database requires `upgrade head`; an existing database must be inspected before migrating. Never use `stamp` to conceal a schema mismatch.

Run migrations once, serially, before exposing the new release:

```sh
# From api/, with the intended target configuration loaded securely
python -m alembic current
python -m alembic upgrade head
python -m alembic current
```

Render pre-deploy commands are available only on eligible paid service types. If supported, use `python -m alembic upgrade head` there; otherwise use an explicit operator-run migration from the tested release environment before deployment. Never run migrations in each worker's startup or during a frontend build. Re-run safely after failure only once the cause is understood. This phase has no planned domain schema change.

Provision confirmed production business/configuration and memberships through an explicit reviewed setup procedure. The development seed command must remain disabled in production. Preserve RLS and backend scoping; do not add browser access policies for business tables. Do not run the full PostgreSQL test suite against production or copy test customers into the production business.

## Auth, CORS and privacy

Configure Supabase Site URL to the canonical frontend origin and narrowly allow only required redirect URLs. Email/password login remains the implemented flow; do not invent a callback, signup or password-reset screen. Confirm account provisioning/email confirmation settings for the existing admin-only identity flow.

Verify backend issuer, audience, signature, expiry and membership lookup independently. Business ID and role still come from the database. Check Owner, Staff, valid user without membership, and unauthenticated access; frontend hiding never replaces authorization.

Keep exact-origin CORS with existing methods/headers and bearer tokens. Verify a real browser preflight and request from the canonical origin; an unrelated origin must not receive an allow-origin grant. Preview builds must not silently point at production Auth/database; use isolated staging configuration or leave protected preview functionality unconfigured. A second canonical hostname requires a deliberate CORS configuration change, not a wildcard.

Add basic portable stdout logging: method, route template, status, duration and request correlation where useful. Disable raw access logs that include query strings, and avoid request/response bodies, authorization headers, cookies, contact details, notes and SQL parameters. Configure SQLAlchemy parameter hiding and ensure exception reporting does not expose connection strings or raw sensitive values. Add focused redaction/error tests. Do not add an external logging platform or monitoring agent.

## Implementation and release order

1. Confirm launch inputs and target environments; inspect repository contents and secrets before publishing a reviewed revision.
2. Add minimal deployment/runbook configuration, runtime pinning, bounded pool settings and safe logging. Keep examples secret-free; add tests only for behavior changed here.
3. Install using the intended production runtimes and run all checks below in development/staging. Record revision, runtime versions and results.
4. Reserve provider project names/URLs, configure production Supabase/business/memberships, backup and migrate. Finalize exact frontend origin, CORS and Auth URLs.
5. Deploy backend and verify HTTPS liveness, database access, migration head and safe logging. Frontend publication follows only after backend checks pass.
6. Build/publish frontend with final API/Auth settings, then verify direct route loads, mobile layout, Auth and API requests on deployed origins.
7. Run complete workflow checks in isolated staging using disposable data. Production checks use read-only operations by default; any write smoke checks require explicitly approved disposable records and a cleanup/reconciliation plan for inventory and feedback.
8. Record release evidence, outstanding limitations, rollback information and operator instructions. Mark Phase 12 complete only after deployed end-to-end checks pass.

## Verification and acceptance

Run from `web/`:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Run from `api/` in the tested virtual environment:

```sh
python -m pytest
# Only against the isolated development/staging database
env RUN_DATABASE_TESTS=1 python -m pytest
python -m alembic current
```

Do not overlap the PostgreSQL suite with live browser checks on the constrained pool. Preserve all Phase 0–11 regressions. Record actual test counts, skips, runtime versions and build warnings; the existing large-bundle warning is a documented limitation, not a reason to rewrite bundling.

| Deployed check                | Required result                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| HTTPS and `/health`           | Successful liveness response, browser health request succeeds                                    |
| PostgreSQL / Alembic          | Read-only connectivity succeeds; revision matches release head                                   |
| CORS                          | Canonical origin succeeds, unrelated origin gets no CORS grant                                   |
| Login / restore / logout      | Real Owner and Staff load the backend actor; logout clears private state                         |
| Access boundaries             | Missing/invalid/expired token returns 401; nonmember and Staff mutations return 403              |
| Staff privacy                 | Protected reads work; email, phone, private/general client notes and visit notes are omitted     |
| Client creation/search        | Owner creates and finds disposable staging client; search survives navigation                    |
| Appointment creation/conflict | Owner creates appointment; conflicting hairdresser reservation is rejected                            |
| Completion/inventory          | Completion records history and correct stock movement; repeat attempt does not double-deduct     |
| Feedback                      | Submission stays pending/private; Owner moderation controls public visibility                    |
| Availability                  | Public date/interval states use Business timezone and expose no private records                  |
| Public services/products      | Only allowed active/public catalog fields appear; no stock/cost/internal identifiers             |
| Public pages / mobile         | Confirmed content/images, deep-link reloads, contact links, safe-area navigation and errors work |
| Logging / build assets        | Logs and browser bundle contain no privileged credentials or private payloads                    |

Check cold-start/restart behavior on the selected tier, session restoration after a reload, and partial API failures. Production business content must be confirmed and no sample contact details exposed. Keep staging smoke records out of real business history.

## Rollback and handoff

Record the previous successful frontend build and backend revision plus their environment configuration. Roll back application deployments through provider release controls if an incompatible build fails; recheck CORS/Auth/API URLs and cache behavior. Environment and compiled frontend configuration must remain compatible with the restored backend.

Do not automatically downgrade Alembic or restore a database over new business writes. Prefer a reviewed forward fix; database restore requires an explicit recovery decision, known backup, write reconciliation and coordinated downtime. Verify recovery instructions before relying on a backup.

Expected implementation deliverables are a local deployment runbook, updated root README and secret-free examples, any minimal operational code/configuration and tests, and `docs/phase-12-verification.md`. The verification report must list deployed URLs, tested revision, runtime versions, migration head, test counts, actual Owner/Staff smoke evidence, assumptions, remaining setup and rollback references without secrets. Leave checklist items unchecked until their evidence exists. Stop before Phase 13.

## Provider references

Official documentation checked on 2026-10-05; recheck relevant settings during deployment:

- [Render FastAPI deployment](https://render.com/docs/deploy-fastapi), [Python version](https://render.com/docs/python-version), and [deployment / pre-deploy commands](https://render.com/docs/deploys).
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [SPA serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), and [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [pooling limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits), and [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [Vite runtime requirements](https://vite.dev/guide/).
