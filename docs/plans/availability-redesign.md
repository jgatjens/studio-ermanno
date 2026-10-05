# Public availability redesign plan

Status: implemented locally, 5 October 2026. Public header/footer and read-only availability redesign are complete. Dedicated reference photography remains a future asset replacement; existing approved photographs are used through independent availability image exports. No deployment performed.

## Goal and reference

Use the supplied desktop/mobile screenshot as the visual direction for `/availability`: warm ivory backgrounds, near-black actions, editorial serif headings, restrained borders, salon photography, and a clear date → available-times browsing flow. Treat the screenshot as a design reference; the displayed dates, opening hours, photographs, and business name are not verified business data.

## Scope boundaries

| Layer                    | Work                                                                   | Effect                                                                               |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Shared public foundation | Public color, typography, spacing, buttons and focus treatments        | All public pages; scope styles under `.public-site` so admin styles stay independent |
| Shared header/footer     | Brand, navigation, mobile menu, availability CTA, social/contact links | All public routes through `web/src/public/layout.tsx`                                |
| Availability hero        | Italian introduction, large heading, dedicated salon image             | `/availability` only; do not change the home hero                                    |
| Availability interaction | Month calendar, date browsing, read-only available times               | `/availability` only                                                                 |
| Help section             | Supporting image, WhatsApp/call actions, business opening hours        | Initially `/availability`; extract for reuse when another page needs it              |

Keep existing routes accessible. Map “Studio” to `/`, “Servizi” to `/services`, “Gallery” to `/gallery`, and “Contatti” to `/contact`. Keep Products, FAQ, Feedback and Staff login reachable through suitable secondary/footer links instead of deleting them to match the screenshot. Suggested header CTA: “Disponibilità” linking to `/availability`; reserve “Prenota ora” for an explicitly approved booking/contact wording decision.

## Current implementation and constraints

- `web/src/routes/availability.tsx` fetches anonymous `/public/availability` data, selects a day, and displays informational intervals. It already handles aborting stale requests, retry, refresh, loading and empty results.
- `api/app/availability/router.py` limits each request to 1–14 days. A full calendar month needs several bounded requests or a separately scoped API change.
- `web/src/public/layout.tsx` owns header/footer, menu behavior, metadata, skip link and the main content wrapper. Its current main padding must support an edge-to-edge availability hero without changing other pages' content gutters.
- `web/src/index.css` contains both public and admin styling and has existing local edits. Integrate carefully; do not overwrite unrelated work.
- `web/src/public/data.ts` provides public business data and validated contact links. Use this for phone, WhatsApp, Instagram, business timezone and opening hours.
- `web/src/public/content.ts` has existing authorized gallery images, but not the reference's chair/tool photography. Add dedicated availability assets once supplied or selected; use existing approved images as an interim option.
- `docs/website-spec.md` defines availability as informational and excludes public online booking. The user confirmed that this redesign should only show available spots: no time selection, selected-appointment summary, Continue action, or booking flow.

## Recommended behavior

1. Render a Monday-first month calendar localized to Italian. Initialize the month from the business timezone, using the backend's default start response to identify the business-local current date. Never hardcode October 2026.
2. Fetch the month in chunks of at most 14 days. Cancel outdated month requests and only present the completed current month as current data. Adjacent-month cells can be muted and noninteractive. Dates before business-local today are disabled.
3. Preserve API states: AVAILABLE → “Disponibile”; LIMITED → “Poco disponibile”; FULL/CLOSED → visually unavailable, with distinct accessible labels for full and closed. Missing/failed data must be marked unknown, not unavailable.
4. Let visitors choose a date to view its available intervals in chronological order. Include AVAILABLE and LIMITED intervals only; omit FULL/CLOSED intervals from the time grid. Dates with no available intervals show a clear empty/closed state.
5. Render time spots as read-only items, not buttons: no selected time, hover treatment implying selection, or appointment summary. Format times in the returned timezone; preserve UTC offsets where daylight-saving changes create repeated clock times. Derive morning/afternoon separation from gaps in returned intervals, not fixed noon/14:00 rules.
6. Remove the screenshot's “Continua” action and selected-appointment card. Calendar date selection only changes which day's information is displayed. Refresh reloads availability and updates the displayed day safely.
7. Show “La disponibilità è indicativa e verrà confermata dal nostro team.” near the available times. Aggregated capacity does not guarantee availability for a particular service duration or barber.
8. Handle loading, retry, no available dates, closed days, full days, no intervals and missing contact details explicitly. Keep the general WhatsApp/call help section usable even when availability cannot load. Contact links do not carry a selected time.

## Responsive composition

Desktop: shared header → split hero (text left, image right) → two-column date/time section → availability disclaimer → help strip (image, contact copy/actions, opening hours) → shared footer.

Mobile: compact shared header/menu → hero text → landscape image → calendar → two-column time grid → availability disclaimer → help section → shared footer. The screenshot omits the mobile help/footer; include compact versions for contact access and consistent site navigation. Use normal document flow initially.

Start with the existing 767px public breakpoint and adjust only when content requires it. Verify at 375px, 768px, 1024px and 1440px, plus 320px for overflow. Use fluid sizing, not screenshot pixel dimensions. Preserve 44px touch targets even when reference controls are smaller. The displayed date and availability must be understandable without color; calendar buttons need full date/state labels and visible keyboard focus.

## Implementation sequence

### 1. Confirm content and prepare assets

- Confirm Italian public copy, logo/wordmark, dedicated hero/support photographs, and font choice.
- Use API business details for contact information and hours; avoid hardcoded screenshot values.
- Adjust hero copy to describe browsing availability. Suggested eyebrow: “Disponibilità”; supporting text: “Controlla gli orari disponibili e contattaci per concordare il tuo appuntamento.”
- Record image source/permission, export responsive WebP assets, provide alt text, dimensions and suitable crops.

Done when content, image mapping and general contact destinations are documented with no guessed business details.

### 2. Build shared public foundation and shell

- Add public-only tokens and reusable button/type styles.
- Refactor shared header/footer, preserving route access, keyboard menu behavior, skip link and metadata.
- Add a page-specific full-width layout option for availability. Keep other page gutters intact.

Done when every public route works with the new shell at desktop/mobile widths and admin remains visually unchanged.

### 3. Build availability composition

- Create focused page components: `AvailabilityHero`, `AvailabilityCalendar`, `AvailabilityTimeSlots`, and `AvailabilityContactHelp`.
- Keep their state and data coordination in the availability page; add a dedicated month-fetch hook if it simplifies chunk loading/cancellation.
- Implement hero, calendar/time columns, help strip, and responsive styles. Use development/test fixtures for visual comparison only.

Done when the desktop/mobile composition follows the screenshot and all required states have layouts.

### 4. Connect real availability data

- Load month chunks with the current API and preserve anonymous/no-store requests and stale-request cancellation.
- Connect date browsing, read-only available interval filtering, refresh, general contact links and business hours.
- Replace old date-range controls with month navigation; preserve useful retry/refresh behavior.
- Update public copy/spec documentation to describe the read-only availability view accurately.

Done when a user can browse dates and see only real available intervals, with no time-selection or reservation controls.

### 5. Verify and release

- Adapt `web/src/routes/availability.test.tsx` for month chunking, navigation races, refresh, unavailable/unknown dates, available-only interval filtering and absence of time-selection/Continue controls.
- Update `web/src/public/public.test.tsx` for shared route access, menu keyboard behavior and metadata if changed.
- Cover split hours, Italian date formatting, business-local today and repeated DST times. Use existing backend availability tests unchanged if no API change is made.
- Run `npm run typecheck`, `npm test`, and `npm run build` in `web`.
- Visually compare calendar/hero/available-times layout to the reference across the target widths; inspect all public routes after shared style changes, and smoke-check admin for style leakage.
- Check keyboard flow, focus, displayed-date announcements, contrast, zoom/overflow and image loading.

Done when checks pass, responsive screenshots are reviewable, real business content is present, and available spots are informational with no selection action.

## Delivery organization

Recommended reviewable changes: (1) shared public styles/header/footer, (2) availability layout/assets, (3) calendar integration/read-only time display and relevant verification. These can be consecutive commits within one feature branch. Keep the existing admin/client changes separate. Start with the shared foundation because it determines page width, typography and navigation; then build the page-specific hero and calendar.

Open content decisions: exact logo assets, reference-matching photographs, font, final navigation labels, and Italian rollout scope for other pages. Recommended defaults: preserve existing route access, localize the new shell/availability UI, and show available times with general contact options.

## Implementation verification

- TypeScript validation, all 156 frontend tests, and production build passed. Vite reports its existing large JavaScript chunk advisory.
- Browser checks used the local API: read-only slots, business contact/hours, mobile menu, and responsive layouts at 320, 375, 768, 1024 and 1440px; no horizontal page overflow observed.
- Shared header/footer smoke-checked on Home, Services, Products, Gallery, Contact, FAQ and Feedback.
- Availability requests remain anonymous, bounded to 14 days per request, and cancel stale month results. Full/closed time intervals are omitted; selecting a calendar date only changes the displayed day.
- Tests cover available-only filtering, split hours, business-local dates, DST offsets, empty/error states, refresh and month-navigation races.
- Local business data currently identifies itself as “I Minati Parrucchieri”; brand, hours and contact links follow the configured public business response.
