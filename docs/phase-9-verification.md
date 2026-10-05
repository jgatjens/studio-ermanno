# Phase 9 verification

Implemented public availability from the roadmap, website §9, product overview, existing Phase 5 scheduling, and architecture/tech-stack docs. The detailed contract and threshold decisions are in `plans/phase-9-implementation.md`. Stop before Phase 10.

## Created

- `docs/plans/phase-9-implementation.md`: date/interval contract, privacy projection, capacity thresholds, timezone/DST policy, snapshot consistency and acceptance.
- `api/app/availability/service.py`: configured public-business lookup, business-local default date, shared-hours windows, active barber capacity, scoped active reservation reads, half-open peak occupancy, daily summaries, DST boundaries, safe configuration/date failures and PostgreSQL repeatable-read snapshots.
- `api/app/availability/router.py`: anonymous read-only bounded endpoint and `Cache-Control: no-store`.
- `api/tests/test_phase9.py`: **36 cases** covering privacy, assigned/unassigned capacity, statuses, thresholds, peak/back-to-back occupancy, daily summaries, closed/missing hours, zero/inactive barbers, partial intervals, range validation, no mutation endpoints, missing configuration, tenant/forged query isolation, DST gaps/repeated times, timezone validation, business-local today and extreme date conversion.
- `api/tests/test_phase9_database.py`: **one real PostgreSQL test** proving public snapshot consistency during concurrent barber deactivation and visibility on the next request without blocking the writer.
- `web/src/routes/availability.tsx`: public date-range form, daily cards, selected interval list, explicit state/threshold/booking-limit wording, timezone/offset display, refresh/loading/error/retry/Closed/empty states and stale-request cancellation.
- `web/src/routes/availability.test.tsx`: **nine cases** for anonymous requests, labels/timezone, Closed days, ranges, retry, stale-loading clearing, empty data, repeated DST offsets and aborted old requests.
- This report.

## Updated

- `api/app/main.py`: availability router registration.
- `api/.env.example`: clarifies that existing `PUBLIC_BUSINESS_ID` serves both public feedback and availability; no new variable or secret.
- `web/src/app/app.tsx`: public `/availability` route.
- `web/src/routes/public.tsx`: Check availability link; health/Auth foundation checks preserved.
- Root `README.md` and `docs/README.md`: usage, threshold/clock/consistency decisions and documentation links.

No migration/model change, dependency, role, environment value, per-barber schedule, holiday feature, booking/mutation endpoint, public services/products page, or Phase 10 website composition was added. Existing scheduling writes are unchanged.

## Verification results

| Check                                                                 | Result                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backend default `.venv/bin/python -m pytest -q`                       | **240 passed, 36 skipped**, 10.58 seconds; live database cases intentionally skipped                                      |
| Full backend `env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest -q` | **276 passed**, no skips/warnings, 296.33 seconds                                                                         |
| Frontend `npm test`                                                   | **100 passed**, 12 files                                                                                                  |
| TypeScript `npm run typecheck`                                        | Passed                                                                                                                    |
| Frontend `npm run build`                                              | Passed, 156 modules; JS 621.74 kB / gzip 178.87 kB                                                                        |
| Phase 0–8 regression coverage                                         | Included; unchanged authentication/privacy/scheduling/completion/inventory/feedback checks and live migration/race checks |
| Live health                                                           | 200 `{"status":"ok"}`                                                                                                     |
| Live anonymous availability, 2026-10-05 for seven days                | 200; Europe/Rome, six AVAILABLE dates with 18 intervals each, Sunday CLOSED with no intervals                             |
| Live range validation, days=15                                        | 422                                                                                                                       |
| Live protected appointment read without token                         | 401                                                                                                                       |
| Alembic current                                                       | `0002_phase7 (head)`; no migration required                                                                               |
| Browser public availability                                           | Date cards, Closed day, selectable Monday with 09:00–18:00 GMT+2 intervals and informational wording verified             |
| Mobile public page                                                    | 320-pixel viewport: content width **320**, viewport width **320**, no horizontal overflow; temporary viewport reset       |
| Browser `/admin` logged out                                           | Redirect to login verified                                                                                                |

No real business appointments/configuration were changed for verification. Live checks are read-only and range-validation-only. Automated fixtures use disposable SQLite or PostgreSQL schemas, with real signature/membership tests retained. A test-fixture error introduced during the extra tenant-query assertion was fixed by retaining the UUID before closing its ORM session; final results above reflect the corrected fixture. Earlier passing capacity/privacy cases remained unchanged.

## Decisions and manual follow-up

The specs leave Available/Limited thresholds and public response granularity open. This implementation uses fixed 30-minute elapsed-time intervals (final block may be shorter), the maximum simultaneous reservation count over each interval, and a daily “some interval has capacity” summary. AVAILABLE: unused positive capacity or at least two slots remain. LIMITED: one remains while some capacity is occupied. FULL: none remains. CLOSED: missing/closed hours; zero active barbers in open hours is FULL. Retained bookings assigned to inactive barbers still reserve capacity, matching existing scheduling.

An interval is informational aggregate capacity, not a guaranteed continuous slot for a particular barber or service. Anonymous queries cannot select another business: server configuration owns identity; irrelevant forged query parameters do not override it. Only timezone/date/interval boundaries/states are returned; internal data/counts are never exposed.

DST boundaries use valid roundtrips: earliest opening and latest closing for repeated wall times; invalid gaps fail safely with 503. Intervals advance in UTC and display explicit offsets. Default today comes from the business timezone. Extreme date overflow returns 422. PostgreSQL snapshots protect consistency across separate reads; later requests see later commits. Public responses are not persisted or cached by the application and do not touch admin authentication.

Real Owner/Staff credentials remain unavailable. A browser workflow that changes bookings/capacity as an Owner, observes the public refresh, and validates authenticated admin mobile interactions is **pending**. Automated tests cover those occupancy/state changes and concurrent reads; the public calendar itself was checked at normal width and 320 pixels. No Phase 10 contact/catalog/gallery redesign was added. The existing Vite warning for a chunk over 500 kB remains.
