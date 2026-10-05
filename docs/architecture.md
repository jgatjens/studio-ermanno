# Architecture

## 1. Purpose

This document defines the high-level architecture for the hair business platform.

The system contains:

- A public website
- A private mobile-first admin application
- A Python backend API
- Supabase PostgreSQL and authentication

The architecture should remain simple for the MVP while allowing the FastAPI backend to move from Render to AWS Lambda later without changing core business logic.

---

## 2. Locked Technology Stack

### Frontend

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui
- TanStack Query for admin API data (from Phase 3)

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

### Platform Services

- Supabase PostgreSQL
- Supabase Auth

### Hosting

#### MVP

- Frontend: Cloudflare Pages
- Backend: Render
- Database/Auth: Supabase

#### Production Target

- Frontend: Cloudflare Pages
- Backend: AWS Lambda
- Database/Auth: Supabase

---

## 3. High-Level Architecture

```text
Users
  |
  v
React + Vite
Cloudflare Pages
  |
  | HTTPS / REST API
  v
FastAPI
Render during MVP
  |
  +-------------------+
  |                   |
  v                   v
Supabase PostgreSQL   Supabase Auth
```

Production target:

```text
Users
  |
  v
React + Vite
Cloudflare Pages
  |
  | HTTPS / REST API
  v
FastAPI
AWS Lambda
  |
  +-------------------+
  |                   |
  v                   v
Supabase PostgreSQL   Supabase Auth
```

---

## 4. Application Boundaries

### 4.1 Frontend Boundary

The React application owns presentation and user interaction.

It contains both:

- Public website
- Private admin

The frontend is responsible for:

- Rendering pages
- Navigation
- Forms
- Client-side validation
- User interactions
- Authentication UI
- Session handling
- Calling the FastAPI API
- Displaying API responses and errors
- Serving static website images and gallery assets

The frontend should not contain core business rules.

Examples of logic that should not live in React:

- Determining whether an appointment transition is valid
- Calculating inventory changes
- Deciding whether a user is authorized to update business data
- Managing client history
- Updating stock based on appointment completion

### 4.2 Backend Boundary

FastAPI is the main application backend.

FastAPI owns:

- Business logic
- Authorization
- API validation
- Client management
- Appointment management
- Service management
- Product management
- Inventory rules
- Feedback rules
- Database access

The backend should be the authoritative layer for all business operations.

### 4.3 Supabase Boundary

Supabase provides infrastructure services.

#### PostgreSQL

Stores application data.

#### Auth

Handles:

- Authentication
- User identity
- Sessions
- Authentication tokens

Supabase should provide infrastructure, but it should not replace the FastAPI business layer.

---

## 5. Frontend Application Areas

The frontend is a single React application.

```text
React Application
|
├── Public Website
|
└── Admin
```

### Public Website

Initial areas:

- Home
- Services
- Products
- Gallery
- Availability
- FAQ
- Contact
- Feedback
- Address and map

### Admin

Initial areas:

- Dashboard
- Clients
- Calendar
- Services
- Products
- Inventory
- Feedback
- Settings

The admin is designed mobile-first.

---

## 6. Core Data Flow

### 6.1 Public Data

```text
Visitor opens Services
        |
        v
React
        |
        v
GET /services
        |
        v
FastAPI
        |
        v
PostgreSQL
        |
        v
FastAPI response
        |
        v
React UI
```

Public endpoints may not require authentication.

### 6.2 Admin Authentication

```text
Admin
  |
  v
React Login
  |
  v
Supabase Auth
  |
  v
Session / Token
  |
  v
React
```

The frontend stores and manages the authenticated session using Supabase Auth.

### 6.3 Protected Admin Request

```text
React
  |
  | Authentication token
  v
FastAPI
  |
  v
Validate identity
  |
  v
Check authorization
  |
  v
Execute business logic
  |
  v
PostgreSQL
  |
  v
Return response
```

Supabase confirms who the user is.

FastAPI decides what the user is allowed to do.

---

## 7. Business Data Access Rule

A core architecture rule is:

> Core business data must go through FastAPI.

React should not directly read or write core business tables in PostgreSQL.

Correct:

```text
React
  ↓
FastAPI
  ↓
PostgreSQL
```

Avoid:

```text
React
  ↓
Supabase PostgreSQL directly
```

This keeps:

- Business rules centralized
- Authorization consistent
- Database implementation hidden from the frontend
- The API reusable
- Testing easier

---

## 8. Authentication Flow

Supabase Auth handles authentication.

FastAPI should validate authenticated requests before allowing protected operations.

```text
Login
  ↓
Supabase Auth
  ↓
Access token
  ↓
React sends token
  ↓
FastAPI validates token
  ↓
Authorized API request
```

Initial authentication is only required for the private admin.

The public website should not require authentication.

---

## 8.1 Admin Roles and Service Providers

Authentication users and service providers are separate concepts.

### Admin Roles

The MVP supports two authenticated admin roles:

- Owner
- Staff

Owners have full admin access.

Staff users are read-only and have limited visibility into private client information.

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

### Service Providers

Barbers/service providers are represented as staff profiles separate from authenticated admin users.

A barber may exist without having admin access.

For the MVP:

- All barbers follow the same business hours.
- All barbers can perform all active services.
- Barber-specific working hours are not required.
- Barber-specific service assignments are not required.

Appointments reference a client and may reference a barber.

The client must already exist before the appointment is created.

A barber may be assigned when the appointment is created or later.

---

## 9. Static Image Handling

Gallery and business images are static frontend assets.

They are not stored in Supabase and are not managed through the backend in the initial version.

Images should live with the frontend application and be deployed with the React + Vite build.

```text
React source
   |
   └── Static image assets
            |
            v
     Cloudflare Pages
```

Initial use cases include:

- Gallery images
- Business images
- Decorative website imagery

Because these assets are static, changing them requires a frontend update and redeployment.

Dynamic image uploads and admin-managed media are not part of the initial version.

---

## 9.1 Appointment Capacity and Public Availability

Appointment capacity is based on active barbers.

Rules:

- Different barbers may have appointments at the same time.
- The same barber cannot have overlapping active appointments.
- An appointment may be saved without a barber.
- An unassigned appointment reserves one generic barber slot for its scheduled time.
- Public availability does not expose barber names.
- Public availability represents business-level capacity across all active barbers.

An appointment may contain multiple services.

By default:

- Appointment duration is calculated from the selected services.
- Appointment price is calculated from the selected services.

An Owner may override the calculated appointment duration or price for a specific appointment.

Historical appointment values must remain unchanged if service definitions later change.

---

## 10. Backend Internal Structure

FastAPI should be organized by business domain.

```text
app/
├── core/
├── db/
├── auth/
├── clients/
├── appointments/
├── services/
├── products/
├── inventory/
└── feedback/
```

Each business module may contain:

```text
router
schemas
service
repository
```

### Router

Handles:

- HTTP requests
- Authentication dependencies
- Request validation
- Response formatting

### Service

Handles:

- Business rules
- Authorization decisions
- State transitions
- Coordination between repositories

### Repository

Handles:

- Database queries
- Persistence

---

## 11. Business Logic Separation

Business rules should remain independent from HTTP routing.

```text
HTTP request
    ↓
Appointment router
    ↓
Appointment service
    ↓
Appointment repository
    ↓
PostgreSQL
```

The appointment service should not care whether it was called from:

- Render
- AWS Lambda
- Tests
- A future CLI
- Another internal integration

---

## 12. Configuration

Application configuration must come from environment variables.

Examples:

- Environment
- Database connection
- Supabase configuration
- Allowed frontend origins
- Logging configuration

```text
Local
→ local environment

Render
→ Render environment configuration

AWS
→ AWS environment / secret configuration
```

Business code should not contain hosting-provider-specific configuration.

---

## 13. Deployment Environments

### Local Development

```text
React
→ Vite local development server

FastAPI
→ Local Python server

Supabase
→ Hosted development project
```

Environment configuration should be separated from source code.

### MVP Environment

```text
Cloudflare Pages
      |
      v
Render FastAPI
      |
      v
Supabase
```

Purpose:

- MVP validation
- Early business use
- Low infrastructure cost
- Simple deployments

The Render free-tier cold start is acceptable during this stage.

### Production Environment

```text
Cloudflare Pages
      |
      v
AWS Lambda
      |
      v
Supabase
```

The production migration should mainly change deployment infrastructure rather than application architecture.

---

## 14. Backend Portability Rules

The FastAPI backend must remain independent from Render.

### Rule 1 — Standard FastAPI Application

FastAPI should remain a normal ASGI application.

Hosting-specific logic should not exist inside business modules.

### Rule 2 — Environment-Based Configuration

Configuration must come from environment variables.

Avoid:

- Hardcoded URLs
- Hardcoded credentials
- Render-specific environment assumptions

### Rule 3 — Stateless Application

The backend should not depend on local process memory for persistent business state.

Avoid storing:

- Sessions
- Client data
- Appointment data
- Inventory state

in application memory.

Persistent state belongs in PostgreSQL or another external service.

### Rule 4 — No Permanent Backend File Storage

The backend must not depend on local disk for permanent application data.

Website and gallery images are static frontend assets and are deployed with the React application.

Any temporary backend files should be treated as disposable.

### Rule 5 — Centralized Database Access

Database setup and sessions should be centralized.

Business modules should not create independent database connections.

This allows database connection behavior to be adjusted later for Lambda without changing domain logic.

### Rule 6 — Separate Infrastructure From Application

Deployment files should remain outside application modules.

```text
api/
├── app/
├── migrations/
├── tests/
├── render.yaml
├── Dockerfile
└── future AWS infrastructure
```

Render configuration should not leak into `app/`.

### Rule 7 — Business Logic Must Be Hosting Independent

Services should not know whether the application is running on:

- Localhost
- Render
- AWS Lambda

The hosting provider should be an infrastructure concern only.

---

## 15. Render MVP Deployment

The MVP backend runs as a standard FastAPI service.

```text
Git Repository
      ↓
Render
      ↓
Python dependencies
      ↓
FastAPI application
      ↓
Supabase
```

Render is chosen for:

- Simple deployment
- Fast iteration
- Low MVP cost
- Easy Git-based deployment

---

## 16. AWS Lambda Production Migration

The production target is AWS Lambda.

The preferred migration approach should preserve the existing FastAPI application.

```text
AWS Lambda
     ↓
HTTP adapter / runtime integration
     ↓
FastAPI
     ↓
Supabase
```

The migration should not require rewriting each FastAPI endpoint as a separate Lambda function.

The goal is to keep:

- Routers
- Services
- Repositories
- Validation
- Authorization
- Database logic

unchanged.

Only infrastructure and runtime configuration should need significant changes.

---

## 17. API Style

The frontend and backend communicate through HTTPS REST APIs.

Initial API domains should roughly follow the business model:

```text
/clients
/appointments
/services
/products
/inventory
/feedback
```

Detailed endpoint design belongs in a later API specification.

---

## 18. Error Handling

FastAPI should provide consistent error responses.

The frontend should not need to understand raw database errors.

```text
Database / Business Error
        ↓
FastAPI error handling
        ↓
Consistent API response
        ↓
React
```

Detailed error formats will be defined during API planning.

---

## 19. Security Boundaries

### Public Website

May access only public data.

### Admin

Requires authentication.

### FastAPI

Must validate authentication and authorization.

### PostgreSQL

Should not be directly exposed to the frontend for core business operations.

### Supabase Service Credentials

Privileged credentials must never be included in frontend code.

---

## 20. Architecture Principles

The project should follow these principles:

- Keep the architecture simple.
- Keep frontend and backend responsibilities clear.
- Keep business logic in FastAPI.
- Use Supabase for PostgreSQL and authentication only.
- Keep gallery and business images as static frontend assets.
- Keep the backend stateless.
- Design the admin mobile-first.
- Avoid unnecessary infrastructure.
- Optimize the MVP for fast development.
- Avoid Render-specific backend design.
- Make the Render-to-Lambda migration an infrastructure change rather than an application rewrite.

---

## 21. Deferred Architecture Decisions

The following do not need to be finalized yet:

- Exact AWS Lambda deployment tooling
- Docker strategy
- CI/CD pipeline
- Monitoring provider
- Logging provider
- Map provider
- Notification provider
- API versioning
- Rate limiting strategy
- Production database connection tuning
- Dynamic media management if needed in the future

## Admin frontend state management

Decision accepted on 2026-10-04: auth/session/actor state stays in React Context; form drafts and UI controls use local React state. TanStack Query manages admin API data, caching, loading/error states, and invalidation after successful mutations from Phase 3. Query keys include the backend actor/business identity. Private caches are disposed on logout or actor changes. Redux and Zustand are not required. All business requests still go through the centralized FastAPI API client; backend authorization remains authoritative.
