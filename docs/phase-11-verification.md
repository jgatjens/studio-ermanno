# Phase 11 verification

Implemented 2026-10-05 from `docs/plans/phase-11-implementation.md`, following the roadmap, admin dashboard wireframe and design/responsive specifications. This is mobile admin polish of existing features; no Phase 12/deployment work.

## Created

- `docs/plans/phase-11-implementation.md`: scope, API reuse, date/pagination/privacy decisions, workflow and acceptance plan.
- `web/src/admin/layout.tsx`: one stable protected shell/Outlet, actor-scoped provider, bottom/desktop navigation, More, route-parent highlighting, focus, skip link, logout and public link.
- `web/src/admin/dashboard.tsx`: independently loaded operational dashboard, business-local boundaries, active next queries, paginated today rows, visible-page alerts, filtered stock/feedback totals, manual/visible-clock refresh and safe states.
- `web/src/admin/form-error.tsx`: focused submission error summary with optional field-description ID.
- `web/src/admin/dashboard.test.tsx`: 14 focused dashboard/layout/cache/timezone/error/role/refresh tests.
- This report.

## Updated

- `web/src/app/app.tsx`: nested public/private route layouts, Dashboard at `/admin`, More at `/admin/more`, diagnostics at `/admin/access`; login and unknown-admin protection preserved.
- `web/src/routes/admin.tsx`: probes/health retained, duplicate logout removed because the shell owns logout.
- `web/src/admin/clients-page.tsx`: search/page preserved in route query state and profile Back link; required-field error association/focus.
- `web/src/admin/appointments/pages.tsx`: totals before overrides, date error association, explicit dirty-draft leave review for client creation, focused submission errors, contextual status confirmation and visually distinct Cancel/No Show.
- `web/src/index.css`: scoped neutral admin presentation, approximately 44px targets, visible focus, stacked cards/forms/checkbox labels, safe-area navigation/clearance, readable states/review panels, primary/destructive actions and desktop adaptation. Public styles remain separate.
- `web/src/auth/auth.test.tsx`: probe-based assertions now use `/admin/access`; post-login assertion checks the shell's Owner state. Existing identity, logout, 401/403 and restoration assertions remain.
- `web/src/admin/clients.test.tsx`: adds profile/Back search-page preservation.
- `web/src/admin/appointments/pages.test.tsx`: adds dirty-draft leave/cancel and submission-error focus verification.
- Root `README.md` and `docs/README.md`: accurate current entry points, setup/testing/scope and verification references.

No backend code, migrations, dependency lockfiles or environment settings changed. No permissions expansion, direct Supabase business-table reads, Storage, new calendar engine, notifications, charts, settings CRUD or deployment tooling.

## Behavior and assumptions

Dashboard uses the actor's protected `/appointments/context`; it does not borrow public business identity. An `Admin dashboard` title is used because authenticated context currently exposes timezone/currency, not name. Today is computed in the Business IANA timezone; independently converted boundaries account for 23/25-hour DST days. Unsupported midnight/date context yields a safe error, without guessing dates.

Next uses separate server-filtered Scheduled/Confirmed requests with `limit=1`, exact current instant and local day end. It considers ongoing items and labels them In progress; terminal statuses are excluded. Either next-query failure is treated as incomplete, not an empty success. Today uses existing overlap semantics and pagination/true total; carried-over appointment dates are shown. Alerts are explicitly limited to unassigned active appointments on the visible page, not invented whole-day conflict counts. Low stock is active products only, count from filtered total, up to five previews; pending feedback uses filtered total.

Each section has its own initial loading/error/retry/empty state. Failed background reads can show last-loaded data with an explicit message. Manual refresh invalidates appointment resources and refreshes summaries; clock updates when visible and on visibility return, with cleanup on unmount and local-day page reset. Existing query invalidations after appointment/completion/stock/moderation changes cover dashboard resources. No per-row API fetches or browser stock calculations.

The shell's primary destinations are Dashboard, Clients, Calendar (existing appointments list), Inventory and More. More exposes existing secondary resources and Access checks. Staff has readable operational links, no mutation shortcuts and no private contact/history fields added. Backend remains authoritative. Client search URL state contains the existing search term/page; no persistent private cache/draft storage was added.

Appointment client-first navigation now requires explicit acknowledgement when it would discard a draft; cancelling that review preserves it. A draft is not persisted after choosing Leave. Existing completion, inventory and feedback review/idempotency flows are retained and receive scoped mobile styling; no new command or domain policy was introduced. Public website photos and confirmed Grigno street address are unchanged.

## Automated results

| Check                                           | Result                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| Default backend `.venv/bin/python -m pytest -q` | 245 passed, 36 database tests skipped, 11.57 seconds |
| Full isolated PostgreSQL backend suite          | 281 passed, no skips, 529.65 seconds                 |
| Frontend `npm test -- --reporter=dot`           | 127 passed across 14 files                           |
| TypeScript `npm run typecheck`                  | Passed                                               |
| Production `npm run build`                      | Passed; final sizes recorded below                   |

Frontend coverage adds timezone/DST/date mismatch, active next beyond a terminal first page, ongoing labels, partial errors, exact totals/pagination, Staff shortcuts/privacy, midnight/visibility/timer cleanup, invalid timezone, manual refresh, navigation/focus, stable cache across child navigation and actor-switch isolation. Existing Phase 0–10 tests remain. Tests also prove search-page restoration, draft-leave cancellation and error-summary focus. Existing completion/inventory/moderation repeat-safe tests are retained.

## Browser evidence and limits

The real `/admin` route redirected to `/login`, confirming protection. The user reports a mapped Owner account and is creating a Staff account; real sessions/credentials were not available to the agent during the initial checks. Do not equate that statement or fixture previews with successful real Supabase login.

For visual verification only, a temporary Vitest artifact generator rendered the real App with synthetic API/Auth fixtures into labeled static HTML previews. It was removed, along with all temporary HTML from `web/public`, before final build. No fixture auth bypass or preview route is shipped. These static previews verify layout/semantics, not real interactive login or mutations; interactive behavior is covered in Vitest and real-user smoke checks remain pending until accounts/session access are available.

Ten fixture pages: Dashboard, Clients, Profile, appointment create/detail/completion, Inventory, stock detail, feedback detail and More. All were inspected at 320, 375, 390, 768, 1280, 1440: 60 checks, no horizontal document overflow, one h1 per page, bottom-navigation targets >=44px. Long synthetic client/product names and review text wrapped. Visual inspection caught an inherited logout-button text/background contrast issue; explicit scoped button colors fixed it. The final fixture screenshot is `/tmp/phase-11-dashboard.jpg`, visibly labeled synthetic/no real authentication.

A reduced 390×450 viewport checked the appointment form after scrolling to its bottom: Save bottom about 338px versus navigation top about 392px, no overflow. This tests reduced-height clearance, not a real phone keyboard. Actual phone-keyboard behavior and screen-reader use remain manual checks; no formal accessibility audit is claimed. Temporary viewport overrides were reset.

Remaining real-user checklist with mapped development accounts/disposable data: Owner find client → create appointment → today → complete → history → stock movement → feedback moderation; Staff readable views/private-field omission/403 on mutations; logout/session restoration; touch keyboard and real device comfort. Do not use real customer/business mutations for smoke tests.

## Final live checks and real Staff session

Alembic connected and reported `0002_phase7 (head)`. SQLAlchemy connectivity is proven by the complete PostgreSQL suite and final anonymous business/catalog/feedback/availability reads. `/health` returned 200/ok; all five public reads returned 200, invalid product pagination returned 422 and unauthenticated `/services`, `/products`, `/auth/me` returned 401. Checks ran after database fixtures finished.

A real Staff session became available through local sign-in. Browser checks verified:

- Session restoration across full reload/navigation; dashboard showed Staff access and no Create appointment shortcut.
- Readable client list and a seeded client profile with contact/general notes and edit controls absent.
- Direct navigation to appointment creation displayed Access denied.
- Actual bearer-authenticated `/auth/test-read` succeeded through the Access checks UI.
- Actual `/auth/test-client-visibility` response contained only name/appointment_history and no email, phone, private_notes or visit_notes keys.
- Logout redirected to `/login`; subsequent `/admin` access remained protected.
- Dashboard at 390px had no horizontal overflow. Screenshot: `/tmp/phase-11-staff-access.jpg`.

The authenticated tests above use an actual Supabase session, unlike the earlier layout fixtures. Staff mutation API 403 coverage remains automated signed-fixture coverage; no actual business mutation was attempted. Real Owner browser checks are pending local sign-in. No password/token was copied into scripts, source or reports.

Final production output: JS 643.04 kB (gzip 185.91 kB), CSS 19.20 kB (gzip 4.87 kB), HTML 0.44 kB (gzip 0.30 kB), 162 modules. Phase 10 baseline was JS 633.42 kB (gzip 182.83 kB). The >500kB bundle warning remains; no route splitting was introduced. No temporary fixture generator/HTML is present in source or the production build.
