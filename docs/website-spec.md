# Public Website Specification

## 1. Purpose

The public website is the customer-facing experience for the hair business.

Its purpose is to help visitors understand:

- What services the business offers
- Which products the business uses or recommends
- When the business is open
- Which dates have availability
- Where the business is located
- How to contact the business
- What other customers have said about the business

The public website does not support online booking in the initial version.

The website is part of the same React + Vite frontend application as the private admin.

---

# 2. Public Website Goals

The website should make it easy for a customer to answer:

- What services are available?
- How much do services cost?
- How long do services usually take?
- What products does the business use or sell?
- Is there availability on a specific date?
- Where is the business located?
- How can I contact the business?
- What are the opening hours?
- What do previous customers say?

The website should remain simple, fast, and mobile-friendly.

---

# 3. Public Website Areas

Initial public areas:

- Home
- Services
- Products
- Gallery
- Availability
- FAQ
- Contact
- Feedback
- Address and Map

These areas may exist as separate routes or as sections of a smaller site.

The final route structure can be decided during UI planning.

---

# 4. Home Page

The home page should provide a clear introduction to the business.

## Main Content

The home page may include:

- Business name
- Short business description
- Main services
- Featured products
- Selected gallery images
- Business hours
- Availability call-to-action
- Contact call-to-action
- Address/location summary
- Selected public feedback

## Main Actions

The most important customer actions should be easy to find.

Examples:

- View Services
- Check Availability
- Contact the Business
- Get Directions

The website should not present a booking action in the initial version.

---

# 5. Services

The services area presents the active services offered by the business.

## Service Information

Public service information may include:

- Name
- Description
- Duration
- Price

Only active services should appear publicly.

Inactive services may remain in historical admin data but should not appear as available services on the public website.

---

# 6. Products

The public website may present selected active products used or sold by the business.

Examples:

- Pomade
- Beard Oil
- Shampoo
- Hair Wax

## Public Product Information

The public presentation may include:

- Product name
- Brand
- Category
- Short description when available
- Retail price when relevant

Only active products explicitly marked for public visibility should appear on the website.

Internal inventory information must not be exposed publicly.

The public website should not display:

- Current stock
- Minimum stock
- Cost price
- Inventory history
- Internal SKU data unless intentionally useful to customers

## Product Scope

The initial website is informational only.

Online product purchasing is not part of the MVP.

---

# 7. Gallery

The gallery presents examples of the business's work.

## Image Source

Gallery images are static frontend assets.

They are:

- Stored with the React application
- Deployed with the frontend
- Served through Cloudflare Pages

They are not:

- Stored in Supabase
- Uploaded through the admin
- Managed dynamically through FastAPI

## Initial Gallery Content

The gallery may include:

- Haircuts
- Beard work
- Styling
- Before-and-after images
- General business photography

The exact categories are a content/design decision.

## Update Rule

Changing gallery images requires updating and redeploying the frontend.

Dynamic gallery management is outside the initial scope.

---

# 8. Business Images

Business images such as:

- Hero images
- Interior photos
- Team/business photos
- Decorative photography

should also be treated as static frontend assets.

They follow the same deployment model as gallery images.

No database or media-storage entity is required for them in the initial version.

---

# 9. Availability

The public availability calendar is informational only.

Customers can check whether the business has availability, but they cannot create or modify appointments.

The redesigned `/availability` page uses a Monday-first month calendar. Choosing a date displays only Available and Limited intervals as read-only time spots in the business timezone. Full and Closed intervals are omitted from the time grid. There is no time selection, appointment summary, or Continue action. General contact links and business opening hours remain available below the calendar.

Month data is fetched through anonymous requests of at most 14 days each. Loading, missing data, retry, refresh, and dates with no available spots must be explicit. The page explains that displayed availability is indicative and requires confirmation from the salon.

Public availability is aggregated across active barbers and never exposes individual barber names.

## Public Availability Information

The website may expose simplified availability states such as:

- Available
- Limited
- Full
- Closed

Availability is capacity-based:

- Different barbers may be booked at the same time.
- The same barber cannot hold overlapping active appointments.
- An unassigned appointment reserves one barber slot.
- The business may still show availability if another barber slot remains free.
- Closed means the requested time falls outside normal business hours.

The exact thresholds for `Available` versus `Limited` can be refined during implementation.

## Privacy Rule

The public calendar must never expose:

- Client names
- Appointment notes
- Services booked by another client
- Contact information
- Internal appointment details

The public website should receive only the minimum availability information needed for display.

## Data Flow

Conceptually:

```text
Public Website
      |
      v
FastAPI
      |
      v
Appointment / schedule data
      |
      v
Simplified availability response
```

The frontend should not calculate availability by directly reading appointment data from Supabase.

---

# 10. Business Hours

The website should clearly display normal business hours.

Information may include:

- Day of week
- Opening time
- Closing time
- Closed days

Future exceptions such as holidays or special closures can be added later if needed.

Business hours should also help inform public availability.

All active barbers share the same business hours in the MVP.

---

# 11. Address and Map

The website should clearly show where the business is located.

## Address Information

Public information may include:

- Business name
- Street address
- City
- Postal code when relevant

## Map

The website should provide a map or location view.

The exact map provider has not yet been selected.

## Directions

Visitors should have a simple way to open the business location in their preferred map application.

---

# 12. Contact

Contact information should be easy to find from mobile and desktop.

## Possible Contact Details

The public website may display:

- Phone
- Email
- WhatsApp
- Instagram
- Other selected social channels

Only contact methods intentionally configured by the business should appear.

## Contact Actions

Where possible, contact information should be actionable.

Examples:

- Tap to call
- Tap to email
- Open WhatsApp
- Open social profile

The exact channels will be finalized when business content is available.

---

# 13. FAQ

The FAQ area should answer common customer questions.

Potential topics include:

- Do I need an appointment?
- How long does a haircut take?
- What payment methods are accepted?
- What happens if I need to cancel?
- Are walk-ins accepted?
- Which services are available?
- Which products are used?

Actual FAQ content will be written separately from this technical/product specification.

---

# 14. Feedback Submission

The public website should allow customers to submit feedback.

## Feedback Information

The initial form may include:

- Name
- Email
- Rating
- Comment

The exact required fields can be decided during implementation.

## Submission Flow

```text
Customer
   |
   v
React feedback form
   |
   v
FastAPI
   |
   v
Feedback stored as Pending
```

New public feedback should not automatically appear on the website.

---

# 15. Feedback Visibility

The business owner controls which feedback is visible publicly.

Feedback should appear publicly only when:

- It has been approved
- It is marked for public visibility

Conceptually:

```text
Submitted
   |
   v
Pending
   |
   v
Admin Review
   |
   +---- Rejected
   |
   v
Approved
   |
   v
Public Visibility Enabled
   |
   v
Shown on Website
```

Approval and public visibility should remain separate concepts.

---

# 16. Public Feedback Presentation

Approved public feedback may appear:

- On the home page
- In a dedicated feedback/testimonials area

Displayed information may include:

- Customer name
- Rating
- Comment

Private customer information must not be exposed.

The website should never display customer email addresses or internal appointment information as part of a public review.

---

# 17. Public vs. Private Data

The website should expose only customer-safe information.

## Public Data

Examples:

- Business information
- Business hours
- Active services
- Selected product information
- Simplified availability
- Static gallery images
- Approved public feedback
- Contact information

## Private Data

The public website must not expose:

- Client profiles
- Client contact information
- Visit notes
- Appointment details
- Internal inventory data
- Cost prices
- Inventory movements
- Pending or rejected feedback
- Individual barber availability or names in the public calendar
- Admin-only settings

---

# 18. Frontend and Backend Responsibilities

## React

Responsible for:

- Rendering the public website
- Navigation
- Static image presentation
- Contact interactions
- Forms
- Displaying API data

## FastAPI

Responsible for:

- Returning public services
- Returning public product information
- Returning simplified availability
- Accepting feedback
- Returning approved public feedback
- Returning business information when it is database-driven

React should not directly access core Supabase PostgreSQL tables.

---

# 19. Static vs. Dynamic Content

The public website contains both static and dynamic content.

## Static Frontend Content

Examples:

- Gallery images
- Hero images
- Decorative imagery
- Page layout
- Some marketing copy

Changes require a frontend update and redeployment.

## Dynamic API Content

Examples:

- Services
- Product information
- Availability
- Business hours if managed through admin
- Contact/business details if managed through admin
- Approved feedback

Dynamic content should come through FastAPI.

---

# 20. Mobile Requirements

The public website should work well on:

- Mobile phones
- Tablets
- Desktop screens

Mobile should be treated as a primary experience.

Key information should remain easy to access:

- Services
- Prices
- Availability
- Contact actions
- Address
- Business hours

---

# 21. Accessibility Direction

The public website should support:

- Readable typography
- Clear focus states
- Keyboard navigation where relevant
- Good contrast
- Meaningful image alternative text
- Accessible form labels
- Accessible interactive controls

Detailed accessibility acceptance criteria can be defined later.

---

# 22. Performance Direction

The site should remain lightweight and fast.

Because gallery and business images are static assets, image optimization should be considered during frontend implementation.

The website should avoid unnecessary client-side complexity for informational pages.

---

# 23. SEO Direction

The public website should be structured so common business information can be discovered by search engines.

Important content includes:

- Business name
- Services
- Location
- Contact information
- Business hours

Detailed SEO implementation will be planned during frontend implementation.

---

# 24. Out of Scope for Initial Website

The initial public website does not require:

- Online appointment booking
- Appointment cancellation by customers
- Customer accounts
- Online payments
- Product e-commerce
- Dynamic gallery management
- Supabase image storage
- AI features
- Loyalty programs
- Customer appointment history
- Live chat

---

# 25. Deferred Website Decisions

The following can be finalized during design or implementation planning:

- Exact route structure
- Single-page vs. multi-page presentation
- Map provider
- Exact contact channels
- Exact FAQ content
- Product descriptions
- Gallery categories
- Availability labels
- Feedback form required fields
- SEO implementation details
- Static image optimization strategy

These decisions should remain consistent with `architecture.md`, `database-schema.md`, and `admin-spec.md`.
