# Phase 2 Implementation

## Goal

Integrate Supabase Auth with the existing FastAPI backend and enforce MVP authorization rules.

Phase 2 should prove:

```text
React
  ↓
Supabase Auth
  ↓
Access Token
  ↓
FastAPI
  ↓
Admin Membership
  ↓
Owner / Staff authorization
```

This phase should also establish field-level visibility rules for client data.

Do not implement real client CRUD, appointment workflows, or other business features yet.

---

## Dependencies

Phase 2 depends on:

- Phase 0 complete
- Phase 1 complete
- Supabase Auth project configured
- Admin Membership model exists
- Seeded Owner and Staff memberships exist
- FastAPI configuration is centralized
- Frontend Supabase client is initialized

---

## Scope

Implement:

- Supabase Auth login
- Supabase Auth logout
- Session restoration
- FastAPI access-token validation
- Admin Membership lookup
- Owner authorization
- Staff authorization
- Field-level client visibility policy
- Protected test endpoints
- Frontend auth state
- Protected frontend routes
- Baseline authorization tests

Do not implement domain CRUD.

---

# Backend

## 1. Authentication Dependency

Create a reusable FastAPI authentication dependency.

Its responsibility is to:

1. Read the bearer token from the request.
2. Validate the Supabase access token.
3. Extract the authenticated Supabase user ID.
4. Resolve the corresponding Admin Membership.
5. Return a normalized authenticated actor/context.

Conceptually:

```text
Authorization: Bearer <token>
        ↓
Validate token
        ↓
Supabase user id
        ↓
Admin Membership
        ↓
Authenticated Actor
```

---

## 2. Authenticated Actor

Define one internal representation for authenticated admin users.

Recommended information:

- auth_user_id
- membership_id
- business_id
- role

Possible conceptual shape:

```text
AuthenticatedActor
- auth_user_id
- membership_id
- business_id
- role
```

Keep this internal to the backend.

Do not trust business IDs or roles sent by the frontend.

---

## 3. Token Validation

FastAPI must validate Supabase access tokens independently.

Validation should verify the token properties required for secure authentication.

At minimum:

- Signature
- Expiration
- Expected issuer/configuration
- Expected audience when configured
- User identifier

Do not treat token decoding without verification as authentication.

---

## 4. Supabase Key Handling

Keep authentication configuration environment-based.

Backend may require values such as:

```text
SUPABASE_URL
SUPABASE_JWT_AUDIENCE
```

Use the minimum configuration required by the chosen Supabase JWT verification approach.

Do not expose privileged backend credentials to the frontend.

---

## 5. Membership Lookup

After token validation:

- Extract Supabase Auth user ID.
- Find the matching Admin Membership.
- Confirm the membership is associated with a Business.
- Resolve the role.

If no valid membership exists:

- Reject the protected request.

Do not automatically create memberships from authentication tokens.

Membership provisioning is outside this phase.

---

## 6. Roles

Support only:

- OWNER
- STAFF

Do not introduce additional roles.

---

## 7. Owner Authorization

Owner has full MVP admin access.

Create reusable authorization helpers/dependencies for Owner-only operations.

Conceptually:

```text
require_authenticated_actor
require_owner
```

Do not duplicate role checks manually in every future route.

---

## 8. Staff Authorization

Staff is read-only.

Create reusable authorization behavior that allows Staff to:

- Access permitted protected read endpoints
- Receive filtered client information

Staff must not be allowed to execute mutation endpoints.

For Phase 2, prove this using protected test endpoints only.

---

## 9. Field-Level Client Visibility

Define the MVP visibility policy centrally.

### Owner Can See

- Client name
- Email
- Phone
- Private/general notes
- Appointment history
- Services
- Products used
- Appointment notes
- Visit notes

### Staff Can See

- Client name
- Appointment history
- Services
- Products used
- Appointment notes

### Staff Cannot See

- Email
- Phone
- Private/general notes
- Visit notes

Do not scatter these rules across frontend components.

The backend must be able to shape or filter client responses according to the authenticated role.

---

## 10. Visibility Policy Helper

Create a small reusable policy/serializer mechanism for client visibility.

Phase 2 does not need real client endpoints.

The goal is to establish one tested approach that later client APIs can reuse.

Possible responsibilities:

- Accept a full internal client representation.
- Accept an Authenticated Actor.
- Return only permitted fields.

Avoid creating a large generic permissions framework.

---

# Protected Test Endpoints

## 11. Authenticated Endpoint

Add a minimal protected endpoint.

Example:

```text
GET /auth/me
```

Suggested response:

- auth user id
- business id
- role

Do not expose sensitive token claims or secrets.

Purpose:

- Prove token validation
- Prove membership lookup
- Prove frontend authenticated API calls

---

## 12. Owner-Only Test Endpoint

Add one temporary/minimal Owner-only endpoint.

Example:

```text
POST /auth/test-owner
```

Behavior:

- Owner → success
- Staff → forbidden
- Unauthenticated → unauthorized

This endpoint exists only to verify authorization behavior.

It may be removed or replaced later.

---

## 13. Staff Read Test Endpoint

Add one protected read endpoint available to both roles.

Example:

```text
GET /auth/test-read
```

Purpose:

- Owner can access
- Staff can access
- Unauthenticated cannot access

---

## 14. Client Visibility Test Endpoint

Add one temporary endpoint or test-only service path that proves role-based client shaping.

Example conceptual endpoint:

```text
GET /auth/test-client-visibility
```

Owner response may include:

- name
- email
- phone
- private_notes
- visit_notes

Staff response must omit restricted fields.

Do not turn this into real client CRUD.

---

# Frontend

## 15. Supabase Auth Flow

Implement:

- Login
- Logout
- Session restore

Use the existing Supabase frontend client.

Keep the first login flow simple.

Use only the authentication method required for the MVP.

If email/password is chosen, do not add OAuth providers.

---

## 16. Frontend Auth State

Create a small centralized auth state layer.

It should track:

- Loading / initializing
- Authenticated
- Unauthenticated
- Current Supabase session
- Current backend actor/membership when available

Keep this lightweight.

Do not add Redux solely for auth state.

---

## 17. Backend Actor Fetch

After Supabase session restoration or login:

1. Get the access token.
2. Call `/auth/me`.
3. Store the normalized backend actor.

This proves the frontend does not infer:

- role
- business id
- permissions

from local assumptions.

The backend remains authoritative.

---

## 18. Protected Routes

Protect `/admin`.

Behavior:

### Initializing

Show a loading state.

### Unauthenticated

Redirect to login.

### Authenticated with valid membership

Allow admin access.

### Authenticated without membership

Show a clear access-denied state.

Do not silently treat authenticated Supabase users as valid admin users.

---

## 19. Login Page

Create a minimal login screen.

Requirements:

- Email
- Password
- Submit
- Loading state
- Error state

Keep the UI simple.

No password-reset flow is required unless already trivially supported and needed.

---

## 20. Logout

Provide a basic logout action.

Logout should:

- Clear Supabase session
- Clear frontend actor state
- Return the user to the public/login experience

---

## 21. Role-Aware Frontend Behavior

Phase 2 should prove basic role-aware rendering.

Examples:

### Owner

Show a temporary:

```text
Role: Owner
```

and allow the Owner-only test action.

### Staff

Show:

```text
Role: Staff
```

and hide the Owner-only test action.

Important:

Frontend hiding is convenience only.

Backend authorization remains mandatory.

---

# API Client Authentication

## 22. Bearer Token Injection

Update the frontend API client so protected API calls include:

```text
Authorization: Bearer <Supabase access token>
```

Keep the implementation centralized.

Do not manually add headers throughout components.

---

## 23. Auth Error Handling

Handle:

- 401 Unauthorized
- 403 Forbidden

Recommended behavior:

### 401

- Treat session as invalid or expired when appropriate.
- Re-evaluate frontend auth state.

### 403

- Keep user authenticated.
- Show an access-denied message.

Do not treat 403 as logout.

---

# Error Responses

## 24. Backend Auth Errors

Use consistent responses for:

- Missing token
- Invalid token
- Expired token
- Missing membership
- Forbidden role

Do not expose internal JWT verification details.

---

# Tests

## 25. Backend Authentication Tests

Minimum coverage:

- Missing bearer token → 401
- Invalid token → 401
- Expired token → 401
- Valid Owner token + membership → authenticated
- Valid Staff token + membership → authenticated
- Valid Supabase user without membership → rejected

Mock external auth/JWT dependencies where appropriate.

Also keep at least one integration-style path that verifies the real validation wiring if practical.

---

## 26. Backend Authorization Tests

Verify:

- Owner-only endpoint allows Owner.
- Owner-only endpoint rejects Staff with 403.
- Protected read endpoint allows Owner.
- Protected read endpoint allows Staff.
- Unauthenticated requests are rejected.

---

## 27. Field Visibility Tests

Verify Owner receives:

- email
- phone
- private notes
- visit notes

Verify Staff does not receive those fields.

Verify Staff can receive:

- name
- appointment history
- services
- products used
- appointment notes

The test should assert restricted fields are absent, not merely null, if that matches the chosen response-shaping approach.

---

## 28. Business Membership Tests

Verify:

- Actor business ID comes from the membership.
- Role comes from the membership.
- Frontend-provided business ID is not trusted.
- Frontend-provided role is not trusted.

---

## 29. Frontend Tests

Minimum coverage:

- Login page renders.
- Auth initialization loading state renders.
- Unauthenticated user is redirected away from `/admin`.
- Authenticated valid member can access `/admin`.
- User without valid membership sees access denied.
- Owner-only UI appears for Owner.
- Owner-only UI does not appear for Staff.
- Logout clears auth state.

---

## 30. Frontend API Client Tests

Verify:

- Protected requests include bearer token.
- 401 is handled correctly.
- 403 is handled as forbidden without logging the user out.

---

# Manual Validation

## 31. Supabase Auth Users

For development, create or identify test users corresponding to seeded memberships:

- Owner 1
- Owner 2
- Staff 1

Update membership auth-user IDs as needed to match real Supabase Auth users.

Keep this process documented.

Do not automate production user provisioning in Phase 2.

---

## 32. Manual Owner Flow

Verify:

```text
Login as Owner
    ↓
Supabase session created
    ↓
/auth/me succeeds
    ↓
Admin route opens
    ↓
Owner-only endpoint succeeds
```

---

## 33. Manual Staff Flow

Verify:

```text
Login as Staff
    ↓
Supabase session created
    ↓
/auth/me succeeds
    ↓
Admin route opens
    ↓
Read endpoint succeeds
    ↓
Owner-only endpoint returns 403
```

Verify Staff client visibility excludes restricted fields.

---

# Phase 2 Validation Checklist

## Supabase Auth

- [ ] Login works
- [ ] Logout works
- [ ] Session restoration works
- [ ] Frontend Supabase session is available

## FastAPI Authentication

- [ ] Bearer token is validated
- [ ] Auth user ID is extracted
- [ ] Admin Membership is resolved
- [ ] Missing membership is rejected
- [ ] Authenticated Actor is available to protected routes

## Authorization

- [ ] OWNER supported
- [ ] STAFF supported
- [ ] Owner-only helper exists
- [ ] Staff cannot execute Owner-only mutation test endpoint
- [ ] Protected read endpoint works for both roles

## Client Visibility

- [ ] Owner can see full client test data
- [ ] Staff receives allowed client fields
- [ ] Staff does not receive restricted fields

## Frontend

- [ ] Login screen works
- [ ] `/admin` is protected
- [ ] Backend actor is loaded after login/session restore
- [ ] Owner role UI works
- [ ] Staff role UI works
- [ ] Logout works

## Tests

- [ ] Backend auth tests pass
- [ ] Backend authorization tests pass
- [ ] Client visibility tests pass
- [ ] Frontend auth tests pass
- [ ] API client auth tests pass
- [ ] Existing Phase 0 and Phase 1 tests remain green

---

# Completion Criteria

Phase 2 is complete when:

1. Supabase Auth can authenticate a real development Owner and Staff user.
2. React restores authentication state correctly.
3. FastAPI independently validates access tokens.
4. FastAPI resolves the authenticated user's Business Membership.
5. Owner and Staff roles are enforced by backend authorization.
6. Staff is read-only.
7. Staff client-field restrictions are enforced by the backend.
8. Protected frontend routes work.
9. All Phase 0, Phase 1, and Phase 2 tests pass.

---

# Explicitly Out of Scope

Do not implement in Phase 2:

- Client CRUD
- Service CRUD
- Hairdresser CRUD
- Business Hours CRUD
- Appointment CRUD
- Appointment overlap logic
- Appointment calculations
- Inventory workflows
- Feedback moderation
- Public availability
- Public website business sections
- Password-reset product flow
- OAuth providers
- User invitation workflows
- Complex permission editor
- Additional roles
- Render deployment changes
- AWS Lambda work

The purpose of Phase 2 is identity and authorization only.
