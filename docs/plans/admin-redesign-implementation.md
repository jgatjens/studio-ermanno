# Admin Redesign — shadcn UI/UX

## Goal and boundaries

Modernize the admin using shadcn components while preserving `../admin-spec.md`, `../responsive-spec.md`, `../architecture.md` and `../tech-stack.md`. This separate design workstream does not renumber roadmap Phase 13 or mark outstanding deployment acceptance complete.

Preserve React Router, Supabase Auth, backend-derived actors, centralized API requests and TanStack Query. Backend authorization and Staff field filtering remain authoritative. No API/schema changes, new roles, business features, authentication methods or state libraries.

## Increment 1 — Login (authorized now)

Use the official `npx shadcn@latest add login-02` block, adapting its layout to React/Vite. Keep existing shared components when offered an overwrite.

- Full-height two-column desktop page; focused single-column mobile form.
- Confirmed Minati Parrucchieri branding and the approved static storefront photograph.
- shadcn fields, labels, inputs and button; 44px controls, visible focus and password-manager autocomplete.
- Email/password only. Omit placeholder social login, signup and password recovery links.
- Preserve loading/restoration, safe errors, pending submission, membership denial/retry/logout and authenticated `/admin` redirect.
- Keep English to match the existing admin. Localization is separate.
- Implement and verify locally. Production publication is separate.

## Increment 2 — Admin navigation (implemented locally)

Reference: `npx shadcn@latest add dashboard-01`. Adapt its sidebar/inset/header to existing React Router sections. Keep only sidebar, sheet, tooltip, skeleton and icon dependencies; remove sample dashboard data, charts, tables and unrelated packages.

- Desktop: expanded sidebar with a collapse toggle.
- Tablet: initially collapsed icon rail with named tooltips and expansion toggle.
- Mobile: accessible modal drawer with close control, plus existing five daily-work shortcuts and safe-area spacing.
- Group existing routes under Daily work, Catalog and Management; organize More by the same groups.
- Preserve nested-route active states, route-change focus, website link, single logout, Owner/Staff context and all existing protected content.
- No dashboard data/layout redesign or business workflow changes in this increment. Publication remains separate.

## Increment 3 — Client list and add/edit forms (implemented locally)

Use shadcn Card, Input, Textarea, Field, Button and Skeleton, with the existing API, actor-scoped TanStack Query cache and routes.

- Search-first layout with a prominent Owner-only Add client action, clear-search control and loading/error/empty states.
- Single-column tap-friendly cards on phones; two/three-column grids on larger screens. Entire card opens the existing profile; initials are decorative, contact details appear only for Owners.
- Keep debounced server search, pagination and search/page restoration after returning from a profile.
- Add/edit forms group required first/last names, optional contact details and optional private preferences/notes. Preserve validation, field limits, POST/PUT behavior and saved-profile redirect.
- Accessible labels/autocomplete, clear Cancel/back actions, disabled pending fields and duplicate-submit guard.
- Staff remain read-only with private information hidden, including fixtures that contain private data. Profiles and visit-history presentation remain a later increment.
- Browser checks used existing local development clients and opened an empty form; no records were created or edited manually.

## Increment 4 — Client profile and deletion (implemented locally)

User explicitly requested client deletion, extending the historical Phase 4 boundary that excluded DELETE. This increment authorizes the minimal backend behavior needed for that action; no archive, cascade deletion, new schema or unrelated business features.

- shadcn profile cards for Owner-only contact details/private preferences, last completed visit and paginated visit history; Staff see permitted names/history/services/products/appointment notes only.
- Responsive stacked mobile layout and two-column desktop profile, clear Edit and Back actions, snapshot details and friendly empty states.
- Owner-only danger section after profile/history, with an accessible shadcn AlertDialog naming the client and explaining permanence.
- `DELETE /clients/{client_id}` independently requires Owner membership, derives business scope from the backend actor, returns 404 for absent/foreign records, 204 on deletion and 409 when linked to any appointment (including cancelled/no-show) or feedback.
- PostgreSQL row lock and existing restrictive foreign keys protect concurrent linking; deletion never cascades to history, feedback or inventory. No live concurrency proof was run.
- Pending confirmation cannot be submitted twice or dismissed through Cancel; failures keep the profile and show an actionable message. Success clears profile/history cache, refreshes the list and confirms deletion.
- Central API client handles empty 204 responses. No live client records were deleted during browser QA; mutation checks used disposable test fixtures.

## Increment 5 — Appointments list (implemented locally)

- shadcn Card, Input, Field, NativeSelect, Badge, Button and Skeleton provide a responsive schedule list at `/admin/appointments`.
- Prominent Owner-only Create appointment; clear Today/reset controls and paired date filters on mobile, three filter columns on larger screens.
- Cards group by business-local day and emphasize local start/end times, client, status, main service, assignment, duration and currency. Links open the existing detail screen.
- Preserve authenticated server queries, existing inclusive Through date/DST conversion, pagination, Staff privacy and read-only behavior, and existing creation/edit/completion/status workflows.
- Explicit loading, empty, retry and invalid-range states. Filter changes reset pagination; Reset restores today and all statuses.
- No backend changes, new scheduling features, or detail/form redesign in this increment.

## Subsequent increments — planned only

2. Dashboard: cards, skeletons, empty/error states and role-appropriate appointment/stock/feedback actions.
3. Existing lists/details: consistent tables/cards, search, pagination, badges and dialogs; preserve Staff privacy.
4. Existing forms: shared fields/validation, appointment conflicts and repeat-safe completion/inventory confirmations.
5. Accessibility/responsive review: focus/keyboard, touch targets, narrow screens, async states and real Owner/Staff checks.

Review each increment before implementing the next. Components must support existing workflows rather than introduce new features.

## Verification

Run TypeScript, the full frontend tests and build. Preserve existing login success/failure, restoration, logout, membership denial, Owner/Staff and 401/403 tests. Add only changed-behavior checks for autocomplete, required inputs, pending controls and duplicate-submit prevention.

Inspect local browser layout, imagery and states. Verify actual mobile width where supported; do not claim success when viewport overrides are ignored. Record limitations. Fixture checks require no real credentials. Backend tests are needed only if later work changes backend behavior.

## Reference

[Official shadcn login-02](https://ui.shadcn.com/blocks/login), checked 2026-10-05. Template links are presentation placeholders, not authorization for new auth features.

## Local verification — 2026-10-05

- TypeScript checks: passed.
- Frontend: 144 tests passed across 16 files, including four new navigation checks (nested active routes/collapse, tablet Staff access, mobile drawer navigation/focus, grouped More sections). Existing authentication and workflow suites pass.
- Production build: passed; existing >500 kB bundle warning remains (741.10 kB JavaScript, 218.76 kB gzip). No deployment performed.
- Browser: local Owner session, desktop 1440px, tablet 820px and mobile 390px inspected. Desktop/tablet had no horizontal overflow; mobile drawer opened and closed after selecting Services. Viewport override reset afterward. Staff checked with fixtures; no real Staff login performed in this increment.
- Backend unchanged; no backend test run required for this UI-only increment.

### Increment 3 verification — 2026-10-05

147 frontend tests passed in 16 files, including 16 client tests. Added clear-search, required/optional field and cancellation, and pending/duplicate-save checks. TypeScript and build passed; the existing >500 kB bundle warning remains. Local Owner list/form inspected at 390px mobile, 820px tablet and desktop; mobile/tablet horizontal overflow checks passed. Staff privacy and mutation denial were fixture-tested. Backend unchanged. No deployment performed.

### Increment 4 verification — 2026-10-05

Backend: 281 passed, 42 skipped (live-database suites require separate configuration), including 13 new deletion tests for authentication, Staff denial, business isolation, success/repeat deletion and appointment/feedback preservation. Frontend: 153 passed, including confirmation/cancel, success, conflict, Staff controls, pending duplicate deletion and 204 response handling. TypeScript and build passed; existing bundle-size warning remains. Local Owner profile and confirmation visually inspected on desktop/mobile; confirmation cancelled without deleting the linked client. Staff privacy checked by fixtures. Production remains unchanged.

### Increment 5 verification — 2026-10-05

157 frontend tests passed in 16 files, including four new schedule checks for Staff privacy/action hiding, business-local grouping across UTC midnight, status/pagination reset, and invalid dates suppressing requests. TypeScript/build passed; existing >500 kB bundle warning remains. Local Owner filters/empty state inspected on desktop and 390px mobile; no horizontal overflow. No local appointments were available in the checked 2026 range, so populated cards were verified using fixtures. No records created/changed and no deployment performed. Backend unchanged.
