# Barber business data foundation

Phases 0–11 provide the React → FastAPI → Supabase PostgreSQL foundation, Supabase email/password login, membership-based authorization, core admin workflows and a responsive public website. `/` is the public Home, `/login` handles sign-in and `/admin` is the operational dashboard. Mobile admin navigation links Dashboard, Clients, Calendar (the existing appointment list), Inventory and More. Access diagnostics are available at `/admin/access`. Deployment remains Phase 12.

Repository: `web/` contains the Vite frontend, `api/` contains the standard FastAPI ASGI application, and `docs/` contains the architecture and planning documents. The Phase 0 source of truth is [docs/plans/phase-0-implementation.md](docs/plans/phase-0-implementation.md).

## Prerequisites

Node.js 22.12+ with npm, Python 3.9+ with pip/venv (Python 3.12+ recommended), and a hosted Supabase development project with PostgreSQL and Auth enabled.

## Local setup

Create one Supabase development project in your account. Obtain the PostgreSQL connection string from its Connect panel and the project URL/public publishable or anon key from its API settings. Use a direct or session-pooler PostgreSQL URL that your network can reach; URL-encode special characters in the password and require TLS with `?sslmode=require`. Do not use transaction pooling for migrations.

Backend, from the repository root:

```sh
python3 -m venv api/.venv
api/.venv/bin/python -m pip install -r api/requirements.txt
cp api/.env.example api/.env
cd api
```

Set `DATABASE_URL` in `api/.env` to `postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres?sslmode=require`. Both SQLAlchemy and Alembic use this setting. Set `FRONTEND_ORIGIN` to the exact browser origin (default `http://localhost:5173`); wildcard origins are rejected. `APP_ENV` accepts development, test, or production. Start the backend from `api/`:

```sh
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in another terminal from the repository root:

```sh
cd web
npm ci
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the public Supabase project settings (the publishable key is supported in `VITE_SUPABASE_ANON_KEY`); set `VITE_API_BASE_URL` to `http://localhost:8000`. Start:

```sh
npm run dev
```

Open http://localhost:5173. The public page reports API Loading, Connected, or Error, and whether the Auth client initialized. `/admin` redirects unauthenticated users to `/login`; valid members can use authorization probes. Restart Vite after changing frontend environment variables.

Environment files are ignored. Never put a database password or service-role/secret key in any `VITE_` variable. No privileged Supabase API credentials are needed for these phases. Supabase Storage is not used. Without Supabase configuration the health endpoint and frontend still run; the frontend reports Auth as Not configured and database checks fail explicitly.

## Validation

From `web/`:

```sh
npm run typecheck
npm test
npm run build
```

From `api/`:

```sh
.venv/bin/python -m pytest
.venv/bin/python -m app.db.check
.venv/bin/alembic current
```

The database command executes read-only `SELECT 1`; `alembic current` uses the same engine. After Phase 1 setup, the expected head is `0001_phase1`. The default pytest run executes the foundation tests and explicitly skips live database tests; use the command below for the complete database suite.

With both development servers running, visit the public page and confirm `API Status: Connected`. Inspect the network request to confirm `GET http://localhost:8000/health` returns `200` and `{"status":"ok"}`. `/health` remains independent of database availability. The configured frontend origin receives CORS access; other origins do not.

No deployment, Docker, CI/CD, Redux, or Zustand is included.

## Phase 1 database setup

From `api/`, using the development Supabase session pooler on port 5432:

```sh
.venv/bin/alembic upgrade head
.venv/bin/alembic current
.venv/bin/python -m app.db.seed
RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest
```

`APP_ENV` must be `development` for the seed. Set `SEED_TIMEZONE` to a valid IANA zone (default `Europe/Rome`). The seed adds one sample business, two owner memberships, one staff membership, two barbers, five clients, four services, four products, and seven weekday rows. UUIDs are deterministic. Rerunning inserts missing records and preserves edits; it does not reset records or create duplicates. To reset local fixtures, use a fresh development database/schema. Downgrading an existing populated schema deletes its application data; it is not a seed-reset command.

The complete PostgreSQL tests create a uniquely named `phase1_test_*` schema, run upgrade → downgrade → upgrade there, and remove only that disposable schema afterward. Data tests roll back their changes; they do not use or reset `public` data. These tests require a database role that can create/drop schemas. Never run them against production.

Membership `auth_user_id` values are development placeholders generated by `app.db.seed.AUTH_USER_IDS` using UUIDv5 (namespace `bf93ed0e-17fb-49f1-b4a4-0c4ae0fa6574`, names `auth:owner-1`, `auth:owner-2`, `auth:staff-1`). They are not real Supabase Auth users, and no Auth accounts are provisioned. The external identity column deliberately has no `auth.users` foreign key so placeholders remain possible and migrations do not manage Supabase-owned schemas.

All 12 application tables use UUIDs, timezone-aware timestamps, explicit business ownership, and restrictive foreign-key deletion. Composite foreign keys reject cross-business references, including appointment associations, inventory movements, and feedback. Money uses decimal `(12,2)` fields; stock/quantity uses `(12,3)` fields. Inventory movement quantity is a signed delta, with no balance-update workflow yet. Weekdays are Monday=0 through Sunday=6; opening/closing times are local to the business timezone. `updated_at` changes on SQLAlchemy updates; direct SQL writers must set it themselves.

Service/product snapshots and calculated/final appointment totals are stored explicitly. Phase 1 provides no automatic snapshot copying, price/duration calculation, overlap checks, or stock updates. PostgreSQL row-level security is enabled without browser access policies on all application tables: business data is accessed through FastAPI's database connection. No Supabase Storage or business-data calls are added to React.

See [Phase 1 plan](docs/plans/phase-1-implementation.md) and [Phase 1 verification](docs/phase-1-verification.md).

## Phase 2 authentication setup

Install the updated backend requirements. Set `SUPABASE_URL` in `api/.env` to the project's HTTPS origin, and `SUPABASE_JWT_AUDIENCE=authenticated`. Restart Uvicorn. The backend derives issuer `/auth/v1` and JWKS `/auth/v1/.well-known/jwks.json` from that configured origin; it accepts ES256/RS256 signatures only and requires expiration, issuer, audience, and UUID subject. It does not use the publishable/secret API keys or trust token metadata for business role. The current development project publishes an ES256 key. A legacy HS256 project must migrate its Auth signing key before using this verifier; the Supabase secret API key is not a JWT signing secret.

Supabase owns identity; `admin_memberships` owns admin access. In the **development** Supabase dashboard, create or identify three email/password Auth users (two Owners and one Staff), confirm their emails as needed, and copy their Auth UUIDs. Replace the placeholders below and run these updates in the development SQL editor to link the existing seed memberships. No provisioning endpoint or automatic membership creation is provided.

```sql
UPDATE public.admin_memberships
SET auth_user_id = '<OWNER_1_AUTH_UUID>', updated_at = now()
WHERE id = '6d2c0770-be88-5801-bfa0-b68e9d246a4a'
  AND business_id = 'b42ea32c-fa16-59a7-9069-b43aca72cc7c';

UPDATE public.admin_memberships
SET auth_user_id = '<OWNER_2_AUTH_UUID>', updated_at = now()
WHERE id = '88677e1a-0251-5e91-a007-962a6bb2232b'
  AND business_id = 'b42ea32c-fa16-59a7-9069-b43aca72cc7c';

UPDATE public.admin_memberships
SET auth_user_id = '<STAFF_AUTH_UUID>', updated_at = now()
WHERE id = 'fc72b38c-7b21-50cf-843b-736410529e10'
  AND business_id = 'b42ea32c-fa16-59a7-9069-b43aca72cc7c';
```

Keep passwords out of source, frontend environment files, and documentation. Rerunning the development seed preserves the real Auth UUID mappings because existing records are not overwritten. Users with zero memberships or multiple business memberships are denied with 403; business selection is intentionally outside this single-business MVP.

Protected probes:

| Endpoint | Owner | Staff | No valid token |
| --- | --- | --- | --- |
| `GET /auth/me` | Actor from membership | Actor from membership | 401 |
| `GET /auth/test-read` | 200 | 200 | 401 |
| `POST /auth/test-owner` | 200 | 403 | 401 |
| `GET /auth/test-client-visibility` | Full synthetic data | Restricted synthetic data | 401 |

A valid token without an unambiguous membership receives 403 on every probe. Test endpoints do not write application data. The visibility probe uses synthetic sample fields, not real client records. Staff receives only name and appointment history containing services, products used, and appointment notes; email, phone, private notes, and visit notes are absent, including visit notes nested in history.

`require_authenticated_actor` is the reusable read dependency; future mutation routes must use `require_owner`. The visibility helper is the reusable backend projection. Never accept business ID, role, or permissions from request bodies/headers/claims as authorization. Actor responses expose only the user/membership/business identifiers and database role. Memberships are queried afresh on each protected request.

The frontend restores the Supabase session, loads `/auth/me`, and renders admin only after successful backend authorization. It attaches the latest bearer token centrally for protected API calls. A protected 401 clears local session/actor state and returns to login; 403 displays access denied while retaining authentication. Transport failures/503 preserve the session and offer a retry. Logout signs out locally through Supabase and clears the actor; like other JWT-based systems, already issued access tokens remain valid until expiry. There is no token-revocation service in this phase.

Manual validation with real development users:

1. Open `/admin` while logged out; confirm redirect to `/login`.
2. Login as Owner; confirm `/auth/me`, Owner UI, protected read, Owner action, and full visibility probe succeed.
3. Reload `/admin`; confirm session restoration and actor reload. Logout; confirm return to login.
4. Login as Staff; confirm protected read works, Owner action UI is absent, and client visibility has no restricted fields. Submit `POST /auth/test-owner` with this session's bearer token via a REST client; it must return 403. Logout.
5. Login with a Supabase user with no membership; confirm Access denied and that logout remains available.

Auth tests run without real user credentials and verify signatures through a local test JWKS HTTP server with an in-memory SQLAlchemy membership database. The full `RUN_DATABASE_TESTS=1` suite also reruns Phase 1's isolated live PostgreSQL tests. Test execution requires permission to bind a loopback port. See [Phase 2 verification](docs/phase-2-verification.md).

Verification approach follows [Supabase JWT documentation](https://supabase.com/docs/guides/auth/jwts) and [JWT signing-key documentation](https://supabase.com/docs/guides/auth/signing-keys).

## Phase 3 admin configuration

Open `/admin/services`, `/admin/barbers`, or `/admin/business-hours` after login. Owner can create/edit services and barbers, activate/deactivate them, and save the seven-day shared schedule. Staff can read these screens; FastAPI denies all writes. Records are deactivated rather than deleted. No new migration is needed.

Authenticated APIs: `GET/POST /services`, `PUT /services/{id}`, `GET/POST /barbers`, `PUT /barbers/{id}`, and `GET/PUT /business-hours`. Catalog GETs accept `active=true` or `active=false`; omitting the filter returns both statuses. Lists and record updates always use the membership's business. Unknown/foreign record IDs return 404. Mutation payloads reject extra fields such as `business_id`.

Services require a nonblank name, positive integer duration, and a nonnegative price with at most two decimal places. Business-hours updates contain `{ "days": [...] }` with each weekday exactly once (Monday=0). Open days require local opening/closing times in order; closed days store null times. The week is saved in one transaction and serialized per business. No scheduling or availability calculation exists yet.

Admin API data uses TanStack Query; successful saves invalidate the relevant list. Auth remains in React Context; forms remain local. Private query clients are scoped to user/membership/business/role and disposed when the protected tree unmounts or the actor changes. No persistent query-cache storage is used. See [Phase 3 plan](docs/plans/phase-3-implementation.md) and [verification](docs/phase-3-verification.md).

## Phase 4 clients

Protected `/admin/clients` supports list/search; `/admin/clients/new` and `/admin/clients/:clientId/edit` are Owner-only forms. `/admin/clients/:clientId` shows the profile and existing completed-visit history. API endpoints are GET/POST `/clients`, GET/PUT `/clients/{id}`, and GET `/clients/{id}/history`. Lists/history use `limit` (default 25, maximum 100) and `offset`; list search uses `q`.

Owner can search names/email/phone and update contacts/general notes. Staff searches names only and receives no email, phone, private notes, visit notes, or sold products; Staff mutations return 403. Every query is scoped to backend membership. First/last names are required; contacts/notes are optional. There is no client delete endpoint. No migration or new environment variable is required; install updated backend requirements for email validation.

Last visit/history derive from COMPLETED appointments ordered by scheduled start. Phase 4 only reads stored history/snapshots; appointment/completion/inventory workflows remain deferred. Admin API data uses the existing actor-scoped TanStack Query cache. Forms remain local state.

Use the frontend/backend test commands above, including the live PostgreSQL regression command. Real-user checks require the existing Owner/Staff Auth setup and membership mapping. See [Phase 4 plan](docs/plans/phase-4-implementation.md) and [verification](docs/phase-4-verification.md).

## Phase 5 appointment core

Protected `/admin/appointments` defaults to Today in the business timezone, with date/status filters. Owner routes `/admin/appointments/new` and `/admin/appointments/:appointmentId/edit` support existing-client selection, multiple services, optional barber, notes, and explicit duration/price overrides. Detail is `/admin/appointments/:appointmentId`. Staff reads permitted data only.

API: GET `/appointments/context` returns business timezone/currency; GET `/appointments` and GET `/appointments/{id}` read scoped records. POST `/appointments/preview` calculates totals without reserving capacity. POST `/appointments` creates SCHEDULED; PUT `/appointments/{id}` edits active records; POST `/appointments/{id}/status` accepts CONFIRMED/CANCELLED/NO_SHOW. No delete or completion endpoint is provided. List filters: `from`, `to` (aware overlap window), `status`, `client_id`, `barber_id`, `limit`, `offset`.

Backend derives end time and sums using Decimal, preserves retained service snapshots, and validates open hours/active references. Same-barber overlaps and aggregate assigned/unassigned capacity are enforced with half-open intervals. All appointment and relevant configuration writers share a PostgreSQL business-row lock; no in-memory reservation state is used. Failed operations roll back. 409 conflicts retain frontend drafts; 401/403 behavior is unchanged. UTC instants are displayed/entered in business time, and repeated DST wall times require explicit offset selection.

Run existing tests with `RUN_DATABASE_TESTS=1` to include five additional PostgreSQL concurrency cases in disposable `phase5_test_*` schemas. No migration/new environment variable/dependency is required. Configure real Owner/Staff development users as above for authenticated browser smoke tests. See [Phase 5 plan](docs/plans/phase-5-implementation.md) and [verification](docs/phase-5-verification.md).

## Phase 6 completion and client history

Owner can open `/admin/appointments/:appointmentId/complete` from active detail, review stored services/final totals, select existing active products as USED/SOLD, enter decimal quantities and visit notes, then confirm completion. Correct services/totals through the existing active edit flow first. Staff has no completion controls or selector access.

API: GET `/appointments/completion-products?q=&limit=25&offset=0` returns only active scoped product ID/name/brand/category. POST `/appointments/{id}/complete` accepts `{service_ids, products: [{product_id, usage_type, quantity}], visit_notes}`. Service IDs must match the stored snapshots. Completion transitions SCHEDULED/CONFIRMED to COMPLETED, preserves totals/interval/snapshots, records product-name snapshots, and makes the visit visible through existing client profile/history reads. Last visit remains derived from the latest completed scheduled start.

Identical completion retries return the existing result without duplicate rows, including after catalog rename/deactivation; changed retries return 409. All completion, cancellation, and edit writers share the existing business-row lock. A background refetch does not discard the completion draft after an uncertain transport outcome. Staff receives only USED product history and no visit notes/private client fields.

Phase 6 records product history only: it neither updates stock nor creates inventory movements. Inventory integration is Phase 7; existing Phase 6 history must not be automatically replayed as deductions. No migration, dependency, or new environment variable is needed. Run the full PostgreSQL suite to include four completion race cases; real-user smoke tests require the existing Owner/Staff mapping. See [Phase 6 plan](docs/plans/phase-6-implementation.md) and [verification](docs/phase-6-verification.md).


## Phase 7 products and inventory

Owner manages metadata at `/admin/products`, creates opening stock at `/admin/products/new`, and edits full metadata at `/admin/products/:productId/edit`. `/admin/inventory` shows current/minimum stock and low-stock state (`current <= minimum`). Product detail provides immutable movement history and confirmed stock-in, signed adjustment, and damage actions. Staff reads products/inventory, with no writes, no private movement notes, and no SOLD-linked movement history. Staff history is filtered and cannot reconcile the full balance.

API: GET/POST `/products`, GET/PUT `/products/{id}`, GET `/inventory`, GET/POST `/products/{id}/movements`. Lists use `q`, `active`, `low_stock`, `limit` (25, maximum 100), and `offset`; inventory defaults to active products and supports `include_inactive=true`. Movement history supports `movement_type`. Metadata PUT requires the complete editable record and rejects `current_stock`. Decimal prices have two decimal places and quantities three. Product API decimal values are strings.

Create accepts `request_id` (UUID) and optional `opening_quantity`. Manual movement commands accept `{request_id, movement_type, quantity, notes}` with STOCK_IN, signed nonzero ADJUSTMENT, or positive DAMAGED quantity (persisted as a negative delta). Keep the command UUID and exact body for uncertain retries. Matching retries return 200 instead of 201 and do not change stock again; changed commands return 409. Use a new UUID for a deliberate new operation. No product/movement delete or ledger-edit endpoints exist.

New appointment completions aggregate USED/SOLD quantities, reject insufficient stock, then persist snapshots, linked negative movements, balances, notes, and COMPLETED status in one transaction. All stock/metadata writers share the existing PostgreSQL business lock. Negative stock is denied. Historical Phase 6 completions are never replayed, including on retry.

Apply the Phase 7 migration from `api/` before starting the updated backend:

```sh
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic current
```

`0002_phase7` reconciles existing ledger totals to each unchanged stock balance with nonzero ADJUSTMENT baselines. It does not deduct historical visits. Preflight rejects invalid balances, deltas, links, or numeric overflow for deliberate reconciliation before retry. New development seed products receive opening ledger entries once; rerunning seed preserves operational stock/history. Downgrade preserves movement rows but removes appointment-product linkage; it is not inventory rollback, and upgrading a populated downgraded completion ledger requires deliberate reconciliation.

No dependency or environment-variable changes. Run the standard backend/frontend checks above; `RUN_DATABASE_TESTS=1` includes six inventory race cases and a populated baseline migration test, in disposable schemas only. For real-user smoke checks, map Owner/Staff Supabase users as described above, use disposable products/appointments, and verify opening stock, metadata flags, manual movement signs/retries, low stock, completion deductions/retries, and Staff denial/privacy at desktop/mobile sizes. See [Phase 7 plan](docs/plans/phase-7-implementation.md) and [verification](docs/phase-7-verification.md).


## Phase 8 feedback

Public `/feedback` provides anonymous submission and published reviews. Name, integer rating (1–5), and comment are required; email is optional/private. Name/comment are trimmed and bounded at 200/10,000 characters. Submissions always start PENDING and not public, with no client or appointment association. They never publish automatically. Only configured-business feedback with both APPROVED status and public visibility is displayed; public responses contain name, rating, comment and date only.

Set backend `PUBLIC_BUSINESS_ID` in `api/.env` to the actual Business UUID for this single-business site (see the Business row created by development seed or your database setup). This field is backend configuration, not a frontend tenant selector. Missing/nonexistent configuration returns 503 for public feedback. The local ignored development environment is configured to the existing seeded business. `.env.example` contains an empty value; configure it explicitly in another environment. Admin operations independently use membership business/role and do not use this public setting.

Owner and Staff can read `/admin/feedback` and `/admin/feedback/:feedbackId`. Pending is the default list filter. Owner sees private email and can set approval/rejection separately from public visibility; Staff sees read-only feedback context without email. Pending/rejected feedback cannot be public. Moderation confirmation preserves submitted text and any existing related records. No delete, content-edit, public client association, or notification workflow exists.

APIs:

- Anonymous POST `/public/feedback`: `{name,email,rating,comment}`; 201 `{status:"received"}`. Extra fields are rejected, including business/status/visibility/client/appointment IDs.
- Anonymous GET `/public/feedback`: published reviews only.
- Authenticated GET `/feedback` and `/feedback/{id}`: scoped list/detail, optional `status` filter.
- Owner PUT `/feedback/{id}/moderation`: `{status,is_public}`; identical repeats are safe. Non-approved + public is 422; Staff writes are 403; foreign/missing IDs are 404.

Lists use `limit` (25 default, maximum 100) and `offset`, newest first. Public requests skip bearer/session loading and cannot invalidate admin authentication. Public POST has no automatic retries: uncertain receipt keeps the draft and warns that a deliberate repeat may duplicate feedback. Moderation retries retain the same body; success refreshes actor-scoped admin feedback data. Review text is rendered as plain text.

No migration, package, or frontend environment change is needed; the existing Feedback table is used. Run the standard test/typecheck/build commands above. Real-user smoke checklist: submit a disposable review; confirm it is absent publicly while Pending; Owner approves without publishing and confirms it remains hidden; enable public visibility and confirm only public fields appear; reject/unpublish and confirm it disappears; Staff reads without email and receives 403 on moderation; test filters, pagination, reload, error states and keyboard/mobile flows. Real Owner/Staff credentials are needed for authenticated browser verification. See [Phase 8 plan](docs/plans/phase-8-implementation.md) and [verification](docs/phase-8-verification.md). See Phase 9 below for public availability.


## Phase 9 public availability

Public `/availability` shows date cards and open-time intervals with Available, Limited, Full and Closed labels. It is informational only: contact the business to arrange an appointment. There is no online booking, service-duration guarantee or individual barber calendar. Times are shown in the business timezone with UTC offsets, including repeated DST clock times. Daily labels summarize whether any interval has capacity; check the interval list for a specific time.

GET `/public/availability?start=YYYY-MM-DD&days=7` is anonymous. Start defaults to today in the business timezone; `days` is 1–14 (UI offers 1/7/14). It reuses backend `PUBLIC_BUSINESS_ID`; no new configuration, dependency or migration is required. Missing/nonexistent business configuration returns 503. The API returns timezone, interval size, start/range, and date/interval state projections only—no counts, barber/client names or IDs, notes, prices, services, or appointment records. Supabase browser data queries are not used.

Capacity uses shared business hours, active barber count, and SCHEDULED/CONFIRMED appointments, assigned or unassigned. All retained active reservations count, including assignments to inactive barbers, matching admin scheduling. Intervals are half-open; peak simultaneous occupancy is used so back-to-back appointments do not double-count. The last 30-minute interval can be shorter to fit closing time. AVAILABLE means no occupancy with positive capacity or at least two slots remain. LIMITED means exactly one remains while some capacity is occupied. FULL means no capacity remains, including zero active barbers during open hours. Missing/closed hours produce CLOSED with no intervals. Outside opening hours is closed.

Daily summary is AVAILABLE if any interval is Available, otherwise LIMITED if any interval is Limited, otherwise FULL for open days, or CLOSED for closed days. Repeated DST opening/closing times include the full valid UTC window; nonexistent opening/closing times or invalid timezone return 503 for configuration correction. Unsupported date-boundary conversion/range overflow returns 422. Responses are `Cache-Control: no-store`; PostgreSQL repeatable-read snapshots keep hours/capacity/reservations consistent without locking business writers. Refresh/revisit to observe later changes; this is not a reservation.

Run the standard test commands above. `RUN_DATABASE_TESTS=1` includes an additional PostgreSQL snapshot test: a concurrent barber deactivation commits during a public read, the current response remains coherent, and the next request reflects the change. Browser smoke checks can inspect public dates/intervals and a Closed day without credentials. Owner-driven appointment/configuration smoke checks still need real mapped Auth users and disposable data. See [Phase 9 plan](docs/plans/phase-9-implementation.md) and [verification](docs/phase-9-verification.md). Phase 10 public website is implemented below.


## Phase 10 public website

Public routes: `/`, `/services`, `/products`, `/gallery`, `/availability`, `/feedback`, `/faq`, `/contact`. The shared header/footer includes mobile navigation, skip link and discreet Staff login. Unknown admin paths remain protected. API health diagnostics now live on the authenticated Admin access page.

The anonymous read endpoints `/public/business`, `/public/services`, `/public/products` use the existing backend-only `PUBLIC_BUSINESS_ID`. Missing/nonexistent configuration returns 503; services must be active and products must be active AND public. Product responses exclude cost, stock, minimums, SKU, identifiers and history. Pagination uses `limit` 1–100 and nonnegative `offset`. All new reads use `Cache-Control: no-store`; browser requests never load or inject Auth tokens.

No migration, new package or environment variable is needed. Existing local setup and test commands above apply. Use `cd api` then `.venv/bin/python -m pytest` for default backend tests or `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` for isolated PostgreSQL regressions. In `web`, run `npm test`, `npm run typecheck`, `npm run build`. Verify migrations with `.venv/bin/python -m alembic current` from `api`.

The three supplied mobile photographs are optimized local WebP assets in `web/public/images/`; the manifest in `web/src/public/content.ts` records descriptions and provenance. No Supabase Storage or uploads API is used. Replace development Business name/contact/address/description, currency/timezone/hours and catalog fixtures with confirmed content in the database before launch. Confirm the supplied photographs' publication rights and relationship to the business. The images do not establish its address or identity. FAQ intentionally makes no unsupported payment, walk-in or cancellation-policy claims.

Contact uses configured, validated phone/email/WhatsApp/Instagram links and an outbound Google Maps directions URL; no embedded maps or third-party requests on page load. Public prices depend on successfully loaded Business currency. Public errors leave the rest of Home usable and offer a focused retry.

Route titles/descriptions provide minimal SPA metadata. Client-rendered content has crawlability limits; production hostname/canonical/social/robots/sitemap and any prerendering decision remain for deployment planning. The existing eager admin bundle is retained; its size warning remains a measured limitation. Real mapped Owner/Staff login smoke checks require development credentials. See [Phase 10 verification](docs/phase-10-verification.md). No Phase 11 or deployment work was performed.


## Phase 11 mobile admin

The protected shell keeps one actor-scoped TanStack Query provider across child navigation. The dashboard independently loads next/today appointments, visible-page unassigned alerts, active low-stock products and pending feedback, using existing protected APIs. Date boundaries use Business timezone; Scheduled/Confirmed next reads are separate from the mixed-status day page. Today is an interval-overlap view, including carried-over appointments. No new API, migration, environment setting or dependency is required.

Mobile bottom navigation includes safe-area padding and content clearance. More links Products, Feedback, Services, Barbers, Business hours and Access checks; logout and public-site navigation remain accessible. Owner mutation shortcuts are hidden for Staff, while backend authorization remains authoritative. Client list search/page survives profile Back navigation; appointment drafts warn before leaving to create a client, retain errors and focus a submission summary. Existing completion/stock/moderation reviews and repeat-safe attempts are unchanged.

Use the existing backend/frontend commands above. Run the full PostgreSQL suite separately from live browser requests to avoid the configured Supabase session-pool limit. Real-user verification needs both mapped Owner and Staff development accounts and disposable records; creating an Auth account alone does not confer admin access. See [Phase 11 plan](docs/plans/phase-11-implementation.md) and [verification](docs/phase-11-verification.md).

## Phase 12 deployment preparation

The [final MVP phase plan](docs/plans/phase-12-implementation.md) and [deployment runbook](docs/deployment-runbook.md) cover Cloudflare Pages, Render, production Supabase configuration, migrations, Auth/CORS, logging, verification and rollback. Local preparation includes Python 3.12.14 / Node 22.23.2 runtime pins, backend dependency constraints, bounded per-process database pools, production configuration validation, safe request summaries and static frontend security/indexing headers. Deployment is not complete. See [Phase 12 verification](docs/phase-12-verification.md) for current evidence and remaining launch inputs. Phase 13 remains deferred.

For deployment, use the runbook's exact provider settings and production environment values. Set `APP_ENV=production` on the backend and `DEPLOYMENT_ENV=production` for the frontend build. Database credentials stay backend-only; production database URLs require explicit TLS. Production frontend builds require public HTTPS API/Auth origins and the Supabase publishable key in the existing `VITE_SUPABASE_ANON_KEY` variable. Local `.env.example` defaults preserve development behavior. `/health` remains liveness-only; verify PostgreSQL and Alembic separately. The large frontend bundle warning remains a documented limitation.
