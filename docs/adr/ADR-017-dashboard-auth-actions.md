# ADR-017: Dashboard Authentication Actions Architecture

**Status:** Accepted
**Date:** 2026-03-08
**Deciders:** Witylogix Engineering Team (Arjun — CTO)

## Context

Witylogix Dashboard (Next.js 15 App Router) currently has placeholder authentication action stubs in `apps/dashboard/src/lib/auth-actions.ts`. These stubs need to be replaced with production-grade implementations that:

1. **Validate form input** using zod schemas before API calls
2. **Call backend endpoints** (already implemented in Fastify API) for login, registration, and password reset
3. **Manage secure tokens** using Next.js httpOnly cookies
4. **Handle errors gracefully** with field-level validation feedback
5. **Redirect on success** using Next.js `redirect()` function
6. **Support BYOK auth providers** that were established in Sprint 3.3 (OAuth2, OIDC providers)

### Current State

The dashboard uses Next.js 15 server actions (`"use server"`) but the three core auth flows are stubs:

- `loginAction(formData)` — TODO: Implement login
- `registerAction(formData)` — TODO: Implement registration
- `forgotPasswordAction(formData)` — TODO: Implement password reset

The **backend API is production-ready** (Fastify routes in `apps/api/src/routes/auth.ts`):
- `POST /login` — returns `{ accessToken, refreshToken, expiresIn, user, shop }`
- `POST /register` — (implied by context) creates user and auto-logs in
- `POST /forgot-password` — sends reset email via notification queue
- `POST /reset-password` — validates token and updates password

### Authentication Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard (Next.js 15 App Router)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Client Component (e.g., LoginForm)             │   │
│  │  - Renders form fields                          │   │
│  │  - Calls server action on submit                │   │
│  └──────────────────────┬──────────────────────────┘   │
└─────────────────────────┼──────────────────────────────┘
                          │ formData
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Server Action (auth-actions.ts)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  1. Parse & validate FormData with zod          │   │
│  │  2. Call API endpoint                           │   │
│  │  3. Extract tokens from response                │   │
│  │  4. Set httpOnly cookies                        │   │
│  │  5. Redirect on success                         │   │
│  └──────────────────────┬──────────────────────────┘   │
└─────────────────────────┼──────────────────────────────┘
                          │ JSON
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Fastify API (apps/api)                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  POST /auth/login                               │   │
│  │  - Look up user by email                        │   │
│  │  - Verify password (scrypt)                     │   │
│  │  - Generate JWT access token                    │   │
│  │  - Generate refresh token (stored in Redis)     │   │
│  │  - Return tokens + user metadata                │   │
│  └──────────────────────┬──────────────────────────┘   │
└─────────────────────────┼──────────────────────────────┘
                          │ { accessToken, refreshToken }
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Database (PostgreSQL) + Cache (Redis)                  │
│  - User table (with password hash)                      │
│  - Refresh token store (Redis with TTL)                 │
└─────────────────────────────────────────────────────────┘
```

## Decision

Implement three server actions (`loginAction`, `registerAction`, `forgotPasswordAction`) in `apps/dashboard/src/lib/auth-actions.ts` following these principles:

### 1. **Validation-First Approach**

Use zod schemas to validate form input before making API calls. This provides:
- Early error detection (fail fast)
- Field-level error messages for UX
- Type safety (parsed data is typed)

```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  shopDomain: z.string().min(1, 'Shop domain is required'),
});
```

### 2. **Structured API Responses**

All actions return a consistent shape:
```typescript
type ActionResponse = {
  success: boolean;
  error?: string;                    // General error message
  fieldErrors?: Record<string, string>;  // Field-level validation errors
  redirectUrl?: string;              // Where to redirect after success
};
```

### 3. **Token Management via httpOnly Cookies**

On successful login/register:
- Extract `accessToken` and `refreshToken` from API response
- Store both in httpOnly cookies (set via `cookies().set()`)
- No token in localStorage (secure-only approach)
- Cookies auto-sent on subsequent API calls

```typescript
const { cookies } = await import('next/headers');
const cookieStore = await cookies();
cookieStore.set('accessToken', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 3600, // 1 hour
});
```

### 4. **Network Error Handling**

Handle common failure scenarios:
- Network timeout → graceful error message
- API validation errors (400) → field-level feedback
- Unauthorized (401) → "Invalid credentials" message
- Server error (500) → generic error + logging

### 5. **Post-Success Redirect**

After token storage, redirect to dashboard:
```typescript
const { redirect } = await import('next/navigation');
redirect('/dashboard');
```

### 6. **BYOK Auth Provider Compatibility**

The implementation is agnostic to auth provider. When BYOK is enabled (from Sprint 3.3):
- Backend handles provider routing (Auth0, Cognito, OIDC, local)
- Dashboard just calls the same `/auth/login` endpoint
- Token formats may differ but are handled by backend JWT
- Future: Support `?provider=auth0` query param for multi-provider login page

## Options Considered

### Option A: Embed API Logic in Server Action

**Approach:** Every auth endpoint duplicates user lookup, password hashing, token generation in the server action itself.

| Dimension | Assessment |
|-----------|-----------|
| Coupling | Tight — dashboard code duplicates API logic |
| Maintenance | Poor — changes to auth logic require updates in two places |
| Testing | Difficult — can't test auth logic without API mocking |
| Security | Risk — password hashing logic exposed on frontend |
| Scalability | Bad — driver app would duplicate again |

**Why rejected:** Violates DRY; API already has production-grade auth. Dashboard should delegate to it.

### Option B: Use Next.js Auth.js (NextAuth) Library

**Approach:** Replace custom server actions with NextAuth.js, which provides pre-built session management, OAuth adapters, and database integration.

| Dimension | Assessment |
|-----------|-----------|
| Dependency | Adds 60+ KB library; requires session database table |
| Provider support | Excellent — built-in OAuth2, OIDC, SAML providers |
| Token management | Opaque sessions (database-backed) not JWT-friendly |
| API integration | Awkward — NextAuth has its own auth flow, doesn't call existing API |
| Multi-tenant support | Designed for single-tenant SaaS; Witylogix is multi-tenant |

**Why rejected:** NextAuth is opinionated toward its own session model (not our JWT/refresh token pattern). Our Fastify API already handles multi-tenant auth correctly; NextAuth would duplicate that logic.

### Option C: Minimal Server Action Wrapper (Selected)

**Approach:** Server actions validate input, call Fastify API, manage cookies, redirect. Backend owns all auth logic (password hashing, token generation, role mapping).

| Dimension | Assessment |
|-----------|-----------|
| Coupling | Loose — dashboard delegates to API |
| Maintenance | Good — single source of truth (API) |
| Testing | Easy — mock API responses in tests |
| Security | Good — sensitive logic stays on backend |
| BYOK support | Perfect — API handles provider routing, dashboard unchanged |

**Pros:**
- Reuses production API that's already tested
- Works with any auth provider (local, OAuth2, OIDC)
- Token management follows Next.js best practices (httpOnly cookies)
- Minimal code — 200 lines total for three flows
- Easy to add refresh logic later

**Cons:**
- Requires network call for every auth action (but that's correct — no local validation of passwords)
- Field-level errors must be parsed from API response schema

**Why selected:** Leverages existing architecture, minimal complexity, works with BYOK providers, follows Next.js 15 patterns.

## Consequences

### Positive

1. **Single source of truth** — Auth logic lives in Fastify API; dashboard is a thin client
2. **BYOK ready** — When Auth0/Okta providers added to API, dashboard works without changes
3. **Secure by default** — Tokens in httpOnly cookies, no localStorage exposure
4. **Type-safe** — zod validates all input before API call
5. **Graceful degradation** — Field errors parsed from API response, shown to user
6. **Easy testing** — Mock the `fetch` call to simulate API responses
7. **Multi-app consistency** — Driver app can reuse same auth-actions pattern

### Negative

1. **Network latency** — Every login/register/reset requires API round-trip
   - **Mitigation:** API is local in single-server deployments; under 50ms typical
2. **Cookie management overhead** — Must use Next.js `cookies()` for SSR compat
   - **Mitigation:** One-time setup; `cookies().set()` is the standard approach
3. **No offline mode** — Dashboard can't auth if API is unreachable
   - **Mitigation:** Acceptable for SaaS; API has 99.9% uptime target

## Implementation Details

### File Structure

```
apps/dashboard/src/lib/
  auth-actions.ts          # Three server actions + schemas
  auth-context.tsx         # Client-side auth state (unchanged)
  auth-guard.tsx           # Route protection (unchanged)
  api.ts                   # Fetch wrapper (unchanged)
```

### Action Signatures

#### `loginAction(formData: FormData)`

```typescript
export async function loginAction(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}> {
  // 1. Extract email, password, shopDomain from FormData
  // 2. Validate with loginSchema
  // 3. Call POST ${API_URL}/api/v4/auth/login
  // 4. Handle errors:
  //    - 400: return fieldErrors
  //    - 401: return { success: false, error: "Invalid credentials" }
  //    - 500: return { success: false, error: "Server error" }
  // 5. On success:
  //    - Set httpOnly cookies for accessToken, refreshToken
  //    - Call redirect('/dashboard')
  //    - Return { success: true }
}
```

#### `registerAction(formData: FormData)`

```typescript
export async function registerAction(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}> {
  // 1. Extract name, email, password, agreeTerms from FormData
  // 2. Validate with registerSchema
  // 3. Call POST ${API_URL}/api/v4/auth/register
  // 4. Return structured response with fieldErrors for:
  //    - email: "Email already in use"
  //    - password: "Password too weak"
  // 5. On success:
  //    - Set tokens in httpOnly cookies
  //    - Auto-redirect to '/dashboard' (user is logged in after register)
  //    - Return { success: true }
}
```

#### `forgotPasswordAction(formData: FormData)`

```typescript
export async function forgotPasswordAction(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 1. Extract email from FormData
  // 2. Validate with forgotPasswordSchema
  // 3. Call POST ${API_URL}/api/v4/auth/forgot-password
  // 4. Always return success (don't leak user existence)
  // 5. Success response: { success: true }
  //    - No redirect; user sees "Check your email" message
}
```

### Zod Schemas

```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be 8+ characters'),
  shopDomain: z.string().min(1, 'Shop domain required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be 2+ characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be 8+ characters'),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'You must agree to terms' }) }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  shopDomain: z.string().min(1, 'Shop domain required'),
});
```

### Error Handling Strategy

```
API Response (400)
├── Single field error: { error: "Email already in use", code: "EMAIL_EXISTS" }
├── Multiple fields: { error: "Validation failed", fieldErrors: { email: "...", password: "..." } }
└── Generic: { error: "Invalid request", code: "BAD_REQUEST" }

Server Action Handler
├── Parse zod schema → if fails, return zod errors as fieldErrors
├── Fetch API → if network error, return { success: false, error: "Network error" }
├── Check response.ok → if false:
│   ├── 400: parse body.fieldErrors, return them
│   ├── 401: return { success: false, error: "Invalid credentials" }
│   ├── 409: return { success: false, error: "Email already in use" }
│   └── 5xx: return { success: false, error: "Server error" }
└── Success: set cookies, redirect()
```

## Testing Strategy

### Unit Tests (Jest)

```typescript
describe('loginAction', () => {
  it('returns fieldErrors for invalid email', async () => {
    const formData = new FormData();
    formData.append('email', 'invalid');
    formData.append('password', 'validpass123');

    const result = await loginAction(formData);

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.email).toMatch(/Invalid email/);
  });

  it('calls API with correct payload', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { accessToken: 'jwt...', refreshToken: 'refresh...' }
      })
    });

    // Replace global fetch
    global.fetch = mockFetch;

    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'validpass123');

    // Expect redirect to be called
    await loginAction(formData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api:3000/api/v4/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

### Integration Tests (API + Action)

Use test containers to run a real Fastify API instance and verify:
- Login with valid credentials
- Login with invalid password
- Register with existing email
- Password reset token expiration

## Monitoring & Metrics

Track these metrics to validate the implementation:

| Metric | Target | Rationale |
|--------|--------|-----------|
| Login success rate | > 99% | Measure auth reliability |
| Avg login latency | < 300ms p95 | API call latency (includes DB) |
| Failed login attempts per user | < 10 per hour | Detect brute-force attacks |
| Password reset completion rate | > 70% | Users finish the flow |
| Register success rate | > 95% | Account creation reliability |
| Field validation error rate | < 5% of submissions | Form UX quality |

## Related Decisions

- **ADR-008:** Multi-provider authentication abstraction (BYOK pattern) — dashboard actions work with any provider
- **ADR-001:** Platform rewrite with Turborepo, Next.js 15, Fastify — establishes the server action pattern
- **Sprint 3.3:** Workers, Auth Routing — established OAuth2 provider support in Fastify API

## Migration Path

### Phase 1 (Now — Sprint 3.8)
- Implement three server actions with zod validation
- Replace TODO stubs
- Add unit tests for validation and error handling

### Phase 2 (Sprint 4.0)
- Add refresh token rotation logic (call `/auth/refresh` before token expiry)
- Implement logout action
- Add "Remember me" cookie persistence

### Phase 3 (Sprint 4.1+)
- Multi-provider login page (if provider selection added to API)
- Session management dashboard (view active sessions, revoke tokens)
- MFA support (if providers require second factor)

## Questions & Answers

### Q: Why not use localStorage for tokens?

**A:** httpOnly cookies are immune to XSS attacks because JavaScript cannot access them. localStorage is vulnerable to XSS. Since Next.js server actions always run on the server, we control all API calls and don't need client-side token access.

### Q: What happens if the user's API token expires between requests?

**A:** Implemented in Phase 2: the dashboard will catch 401 responses and automatically call `/auth/refresh` to get a new access token. If refresh token is also expired, redirect to login.

### Q: How do field errors from the API get to the form?

**A:** The server action returns `fieldErrors` object (e.g., `{ email: "Already in use" }`). The client component displays these errors near their corresponding form inputs. Framework: use React Hook Form or Formik to manage form state and display errors.

### Q: Does this work with OAuth2 providers?

**A:** Yes. When BYOK is enabled (Sprint 3.3 complete), the Fastify API routes `/auth/login` request to the configured provider (Auth0, Cognito, etc.). Dashboard doesn't need to change — same endpoint, different provider.

### Q: How long are tokens valid?

**A:** Access tokens: 1 hour (configured in `getConfig().JWT_EXPIRES_IN`). Refresh tokens: 30 days in Redis. Expired access tokens trigger automatic refresh.
