# MVP Task Checklist

## Phase 0 — Project Foundation

**Depends on:** Nothing

### Tasks

- [ ] Create repository structure: `web/`, `api/`, `docs/`
- [ ] Set up React + Vite + TypeScript
- [ ] Set up React Router
- [ ] Set up Tailwind CSS
- [ ] Set up shadcn/ui
- [ ] Set up FastAPI
- [ ] Set up Pydantic
- [ ] Set up SQLAlchemy
- [ ] Set up Alembic
- [ ] Set up pytest
- [ ] Create Supabase project
- [ ] Configure Supabase PostgreSQL
- [ ] Configure Supabase Auth
- [ ] Add environment-based configuration
- [ ] Add FastAPI `/health` endpoint
- [ ] Connect frontend to backend locally
- [ ] Configure frontend and backend test commands

### Completion Criteria

- [ ] React app runs locally
- [ ] FastAPI runs locally
- [ ] Frontend can call `/health`
- [ ] FastAPI can connect to Supabase PostgreSQL
- [ ] Alembic runs successfully
- [ ] Frontend tests run
- [ ] Backend tests run

---

## Phase 1 — Database Foundation

**Depends on:** Phase 0

### Tasks

- [ ] Create Business model
- [ ] Create Admin User / Business Membership model
- [ ] Create Barber / Service Provider model
- [ ] Create Client model
- [ ] Create Service model
- [ ] Create Appointment model
- [ ] Create Appointment Service model
- [ ] Create Product model
- [ ] Create Appointment Product model
- [ ] Create Inventory Movement model
- [ ] Create Feedback model
- [ ] Create Business Hours model
- [ ] Add migrations
- [ ] Add seed data
- [ ] Add database relationship tests

### Completion Criteria

- [ ] Clean database can be created from migrations
- [ ] Seed data loads successfully
- [ ] Core relationships are valid
- [ ] Business ownership is enforced in the data model

---

## Phase 2 — Authentication & Authorization

**Depends on:** Phase 1

### Tasks

- [ ] Add Supabase login
- [ ] Add logout
- [ ] Restore frontend sessions
- [ ] Validate Supabase tokens in FastAPI
- [ ] Map authenticated users to business membership
- [ ] Add Owner authorization
- [ ] Add Staff authorization
- [ ] Add protected admin routes
- [ ] Add basic admin shell
- [ ] Add role-aware frontend rendering
- [ ] Add backend authorization tests

### Completion Criteria

- [ ] Unauthenticated users cannot access admin data
- [ ] Owner can read and modify protected data
- [ ] Staff is read-only
- [ ] Staff cannot see restricted client fields
- [ ] Authorization is enforced by FastAPI, not only the UI

---

## Phase 3 — Services, Barbers & Business Hours

**Depends on:** Phase 2

### Tasks

- [ ] Build Service CRUD
- [ ] Add service activate/deactivate
- [ ] Build Barber CRUD
- [ ] Add barber activate/deactivate
- [ ] Build Business Hours management
- [ ] Build mobile-first admin screens for services
- [ ] Build mobile-first admin screens for barbers
- [ ] Build business-hours settings screen

### Completion Criteria

- [ ] Active services can be retrieved
- [ ] Active barbers can be retrieved
- [ ] All barbers use shared business hours
- [ ] Inactive records remain valid for history

---

## Phase 4 — Clients

**Depends on:** Phase 2

### Tasks

- [ ] Create client
- [ ] Update client
- [ ] Search clients
- [ ] View client profile
- [ ] Add search by name
- [ ] Add search by email
- [ ] Add search by phone
- [ ] Add Owner client view
- [ ] Add Staff filtered client view
- [ ] Build client list UI
- [ ] Build client search UI
- [ ] Build create/edit client UI
- [ ] Build client profile UI

### Completion Criteria

- [ ] Owner can create and edit clients
- [ ] Client search works
- [ ] Staff sees only allowed client fields
- [ ] Client profile works well on mobile

---

## Phase 5 — Appointment Core

**Depends on:** Phases 3 and 4

### Tasks

- [ ] Create appointment endpoint
- [ ] Require existing client
- [ ] Support multiple services
- [ ] Support optional barber assignment
- [ ] Auto-calculate duration
- [ ] Auto-calculate price
- [ ] Allow Owner duration override
- [ ] Allow Owner price override
- [ ] Add appointment statuses
- [ ] Add barber overlap validation
- [ ] Reserve one generic barber slot for unassigned appointments
- [ ] Build today view
- [ ] Build appointment list
- [ ] Build create appointment UI
- [ ] Build appointment detail UI
- [ ] Build edit appointment UI
- [ ] Add confirm action
- [ ] Add cancel action
- [ ] Add no-show action

### Completion Criteria

- [ ] Appointment can be created for an existing client
- [ ] Multiple services work
- [ ] Duration and price auto-calculate
- [ ] Owner overrides work
- [ ] Barber assignment is optional
- [ ] Same barber cannot overlap active appointments
- [ ] Different barbers can overlap
- [ ] Staff can view but not modify appointments

---

## Phase 6 — Appointment Completion & Client History

**Depends on:** Phase 5

### Tasks

- [ ] Add complete appointment action
- [ ] Record services performed
- [ ] Record products used
- [ ] Record products sold
- [ ] Record visit notes
- [ ] Build completion UI
- [ ] Derive last visit
- [ ] Build visit history
- [ ] Preserve historical service name
- [ ] Preserve historical service price
- [ ] Preserve historical service duration
- [ ] Preserve final appointment price
- [ ] Preserve final appointment duration

### Completion Criteria

- [ ] Completed appointments appear in client history
- [ ] Last visit is derived correctly
- [ ] Historical values do not change when services change
- [ ] Staff visibility rules still apply

---

## Phase 7 — Products & Inventory

**Depends on:** Phase 6

### Tasks

- [ ] Build Product CRUD
- [ ] Add product activate/deactivate
- [ ] Add public visibility flag
- [ ] Add current stock
- [ ] Add minimum stock
- [ ] Add Stock In movement
- [ ] Add Used movement
- [ ] Add Sold movement
- [ ] Add Adjustment movement
- [ ] Add Damaged movement
- [ ] Update current stock from movements
- [ ] Connect appointment products to inventory movements
- [ ] Prevent duplicate inventory deduction
- [ ] Build product list UI
- [ ] Build inventory list UI
- [ ] Build add stock UI
- [ ] Build adjustment UI
- [ ] Build damaged-stock UI
- [ ] Build inventory history UI
- [ ] Add low-stock state

### Completion Criteria

- [ ] Every stock change creates an inventory movement
- [ ] Current stock matches movement history
- [ ] Appointment product usage updates inventory once
- [ ] Low-stock products are visible

---

## Phase 8 — Feedback

**Depends on:** Phase 2

### Tasks

- [ ] Add public feedback submission
- [ ] Store new feedback as Pending
- [ ] Default public visibility to false
- [ ] Build admin feedback list
- [ ] Build feedback detail
- [ ] Add approve action
- [ ] Add reject action
- [ ] Add public visibility control
- [ ] Add public feedback query

### Completion Criteria

- [ ] Public users can submit feedback
- [ ] New feedback never appears automatically
- [ ] Owner can moderate feedback
- [ ] Only approved + public feedback is returned publicly

---

## Phase 9 — Public Availability

**Depends on:** Phases 3 and 5

### Tasks

- [ ] Calculate business availability from business hours
- [ ] Count active barbers
- [ ] Apply assigned appointment capacity
- [ ] Apply unassigned appointment capacity
- [ ] Return Available / Limited / Full / Closed
- [ ] Hide barber names
- [ ] Hide client data
- [ ] Build mobile-friendly availability UI

### Completion Criteria

- [ ] Availability reflects actual barber capacity
- [ ] Unassigned appointments consume one slot
- [ ] Public response contains no private data
- [ ] No booking action exists

---

## Phase 10 — Public Website

**Depends on:** Phases 3, 7, 8, and 9

### Tasks

- [ ] Build Home
- [ ] Build Services
- [ ] Build Products
- [ ] Build Gallery
- [ ] Build Availability
- [ ] Build FAQ
- [ ] Build Contact
- [ ] Build Feedback
- [ ] Build Address / Map section
- [ ] Add static gallery assets
- [ ] Show active services only
- [ ] Show active + public products only
- [ ] Hide inventory/internal product data
- [ ] Show approved + public feedback only

### Completion Criteria

- [ ] Public site works on mobile and desktop
- [ ] Static images load correctly
- [ ] Public/private data boundaries are respected
- [ ] No admin-only data is exposed

---

## Phase 11 — Mobile Admin Polish

**Depends on:** Phases 4–8

### Tasks

- [ ] Finalize mobile navigation
- [ ] Improve dashboard hierarchy
- [ ] Improve today view
- [ ] Improve client search UX
- [ ] Improve appointment form UX
- [ ] Improve completion UX
- [ ] Improve inventory actions
- [ ] Improve feedback moderation UX
- [ ] Add loading states
- [ ] Add empty states
- [ ] Add error states
- [ ] Add confirmations for destructive actions
- [ ] Verify touch targets
- [ ] Verify keyboard support
- [ ] Verify focus states
- [ ] Verify labels and contrast

### Completion Criteria

- [ ] Owner can complete core workflows comfortably on a phone
- [ ] No essential action depends on hover
- [ ] Core screens are usable without horizontal scrolling

---

## Phase 12 — MVP Deployment

**Depends on:** Phases 0–11

### Tasks

- [ ] Deploy frontend to Cloudflare Pages
- [ ] Deploy FastAPI to Render
- [ ] Configure production Supabase
- [ ] Configure production environment variables
- [ ] Configure CORS
- [ ] Run production migrations
- [ ] Configure Supabase Auth redirects
- [ ] Configure frontend API URL
- [ ] Configure backend health check
- [ ] Add basic production logging
- [ ] Run deployment smoke tests

### Smoke Tests

- [ ] Login
- [ ] Client create/search
- [ ] Appointment creation
- [ ] Barber conflict handling
- [ ] Appointment completion
- [ ] Inventory update
- [ ] Feedback submission
- [ ] Feedback moderation
- [ ] Public availability
- [ ] Public services/products

### Completion Criteria

- [ ] MVP works end-to-end in deployed environments
- [ ] Core Owner workflows pass smoke testing
- [ ] Public website loads correctly
- [ ] No known blocker remains for real MVP use

---

# Post-MVP — Do Not Block Launch

**Depends on:** Stable MVP

- [ ] AWS Lambda migration
- [ ] Docker
- [ ] CI/CD automation
- [ ] Advanced monitoring
- [ ] Push notifications
- [ ] SMS
- [ ] WhatsApp automation
- [ ] Online booking
- [ ] Payments
- [ ] Per-barber schedules
- [ ] Barber-specific services
- [ ] Holiday scheduling
- [ ] Advanced analytics
- [ ] Loyalty programs
- [ ] Accounting
- [ ] Dynamic gallery management
- [ ] Offline support
