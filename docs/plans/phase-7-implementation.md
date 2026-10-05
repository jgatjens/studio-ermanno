# Phase 7 — Products and Inventory Implementation

## Goal and sources

Add product management and traceable inventory, and extend appointment completion so new USED/SOLD entries deduct stock exactly once. This is the Phase 7 implementation contract; stop before Phase 8 feedback.

Follow:

- [MVP roadmap, Phase 7](../mvp-implementation-phases.md)
- [Admin specification, Products and Inventory workflows](../admin-spec.md)
- [Database schema, Products, Appointment Products, and Inventory Movements](../database-schema.md)
- [Architecture](../architecture.md), [tech stack](../tech-stack.md), and [responsive specification](../responsive-spec.md)
- [Phase 2 authorization](phase-2-implementation.md) and [Phase 6 completion/history boundary](phase-6-implementation.md)

Reuse centralized SQLAlchemy sessions, membership-derived actor/Owner dependencies, the existing business-row lock, completion retries, role-filtered history, bearer-token API client, protected admin routes, and actor-scoped TanStack Query.

## Scope

Implement:

- Owner product create/edit/activate/deactivate and public-visibility flag.
- Product list/search/detail, current stock, minimum stock, and derived low-stock state.
- Owner stock-in, signed adjustment, damaged stock, and immutable movement history.
- USED/SOLD movements and stock deductions within new appointment completions.
- An opening ledger baseline for existing stock without replaying earlier visits.
- Decimal validation, atomic writes, safe retries, authorization, and PostgreSQL race tests.

Do not add feedback, public product pages, online sales/payment, suppliers/purchase orders, returns, product images/uploads, stock reservations, units/conversions, multi-location stock, inventory valuation reports, generic permissions/idempotency/event infrastructure, new roles/state libraries, Docker, CI/CD, or deployment tooling. Public visibility is stored now; public display remains Phase 10. No product or movement delete endpoint.

## Product contract

Reuse Product. Owner metadata create/update fields:

| Field | Validation |
| --- | --- |
| `name` | Required, trimmed/nonempty, maximum 200 characters |
| `brand` | Optional, trimmed, blank to null, maximum 200 |
| `category` | Optional, trimmed, blank to null, maximum 100 |
| `description` | Optional, blank to null, maximum 10,000 |
| `sku` | Optional, trimmed, blank to null, maximum 100; unique within business |
| `cost_price`, `retail_price` | Required Decimal >= 0, maximum 12 digits/2 decimal places |
| `minimum_stock` | Decimal >= 0, maximum 12 digits/3 decimal places; default zero on create |
| `is_active` | Boolean; create default true |
| `is_public` | Boolean; create default false |

Full-record PUT requires the editable metadata and never accepts `current_stock`. Reject extra ownership, role, timestamps, balances, or movement/history fields. SKU uniqueness uses trimmed exact case-sensitive values to match the existing database constraint; do not add case-folding or generated-SKU infrastructure. Map duplicate SKU to 409 `sku_conflict` without raw database errors.

Create accepts an optional `opening_quantity` (nonnegative Decimal, maximum 12 digits/3 decimal places, default zero) and a required UUID `request_id` for safe retries. Backend uses that UUID as the new product's identity; it is a command identifier, never an authorization/ownership source. Create starts at zero, then records a STOCK_IN movement and adds opening quantity in the same transaction when nonzero. Derive that opening movement's ID deterministically from product ID, using a fixed UUID namespace. Zero opening stock causes no stock change and requires no zero movement.

A create retry with the same request ID and matching metadata/opening movement returns the existing scoped product without increasing stock. A conflicting command ID returns 409 `request_conflict`. After later metadata edits, a retry of the original create may return this conflict; it must never create a second product. Handle cross-business/global-ID collision safely without disclosing another business's record. No new generic idempotency table is needed.

Low stock is derived as `current_stock <= minimum_stock`, including equality/zero. Active-only inventory is the default, with an explicit include-inactive filter; inactive records and historical names remain readable. Deactivation does not remove stock/history. Metadata changes never overwrite balances or old appointment product snapshots.

## Inventory commands and ledger

InventoryMovement.quantity remains a signed delta. Use Decimal throughout; resulting balance must stay within 0–999,999,999.999. Negative stock is rejected with 409 `insufficient_stock`; no negative-balance override. Capacity/precision overflow is 422. No browser float arithmetic determines the persisted result.

| Movement | Source | Delta |
| --- | --- | --- |
| STOCK_IN | Owner command/opening stock | Positive |
| ADJUSTMENT | Owner signed correction | Positive or negative, never zero |
| DAMAGED | Owner command | Negative; UI/API supply positive damaged quantity |
| USED | New completion | Negative appointment product quantity |
| SOLD | New completion | Negative appointment product quantity |

Manual command body: `{request_id, movement_type, quantity, notes}`. `movement_type` permits STOCK_IN/ADJUSTMENT/DAMAGED only. `quantity` is positive for stock-in/damaged and a nonzero signed delta for adjustment. `notes` optional, trimmed/blank to null, maximum 10,000. No appointment reference, business ID, balance, USED/SOLD manual command, or movement timestamp is accepted. The UI must label adjustment as “change stock by +/− quantity”, not silently treat it as a target balance.

Use request ID as InventoryMovement.id. Under the business lock, an identical scoped retry compares product/type/signed delta/normalized notes and returns the existing movement/current product without another balance change. A changed request ID payload returns 409 `request_conflict`. Handle global-ID collisions generically. A separate deliberate identical stock delivery requires a new command ID. Keep the UUID stable in the form through failed/uncertain retries and replace it only for a new deliberate operation.

Every balance change and corresponding movement insert occur together in one commit. No write path may update stock as product metadata, silently edit a ledger row, or commit a movement without its balance change. Inactive products may receive manual stock-in/adjustment/damage to reconcile retained physical stock; they remain unavailable for new completion selections.

## Opening baseline and migration

Existing Phase 1 products have stock balances without ledger entries. Add an Alembic migration that:

1. Preflights existing data for invalid negative balances/zero movement deltas, incompatible links, or baseline deltas outside numeric precision; fails with actionable diagnostics rather than deleting or silently rewriting history.
2. Adds the minimal completion-to-movement linkage/constraints below after that preflight succeeds.
3. For each existing product, derives `baseline_delta = current_stock - sum(existing movement deltas)`.
4. Inserts one nonzero ADJUSTMENT baseline movement when needed, with deterministic ID, no appointment link, and a fixed explanatory note. Never modifies the current stock balance during this reconciliation.

After baseline, Owner ledger sum equals current stock. Existing Phase 6 completions/product histories remain untouched: they are not pending deductions. A repeat of an old completion returns its old result without creating USED/SOLD movements, even if stock has since changed. Do not backfill inventory effects for those appointments.

Add nullable `appointment_product_id` to InventoryMovement and one-movement-per-appointment-product uniqueness. Enforce linkage to the same business, appointment, and product with a composite FK/appropriate referenced unique key. Manual/baseline movements have null appointment and appointment-product links; USED/SOLD movements require both links. Add database checks for nonnegative current stock and nonzero movement delta, with signs/link presence consistent with movement type. Do not create a new inventory table or role.

Update SQLAlchemy metadata and disposable migration/metadata tests for the new head. Preserve ledger rows on downgrade; do not use downgrade as inventory rollback. Document any irreversible loss of linkage semantics if downgraded, and test schema roundtrip on disposable data.

Update development seeding to create opening stock and its ledger once, preserve existing stock/movements on rerun, and avoid restoring seeded stock after operational changes. Fixtures deliberately setting up pre-Phase-7 balances must be distinguished from ledger-aware operational tests. No automatic mutation of the user's development business outside the authorized migration/setup workflow; report baseline counts and balances when that workflow is run.

## Completion integration and concurrency

Extend the existing completion transaction, not a second completion endpoint:

1. Acquire the shared Business-row lock.
2. Handle COMPLETED identical/changed retries before checking current product activity, stock, or missing historical movement links. Never “repair” old completed visits on retry.
3. Validate the active appointment, service confirmation set, and active scoped products.
4. Aggregate USED plus SOLD quantities per product before stock checks. One product used 2 and sold 3 requires at least 5 units, not separate comparisons against the same original balance.
5. Validate every affected resulting balance before mutation.
6. Insert product snapshot rows; flush to obtain their IDs.
7. Insert corresponding negative USED/SOLD movements linked to those rows, deduct each aggregate product amount, set notes/status COMPLETED, and commit once.

Insufficient stock or any failed insert rolls back appointment status, visit notes, product history, movements, and every balance. Completion preserves service/final appointment totals; SOLD history is not a payment calculation.

Product create/update and all manual movements acquire the same business lock as completion, scheduling, and configuration writers. Keep a consistent lock order (business before any row/reference operations). No process-memory lock, Supabase RPC, or hosting-specific coordination. PostgreSQL independent-session tests must prove competing deductions cannot oversell and retries cannot double-add/deduct.

Database linkage uniqueness supplies a second protection against duplicate completion movements. All known application/seed balance writes go through the inventory service. Direct privileged SQL maintenance remains outside the API contract; no broad trigger/event framework is required.

## APIs and authorization

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /products` | Owner/Staff | Scoped paginated search/list; optional active/low-stock filters |
| `GET /products/{id}` | Owner/Staff | Scoped product detail/current balance |
| `POST /products` | Owner | Metadata/opening stock create; 201 initially, 200 on matching retry |
| `PUT /products/{id}` | Owner | Metadata edit/activation/public visibility; no direct balance write |
| `GET /inventory` | Owner/Staff | Stock-focused paginated projection/filter of products |
| `GET /products/{id}/movements` | Owner/Staff | Role-filtered immutable ledger history |
| `POST /products/{id}/movements` | Owner | Safe-retry stock-in/adjustment/damage command; 201 initially, 200 on retry |

Product search: trimmed `q`, maximum 200, case-insensitive literal substring across name/brand/category/SKU, escaped wildcards and bound parameters. Lists use `{items,total,limit,offset}`, default limit 25 (1–100), offset >= 0; product ordering name/ID, movement ordering created date/ID descending. Add optional movement-type filter. No public product endpoint yet.

Reuse the completion selector endpoint; retain its minimal shape and active filtering. Do not give it a side effect or expose inventory/cost fields there.

Tokens/membership remain independently validated. Business/role always come from the backend actor. Missing/invalid/expired token: 401; no membership/Staff mutations: 403; missing/foreign scoped IDs: indistinguishable 404; structural invalidity: 422; SKU/request/stock conflicts: safe stable 409 codes/messages. Staff mutation denial occurs before resource lookup.

Staff can read product/inventory data under the existing read-only role; no new cost-price permission framework is introduced. For movement history, Staff must not gain a route to previously hidden SOLD client history: omit appointment-linked SOLD movements before pagination/counting, omit private free-text movement notes, and expose links only for permitted appointment movements. Owner sees the complete ledger. Explain that Staff's filtered history is not a complete balance-reconciliation ledger. Never copy visit/client private notes into inventory notes. Existing contact/visit-note/SOLD-history filtering remains intact across client/appointment APIs.

Keep simple `app/products/` and `app/inventory/` routers/schemas/services, sharing focused stock-write functions with completion. Business rules belong outside HTTP handlers. No generic repository/permissions framework.

## Frontend

Protected routes/screens:

- `/admin/products`: searchable product cards, active status, Owner create/edit/toggles.
- `/admin/products/new` and `/admin/products/:productId/edit`: short Owner metadata forms; opening quantity only on create.
- `/admin/inventory`: current/minimum stock, prominent low-stock state, filters, Owner stock actions.
- `/admin/products/:productId`: product detail and paginated role-filtered movement history, related permitted appointment links.

Stock-in/adjustment/damage can use focused forms on product detail or dedicated small routes; keep the mobile flow consistent. Label current balance, delta, and expected result clearly; backend remains authoritative. Require deliberate confirmation for reductions/adjustments and preserve stable request IDs/drafts for safe retries.

Update completion wording: new completion now deducts USED/SOLD quantities atomically. Remove the Phase 6 “stock unchanged” notice for new completions; preserve historical no-replay documentation. On insufficient stock, retain the entire completion draft, identify the selected product without unrelated/private data, and allow Owner to correct quantity or use the stock workflow deliberately. Do not automatically manufacture stock or submit an adjustment.

Use existing TanStack Query for products/inventory/movements/selector data, actor-scoped keys, centralized token injection, and local form/search state. Successful stock/completion mutations invalidate affected product/inventory/ledger/selector queries plus existing appointment/client history queries. Retain established cache disposal on logout/actor changes, 401/403 handling, and no deterministic 409/422 retries. Do not persist private drafts/cache in local storage.

Mobile uses stacked cards/sections, labeled decimal inputs, keyboard/focus support, comfortable touch targets, no horizontal scrolling at 320 px, and loading/error/retry/empty/saving/saved/conflict states. Staff direct mutation-route access shows access denied; hiding controls does not replace backend authorization.

## Required tests

Backend:

- Auth/membership, Owner mutations, Staff read-only/route denial, forged ownership/balance input, and business isolation.
- Product validation, SKU collisions, activation/public flags, retained inactive history, search/filters/pagination, and low-stock equality.
- Opening stock with matching movement, zero opening balance, product-create retry/collision, and metadata updates cannot change stock.
- Manual movement signs/types, decimal precision/overflow/negative-stock rejection, normalization, immutable ledger, same/new command IDs, and ambiguous transport retries.
- Ledger sum equals balance after operational writes; baseline migration preserves existing stock/visits and reconciles existing movement totals. Repeated migration/setup/seed does not create duplicate baseline/opening entries or reset operational stock.
- New completion produces one linked movement per product entry, combined USED/SOLD stock checks, and full rollback on insufficient stock/insert failure across multiple products.
- New completion identical retries do not deduct twice; old Phase 6 completion retries create no movements/deductions; catalog edits do not rewrite snapshots.
- Staff SOLD-linked history cannot leak through movement records/counts/links or private notes; existing client field visibility stays enforced.
- Real PostgreSQL races: competing last-unit completions; completion versus damage/adjustment; duplicate manual commands; duplicate opening-stock create; completion retries. Balances stay nonnegative and ledger/history remain consistent.
- Migration upgrade/downgrade/metadata, FK/unique/check constraints, and every previous phase regression with intentionally updated Phase 6 stock expectations for new completions.

Frontend:

- Product/inventory search and low-stock/read-only rendering; Owner metadata/opening-stock forms and public/active toggles.
- Stock commands, signed adjustment/damage confirmation, stable request ID through retry, draft retention, and query invalidation.
- Movement history, permitted links/Staff filtering, loading/error/empty states, and direct mutation-route denial.
- Updated completion stock wording, insufficient-stock recovery, and successful stock/history refresh without duplicate submission.
- Central bearer use, 401/403/409/422 behavior, and actor/session cache isolation; reuse existing tests where sufficient.

Use current pytest/Vitest/React Testing Library and disposable PostgreSQL schemas. Do not add CI, Docker, a new test framework, or mutate real business inventory through test runs.

## Implementation sequence and acceptance

1. Add migration/metadata linkage/checks and baseline reconciliation; update seeding and migration tests.
2. Implement product metadata and reusable atomic stock/command-retry service.
3. Extend completion with aggregated deductions and linked movements; prove PostgreSQL races/no replay.
4. Add mobile product/inventory/ledger forms and update completion UX.
5. Run regressions; update root README and create `docs/phase-7-verification.md`.

Before finishing implementation:

- Run `.venv/bin/python -m pytest` and `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` from `api`, including new migration/stock races.
- Run `npm test`, `npm run typecheck`, and `npm run build` from `web`.
- Verify live `/health`, protected product/stock endpoint 401 responses, and browser route protection.
- Verify Alembic connectivity/new head and report baseline results when applying the development migration. Preserve existing stock and historic visits.
- With mapped Owner/Staff development credentials and disposable records, verify product create/edit, opening stock, stock-in/adjustment/damage, new completion deductions/retries, low-stock/history, and Staff mutation/privacy denial. Check authenticated mobile/desktop and keyboard/focus flows.
- Report exact test counts/skips, modified files/migrations, assumptions, baseline/manual setup, warnings, and verification results. Clearly mark unavailable credential-dependent checks pending. No secrets in docs/examples.

Done when all API balance changes have matching immutable movements, ledger and balances reconcile, new appointment completion deducts once atomically, old visits are never replayed, Owner inventory workflows work, Staff restrictions remain enforced, and required checks pass.

## Explicit planning decisions

The source docs leave negative-stock policy, adjustment shape, manual retry semantics, opening balances, completion linkage, and Staff ledger privacy open. This plan chooses nonnegative balances, signed-delta adjustments, command UUIDs without a generic idempotency store, a justified ledger-link/baseline migration, and role-filtered movement history. Stock units remain the existing abstract decimal quantities; no new unit/currency conversion or sale-price model. Stop at Phase 7; do not implement Phase 8.
