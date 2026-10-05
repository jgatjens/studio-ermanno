# Phase 1 implementation and verification

Source of truth: `docs/plans/phase-1-implementation.md`, together with `docs/database-schema.md`, `docs/architecture.md`, and `docs/tech-stack.md`.

## Implemented

- All 12 required SQLAlchemy models: Business, AdminMembership, Hairdresser, Client, Service, Appointment, AppointmentService, Product, AppointmentProduct, InventoryMovement, Feedback, and BusinessHours.
- Frozen initial Alembic migration `0001_phase1`, with upgrade and reverse-order downgrade.
- UUID identifiers and explicit business ownership. Composite foreign keys reject references between different businesses. Restrictive deletion preserves referenced records.
- Stored service/product snapshots and distinct calculated/final duration and price fields.
- Check constraints for enum values, non-negative durations/prices/minimum stock, rating 1–5, valid weekdays and opening times. Membership identity, business/day schedules, and per-business non-null SKUs are unique.
- Deterministic, development-only seed with one business, two owner memberships, one staff membership, two active hairdressers, five clients, four services, four products, and seven business-hours rows. Reruns preserve existing edits and add only missing deterministic records.
- Live PostgreSQL tests in disposable schemas, covering migrations, metadata parity, ownership, relationships, snapshots, defaults, constraints, seed idempotency and production refusal.
- RLS enabled without policies on all application tables to protect the FastAPI data boundary from Supabase browser data access. No browser business-data code or authorization workflows added.

## Files created

- `api/app/db/models.py`
- `api/app/db/seed.py`
- `api/migrations/versions/0001_phase1_phase_1_persistent_data_foundation.py`
- `api/tests/test_phase1.py`
- `docs/phase-1-verification.md`

## Files updated

- `api/app/core/config.py`: validated IANA `SEED_TIMEZONE` setting.
- `api/.env.example`: non-secret timezone example.
- `api/migrations/env.py`: registered model metadata and supported test-supplied connections/version schemas.
- `api/alembic.ini`: explicit path separator.
- `api/pytest.ini`: live database marker.
- `api/tests/test_foundation.py`: invalid timezone validation.
- `README.md`: migration, seed, and full database-test commands and conventions.

Frontend source and existing credentials were not changed.

## Decisions and assumptions

- The supplied Supabase project is the development database. Its public schema was inspected and contained no tables before migration work.
- Keep Phase 1 models in one `app/db/models.py` module rather than creating empty domain service/router/repository modules. Domain workflows belong to later phases.
- Membership identity is a UUID reference to externally owned Supabase Auth. No foreign key to `auth.users` is created, because the spec requires placeholder identities without provisioning Auth accounts. No identity profile is duplicated.
- Seed placeholder UUIDs are generated with UUIDv5 from namespace `bf93ed0e-17fb-49f1-b4a4-0c4ae0fa6574` and names `auth:owner-1`, `auth:owner-2`, `auth:staff-1`; these can be inspected in `AUTH_USER_IDS`.
- Timestamps use PostgreSQL timezone-aware columns. SQLAlchemy sets `updated_at` on ORM updates; direct SQL writers must set it explicitly. No triggers or soft deletes added.
- Money uses decimal `(12,2)` values; quantities and stock use `(12,3)` so partial product usage is representable. Inventory movements store signed deltas; they do not modify stock automatically.
- Weekdays use Monday=0 through Sunday=6; times are local to the business timezone. No split shifts or overnight schedules.
- Enums are VARCHAR columns with database CHECK constraints, avoiding separate PostgreSQL enum lifecycle management.
- Migration downgrade testing only deletes disposable test schemas. Development/public data is not downgraded or reset.

## Verification results (2026-10-03)

| Check                                      | Result                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Backend suite with RUN_DATABASE_TESTS=1    | PASS: 23 tests, including 19 live PostgreSQL cases; no skips or warnings                                      |
| Clean-schema upgrade → downgrade → upgrade | PASS in isolated Supabase PostgreSQL schema                                                                   |
| Migration head                             | PASS: 0001_phase1                                                                                             |
| Migration/model parity                     | PASS: compare_metadata returned no differences; alembic check reported no new operations                      |
| All application tables use RLS             | PASS: 12 protected tables in test and development schemas                                                     |
| Development/public migration               | PASS: applied to previously empty schema                                                                      |
| Seed CLI run twice                         | PASS: same deterministic records, no duplicates                                                               |
| Development seed record counts             | PASS: Business 1; memberships 3 (Owner 2, Staff 1); Hairdresser 2; Client 5; Service 4; Product 4; BusinessHours 7 |
| No seeded appointment/feedback workflows   | PASS: appointments 0, feedback 0                                                                              |
| Database read-only SELECT 1                | PASS                                                                                                          |
| Test schema cleanup                        | PASS: zero phase1_test_* schemas remain                                                                       |
| Frontend TypeScript                        | PASS                                                                                                          |
| Frontend tests                             | PASS: 4 tests                                                                                                 |
| Frontend production build                  | PASS with existing non-fatal bundle-size warning                                                              |
| Live GET /health and CORS                  | PASS: HTTP 200, {"status":"ok"}, configured frontend origin allowed                                           |

The live schema contains only the 12 application tables plus Alembic's version table. The production seed guard, seed edit preservation, and snapshot preservation after catalog edits are covered by the passing suite. No Supabase Auth users were created. The pre-existing frontend bundle-size warning and Phase 0 dependency audit findings remain; no new packages or deferred tooling were added.

No authentication flow, token validation, business endpoints, overlap/availability logic, stock workflow, frontend business screens, deployment tooling, or Phase 2 work is included.
