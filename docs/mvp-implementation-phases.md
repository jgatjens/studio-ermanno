# MVP Implementation Phases

## Goal

Build the smallest useful version of the hair business platform in a sequence that keeps the system testable and deployable at every stage.

The MVP contains:

- Public React + Vite website
- Mobile-first admin
- FastAPI backend
- Supabase PostgreSQL
- Supabase Auth
- Cloudflare Pages frontend hosting
- Render backend hosting

Production migration to AWS Lambda is intentionally deferred until after the MVP is stable.

---

# Phase 0 — Project Foundation

## Goal

Create the frontend/backend project structure and establish the basic development environment.

## Build

### Repository Structure

```text
project/
├── web/
├── api/
└── docs/
```

### Frontend

Set up:

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui

### Backend

Set up:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- pytest

### Supabase

Create the MVP Supabase project for:

- PostgreSQL
- Auth

### Configuration

Create environment-based configuration for:

- Frontend API URL
- Supabase public authentication configuration
- Database connection
- Backend Supabase authentication configuration
- CORS origins
- Environment name

## Done When

- React application runs locally.
- FastAPI runs locally.
- Frontend can call a simple FastAPI health endpoint.
- FastAPI can connect to Supabase PostgreSQL.
- Alembic is configured.
- Frontend and backend tests can run.

## Do Not Build Yet

- Business tables
- Authentication UI
- Admin screens
- Public website content

---

# Phase 1 — Database Foundation

## Goal

Implement the minimum persistent data model required by the MVP.

## Build

Create models and migrations for:

- Business
- Admin User / Business Membership
- Hairdresser / Service Provider
- Client
- Service
- Appointment
- Appointment Service
- Product
- Appointment Product
- Inventory Movement
- Feedback
- Business Hours

## Core Rules to Encode

- Business ownership is explicit.
- A hairdresser is separate from an authenticated admin user.
- A client must exist before an appointment can reference them.
- Appointments can contain multiple services.
- Hairdresser assignment is optional.
- Historical service values are preserved on appointments.
- Products can be active and separately marked for public visibility.
- Every inventory change creates an inventory movement.

## Seed Data

Create simple development seed data:

- One business
- Two Owner users
- One Staff user
- Two Hairdressers
- A few clients
- A few services
- A few products
- Shared business hours

## Done When

- Migrations run successfully on a clean database.
- Seed data can be loaded repeatedly in development.
- Core relationships are verified with backend tests.

---

# Phase 2 — Authentication and Authorization

## Goal

Protect the admin before building operational features.

## Build

### Supabase Auth

Implement:

- Login
- Logout
- Session restoration

### FastAPI Authentication

FastAPI validates authenticated Supabase users.

### Authorization

Support:

- Owner
- Staff

### Owner

Can read and modify all MVP admin data.

### Staff

Read-only.

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

## Frontend

Create:

- Login page
- Protected admin routes
- Basic admin shell
- Role-aware UI

## Done When

- Unauthenticated users cannot access admin routes.
- FastAPI rejects unauthorized protected requests.
- Owner can access protected data.
- Staff receives filtered client data.
- Staff cannot perform mutations.
- Role restrictions are tested in FastAPI.

---

# Phase 3 — Services, Hairdressers, and Business Hours

## Goal

Create the configuration required before appointments can work properly.

## Build

### Services

Owner can:

- Create
- Edit
- Activate
- Deactivate

Service fields:

- Name
- Description
- Duration
- Price
- Active status

### Hairdressers

Owner can:

- Create
- Edit
- Activate
- Deactivate

MVP rules:

- All active hairdressers share business hours.
- All active hairdressers can perform all active services.

### Business Hours

Owner can configure:

- Day
- Opening time
- Closing time
- Closed day

## Admin UI

Create simple mobile-first screens for:

- Services
- Hairdressers
- Business hours

## Done When

- Active services can be retrieved for appointment creation.
- Active hairdressers can be retrieved for assignment.
- Shared business hours are available to scheduling logic.
- Inactive records remain available for historical data.

---

# Phase 4 — Client Management

## Goal

Build the client workflow before appointments.

## Build

### Backend

Support:

- Create client
- Update client
- Search clients
- View client profile

### Search

Search by:

- First name
- Last name
- Email
- Phone

### Client Profile

Prepare the API to return:

- Contact information
- General notes
- Last completed visit
- Appointment history
- Services
- Products used
- Visit notes

Role filtering must apply.

### Admin UI

Build:

- Client list
- Search
- Create client
- Edit client
- Client profile

## Done When

- Owner can create and update clients.
- Owner can search clients.
- Staff can search and view permitted client data.
- Staff cannot see restricted fields.
- Client profile works well on mobile.

---

# Phase 5 — Appointment Core

## Goal

Build the central operational workflow.

## Build

### Appointment Creation

Require:

- Existing client
- Date/time
- One or more services

Optional:

- Hairdresser
- Appointment notes

### Automatic Calculation

Calculate:

- Duration from selected services
- Price from selected services

Owner can override:

- Final duration
- Final price

### Appointment Status

Support:

- Scheduled
- Confirmed
- Completed
- Cancelled
- No Show

### Hairdresser Rules

- Different hairdressers can overlap.
- The same hairdresser cannot have overlapping active appointments.
- An appointment may remain unassigned.
- An unassigned appointment reserves one generic hairdresser slot.

### Admin UI

Build:

- Today view
- Appointment list
- Create appointment
- Appointment detail
- Edit appointment
- Confirm
- Cancel
- Mark no-show

## Done When

- Owner can create an appointment for an existing client.
- Multiple services work.
- Price and duration calculate automatically.
- Owner overrides work.
- Hairdresser assignment is optional.
- Overlap validation works.
- Staff can view appointments but cannot modify them.

---

# Phase 6 — Appointment Completion and Client History

## Goal

Turn completed appointments into useful client history.

## Build

### Completion Workflow

Owner can confirm:

- Services performed
- Products used
- Products sold
- Visit notes

### Client History

Completed appointments become visible in:

- Last visit
- Visit history

History shows:

- Date
- Services
- Products
- Visit notes for Owner

Staff receives only permitted history information.

### Historical Accuracy

Appointment history must preserve:

- Service name
- Price
- Duration
- Final appointment price
- Final appointment duration

## Done When

- Completing an appointment updates client history.
- Last visit is derived from completed appointments.
- Historical values do not change when service definitions change later.
- Role-based visibility still works.

---

# Phase 7 — Products and Inventory

## Goal

Add the minimum inventory workflow needed by the business.

## Build

### Products

Owner can:

- Create
- Edit
- Activate
- Deactivate

Product fields include:

- Name
- Brand
- Category
- Description
- Cost price
- Retail price
- Current stock
- Minimum stock
- Public visibility

### Inventory Movements

Support:

- Stock In
- Used
- Sold
- Adjustment
- Damaged

### Stock Rule

Every stock change must:

1. Create an inventory movement.
2. Update the product's current stock balance.

### Appointment Integration

When products are recorded as used or sold during appointment completion:

- Create appointment-product history.
- Create the corresponding inventory movement.
- Update current stock.

## Admin UI

Build:

- Product list
- Product form
- Inventory list
- Low-stock state
- Add stock
- Adjustment
- Damaged stock
- Inventory history

## Done When

- Stock cannot change without an inventory movement.
- Appointment product usage changes inventory once.
- Low-stock items are easy to identify.
- Inventory history is traceable.

---

# Phase 8 — Feedback

## Goal

Add the simple public feedback → admin moderation → public display workflow.

## Build

### Public Submission

Visitor can submit:

- Name
- Email
- Rating
- Comment

New feedback starts as:

- Pending
- Not public

### Admin

Owner can:

- View feedback
- Approve
- Reject
- Control public visibility

Staff can only view permitted feedback information.

### Public Display

Only show feedback that is:

- Approved
- Publicly visible

## Done When

- Public feedback submission works.
- New feedback never appears automatically.
- Owner moderation works.
- Rejected/pending feedback cannot appear publicly.

---

# Phase 9 — Public Availability

## Goal

Expose privacy-safe business availability without online booking.

## Build

### Availability Calculation

Use:

- Shared business hours
- Active hairdresser count
- Assigned appointments
- Unassigned appointment capacity

Rules:

- Assigned appointment occupies its barber.
- Unassigned appointment consumes one generic hairdresser slot.
- Business can still have availability if another slot remains.
- No hairdresser names are exposed publicly.

### Public States

Support:

- Available
- Limited
- Full
- Closed

The exact Available vs. Limited threshold can stay simple and be finalized during implementation.

## Public UI

Build a mobile-friendly availability calendar or date list.

## Done When

- Public users can see availability.
- No client data is exposed.
- No hairdresser names are exposed.
- Availability reflects overlapping hairdresser capacity.
- No booking action exists.

---

# Phase 10 — Public Website

## Goal

Complete the customer-facing website using the backend features already built.

## Build

### Pages / Sections

- Home
- Services
- Products
- Gallery
- Availability
- FAQ
- Contact
- Feedback
- Address / Map

### Services

Show active services only.

### Products

Show products only when:

- Active
- Public visibility enabled

Never expose:

- Cost price
- Current stock
- Minimum stock
- Inventory history

### Gallery

Use static frontend assets only.

### Contact

Display configured business contact details.

### Feedback

Show approved, public feedback only.

## Done When

- Public site is usable on mobile and desktop.
- Static gallery assets load correctly.
- Public/private data boundaries are respected.
- No admin-only information is exposed.

---

# Phase 11 — Mobile Admin Polish

## Goal

Make the admin practical for daily phone use without adding new features.

## Improve

- Bottom/compact mobile navigation
- Dashboard hierarchy
- Today's appointments
- Client search speed
- Appointment form usability
- Appointment completion usability
- Inventory actions
- Feedback moderation
- Loading states
- Error states
- Empty states
- Confirmation flows

## Accessibility

Verify:

- Touch target size
- Keyboard support
- Focus states
- Form labels
- Contrast
- No essential hover-only interactions

## Done When

The main Owner flows can be completed comfortably on a phone:

1. Find client.
2. Create appointment.
3. View today's schedule.
4. Complete appointment.
5. Review client history.
6. Update inventory.
7. Moderate feedback.

---

# Phase 12 — MVP Deployment

## Goal

Deploy the validated MVP using the locked hosting architecture.

## Frontend

Deploy React + Vite to:

- Cloudflare Pages

## Backend

Deploy FastAPI to:

- Render

## Platform

Use:

- Supabase PostgreSQL
- Supabase Auth

## Configure

- Production environment variables
- CORS
- Database migrations
- Supabase authentication configuration
- Frontend API URL
- Health check
- Basic production logging

## Verify

Run smoke tests for:

- Login
- Client creation/search
- Appointment creation
- Hairdresser conflict handling
- Appointment completion
- Inventory update
- Feedback submission/moderation
- Public availability
- Public services/products

## Done When

The MVP can be used end-to-end from the deployed frontend.

---

# Phase 13 — Production Readiness Later

## Not Part of Initial MVP Build

Do not block MVP launch on:

- AWS Lambda migration
- Docker
- CI/CD automation
- Advanced monitoring
- Push notifications
- SMS
- WhatsApp automation
- Online booking
- Payments
- Per-barber schedules
- Barber-specific services
- Holiday scheduling
- Advanced analytics
- Loyalty programs
- Accounting
- Dynamic gallery management
- Offline support

After the MVP is stable, the FastAPI backend can be moved from Render to AWS Lambda while preserving the application architecture.

---

# Recommended Build Order

```text
Phase 0   Project Foundation
    ↓
Phase 1   Database Foundation
    ↓
Phase 2   Authentication & Authorization
    ↓
Phase 3   Services, Barbers & Business Hours
    ↓
Phase 4   Clients
    ↓
Phase 5   Appointment Core
    ↓
Phase 6   Completion & Client History
    ↓
Phase 7   Products & Inventory
    ↓
Phase 8   Feedback
    ↓
Phase 9   Public Availability
    ↓
Phase 10  Public Website
    ↓
Phase 11  Mobile Admin Polish
    ↓
Phase 12  MVP Deployment
```

Phase 13 is post-MVP production work and should not delay the MVP.
