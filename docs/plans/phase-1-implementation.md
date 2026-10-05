# Phase 1 Implementation

## Goal

Implement the persistent data foundation for the MVP.

Phase 1 establishes:

- SQLAlchemy models
- Alembic migrations
- Business ownership relationships
- Historical snapshot fields
- Deterministic development seed data
- Baseline database tests

Do not implement authentication flows, API business workflows, or frontend business screens in this phase.

---

## Dependencies

Phase 1 requires Phase 0 to be complete:

- FastAPI project exists
- SQLAlchemy is configured
- Alembic is configured
- Supabase PostgreSQL connection works
- pytest works
- Environment configuration is centralized

---

## Models to Implement

Create these models:

- Business
- Admin User / Business Membership
- Barber / Service Provider
- Client
- Service
- Appointment
- Appointment Service
- Product
- Appointment Product
- Inventory Movement
- Feedback
- Business Hours

Do not add extra tables unless one is required by these relationships.

---

## Ownership Rules

All business-owned records must belong to a Business.

Business-owned entities include:

- Admin memberships
- Barbers
- Clients
- Services
- Appointments
- Products
- Inventory movements
- Feedback
- Business hours

Avoid globally shared operational records.

---

## Business

Required planning-level fields:

- id
- name
- phone
- email
- address
- timezone
- currency
- created_at
- updated_at

Optional public contact fields:

- whatsapp
- instagram
- description

Keep the model small. Do not add multi-location support.

---

## Admin User / Business Membership

Represents the link between a Supabase Auth user and a Business.

Supabase Auth owns identity.

The database owns application-level business membership and role.

### Fields

- id
- business_id
- auth_user_id
- role
- created_at
- updated_at

### Roles

- OWNER
- STAFF

### Rules

- A Business may have multiple Owners.
- Staff is read-only at the application layer.
- Do not implement field-level permission logic in Phase 1.
- Do not duplicate Supabase authentication profile data unless required.

---

## Barber / Service Provider

Represents a person who performs services.

A Barber is separate from an authenticated Admin User.

### Fields

- id
- business_id
- name
- is_active
- created_at
- updated_at

### MVP Rules

- Barbers do not require admin accounts.
- All active Barbers share the same business hours.
- All active Barbers can perform all active services.
- No barber-specific schedules.
- No barber-to-service mapping table.

---

## Client

### Fields

- id
- business_id
- first_name
- last_name
- email
- phone
- private_notes
- created_at
- updated_at

### Rules

- Email may be nullable.
- Phone may be nullable.
- Client history is not stored in a separate table.
- Last visit is not stored directly.
- Last visit is derived later from completed appointments.

---

## Service

### Fields

- id
- business_id
- name
- description
- duration_minutes
- price
- is_active
- created_at
- updated_at

### Rules

- Services should normally be deactivated rather than deleted.
- Historical appointment data must not depend on current Service values.

---

## Appointment

### Fields

- id
- business_id
- client_id
- barber_id nullable
- scheduled_start
- scheduled_end
- status
- appointment_notes
- visit_notes
- calculated_duration_minutes
- final_duration_minutes
- calculated_price
- final_price
- created_at
- updated_at

### Statuses

- SCHEDULED
- CONFIRMED
- COMPLETED
- CANCELLED
- NO_SHOW

### Rules

- Client is required.
- Barber is optional.
- Appointment business must match Client business.
- Appointment business must match Barber business when a Barber is assigned.
- Multiple services are represented through Appointment Service records.
- Final duration and final price must be stored separately from calculated values.
- Overlap rules belong to Phase 5 business logic.

---

## Appointment Service

Represents a Service attached to an Appointment.

### Fields

- id
- business_id
- appointment_id
- service_id
- service_name_snapshot
- service_price_snapshot
- service_duration_snapshot
- created_at

### Snapshot Rule

Preserve:

- Service name
- Service price
- Service duration

These values must remain unchanged if the Service later changes.

### Ownership Rule

Appointment, Service, and Appointment Service must belong to the same Business.

---

## Product

### Fields

- id
- business_id
- name
- brand
- category
- description
- sku
- cost_price
- retail_price
- current_stock
- minimum_stock
- is_active
- is_public
- created_at
- updated_at

### Rules

- `is_active` controls operational availability.
- `is_public` controls public website visibility.
- Inventory movement history remains separate.
- Do not add supplier or purchase-order data.

---

## Appointment Product

Represents a Product associated with an Appointment.

### Fields

- id
- business_id
- appointment_id
- product_id
- product_name_snapshot
- quantity
- usage_type
- created_at

### Usage Types

- USED
- SOLD

### Snapshot Rule

Store the product-name snapshot so historical visits remain understandable after Product changes.

### Ownership Rule

Appointment, Product, and Appointment Product must belong to the same Business.

---

## Inventory Movement

Represents one stock change.

### Fields

- id
- business_id
- product_id
- appointment_id nullable
- movement_type
- quantity
- notes
- created_at

### Movement Types

- STOCK_IN
- USED
- SOLD
- ADJUSTMENT
- DAMAGED

### Rules

- Every stock change must eventually create an Inventory Movement.
- `current_stock` on Product represents the latest balance.
- Automatic stock updates belong to later business-logic phases.
- Phase 1 only establishes the schema and relationships.

---

## Feedback

### Fields

- id
- business_id
- client_id nullable
- appointment_id nullable
- name
- email
- rating
- comment
- status
- is_public
- created_at
- updated_at

### Statuses

- PENDING
- APPROVED
- REJECTED

### Rules

- Client is optional.
- Appointment is optional.
- Public submissions can exist without a Client.
- New feedback defaults to PENDING.
- `is_public` defaults to false.
- Public visibility logic belongs to later phases.

---

## Business Hours

### Fields

- id
- business_id
- day_of_week
- opening_time
- closing_time
- is_closed
- created_at
- updated_at

### Rules

- One logical schedule row per Business/day.
- All active Barbers use the same Business Hours.
- Holiday overrides are out of scope.
- Split shifts are out of scope.

---

## Historical Snapshot Fields

Historical snapshots are required so past Appointments do not change when catalog data changes.

### Service Snapshots

Appointment Service stores:

- service_name_snapshot
- service_price_snapshot
- service_duration_snapshot

### Product Snapshot

Appointment Product stores:

- product_name_snapshot

### Appointment Totals

Appointment stores:

- calculated_duration_minutes
- final_duration_minutes
- calculated_price
- final_price

Do not calculate historical values dynamically from current Service or Product records.

---

## ID Strategy

Use one consistent primary-key strategy across application tables.

Recommended:

- UUIDs

Do not mix ID strategies without a strong reason.

---

## Timestamp Strategy

Use consistent timezone-aware timestamps.

Recommended:

- created_at
- updated_at

Do not add soft-delete timestamps unless a real business requirement appears.

`is_active` is sufficient for Services, Products, and Barbers in the MVP.

---

## Alembic Migrations

Create migrations for the full Phase 1 schema.

### Requirements

- Upgrade works on an empty database.
- Downgrade works where practical.
- Foreign keys are correct.
- Enum/status definitions are consistent.
- Obvious uniqueness constraints are included.
- Avoid advanced database features unless clearly required.

---

## Initial Constraints

At minimum, consider constraints for:

- Business Membership auth-user identity within a Business
- Business Hours day uniqueness per Business
- Non-negative duration values
- Valid rating range
- Non-negative minimum stock

Avoid putting later workflow rules into database constraints unless they are naturally data-integrity rules.

---

## Seed Data

Create deterministic development seed data.

The seed should be small and safe to rerun.

### Minimum Seed

#### Business

Create one Business.

Example:

```text
Name: Sample Hair Studio
Currency: EUR
```

Use a configurable development timezone.

#### Admin Memberships

Create placeholders for:

- Owner 1
- Owner 2
- Staff 1

Use clearly documented development auth-user identifiers.

Do not provision real Supabase Auth users in Phase 1.

#### Barbers

Create:

- Barber 1
- Barber 2

Both active.

#### Clients

Create about 5 sample Clients.

#### Services

Create:

- Haircut
- Beard Trim
- Haircut + Beard
- Hair Coloring

#### Products

Create a few Products, such as:

- Pomade
- Beard Oil
- Shampoo
- Hair Wax

Include:

- active status
- public visibility
- current stock
- minimum stock

#### Business Hours

Seed one weekly schedule.

Example:

- Monday–Saturday open
- Sunday closed

---

## Seed Principles

Seed data should be:

- Deterministic
- Development-only
- Easy to reset
- Small
- Useful for later API/UI testing

Avoid randomness where it makes tests difficult to reproduce.

Provide one documented command to load seed data.

Do not run seed automatically in production.

---

## Baseline Tests

Use pytest.

### Model Creation

Verify that these can be created:

- Business
- Admin Membership
- Barber
- Client
- Service
- Product
- Appointment
- Feedback
- Business Hours

### Relationships

Verify:

- Appointment links to a Client.
- Appointment can exist without a Barber.
- Appointment can link to a Barber.
- Appointment can have multiple Services.
- Appointment can have Products.
- Product can have Inventory Movements.

### Ownership

Test representative cross-business mismatches for:

- Client and Appointment
- Barber and Appointment
- Service and Appointment Service
- Product and Appointment Product

### Historical Snapshots

Example:

1. Create Service with price 25.
2. Create Appointment Service snapshot with price 25.
3. Change Service price to 30.
4. Snapshot remains 25.

Do the same style of test for Product name snapshot.

---

## Migration Tests

At minimum verify:

- Alembic upgrade succeeds on a clean database.
- Migration head matches the expected state.

If practical:

- Upgrade → downgrade → upgrade succeeds.

Do not overbuild migration-test infrastructure.

---

## Seed Tests

Verify:

- Seed command succeeds.
- Expected core records exist.
- Seed can be rerun safely according to the chosen strategy.
- Seed does not create uncontrolled duplicates.

---

## Validation Checklist

### Models

- [ ] Business
- [ ] Admin Membership
- [ ] Barber / Service Provider
- [ ] Client
- [ ] Service
- [ ] Appointment
- [ ] Appointment Service
- [ ] Product
- [ ] Appointment Product
- [ ] Inventory Movement
- [ ] Feedback
- [ ] Business Hours

### Migrations

- [ ] Alembic migration created
- [ ] Upgrade works on empty database
- [ ] Schema matches models
- [ ] Foreign keys are valid

### Ownership

- [ ] Business ownership is explicit
- [ ] Representative cross-business relationships are prevented

### Snapshots

- [ ] Service snapshot fields exist
- [ ] Product snapshot field exists
- [ ] Appointment calculated/final totals exist

### Seed

- [ ] One Business
- [ ] Two Owner memberships
- [ ] One Staff membership
- [ ] Two Barbers
- [ ] Sample Clients
- [ ] Sample Services
- [ ] Sample Products
- [ ] Weekly Business Hours

### Tests

- [ ] Model tests pass
- [ ] Relationship tests pass
- [ ] Ownership tests pass
- [ ] Snapshot tests pass
- [ ] Migration tests pass
- [ ] Seed tests pass

---

## Completion Criteria

Phase 1 is complete when:

1. The complete MVP data model exists.
2. A clean Supabase PostgreSQL database can be migrated to the current schema.
3. Development seed data loads predictably.
4. Business ownership relationships are explicit and tested.
5. Historical snapshot fields are implemented and tested.
6. All Phase 1 database tests pass.

The application should still have no client-management, appointment-management, inventory, or feedback business workflows.

---

## Explicitly Out of Scope

Do not implement in Phase 1:

- Supabase login flow
- Token validation
- Owner/Staff API authorization
- Client CRUD endpoints
- Appointment CRUD
- Appointment overlap checking
- Price/duration calculation services
- Inventory stock-update workflows
- Feedback moderation APIs
- Public availability logic
- Frontend business screens
- Render deployment changes
- AWS Lambda work
