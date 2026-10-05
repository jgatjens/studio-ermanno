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

## Increment 6 — Inventory overview (implemented locally)

- shadcn stock cards emphasize current balance, minimum stock, low-stock and inactive badges.
- Search, low-stock/inactive filters, clear/reset controls, pagination and loading/error/empty states use the existing authenticated inventory query and actor-scoped cache.
- Owners have Create product, Manage stock and Edit product links; Staff have read-only history links without financial fields or mutation controls.
- Responsive one/two/three-column layout; matching-product totals describe the filtered result rather than global inventory health.
- Existing product detail/forms, stock-change confirmation and retry behavior remain intact. No backend changes or stock records changed during browser checks.

## Increment 7 — Product create/edit form (implemented locally)

- Shared shadcn editor for the requested `/admin/products/:id/edit` route and existing create route, grouping product information, pricing, stock settings and visibility.
- Description uses a multiline textarea; existing required fields, limits, decimal strings and API payloads remain intact.
- Current stock is read-only on edit; opening quantity remains create-only. Explicit back/cancel actions return to the appropriate existing product route.
- Preserve Owner restriction, cache refresh, retained drafts and exact-command retries. Pending saves disable fields, checkboxes and cancellation.
- No product profile/ledger redesign, backend changes, new business behavior or publication.

## Increment 8 — Services catalog (implemented locally)

- shadcn responsive service cards with duration, price and active/inactive badges; local search of the existing complete catalog by name/description, with clear and empty states.
- Owner Create service action focuses the existing shared editor; Edit preloads fields, Cancel restores the create form without writing. Grouped name/description and duration/price fields, black Save action and disabled pending controls.
- Preserve service POST/PUT/deactivation payloads, actor-scoped cache refresh, server authorization and Staff read-only access. Barbers retain their existing layout.
- No backend changes or real service mutations during browser QA; publication remains separate.

## Increment 9 — Products catalog (implemented locally)

- Reuse the inventory shadcn cards, search/filter controls, loading/error/empty states and pagination for `/admin/products`, preserving existing server queries.
- Catalog cards add description previews, active status, Owner-only public/private visibility and retail price. Black Owner Edit product action and secondary Manage stock action link to existing routes; Staff retain read-only history links without financial/settings fields.
- No backend changes, new product behavior or real mutations; existing inventory presentation remains intact.

## Increment 10 — Barbers catalog (implemented locally)

- Extend the existing shadcn catalog layout to `/admin/barbers`: name search/clear, initials, active/inactive badges and responsive cards.
- Owner create/edit form has required name, active flag and black Save action. Existing POST/PUT payloads contain only name/status; editing focuses the form and cancel does not write.
- Preserve Staff read-only access, cache isolation and activation behavior. No scheduling/availability, role changes or backend modifications.

## Increment 11 — Feedback overview (implemented locally)

- shadcn feedback cards show rating/date, status/publication badges, comment previews and links to the existing detail/moderation screen.
- Existing server status filter and pagination preserved; Show pending and empty-state Show all actions reset pagination. Skeleton/retry/empty states and matching totals added.
- Owner review links and Staff read links preserve role behavior and omit private contact data from the overview.
- No backend changes or detail/moderation workflow redesign. Approval/publication confirmation and exact-command retry remain intact.

## Increment 12 — Business hours (implemented locally)

- Responsive weekly day cards with Open/Closed and Split day badges, paired shadcn time inputs, schedule guidance and black Save week action.
- Preserve existing split-period payload compatibility, required time inputs, backend validation, whole-week save/cache refresh and Staff read-only display.
- Pending saves disable all day controls and guard duplicate submission. No backend changes or scheduling features.

## Increment 13 — Dashboard (implemented locally)

- shadcn operational dashboard with role context, business-local clock and clear appointment/client/refresh shortcuts. Full-width Create appointment action on phones.
- Main daily-work column: featured next appointment with direct detail action, start/end times, service, assignment and in-progress/status treatment; readable paginated daily agenda; accurately page-scoped unassigned alerts.
- Independent desktop follow-up column: low-stock balances and subset/total context, plus pending feedback with role-appropriate actions. Mobile/tablet keep daily work before follow-ups.
- Skeletons, helpful empty states and per-panel retry behavior preserve independent requests, actor-scoped caching, DST/local-midnight handling and clock refresh. Failed refreshes label retained data and suppress outdated all-clear messages.
- Preserve existing server queries and Staff privacy; no charts, fabricated analytics, revenue totals, backend changes or new business workflows.

## Increment 14 — feedback detail

Redesign `/admin/feedback/:feedbackId` with shadcn review and submission cards, rating stars, full multiline comments, status/publication badges and related-record links. Put Owner moderation in a separate panel with black primary buttons, explicit confirmation and Cancel review. Preserve Staff read-only access/email omission, deliberate publication, retained drafts and exact retries. Stack the layout on mobile and tablet. No backend changes or new moderation behavior.

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

### Increment 6 verification — 2026-10-05

164 frontend tests passed across 16 files, including four new inventory checks for Owner balances/actions, filter/pagination reset, Staff read-only controls and filtered empty-state behavior. TypeScript/build passed; existing >500 kB bundle warning remains. Local Owner inventory inspected on desktop, 390px mobile and 820px tablet; mobile/tablet had no horizontal overflow. Low-stock filtering and reset verified in the browser. Staff behavior checked with fixtures. No stock mutations or deployment performed. Backend unchanged.

### Increment 7 verification — 2026-10-05

168 frontend tests passed across 16 files, including two new editor checks for grouped fields/read-only stock/cancel and pending save controls. TypeScript/build passed; existing >500 kB bundle warning remains. Local Owner inspected the supplied product edit route on desktop, 390px mobile and 820px tablet; mobile/tablet overflow checks passed. Existing creation/edit/retry and Staff denial tests pass. No real product was saved during browser QA; backend unchanged and no deployment performed.

### Increment 8 verification — 2026-10-05

170 frontend tests passed in 16 files, including two new checks for description search/clear and editor focus/cancel without writes. TypeScript/build passed; existing bundle-size warning remains. Local Owner service cards and editor inspected; edit cancelled without saving. Desktop, 390px mobile and 820px tablet layouts verified; narrow-screen overflow checks passed. Staff and existing service mutation behavior fixture-tested. Backend unchanged; no deployment performed.

### Increment 9 verification — 2026-10-05

Full frontend suite: 171 passed, one failed out of 172. All 19 product tests passed, including two new Owner/Staff catalog checks. The unrelated public app loading test still expects the heading “Welcome” while concurrently updated public branding renders “I Minati Parrucchieri”; that work was preserved. TypeScript/build passed with the existing bundle-size warning. Local Owner desktop, 390px mobile and 820px tablet inspected; mobile/tablet overflow checks passed. No product records changed and no deployment performed. Backend unchanged.

### Increment 10 verification — 2026-10-05

173 frontend tests passed, one previously reported public-heading test failed out of 174. All 13 catalog/admin tests passed, including two new barber search/edit-payload and Staff read-only checks. TypeScript/build passed with the existing bundle-size warning. Desktop local Owner cards/form visually inspected. Further browser interaction and mobile/tablet checks could not finish after localhost stopped responding; restarting reported port 5173 already in use. Responsive layout reuses the previously inspected service grid. No real records changed and no deployment performed; backend unchanged.

### Increment 11 verification — 2026-10-05

176 frontend tests passed in 16 files, including two new filter/pagination and Staff overview checks; the previously reported unrelated public-heading test is now passing after concurrent changes. TypeScript/build passed with the existing bundle warning. Local Owner feedback inspected on desktop, 390px mobile and 820px tablet; narrow-screen overflow checks passed. Browser preview recovered through a fresh localhost tab and IPv6 Vite listener; no feedback moderation or records changed. Backend unchanged; no deployment performed.

### Increment 12 verification — 2026-10-05

185 frontend tests passed in 16 files, including a new pending-save control check. TypeScript/build passed; existing bundle warning remains. Local Owner desktop, 390px mobile and 820px tablet inspected with no narrow-screen horizontal overflow. Tuesday split-period fields toggled for display inspection and restored without saving. Staff/split-period behavior covered by existing fixtures. Backend unchanged; no records changed or deployment performed.

### Increment 13 verification — 2026-10-05

188 frontend tests passed across 16 files, including 17 dashboard checks. Three new tests cover featured appointment actions/private-field omission, low-stock preview versus full totals, and failed refreshes retaining data without false all-clear messages. Existing DST, midnight, partial-failure, Staff, actor-isolation, refresh and pagination checks pass. TypeScript/build passed; existing >500 kB bundle warning remains. Local Owner inspected at 1440px desktop, 820px tablet and 390px mobile with no horizontal overflow; mobile shortcut wrapping was corrected after visual review. Local schedule was empty, so populated/ongoing appointments and Staff layouts were fixture-tested. No real records changed; backend unchanged and no deployment performed.

### Increment 14 verification — 2026-10-05

189 frontend tests passed across 16 files, including a new cancel-review/draft-retention/no-write check. Existing Owner, Staff privacy, publication and exact retry tests pass. TypeScript and production build passed; the existing >500 kB bundle warning remains. Local Owner supplied detail route visually inspected on desktop, 390px mobile and 820px tablet; narrow-screen overflow checks passed. Review/Cancel verified without saving. Staff checked with fixtures. No real feedback changed; backend unchanged and no deployment performed.
