# Hair Business MVP Planning Docs

This folder contains the current planning documentation for the MVP.

## Documents

- `deployment-runbook.md` — exact provider settings, user setup, migration/release commands and rollback procedure
- `phase-12-verification.md` — local deployment preparation evidence and remaining live checks
- `plans/phase-12-implementation.md` — final MVP deployment plan: hosting, environment configuration, migrations, Auth/CORS, logging, release checks and rollback
- `product-overview.md` — product goals, scope, and finalized MVP rules
- `tech-stack.md` — locked technology and hosting choices
- `architecture.md` — application boundaries, data flow, deployment, and portability rules
- `database-schema.md` — planning-level data model and relationships
- `admin-spec.md` — mobile-first admin workflows
- `website-spec.md` — public website scope and behavior
- `responsive-spec.md` — responsive behavior for admin and public website
- `plans/phase-4-implementation.md` — client management implementation scope, API contract, privacy rules, and verification criteria
- `plans/phase-5-implementation.md` — appointment core, snapshots, scheduling/capacity rules, admin workflows, and verification criteria
- `plans/phase-6-implementation.md` — repeat-safe appointment completion, product/visit history, privacy, and verification criteria
- `phase-11-verification.md` — mobile admin implementation, fixture browser evidence, regressions and manual setup
- `plans/phase-11-implementation.md` — mobile admin shell/dashboard, existing workflow polish, accessibility, privacy and regression checks
- `plans/phase-10-implementation.md` — public website routes/Home, safe business/catalog APIs, static content, contact/location, responsive and acceptance checks
- `plans/phase-9-implementation.md` — privacy-safe interval/day availability, thresholds, timezone/DST and consistent reads
- `phase-9-verification.md` — availability implementation, regression results and public smoke checks
- `plans/phase-8-implementation.md` — public feedback, private moderation, visibility/privacy decisions and acceptance
- `phase-8-verification.md` — implemented feedback files, test results and manual setup
- `phase-7-verification.md` — implemented files, inventory migration baseline, checks, and pending manual verification
- `plans/phase-7-implementation.md` — product management, inventory ledger/baseline, stock-safe completion, and verification criteria

## Locked Architecture

- React + Vite + TypeScript
- FastAPI + Python
- Supabase PostgreSQL
- Supabase Auth
- Cloudflare Pages for frontend hosting
- Render for MVP backend hosting
- AWS Lambda as the production backend target

## MVP Scope Principle

Keep the MVP intentionally simple.

Do not add deferred features unless a concrete product requirement appears.

- `phase-10-verification.md` — public website, photography, API privacy and regression results
