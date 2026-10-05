# Phase 5 implementation and verification

Implemented the [Phase 5 plan](plans/phase-5-implementation.md). No Phase 6 completion, visit-note entry, product mutation, or inventory workflow was added.

## Created

- `api/app/db/locking.py`: shared PostgreSQL Business-row locking helper.
- `api/app/appointments/__init__.py`: domain package.
- `api/app/appointments/schemas.py`: strict appointment/preview/status command validation.
- `api/app/appointments/scheduling.py`: half-open overlap/capacity sweep, business-local hours validation, and stable conflict codes.
- `api/app/appointments/service.py`: scoped queries/projections, Decimal calculations, retained/new service snapshots, atomic scheduling writes, and status transitions.
- `api/app/appointments/router.py`: list/detail/context/preview/create/update/status endpoints.
- `api/tests/test_phase5.py`: 32 cases covering auth, validation, calculations/overrides, privacy, conflicts, hours, snapshots, rollback, statuses, and reference isolation.
- `api/tests/test_phase5_database.py`: five PostgreSQL concurrency cases using independent committed transactions and disposable schemas.
- `web/src/admin/appointments/types.ts`: API projections used by appointment screens.
- `web/src/admin/appointments/time.ts`: business-local display/conversion, DST gap rejection, explicit repeated-time offset selection, and local date boundaries.
- `web/src/admin/appointments/pages.tsx`: Today/date-range/status list, Owner form/preview/edit, detail, and deliberate cancellation/no-show actions.
- `web/src/admin/appointments/time.test.ts`: four time-conversion/DST/date cases.
- `web/src/admin/appointments/pages.test.tsx`: nine cases covering list, role visibility, forms, status confirmation, zero override, conflicts, retained inactive services, and stale preview responses.
- This report.

## Modified

- `api/app/main.py`: appointment router registration.
- `api/app/services/router.py` and `api/app/barbers/router.py`: configuration writers acquire the same business lock as scheduling writes. Existing business-hours locking remains compatible.
- `web/src/app/app.tsx`: appointment navigation and four protected routes.
- `web/src/admin/query-provider.tsx`: deterministic 409 responses do not automatically retry.
- `web/src/lib/api.ts` and `web/src/lib/api.test.ts`: typed 409 conflict messages without auth invalidation; one additional test.
- Root `README.md`: Phase 5 behavior, endpoints, transaction rules, and test/setup guidance.

No new tables, migrations, dependencies, environment variables, privileged API keys, or state libraries were introduced. Existing private cache disposal, auth Context, centralized bearer injection, and local form-state conventions remain in use.

## Behavior and assumptions

- New appointments require an existing scoped client and distinct active services; create starts SCHEDULED. Owner alone can mutate. Staff JSON excludes contacts, client private notes, visit notes, and SOLD products. Core business reads/writes all go through FastAPI.
- Backend derives end/totals using Decimal and preserves retained service snapshots on active edits, including inactive services. New selections snapshot current active definitions. Unchanged catalog snapshots are not refreshed by notes/date/client/barber edits.
- Read projections use canonical service-name/service-ID ordering; selection order is not separately persisted in the existing schema. The main-service summary follows this stable ordering.
- Explicit zero price is valid. No separate override-intent column exists; an override equal to calculated totals is not independently remembered. Edit forms preserve differing final totals as explicit overrides.
- SCHEDULED/CONFIRMED reserve capacity; completed/cancelled/no-show records are read only. Cancellation/no-show retain records and release capacity. Repeating the current supported status is idempotent; completion/reopening is unavailable.
- An unassigned appointment consumes one business-level slot without a fictitious barber. Different barbers can overlap; the same barber cannot. Capacity uses an interval-boundary sweep, not naive counts of all touching appointments.
- Scheduling respects shared local business hours, active barber count, UTC-aware timestamps, and half-open intervals. Notes/client-only edits can preserve an unchanged interval/assignment after configuration changes. New schedules cannot bypass hours/conflicts. No past-date prohibition or no-show timing gate was introduced.
- Frontend DST conversion supports modern IANA offsets at 15-minute resolution; unusual historical timezone offsets are outside this helper's scope. Repeated local times require explicit offset choice; missing local times are rejected.
- Configuration changes do not automatically reschedule/cancel historical or existing appointments. PostgreSQL locking serializes scheduling/configuration transactions; this is not a persisted reservation/online booking service.
- No real development Owner/Staff Auth credentials were supplied. Automated API tests validate real JWT signatures through local JWKS plus membership fixtures; concurrency tests directly exercise the scheduling service with a trusted test actor.

## Verification (2026-10-04)

| Check | Result |
| --- | --- |
| `api`: `.venv/bin/python -m pytest` | 86 passed, 24 live database cases skipped by configuration |
| `api`: `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` | 110 passed, no skips, 180.06 seconds |
| PostgreSQL assigned/unassigned simultaneous creates | One success and one 409 for the last slot |
| PostgreSQL assigned/unassigned competing reschedules | One success and one 409; both records/snapshot sets remain consistent |
| PostgreSQL configuration coordination | Booking waits for the shared business lock and reads newly committed service duration |
| `web`: `npm test` | 55 passed across seven files, no unhandled errors |
| `web`: `npm run typecheck` | Passed |
| `web`: `npm run build` | Passed |
| Live GET `/health` | 200, `{"status":"ok"}` |
| Live GET `/appointments` without token | 401 |
| Browser `/admin/appointments` without session | Redirected to `/login`; email/password form displayed |
| Browser public page | API Status: Connected; Supabase Auth client: Initialized |

Every Phase 0–4 regression test passed. The complete suite includes 19 existing PostgreSQL migration/metadata/seed/relationship cases plus five new concurrency cases. New race tests create and remove only uniquely named `phase5_test_*` schemas; existing live tests use `phase1_test_*`. No live business appointments were created or changed.

The initial appointment test compared equivalent UTC timestamp spellings (`Z` versus `+00:00`); it was corrected to compare the instant. Final checks all passed.

The production build retains the nonfatal JavaScript chunk-size warning: 590.48 kB, 171.59 kB gzipped. No forced dependency upgrades or deferred bundling tooling were added.

## Remaining manual setup and checks

Create/provide real development Owner and Staff Supabase users, and map their IDs to memberships using the existing README setup. With disposable development records, verify Owner create/edit/override/conflict/status flows, Staff reads/response omissions and mutation 403, and DST offset selection against the live backend. Authenticated mobile/desktop layouts and keyboard/focus checks remain pending those credentials. Automated component tests establish behavior but do not replace authenticated browser/visual checks.

Stop here: completion and inventory integration remain Phase 6/7; public availability remains Phase 9.
