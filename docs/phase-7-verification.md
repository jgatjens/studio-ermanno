# Phase 7 verification

Implemented from `docs/plans/phase-7-implementation.md`. Scope stops before Phase 8 feedback.

## Created

- `api/app/products/schemas.py`: normalized metadata, complete PUT schema, opening-stock create, manual movement commands; strict extra-field rejection and Decimal precision.
- `api/app/products/service.py`: scoped search/detail, metadata writes, create retries, SKU validation, role-filtered ledger, manual command retries/transactions.
- `api/app/products/router.py`: protected product and movement endpoints with 201/200 retry semantics.
- `api/app/inventory/service.py`: focused Decimal stock-change and movement insertion function, deterministic opening movement IDs, nonnegative/overflow checks.
- `api/app/inventory/router.py`: protected inventory search/filter/pagination with active default and explicit include-inactive.
- `api/migrations/versions/0002_phase7_inventory.py`: opening baseline reconciliation, stock/delta/sign/link checks, same-business/appointment/product composite linkage, unique movement per appointment product. Existing 12 tables and RLS remain; no new table.
- `api/tests/test_phase7.py`: 42 baseline inventory/product/completion/authorization/constraint test cases, including historical no-replay, seed preservation, and rollback failures.
- `api/tests/test_phase7_database.py`: six independent-transaction PostgreSQL races and one populated baseline migration test.
- `web/src/admin/products-page.tsx`: product/inventory cards, search/filter/pagination, Owner create/edit/flags, product detail, role-filtered ledger, confirmed stock commands and retained retry bodies/UUIDs.
- `web/src/admin/products.test.tsx`: 11 frontend cases covering forms, stock confirmation/retry, read-only behavior, history, filters, errors and cache refresh.
- This verification report.

## Updated

- `api/app/db/models.py`: inventory linkage and database checks, unchanged abstract stock units.
- `api/app/db/seed.py`: serialized opening-stock ledger creation for missing products; preserve existing records/balances/movements.
- `api/app/main.py`: registers product and inventory routers.
- `api/app/appointments/completion.py`: aggregate stock validation and atomic negative linked USED/SOLD movements. COMPLETED retry handling still precedes catalog/stock validation.
- `api/tests/test_phase1.py`: new migration head and linkage-aware relationship fixture.
- `api/tests/test_phase6.py`, `api/tests/test_phase6_database.py`: intentional stock/movement expectations for newly completed visits, preserving all prior privacy/snapshot/retry coverage.
- `web/src/app/app.tsx`: protected product/inventory routes and navigation.
- `web/src/admin/appointments/complete-page.tsx`: stock deduction wording, retained draft on insufficient stock, product/inventory invalidation alongside appointment/client caches.
- `web/src/admin/appointments/complete-page.test.tsx`: updated stock wording expectation.
- Root `README.md` and `docs/README.md`: usage, migration, retry semantics, manual checks and report link.

No dependencies, environment files, credentials, roles, hosting integration, public product pages, uploads, or deferred tools were added.

## Verification results

| Check | Result |
| --- | --- |
| Backend default `.venv/bin/python -m pytest -q` | **158 passed, 35 skipped**, 7.70 seconds; skips are explicit live PostgreSQL cases |
| Full `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest -q` | **193 passed, no skips or warnings**, 311.35 seconds |
| Frontend `npm test` | **75 passed**, 9 files |
| TypeScript `npm run typecheck` | Passed |
| Frontend `npm run build` | Passed; 153 modules, JS 608.93 kB / gzip 175.38 kB |
| Existing Phase 0–6 regressions | Included and passed in both complete suites; Phase 6 assertions updated only for intentional new stock behavior |
| Live `GET /health` | 200, `{"status":"ok"}` |
| Live `GET /products`, `GET /inventory`, `POST /products/{id}/movements` without bearer | All 401; curl `--fail` exit 22 is expected for the latter checks |
| Browser `/admin/products` logged out | Redirected to `/login`; email/password form rendered |
| Browser `/` | “API Status: Connected” and “Supabase Auth client: Initialized” |
| Supabase PostgreSQL SQLAlchemy connection | Passed |
| Development Alembic upgrade/current | `0002_phase7` |
| Development baseline reconciliation | Four products retained **10.000** each; **four** baseline movements added; **zero** ledger mismatches; **zero** prior appointment-product rows preserved unchanged |

Real PostgreSQL races cover competing last-unit completions, completion versus damage, completion versus negative adjustment, identical completion retries, duplicate manual command, and duplicate opening-stock create. Every race checks final nonnegative balance and ledger equality. Existing completion/scheduling races also pass.

The populated migration test keeps a historical completed visit/product row and a preexisting STOCK_IN delta of 3, reconciles unchanged stock 10 with a baseline delta of 7, and verifies repeated upgrade plus downgrade/upgrade does not duplicate rows. Schema roundtrip/metadata comparison, checks, composite FK and uniqueness are covered. API tests additionally verify missing/invalid/expired tokens, no membership, membership-derived business, Staff mutation denial, literal search, exact-case SKU, opening/manual retries, decimal limits, atomic insert failure and insufficient-stock rollback, aggregate USED/SOLD validation, and no-replay legacy completion.

## Assumptions and remaining manual setup

The accepted plan chooses nonnegative inventory, signed-delta adjustments, abstract decimal quantities, UUID commands without an idempotency table, and Staff filtered ledger privacy. Inventory supports `include_inactive=true` explicitly; product lists can omit `active` for both statuses. Full metadata PUT requires every editable field, including nullable fields; balances are never accepted. Decimal API values are strings; frontend expected-result arithmetic is a display estimate only, with server Decimal validation authoritative.

Owner and Staff Supabase login credentials remain unavailable; seed Auth UUIDs are placeholders. Real-user product/stock/completion workflows, membership/session checks, and authenticated desktop/320-pixel/mobile keyboard/focus checks are **pending**, not claimed. Map two real Supabase users to the development memberships as described in README, then run its Phase 7 smoke checklist with disposable records. Automated tests use independently verified signed tokens and isolated databases; no test mutates public business inventory.

The existing Vite warning for a chunk over 500 kB remains. No unrelated code-splitting/tooling work was added. Downgrade retains ledger rows but irreversibly discards appointment-product linkage; it is not stock reversal. Do not downgrade operational inventory as a recovery strategy.
