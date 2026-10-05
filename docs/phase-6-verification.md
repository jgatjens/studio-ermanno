# Phase 6 implementation and verification

Implemented the [Phase 6 plan](plans/phase-6-implementation.md). No Phase 7 inventory mutation/product management work was added.

## Created

- `api/app/appointments/completion.py`: validated completion commands, minimal Owner-only active product selector, normalized stored-state retry comparison, and atomic history-only completion.
- `api/tests/test_phase6.py`: 30 cases for auth/roles, validation, status handling, snapshots, retries, privacy, isolation, rollback, history, capacity release, and unchanged stock.
- `api/tests/test_phase6_database.py`: four independent-transaction PostgreSQL races: identical/differing completions and completion versus cancellation/service edit.
- `web/src/admin/appointments/complete-page.tsx`: Owner review/product/quantity/visit-note form with deliberate confirmation, retained drafts, and exact-body retry after uncertain transport outcomes.
- `web/src/admin/appointments/complete-page.test.tsx`: nine completion UI cases, including a simulated server commit with failed response followed by background refetch and identical retry.
- This report.

## Modified

- `api/app/appointments/router.py`: GET `/appointments/completion-products` and POST `/appointments/{id}/complete`, both Owner-only.
- `api/app/appointments/service.py`: product IDs included in scoped appointment product projections.
- `api/app/clients/schemas.py` and `api/app/clients/service.py`: product IDs included in existing role-filtered history snapshots.
- `web/src/app/app.tsx`: protected completion route.
- `web/src/admin/appointments/pages.tsx`: active Owner Complete action and completed-success notice.
- `web/src/admin/appointments/types.ts`: product projection identity.
- Root `README.md`: Phase 6 behavior, APIs, retries, history, and inventory boundary.

No schema/model/migration changes, new dependencies, environment variables, state library, privileged credentials, or hosting-specific code were required.

## Behavior and assumptions

- Owner completes SCHEDULED/CONFIRMED appointments by confirming their stored service-ID set. Corrections to services/final totals use the existing active edit flow first.
- Stored services, snapshots, totals, interval, client, barber, and appointment notes remain unchanged by completion. Retained inactive services are valid for confirmation. No completion timestamp is added; last visit remains derived from completed scheduled start with ID tie-breaker.
- Existing active products can be recorded as USED/SOLD with positive Decimal quantities of at most 12 digits/3 decimal places. Duplicate product/usage pairs are rejected; one USED and one SOLD entry for the same product are permitted. Product names are snapshotted on first completion.
- Visit notes are trimmed; blank becomes null. Completed records are immutable except for identical retries, compared by normalized service IDs, product IDs/usage/Decimal quantities, and notes.
- Identical retries remain safe after catalog rename/deactivation, with no extra product rows. Changed retries return 409. Cancellation/no-show cannot complete; generic status updates cannot bypass completion validation. Unexpected product rows on an active record require review rather than being overwritten.
- All completion operations share the existing business-row serialization lock. The completion form preserves its initial reviewed snapshot and draft across background refetches; a save that committed but lost its response can still be retried with the exact attempted body.
- Client last visit/history updates by reading COMPLETED records, not by writing a separate history pointer. Completing an older appointment does not displace a newer completed scheduled-date visit. Completion releases active appointment capacity.
- Owner sees USED/SOLD history and visit notes. Staff receives only USED products and permitted appointment/client information; contacts, general/private client notes, visit notes, and SOLD rows are absent from backend projections. Staff has no completion/selector access.
- Product recording is history only. Product stock and InventoryMovement rows remain unchanged on success, failure, retry, and races. SOLD products do not alter appointment totals. Phase 7 must establish its inventory baseline and must not automatically replay earlier history as deductions.

## Verification (2026-10-04)

| Check                                                         | Result                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `api`: `.venv/bin/python -m pytest`                           | 116 passed, 28 live database tests skipped by configuration     |
| `api`: `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest`  | 144 passed, no skips, 214.84 seconds                            |
| PostgreSQL identical completion race                          | Two successes, exactly one product-history set                  |
| PostgreSQL differing completion race                          | One success and one 409, no duplicate rows                      |
| PostgreSQL completion versus cancellation/service edit        | One success and one 409 with consistent terminal/snapshot state |
| `web`: `npm test`                                             | 64 passed across eight files, no unhandled errors               |
| `web`: `npm run typecheck`                                    | Passed                                                          |
| `web`: `npm run build`                                        | Passed                                                          |
| Live GET `/health`                                            | 200, `{"status":"ok"}`                                          |
| Live unauthenticated POST completion with valid command shape | 401                                                             |
| Browser protected completion route without session            | Redirected to `/login`; email/password form displayed           |
| Browser public page                                           | API Status: Connected; Supabase Auth client: Initialized        |

Every Phase 0–5 regression passed. Live database coverage includes 19 migration/metadata/seed/relationship tests, five scheduling races, and four new completion races. Completion races reuse the isolated `phase5_test_*` schema fixture; schemas are uniquely named and removed after each test. No live business appointment/product records were changed.

The production build retains the nonfatal JavaScript chunk-size warning: 597.87 kB, 173.20 kB gzipped. No deferred bundling/deployment tooling or forced upgrades were introduced.

## Remaining manual setup and checks

Real development Owner/Staff Supabase login credentials remain unavailable; seeded memberships require real identity mapping through the existing README setup. With explicitly disposable development records, verify Owner review/completion/retry, completed detail/client history, Staff response omissions/mutation denial, authenticated mobile/desktop layout, and keyboard/focus behavior. These real-user/browser checks remain pending; automated fixture/component tests do not establish visual verification.

Stop at Phase 6. Inventory movements, stock deductions, and product management remain Phase 7.
