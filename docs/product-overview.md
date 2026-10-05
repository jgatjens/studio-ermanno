# Product Overview

## Project

A website and mobile-first admin application for a hair cutting business.

The system has two main experiences:

1. A public website for customers.
2. A private admin application for the business owner.

The initial product should remain simple and focused on the daily needs of the business.

---

## Product Goals

The product should help the business owner:

- Remember client history and preferences.
- Manage appointments.
- Search and review client profiles quickly.
- Track products and inventory.
- See appointment alerts.
- Manage customer feedback.

The public website should help customers:

- Understand available services.
- See business schedules.
- View the gallery.
- Find the business location.
- Read common questions and answers.
- Contact the business.
- See date availability without booking online.
- Leave feedback.

---

## Admin Experience

The admin will be used mostly from a mobile phone.

Because of this, the admin interface should be designed mobile-first rather than adapting a desktop dashboard later.

### Initial Admin Features

- Client profiles
- Client search
- Appointment calendar
- Appointment alerts
- Product inventory
- Feedback management

### Client Profile Goal

The client profile should help the owner remember what happened during previous visits.

Useful information includes:

- Name
- Email
- Phone when available
- Previous visits
- Services purchased
- Products used
- Visit notes
- Client preferences

---

## Public Website

### Initial Website Features

- Services
- Business schedules
- Gallery
- Address
- Map
- FAQ
- Contact information
- Availability calendar
- Feedback

### Availability Calendar

The public calendar is informational only.

Customers can see whether dates are available, but they cannot book appointments directly through the website in the initial version.

---

## Initial Product Scope

The first version should focus on:

- Client management
- Appointment management
- Service management
- Product and inventory management
- Public business information
- Availability
- Feedback

---

## Out of Scope for Initial Version

The following are not currently required:

- AI features
- Online customer booking
- Advanced accounting
- Loyalty programs
- Staff commissions
- Complex multi-location support
- SMS or WhatsApp automation

---

## Finalized MVP Business Rules

### Admin Access

- The MVP supports Owner and Staff admin roles.
- Owners have full admin access.
- Staff is read-only with limited client visibility.
- Staff can see client name, appointment history, services, products used, and appointment notes.
- Staff cannot see client email, phone, private general notes, or visit notes.

### Barbers

- Barber / Service Provider profiles are separate from admin users.
- A barber may exist without admin access.
- All active barbers use the same business hours.
- All active barbers can perform all active services.

### Appointments

- A client must already exist before an appointment can be created.
- An appointment can contain multiple services.
- A barber is optional when an appointment is first created and may be assigned later.
- Different barbers can have appointments at the same time.
- The same barber cannot have overlapping active appointments.
- An unassigned appointment reserves one generic barber slot.
- Duration and price are calculated from selected services by default.
- Owners may override the calculated duration or price for a specific appointment.

### Public Availability

- The public website shows business-level availability only.
- Individual barber names are not exposed.
- Availability is based on shared business hours and total barber capacity.
- Unassigned appointments consume one barber slot.
- Online booking is not part of the MVP.
