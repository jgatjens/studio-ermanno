# Phase 2 authentication and authorization

Source of truth: `docs/plans/phase-2-implementation.md`. The requested `docs/phase-2-implementation.md` path does not exist; the plan under `docs/plans/` was used with the existing architecture, stack, and schema docs.

## Created

- `api/app/auth/__init__.py`
- `api/app/auth/tokens.py`: configured JWKS retrieval/cache and independently verified JWT signature, expiry, issuer, audience, and UUID subject. Accepted algorithms are ES256/RS256; legacy symmetric/unsigned tokens are rejected.
- `api/app/auth/dependencies.py`: immutable internal actor, real SQLAlchemy membership lookup joined to Business, authenticated read dependency, and Owner-only authorization helper.
- `api/app/auth/visibility.py`: explicit typed internal client/visit test representation and centrally defined Owner/Staff projections. Restricted Staff fields are omitted at both client and nested visit levels.
- `api/app/auth/router.py`: GET `/auth/me`, GET `/auth/test-read`, POST `/auth/test-owner`, and GET `/auth/test-client-visibility`. All require authenticated membership; the POST also requires Owner. Probes do not mutate data; visibility uses synthetic data.
- `api/tests/test_auth.py`: signature/claims, membership, authorization, field visibility, spoofed role/business input, CORS, configuration, and JWKS outage tests.
- `web/src/auth/auth-provider.tsx`: Supabase email/password login, logout, session restoration, auth subscription, backend actor loading, loading/denied/error states, and stale-response cancellation.
- `web/src/auth/protected-route.tsx`: guarded admin route and authentication/access-denied/outage views.
- `web/src/auth/logout-button.tsx`: logout with busy/error handling.
- `web/src/routes/login.tsx`: minimal email/password form with loading and error states.
- `web/src/auth/auth.test.tsx`: 13 frontend authentication/routing/role/error tests.
- `web/src/lib/api.test.ts`: six bearer injection and API error-handling tests.
- `docs/phase-2-verification.md`: this report.

## Updated

- `api/app/core/config.py`: optional validated Supabase origin and required non-empty JWT audience (default authenticated). Missing Auth configuration leaves health usable and causes protected authentication to return 503.
- `api/app/main.py`: mounted auth routes and configured CORS for GET/POST and Authorization headers from the existing frontend-origin setting.
- `api/requirements.txt`: added PyJWT with cryptography support. No Supabase privileged API key is used.
- `api/.env.example`: added blank SUPABASE_URL and default SUPABASE_JWT_AUDIENCE, without secrets.
- `api/tests/test_foundation.py`: additional auth configuration validation within the existing test.
- `web/src/lib/api.ts`: centralized latest Supabase bearer token injection, typed errors, actor fetch, and 401 notification; 403 preserves authentication. Health remains unauthenticated.
- `web/src/main.tsx`: installed the lightweight AuthProvider.
- `web/src/app/app.tsx`: added `/login` and protected `/admin`.
- `web/src/routes/admin.tsx`: role label, protected read/visibility probes, Owner-only probe UI, and logout.
- `web/src/app/app.test.tsx`: preserved health/public checks and updated the former unprotected admin-placeholder check to the newly required login redirect.
- `web/src/test-setup.ts`: cleanup of mocked globals and environment values.
- `README.md`: auth configuration, membership linking SQL, verification commands, role rules, and manual Owner/Staff flows.
- Ignored local `api/.env`: added the supplied project URL and authenticated audience. Existing database credentials were retained. No privileged key or real user password was added.

No schema/migration, role, frontend package, business endpoint, or business data was added or modified. Membership provisioning remains manual and outside the application.

## Assumptions and choices

- The supplied Supabase project is development. Its public JWKS exposes an ES256 key and was loaded through the actual backend verifier.
- Authentication requires an asymmetric signing key; HS256 is deliberately unsupported. Secret/publishable API keys are not JWT signing secrets.
- The single-business MVP requires exactly one matching membership. Multiple memberships are denied with 403 instead of allowing token/query/header input to choose a tenant.
- Auth tokens and request input never determine the application role or business. Memberships are queried on each protected request. No generic permissions framework or membership cache exists.
- Missing/invalid/expired tokens return the same sanitized 401 with WWW-Authenticate: Bearer. Missing/ambiguous membership and forbidden role return 403. JWKS connectivity/configuration failures return sanitized 503, without granting access or exposing transport details.
- Backend tests use a local JWKS HTTP server with real ES256 signing and real PyJWT verification, plus SQLAlchemy queries against isolated in-memory SQLite memberships. The unchanged Phase 1 suite separately verifies real Supabase PostgreSQL integrity and migrations in disposable schemas.
- Supabase SDK handles session persistence and refresh. The frontend loads the backend actor after restoration/auth events. Actor requests are canceled on session changes so late responses cannot restore access after logout.
- Logout signs out the current local Supabase session and clears the actor. There is no server-side token revocation service; issued JWTs remain valid until expiration. This phase does not add a user-invitation or provisioning workflow.

## Verification (2026-10-03)

| Verification                                                                | Result                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Complete backend suite: env RUN_DATABASE_TESTS=1 .venv/bin/python -m pytest | PASS: 47 tests, no skips or warnings                               |
| New backend authentication/authorization cases                              | PASS: 24 tests, with real signatures and local JWKS transport      |
| Existing Phase 0 backend foundation                                         | PASS: 4 tests                                                      |
| Existing Phase 1 live PostgreSQL integrity/migration/seed cases             | PASS: 19 tests, isolated disposable schemas                        |
| Frontend tests: npm test                                                    | PASS: 23 tests (13 auth, 6 API, 4 baseline app/health)             |
| TypeScript: npm run typecheck                                               | PASS                                                               |
| Frontend build: npm run build                                               | PASS; existing non-fatal bundle-size warning (~525 kB before gzip) |
| Live GET /health                                                            | PASS: HTTP 200                                                     |
| Live protected endpoints without tokens                                     | PASS: all four return HTTP 401                                     |
| Backend's configured JWKS client → real Supabase public endpoint            | PASS: fetched one published ES256 signing key                      |
| Browser unauthenticated /admin route                                        | PASS: redirected to /login with email/password form                |
| Browser public page after auth changes                                      | PASS: API Status Connected; Supabase Auth client Initialized       |
| Real hosted Owner and Staff sign-in/session/logout                          | NOT VERIFIED: real user credentials unavailable                    |

The protected endpoints and database-derived roles are exercised through the real FastAPI dependency chain in tests; only the external JWKS location and isolated test DB connection are supplied by fixtures. No verifier/authenticated-actor shortcut overrides are used. Owner/Staff tests include spoofed token metadata, query values, request headers, and POST body values; none influence the backend actor. Staff visibility assertions check absence of private fields and nested visit notes, rather than null placeholders.

## Remaining real-user setup

No Owner/Staff email-password credentials were supplied, and no ignored `api/.env.auth-test` file was available. Database credentials and public Auth project keys cannot substitute for a user's sign-in credentials. Real Owner and Staff login, session restoration, and logout against hosted Supabase remain unverified.

Create/identify development email/password Auth users and link their Auth UUIDs to the existing Owner/Staff memberships with the scoped SQL in README. Then follow README's manual Owner and Staff verification checklist. Do not create memberships from token metadata or frontend requests. The existing seed UUIDs are placeholders and intentionally cannot sign in.

This implementation stops at Phase 2. No real client CRUD, business workflows, additional roles, OAuth/password-reset flow, invitations, Redux, deployment changes, or Phase 3 code is included.
