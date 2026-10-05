# Phase 10 — Public Website Implementation

## Goal and sources

Complete the customer-facing website using the validated Phase 0–9 foundation. This is an implementation plan only; no runtime changes are included in this planning task. Stop before Phase 11 admin polish and Phase 12 deployment.

Follow:

- [MVP roadmap, Phase 10](../mvp-implementation-phases.md)
- [Public website specification](../website-spec.md)
- [Public Home wireframe](../home-page-wireframe.md)
- [Design specification](../design-spec.md)
- [Responsive specification](../responsive-spec.md)
- [Architecture](../architecture.md), [tech stack](../tech-stack.md), and [database schema](../database-schema.md)
- [Phase 8 feedback](phase-8-implementation.md) and [Phase 9 availability](phase-9-implementation.md)

The Home wireframe supplies the concrete section order where the responsive/design docs give alternative examples. Use existing React/Vite/TypeScript, React Router, Tailwind/shadcn where useful, FastAPI/Pydantic/SQLAlchemy and Supabase PostgreSQL/Auth. Backend remains hosting-provider independent. Supabase browser access remains Auth only.

## Scope

Implement:

- A real public Home page and shared responsive public header/footer.
- Public Services, Products, Gallery, FAQ and Contact/location pages.
- Public business/contact/hours and catalog read endpoints with explicit safe projections.
- Integration of existing public availability and feedback routes into the public layout.
- Home previews for services, gallery, public products and approved/public feedback.
- Static frontend gallery/hero asset organization, approved copy and contact links.
- Minimal route metadata, accessibility, responsive behavior, and public-page performance work.
- Privacy/regression tests, local browser checks, setup documentation and a Phase 10 verification report.

Do not add online booking, customer accounts/history, payment/e-commerce, cart, stock availability claims, customer cancellation, notifications/live chat, new admin/business-settings CRUD, uploads/media tables, Supabase Storage, per-barber public views, a CMS, generic permissions/state/cache frameworks, SSR framework migration, Docker, CI/CD or deployment infrastructure. Do not implement Phase 11 admin navigation/dashboard redesign.

## Existing implementation and integration boundaries

The current `/` is a technical foundation placeholder. Replace its customer presentation with Home. Existing `/availability` and `/feedback` already implement their domain rules; reuse them and their tests, changing presentation only as needed for the public shell. `/login` and `/admin/*` keep their authentication, membership, role filtering and actor-scoped cache boundaries.

Existing public endpoints:

| Endpoint | Reuse |
| --- | --- |
| `GET /public/availability` | Phase 9 date/interval states, business-local defaults, timezone/DST, no-store snapshot behavior |
| `GET /public/feedback` | Phase 8 approved AND public reviews only, paginated private-field-free projection |
| `POST /public/feedback` | Phase 8 visitor fields, Pending/private defaults, no association and no automatic retries |

Do not call protected `/services`, `/products`, `/business-hours`, client/appointment APIs or `/auth/me` to populate public pages. Do not calculate public availability from browser data or change Phase 9 thresholds. Home uses an availability CTA rather than adding a second calendar or a fabricated “next available” claim.

Retain `GET /health` and its focused frontend component/tests. Move technical API/Auth initialization labels out of customer Home; keep the health component available on the existing authenticated admin access/probe page for local integration checks. Update the old Home placeholder assertion intentionally; do not discard Phase 0 health coverage or weaken protected-route tests.

## Route and layout contract

| Route | Content |
| --- | --- |
| `/` | Home in the wireframe order |
| `/services` | All active public services, paginated cards |
| `/products` | All active, explicitly public products, paginated informational cards |
| `/gallery` | Static frontend asset grid and captions |
| `/availability` | Existing Phase 9 date/interval view |
| `/feedback` | Existing Phase 8 reviews and submission form |
| `/faq` | Short static approved question/answer list |
| `/contact` | Configured contacts, weekly hours, address/location view and directions |

Use a small public layout with semantic header/main/footer and an Outlet, alongside the existing login/admin layouts. Public container widths can expand for desktop imagery/grids without changing admin form widths. Avoid nested mains or duplicated Public/Admin placeholder navigation. Keep login accessible through a discreet Staff login link; customer navigation prioritizes Services, Products, Gallery, Availability and Contact, with FAQ/Feedback in menu/footer. Public navigation uses normal links and clearly marks the current route. A public not-found page provides Home/contact navigation; preserve private route protection, including unknown admin subpaths.

Mobile menu: labeled button with expanded/control state, keyboard-accessible links, close on navigation, Escape closes and returns focus. Prefer a small inline disclosure over introducing a focus-trap/menu library. Include a skip-to-main link; use one h1 per page and consistent heading hierarchy. All public routes remain usable without login or a configured Supabase Auth client.

## New public API contract

Reuse backend `PUBLIC_BUSINESS_ID` from Phases 8/9. Missing or nonexistent configuration returns a safe 503, never a first-business fallback. Each query explicitly scopes to this business. Browser-supplied business IDs, roles and filters must never override scope/public visibility. No public detail or mutation endpoints are needed for catalogs.

Keep focused public read routers/services and schemas, for example `app/public/`; do not expand protected catalog routers into an unfiltered anonymous mode. Reuse existing settings/session infrastructure. A small shared configured-business resolver may replace duplicated resolution only if existing feedback/availability errors, transaction snapshot ordering and tests remain intact. No resolver refactor is required just to deliver Phase 10.

### `GET /public/business`

Explicit projection:

```text
name, description, address, phone, email, whatsapp, instagram,
timezone, currency,
hours: [{day_of_week, opening_time, closing_time, is_closed}]
```

Name/timezone/currency come from Business; optional content is nullable. No business/membership/auth identifiers, internal timestamps, barbers, admin settings or client/contact records. “Contact information” here means the configured Business fields only.

Return seven weekday entries in Monday–Sunday order. Missing stored weekdays are represented as closed, matching Phase 9's missing-hours behavior. Closed entries have null times. Preserve configured local opening/closing times; do not infer holidays, schedules or hours from appointments. Mark the timezone beside hours. Missing address/contact channels remain absent, without invented values. The API is read-only; production business-content setup remains a documented database/configuration task.

### `GET /public/services?limit=25&offset=0`

Response `{items,total,limit,offset}`. `limit` 1–100, `offset` >= 0. Server filter is always configured business AND `is_active=true`, before count/pagination. Stable name/ID ordering internally.

Item projection: `name, description, duration_minutes, price`. Price is a Decimal string; currency comes from public business. No business/internal IDs or status/settings fields. No client-supplied `active=false` can expose inactive records. No search/advanced filtering is required.

### `GET /public/products?limit=25&offset=0`

Same pagination/order. Filter configured business AND `is_active=true` AND `is_public=true`, before count/pagination. Both conditions are mandatory even for inconsistent historical records.

Item projection: `name, brand, category, description, retail_price`. Retail price is a Decimal string; currency comes from business. Never return cost price, current/minimum stock, low-stock flags, SKU, inventory history, supplier data, admin flags, internal IDs or timestamps. Frontend hiding is not the privacy boundary. Public visibility does not imply a purchasable/in-stock product; present an informational catalog only.

Use `Cache-Control: no-store` for new public reads initially, consistent with public visibility changes taking effect on the next fetch. No CDN/private-data caching layer. The frontend refetches on route visit/manual retry; existing visibility/race semantics are unchanged. Public requests use the centralized API client with `protected:false` and AbortSignal, never bearer/session loading.

## Home composition and data states

Follow this order:

1. Header.
2. Hero: configured business name/description, primary Check Availability, secondary View Services/contact, one static image when available.
3. Featured Services: first three active service cards and View All Services.
4. Availability CTA: informational explanation and existing availability route.
5. Gallery Preview: up to four approved static assets and View Gallery.
6. Featured Products: first three active/public products and View Products.
7. Customer Feedback: up to three existing approved/public reviews and Feedback/reviews link.
8. Location + Contact: configured actions, address and weekly hours, Contact/directions link.
9. FAQ: small approved static selection and full FAQ link.
10. Footer.

“Featured” means the first items in existing deterministic ordering; no featured database flags/admin controls or merchandising model. No live-stock labels or fabricated testimonials.

Fetch independent sections independently/concurrently. A product/review failure must not blank the entire Home page or block static navigation/availability CTA. Reserve skeleton/layout space and provide focused retry messages. Hide empty Home product/review sections as required by the wireframe. Dedicated catalog/review routes show helpful public empty states. No services means a contact prompt rather than invented services/prices. Business-load failure must keep the navigation/static shell usable and withhold data-dependent contacts, prices with uncertain currency and map actions until context is available; do not guess identity/location/currency.

Use existing public-request patterns/local state and small reusable components/helpers. Public content needs no Redux or new TanStack provider/cache architecture. Do not persist reviews/drafts/private data in local storage. Existing admin QueryClient isolation and public 401 behavior remain tested.

## Content and static media

There are currently no supplied business hero/gallery files in the repository. Asset and content readiness is a real implementation input, not a reason to invent claims.

Create a small frontend content module/manifest for static marketing/FAQ text and hero/gallery asset references, alt text and captions. Place approved images under `web/src/assets/` or `web/public/images/` and deploy them with the frontend. No FastAPI image endpoints, database media entity, remote hotlinks or Supabase Storage. Use descriptive names, recorded source/usage permission, meaningful alt text and reserved aspect ratios. Gallery assets should represent the actual business's work; do not pass stock or generated imagery off as real customer results or premises.

During implementation, request supplied/approved photography and factual copy if still unavailable, while continuing independent API/layout work. Use a deliberate image-free hero and public-friendly gallery unavailable state until actual approved assets exist; no broken images, fake before/after work, Lorem ipsum or seeded sample contact details presented as production facts. If assets remain missing at handoff, document the gallery/hero content gap and do not claim photography/content readiness complete. Real photography is not required to run/test the functional pages locally.

Use optimized WebP/AVIF or appropriately sized existing formats, width/height or aspect-ratio reservation, responsive sources where useful, and lazy loading below the fold. Do not lazy-load the primary hero image when present. Avoid hero/testimonial carousels, heavy animation, custom illustration systems, image pipelines or new image libraries unless a concrete asset task requires them.

FAQ content is static and reviewed: explain checking informational availability, contacting the business to arrange a visit, published service duration/price guidance, and feedback moderation/privacy. Do not assert accepted payment methods, walk-in policy, cancellation fees, opening exceptions or guarantees without business-supplied confirmation. Use native details/summary or simple accessible stacked questions.

## Contact and location decisions

Show only intentionally configured business channels. Preserve labels as plain escaped text; construct links with focused validation/encoding rather than trusting arbitrary URL strings:

- Phone: `tel:` from a normalized usable phone number; no link for malformed/unconfigured values.
- Email: validated configured business email with an encoded `mailto:` value.
- WhatsApp: configured phone normalized to digits for its fixed HTTPS destination; do not substitute an unrelated website or build arbitrary protocols.
- Instagram: support a valid handle or a validated HTTPS Instagram profile URL; fixed allowlisted hostname/profile pattern, no `javascript:`/arbitrary-domain navigation.
- Address: readable location card and an HTTPS Google Maps directions/search link built from the encoded configured address. Hide directions when address is absent.

Choose an address/location view plus outbound directions for MVP, satisfying the specification's “map or location view.” Do not add an embedded map, SDK, API key, geocoding service or third-party map request on page load. Visitors choose to open the map link; address/contact text remains usable if the external map is unavailable. Verify the provider's official URL contract during implementation before finalizing links. External links that open a new tab use safe rel attributes and understandable labels.

No business content-editing UI is added. Existing seeded name/contact/address are development fixtures, not approved production branding; replacing them is a documented content setup requirement.

## Design, responsiveness, accessibility and SEO

Visual direction: modern, clean, warm and professional; spacious readable hierarchy, restrained accent, consistent surfaces/borders and typography. Public photography can be stronger than admin styling. Avoid dark barbershop clichés, excessive gradients, hero carousels and a second design system. Reuse existing primitives/tokens where practical; adjustments must not regress admin contrast/layout.

Acceptance widths: 320, 375/390, 768 and 1280/1440 pixels. Stacked cards on phones, fluid 2–4-column grids where space permits, consistent semantic order, no horizontal page overflow. Contact/menu/button targets should be approximately 44 pixels or larger. Test long business/product names, long addresses, multiline reviews and missing fields. Prices use configured currency/locale formatting for display only; persisted decimal values remain strings. Unknown/invalid currency displays a safe explicit price/code fallback rather than crashing.

Verify keyboard navigation, mobile menu Escape/focus return, visible focus, native FAQ controls, labels, skip link, heading hierarchy, image alt and non-color status labels. Reuse existing availability/feedback form privacy and validation behavior.

Minimal SPA SEO: route-specific document title and description, meaningful semantic business/service/location content, and removal of foundation-placeholder metadata. Do not put client/admin data into metadata. Add static fallback metadata in index.html; document that client-rendered dynamic content may need later prerendering for fuller crawlability. Do not promise SSR/search ranking or add an SSR framework, SEO dependency, guessed canonical deployment URL, or search-index integration. Production canonical/social imagery/robots/sitemap details are finalized with the actual public hostname in Phase 12. Ensure unknown public routes show a useful not-found state; no admin indexing claims without server/deployment configuration.

Performance: optimize supplied static images and avoid repeated Home requests or unnecessary effects. Measure the existing roughly 622 kB JS bundle warning. Splitting the admin route bundle with existing React.lazy/Suspense/dynamic imports is allowed if it demonstrably reduces the public initial load, without new tooling or changed auth/cache semantics; no unrelated bundler rewrite. All split paths need loading/error/regression coverage. Report actual production chunk/image sizes instead of assuming the warning disappeared.

## Required tests

Backend, using existing pytest/disposable SQLAlchemy fixtures:

- Anonymous business/services/products reads work without Auth configuration/token or membership.
- Missing/foreign configured public business returns safe 503; forged query business/role/active/public values cannot override scope/filtering.
- Only active services; only active AND public products; filtered total/pagination/order across mixed/foreign records.
- Exact response-field allowlists, including absence of inventory/cost/SKU/internal IDs and private records.
- Decimal strings, nullable descriptions/contact values, safe business contact projection, weekday order and missing/closed hours handling.
- No new anonymous catalog mutations; protected admin endpoints still return 401/403 as appropriate.
- Owner catalog activation/public-flag changes are reflected on subsequent public reads without modifying stock/history.
- Existing feedback public intersection/private projection and availability privacy/timezone/snapshot behavior still pass.

Frontend, using existing Vitest/RTL/API tests:

- Public route/layout/navigation/not-found rendering; admin/login protection and cache isolation unchanged.
- Home section order, CTA destinations, empty product/review sections hidden, independent loading/error/retry and business context failure.
- Dedicated services/products pagination, name/description/price/duration rendering, public-safe field handling, missing currency fallback.
- Configured-only safe contact/map links; absent/malformed channels; no arbitrary-protocol/host link rendering.
- Static image manifest/alt/dimensions, empty gallery state, FAQ interaction, mobile menu/skip link/focus behavior.
- Availability/feedback integration, anonymous API requests and abort/stale handling; public errors do not clear an admin session.
- Metadata per route and technical labels removed from public Home, with retained focused health tests/probe wiring.

Do not replace meaningful previous tests with weaker snapshots or implementation mirrors. Update only intentional placeholder/layout assertions. No new test framework, CI or Docker.

## Implementation sequence and completion checks

1. Confirm content inputs and write the small static content/asset manifest; keep missing assets explicit.
2. Add scoped public business/catalog schemas/services/routers and privacy/filter tests.
3. Separate public/admin layouts and add navigation, Home and public routes.
4. Integrate existing feedback/availability, safe contact/location, static gallery/FAQ and independent public loading states.
5. Add minimal metadata/image optimizations and, if warranted by measured output, route bundle splitting.
6. Run regressions, local browser/accessibility/responsive checks; update README and create `docs/phase-10-verification.md`.

Before finishing implementation:

- Backend `.venv/bin/python -m pytest` and `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` from `api`.
- Frontend `npm test`, `npm run typecheck` and `npm run build` from `web`.
- Verify Phase 0–9 tests still pass; report exact counts/skips and intentional placeholder changes.
- Verify SQLAlchemy/Alembic connectivity/current head; no schema migration expected.
- Live anonymous business/services/products/feedback/availability reads, safe response fields and invalid pagination; protected reads still 401 without token. Use read-only live checks, never publish/deactivate actual business records to test privacy.
- Browser-check every public route, active navigation, no booking/e-commerce controls, configured contacts/directions, loading/retry/empty states, feedback form and existing availability labels. Feedback/mutations use disposable fixtures; no real visitor reviews or business records created for smoke checks.
- Check all planned widths, no horizontal scrolling, keyboard/menu/focus/FAQ, image loading/alt and contact fallback. Verify default and split admin routes if bundle splitting is used.
- With available mapped Owner/Staff credentials and disposable records, test public catalog visibility after Owner edits and continued Staff mutation/privacy denial. Otherwise mark credential-dependent checks pending.
- Report exact files, chosen visuals/routes/map/FAQ decisions, environment/dependency changes, API projections, test/results, build sizes, assumptions and remaining factual-content/photography/manual setup. Do not claim deployment or production content/SEO readiness when inputs are missing.

Done when the site works across mobile/tablet/desktop, dynamic public data is correctly filtered server-side, galleries are static assets when available, contact/location and FAQ are usable, existing feedback/availability are integrated, no admin-only data is exposed, and regressions/checks pass. Functional completion and outstanding business content must be reported separately. No Phase 11 or deployment work.
