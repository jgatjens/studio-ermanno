# Gift vouchers — implementation plan

Status: plan only, 6 October 2026. No application changes or deployment.

## Confirmed scope

- Vouchers are sold in the salon. The public website only announces their availability: no enquiries, purchase buttons, checkout, payment integrations or email delivery.
- Support both euro-value vouchers and vouchers for a specific service.
- Unused euro credit remains available for later visits.
- Use the supplied “Buono regalo” card as a visual reference for the printable voucher.

Follow `docs/architecture.md` and `docs/tech-stack.md`. Retain React/Vite/TypeScript, shadcn/ui, existing auth context and TanStack Query; FastAPI, SQLAlchemy and Alembic; Supabase PostgreSQL and Auth only. No Supabase Storage, new state library, generic permissions system or hosting-provider dependencies.

## Proposed admin experience

Add **Gift vouchers** to admin navigation with a responsive list, creation form and detail page. Use the current black primary buttons, outlined secondary buttons and shadcn components.

List: search by code or purchaser/recipient name; filter active, redeemed and voided vouchers; display type, original value or service, remaining credit and issue date. Include loading, empty, error and pending-action states. On mobile use readable cards; on desktop use a compact table.

Creation: choose **Euro amount** or **Service**, enter purchaser (“Da”) and recipient (“Per”) names, optionally add a gift message, review and explicitly confirm payment was received in the salon before issuing. Names do not require creating client records. Avoid collecting contact information for this first version. Amounts are EUR; service selection uses the existing business service catalog. Snapshot the service name, description and price when issued so later catalog edits do not change the gift.

Detail: show a clear status, remaining balance or promised service, issue information, printable preview and chronological activity. Owner can record a redemption or void an unused voucher after confirmation. Issued vouchers cannot be edited or deleted; mistakes require voiding the unused voucher and issuing a replacement. Payment confirmation is an operational record, not a receipt or accounting system.

Proposed routes: `/admin/gift-vouchers`, `/admin/gift-vouchers/new`, `/admin/gift-vouchers/:id`. Keep form drafts local and use existing actor/business-scoped query caches; clear them with the current logout flow.

## Authorization

Recommend **Owner-only voucher management and reads for the initial version**, because this is a financial workflow. Staff remains read-only elsewhere and cannot create, redeem or void vouchers. Hide voucher navigation from Staff as a UX convenience; FastAPI must enforce the restriction independently and return 403 for a valid Staff actor. Missing/invalid tokens return 401.

Use the existing authenticated actor and database membership to derive business and role. Never accept a frontend business ID or role as authority. Every list, lookup, service selection and appointment reference is scoped to that business. No public API exposes individual vouchers or their balances, and knowing a code alone never authorizes redemption. Staff voucher reads can be considered separately if needed.

## Voucher rules and data

Add an Alembic migration for `gift_vouchers` and an append-only `gift_voucher_events` table.

Voucher fields: ID, business ID, server-generated unique random code, type (`AMOUNT` or `SERVICE`), purchaser/recipient display names, optional message, original amount and remaining amount for value vouchers, service ID and immutable service snapshots for service vouchers, EUR currency, status (`ACTIVE`, `REDEEMED`, `VOIDED`), issued timestamp, issuing actor, and nullable expiry date only if an expiry policy is approved. Record payment confirmation at issuance. No draft database lifecycle is needed: the creation form issues the voucher atomically after review.

Events record issuance, redemption and voiding with actor, timestamp, amount where applicable, linked appointment for redemption and an idempotency key. Preserve the event history; no hard deletion of issued vouchers. Use the repository's decimal money conventions, positive-amount validation and database constraints that prevent negative balances or balances above the original amount. Use business-consistent references and unique idempotency constraints.

Generate non-sequential codes using a secure random generator with a database uniqueness constraint and retry collisions. Codes should be easy to read on paper; do not encode customer information. Avoid recording codes or personal messages in ordinary request logs.

Amount vouchers allow multiple partial redemptions until the balance reaches zero. Service vouchers are redeemed once for the selected service; no partial-service credits or service bundles in this version. A service voucher continues to represent its original promise if the catalog service is renamed or deactivated. Require Owner confirmation when handling that historical service, rather than silently substituting another service.

Propose no expiry until a policy is explicitly approved; do not invent a validity period. Voiding is limited to vouchers with no redemptions. Voiding does not perform a refund. Refunds, corrections after redemption and accounting treatment require a separate agreed workflow; do not implement informal balance editing.

## Redemption and appointments

Use an explicit Owner-only **Redeem voucher** action on voucher detail. For the initial version, redemption links to an existing completed appointment in the same business; it does not modify appointment completion, service pricing or inventory behavior.

For amount vouchers, show the current balance and let Owner specify the amount applied. Validate it against both the locked voucher balance and the appointment's final total minus previously recorded voucher applications. For service vouchers, confirm the appointment includes the matching service; record the covered appointment service and prevent another voucher from covering that same service. Exclude the value of service-covered lines when calculating remaining room for monetary vouchers. This records voucher usage only: it must not claim to track other payment methods or the customer's outstanding debt.

Implement validation, appointment coverage and ledger updates in one database transaction. Lock the appointment and voucher in a consistent order across redemption requests to prevent concurrent over-application and overspending. Enforce service-line uniqueness in the database. Duplicate requests with the same idempotency key and command return the original result; reuse with a different command is rejected. Failed transactions leave both balance and events unchanged. Fully consumed vouchers become redeemed.

Do not silently allow deleting or altering a completed appointment in ways that invalidate an existing redemption. Verify existing appointment rules and add a narrow guard where necessary. A future completion-form integration must preserve the current historical retry behavior and atomic history/inventory completion, and is outside this first implementation.

## API shape

Owner-only endpoints under `/gift-vouchers`:

- `GET /gift-vouchers`: scoped, paginated list with search/status filters.
- `POST /gift-vouchers`: validate, confirm payment and issue atomically.
- `GET /gift-vouchers/{id}`: detail and activity.
- `POST /gift-vouchers/{id}/redemptions`: appointment-linked redemption with idempotency key.
- `POST /gift-vouchers/{id}/void`: confirm and void an unused voucher with idempotency key.

Return explicit validation and conflict errors for invalid amounts, already-used services, inactive vouchers and stale balances. Keep out-of-business records inaccessible through the existing lookup conventions. Responses include authoritative status and balance so the frontend can refresh affected voucher and appointment queries.

## Printable gift card

Create a dedicated HTML/CSS print view using the reference's cream background, decorative framing and red ribbon direction, with readable “Buono regalo”, Da, Per, service/value, unique code and issue date. Include expiry/terms only after approval. Use landscape A5 as a proposed starting format, with a browser Print / Save as PDF action, no PDF server or file storage dependency.

Print only customer-facing fields; exclude internal actor information, redemption history and payment confirmation. Clearly mark unsaved previews “Anteprima — non valido”. A printed amount is the original gift value; the admin balance is authoritative after partial use. Use a safe static reference preview on the website, never an issued customer's card.

The supplied artwork says **0461 7653331**, whereas the previously confirmed website number is **0461 765351**. Confirm the correct number before publishing final card artwork. Populate business details from existing approved configuration, not text copied uncritically from the image.

## Public website section

Add a small Italian section to the homepage in the existing cream/serif visual style, with a gift-card preview or decorative motif and this proposed copy:

> **Buoni regalo**  
> Regala un momento di cura a chi vuoi bene. Scegli un importo o un servizio: i nostri buoni regalo sono disponibili per l’acquisto in salone.

No CTA, enquiry form, telephone purchase link or new public voucher route is needed. Keep the section responsive and accessible; decorative imagery receives empty alt text. Do not advertise expiry, refund rules or delivery options that have not been agreed.

## Implementation order

1. Confirm remaining business rules below and inspect current appointment/service snapshots and mutation rules.
2. Add constrained schema, migration and backend voucher service with atomic issuance, redemption and voiding.
3. Add Owner-only API and focused backend tests.
4. Build admin navigation, list, create/detail, redemption dialog and print view with existing shadcn components.
5. Add the informational homepage section and frontend tests.
6. Run all backend/frontend regressions, TypeScript checks and frontend production build; validate migration on a disposable database.
7. Verify Owner and Staff flows with development fixtures, mobile/tablet/desktop layouts and a real print preview. Deploy after review without seeding vouchers or making test financial writes in production.

## Required verification

Backend: missing/invalid/expired token; Owner access; Staff denial for reads and mutations; membership/business isolation including forged request inputs; valid issuance; invalid decimals and amounts; inactive/cross-business services; snapshot preservation; random-code collision retry; partial and full redemption; service eligibility and duplicate service coverage; appointment limits including mixed voucher types; concurrency; identical and conflicting idempotency retries; rollback; unused-only voiding; completed-appointment guards; historical events preserved.

Frontend: Owner navigation and Staff exclusion; direct-route denial; list/search/filter states; type-specific creation and payment confirmation; server error feedback; partial remaining balance; no duplicate submission; redemption/void confirmations; print content/privacy; 401/403 handling; homepage copy and absence of purchase/enquiry actions. Retain existing auth, appointment, inventory and public-site regression coverage.

Report actual test counts, TypeScript/build outcomes, migration checks, print/browser results and any manual setup when implementing. Planning itself does not require rerunning application tests.

## Decisions remaining before implementation

- Approve Owner-only voucher access, or request a specifically limited Staff read view.
- Confirm whether vouchers have no expiry or an explicit expiry policy.
- Confirm unused-voucher cancellation/refund handling and how redeemed mistakes will be corrected before live use; seek the business's accountant's guidance for receipts and applicable terms.
- Confirm the phone number discrepancy and proposed landscape A5 print format.
- Confirm the proposed completed-appointment redemption flow and single-service scope. Online sales, email delivery, public balance checks and integrated checkout remain deferred.
