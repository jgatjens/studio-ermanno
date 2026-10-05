# Responsive Specification

## 1. Purpose

This document defines the responsive behavior for the hair business platform.

The platform contains two experiences with different priorities:

- A public website for customers
- A private mobile-first admin application for the business owner

The admin is expected to be used primarily from a phone.

The public website must work well across mobile, tablet, and desktop.

Responsive behavior should support the workflows defined in:

- `architecture.md`
- `admin-spec.md`
- `website-spec.md`

---

# 2. Core Responsive Principle

The two experiences should not be treated the same.

## Admin

The admin is designed mobile-first.

The phone layout is the primary design target.

Larger layouts should enhance the mobile experience rather than define it.

## Public Website

The public site is responsive across:

- Mobile
- Tablet
- Desktop

Mobile remains important, but desktop layouts may use more horizontal space for presentation.

---

# 3. Admin Mobile-First Strategy

The admin should support fast daily use from a phone.

Primary mobile workflows include:

- Checking today's appointments
- Opening the next appointment
- Searching clients
- Reviewing client history
- Creating appointments
- Completing appointments
- Updating inventory
- Reviewing feedback

The interface should reduce unnecessary navigation during these tasks.

---

# 4. Admin Navigation

The most-used admin sections should remain easy to reach on a phone.

A likely mobile navigation model is:

```text
Dashboard
Clients
Calendar
Inventory
More
```

The `More` area can contain less frequently used sections such as:

- Services
- Products
- Feedback
- Settings

The exact visual navigation pattern can be finalized during UI design.

## Navigation Rules

- Primary actions should not require deep navigation.
- Back navigation should always be clear.
- The current section should be easy to identify.
- Important workflows should not depend on hover behavior.
- Desktop navigation may expand into a sidebar or wider navigation pattern.

---

# 5. Admin Dashboard

The mobile dashboard should prioritize operational information.

## Mobile Order

Suggested priority:

1. Next appointment
2. Today's appointments
3. Appointment alerts
4. Low-stock products
5. Pending feedback
6. Recent activity

The dashboard should avoid large analytics widgets or charts that push operational content below the fold.

## Larger Screens

Tablet and desktop may show multiple dashboard sections side by side.

The information hierarchy should remain the same.

---

# 6. Appointment List and Calendar

Appointment management must remain usable on small screens.

## Mobile

The default experience should prioritize:

- Today
- Upcoming appointments
- Clear appointment cards or list rows

Each appointment item should show enough information to scan quickly:

- Time
- Client
- Barber or Unassigned
- Main service
- Status

Appointment details should open in a focused view rather than forcing too much information into the list.

## Week and Month Views

Week and month views may be denser.

On smaller screens:

- Avoid tiny unreadable calendar cells.
- Prefer tapping a date to view appointments when needed.
- Avoid relying on drag-and-drop as the only way to edit an appointment.

## Tablet and Desktop

Larger screens can support:

- Wider week views
- More appointment detail
- Side-by-side calendar and appointment detail when useful

---

# 7. Appointment Forms

Appointment forms should be optimized for mobile input.

## Mobile Flow

The form should follow a logical vertical sequence:

1. Existing client
2. Date
3. Time
4. Services
5. Barber assignment when available
6. Appointment notes
7. Calculated duration and price
8. Optional Owner overrides
9. Save

The flow should remain short.

The client must already exist before appointment creation.

Barber assignment is optional and may be completed later.

## Form Rules

- Use one primary column on mobile.
- Avoid horizontal form layouts.
- Keep labels visible.
- Use appropriate mobile input types.
- Prevent the keyboard from hiding primary actions where possible.
- Preserve entered data if a secondary action is required.

## Larger Screens

Fields may be grouped into multiple columns when it improves readability without changing the logical order.

---

# 8. Appointment Completion

Completing an appointment should remain simple on a phone.

The completion flow may include:

- Services performed
- Products used
- Products sold
- Visit notes

## Mobile Rules

- Use stacked sections.
- Keep selection controls large enough to tap.
- Keep the completion action obvious.
- Avoid dense editable tables.
- Make it easy to review selected services/products before completing.

---

# 9. Client Search

Client search should be one of the fastest mobile workflows.

## Mobile

The search input should be prominent.

Results should use a compact list or card pattern.

Useful result information may include:

- Name
- Phone
- Email
- Last visit when useful

Avoid displaying unnecessary history in search results.

## Larger Screens

More information may be displayed in each row, but search behavior should remain the same.

---

# 10. Client Profile

The client profile must remain readable on a small screen.

## Mobile Information Order

Recommended order:

1. Client name
2. Contact information
3. General notes/preferences
4. Last visit
5. Visit history

## Last Visit

The last visit should be visually prominent.

It may include:

- Date
- Services
- Products used
- Visit notes

## Visit History

Each historical visit should be a clear, expandable or separated item.

Avoid large multi-column history tables on mobile.

## Larger Screens

Desktop may use:

- Side-by-side contact and summary information
- Wider history layouts

The same content hierarchy should remain intact.

---

# 11. Role-Based Admin Visibility

Responsive layouts must respect the same authorization rules as the backend.

## Owner

Owners may see and edit all MVP admin information.

## Staff

Staff users are read-only.

On client screens, Staff may see:

- Client name
- Appointment history
- Services
- Products used
- Appointment notes

The UI must hide:

- Email
- Phone
- General private client notes
- Visit notes
- Edit or destructive actions

Hiding these fields in the UI does not replace backend authorization.

---

# 12. Services and Products Management

Services and products should use simple mobile list patterns.

## Mobile Lists

Each item should surface only the most important information.

### Service

- Name
- Duration
- Price
- Active status

### Product

- Name
- Brand/category when useful
- Current stock
- Low-stock state
- Active status

Detailed editing should open a dedicated screen or focused panel.

## Desktop

Larger screens may use wider rows or tables if readability remains strong.

---

# 13. Inventory

Inventory must make stock issues easy to notice.

## Mobile Inventory List

Prioritize:

- Product name
- Current stock
- Minimum stock
- Low-stock indicator

Low-stock items should be easy to scan.

## Inventory Actions

Common actions such as:

- Add stock
- Record adjustment
- Record damaged stock

should use short, focused forms.

Avoid requiring spreadsheet-like interaction on mobile.

## Inventory History

Movement history should use stacked list items on mobile.

Each movement should show:

- Type
- Quantity
- Date
- Related appointment when relevant
- Note when available

---

# 14. Feedback

Feedback moderation should be straightforward on a phone.

## Mobile Feedback List

Each item may show:

- Rating
- Customer name when available
- Short comment preview
- Status
- Date

Pending feedback should be visually easy to identify.

## Feedback Detail

Actions should remain obvious:

- Approve
- Reject
- Toggle public visibility when approved

Destructive or irreversible actions should require clear confirmation where appropriate.

---

# 15. Admin Lists vs. Tables

Desktop-style data tables should not be the default mobile pattern.

Use:

- Cards
- Compact rows
- Stacked list items
- Expandable details

for:

- Clients
- Appointments
- Products
- Inventory history
- Feedback

Tables may be used on larger screens when they improve scanning and do not create a separate interaction model.

---

# 16. Admin Touch and Interaction Rules

## Touch Targets

Primary interactive elements should be comfortable to tap.

Avoid:

- Tiny icon-only actions
- Closely packed controls
- Hover-only interactions

## Primary Actions

The main action for a screen should remain easy to find.

Examples:

- Create Appointment
- Save Client
- Complete Appointment
- Add Stock
- Approve Feedback

## Destructive Actions

Actions such as cancelling an appointment or rejecting feedback should be visually distinct from primary positive actions.

---

# 17. Admin Modal and Panel Behavior

Full-screen or near-full-screen mobile views are preferred over cramped desktop-style modals for complex forms.

Examples:

- Create appointment
- Edit client
- Add stock
- Complete appointment

On desktop, the same flows may appear in dialogs, panels, or dedicated routes where appropriate.

The underlying workflow should remain consistent across breakpoints.

---

# 18. Public Website Layout Strategy

The public website should adapt fluidly across screen sizes.

Primary public areas include:

- Home
- Services
- Products
- Gallery
- Availability
- FAQ
- Contact
- Feedback
- Address and map

Content should reflow rather than simply shrink.

---

# 19. Public Header and Navigation

## Mobile

Navigation should remain compact and easy to open.

Important customer actions should remain visible or easy to reach.

Examples:

- Services
- Availability
- Contact

## Desktop

Navigation may expand horizontally.

The same route structure and priorities should remain consistent.

---

# 20. Public Home Page

## Mobile

Content should use a clear vertical flow.

Suggested priority:

1. Business introduction
2. Primary call to action
3. Services
4. Availability
5. Gallery
6. Products
7. Location/contact
8. Feedback

The exact design may change, but high-value customer information should appear early.

## Desktop

Sections may use:

- Multi-column layouts
- Larger imagery
- Wider spacing

The content order should remain understandable.

---

# 21. Services Layout

## Mobile

Services should use stacked cards or rows.

Each service should clearly show:

- Name
- Price
- Duration
- Short description

## Larger Screens

Cards may appear in grids.

Service information should remain easy to compare.

---

# 22. Products Layout

## Mobile

Products should use simple cards or rows.

Public information may include:

- Product name
- Brand
- Category
- Retail price when relevant

Internal inventory information must never appear.

## Larger Screens

Products may use a responsive card grid.

---

# 23. Gallery Layout

Gallery images are static frontend assets.

## Mobile

The gallery should prioritize:

- Fast loading
- Clear image sizing
- Comfortable spacing

A single-column or compact two-column layout may be appropriate depending on the final design.

## Desktop

The gallery may expand into:

- Multi-column grids
- Masonry-style layouts
- Larger featured images

## Image Rules

- Preserve image aspect ratios where possible.
- Avoid layout shifts.
- Provide meaningful alternative text.
- Optimize static assets during frontend implementation.

---

# 24. Availability Layout

The public availability calendar must remain simple and privacy-safe.

## Mobile

The layout should make date status easy to understand without dense calendar cells.

Possible states:

- Available
- Limited
- Full
- Closed

The public layout should show business-level availability only.

It should not display individual barber names or barber-specific availability.

If a traditional month calendar becomes too dense on small screens, a date-list or simplified calendar treatment may be used.

## Desktop

A traditional calendar layout may use the additional space.

The same availability information must be shown across breakpoints.

---

# 25. FAQ Layout

## Mobile

FAQ content should use an accordion or stacked question/answer pattern.

## Desktop

The same pattern can remain or expand into a wider layout.

Questions should remain keyboard accessible.

---

# 26. Contact and Location

Contact information should remain easy to act on from mobile.

## Mobile Actions

Examples:

- Tap to call
- Tap to email
- Open WhatsApp
- Open directions

## Address and Map

The address should remain visible even if the map is unavailable or slow to load.

On mobile, the map should not dominate the page at the expense of contact information.

---

# 27. Feedback Presentation

Public feedback should remain easy to read across devices.

## Mobile

Use stacked testimonials or feedback cards.

## Desktop

Feedback may use a grid or wider carousel if appropriate.

Only approved, publicly visible feedback should be rendered.

Private customer information must never be shown.

---

# 28. Static vs. Dynamic Content Responsiveness

Both content types must follow the same responsive design system.

## Static Content

Examples:

- Gallery images
- Hero imagery
- Marketing copy

## Dynamic API Content

Examples:

- Services
- Products
- Availability
- Business hours
- Approved feedback

Dynamic content should not cause major layout changes while loading.

Loading states should reserve reasonable space and avoid unnecessary visual jumps.

---

# 29. Breakpoint Philosophy

The project should not depend on a large number of device-specific breakpoints.

Use a small responsive system based on available space.

Conceptually:

- Mobile
- Tablet / compact desktop
- Desktop

Components should respond to content and available width rather than specific phone models.

Exact breakpoint values belong in the frontend implementation.

---

# 30. Accessibility Rules

Responsive behavior must preserve accessibility.

Requirements include:

- Readable text at all supported widths
- Sufficient contrast
- Visible focus states
- Keyboard-accessible navigation
- Proper form labels
- Meaningful image alternative text
- Touch targets large enough for mobile use
- No essential interaction that depends only on hover
- No horizontal scrolling for normal page content

---

# 31. Performance Rules

Responsive design should not unnecessarily increase frontend weight.

Consider:

- Optimized static images
- Lazy loading for below-the-fold images
- Avoiding oversized assets on small screens
- Keeping public informational pages lightweight
- Avoiding unnecessary JavaScript for static content

Detailed implementation belongs in frontend development.

---

# 32. Consistency Rules

The same business workflow should behave consistently across screen sizes.

Examples:

- Creating an appointment
- Editing a client
- Adding stock
- Approving feedback

Responsive layouts may change presentation, but should not introduce different business rules or different required steps.

---

# 33. Out of Scope

The initial responsive specification does not require:

- Native mobile applications
- Tablet-specific feature sets
- Offline-first behavior
- Complex gesture controls
- Desktop-only admin functionality
- Dynamic gallery management
- Customer booking flows

---

# 34. Deferred Responsive Decisions

The following can be finalized during detailed UI implementation:

- Exact breakpoint values
- Exact admin navigation component
- Exact calendar component behavior
- Drawer vs. modal vs. route patterns
- Sticky action placement
- Exact public grid layouts
- Gallery column counts
- Skeleton/loading designs
- PWA installation behavior

These decisions should preserve the workflows and priorities defined in the current product specifications.
