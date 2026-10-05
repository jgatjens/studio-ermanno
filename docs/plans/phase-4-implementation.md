# Phase 4 — Client Management Implementation

## Goal and sources

Build the client workflow before appointments: list/search, Owner create/update, and a mobile-first profile with role-filtered reads of existing history. This document is the implementation contract for Phase 4; it does not authorize implementation of later phases.

Follow:

- [MVP roadmap, Phase 4](../mvp-implementation-phases.md)
- [Admin specification, Client Workflow and roles](../admin-spec.md)
- [Database schema, Clients and derived history](../database-schema.md)
- [Architecture](../architecture.md) and [tech stack](../tech-stack.md)
- [Responsive specification, client search/profile and role visibility](../responsive-spec.md)
- [Phase 2 authentication plan](phase-2-implementation.md) and [Phase 3 plan](phase-3-implementation.md)

Reuse Phases 0–3: centralized SQLAlchemy sessions, existing models, validated bearer tokens, membership-derived actor, Owner dependency, centralized frontend API client, protected admin routes, and actor-scoped TanStack Query provider.

## Scope

Implement authenticated client list/search, profile read, Owner creation, and Owner full-record update. Prepare profile history using existing Appointment, AppointmentService, and AppointmentProduct records. Do not create or mutate appointment/history records in this phase.

No client deletion, archiving, activation, merging, imports, exports, bulk operations, public client endpoints, appointment creation/editing/completion, inventory changes, availability, feedback, new roles, or generic permissions framework. Do not add Redux, Zustand, Supabase Storage, Docker, CI/CD, deployment configuration, or another state-management layer.

## Data and validation

Reuse `Client` in `api/app/db/models.py`:

| Field           | Write rule                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `first_name`    | Required, trim whitespace, nonempty, maximum 100 characters                                                             |
| `last_name`     | Required, trim whitespace, nonempty, maximum 100 characters                                                             |
| `email`         | Optional, trim, blank becomes null, validate email format, maximum 320 characters                                       |
| `phone`         | Optional, trim, blank becomes null, maximum 50 characters; preserve international formatting without imposing a country |
| `private_notes` | Optional general notes/preferences, blank becomes null; maximum 10,000 characters as an API limit                       |

Reject extra write fields, including `business_id`, role, timestamps, IDs, and history. Server generates identity/timestamps and derives business ownership from the actor. Optional fields may be explicitly null. Full-record PUT requires both names and treats omitted optional fields as null; frontend submits the complete editable record.

Do not require email or phone uniqueness: households may share contact details. Preferences remain in `private_notes`; no new preferences/history/last-visit columns. No schema migration is expected. Add one only if implementation demonstrates a concrete requirement, and document the reason.

## Authorization and privacy

FastAPI independently validates the token and resolves membership on every protected request. A valid identity without membership receives 403. Missing/invalid/expired credentials receive 401. All queries, including nested history joins, are scoped to actor.business_id. Foreign-business and nonexistent client IDs both return 404 for authorized reads/Owner updates. Staff mutations return 403 before record lookup.

| Capability or field                                                                    | Owner   | Staff                                          |
| -------------------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| List and profile read                                                                  | Allowed | Allowed                                        |
| First/last name search                                                                 | Allowed | Allowed                                        |
| Email/phone search                                                                     | Allowed | Excluded from search predicates                |
| Create/update                                                                          | Allowed | 403                                            |
| Client names, appointment history, service snapshots, products used, appointment notes | Visible | Visible                                        |
| Client email, phone, private/general notes, visit notes                                | Visible | Omitted                                        |
| Products sold in history                                                               | Visible | Omitted; Staff allowlist permits products used |

Staff search must never match on email, phone, or private notes: result membership/counts could otherwise reveal hidden contact information. Use role-specific search predicates, not filtering after pagination. Return explicit response schemas/allowlists at every nesting level; hidden fields must be absent, not null, masked, or merely hidden by React. Never return ORM objects with unrestricted serialization. Avoid logging tokens, contacts, notes, or search terms.

## Backend API

| Endpoint                                             | Access      | Behavior                                       |
| ---------------------------------------------------- | ----------- | ---------------------------------------------- |
| `GET /clients?q=&limit=25&offset=0`                  | Owner/Staff | Scoped, paginated list/search                  |
| `POST /clients`                                      | Owner       | Create; 201 with Owner client response         |
| `GET /clients/{client_id}`                           | Owner/Staff | Scoped client profile and last completed visit |
| `PUT /clients/{client_id}`                           | Owner       | Full editable record update; 200               |
| `GET /clients/{client_id}/history?limit=25&offset=0` | Owner/Staff | Scoped, paginated completed-visit history      |

List response: `{items, total, limit, offset}`. Items contain ID, names, created/updated timestamps; Owner also receives email/phone. General notes belong to the profile, not list summaries. Profile contains these permitted client fields, Owner private notes, and `last_completed_visit` (object or null). History uses the same pagination envelope. No DELETE endpoint.

Search decisions for this phase:

- One trimmed `q`, maximum 200 characters; empty query lists clients.
- Case-insensitive literal substring match across each permitted field (OR). Escape SQL wildcard characters; use bound parameters. Do not implement fuzzy/full-text search or phone normalization infrastructure.
- Owner searches first name, last name, email, phone; Staff searches first/last name only. Label the frontend input accordingly.
- Deterministic ordering by last name, first name, ID. Limit 1–100, offset nonnegative; invalid pagination/query input returns 422.
- No private notes in search predicates. No search term in browser URL/local storage; keep it in local UI state.

Use the existing FastAPI error convention: 401 authentication, 403 authorization, 404 scoped absence, 422 invalid input. Do not expose raw database exceptions. Mutations commit once and roll back on failure.

Keep a small `api/app/clients/` module: router for HTTP/dependencies, schemas for validation/visibility, and a service/query helper for scoping, search, and profile projection. Avoid a generic repository framework. Register the router in the existing application.

## Profile history boundary

Client visit history and last visit derive exclusively from COMPLETED appointments. Scheduled, confirmed, cancelled, and no-show appointments are excluded from this visit-history view; broader appointment views belong to Phase 5. Latest means greatest `scheduled_start`, with ID as a deterministic tie-breaker, because the existing model has no completion timestamp.

Each visit projection includes appointment ID, scheduled start/end, status, appointment notes, final duration/price, historical service name/price/duration snapshots, and permitted product name/quantity/usage snapshots. Owner also receives visit notes and sold products. Staff receives only USED product rows. Do not expose product cost/stock or unrestricted related entities.

Use stored snapshots even when catalog definitions change or become inactive. History reads never update stock, complete appointments, or rewrite historical values. Scope each related table to the same business and appointment. Fetch related rows in bounded batches/eager loads to avoid one query per visit. Return an empty history and null last visit when no completed appointments exist; never invent placeholder visits.

Phase 6 will add the completion workflow that populates this history. Phase 4 only reads existing development/test records and defines the stable projection contract.

## Frontend

Add protected routes within the existing admin query provider:

- `/admin/clients`: prominent search, compact result cards, pagination, Owner create action.
- `/admin/clients/new`: Owner-only create form.
- `/admin/clients/:clientId`: profile, last visit, paginated visit history, Owner edit action.
- `/admin/clients/:clientId/edit`: Owner-only edit form.

Staff direct navigation to create/edit shows access denied without fetching private editable data. Backend denial remains authoritative. Preserve existing 401 session-clearing behavior and 403 access-denied behavior without logging out a valid session. Handle profile 404 explicitly.

Use TanStack Query for list/profile/history API data, with actor-scoped keys including query, pagination, and client ID where relevant. Use the existing bearer-token API client and AbortSignal support. Debounce search approximately 300 ms, reset pagination when search changes, and ensure stale responses cannot replace the current result set. Avoid displaying previous search results as current while a new search loads.

Form drafts/search controls remain local React state; do not store contacts/notes in local storage. On successful create/update invalidate scoped client lists and the affected profile, then navigate to the profile. Disable duplicate submissions, retain drafts on failed saves, show field validation and retryable errors. Existing cache disposal on logout/actor changes must cover all new queries.

Mobile profile order: name, permitted contact information, permitted general notes/preferences, last completed visit, visit history. Use stacked sections/cards, visible labels, email/tel input types, clear back navigation, accessible focus/keyboard controls, comfortable touch targets, and no horizontal scrolling at 320 px. Staff must see no private sections or mutation controls. Include loading, empty list, no matches, no visits, error/retry, saving, saved, and access-denied states.

## Implementation sequence

1. Add schemas and role-specific projections; reuse actor/Owner dependencies.
2. Implement scoped list/search and Owner writes with validation tests.
3. Implement profile/last-visit/history reads using existing snapshot records; test nested privacy and business isolation.
4. Add frontend API types/hooks and routes using existing state conventions.
5. Add mobile list/forms/profile and role/error handling tests.
6. Run regression checks and browser smoke verification; update root README and create `docs/phase-4-verification.md` with actual results and limitations.

## Required tests

Backend tests should cover:

- Missing, invalid, expired tokens and valid identity without membership on the new domain routes, reusing Phase 2 fixtures.
- Owner list/create/update/profile/history; Staff reads and POST/PUT denial, including forged role/business input.
- Missing and foreign-business IDs, scoped list totals/search, and nested history isolation.
- Owner contact/name search; Staff name search with no contact-match leakage; literal wildcard handling, empty query, ordering, pagination validation.
- Required names, trimming, optional null/blank contact fields, malformed email, length limits, forbidden extra fields, and persisted updates.
- Complete absence of private fields in Staff list/profile/last-visit/history JSON; Owner visibility; USED versus SOLD product filtering.
- Empty history/null last visit, COMPLETED-only ordering, deterministic latest visit, and unchanged snapshots after catalog edits/deactivation.
- No client DELETE route and no history mutation side effects.

Frontend tests should cover:

- List loading/error/retry/empty/no-match states, debounced search and page reset, role-appropriate search labels.
- Owner create/edit rendering, validation/save failure draft retention, submission and query invalidation.
- Profile/no-history/history rendering; Staff omissions and direct create/edit route denial.
- Central bearer-token use, 401 versus 403 handling, scoped 404 display, and cache separation across actor/session changes (reuse existing API/auth tests where sufficient).

Use existing pytest, Vitest, and React Testing Library; avoid new test infrastructure. Test meaningful behavior rather than duplicating implementation. Use fixtures/disposable schemas for writes, not live business data.

## Acceptance and verification

Before finishing implementation:

1. From `api`, run `.venv/bin/python -m pytest`; also run `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest` against the configured development PostgreSQL project to retain Phase 1 migration/seed regression coverage.
2. From `web`, run `npm test`, `npm run typecheck`, and `npm run build`.
3. Confirm all Phase 0–3 tests still pass and report exact pass/skip counts.
4. Verify live `/health`, client endpoint 401 behavior, and browser login redirection.
5. With development Owner/Staff credentials and valid membership mapping, verify Owner create/search/edit/profile and Staff name search/read-only/profile omissions plus API mutation 403. Use explicitly disposable development clients. If credentials are unavailable, report this manual check as pending rather than claiming success.
6. Check the client workflow at mobile and desktop widths and keyboard navigation; confirm no restricted Staff fields in network responses.
7. Report created/modified files, migrations if any, assumptions, commands/results, warnings, and remaining manual setup. Keep secrets out of reports and `.env.example` files.

Done when Owner can create/update/search clients, Staff can search names/view permitted profile data without mutation access or private data leakage, profile history accurately projects existing completed records, mobile screens work, and required regression checks pass.

## Explicit planning decisions

The source docs leave API shape and some mechanics open. This plan chooses full-record PUT, bounded offset pagination, individual-field substring search, required first/last names to match the existing model, a 10,000-character notes limit, and scheduled-start ordering for completed visits. Staff contact search and sold-product display are restricted by the existing allowlist. These decisions introduce no new domain features. Stop at Phase 4; do not implement Phase 5.
