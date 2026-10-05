# Admin Specification

## 1. Purpose

The admin application is the private operational area used by the business owner.

It will be used primarily from a mobile phone.

The admin should therefore be designed mobile-first from the beginning rather than as a desktop dashboard that is later adapted to smaller screens.

The main goal is to make daily business tasks fast, clear, and easy to complete with minimal navigation.

---

# 2. Primary Admin Goals

The admin should help the owner answer these questions quickly:

- Who is coming today?
- What appointment is next?
- What happened during this client's last visit?
- What services did this client receive before?
- Which products were used or sold?
- Which products are low in stock?
- What feedback needs attention?

The admin should prioritize operational usefulness over advanced analytics.

---

# 3. Admin Roles

The MVP supports two authenticated admin roles.

## Owner

Owners have full admin access and may modify business data.

## Staff

Staff users have limited read-only access.

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

Staff cannot create, edit, delete, approve, reject, or otherwise modify admin data.

Hairdresser / Service Provider profiles are separate from admin users.

A hairdresser may exist without admin login access.

---

# 4. Main Admin Areas

Initial admin areas:

- Dashboard
- Clients
- Calendar
- Services
- Products
- Inventory
- Feedback
- Settings

The exact navigation design can be refined during UI planning.

For mobile, the most frequently used areas should remain easy to reach.

A likely primary navigation is:

```text
Dashboard
Clients
Calendar
Inventory
More
```

The `More` area can contain:

- Services
- Products
- Feedback
- Settings

---

# 5. Dashboard Workflow

The dashboard should focus on what matters today.

## Main Information

The dashboard may show:

- Today's appointments
- Next appointment
- Upcoming appointment alerts
- Low-stock products
- Pending feedback
- Recent activity

## Main Actions

From the dashboard, the owner should be able to quickly:

- Open an appointment
- Open a client profile
- Create an appointment
- View low-stock products
- Review pending feedback

## Mobile Priority

The first screen should avoid dense charts and unnecessary business metrics.

Daily operational information should appear before secondary information.

---

# 6. Appointment Workflow

Appointments are one of the main daily workflows.

The owner should be able to:

- View appointments
- Create appointments
- Edit appointments
- Confirm appointments
- Cancel appointments
- Mark appointments completed
- Mark appointments as no-show

---

## 6.1 View Today's Appointments

The default mobile calendar experience should make today's schedule easy to scan.

Each appointment summary should show the most useful information, such as:

- Time
- Client name
- Main service
- Appointment status

Selecting an appointment should open its detail view.

---

## 6.2 Create Appointment

The owner should be able to create an appointment with minimal steps.

Required workflow:

1. Choose an existing client.
2. Select date and time.
3. Select one or more services.
4. Optionally assign a barber.
5. Add optional appointment notes.
6. Review the automatically calculated duration and price.
7. Optionally override duration or price.
8. Save the appointment.

The client must already exist before the appointment can be created.

A hairdresser is optional at creation and may be assigned later.

---

## 6.3 Edit Appointment

The owner should be able to change:

- Date
- Time
- Client
- Services
- Appointment notes
- Status

Changes should remain easy to make from a phone.

---

## 6.4 Appointment Detail

The appointment detail should provide:

- Client name
- Hairdresser when assigned
- Contact information when the current role is allowed to see it
- Date and time
- Status
- Selected services
- Final duration
- Final price
- Appointment notes
- Visit notes when the current role is allowed to see them
- Products used or sold

The owner should be able to open the client's profile directly from the appointment.

---

## 6.5 Complete Appointment

Completing an appointment is an important workflow because it creates useful client history.

The completion flow should allow the owner to confirm:

- Services performed
- Products used
- Products sold
- Visit notes

When completed, the appointment becomes part of the client's visit history.

The exact inventory update behavior will be defined in the API/business-rules specification.

---

## 6.6 Cancel and No-Show

The owner should be able to clearly distinguish between:

- Cancelled appointment
- No-show appointment

These statuses should remain part of appointment history.

---

# 7. Calendar Workflow

The calendar is the main schedule management area.

## Initial Views

The admin should support:

- Today
- Week
- Month

The mobile default should prioritize today's appointments.

## Calendar Capacity Rules

For the MVP:

- All active hairdressers follow the same business hours.
- All hairdressers can perform all active services.
- Different hairdressers may have appointments at the same time.
- The same hairdresser cannot have overlapping active appointments.
- Unassigned appointments reserve one generic hairdresser slot.
- Hairdresser assignment can happen after appointment creation.

## Calendar Actions

The owner should be able to:

- Open an appointment
- Create an appointment
- Move or edit an appointment
- Review upcoming appointments

The detailed interaction model for drag-and-drop or gesture-based changes can be decided during UI implementation.

---

# 8. Appointment Alerts

The admin should make upcoming appointments easy to notice.

Initial alert use cases:

- Appointment coming soon
- Appointment starting now
- Schedule conflict or issue when relevant

The initial requirement is to support clear in-app awareness.

Push notifications, SMS, and WhatsApp notifications are not part of the initial version.

---

# 9. Client Workflow

Client management should make it easy to remember people and their previous visits.

The owner should be able to:

- Search clients
- Create clients
- Edit clients
- Open client profiles
- Review visit history

---

## 9.1 Client Search

Search should be fast and easy from mobile.

Initial searchable fields:

- First name
- Last name
- Email
- Phone

Search results should show enough information to distinguish similar clients without becoming visually dense.

---

## 9.2 Create Client

The owner should be able to create a client with minimal information.

Initial information may include:

- First name
- Last name
- Email
- Phone
- General notes

Not every field must be mandatory.

The form should remain short enough to use comfortably during appointment creation.

---

## 9.3 Client Profile

The client profile is one of the most important screens in the admin.

It should show:

### Contact Information

- Name
- Email
- Phone

### General Notes

Examples:

- Preferences
- Communication notes
- Useful customer information

### Last Visit

The profile should clearly show the latest completed appointment.

Useful information includes:

- Visit date
- Services
- Products used
- Visit notes

### Visit History

Previous completed appointments should be easy to review.

Each visit should show:

- Date
- Services
- Products used or sold
- Visit notes

The owner should not need to search through the calendar to remember a client's previous visit.

---

## 9.4 Edit Client

The owner should be able to update:

- Contact information
- General notes
- Client preferences

Historical visit information should not be manually edited from the basic client form.

---

# 10. Services Workflow

Services define what the business offers and are used when creating appointments.

The owner should be able to:

- View services
- Create services
- Edit services
- Activate services
- Deactivate services

## Service Information

Initial service information includes:

- Name
- Description
- Duration
- Price
- Active status

## Service Rules

Inactive services should not be shown as normal selectable services for new appointments.

Historical appointments must continue to show services that were used previously.

For the MVP, every active hairdresser can perform every active service.

---

# 11. Products Workflow

Products represent items used during services or sold to clients.

The owner should be able to:

- View products
- Create products
- Edit products
- Activate products
- Deactivate products

## Product Information

Initial product information includes:

- Name
- Brand
- Category
- SKU when applicable
- Cost price
- Retail price
- Current stock
- Minimum stock
- Active status

Products should be easy to find while completing an appointment.

---

# 12. Inventory Workflow

Inventory should help the owner understand current stock and why it changed.

The owner should be able to:

- View current stock
- Identify low-stock products
- Add stock
- Record adjustments
- Record damaged stock
- Review inventory history

---

## 12.1 Inventory List

The inventory list should prioritize:

- Product name
- Current stock
- Minimum stock
- Low-stock status

Low-stock items should be visually easy to identify.

---

## 12.2 Add Stock

When new stock arrives, the owner should be able to record it quickly.

The workflow should include:

1. Select product.
2. Enter quantity.
3. Add optional note.
4. Save movement.

---

## 12.3 Manual Adjustment

The owner should be able to correct stock when the recorded quantity does not match the real quantity.

The adjustment should create an inventory movement rather than silently replacing history.

Every stock change should create an inventory movement, and the product's current stock should reflect the resulting balance.

---

## 12.4 Damaged Product

The owner should be able to record damaged or unusable stock.

This should reduce available stock and create a traceable inventory movement.

---

## 12.5 Appointment-Related Inventory

Products used or sold during an appointment may create inventory movements.

The owner should not need to manually duplicate the same stock change if the appointment completion workflow already recorded it.

Detailed transaction behavior belongs in the backend business-rules specification.

---

## 12.6 Inventory History

The owner should be able to review product stock history.

Each movement should make it clear:

- What changed
- Quantity
- Movement type
- Date
- Related appointment when applicable
- Notes when available

---

# 13. Feedback Workflow

The admin should allow the owner to review and moderate customer feedback.

The owner should be able to:

- View feedback
- Review pending feedback
- Approve feedback
- Reject feedback
- Control public visibility

---

## 13.1 Feedback List

Feedback should be filterable or grouped by status:

- Pending
- Approved
- Rejected

Pending feedback should be easy to identify.

---

## 13.2 Feedback Detail

The detail view should show:

- Customer name when available
- Rating
- Comment
- Date
- Related client when available
- Related appointment when available
- Moderation status
- Public visibility

---

## 13.3 Moderation

The owner should be able to:

- Approve feedback
- Reject feedback
- Decide whether approved feedback appears publicly

Approval and public visibility should remain separate concepts.

---

# 14. Settings

Initial settings may include:

- Business information
- Contact information
- Address
- Business hours
- Timezone
- Currency
- Hairdresser / Service Provider profiles

All active hairdressers share the same business hours in the MVP.

The settings area should not become a catch-all for operational workflows.

---

# 15. Mobile-First Interaction Rules

The admin should be designed for one-handed or quick phone use when possible.

## Navigation

- Frequently used areas should remain easy to reach.
- Avoid deeply nested navigation.
- Use clear back navigation.

## Touch Targets

Interactive elements should be comfortable to tap.

## Lists

Avoid desktop-style tables when a mobile list or card communicates the information more clearly.

Examples:

- Appointment list
- Client list
- Inventory list
- Feedback list

## Forms

Forms should:

- Keep required fields minimal.
- Use clear labels.
- Group related information.
- Avoid long multi-column layouts.
- Keep primary actions visible.
- Work well with the mobile keyboard.

## Actions

Common actions should not require unnecessary confirmation screens.

Potentially destructive actions should still require clear confirmation.

---

# 16. Admin Data Priorities

The admin should prioritize information in this order:

1. Immediate daily actions
2. Client history
3. Appointment details
4. Inventory issues
5. Feedback moderation
6. Secondary configuration

This priority should guide screen layout and navigation decisions.

---

# 17. Out of Scope for Initial Admin

The initial admin does not require:

- AI features
- Online booking management
- Payments
- Staff commissions
- Payroll
- Advanced accounting
- Loyalty programs
- Complex analytics dashboards
- SMS automation
- WhatsApp automation
- Multi-location management
- Dynamic gallery image management

---

# 18. Deferred Admin Decisions

The following can be decided during detailed UI or API planning:

- Exact bottom-navigation design
- Exact calendar component
- Drag-and-drop appointment behavior
- Notification implementation
- Confirmation patterns
- Exact list filters
- Pagination strategy
- Offline support
- PWA installation behavior
- Exact inventory transaction rules

These decisions should follow the workflows and boundaries defined in this document.
