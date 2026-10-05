# Phase 11 — Mobile Admin Polish

## Goal and source of truth

Make the implemented admin practical for daily phone use, without adding business features or changing authorization/domain rules. This document is a plan only. Stop before Phase 12 deployment.

Follow these sources:

- [MVP roadmap, Phase 11](../mvp-implementation-phases.md#phase-11--mobile-admin-polish)
- [Admin specification](../admin-spec.md)
- [Admin dashboard wireframe](../admin-dashboard-wireframe.md)
- [Responsive specification](../responsive-spec.md)
- [Design specification](../design-spec.md)
- [Architecture](../architecture.md), [tech stack](../tech-stack.md), [database schema](../database-schema.md)
- Existing Phase 2–9 plans and regression tests for authentication, clients, appointments, completion, inventory, feedback and availability.
- [Phase 10 verification](../phase-10-verification.md) for public-site integration boundaries, bundle sizes and remaining setup.

Where responsive docs suggest optional recent activity, charts or broader Settings entries, the dashboard wireframe and Phase 11's no-new-features boundary govern. Do not add activity feeds or settings functionality simply to fill a navigation item.

## Current foundation

React/Vite/TypeScript, React Router, Tailwind/shadcn primitives and TanStack Query are already installed. Auth/session/actor remain in React Context; drafts and transient UI state remain local. No Redux/Zustand, new component/calendar framework, persistent query cache or generic permissions framework.

`/admin` currently contains access/role probes and HealthStatus. All admin pages sit in a narrow protected layout with a wrapping navigation list. Existing routes support clients/history, appointment list/detail/create/edit/status/completion, products/inventory movements, feedback moderation, services/barbers and business hours. Reuse their APIs and backend policies.

`AdminQueryProvider` already keys its lifetime by user, membership, business and role. `useAdminKey` supplies actor-scoped resource keys. Mutations have no automatic retry; terminal authorization/validation/conflict responses are excluded from query retries. Preserve these safeguards while restructuring the shell.

The user reports creating and mapping a Supabase user. This has not yet been independently verified with login credentials, and does not establish a second Staff account. Use mapped development credentials when available; otherwise report real-user checks pending without claiming they passed.

## Scope and exclusions

Implement:

- A shared protected admin shell and mobile primary navigation.
- An operational dashboard at `/admin` with independent section states.
- Easier client search, daily appointment scanning, appointment forms/completion, inventory actions and feedback moderation on phones.
- Consistent loading, error, empty, success and confirmation presentation.
- Accessible touch targets, focus, keyboard/form interactions and responsive layout checks.
- Focused tests, regression verification, README updates and `docs/phase-11-verification.md`.

Do not add booking, new roles, customer accounts, analytics/revenue/charts, notification systems, drag-and-drop scheduling, recurrence, new calendar modes, uploads, media management, business-settings/member-management CRUD, stock rules, payment/accounting, new scheduling policies, PWA/offline support, Docker, CI/CD or deployment. No Supabase Storage or direct browser business-table access.

## Navigation and protected layout

Use one stable protected layout with an Outlet: protection outside the actor-scoped QueryClient provider, provider outside changing child routes. Navigating between admin pages must not unnecessarily destroy the cache; logout/actor/role changes must cancel/dispose private queries and drafts. Preserve anonymous-public behavior and protect unknown `/admin/*` routes.

Mobile primary destinations:

| Label     | Route/behavior                                                                         |
| --------- | -------------------------------------------------------------------------------------- |
| Dashboard | `/admin`                                                                               |
| Clients   | `/admin/clients`                                                                       |
| Calendar  | `/admin/appointments`; existing date-filtered appointment list, no new calendar engine |
| Inventory | `/admin/inventory`                                                                     |
| More      | `/admin/more`; compact secondary navigation page                                       |

More links to existing Products, Feedback, Services, Hairdressers, Business hours and Access checks. Put the current probes/HealthStatus on `/admin/access`, with role/session information and logout accessible from the shell or More. Preserve probe functionality and Owner-only controls. No empty Settings link or new Settings editor.

Use visible labels, active-route indications and familiar existing icons only if useful; icons must not replace labels. Detail/create/edit routes highlight their parent section. More highlights its secondary pages. Include useful Back links and a public-site link.

Prefer a fixed mobile bottom bar with approximately 44px minimum targets, safe-area inset padding and enough content bottom clearance that buttons, errors and final rows remain visible. On larger screens use a compact horizontal navigation or sidebar without a second workflow. Mobile menu disclosures, if used, need expanded/control state, Escape closure and focus return. Complex forms remain dedicated routes; no cramped modal redesign.

Use semantic header/nav/main, one main landmark and one h1 per page. Move focus to the page heading/main on route changes without stealing focus during typing or query refresh. Provide a skip link and visible focus. Verify bottom navigation with the phone keyboard open; never pin Save over form controls.

## Dashboard composition and data contract

Use the wireframe order:

1. Admin header, current business-local date/timezone, compact role/account controls.
2. Next active appointment.
3. Today's appointments.
4. Appointment alerts.
5. Low stock.
6. Pending feedback.

Use an honest `Admin dashboard` title unless an authenticated business-name source already exists; do not borrow identity/timezone from `/public/business`. Membership may differ from public website configuration. Owner quick actions: Create appointment and Search client. Staff can search/open readable details but has no mutation shortcuts.

Prefer existing protected APIs; no new schema or mutation endpoints are expected:

| Section                    | Existing source                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Business timezone/currency | `GET /appointments/context`, scoped to authenticated actor                                                                     |
| Today's schedule           | `GET /appointments?from=...&to=...&limit=25&offset=...`                                                                        |
| Next appointment           | Separate `status=SCHEDULED` and `status=CONFIRMED` reads, current instant through local day end, `limit=1`; compare candidates |
| Low stock                  | `GET /products?active=true&low_stock=true&limit=5&offset=0`                                                                    |
| Pending feedback           | `GET /feedback?status=PENDING&limit=1&offset=0`, using returned total                                                          |

A thin additional protected read may be considered only if a demonstrated existing contract cannot return correct data. Document that gap before adding it; do not create an aggregate dashboard service/framework or an API solely for visual layout convenience.

### Date/time and pagination correctness

Compute today in the actor's Business IANA timezone, not the browser timezone or public-site settings. Compute local day boundaries independently, convert to offset-aware instants, and reuse audited appointment time helpers. Never assume a day is 24 hours. Handle midnight folds/gaps explicitly and show a safe date-context error if conversion cannot be supported; do not silently substitute browser-local dates. Cover Rome spring/fall DST and UTC/business date differences.

The existing appointment range uses interval overlap (`scheduled_end > from`, `scheduled_start < to`). Preserve that contract: a carried-over appointment may appear in today's schedule; label its date/time clearly. Next means an ongoing or upcoming Scheduled/Confirmed appointment for the remainder of today. Label ongoing items `In progress`/`Started at`, not a future time claim. Do not include Completed/Cancelled/No Show, or display tomorrow as today's next appointment.

Do not derive an exact next appointment or whole-day count from the first mixed-status page. The two server-filtered next reads find earliest eligible candidates regardless of earlier terminal rows. Treat either next-query failure as incomplete data, not a trustworthy empty result. Today's rows remain paginated with true total and a View full schedule link; show loaded/page context rather than claiming the first page is the entire day. Low-stock and feedback summaries use filtered totals, never preview lengths as totals.

### Content and states

Appointment cards show time, client name, hairdresser or Unassigned, service summary and textual status; link to existing detail. Do not introduce per-row client/detail fetches or private contact fields into the dashboard. Use existing projections and retained appointment snapshots.

Alerts are deliberately limited to unassigned active appointments already loaded in the visible schedule, labeled as visible-page alerts when paginated. Do not claim no whole-day alerts from a partial page. Omit speculative conflict detection and configurable starts-soon thresholds; existing scheduling conflicts remain handled in appointment save responses. No new notification model.

Low stock shows name/current/minimum and an Inventory link. Owner can follow existing product inventory actions; Staff sees the summary/read links only. Empty active low-stock results say `Stock levels look good.` Pending feedback shows total and existing review-list/detail links, without exposing email to Staff. No automatic approval/publication.

Each section gets its own reserved loading state, helpful empty text and retry. Inventory/feedback failures must not blank the schedule. Timezone failure blocks date-dependent sections while unrelated summaries remain usable. Avoid raw database/stack details. On authorization failures retain existing 401 sign-in and 403 access-denied behavior.

Clock-dependent next/day data must refresh while the dashboard is visible, at local midnight and on returning to the tab. Use a small cleaned-up timer/visibility effect with existing query behavior, not polling infrastructure. Avoid whole-page loading flashes during background refresh; distinguish stale data from a failed initial load. Provide manual refresh. Test timers with fake time and cancel them on unmount.

## Existing workflow polish

### Clients and history

Keep existing role-aware debounced server search: Owner name/email/phone, Staff name only. Do not load all clients or add local private-data indexes. Preserve AbortSignal/stale-result protection, search reset pagination, distinction between empty/no matches, loading and retry. Keep the input prominent and results easy to tap; preserve search/page state for list → detail → Back where practical using route/search state rather than persistent storage.

Profile hierarchy: name → permitted contact/general notes → last visit → history. Staff never gets email/phone/private notes/visit notes or sold-product fields excluded by existing backend projections. Use readable stacked history entries with appointment notes, services and permitted product usage. No new last-visit backend computation or history policy.

### Appointment creation/editing and schedule

Keep the logical single-column order: existing client → business-local date/time → services → optional hairdresser → appointment notes → calculated totals → optional Owner overrides → Save. Separate visual Date/Time controls only if existing timezone/DST selection remains intact. Preserve preview calculation, inactive retained items, conflict details, explicit offset selection for ambiguous times and current backend capacity/hours validation.

Make checkbox/select labels tap-sized, required fields and selected client obvious, and the result/error summary readable. Disable submission during pending mutation or stale preview. Ensure preview displayed and submitted corresponds to the current draft. Retain draft and selected choices after 409/422/network errors. Client-first guidance must not silently discard an appointment draft; either give clear leave confirmation or use a scoped in-memory draft if the existing flow needs it, without a new state library or persisted private data.

Keep Today/date-filter navigation fast and rows compact. Do not add week/month calendar or drag/drop. Confirm/Cancel/No Show remain existing transitions; Completed stays in the dedicated completion workflow.

### Completion, inventory and feedback

Completion uses stacked Services performed → Products used → Products sold → Visit notes → explicit review → Complete. Keep repeat-safe tokens/attempt payloads and no automatic mutation retries. Prevent double submissions; recover from uncertain network outcomes using existing same-attempt retry behavior. Do not fabricate success, alter quantities, stock ledger behavior or history snapshots.

Inventory lists prioritize name, current/minimum and textual low-stock state. Existing Add stock/Adjustment/Damaged routes or sections should have clear quantity/reason labels and review context; amounts remain decimal strings and stock arithmetic remains backend-owned. Staff receives no mutation controls. Movement history stays readable and paginated.

Feedback list/detail show rating/name/comment/status/date. Preserve the existing reviewed moderation draft and separation of approval from public visibility. Explicitly show whether an approved review will become public. Staff reads without private email or moderation controls. Retry retains the attempted draft; no review text rewrite or automatic publishing.

## Confirmations and reusable presentation

Use a few focused shared admin primitives/helpers where they reduce repetition: page header/back action, status label, section loading/error/empty, form error summary and review/confirmation panel. Reuse existing shadcn/Button facilities and design tokens; do not build a second design system or abstract all domain forms into a generic engine.

Keep normal search/navigation/save actions short. Clear confirmation is required for appointment Cancel/No Show and existing consequential completion/stock/moderation actions where review is already part of the workflow. Reuse existing confirmations instead of nesting duplicates. Specify affected appointment/product/review and consequences; cancelling a confirmation preserves draft. Prefer inline accessible review panels or existing primitives. If a dialog is used, implement labeling, keyboard focus/return and Escape behavior.

Confirmations are UX safeguards; every mutation still independently requires backend Owner authorization. Owner UI hiding does not weaken backend 403 tests. No additional approval scheme or permissions roles.

## Accessibility, responsive behavior and performance

Acceptance widths: 320, 375/390, 768, 1280/1440. Single-column mobile cards/forms with useful wider-screen grouping. No horizontal page overflow with long client/product names, notes, decimal values or error text. No essential hover-only actions; no mobile-only/desktop-only business operations.

Targets approximately 44×44px, comfortable spacing, visible labels, correct input types, fieldsets/legends, keyboard order, visible focus and sufficient contrast. Text accompanies every status/stock/error indicator. Associate errors with fields and focus an error summary after failed submission without repeatedly announcing background requests. Native controls should remain operable with keyboard and touch. Preserve entered data while correcting errors.

Keep public Phase 10 layout/style/media isolated from admin polish. Measure production output against the current 633.42 kB JS/gzip 182.83 kB baseline. Existing React lazy route splitting is optional if measured worthwhile, with loading/error/protection regression coverage; no new bundler/tooling just to suppress a warning. Avoid per-row network calls and repeated render-time timezone scans. No persistent drafts, Auth tokens or private query data in local storage.

## Implementation sequence

1. Audit representative existing pages and capture mobile pain points; confirm mapped Owner/Staff development accounts if available.
2. Refactor the protected shell/navigation and relocate probes to Access checks without changing authorization/cache boundaries.
3. Add dashboard using existing filtered reads, exact date/next/pagination semantics and independent states.
4. Polish client search/profile and appointment list/forms/completion, retaining domain contracts and drafts.
5. Polish inventory/feedback and common status/confirmation presentation.
6. Add focused accessibility/responsive/state tests; run full regressions and browser workflows.
7. Update root README and write `docs/phase-11-verification.md` with exact files, measurements, counts and pending setup.

## Required tests and verification

Frontend focused tests:

- Shell destinations/active parent routes/More/Back, skip/focus/keyboard behavior, unknown-admin protection, logout and actor-switch cache disposal.
- Dashboard hierarchy, Owner/Staff controls and private-field absence; independent loading/error/retry/empty/refetch.
- Next appointment excludes terminal statuses, considers both active statuses, treats either query failure honestly, and is correct beyond the first mixed-status page.
- Today uses business timezone, DST-sensitive day boundaries and overlap semantics; fake-time midnight/tab-return updates; no background timers after unmount.
- Pagination/true totals and low-stock/pending summaries; alert labels accurately describe partial pages.
- Debounced/stale client search and Back behavior; draft/preview/error preservation; duplicate-submit protection.
- Completion/stock/moderation retain existing same-attempt retries and confirmations; Staff controls/fields remain absent.
- Public Home/navigation/gallery, feedback/availability and public-401 session behavior still pass.

Backend: keep all existing authentication, Staff mutation-denial/privacy, scheduling, completion, ledger, feedback, public projection and snapshot tests. Add focused backend tests only if implementation changes a read contract or backend code; no mirror tests for CSS/layout.

Before finishing implementation:

1. Run default backend `.venv/bin/python -m pytest` from `api`.
2. Run full `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest`; existing fixtures use disposable schemas. Schedule this separately from heavy browser checks: the Phase 10 simultaneous run briefly exhausted the Supabase session-pool limit of 15.
3. Run frontend `npm test`, `npm run typecheck`, `npm run build`; report actual counts/skips and bundle sizes.
4. Verify SQLAlchemy connectivity and Alembic current head (`0002_phase7` unless a justified migration is introduced; none expected), plus `/health` and anonymous public read regressions.
5. Use browser checks at planned widths for dashboard, search/history, appointment form/detail/completion, inventory and feedback. Check keyboard/focus/confirmations and bottom-bar clearance; record screenshots.
6. With real mapped Owner and Staff development credentials and explicitly disposable records, run the seven roadmap flows: find client, create appointment, today's schedule, complete appointment, review history, update inventory, moderate feedback. Verify Staff read-only/privacy and logout/session restoration. Do not mutate real business/customer data for smoke tests. If credentials/disposable setup are unavailable, cover fixtures and label browser checks pending.
7. Public-site smoke checks must still work without login. No publishing/deployment.

## Completion criteria and report

An Owner can complete all seven daily workflows comfortably on a phone using the existing feature set; Staff can navigate permitted reads with mutation/private fields absent. Dashboard correctly shows business-local operational data, pages remain usable under partial failures, all authorization/cache boundaries and Phase 0–10 regressions pass, and navigation/forms are accessible across the planned widths.

Report exactly what changed, assumptions/visual choices, any justified API changes, tests/counts, responsive/accessibility evidence, build metrics, real-user/manual checks and unresolved limitations. Do not claim manual login success from the user's statement alone. Do not continue into Phase 12.
