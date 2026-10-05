# Database Schema

## 1. Purpose

This document defines the initial data model for the hair business platform at a planning level.

It describes:

- Core entities
- Relationships
- Data ownership
- Historical data requirements
- Business rules that affect the data model

Implementation details are intentionally excluded.

This document does not define:

- SQL
- SQLAlchemy models
- Alembic migrations
- Database indexes
- PostgreSQL-specific types
- API request/response schemas

---

## 2. Data Ownership

The system is initially built for one hair business, but business-owned records should still have a clear ownership relationship.

The main business-owned data includes:

- Clients
- Appointments
- Services
- Products
- Inventory movements
- Feedback

This keeps the model organized and avoids a major redesign if the system later needs to support another business or location.

---

## 3. Core Entities

The initial data model contains:

- Business
- Admin Users
- Barbers / Service Providers
- Clients
- Appointments
- Services
- Appointment Services
- Products
- Appointment Products
- Inventory Movements
- Feedback

These entities support the main MVP workflows:

- Remembering client history
- Managing appointments
- Tracking services
- Tracking products
- Managing inventory
- Collecting and moderating feedback

---

# 4. Business

Represents the hair business using the application.

## Main Information

- Business name
- Phone
- Email
- Address
- Timezone
- Currency
- General business settings

## Relationships

A business owns:

- Clients
- Appointments
- Services
- Products
- Inventory movements
- Feedback

## Notes

The initial version may only contain one business record.

The model should still keep ownership explicit rather than treating all records as globally shared.

---


# 5. Admin Users

Represents authenticated users who can access the private admin.

Authentication is provided by Supabase Auth.

## Initial Roles

- Owner
- Staff

## Owner

Owners have full admin access.

Owners may:

- Create and edit business data
- Manage appointments
- Manage clients
- Manage services
- Manage products and inventory
- Moderate feedback
- Manage Barber / Service Provider profiles

## Staff

Staff users have read-only admin access.

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

## Business Relationship

Each authenticated admin user must be associated with the business they are allowed to access.

Detailed authentication implementation belongs in the architecture and coding phases.

---

# 6. Barbers / Service Providers

Represents people who can perform services and receive appointments.

A barber profile is separate from an authenticated admin user.

This allows a barber to exist without admin access.

## Main Information

- Business
- Name
- Active status

## MVP Rules

- All active barbers follow the same business hours.
- All active barbers can perform all active services.
- Barber-specific schedules are not required.
- Barber-specific service assignments are not required.

---

# 7. Clients

Represents a customer of the business.

## Main Information

- First name
- Last name
- Email
- Phone
- General notes
- Created date
- Updated date

## Purpose

The client profile is one of the core parts of the product.

It should help the owner remember:

- When the client last visited
- What services were performed
- Which products were used
- Previous visit notes
- Customer preferences

## Client History

Client history should be derived from related completed appointments.

The system should not maintain a separate client-history record unless a future requirement makes it necessary.

## Last Visit Rule

The last visit should be determined from the latest completed appointment.

A separate manually maintained `last visit` value should not be required.

---

# 8. Appointments

Represents a scheduled or completed customer visit.

## Main Information

- Business
- Client
- Barber when assigned
- Start date and time
- End date and time
- Status
- Appointment notes
- Visit notes
- Calculated total duration
- Final appointment duration
- Calculated total price
- Final appointment price
- Created date
- Updated date

## Initial Statuses

- Scheduled
- Confirmed
- Completed
- Cancelled
- No Show

## Appointment Notes

Used for information needed before or during appointment preparation.

Example:

> Customer requested a later appointment.

## Visit Notes

Used to record what happened during the visit.

Example:

> Used shorter sides than last visit and scissors on top.

Visit notes should become part of the client's visible history.

## Relationship Rules

An appointment belongs to:

- One business
- One existing client

An appointment may optionally be assigned to:

- One barber

An appointment may contain:

- One or more services
- Zero or more products

## Barber Assignment Rule

A barber is optional when the appointment is first created and may be assigned later.

## Overlap Rule

Different barbers may have appointments at the same time.

The same barber cannot have two overlapping active appointments.

An unassigned appointment reserves one generic barber slot during its scheduled time.

## Multiple Services Rule

An appointment may contain multiple services.

The system should initially calculate:

- Total duration from selected service durations
- Total price from selected service prices

An Owner may override the calculated duration or price for that appointment.

The final historical appointment values must remain unchanged if service definitions later change.

---

# 9. Services

Represents a service offered by the business.

Examples:

- Haircut
- Beard Trim
- Haircut + Beard
- Hair Coloring

## Main Information

- Business
- Name
- Description
- Duration
- Price
- Active status

## Historical Rule

Services should normally be deactivated instead of deleted.

Historical appointments must remain understandable even if:

- A service is renamed
- A price changes
- A duration changes
- The business stops offering the service

---

# 10. Appointment Services

Represents the services associated with a specific appointment.

An appointment may contain one or more services.

## Main Information

- Appointment
- Service
- Historical service name
- Historical price
- Historical duration

## Purpose

This relationship records what was actually purchased or performed during the visit.

## Historical Snapshot Rule

Important service information should be preserved at the time of the appointment.

Example:

A haircut costs €25 in October and changes to €30 in January.

The October appointment should continue showing the original €25 value.

The current service definition should not rewrite appointment history.

---

# 11. Products

Represents products used or sold by the business.

Examples:

- Hair Wax
- Pomade
- Beard Oil
- Shampoo

## Main Information

- Business
- Name
- Brand
- Category
- Description when used publicly
- SKU when applicable
- Cost price
- Retail price
- Current stock
- Minimum stock
- Active status
- Public visibility

## Purpose

Products support two main workflows:

- Remembering which products were used during client visits
- Managing business inventory

## Low Stock Rule

The system should be able to identify when current stock reaches or falls below the configured minimum stock level.

---

# 12. Appointment Products

Represents products associated with an appointment.

Products may be connected to an appointment because they were:

- Used during the service
- Sold to the customer

## Main Information

- Appointment
- Product
- Quantity
- Usage type
- Historical product name when useful

## Initial Usage Types

- Used
- Sold

## Purpose

This relationship allows a client profile to show which products were associated with previous visits.

Example:

### Previous Visit

Services:

- Haircut
- Beard Trim

Products used:

- Pomade
- Beard Oil

---

# 13. Inventory Movements

Represents a change to product stock.

The inventory system should preserve a history of why stock changed rather than relying only on a current stock value.

## Initial Movement Types

- Stock In
- Used
- Sold
- Adjustment
- Damaged

## Main Information

- Business
- Product
- Quantity
- Movement type
- Related appointment when applicable
- Notes
- Created date

## Appointment Relationship

An inventory movement may be related to an appointment.

Examples:

- Product used during a client visit
- Product sold during a visit

However, appointments are not required for every inventory movement.

Examples without an appointment:

- New stock delivered
- Damaged product
- Manual stock correction

## Inventory History Rule

Inventory changes should remain traceable.

Every stock change should create an inventory movement.

The current stock value represents the latest balance after those movements are applied.

The system should be able to answer:

- What changed?
- Which product changed?
- By how much?
- Why did it change?
- Was it related to an appointment?

---

# 14. Feedback

Represents customer feedback or reviews.

Feedback may come from:

- A known client
- A completed appointment
- A public website visitor

## Main Information

- Business
- Client when known
- Appointment when known
- Name
- Email
- Rating
- Comment
- Moderation status
- Public visibility
- Created date
- Updated date

## Initial Moderation Statuses

- Pending
- Approved
- Rejected

## Public Website Rule

Only feedback that is approved and intended for public display should appear on the public website.

## Relationship Rules

Client and appointment relationships are optional because public feedback may come from someone who is not connected to an existing client record.

---


# 15. Business Hours

Represents the normal weekly operating schedule used by the business.

## Main Information

- Business
- Day of week
- Opening time
- Closing time
- Closed status

## MVP Rule

All active barbers follow the same business hours.

Per-barber working hours and days off are outside the MVP.

Business hours help determine public availability together with active barber capacity and appointments.

---

# 16. Main Relationships

```text
Business
|
├── Admin Users
|
├── Barbers / Service Providers
|    |
|    └── Appointments
|
├── Clients
|    |
|    └── Appointments
|          |
|          ├── Appointment Services
|          |       |
|          |       └── Services
|          |
|          └── Appointment Products
|                  |
|                  └── Products
|
├── Services
|
├── Products
|    |
|    └── Inventory Movements
|
└── Feedback
```

Additional relationships:

```text
Appointment
|
└── Inventory Movements
    when stock changes are related to a visit
```

---

# 17. Client History Model

Client history should not be stored as a separate duplicated dataset.

The client profile should be assembled from:

```text
Client
  |
  └── Completed Appointments
         |
         ├── Services
         |
         ├── Products
         |
         └── Visit Notes
```

This provides the information needed for the owner to remember previous visits without introducing a separate history table.

---

# 18. Appointment Completion and History

A completed appointment becomes part of the client's visit history.

At completion, the system should have enough information to represent:

- Date of visit
- Services performed
- Products used or sold
- Visit notes
- Appointment status

The exact workflow for appointment completion belongs in the admin and API specifications rather than this database document.

---

# 19. Inventory and Appointments

Appointments and inventory are related, but they should remain separate concepts.

An appointment may result in product usage or sales.

Those actions may create inventory changes.

Conceptually:

```text
Appointment
     |
     v
Product used or sold
     |
     v
Appointment Product
     |
     v
Inventory Movement
```

This allows client history and inventory history to remain independently understandable.

---

# 20. Static Website Images

Gallery images and business images are not part of the database model.

The initial architecture treats them as static frontend assets deployed with the React application.

Therefore, the initial database does not require entities for:

- Gallery images
- Business images
- File uploads
- Media storage

If dynamic media management is introduced later, the data model can be extended at that time.

---

# 21. Data That Should Not Be Duplicated Unnecessarily

Where possible, values should be derived from existing relationships.

Examples:

### Last Client Visit

Derived from:

- Latest completed appointment

### Client Visit History

Derived from:

- Completed appointments
- Appointment services
- Appointment products
- Visit notes

### Low Stock

Derived from:

- Current stock
- Minimum stock

Duplication is acceptable when needed to preserve historical accuracy, such as service or product snapshots.

---

# 22. Initial Schema Principles

The initial data model should prioritize:

- Simple relationships
- Clear business ownership
- Accurate client history
- Accurate appointment history
- Traceable inventory changes
- Historical accuracy
- Minimal unnecessary duplication
- Clear separation between business concepts

---

# 23. Not Included in the Initial Schema

The initial database does not need to support:

- Gallery or image storage
- Online customer booking
- Payments
- Staff commissions
- Loyalty programs
- Advanced accounting
- SMS automation
- WhatsApp automation
- Product suppliers
- Purchase orders
- Complex multi-location management
- AI features

These can be added later if product requirements change.

---

# 24. Deferred Data Model Decisions

The following implementation details should be decided during the coding phase:

- Exact database field types
- Database indexes
- Unique constraints
- Foreign-key behavior
- Soft-delete strategy
- Timestamp conventions
- SQLAlchemy model definitions
- Alembic migrations
- Database connection configuration
- Exact transaction boundaries

These decisions should follow the architecture rules defined in `architecture.md`.
