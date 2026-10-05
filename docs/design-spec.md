# Design Specification

## 1. Purpose

This document defines the visual and interaction direction for the MVP.

It covers:

- Overall visual direction
- Shared design system
- Public website wireframe structure
- Mobile-first admin wireframe structure
- Responsive behavior
- Key UI states

It does not define final pixel-perfect designs.

---

# 2. Visual Direction

The product should feel:

- Modern
- Clean
- Professional
- Warm
- Premium without feeling luxury-heavy
- Easy to use on mobile

Avoid:

- Overly dark barbershop clichés
- Excessive decoration
- Dense admin dashboards
- Heavy gradients
- Overly playful UI

The public website may use stronger photography and visual storytelling.

The admin should remain more neutral and functional.

---

# 3. Design System

Use a small, reusable system.

## Typography

Use a simple hierarchy:

- Display
- Page title
- Section title
- Card title
- Body
- Secondary text
- Caption

Exact fonts and sizes can be selected during implementation.

## Colors

Use:

- Background
- Surface
- Primary text
- Secondary text
- Border
- Primary accent
- Success
- Warning
- Error
- Muted

Status colors must be consistent and should not communicate meaning through color alone.

## Spacing

Use a consistent spacing scale with:

- Clear section separation
- Comfortable padding
- Predictable vertical rhythm
- Minimal visual clutter

## Core Components

The MVP should support reusable:

- Buttons
- Inputs
- Textareas
- Selects
- Checkboxes
- Cards
- List rows
- Badges
- Status indicators
- Alerts
- Dialogs / sheets
- Tabs
- Accordions
- Empty states
- Loading states
- Toast messages

Use shadcn/ui as the implementation base where useful.

---

# 4. Button Hierarchy

## Primary

Main action on a screen.

Examples:

- Save
- Create Appointment
- Complete Appointment
- Add Stock
- Submit Feedback

## Secondary

Supporting actions.

Examples:

- Edit
- View Details
- Cancel

## Destructive

Examples:

- Cancel Appointment
- Reject Feedback
- Deactivate Product

Avoid showing multiple primary actions at the same visual level.

---

# 5. Public Website Wireframes

## Home

```text
Header
  ↓
Hero
  ↓
Featured Services
  ↓
Availability CTA
  ↓
Gallery Preview
  ↓
Featured Products
  ↓
Customer Feedback
  ↓
Location + Contact
  ↓
FAQ
  ↓
Footer
```

## Header

### Mobile

- Business name / logo
- Menu trigger
- Optional contact CTA

### Desktop

Horizontal navigation:

- Services
- Products
- Gallery
- Availability
- Contact

## Hero

Should communicate:

- Business identity
- Main value proposition
- Primary CTA

Suggested CTAs:

- View Services
- Check Availability
- Contact Us

Use one strong static image where appropriate.

Avoid hero carousels for the MVP.

## Services

Each service card should show:

- Name
- Description
- Duration
- Price

Mobile: stacked cards.

Desktop: responsive grid.

## Products

Each public product card may show:

- Name
- Brand
- Category
- Short description
- Retail price

Never show internal inventory data.

## Gallery

Static frontend images only.

Mobile:

- Single column
- Or compact two-column grid

Desktop:

- Multi-column grid
- Or simple masonry layout

## Availability

Statuses:

- Available
- Limited
- Full
- Closed

Mobile:

- Simple date list
- Or simplified month view

Desktop:

- Fuller calendar view

Never expose barber names or client information.

## Feedback

Use:

- Stacked cards
- Or small responsive grid

Show:

- Customer name
- Rating
- Comment

Only approved, public feedback appears.

## Contact and Location

Show:

- Address
- Phone
- Email
- WhatsApp when configured
- Instagram when configured
- Map
- Directions action

On mobile, contact actions should be easy to tap.

---

# 6. Admin Design Direction

The admin should feel like a mobile application rather than a desktop dashboard.

Prioritize:

- Fast scanning
- Short workflows
- Clear primary actions
- Minimal visual noise
- Strong status hierarchy

Avoid:

- Dense tables
- Large analytics dashboards
- Multi-column forms on mobile

---

# 7. Admin Navigation

Suggested mobile navigation:

```text
Dashboard
Clients
Calendar
Inventory
More
```

`More` may include:

- Services
- Products
- Feedback
- Settings

Desktop may convert this to a sidebar.

---

# 8. Admin Wireframes

## Dashboard

```text
Page Header
  ↓
Next Appointment
  ↓
Today's Appointments
  ↓
Appointment Alerts
  ↓
Low Stock
  ↓
Pending Feedback
```

Do not prioritize charts.

## Client List

Each item should prioritize:

- Name
- Optional last visit
- Small supporting detail

Search should be prominent.

## Client Profile

```text
Client Name
  ↓
Contact Information
  ↓
General Notes
  ↓
Last Visit
  ↓
Visit History
```

Restricted fields must be hidden for Staff users.

## Appointment Creation

```text
Existing Client
  ↓
Date
  ↓
Time
  ↓
Services
  ↓
Barber (optional)
  ↓
Notes
  ↓
Calculated Duration
  ↓
Calculated Price
  ↓
Optional Owner Overrides
  ↓
Save
```

## Appointment Detail

Show:

- Time
- Client
- Barber or Unassigned
- Services
- Duration
- Price
- Appointment notes
- Status

Actions may include:

- Confirm
- Complete
- Cancel
- Mark No Show

## Appointment Completion

```text
Services Performed
  ↓
Products Used
  ↓
Products Sold
  ↓
Visit Notes
  ↓
Complete Appointment
```

## Inventory

Product list should show:

- Product name
- Current stock
- Minimum stock
- Low-stock state

Product detail may include:

- Add Stock
- Adjustment
- Damaged
- Movement history

## Feedback Admin

List:

- Rating
- Name
- Comment preview
- Status

Detail:

- Full comment
- Rating
- Date
- Related client/appointment when available
- Approve
- Reject
- Public visibility

---

# 9. Responsive Behavior

## Admin

Mobile is the primary target.

Use:

- Single-column layouts
- Bottom navigation
- Cards and rows instead of tables
- Full-screen or near-full-screen forms
- Large touch targets

Desktop may add:

- Sidebar navigation
- Wider list rows
- Side-by-side detail panels

The workflow itself should not change.

## Public Website

Support:

- Mobile
- Tablet
- Desktop

Use fluid layouts and responsive grids.

Content should reflow rather than simply shrink.

---

# 10. Key UI States

Every core screen should support:

- Loading
- Empty
- Error
- Success
- Disabled
- Restricted / read-only

## Loading

Prefer:

- Skeletons
- Small inline spinners
- Reserved layout space

Avoid unnecessary full-screen blocking loaders.

## Empty

Examples:

```text
No clients yet
Create your first client.
```

```text
No appointments today
Your schedule is clear.
```

```text
No pending feedback
Nothing needs review.
```

## Error

Errors should:

- Explain what failed
- Avoid exposing backend/database details
- Provide recovery when possible

Examples:

- Appointment conflict
- Save failed
- Network unavailable
- Invalid form data

## Success

Examples:

- Client created
- Appointment saved
- Appointment completed
- Stock updated
- Feedback approved

Use lightweight feedback such as toasts.

---

# 11. Status Presentation

## Appointment

- Scheduled
- Confirmed
- Completed
- Cancelled
- No Show

## Availability

- Available
- Limited
- Full
- Closed

## Feedback

- Pending
- Approved
- Rejected

## Inventory

- Normal
- Low Stock

Status presentation should not rely on color alone.

---

# 12. Staff Read-Only State

Staff users should clearly understand that they have read-only access.

The UI should:

- Hide edit controls
- Hide restricted client fields
- Avoid showing mutation actions
- Keep navigation consistent where practical

Backend authorization remains the source of truth.

---

# 13. Accessibility Direction

The MVP should support:

- Clear focus states
- Keyboard navigation
- Readable text
- Good contrast
- Accessible labels
- Meaningful image alt text
- Large enough touch targets
- No essential hover-only interactions

---

# 14. Design Scope for MVP

Do not include:

- Full custom component library
- Advanced animation system
- Dark mode
- Multiple themes
- Native mobile UI
- Custom illustration system
- Dynamic gallery management
- Advanced data visualization

Keep the design simple, consistent, and easy to implement.

---

# 15. First Screens to Design

Establish the visual language using:

1. Public Home page
2. Mobile Admin Dashboard
3. Client Profile
4. Appointment Creation

Once these are consistent, reuse the system across the remaining MVP screens.
