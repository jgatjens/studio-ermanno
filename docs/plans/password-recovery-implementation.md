# Password recovery and replacement password — plan only

Status: proposed, 5 October 2026. No application code or Supabase settings changed.

## Recommendation and scope

Use Supabase Auth's email recovery flow for an existing account to set a replacement password. Interpret “create a new” as creating a new password, not registering an account. Add recovery to the login page and an Owner account-menu entry to send a recovery link to their own Supabase account email. Do not add public registration, membership creation, role changes, password management for other users, or invitation workflows.

Identity and password changes remain in Supabase Auth. FastAPI continues independently validating tokens and deriving Business Membership/OWNER/STAFF from the database. Recovery cannot grant membership or an Owner role. Existing Staff identities may recover their own passwords too; the anonymous recovery form cannot reliably identify the user's business role and must not disclose it.

## User experience

1. Login has a “Forgot password?” link to `/forgot-password`.
2. The form requests an email and calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })` using an explicitly configured application origin and `/reset-password`.
3. Show a neutral success message: “If an account exists for this email, you’ll receive a password reset link.” Do not expose user existence or membership. Disable duplicate submissions; show a resend cooldown and useful handling for delivery/rate-limit failures without claiming an email arrived.
4. Supabase verifies the emailed recovery link and returns the user to `/reset-password`.
5. After Supabase establishes the recovery session, show New password and Confirm password, visibility toggles, configured password requirements, pending state and inline errors. Call `supabase.auth.updateUser({ password })` only after recovery/session validation and matching fields. A URL flag alone is not evidence of authentication.
6. On successful update, clear recovery state, sign out the local recovery session and return to login with a success notice. Handle logout failure explicitly; do not claim that all other devices were signed out. Sign-in and `/auth/me` then use the existing authorization flow.
7. Invalid, expired, already-used or missing links get a recovery-specific error with “Request a new link” and “Back to login”. Opening `/reset-password` directly without a valid recovery session cannot submit a password update.
8. Owner account-menu “Reset my password” uses the current Supabase user's email, requires a deliberate click and reuses the same email-verification flow. It never lets an Owner reset someone else's password.

Use current shadcn form components and clean black primary/outlined secondary buttons. Match the current admin login language and include the public-website return link. No new auth state library.

## Auth integration

- Extend `web/src/auth/auth-provider.tsx` with an explicit recovery state and `PASSWORD_RECOVERY` handling. Its current synchronous callback ignores the event name and immediately reloads `/auth/me` for every session event.
- Keep Supabase's auth callback synchronous; perform asynchronous SDK calls outside it to avoid its session lock.
- Recovery routes sit outside admin membership guards and ordinary authenticated-login redirects. Recovery must remain usable even if the backend is unavailable or the identity has no membership.
- While completing recovery, prioritize the reset form and prevent automatic navigation into admin. This UI routing rule is not a claim that Supabase recovery sessions have reduced backend privileges.
- The current SPA client uses `createClient` defaults. Retain the supported existing browser flow, confirm URL-session parsing and recovery-event timing with the installed SDK, and avoid a separate manual token implementation. Do not switch to PKCE casually: account for same-browser verifier constraints and test cross-browser email opening before any flow change.
- On callback, handle Supabase errors and remove consumed tokens from the URL after SDK processing. Never log passwords or recovery tokens or persist them in query caches, analytics or app storage.
- Decide reload behavior explicitly: a reload must either safely restore validated recovery context or show a request-new-link state, without silently opening admin or trusting a saved marker as credentials.

## Supabase and deployment setup

- Confirm production Site URL is `https://studio-ermanno.pages.dev`.
- Allow exact local and production reset redirect URLs, including `http://localhost:5173/reset-password` and `https://studio-ermanno.pages.dev/reset-password`; add any actual alternative development origin explicitly. Avoid broad production wildcards.
- Configure an application-origin environment variable where needed and document a non-secret `.env.example`; do not accept redirect origins from user input.
- Configure custom SMTP in Supabase Auth for production delivery. The built-in sender is intended for testing and only sends to project-team addresses. Select the email provider and sender domain before production rollout; verify sender DNS and delivery. SMTP credentials belong in Supabase settings, never Vite/browser environment variables.
- Brand the recovery email for I Minati Parrucchieri. Keep the template compatible with the chosen redirect flow and test expiry/reuse. Avoid email link tracking that rewrites recovery URLs.
- Confirm configured password policy and Auth rate limits. UI checks mirror the policy; Supabase enforces it. Respect configured reauthentication requirements rather than bypassing them.
- Verify Cloudflare SPA fallback supports direct callback navigation. No privileged Supabase key, database changes, new backend password endpoint, or custom email-sending backend is required.

## Implementation sequence

1. Confirm password policy, callback URLs, and SMTP readiness in development.
2. Implement recovery state handling and callback routing before adding forms.
3. Add forgot-password and reset-password forms plus Owner own-account entry.
4. Add baseline auth tests and update deployment/setup documentation.
5. Run TypeScript, all frontend tests, production build and existing backend auth tests.
6. Manually verify with disposable development accounts; only then configure/test production delivery with the account holder. Do not change a real user's password during automated QA.

## Verification

Automated coverage: email request arguments/redirect; generic success; invalid email and request failure; duplicate/resend behavior; recovery event versus normal sign-in; no admin redirect during recovery; direct invalid callback; expired/error callback; matching passwords and configured policy; successful update and local sign-out; update/sign-out failures; ordinary login/session restoration; recovery without membership never yields admin access; OWNER/STAFF authorization regression tests; Owner action uses their own Supabase email.

Manual checks: email delivery; actual recovery link; new password login; old password rejection; expired/reused links; reopening/reloading callback; mobile and desktop; same-browser and other-browser email links; no password/token exposure in application logs. Document existing-session behavior as observed rather than promising immediate global JWT invalidation.

## Remaining setup decisions

Choose the SMTP provider and verified sender address/domain, confirm the project's password policy, and confirm the intended reset-email language. These are deployment decisions, not blockers to preparing application code after approval.

## Sources

- [Supabase password reset JavaScript reference](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase password-based authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
