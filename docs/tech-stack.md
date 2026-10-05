# Tech Stack

## Frontend

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui
- TanStack Query for admin API data (from Phase 3)

The frontend contains both:

- Public website
- Private mobile-first admin application

### Frontend Hosting

- Cloudflare Pages

Gallery images, business images, and other website imagery are static frontend assets deployed with the React + Vite application.

---

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

FastAPI is the main application backend.

It is responsible for:

- Business logic
- Authorization
- Validation
- Client management
- Appointment management
- Service management
- Barber/service-provider management
- Product management
- Inventory management
- Feedback management
- Database access

### MVP Backend Hosting

- Render

Render is used for the MVP because it is simple to deploy and supports a low-cost development and validation phase.

### Production Backend Target

- AWS Lambda

The FastAPI application should remain hosting-provider independent so the production migration is primarily an infrastructure change rather than an application rewrite.

---

## Platform Services

### Supabase PostgreSQL

Used as the primary relational database.

### Supabase Auth

Used for authentication and session management.

Supabase Storage is not part of the MVP architecture.

---

## Authentication Roles

The MVP supports:

- Owner
- Staff

### Owner

Owners have full admin access.

The business may have multiple Owner users.

### Staff

Staff users have limited read-only admin access.

Staff may see:

- Client name
- Appointment history
- Services
- Products used
- Appointment notes

Staff may not see:

- Client email
- Client phone
- General private client notes
- Visit notes

Staff cannot modify admin data.

Admin users and service providers are separate concepts.

---

## Service Providers

Barber / Service Provider profiles represent people who perform services.

A Barber may exist without admin access.

For the MVP:

- All active Barbers share the same business hours.
- All active Barbers can perform all active services.
- Barber-specific schedules are not required.
- Barber-specific service assignments are not required.

---

## Testing

### Frontend

- Vitest
- React Testing Library
- Playwright

### Backend

- pytest

Detailed testing coverage and CI behavior will be defined during implementation planning.

---

## Architecture Rule

Core business data must go through FastAPI.

React should not directly read or write core PostgreSQL business tables.

The frontend may communicate directly with Supabase Auth for authentication and session handling.

FastAPI must validate authentication and authorization before allowing protected operations.

---

## Deployment Model

### MVP

```text
React + Vite
Cloudflare Pages
      |
      v
FastAPI
Render
      |
      v
Supabase
├── PostgreSQL
└── Auth
```

### Production Target

```text
React + Vite
Cloudflare Pages
      |
      v
FastAPI
AWS Lambda
      |
      v
Supabase
├── PostgreSQL
└── Auth
```

---

## Static Images

Website images are static frontend assets.

Examples:

- Gallery images
- Hero images
- Business images
- Decorative photography

They are deployed with the React application through Cloudflare Pages.

Dynamic image uploads and media management are outside the MVP.

---

## Deferred Decisions

The following do not need to be finalized before implementation begins:

- Exact AWS Lambda deployment tooling
- Docker strategy
- CI/CD provider and workflow
- Monitoring provider
- Logging provider
- Map provider
- Notification provider
- Exact calendar library
- PWA behavior
- Rate limiting strategy

## Admin frontend state management

Decision accepted on 2026-10-04: auth/session/actor state stays in React Context; form drafts and UI controls use local React state. TanStack Query manages admin API data, caching, loading/error states, and invalidation after successful mutations from Phase 3. Query keys include the backend actor/business identity. Private caches are disposed on logout or actor changes. Redux and Zustand are not required. All business requests still go through the centralized FastAPI API client; backend authorization remains authoritative.
