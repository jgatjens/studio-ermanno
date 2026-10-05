# Phase 6 — Appointment Completion and Client History

## Goal and sources

Let Owner complete an appointment and make its immutable visit record available through the existing client profile/history. This is the Phase 6 implementation contract. Stop before Phase 7 product management and inventory mutations.

Follow:

- [MVP roadmap, Phase 6 and Phase 7 boundary](../mvp-implementation-phases.md)
- [Admin specification, completion and client profiles](../admin-spec.md)
- [Database schema, snapshots, appointment products, and derived history](../database-schema.md)
- [Architecture](../architecture.md), [tech stack](../tech-stack.md), and [responsive specification](../responsive-spec.md)
- [Phase 2 authorization](phase-2-implementation.md), [Phase 4 clients/history](phase-4-implementation.md), and [Phase 5 appointments](phase-5-implementation.md)

Reuse the existing appointment/client models and projections, membership-derived actor, Owner dependency, centralized SQLAlchemy sessions, shared business-row lock, bearer-token API client, protected admin routes, and actor-scoped TanStack Query provider.

## Scope and phase boundary

Implement:

- Owner completion of SCHEDULED or CONFIRMED appointments.
- Review/confirmation of stored services performed and final appointment duration/price.
- Product history entries for USED and SOLD, including product-name snapshots and decimal quantities.
- Owner visit notes.
- Atomic transition to COMPLETED and safe repeat requests.
- Refresh of appointment detail, client last visit, and paginated completed-visit history.
- Staff reads of permitted history only.

Do not add product CRUD, inventory screens, stock deductions, inventory movements, stock sufficiency checks, completion correction/reopening, completed-appointment editing/deletion, receipt/payment logic, booking, availability, notifications, generic workflow/idempotency infrastructure, new roles, Redux/Zustand, Docker, CI/CD, or deployment tooling.

Product selection is a minimal protected read of existing products; development products already exist from Phase 1. Phase 6 records usage/sale history only. It never changes `Product.current_stock` or creates InventoryMovement rows. Every future stock change must have a corresponding movement; that integration is Phase 7. Explain this boundary in the completion UI/README so recording product history is not presented as an inventory update.

At Phase 7 handoff, existing Phase 6 completions are historical records, not pending deductions. Do not automatically replay them into stock; Phase 7 must define its starting inventory baseline and apply movements only through its new workflow.

## Completion contract

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /appointments/completion-products?q=&limit=25&offset=0` | Owner | Membership-scoped active product selectors |
| `POST /appointments/{id}/complete` | Owner | Atomic completion; returns updated Owner appointment detail, 200 |

Declare the static product-selector route before the dynamic appointment-ID route. Reuse existing GET appointment detail/context, client profile/history, and active appointment edit APIs. No general product API or separate client-history table is needed.

Completion body:

| Field | Rule |
| --- | --- |
| `service_ids` | Required 1–50 distinct UUIDs, confirming the appointment's current stored service snapshot IDs |
| `products` | Array, default empty, maximum 50 entries; each contains `product_id`, `usage_type`, `quantity` |
| `visit_notes` | Optional string; trim, blank to null, maximum 10,000 characters |

Product entry validation:

- `product_id`: UUID for an existing same-business active product when completing for the first time.
- `usage_type`: USED or SOLD only.
- `quantity`: Decimal > 0, maximum 12 digits and 3 decimal places, matching the existing model; no floats in arithmetic.
- Reject duplicate `(product_id, usage_type)` pairs; the same product may appear once as USED and once as SOLD.
- Reject extra fields at all levels, including business/role, stock values, product names/prices, service snapshots, calculated/final totals, interval, status, and appointment/client identity fields.

Selector response: `{items,total,limit,offset}`; each item contains only product ID, name, optional brand/category. Search is trimmed case-insensitive literal substring of name/brand, maximum 200 characters, bound parameters with wildcard escaping. Pagination: limit 1–100, default 25; offset nonnegative; deterministic name/ID ordering. No cost price, stock, minimum stock, inventory history, public visibility, or privileged configuration is returned. Staff receives 403 for this Owner-only selector; its history reads remain permitted.

## Service confirmation and historical accuracy

Completion confirms existing snapshots rather than refreshing services from the catalog. The submitted service-ID set must exactly match the appointment's stored service-ID set. A mismatch returns 409 `appointment_changed`, prompting reload/review. Inactive retained services remain valid for confirmation.

If services performed or final totals need correction, Owner must first use the existing Phase 5 active edit flow, then return to completion. Show a clear link and explain this order before notes/products are entered. Do not add a second service-edit/calculation implementation inside completion.

Completion preserves all existing:

- Service name, price, and duration snapshots.
- Calculated/final appointment totals.
- Scheduled interval, client, barber assignment, and appointment notes.

Product entries snapshot the current product name on first completion. Later product/service edits or deactivation must never rewrite stored history. Product sales do not automatically add to final appointment price because the existing schema has no product-sale price snapshot/payment model; financial extensions are outside this phase.

No completion timestamp or manually maintained client last-visit value is added. Existing history orders COMPLETED appointments by scheduled start, with appointment ID as tie-breaker. Completing an older appointment must not replace a newer scheduled-date completed visit as the client's last visit.

## State, authorization, and transactions

- SCHEDULED and CONFIRMED may transition to COMPLETED through the new completion endpoint only.
- CANCELLED and NO_SHOW return 409 `invalid_transition`.
- COMPLETED remains immutable; only an identical completion retry may return 200.
- Do not add COMPLETED to the existing generic status endpoint: required completion validation must not be bypassed.
- No new time gate is imposed for completion; Owner makes the explicit decision, consistent with Phase 5's lack of past-date/no-show timing gates.
- Completion releases active scheduling capacity because COMPLETED is excluded from active reservations. It does not reschedule or require a currently active barber/open business hours.

Validate identity and membership independently on every request. Owner authorization runs before appointment lookup. Missing/invalid/expired token returns 401; identity without membership and Staff mutations return 403. Missing/foreign appointment/product references return indistinguishable scoped 404. Inactive first-completion products return 409 `inactive_reference`. Invalid quantities/payloads return 422. Conflict messages disclose no unrelated/private records.

Within one SQLAlchemy transaction:

1. Acquire the same Business-row `SELECT ... FOR UPDATE` lock used by appointment/configuration writers.
2. Read the scoped appointment and its stored snapshots after acquiring the lock.
3. Handle repeat completion before checking current catalog activity or reading current product names.
4. For a first completion, validate status, confirmed service IDs, product references/activity, and duplicate pairs.
5. Insert AppointmentProduct rows with business ownership and product-name snapshots, set visit notes and COMPLETED.
6. Commit once and return the role-filtered appointment detail. Roll back all mutations on failure.

Reuse a focused completion service within `api/app/appointments/`; do not introduce an event bus, background job, generic transaction framework, or process-memory lock. Unexpected pre-existing product rows on an active appointment return 409 `appointment_changed` instead of silently overwriting them; existing normal Phase 5 appointments contain none.

## Repeat requests and races

Canonicalize service-ID sets, product tuples `(product_id, usage_type, Decimal quantity)`, and normalized notes. Compare a retry against persisted completion data, not current catalog definitions. Identical retries return the existing result without new product rows or snapshot changes, even if products/services were later deactivated/renamed. A changed request against COMPLETED returns 409 `already_completed`.

Include product IDs in authorized appointment/history product projections as needed for this comparison and UI identity; IDs do not grant access, and business scoping still applies. Do not duplicate private product attributes in responses.

Two concurrent identical completions must create one completion/product set and return consistent success responses. Two differing completions must yield one success and one 409. Completion versus cancellation/no-show/edit is serialized by the business lock: first valid committed mutation determines what the second can do. A cancelled/no-show appointment cannot then complete; a completion cannot then be edited/cancelled. An edit committed first changes the service confirmation set when applicable, so stale completion is rejected.

No stock/movement effect occurs on either initial completion or retries. PostgreSQL race tests are required; SQLite cannot prove row-lock behavior.

## Client history and visibility

Reuse Phase 4's derived completed history and last-visit APIs; no separate history mutation or stored last-visit pointer.

| Data | Owner | Staff |
| --- | --- | --- |
| Client name, visit date, service snapshots, final duration/price, appointment notes | Visible | Visible |
| USED product-name snapshots and quantities | Visible | Visible |
| SOLD product history | Visible | Omitted |
| Visit notes, contacts, general/private client notes | Visible | Omitted |
| Completion controls/product selector/write APIs | Allowed | Denied |

Restricted fields must be absent at every response nesting level, not null/masked. Keep backend projections authoritative; frontend role hiding is additional UX. No direct React access to Supabase business tables. Avoid logging notes, contacts, tokens, or completion bodies.

## Frontend

Add protected Owner route `/admin/appointments/:appointmentId/complete`, linked only from active appointment detail. Staff direct navigation shows access denied without loading Owner-only selectors. Terminal records show read-only status rather than a completion form.

Mobile completion sequence:

1. Review client, scheduled date/time in business timezone, existing services and final totals.
2. If needed, use the existing edit route first to correct services/totals.
3. Search/select existing active products, choose USED/SOLD, enter positive decimal quantities; allow no products.
4. Enter visit notes.
5. Review the summary and deliberately confirm completion.

Use stacked sections, visible labels, accessible product/usage controls, decimal input hints, clear back navigation, keyboard/focus support, and comfortable touch targets. No dense editable table, new calendar library, or new state layer. Show that product recording does not update stock until Phase 7 inventory integration.

Drafts remain local React state. TanStack Query owns product selectors, appointment detail, and client history with actor-scoped keys. Central API client injects the bearer token. Disable duplicate submission; preserve notes/products after validation, transport, and 409 failures. Explain stale-review/already-completed conflicts without silently resubmitting or discarding drafts. A transport failure after commit can be safely retried with the same body.

On success invalidate appointment lists/detail, the affected client profile/history, and relevant completion query data, then navigate to completed detail with a saved notice. Existing logout/actor-change cache disposal must cover selectors and history. Preserve 401 session clearing and 403 access-denied handling; do not automatically retry deterministic 409/422 responses.

Completed detail and client profile display stored product/service history, Owner visit notes, and Staff-safe omissions. Include loading, empty product search, no products recorded, validation, error/retry, submitting, completed, and access-denied states. No Complete action remains on completed/cancelled/no-show records.

## Required tests

Backend:

- New endpoint authentication: missing/invalid/expired token, identity without membership, Owner success, Staff 403.
- Scoped appointment/product lookup, foreign-business references, selector search/totals, and extra ownership/private input rejection.
- SCHEDULED/CONFIRMED completion, CANCELLED/NO_SHOW denial, generic status endpoint cannot bypass completion validation.
- Service-set mismatch, retained inactive service confirmation, immutable snapshots/totals/interval, and active pre-existing product-row protection.
- Empty products, USED/SOLD distinction, duplicate pairs, quantities/precision/limits, optional notes normalization, and product-name snapshots.
- All-or-nothing failure: status/notes/product rows unchanged when any reference or insert fails.
- Identical retries, changed retries, retry after catalog rename/deactivation, and no duplicate rows.
- Last visit and paginated history refresh from COMPLETED status; completing an older visit does not displace the newer last visit.
- Owner visibility and complete Staff omission of contacts/private notes/visit notes/SOLD products at all nesting levels.
- Product stock and InventoryMovement counts unchanged on success, failure, and retry; no financial addition from SOLD rows.
- Real PostgreSQL identical/differing completion races and completion versus cancellation/edit; no partial or repeated product rows.
- Scheduling capacity released by completion, with existing Phase 5 concurrency behavior intact.

Frontend:

- Owner active detail Complete action, Staff control omissions/direct route denial, and terminal read-only behavior.
- Stored snapshot/total review, product selection/search, USED/SOLD, quantity validation, optional notes, and no-product completion.
- Deliberate final confirmation, successful request/navigation/query invalidation, and completed history rendering.
- Draft retention after transport/422/409 failures, safe same-body retry, loading/error/empty states, and 401 versus 403 behavior.
- Staff history omissions and actor/session cache separation; reuse existing coverage where sufficient.

Use existing pytest, Vitest, React Testing Library, JWT/JWKS fixtures, and disposable PostgreSQL schemas. No live business mutations or new testing framework.

## Implementation sequence and acceptance

1. Add completion schemas and minimal Owner product selector.
2. Implement atomic completion, stored-state retry comparison, projections, and PostgreSQL race tests.
3. Add Owner completion form/action and client/appointment query invalidation.
4. Verify existing history, privacy, capacity, and all previous-phase behavior.
5. Update root README and create `docs/phase-6-verification.md` with actual outcomes and limitations.

Before finishing implementation:

- From `api`, run `.venv/bin/python -m pytest` and `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest`, including new completion race cases.
- From `web`, run `npm test`, `npm run typecheck`, and `npm run build`.
- Confirm every Phase 0–5 regression still passes; report exact pass/skip counts.
- Verify live `/health`, unauthenticated completion denial, and browser protected-route redirection.
- With mapped development Owner/Staff credentials and explicitly disposable records, verify completion, identical retry, client last visit/history, Staff response omissions, and mutation 403. Check authenticated mobile/desktop widths and keyboard/focus flows.
- If real-user credentials remain unavailable, identify these manual checks as pending. Do not claim automated fixture checks establish real-user/browser validation.
- Report created/modified files, any justified migration/dependency, assumptions, warnings, commands/results, and remaining manual setup. No secrets in reports/examples.

Done when Owner completion atomically produces immutable, repeat-safe visit history, snapshots/final totals remain historically accurate, client last visit/history update by derivation, Staff privacy remains enforced, stock remains unchanged in this phase, and required checks pass.

## Explicit planning decisions

The source docs leave completion API shape, repeated-request semantics, service correction timing, product quantity limits, and the Phase 6/7 inventory handoff open. This plan chooses confirmation of stored services/totals with corrections through existing active edit, snapshot-based idempotent retries, decimal product quantities, and history-only product recording until Phase 7. Existing scheduled-start history ordering is preserved; no completion timestamp or generic idempotency table is added. Stop at Phase 6.
