# Phase 4 implementation and verification

Implemented the [Phase 4 plan](plans/phase-4-implementation.md). No Phase 5 work was added.

## Created

- `api/app/clients/__init__.py`: domain package.
- `api/app/clients/schemas.py`: validated Owner writes and explicit Owner/Staff client and nested visit projections.
- `api/app/clients/service.py`: membership-scoped literal search, pagination, profile/history queries, historical snapshots, and transactional writes with rollback.
- `api/app/clients/router.py`: GET/POST `/clients`, GET/PUT `/clients/{id}`, GET `/clients/{id}/history`.
- `api/tests/test_phase4.py`: 14 test cases for credentials/membership, validation, search/privacy, writes, isolation, pagination, and completed history snapshots.
- `web/src/admin/clients-page.tsx`: client list/search, create/edit forms, profile, and paginated history using the existing API client and TanStack Query.
- `web/src/admin/clients.test.tsx`: 12 tests for search, role controls, states/retry, creation/edit, retained failed drafts, 404, and history visibility.
- This report.

## Modified

- `api/app/main.py`: client router registration.
- `api/requirements.txt`: `email-validator>=2,<3` for Pydantic email validation. Installed locally with its DNS parsing dependency; validation does not perform mailbox/deliverability checks.
- `web/src/app/app.tsx`: Clients navigation and four protected routes.
- `web/src/admin/query-provider.tsx`: do not automatically retry 404/422 responses, alongside existing 401/403 handling.
- Root `README.md`: Phase 4 routes, behavior, setup, and verification links.

No database schema/migration, environment configuration, production data, privileged credentials, or frontend state library changes were needed. Auth remains in Context, API data in actor-scoped TanStack Query, and form/search drafts in local state.

## Behavior and assumptions

- Owner creates/updates clients and searches names/email/phone. Staff can read/search names only and cannot mutate. Contact searches cannot leak private matches to Staff. All ownership comes from backend membership.
- Staff responses omit email, phone, private notes, visit notes, and SOLD product rows. UI hides these sections as an additional convenience.
- Required first/last names match existing models. Optional contacts/notes accept blank/null; notes have a 10,000-character API limit. No contact uniqueness rule.
- Full-record PUT clears omitted optional fields. Search is case-insensitive literal substring per permitted field, with deterministic ordering and bounded offset pagination.
- History is a read projection of existing COMPLETED appointments and stored service/product snapshots. Last visit uses scheduled start, then ID, because no completion timestamp exists. No appointment transitions or stock changes occur.
- Real Owner/Staff login credentials were not supplied; existing seeded memberships still require real Supabase identity mapping for manual sign-in checks.

## Verification (2026-10-04)

| Check | Result |
| --- | --- |
| `api`: `.venv/bin/python -m pytest` | 54 passed, 19 live database tests skipped as configured |
| `api`: `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` | 73 passed, no skips, 126.83 seconds |
| `web`: `npm test` | 41 passed across five test files; no unhandled errors |
| `web`: `npm run typecheck` | Passed |
| `web`: `npm run build` | Passed |
| Live GET `/health` | 200, `{"status":"ok"}` |
| Live GET `/clients` without token | 401 |
| Browser `/admin/clients` without session | Redirected to `/login`; email/password form displayed |
| Browser public page | API Status: Connected; Supabase Auth client: Initialized |

All previous Phase 0–3 tests passed. The 19 live PostgreSQL cases retain database connectivity, migration roundtrip, metadata, relationships, and seeding verification using disposable schemas. Phase 4 writes are tested in isolated SQLAlchemy databases with real JWT/JWKS verification; no live business clients were created.

Initial test attempts encountered sandbox restrictions on loopback/network access; authorized reruns succeeded. A frontend test mock initially returned the wrong history response shape and was corrected. The added 404 test exposed an unnecessary automatic retry delay; 404/422 retries were disabled and the final suite passed.

The build retains a nonfatal chunk-size warning: JavaScript 575.36 kB, 168.08 kB gzipped. No deferred bundling infrastructure was added.

## Remaining manual setup/checks

Provide development Owner and Staff Supabase users and link them to memberships using the existing README instructions. Then verify Owner create/search/edit/profile and Staff name search, API response omissions, and mutation 403 using disposable development clients. Authenticated client screens at 320 px and desktop widths, keyboard navigation, and real network response inspection remain pending. Automated component and backend tests cover behavior; they do not establish visual/browser verification for these authenticated flows.
