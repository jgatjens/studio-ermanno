# Phase 10 verification

Implemented on 2026-10-04 from `docs/plans/phase-10-implementation.md`. Functional public website complete; production factual-content verification and real-user smoke checks remain outstanding. No Phase 11 or deployment changes.

## Created

- `api/app/public/__init__.py`: focused public website module.
- `api/app/public/router.py`: anonymous business/hours, active services and active/public products read projections, scoped by backend `PUBLIC_BUSINESS_ID`, stable pagination, Decimal strings and no-store headers.
- `api/tests/test_phase10.py`: five tests covering configuration, exact projections, missing hours, business scoping, forged filters, privacy, pagination, Staff denial, protected endpoints and Owner visibility changes without stock changes.
- `web/src/public/content.ts`: static FAQ and supplied-photo manifest with descriptions, provenance, dimensions and responsive sources.
- `web/src/public/data.ts`: anonymous abortable section loading/retry, currency formatting and validated contact destinations.
- `web/src/public/layout.tsx`: semantic public layout, mobile menu/Escape/focus, active navigation, skip link, footer and route metadata.
- `web/src/public/pages.tsx`: Home, services/products catalogs, gallery, FAQ, contact and not-found pages, independent section states and reusable public cards/contact views.
- `web/src/public/public.test.tsx`: ten public website tests, including stale aborts and gallery-empty behavior.
- `web/public/images/README.md`: photo provenance/usage assumptions and encoding details.
- Six static WebP assets: `village-street-480.webp`, `village-street-960.webp`, `studio-exterior-480.webp`, `studio-exterior-960.webp`, `street-detail-480.webp`, `street-detail-960.webp` under `web/public/images/`.
- This report.

## Updated

- `api/app/main.py`: registers public read router.
- `web/src/app/app.tsx`: public routes/layout separated from existing login/admin widths; unknown admin routes remain protected.
- `web/src/routes/public.tsx`: compatibility export for the real Home; technical placeholder removed.
- `web/src/routes/admin.tsx`: retained HealthStatus on authenticated access/probe page.
- `web/src/index.css`: public-only warm neutral surfaces, restrained brown accent, responsive grids, touch targets, visible focus and reserved loading/image space.
- `web/index.html`: meaningful static fallback title/description.
- `web/src/app/app.test.tsx`: intentional placeholder assertion update; health tests retained; unknown-admin protection added.
- `web/src/auth/auth.test.tsx`: initializes health mock after reset because the authenticated probe now mounts HealthStatus; all existing assertions retained.
- Root `README.md` and `docs/README.md`: setup, scope, content and verification references.

No schema migration, dependency, environment variable, privileged browser credential, Storage integration, booking, cart, upload API or business-settings editor was added. Existing availability and feedback domain code is unchanged.

## Decisions and assumptions

Home follows hero → featured services → availability CTA → gallery → products → approved public reviews → contact/hours → FAQ. Featured means the first deterministic public rows. Empty Home products/reviews are hidden; dedicated catalogs retain helpful empty states. Section failures are independent; a failed Business load withholds contact/map/currency context.

The user supplied three mobile photographs in response to the approved-photography request. This is treated as permission to use them in this website; ownership/publication rights have not been independently verified. Captions describe visible exterior/street content only. No address, location or haircut result is inferred. Photo 2 is the eager hero; gallery uses all three with alt text, intrinsic dimensions, responsive sources and lazy loading. Original JPEGs were EXIF-oriented and resized/encoded using bundled Pillow; public files contain no EXIF metadata. No application dependency was installed.

Business metadata remains the seeded development fixture (Sample Hair Studio, sample address/contact details), not approved production facts. The database remains the source of configured name, description, timezone, currency, hours and contact fields; do not deploy those fixtures as real information. Replace them with confirmed business content before launch. FAQ explains informational availability/contact/service guidance/review moderation and avoids unsupported policies.

Contact uses normalized phone/WhatsApp, validated email and an allowlisted Instagram profile. Location is an address card plus outbound Google Maps directions, without an embedded map, SDK or requests at page load. The `api=1&destination=...` URL contract was checked against [Google's official Maps URL documentation](https://developers.google.com/maps/documentation/urls/get-started). Missing/malformed contacts create no unsafe links.

Public API fields are explicit allowlists; products omit stock, minimums, cost, SKU, IDs, flags, timestamps and history. Unknown request filters cannot override backend scope. Closed or missing hours have null times; seven weekdays are returned Monday–Sunday. No catalog mutation route is public.

## Verification results

| Check | Result |
| --- | --- |
| Default backend `.venv/bin/python -m pytest -q` | 245 passed, 36 database tests skipped, 11.32 seconds |
| Full `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest -q` | 281 passed, no skips, 370.60 seconds |
| Frontend `npm test` | 111 passed across 13 files |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, 159 modules |
| Alembic current via configured PostgreSQL | `0002_phase7 (head)` |
| SQLAlchemy PostgreSQL connectivity | Passed through live public API reads and all PostgreSQL regression fixtures |
| `/health` | 200, `status: ok` |
| Anonymous `/public/business`, `/public/services`, `/public/products`, `/public/feedback`, `/public/availability` | All 200; business/catalog response allowlists checked |
| `/public/products?limit=0` | 422 |
| Anonymous `/services`, `/products`, `/auth/me` | All 401 |

Existing Phase 0–9 tests remain passing. New tests use disposable SQLite fixtures and existing isolated PostgreSQL regressions; live smoke checks are read-only. No real feedback or business rows were changed by smoke checks.

While the full database suite and browser requests ran concurrently, the configured Supabase session pool briefly rejected additional connections (`EMAXCONNSESSION`, pool limit 15), producing a Home Business error state. The shell/sections remained usable and prices were withheld. After the suite finished, reload restored the business context and all final live reads passed. This is a development concurrency limitation to account for when running live tests alongside the server; no provider-specific backend handling was introduced.

Browser verification:

- Visited every public route, public not-found and unknown admin path; unknown admin redirected to login.
- Home widths 320, 375, 390, 768, 1280, 1440: document scroll width matched viewport at every width, including after adding photographs.
- Services/products/gallery/availability/feedback/contact at 320, 768, 1440: no horizontal overflow and one DOM h1 per page. All public routes also visited at 375.
- Mobile menu expanded/closed, Escape returned focus to Menu; route navigation closes the menu (also tested).
- Native FAQ expanded; feedback labels and single h1 confirmed. Existing feedback/availability controls and regression tests retained. No booking or e-commerce controls introduced.
- Configured contact/map URLs and image alt/loading inspected. Hero loaded eagerly; gallery loaded lazily and all three images loaded when in range. No missing-image requests.
- Automated tests cover error/retry/empty states, missing currency/contact, malformed URLs, public AbortSignal and stale cleanup, metadata, Home order and public safe rendering. Existing API tests retain public-401/admin-session isolation.
- Temporary browser viewport overrides reset. Home screenshot saved locally at `/tmp/phase-10-home.jpg`.

## Build sizes and limitations

Final JS: 633.42 kB, gzip 182.83 kB. CSS: 16.07 kB, gzip 4.15 kB. HTML: 0.44 kB, gzip 0.30 kB. The existing eager admin route imports were retained; the >500 kB warning remains. Baseline before Phase 10 was approximately 621.74 kB JS/gzip 178.87 kB. No route splitting or new bundler tooling was introduced.

WebP bytes (480 / 960): village street 60,724 / 204,516; studio exterior 56,068 / 234,542; street detail 54,076 / 259,798. Responsive browser selection reduces phone transfer; no original multi-megabyte JPEGs are shipped. Hero/gallery may share the same cached storefront image.

Remaining manual setup: confirmed business branding/contact/address/copy/catalog/hours; photograph publication-rights and business-context confirmation; real mapped Owner/Staff credentials for authenticated browser smoke checks. Owner visibility and Staff mutation denial are verified with signed fixture tokens, not actual Supabase logins. Production hostname/canonical/social/robots/sitemap and any SPA prerendering decision remain deferred. No deployment or production-content readiness is claimed.


Location clarification: the user confirmed the business is in Grigno, Trento. The configured public Business placeholder address was updated to `Grigno, Trento, Italia` and verified through `/public/business`. This is a municipality-level location; the exact street address is still pending. Existing directions links currently lead to this general location. The location comes from the user, not an inference from photographs. No other business fields were changed.

Street-address clarification: the user supplied Via Vittorio Emanuele 114, postal code 38055. The configured public Business address is now `Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia`, verified through `/public/business`. This supersedes the municipality-only location above; the website contact section and generated directions link use the full address. No other Business fields were changed.
