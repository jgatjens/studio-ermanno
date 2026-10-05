# Phase 12 — Deployment preparation verification

Date: 2026-10-05. Status: locally verified preparation; **deployment is not complete**. The user created a separate production Supabase project. No live Cloudflare Pages/Render resources have been created yet. Production migrations and initial business configuration are complete. Phase 13 remains deferred.

## Created and changed

- Root `.python-version` pins Python 3.12.14; `web/.node-version` pins Node 22.23.2. Provider runtime settings are documented explicitly for the monorepo.
- `api/constraints.txt` preserves the previously installed backend dependency versions; `api/requirements.txt` consumes those constraints. No application dependency or deferred tooling was introduced.
- `api/app/core/config.py` validates production database/Auth/business settings, HTTPS origins, explicit database TLS, bounded pool settings, and a separate optional local `APP_ENV_FILE`. Explicit missing files and invalid startup settings fail safely without printing secret inputs.
- `api/app/db/session.py` uses configurable pool size 2 / overflow 1, retains connection checks/timeouts, and hides SQL parameters.
- `api/app/core/request_logging.py` and `api/app/main.py` provide portable request summaries with generated request IDs, route templates, status and duration. Queries, bodies, tokens, path identifiers and exception text are omitted. Unexpected production errors return a generic 500; development exception propagation is retained.
- Backend/frontend `.env.example` files describe placeholders and production settings. `.gitignore` excludes the isolated `.venv-production` verification environment.
- `web/deployment/config.ts` and `web/vite.config.ts` validate production build settings when `DEPLOYMENT_ENV=production`; public HTTPS origins and the publishable Auth key are required, and Supabase secret keys are rejected.
- `web/public/_headers` and `robots.txt` provide basic static headers and admin/login indexing exclusions; native SPA fallback is preserved without a top-level 404 page.
- `api/tests/test_deployment.py` and `web/src/deployment.test.ts` cover changed operational behavior. The existing production-seed test fixture now provides valid production configuration so it continues to verify the actual seed guard.
- Root README, docs index and `docs/deployment-runbook.md` document setup, exact provider settings, migrations, verification and rollback.

The user explicitly approved a scoped launch fix for split opening periods. Optional midday break fields, validation, appointment exclusion, privacy-safe availability, Owner editing, Staff display and public contact hours were added with migration `0003_split_hours`. Existing schedules remain unchanged. No Storage usage, Docker, CI/CD, provider SDK or new role was added.

## Verification results

| Check | Result |
| --- | --- |
| Python production runtime | 3.12.14 in an isolated local virtual environment |
| Node frontend runtime | 22.23.2 |
| Final default backend suite | 268 passed, 42 PostgreSQL cases explicitly skipped |
| PostgreSQL regression coverage | All 42 current database cases passed across isolated runs: 24 Phase 1, 1 downgrade guard, 17 domain regressions |
| Frontend suite | 138 passed across 15 files |
| TypeScript | `npm run typecheck` passed |
| Frontend build | Passed; 163 modules, JS 643.65 kB / gzip 185.78 kB; existing >500 kB warning remains |
| Development database connectivity | `python -m app.db.check` passed under Python 3.12 |
| Development Alembic connectivity | `python -m alembic current`: `0002_phase7 (head)` |
| Local live API | `/health` returned `{status: "ok"}` |
| Local real browser | Existing Owner session loaded admin; `/admin/access` showed `API Status: Connected` |
| Source hygiene | No actual configured development database password or long Supabase secret-key match in tracked files; local credential/virtualenv files are not tracked |
| Patch formatting | `git diff --check` passed |

Full PostgreSQL-enabled Python 3.12 run collected 285 cases before the final two local environment-file checks and startup-redaction check were added. It reported 284 passed and one failure: the production-seed fixture constructed incomplete production settings, and validation ran before the seed guard. The fixture was corrected and the affected PostgreSQL test passed on rerun (1 passed, 24.60 seconds). The final default suite includes all seven new backend operational tests and passes. Total current backend coverage is 288 distinct cases: 252 default and 36 PostgreSQL. This is combined run evidence, not a claim that a single final 288-case PostgreSQL run occurred.

The initial default suite also identified that catching exceptions in development would break rollback tests' error assertions. Production-only sanitization preserved development debugging and rollback verification; subsequent default suites passed. The bundled Python runtime needed sandbox permission for loopback test servers; the permitted rerun passed. Package resolution is constrained to the existing baseline rather than silently upgrading during deployment.

PostgreSQL integration tests used disposable schemas on the existing development project. The production migration was then applied serially, verified at `0003_split_hours`, and one confirmed business with seven schedules was provisioned. No sample domain records were copied. A local production-configured API returned the correct public business and hours; `/health` returned 200 with exact Pages-origin CORS.

## Confirmed decisions and hosting preparation

- Repository: `https://github.com/jgatjens/studio-ermanno`. The user created/connected it during preparation; initial revision was `14c5df8`. Do not treat this revision as a verified live release.
- User selected free-tier deployment and a separate production Supabase project.
- Chrome is signed in to Render, Cloudflare and Supabase. No need to share account passwords in chat.
- Render form is prepared for public repository deployment as `studio-ermanno-api`, root `api`, documented Uvicorn command, free compute, Frankfurt region. No deploy submitted; no URL allocated yet.
- Cloudflare Pages Git integration is scoped to `jgatjens/studio-ermanno`. The user approved the displayed permissions; GitHub account reauthentication completed and the integration is installed.
- The user created `studio-ermanno-production`, project `jsgcfmzttoajmbwgbgmt`, in Frankfurt (`eu-central-1`), with Data API and automatic table exposure disabled. Auth remains part of the architecture. Public project URL is `https://jsgcfmzttoajmbwgbgmt.supabase.co`; no password was shared with the agent.
- Ignored `api/.env.production` is created with mode 0600 and nonsecret project settings. The user saved its private database URL and a production connectivity check passed; its proposed frontend origin must be replaced by the allocated canonical origin before deployment. A new Business UUID is reserved locally for reviewed setup, not copied from development.

Prepared names are proposals, not reserved URLs. Free Render cold starts and feature limits must be verified on the actual deployed service. A custom domain is not required for the first release.

The user confirmed production name **Minati Parrucchieri**, public phone **0461 765351**, Tuesday–Saturday **08:00–12:00 and 14:00–19:00** in Europe/Rome, and use of the supplied photos. Public email can remain blank. The user approved split opening periods before launch. The implementation represents an outer 08:00–19:00 span with a 12:00–14:00 closure; appointments and public availability exclude that closure. Monday and Sunday are assumed closed; currency is EUR.

## Remaining setup and live acceptance

1. Production connection is configured securely and verified. Do not send the password or complete credential URL in chat.
2. Split opening periods are implemented and tested; provision reviewed business configuration. The supplied address is Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia. Production starts without sample clients, appointments, services or products; real catalog/barber/stock setup remains an Owner task.
3. Create production Owner/Staff Auth users and memberships for the confirmed Business; provision reviewed business configuration and apply migrations serially.
4. Finalize frontend/backend URLs, exact-origin CORS and Supabase Auth URLs. Configure runtime/build environments and public Auth key.
5. Complete Git integration authorization and any browser-required confirmation for credential transmission/public resource exposure at the actual action. Keep integration access limited to the intended repository.
6. Deploy the tested release, then verify HTTPS, browser health, database/revision, deep links and public content. Record actual URLs/revision/runtime settings.
7. Finish real Owner/Staff end-to-end workflow checks on deployed environments: clients/search, appointment creation/conflicts, repeat-safe completion/stock, feedback/moderation and safe public availability/catalog. Staging data must not become real customer history.
8. Confirm backup/recovery and application rollback procedure; do not automate destructive database downgrade/restore.

Previously shared development database/password and privileged Supabase key should be rotated by the user. They are not production credentials. No live deployment or end-to-end deployed validation is claimed until these setup steps have evidence.

## Split-hours verification update

The default backend rerun passed 268 tests with 41 database tests skipped before adding one database-only downgrade guard. The Phase 1 database suite passed all 24 cases (309.35 seconds); the additional configured-closure downgrade guard passed separately (37.51 seconds). Frontend tests passed 138 cases; TypeScript and build passed. The remaining 17 database regression cases passed (225.49 seconds). The final default backend run passed 268 with 42 skipped (13.16 seconds): total 310 distinct backend cases verified across runs. Hosting deployment is in progress. Production database connectivity passed. The user explicitly approved sending the production database credential to backend Render environment settings and publishing the free-tier API/frontend; those settings have been entered without displaying credentials.
