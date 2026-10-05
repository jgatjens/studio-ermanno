# Phase 0 Implementation

## Goal

Establish the project foundation and prove that the locked stack works end-to-end before building business features.

Validate:

```text
React + Vite
    ↓
FastAPI
    ↓
Supabase PostgreSQL
```

and:

```text
React
  ↓
Supabase Auth
```

Do not implement clients, appointments, inventory, feedback, or public business features in this phase.

---

## Repository Structure

```text
project/
├── web/
├── api/
├── docs/
└── README.md
```

### `web/`
React + Vite frontend.

### `api/`
FastAPI backend.

### `docs/`
Planning and implementation documentation.

---

## Frontend Setup

Set up:

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui

Suggested structure:

```text
web/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── routes/
│   └── main.tsx
├── public/
├── .env.example
├── package.json
└── vite.config.ts
```

Keep the initial structure small.

Do not create domain folders for clients, appointments, products, or inventory yet.

---

## Initial Frontend Routes

Create only:

```text
/
```

Placeholder public page.

```text
/admin
```

Placeholder admin page.

No business UI is required.

---

## Frontend Environment Variables

Create `.env.example` with only values actually needed.

Suggested variables:

```text
VITE_API_BASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Rules:

- Do not commit real secrets.
- Never expose Supabase service-role credentials.
- Do not hardcode environment configuration.

---

## Frontend API Client

Create one small reusable API client.

Phase 0 responsibilities:

- Read backend base URL.
- Call `/health`.
- Handle basic success/error responses.

Do not add:

- Redux
- React Query
- Generated API clients
- Complex request abstractions

---

## FastAPI Setup

Set up:

- Python
- FastAPI
- Uvicorn
- Pydantic
- SQLAlchemy
- Alembic
- pytest

Suggested structure:

```text
api/
├── app/
│   ├── main.py
│   ├── core/
│   │   └── config.py
│   └── db/
│       └── session.py
├── migrations/
├── tests/
├── .env.example
├── alembic.ini
└── requirements.txt
```

Do not create business-domain modules yet.

---

## FastAPI Application

`app/main.py` should stay minimal.

Responsibilities:

- Create FastAPI app.
- Configure CORS.
- Register `/health`.
- Load configuration.
- Expose a standard ASGI app.

Conceptually:

```text
app.main:app
```

Do not add Render-specific or AWS-specific logic.

---

## Backend Environment Variables

Create `.env.example`.

Suggested variables:

```text
APP_ENV=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_AUDIENCE=
FRONTEND_ORIGIN=
LOG_LEVEL=
```

Only keep variables actually used by the implementation.

Rules:

- Do not commit secrets.
- Privileged Supabase credentials stay backend-only.
- Configuration comes from environment variables.
- Render-specific assumptions must not leak into app code.

---

## Configuration Layer

Create:

```text
app/core/config.py
```

Centralize validated settings for:

- Environment
- Database URL
- Supabase configuration
- Allowed frontend origin
- Logging level when used

Do not read environment variables throughout the codebase directly.

---

## Supabase Configuration

Create one Supabase MVP development project.

Use Supabase for:

- PostgreSQL
- Auth

Do not use Supabase Storage.

### PostgreSQL

Obtain the connection information required by SQLAlchemy and Alembic.

### Auth

Initialize the frontend Supabase Auth client.

Full login and authorization belong to Phase 2.

---

## Database Connection

Create centralized SQLAlchemy setup in:

```text
app/db/session.py
```

Responsibilities:

- Read `DATABASE_URL`.
- Create the engine.
- Provide centralized session handling.
- Avoid ad-hoc connections elsewhere.

Phase 0 does not need business tables.

---

## Alembic Setup

Configure Alembic against the same database configuration.

The objective is to prove:

```text
Alembic
   ↓
Supabase PostgreSQL
```

works correctly.

Prefer not to create throwaway application tables.

---

## Health Endpoint

Add:

```text
GET /health
```

Suggested response:

```json
{
  "status": "ok"
}
```

Do not expose:

- Secrets
- Database credentials
- Environment variables
- Detailed infrastructure information

---

## Optional Readiness Endpoint

Optionally add:

```text
GET /ready
```

to verify database connectivity.

This is not required for Phase 0.

Keep `/health` independent from database availability unless there is a strong reason otherwise.

---

## CORS

Configure FastAPI CORS through environment configuration.

Local development should allow the Vite frontend.

Production origins will be configured later.

Do not default production to unrestricted CORS.

---

## Frontend-to-Backend Connectivity

On the temporary public page, add a small connectivity indicator.

Example:

```text
API Status: Connected
```

Call:

```text
GET /health
```

through the reusable frontend API client.

Support:

- Loading
- Connected
- Error

This is temporary development UI.

---

## Supabase Auth Client Initialization

Initialize the frontend Supabase client using:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Phase 0 only needs to prove successful client initialization.

Do not build:

- Login UI
- Protected routes
- Roles
- Business membership
- Authorization

---

## Baseline Backend Tests

Set up pytest.

Minimum tests:

- FastAPI app loads.
- `/health` returns `200`.
- `/health` returns the expected shape.
- Configuration validation works.
- Database engine/session configuration initializes.

Avoid business fixtures.

---

## Baseline Frontend Tests

Set up:

- Vitest
- React Testing Library

Minimum tests:

- Application renders.
- Basic route renders.
- Health-status component handles success.
- Health-status component handles error.

Keep test coverage intentionally small.

---

## End-to-End Testing

Playwright may be installed/configured if convenient.

A full E2E suite is not required.

Optional smoke test:

```text
Open frontend
    ↓
Frontend loads
    ↓
Health request succeeds
```

---

## Local Development Workflow

The developer should be able to run:

```text
Frontend
→ local Vite server

Backend
→ local FastAPI/Uvicorn server

Database/Auth
→ hosted Supabase development project
```

Document commands in the root README.

---

## Root README

Add a concise README containing:

- Project purpose
- Repository structure
- Prerequisites
- Frontend setup
- Backend setup
- Environment files
- Local development commands
- Test commands
- Reference to `/docs`

Do not duplicate the full architecture docs.

---

## Phase 0 Validation Checklist

### Frontend

- [ ] React + Vite runs locally
- [ ] TypeScript passes
- [ ] React Router is configured
- [ ] Tailwind works
- [ ] shadcn/ui is available
- [ ] Frontend tests pass

### Backend

- [ ] FastAPI runs locally
- [ ] `/health` returns `200`
- [ ] Configuration loads from environment
- [ ] CORS works for local frontend
- [ ] Backend tests pass

### Supabase

- [ ] FastAPI connects to Supabase PostgreSQL
- [ ] Alembic connects to Supabase PostgreSQL
- [ ] Frontend Supabase Auth client initializes

### Integration

- [ ] Frontend successfully calls `/health`
- [ ] Loading/error/success connectivity states work

---

## Completion Criteria

Phase 0 is complete when this works locally:

```text
React + Vite
    |
    | HTTP
    v
FastAPI
    |
    v
Supabase PostgreSQL
```

and the frontend can initialize:

```text
React
  |
  v
Supabase Auth
```

All baseline tests must pass.

No business feature should be implemented yet.

---

## Explicitly Out of Scope

Do not implement:

- Client models
- Appointment models
- Services
- Barbers
- Products
- Inventory
- Feedback
- Business hours
- Admin login flow
- Owner/Staff authorization
- Public website sections
- Availability logic
- Gallery features
- Render deployment
- Cloudflare deployment
- AWS Lambda
- Docker unless needed to unblock local development
