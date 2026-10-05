# Phase 3 implementation and verification

Implemented from the Phase 3 roadmap in `docs/mvp-implementation-phases.md` and the existing architecture/admin/schema docs. There was no detailed Phase 3 plan, so `docs/plans/phase-3-implementation.md` records the bounded implementation scope.

## Changes

Created:

- `api/app/services/__init__.py`, `api/app/services/router.py`: business-scoped lists, active filter, Owner create/update with activation flag, validation, and no deletion.
- `api/app/barbers/__init__.py`, `api/app/barbers/router.py`: equivalent barber configuration without schedules or service mappings.
- `api/app/business_hours/__init__.py`, `api/app/business_hours/router.py`: scoped weekly read and atomic Owner save, unique complete weekday validation, closed-day null times, and per-business writer locking.
- `api/tests/test_phase3.py`: 12 cases covering authentication, Staff mutation denial, business isolation, inactive retention, input validation, and weekly atomicity. Real JWT/JWKS and SQLAlchemy membership fixtures are reused from Phase 2.
- `web/src/admin/query-provider.tsx`: TanStack Query client scoped to the backend actor and disposed on protected-tree unmount or actor change. No persistent private cache.
- `web/src/admin/catalog-page.tsx`: services/barbers mobile-first lists, loading/error/empty states, Owner create/edit/activate/deactivate, and Staff read-only views. Form drafts are local React state.
- `web/src/admin/hours-page.tsx`: shared weekly schedule with Owner form and Staff read-only display.
- `web/src/admin/admin.test.tsx`: six tests covering role rendering, mutations/refetch, deactivation, cache separation, and hours read-only UI.
- `docs/plans/phase-3-implementation.md` and this report.

Updated:

- `api/app/main.py`: registered the three routers and allowed PUT in environment-based CORS.
- `web/src/app/app.tsx`: protected admin routes and configuration navigation.
- `web/package.json` and `web/package-lock.json`: added TanStack Query v5.
- `docs/architecture.md` and `docs/tech-stack.md`: recorded accepted state-management decision.
- `README.md`: Phase 3 setup, routes, APIs, and conventions.

Auth remains in React Context. Business ID/role come exclusively from membership. Backend Owner authorization applies to every mutation. Active records can be queried while inactive records remain retained. Existing models and migrations are reused; no new tables or live sample mutations were added.

## Assumptions

- “Continue” means proceed to the next roadmap phase, Services/Barbers/Business Hours, with the accepted state-management decision.
- Full-record PUT is used for catalog updates; activation changes send the complete permitted record fields. Extra ownership fields are rejected.
- Service duration must be a positive integer for usable appointment configuration; price is nonnegative with at most two decimal places.
- Weekly updates contain seven distinct days, Monday=0 through Sunday=6. Times are local to Business.timezone. No split/overnight schedules.
- No real development Owner/Staff sign-in credentials are available. Authenticated screen/API behavior is tested through fixtures; real-user manual validation from Phase 2 still requires linking Supabase users to seeded memberships.

## Verification (2026-10-04)

| Check                                                                     | Result                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend: `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` from `api` | 59 passed, no skips; includes 24 auth, 4 foundation, 19 live PostgreSQL Phase 1, and 12 Phase 3 cases |
| Frontend: `npm test` from `web`                                           | 29 passed, including all previous-phase tests and 6 admin tests                                       |
| TypeScript: `npm run typecheck`                                           | Passed                                                                                                |
| Production frontend: `npm run build`                                      | Passed                                                                                                |
| Live `GET /health`                                                        | 200, `{"status":"ok"}`                                                                                |
| Live unauthenticated services, barbers, and business-hours reads          | All returned 401                                                                                      |
| Browser `/admin/services` without a session                               | Redirected to `/login`; email/password login form displayed                                           |
| Browser public page                                                       | API Status: Connected; Supabase Auth client: Initialized                                              |

The PostgreSQL regression suite verified connectivity, migration roundtrip, schema metadata, and seeding using disposable test schemas. No Phase 3 migration is needed.

Real Owner and Staff Supabase sign-in remains unverified because development user credentials and membership mapping were not provided. Follow the existing README setup to link these users, then verify the authenticated screens against the live backend.

The build reported a nonfatal JavaScript chunk-size warning (568.43 kB, 166.52 kB gzipped). Dependency installation retained two pre-existing moderate audit findings; no forced dependency upgrades were applied.

No clients, appointments, inventory, feedback, availability, public business sections, new roles, Redux, Zustand, deployment tooling, or Phase 4 work was added.

State-management behavior follows the [TanStack Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).
