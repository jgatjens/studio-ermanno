# Phase 3 implementation

Derived from Phase 3 in `docs/mvp-implementation-phases.md`, the existing admin/schema/architecture docs, and the accepted frontend state decision.

Implement services and barbers: authenticated business-scoped lists (optional active filter), Owner create/edit/activate/deactivate. Retain inactive records; no deletion. Implement a shared weekly business-hours read and atomic Owner update of exactly seven weekdays (Monday=0). Closed days use null times; open days require opening before closing. No split shifts, overnight hours, per-barber hours, or availability calculation.

Add mobile-first protected `/admin/services`, `/admin/barbers`, `/admin/business-hours` screens. Staff can read; only Owner sees or executes mutations. Use TanStack Query for API data/invalidation, existing Context for auth, and local form state. Clear/dispose private caches across actor/session changes. Never accept business ownership from request input.

Validate names, decimal price precision, positive integer service duration, and weekly schedules. Use existing models and migration; no new tables. Test authorization, business isolation, invalid input, inactive retention, weekly atomicity, frontend role rendering, mutations/invalidation, and cache isolation. Run prior phases' tests, TypeScript, and build.

Out of scope: client CRUD, appointments, inventory, feedback, public business pages, availability, new roles, deployments, and Phase 4.
