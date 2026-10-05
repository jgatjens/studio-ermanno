# Phase 8 verification

Implemented feedback only, using the roadmap and feedback sections of admin, website and database specs, documented in `plans/phase-8-implementation.md`. Stop before Phase 9.

## Created

- `docs/plans/phase-8-implementation.md`: implementation contract and decisions for required public fields, configured public business, Staff email privacy, independent approval/publication, API/UI and checks.
- `api/app/feedback/schemas.py`: strict submission/moderation schemas, normalized optional email, bounded trimmed text, integer rating and approved-only public visibility.
- `api/app/feedback/service.py`: configured public business resolution, forced private Pending submission, explicit role/public projections, scoped pagination/detail and serialized atomic moderation.
- `api/app/feedback/router.py`: anonymous submission/public list and protected admin list/detail/Owner moderation.
- `api/tests/test_phase8.py`: **46 cases** covering public defaults, validation/forged ownership, optional email/configuration, auth/membership/Staff denial/privacy, approval/publication/rejection, legacy invalid state filtering, tenant isolation, pagination and immutable visitor content.
- `web/src/routes/feedback.tsx`: public submission/reviews, plain-text presentation, privacy wording, loading/empty/retry/success states and uncertain receipt/draft retention.
- `web/src/admin/feedback-page.tsx`: protected status-filtered list/detail, permitted related links, Staff read-only projection, Owner confirmed moderation/publication and exact retry drafts/cache invalidation.
- `web/src/routes/feedback.test.tsx`: **six cases** for anonymous form/reviews, acknowledgement, retained drafts, plain-text safety, pagination and errors.
- `web/src/admin/feedback.test.tsx`: **eight cases** for filters, Owner/Staff visibility, separate approval/publication, rejection, safe moderation retry, refresh and error/empty states.
- This report.

## Updated

- `api/app/core/config.py`: optional UUID `PUBLIC_BUSINESS_ID`, blank-to-null normalization.
- `api/.env.example`: empty documented public-business setting, no secrets.
- Ignored local `api/.env`: added the existing seeded business UUID for development public feedback; existing values preserved and not exposed in documentation.
- `api/app/main.py`: registers feedback routes.
- `web/src/app/app.tsx`: public `/feedback`, protected `/admin/feedback` and detail, admin navigation.
- `web/src/routes/public.tsx`: feedback/reviews link; foundation health/Auth checks retained.
- `web/src/lib/api.test.ts`: **two cases** proving anonymous feedback skips session/token injection and public 401 cannot clear admin authentication.
- Root `README.md` and `docs/README.md`: configuration, workflow/API, manual checks, plan/report links.

No schema/migration, dependency, role, hosting integration, Supabase Storage, notification, permission framework, or Phase 9/10 feature was added. The existing Feedback table and email validator are reused.

## Verification

| Check                                                                 | Result                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Backend default `.venv/bin/python -m pytest -q`                       | **204 passed, 35 skipped**, 9.17 seconds; explicit live database cases skipped                                                       |
| Full backend `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest -q` | **239 passed**, no skips/warnings, 314.75 seconds                                                                                    |
| Frontend `npm test`                                                   | **91 passed**, 11 files                                                                                                              |
| TypeScript `npm run typecheck`                                        | Passed                                                                                                                               |
| Frontend `npm run build`                                              | Passed; 155 modules, JS 617.56 kB / gzip 177.52 kB                                                                                   |
| Phase 0–7 regressions                                                 | Included and passed in the full suites, including real PostgreSQL scheduling/inventory races, migration metadata and baseline checks |
| Live health                                                           | 200 `{"status":"ok"}`                                                                                                                |
| Live anonymous GET `/public/feedback`                                 | 200 `{"items":[],"total":0,"limit":25,"offset":0}` via SQLAlchemy/Supabase PostgreSQL                                                |
| Live invalid anonymous POST `/public/feedback`                        | 422; no feedback inserted                                                                                                            |
| Live protected GET `/feedback` without bearer                         | 401                                                                                                                                  |
| Browser `/feedback`                                                   | Form renders, loading resolves to “No published reviews yet”; keyboard Tab moves Name → Email                                        |
| Browser `/admin/feedback` logged out                                  | Redirects to login, email/password form rendered                                                                                     |
| Alembic current                                                       | `0002_phase7 (head)`; no migration needed                                                                                            |

All new mutations are tested against isolated databases. No feedback submission or moderation was performed on real development business records. The only local setup change is ignored public-business configuration. The frontend error-state test allows the existing TanStack Query retry delay to finish before asserting the error; production retry behavior is unchanged.

## Decisions and remaining manual work

Specs leave required submission fields and Staff feedback projection open. Name/rating/comment are required, email optional/private; Staff reads feedback moderation context and permitted client/appointment references, without email or mutation access. Anonymous submissions are unverified visitor content; no automatic client/appointment association is made. Ownership is configured server-side for public routes and membership-derived for admin routes. Public lists require approval AND visibility even if legacy database records have inconsistent flags.

Public submission POST is intentionally not idempotent: no automatic retry, retained draft and duplicate warning on uncertain receipt. Moderation only assigns status/visibility and can safely repeat. Approved-private, Pending, and Rejected entries are never public. Feedback content/relationships remain uneditable through Phase 8 endpoints. Public data loads when revisiting the route; no persistent private cache/drafts.

Real Owner/Staff credentials remain unavailable. The README real-user moderation workflow and authenticated desktop/mobile/320-pixel/focus checks are **pending**, not claimed. Map real Supabase identities to memberships and test with disposable feedback. Successful submission/moderation are verified through signed-token automated tests; browser smoke checks are read-only and validation-only. No production abuse-control infrastructure was introduced; deployment should assess anonymous endpoint exposure.

The existing Vite chunk-over-500-kB warning remains; no unrelated code splitting or tooling was added. Phase 9 public availability remains deferred.
