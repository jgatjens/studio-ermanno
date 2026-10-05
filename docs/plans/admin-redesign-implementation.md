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
