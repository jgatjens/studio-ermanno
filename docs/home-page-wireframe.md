# Public Home Page Wireframe

## 1. Purpose

The Home page should quickly answer:

- What does the business offer?
- What are the main services?
- Is there availability?
- What does the work look like?
- What products are featured?
- What do customers say?
- Where is the business?
- How can someone make contact?

The page should feel modern, clean, warm, and professional.

---

# 2. Section Order

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

---

# 3. Header

## Content

- Business name or logo
- Navigation
- Optional contact CTA

## Navigation

- Services
- Products
- Gallery
- Availability
- Contact

## Mobile

- Compact header
- Menu trigger
- Keep one important CTA easy to reach

## Desktop

- Horizontal navigation
- Keep layout simple and spacious

---

# 4. Hero

## Content

- Strong headline
- Short supporting copy
- Primary CTA
- Secondary CTA
- One strong static image

## Suggested Actions

Primary:

- Check Availability

Secondary:

- View Services
- Contact Us

## Layout

### Mobile

```text
Headline
Supporting copy
Primary CTA
Secondary CTA
Image
```

### Desktop

```text
Text Content        Hero Image
```

Avoid carousels or complex animation.

---

# 5. Featured Services

## Goal

Help visitors understand the main services quickly.

## Content

Show a small selection of active services.

Each card should include:

- Service name
- Short description
- Duration
- Price

## Layout

### Mobile

Stacked cards.

### Desktop

Responsive 2–4 column grid.

## CTA

- View All Services

---

# 6. Availability CTA

## Goal

Make availability one of the most visible customer actions.

## Content

- Short heading
- Short explanation
- Availability status or next available indication when useful
- CTA to full availability view

## Example Structure

```text
Check Our Availability

See which dates still have availability.

[View Availability]
```

Do not expose hairdresser names.

Do not allow booking from this section.

---

# 7. Gallery Preview

## Goal

Show the quality and style of the business.

## Content

Use a small curated set of static frontend images.

Possible content:

- Haircuts
- Beard work
- Styling
- Before / after
- Business atmosphere

## Layout

### Mobile

- Single column
- Or compact 2-column grid

### Desktop

- Multi-column grid
- One image may be visually emphasized

## CTA

- View Gallery

No dynamic image management is required.

---

# 8. Featured Products

## Goal

Introduce products the business uses or recommends.

## Content

Show only active products marked as public.

Each item may include:

- Product name
- Brand
- Category
- Short description
- Retail price

Do not show:

- Current stock
- Minimum stock
- Cost price
- Internal SKU information

## Layout

### Mobile

Stacked or horizontal-scroll cards.

### Desktop

Responsive card grid.

## CTA

- View Products

---

# 9. Customer Feedback

## Goal

Build trust using approved public feedback.

## Content

Each item may include:

- Customer name
- Rating
- Comment

Only show feedback that is:

- Approved
- Publicly visible

## Layout

### Mobile

Stacked cards.

### Desktop

2–3 column grid or simple horizontal layout.

Avoid complex testimonial sliders for the MVP.

---

# 10. Location + Contact

## Goal

Make it easy to find and contact the business.

## Content

- Business name
- Address
- Phone
- Email
- WhatsApp when configured
- Instagram when configured
- Business hours
- Map
- Directions action

## Mobile

Prioritize tappable actions:

- Call
- Email
- WhatsApp
- Directions

Address and contact details should appear before or next to the map.

## Desktop

Use a two-column layout:

```text
Contact Details      Map
```

---

# 11. FAQ

## Goal

Answer common questions without requiring contact.

## Format

Accordion or stacked questions.

Possible topics:

- Do I need an appointment?
- How long does a haircut take?
- What payment methods are accepted?
- Are walk-ins accepted?
- What happens if I need to cancel?
- Which services are available?

Keep the initial FAQ short.

---

# 12. Footer

## Content

- Business name
- Address
- Contact links
- Navigation links
- Social links
- Copyright

Keep it compact.

---

# 13. Mobile Priority

On mobile, prioritize content in this order:

1. Business identity
2. Check Availability
3. Services
4. Gallery
5. Products
6. Feedback
7. Location / Contact
8. FAQ

The user should not need to scroll through decorative content before reaching useful information.

---

# 14. Desktop Behavior

Desktop may use:

- Wider containers
- Side-by-side layouts
- Multi-column grids
- Larger imagery
- More whitespace

Do not change the core content order or customer journey.

---

# 15. Key UI States

## Loading

Dynamic sections may use lightweight skeletons:

- Services
- Products
- Availability
- Feedback

Static imagery should reserve space to prevent layout shift.

## Empty

If no public products or feedback exist, hide the section rather than showing an empty admin-style state.

## Error

If a dynamic section fails:

- Keep the rest of the page usable
- Show a small retry/fallback message when appropriate

The entire Home page should not fail because one API section fails.

---

# 16. Responsive Rules

- Mobile-first layout
- No horizontal page scrolling
- Large touch targets
- Readable text
- Fluid grids
- Static images preserve aspect ratio
- Contact actions remain easy to tap
- Availability remains easy to understand on small screens

---

# 17. Accessibility

The Home page should include:

- Semantic headings
- Meaningful image alt text
- Accessible navigation
- Visible focus states
- Sufficient color contrast
- Accessible accordion controls
- Clear link/button labels

---

# 18. MVP Scope

Do not add:

- Online booking
- Customer accounts
- E-commerce
- Dynamic gallery uploads
- Complex animation
- Hero carousel
- Advanced product filtering
- Live chat
- AI features

The Home page should stay focused on discovery, trust, availability, location, and contact.
