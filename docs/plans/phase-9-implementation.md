# Phase 9 — Public Availability

Source: Phase 9 of the MVP roadmap, website specification §9, product overview availability rules, architecture/tech stack, and existing Phase 5 scheduling. Stop before Phase 10 website completion.

## Contract and decisions

Read-only GET `/public/availability?start=YYYY-MM-DD&days=7` uses backend `PUBLIC_BUSINESS_ID` from Phase 8. Default start is today in the configured business timezone. Days is 1–14. Optional start must be a valid date; ranges cannot overflow the supported date representation (422). No client-selected business/barber/service, no booking/mutation endpoint, no reservation guarantee.

Return `{timezone,interval_minutes:30,start,days,items:[{date,state,intervals:[{start,end,state}]}]}`. Interval boundaries are aware UTC instants; labels render in business timezone. No appointment IDs, counts, hairdresser identifiers/names, client/contact data, notes, prices or services. Do not use direct Supabase browser queries.

For each day, use shared hours and active hairdresser count. Missing/closed hours produce CLOSED and no intervals. Open hours with zero active hairdressers are FULL, not CLOSED. Walk actual elapsed UTC time in 30-minute blocks from opening to closing, truncating the last block to closing. Include only open intervals. CLOSED outside business hours is explained in UI; day-level CLOSED is explicit.

Count SCHEDULED/CONFIRMED reservations overlapping each block, assigned or unassigned, including retained bookings assigned to deactivated hairdressers (matching existing scheduling). Terminal statuses do not reserve. Use half-open intervals and maximum simultaneous occupancy, not summed overlapping rows: back-to-back reservations never double-count. Free capacity is active count minus peak occupancy, conservatively clamped by states. AVAILABLE when occupancy is zero with positive capacity or at least two slots remain; LIMITED when exactly one remains and some capacity is occupied; FULL when none remains. Over-capacity retained data is FULL.

Daily summary: AVAILABLE if any interval is Available, otherwise LIMITED if any is Limited, otherwise FULL for an open day, CLOSED for a closed day. A day label indicates some availability, not availability at every time; UI explains checking individual intervals and contacting the business. No service-duration or assigned-barber guarantee.

Use ZoneInfo and UTC sweep comparisons. Repeated DST opening boundaries use earliest valid opening and latest valid closing; UTC interval iteration includes both repeated times with explicit offsets. Nonexistent opening/closing local times or invalid timezone return a safe 503 rather than fabricated availability. Bound queries to the requested open-hours range and scope every query. PostgreSQL reads use a repeatable-read transaction snapshot for consistent hours/capacity/reservations without blocking writers; SQLite tests use their existing transactions. No shared process state or cache of appointment details.

## Frontend

Public `/availability`: short date-range form (default backend-local today), daily cards, selectable day's interval list, business timezone and time offsets, loading/error/retry/empty/Closed states, informational/contact wording. Bounded 7-day default and at most 14-day requests. Server owns states; frontend only formats. Abort stale requests, clear stale results on new requests, use centralized anonymous API requests, no admin auth side effects or persistent data. Link from existing public placeholder; no Phase 10 redesign.

## Tests and acceptance

Cover all four states, inactive/no hairdressers, missing/closed hours, shared hours/timezone, assigned/unassigned occupancy, terminal exclusions, half-open/back-to-back intervals, peak rather than summed overlaps, over-capacity, clipping/partial blocks, ranges/default business-local date, timezone/DST, missing public configuration, tenant isolation, response privacy and no mutation routes. Include PostgreSQL snapshot consistency alongside all previous regressions. Frontend covers range/date inputs, timezone/offset labels, daily/interval states, stale/loading/error/retry behavior, and anonymous requests. Use existing pytest/Vitest only.

Run backend default/full database regressions, frontend tests, TypeScript/build, live read/invalid range/health/protected-route checks and Alembic current. Browser-test public calendar and logged-out admin protection; never create real appointments for tests. Record exact files/results, decisions and pending real-user/mobile checks in `../phase-9-verification.md` and README. No migrations, new environment variables/dependencies, booking, per-barber schedules, holidays, notifications or Phase 10 content.
