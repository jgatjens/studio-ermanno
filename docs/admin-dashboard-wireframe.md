# Admin Dashboard Wireframe

## 1. Purpose

The Admin Dashboard is the main operational screen for daily business use.

It should help the owner or Staff user answer:

- What is happening today?
- What appointment is next?
- Are there any important appointment issues?
- Which products are low in stock?
- Is there feedback waiting for review?

The dashboard is designed mobile-first.

---

# 2. Information Priority

Recommended order:

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

The dashboard should prioritize current operational tasks over analytics.

Do not add charts to the MVP dashboard.

---

# 3. Mobile Layout

Use a single-column layout.

```text
┌──────────────────────────┐
│ Header                   │
│ Business / Greeting      │
├──────────────────────────┤
│ Next Appointment         │
├──────────────────────────┤
│ Today's Appointments     │
├──────────────────────────┤
│ Appointment Alerts       │
├──────────────────────────┤
│ Low Stock                │
├──────────────────────────┤
│ Pending Feedback         │
├──────────────────────────┤
│ Bottom Navigation        │
└──────────────────────────┘
```

Keep cards compact enough that the user can scan the day quickly.

---

# 4. Page Header

## Content

- Business name or admin title
- Current day/date
- Optional compact profile/menu action

Do not overload the header with secondary actions.

---

# 5. Next Appointment Card

## Goal

Make the next scheduled appointment immediately visible.

## Show

- Time
- Client name
- Hairdresser or `Unassigned`
- Main service or service summary
- Appointment status

## Actions

Owner:

- Open Appointment
- Optional quick status action when appropriate

Staff:

- Open Appointment

Staff should not see mutation actions.

## Empty State

```text
No upcoming appointments today.
```

---

# 6. Today's Appointments

## Goal

Provide a quick view of the remaining schedule.

## Each Row/Card

Show:

- Time
- Client
- Hairdresser or Unassigned
- Main service
- Status

Optional supporting information:

- Duration

## Mobile Behavior

Use compact stacked rows.

Avoid a dense calendar grid on the Dashboard.

The full calendar belongs in the Calendar section.

## Actions

Tap an item to open Appointment Detail.

---

# 7. Appointment Statuses

Use consistent status indicators for:

- Scheduled
- Confirmed
- Completed
- Cancelled
- No Show

Do not communicate status through color alone.

Use a badge, label, or icon with text.

---

# 8. Appointment Alerts

## Goal

Surface scheduling items requiring attention.

Possible MVP alerts:

- Appointment starts soon
- Appointment currently starting
- Unassigned upcoming appointment
- Scheduling conflict if detected

Avoid building a complex notification center.

## Layout

Use a compact alert list.

Each alert should:

- Explain the issue clearly
- Link to the related appointment when relevant

---

# 9. Low Stock

## Goal

Surface products that need attention.

## Show

For each low-stock product:

- Product name
- Current stock
- Minimum stock

## Owner Action

- Open Inventory
- Add Stock

## Staff

Staff may view the low-stock information but should not receive mutation controls.

## Empty State

```text
Stock levels look good.
```

---

# 10. Pending Feedback

## Goal

Let Owners quickly see if feedback requires moderation.

## Show

- Number of pending feedback items
- Optional preview of the latest item

## Owner Action

- Review Feedback

## Staff

Staff may view feedback according to admin permissions but should not see approval/rejection actions.

## Empty State

```text
No pending feedback.
```

---

# 11. Quick Actions

Keep quick actions minimal.

Suggested Owner actions:

- Create Appointment
- Search Client

These may appear:

- Near the top
- As a floating action
- Or as compact buttons below the header

Do not add a large grid of shortcuts.

Staff should not see create/edit quick actions.

---

# 12. Bottom Navigation

Suggested mobile navigation:

```text
Dashboard
Clients
Calendar
Inventory
More
```

## Rules

- Dashboard is active on this screen.
- Keep labels visible when possible.
- Use familiar icons.
- Do not rely on icons alone.
- Keep touch targets comfortable.

`More` may contain:

- Services
- Products
- Feedback
- Settings

---

# 13. Owner State

Owners have full access.

The Dashboard may show:

- Create Appointment
- Add Stock
- Review Feedback
- Other relevant mutation actions

Keep these actions contextual rather than showing all possible admin operations at once.

---

# 14. Staff Read-Only State

Staff users have read-only admin access.

The Dashboard should:

- Show operational information
- Allow navigation into permitted detail views
- Hide create/edit/delete/approve/reject actions

Staff may see:

- Client name
- Appointment history
- Services
- Products used
- Appointment notes

Staff may not see:

- Client email
- Client phone
- Private client notes
- Visit notes

The frontend should hide restricted information, but FastAPI remains the source of truth for authorization.

---

# 15. Loading State

Use lightweight skeletons for:

- Next appointment
- Today's appointments
- Low-stock summary
- Pending feedback

Avoid blocking the whole dashboard while all sections load.

---

# 16. Empty States

Use short, useful empty states.

Examples:

```text
No appointments today.
```

```text
No upcoming appointment.
```

```text
Stock levels look good.
```

```text
No pending feedback.
```

Do not make empty cards visually dominant.

---

# 17. Error States

A single failed section should not break the entire Dashboard.

Example:

```text
Could not load inventory status.
[Retry]
```

Other sections should remain usable.

Do not expose raw API or database errors.

---

# 18. Desktop / Tablet Adaptation

The mobile hierarchy remains the source of truth.

On larger screens, the layout may become:

```text
┌───────────────────────────────────────┐
│ Header                                │
├──────────────────────┬────────────────┤
│ Next Appointment     │ Low Stock      │
├──────────────────────┤                │
│ Today's Appointments │ Pending        │
│                      │ Feedback       │
├──────────────────────┴────────────────┤
│ Appointment Alerts                    │
└───────────────────────────────────────┘
```

Desktop may also use sidebar navigation.

Do not introduce desktop-only business workflows.

---

# 19. Interaction Rules

- Entire appointment rows may be tappable.
- Primary actions must be obvious.
- Avoid tiny icon-only controls.
- Avoid hover-only interactions.
- Destructive actions should not appear directly on the Dashboard unless necessary.

---

# 20. Accessibility

The Dashboard should support:

- Large touch targets
- Visible focus states
- Keyboard navigation
- Accessible status labels
- Sufficient contrast
- Clear section headings
- Logical reading order

---

# 21. MVP Scope

Do not add:

- Revenue charts
- Advanced analytics
- Staff performance metrics
- Appointment forecasting
- AI summaries
- Notification center
- Drag-and-drop scheduling
- Payroll information
- Business accounting widgets

The Dashboard should remain a fast operational overview.

---

# 22. Success Criteria

The Dashboard is successful when an Owner can open the admin on a phone and quickly:

1. Identify the next appointment.
2. Review today's schedule.
3. Notice an unassigned or upcoming appointment.
4. Identify low-stock products.
5. See whether feedback needs review.
6. Navigate to the relevant workflow in one or two taps.
