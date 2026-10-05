# Phase 8 — Feedback

Source: Phase 8 in `../mvp-implementation-phases.md`, feedback sections of `../admin-spec.md`, `../website-spec.md`, and `../database-schema.md`. Follow existing architecture/tech stack, membership-derived roles, centralized API client, and actor-scoped TanStack Query. Stop before Phase 9 availability.

## Contract

Use the existing Feedback table; no migration or dependency is required. Configure optional backend `PUBLIC_BUSINESS_ID` UUID for this single-business public site. Missing/unavailable configuration returns a safe 503; never infer an arbitrary first business or accept ownership from visitors. Admin always derives its business from membership independently.

- POST `/public/feedback`: anonymous submission with required trimmed nonblank name (200 characters), integer rating 1–5, required trimmed nonblank comment (10,000), optional normalized valid email (320). Reject all extra fields, including IDs, client/appointment links, status and visibility. Save PENDING, not public, with no client/appointment links; return a generic received acknowledgement (201), without private data or internal identifiers.
- GET `/public/feedback`: only configured-business APPROVED AND public records, paginated (`limit` 25, 1–100, `offset` >= 0), newest first. Explicit projection of name, rating, comment and date; no email, ownership, client/appointment links or moderation metadata. Approval alone never publishes.
- GET `/feedback` and `/feedback/{id}`: authenticated, membership-scoped admin list/detail. Optional status filter, bounded pagination, newest first. Owner sees email; Staff omits email, can read name/rating/comment/date/status/visibility and permitted client/appointment references. Missing and foreign records both 404.
- PUT `/feedback/{id}/moderation`: Owner only, strict `{status: PENDING|APPROVED|REJECTED,is_public: bool}`. Non-approved plus public is invalid (422). Shared business lock, one commit, immutable visitor content. Identical moderation is safe to repeat. Rejecting/unpublishing removes the entry from public reads immediately. No delete, submission editing, public association, notifications or generic permissions/rate-limit infrastructure.

## UI

Public `/feedback`: anonymous email-optional form, review list, loading/error/empty/success states, retained draft on failure. Do not automatically retry POST; transport uncertainty explains possible receipt before another deliberate submission. Display comments as plain React text. Mark name/comment as intended for publication after moderation; email remains private. Independent public requests never trigger auth logout.

Protected `/admin/feedback` and `/admin/feedback/:feedbackId`: paginated status filters/cards, detail and Owner moderation with approval separate from visibility, deliberate reject/publication actions, saving/error/saved feedback and retained draft. Staff has no mutation controls. Use existing actor-scoped query cache and centralized bearer injection; invalidate feedback lists/detail after success. Public reads refresh when revisiting; no persistent private drafts/cache.

## Acceptance

Tests cover submission defaults, validation/forged ownership, missing public configuration, isolation, approved-and-public intersection, private projection, authentication, Staff reads/mutation denial, foreign 404, moderation transitions and unchanged linked history; frontend public/admin flows, filters, privacy, failures and retry draft retention, invalidation and existing auth/API handling. Run backend default/full PostgreSQL regressions, frontend tests, TypeScript and build. Verify live health/public feedback reads/validation/protected 401, Alembic current and browser public/protected routes. Do not create real feedback during smoke checks; tests use disposable data. Real Owner/Staff browser/mobile checks remain pending credentials if unavailable. Record exact counts, assumptions and results in `../phase-8-verification.md` and README.

## Decisions

Specs leave required public fields and Staff feedback detail open: require name/rating/comment, optional private email; Staff gets read-only moderation context without email. Anonymous submissions are unverified visitor content, never evidence of an appointment/client. Basic bounded validation is included; production abuse mitigation is an explicit deployment consideration, not new hosting-specific tooling in Phase 8.
