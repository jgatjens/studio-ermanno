# Phase 5 — Appointment Core Implementation

## Goal and sources

Build the central appointment workflow using existing clients, services, barbers, and shared business hours. This plan defines Phase 5 implementation and verification; stop before Phase 6 completion and inventory workflows.

Source documents:

- [MVP roadmap, Phase 5](../mvp-implementation-phases.md)
- [Product overview](../product-overview.md)
- [Admin specification, Appointment and Calendar workflows](../admin-spec.md)
- [Database schema, Appointments and Appointment Services](../database-schema.md)
- [Architecture](../architecture.md), [tech stack](../tech-stack.md), and [responsive specification](../responsive-spec.md)
- [Phase 2 authorization](phase-2-implementation.md), [Phase 3 configuration](phase-3-implementation.md), and [Phase 4 clients](phase-4-implementation.md)

Reuse the existing membership-derived actor, Owner dependency, SQLAlchemy session, models/migration, bearer-token API client, protected routes, and actor-scoped TanStack Query provider. Supabase owns identity; FastAPI owns validation, authorization, calculations, scheduling, and persistence. Keep the backend hosting-provider independent.

## Scope

Implement:

- Authenticated appointment list, date filtering, Today view, and detail.
- Owner creation for an existing client with one or more services.
- Optional barber assignment at creation or later.
- Backend-calculated duration/price with optional Owner overrides.
- Owner edits to active appointments, confirmation, cancellation, and no-show.
- Assigned-barber overlap checks and generic capacity checks for unassigned appointments.
- Historical snapshots, role-filtered client data, mobile-first forms, and regression tests.

Do not implement appointment completion, visit-note writes, product usage/sales, inventory movements, public availability/booking, payments, notifications, recurring appointments, drag-and-drop, per-barber schedules/services, holidays, new roles, deletion, or deployment tooling. Week/month calendar grids and broader dashboard alerts can follow later; the Phase 5 interface uses Today plus a selectable date-range list without a new calendar library. Read existing COMPLETED records, but do not create them through Phase 5 endpoints.

## Data and write contract

Reuse Appointment and AppointmentService. No new table or migration is expected. Business ownership and generated IDs/timestamps come from the backend.

Create/update payload:

| Field | Rule |
| --- | --- |
| `client_id` | Required UUID; existing client in actor business |
| `scheduled_start` | Required timezone-aware timestamp with offset; minute precision |
| `service_ids` | Required ordered list of distinct UUIDs; 1–50 services |
| `barber_id` | Optional UUID or null; same-business active barber for new assignment |
| `appointment_notes` | Optional; trim, blank to null; maximum 10,000 characters |
| `duration_override_minutes` | Optional/null; strict integer 1–1,440 |
| `price_override` | Optional/null; Decimal >= 0, maximum 12 digits and 2 decimal places |

Reject extra fields, including business ID, role, calculated totals, scheduled end, status, snapshots, visit notes, and products. Names/contacts are never accepted in place of a client ID. Full-record PUT requires all required fields; omitted optional fields become null. Create always starts SCHEDULED. Status changes use the dedicated action endpoint.

FastAPI computes sums from stored service definitions/snapshots using Decimal for money. Calculated duration must be positive and at most 1,440 minutes; totals must fit database precision. Final duration/price use the supplied overrides or calculated values. Derive `scheduled_end = scheduled_start + final_duration_minutes`; never trust a frontend end time or preview total. Explicit zero price is a valid override; do not treat zero as missing.

Override fields are command inputs, not new database columns. The frontend can infer an override when final differs from calculated. An override equal to the calculated value has no separately preserved intent in the existing schema; this is an accepted MVP limitation. UI must label this behavior and send intended override values explicitly on edits.

## Snapshot rules

At creation, validate all selected services are active and same-business, then persist name/price/duration snapshots and calculated/final totals in the same transaction as the appointment.

On edit:

- Retained service IDs retain their original snapshots, even if renamed, repriced, or deactivated.
- Newly added IDs must be active/same-business and receive current snapshots.
- Removed IDs are removed only from this active appointment's selection.
- Recalculate totals from the resulting snapshots; notes/date/client/barber-only edits do not refresh snapshots from the catalog.
- Frontend displays retained inactive services in the edit selection and permits removing them; they are unavailable as new selections.
- With no override supplied, final values use the recalculated snapshot totals. Existing different final values must initialize explicit override fields in the edit form to preserve them.

Completed, cancelled, and no-show records are immutable through Phase 5 write endpoints. Later catalog changes and deactivation never rewrite any appointment's historical values. Reuse existing Phase 4 completed-history projection behavior.

## Scheduling and time rules

Scheduling uses the Business.timezone IANA zone and shared weekly business hours. Store/return aware timestamps normalized to UTC; display local business time with the timezone visible. Backend converts instants to that timezone to validate the weekday and opening/closing bounds.

Creation/rescheduling must fit entirely within one open business day, with start >= opening and end <= closing. Missing hours, closed days, or a cross-day interval are rejected. No overnight/split-shift or holiday logic. No implicit browser-local interpretation. Local datetime conversion must reject nonexistent DST times and require an explicit offset for ambiguous times; test this behavior. Do not add a timezone framework solely for this task; use a small tested helper or minimal library only if needed for correct conversion.

Only SCHEDULED and CONFIRMED appointments consume active capacity. COMPLETED, CANCELLED, and NO_SHOW do not. Intervals are half-open `[start, end)`: an appointment may start exactly when another ends.

For each create/edit:

1. Exclude the edited appointment from existing reservations.
2. If assigned, reject any overlapping active appointment for the same barber.
3. Check aggregate capacity at every interval boundary in the candidate window: assigned active reservations plus unassigned reservations plus the candidate must not exceed active barber count.
4. Count each unassigned appointment as one generic slot without writing a fictitious barber assignment. Different assigned barbers may overlap when capacity remains.

Use a sweep of start/end boundaries (ends processed before starts at equal instants), not the count of every record touching the candidate. Example: with two barbers, existing 09:00–09:30 and 09:30–10:00 reservations can coexist with a new unassigned 09:00–10:00 appointment; they never consume three simultaneous slots. This phase treats generic slots as business-level capacity; it does not compute a permanent assignment for unassigned bookings.

Zero active barbers means no new active appointment can be scheduled. Existing records assigned to a subsequently inactive barber remain readable. An unchanged inactive assignment cannot be rescheduled or reconfirmed until reassigned to an active barber; cancellation/no-show remain allowed. Any active existing reservation, including one assigned to an inactive barber, counts toward aggregate occupancy conservatively.

Configuration changes do not automatically move or cancel appointments. An edit changing only client/notes may preserve an unchanged interval/assignment despite later hours/capacity changes; any interval, assignment, or effective-duration change triggers complete scheduling revalidation. Creation and rescheduling do not impose a new ban on past dates because the source docs do not specify one. There is no outside-hours or conflict override.

## Transactions and concurrent requests

Serialize appointment mutations within a business using a PostgreSQL `SELECT ... FOR UPDATE` lock on the Business row before reading relevant scheduling/configuration state. All appointment create/update/status paths acquire that lock in the same order. Phase 3 business-hours saves already use it; extend barber activation/deactivation/create/update and service updates that affect appointment selection to participate in the same lock convention where needed.

After acquiring the lock, read current scoped references, validate, calculate, check overlaps/capacity, and write appointment/snapshot changes. Commit once; roll back on failure. No process-memory lock, Supabase business RPC, or hosting-specific coordination. Configuration remains mutable after a save; no automatic historical repair is added.

Prove races using real PostgreSQL independent connections/transactions in disposable schemas. SQLite unit tests cannot establish row-lock correctness. Two competing creates/reschedules for the same barber or last generic slot must result in one success and one conflict, with no partial snapshot rows. Serialize edits of an existing appointment as well; last successful explicit edit wins, with no new optimistic-version infrastructure in this phase.

## Status transitions

| Current status | Phase 5 allowed action |
| --- | --- |
| SCHEDULED | CONFIRMED, CANCELLED, NO_SHOW |
| CONFIRMED | CANCELLED, NO_SHOW |
| COMPLETED | Read only |
| CANCELLED | Read only |
| NO_SHOW | Read only |

Repeated requests for the current status are harmless 200 responses. Other transitions return 409. No reopening/unconfirming or direct COMPLETED action. Timing restrictions for marking no-show are not introduced in this phase; Owner makes that explicit decision. Confirmation preserves schedule/snapshots and checks the barber remains active; it does not add another capacity reservation. Cancellation/no-show release capacity by changing status and retain records/snapshots.

## Backend API

| Endpoint | Access | Contract |
| --- | --- | --- |
| `GET /appointments` | Owner/Staff | Scoped paginated list with optional time range, status, client ID, barber ID filters |
| `GET /appointments/context` | Owner/Staff | Membership-scoped business timezone and currency for date controls/display; no credentials or private business settings |
| `GET /appointments/{id}` | Owner/Staff | Role-filtered appointment detail |
| `POST /appointments/preview` | Owner | Validate selected references and calculate snapshot totals/end; no writes or capacity reservation |
| `POST /appointments` | Owner | Create SCHEDULED appointment; 201 |
| `PUT /appointments/{id}` | Owner | Full edit of SCHEDULED/CONFIRMED appointment; 200 |
| `POST /appointments/{id}/status` | Owner | Body `{status}` restricted to CONFIRMED/CANCELLED/NO_SHOW; 200 |

Declare `/preview` and `/context` before the dynamic ID route. Reuse `/business-hours` for schedule display and existing service/barber lists for selection; do not introduce a general business-settings API. No DELETE. List uses `limit=25` (1–100), nonnegative `offset`, and `{items,total,limit,offset}` with start/ID deterministic ordering. Optional `from`/`to` parameters are aware timestamps defining an overlap window (`start < to` and `end > from`), with `from < to`. Validate enums/UUIDs/pagination and cap a supplied two-sided date range at 366 days. Unfiltered lists remain paginated.

Preview accepts the create payload plus optional `appointment_id` for Owner edit previews using retained snapshots. Scoped lookup applies to that ID. It returns calculated/final totals, derived end, and selected service projections. It is advisory and creates no lock-held reservation; actual writes revalidate current database state. No preview persistence/cache beyond the current form.

List summaries include ID, client name/ID, assigned barber name/ID or null, interval, status, main service snapshot, final duration/price. Detail includes service snapshots, calculated/final totals, appointment notes, and permitted existing product history. Owner sees contact data and existing visit notes; Staff responses omit email, phone, client private notes, visit notes, and SOLD products at every nesting level. Client general notes remain in the existing profile, avoiding duplication. Private fields must be absent, not masked or null.

All queries and joins are scoped to membership business; never trust business/role from input. Missing/foreign appointment or referenced client/service/barber returns indistinguishable scoped 404. Inactive/newly unselectable references, invalid transitions, closed-hours violations, and capacity conflicts return 409 with a stable small code and useful message (e.g. `barber_conflict`, `capacity_full`, `outside_business_hours`, `inactive_reference`, `invalid_transition`). Structurally invalid payloads return 422. Reuse 401/403 behavior; Staff mutation denial occurs before domain lookup. Conflict responses must not disclose other clients' names/contacts or appointments from another business.

Keep `api/app/appointments/` small: router, schemas, service/query helpers, and a focused scheduling helper. Scheduling/calculation rules remain independent from HTTP handling. Avoid a generic scheduling/permissions/repository framework.

## Frontend

Protected routes:

- `/admin/appointments`: Today by default in business timezone, date-range list and status filters, pagination, Owner create action.
- `/admin/appointments/new`: Owner creation form.
- `/admin/appointments/:appointmentId`: detail with client profile link and Owner status/edit actions.
- `/admin/appointments/:appointmentId/edit`: Owner edit form.

Add an admin navigation link and optional appointment-list link from a client profile. Do not replace the admin home with a full dashboard or create future-phase actions. Staff direct form navigation shows access denied; backend remains authoritative.

Form sequence: search/select an existing client, choose business-local date/time, select services, optionally assign active barber, add appointment notes, review backend preview totals, enter optional overrides, save. Reuse Phase 4 search and Phase 3 active catalogs. Link to existing client creation if necessary, but do not create an inline duplicate client workflow or persist private drafts in local storage. Preserve drafts on preview/save failure and conflicts. Make retained inactive service handling explicit.

Use centralized bearer-token injection and TanStack Query with actor-scoped keys for lists, details, catalogs, client selection, and preview inputs. Auth remains Context; forms, filters, and controls remain local state. Cancel/ignore stale previews. Disable duplicate submissions; successful writes invalidate affected appointment lists/details and relevant client queries. Add 409 message support to the API client without changing established 401 session clearing or 403 handling. Avoid automatic retries for deterministic 409 responses.

Mobile uses stacked appointment cards and one-column labeled forms. Show business timezone, clear Unassigned label, status, validation/conflict messages, loading/empty/error/retry/saving/saved states. Confirmation/cancellation/no-show require a deliberate labeled action; cancellation/no-show use a short confirmation UI to prevent accidental taps. Touch targets, keyboard navigation/focus, 320 px layout, and no hover-only controls are required. No new calendar or global state library.

## Required tests

Backend:

- New endpoints reject missing/invalid/expired tokens and valid identities without membership; Owner writes/Staff reads and mutation denial.
- Cross-business appointment IDs, nested data, filters, and client/service/barber references cannot leak or modify records.
- Existing client and one or more unique services required; validation of dates/offsets, money precision, strict positive duration, limits, extra ownership/status/history fields.
- Multi-service sums, zero-price override, duration override/end calculation, null override reset, and overflow rejection.
- Snapshot preservation after catalog edits/deactivation, retained versus added/removed service behavior, and atomic rollback on failed updates.
- Shared open/closed/missing hours, exact opening/closing boundaries, adjacent intervals, business timezone day conversion, and DST ambiguity/nonexistent local-time handling.
- Same-barber conflict, different-barber overlap, unassigned last-slot consumption, mixed reservations, sweep versus naive overlap-count example, zero capacity, and edit excluding itself.
- Status transition matrix, idempotent status actions, cancellation/no-show release, and immutable terminal appointments including COMPLETED.
- Staff JSON omission of all restricted nested fields and SOLD products; Owner permitted detail visibility.
- Real PostgreSQL concurrent creates/reschedules and configuration-lock coordination using independent sessions; one last-slot winner and clean rollback.
- Existing Phase 4 history still excludes new active/cancelled/no-show appointments and preserves completed snapshots.

Frontend:

- Today uses business timezone; list filters/pagination and detail/loading/error/empty states.
- Existing-client search/selection, multi-service selection, active catalogs, Unassigned, backend preview, explicit zero overrides, and stale-preview protection.
- Owner create/edit/status actions, inactive retained selection, failed-save draft retention, 409 display, and successful query invalidation.
- Staff read-only screens, direct form denial, omitted private sections, 401 versus 403 behavior, and actor/session cache separation.
- Business-local date/time conversion and daylight-saving cases through helper tests.

Reuse pytest/Vitest/React Testing Library and existing auth fixtures. Add only tests needed for these behaviors; no new CI/Docker/test framework. Use disposable development data/schemas for database mutations and races.

## Implementation sequence and verification

1. Define schemas, projections, calculations, and snapshot edit semantics.
2. Implement scheduling/time helpers and business transaction locking; prove capacity and races.
3. Add API list/detail/preview/create/edit/status operations and authorization tests.
4. Add frontend query/types/time conversion and mobile workflows.
5. Run all Phase 0–4 regression tests plus new tests; update root README and write `docs/phase-5-verification.md`.

Before finishing:

- From `api`, run `.venv/bin/python -m pytest` and `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` with live development PostgreSQL regressions and new concurrency tests enabled.
- From `web`, run `npm test`, `npm run typecheck`, and `npm run build`.
- Verify live `/health`, unauthenticated appointment 401 behavior, and browser protected-route redirection.
- With real mapped development users, verify Owner multi-service creation, overrides, assigned/unassigned conflicts, edit and status actions; verify Staff reads, response omissions, and mutation 403. Use explicitly disposable records.
- Check authenticated forms/list/detail at mobile/desktop widths and keyboard navigation. Report unavailable credential-dependent checks as pending.
- Report exact test counts/skips, commands/results, changed files, migrations/dependencies if any, assumptions, warnings, and manual setup. Keep secrets out of examples/reports.

Done when Owner can create/edit valid appointments with preserved snapshots and authoritative calculations, concurrency cannot overbook a barber/generic slot, status actions release capacity correctly, Staff sees only permitted read data, mobile workflows are usable, and required checks pass.

## Planning decisions and phase boundary

Source docs leave endpoint shapes, active-capacity statuses, transition restrictions, snapshot edit semantics, concurrency mechanism, and time-validation details open. The choices above make those behaviors concrete. Appointment completion, products/visit-note entry, and stock changes remain Phase 6/7; public availability remains Phase 9. Do not continue into Phase 6.
