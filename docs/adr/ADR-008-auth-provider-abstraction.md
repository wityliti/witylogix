# ADR-008: Multi-Provider Authentication Abstraction

**Status:** Accepted
**Date:** 2026-03-07
**Deciders:** Witylogix Engineering Team (Arjun — CTO)

## Context

Witylogix is a multi-tenant last-mile delivery SaaS platform currently supporting only local email+password authentication and Shopify session tokens. As enterprise customers join the platform, they increasingly request Single Sign-On (SSO) support via their own Identity Providers (IdPs):

- Large logistics companies want to use Auth0 or Okta
- Mid-market merchants request Cognito for AWS-native deployments
- International teams need SAML 2.0 support for compliance (HIPAA, ISO 27001)
- Smaller customers ask for Firebase Auth integration
- Some organizations require generic OpenID Connect (OIDC) compatibility

Currently, adding a new auth provider requires:

1. Hardcoding logic in `/apps/api/src/routes/auth.ts`
2. Adding provider-specific token storage to the User model
3. Writing custom middleware for token validation
4. Duplicating JIT user provisioning logic

This creates:

- **Scaling friction** — every new provider doubles auth complexity
- **Security debt** — mixed token storage patterns, inconsistent refresh handling
- **Testing burden** — no unified interface to mock providers
- **Operator burden** — deployers cannot test multiple providers without code changes

## Decision

Implement a **multi-provider authentication registry** following the **BYOK (Bring Your Own Key)** pattern already proven in the platform's routing and notification providers:

1. **Provider abstraction layer** (`packages/core/src/auth/`) defines a unified `BaseAuthProvider` interface
2. **AuthProviderRegistry** discovers and instantiates providers at runtime, with fallback from tenant → deployer credentials
3. **Prisma models** (`AuthProvider`, `ExternalAuthSession`) store provider configs (encrypted) and user sessions
4. **Built-in local provider** (email+password) is always available as a fallback
5. **Metering events** (`AuthMeterEvent`) track tenant fallback usage for billing
6. **JIT provisioning** auto-creates users on first external auth login with role mapping

### Design Principles

- **Tenant autonomy** — Each shop can select and configure its own auth provider(s), or fall back to deployer defaults
- **Operator simplicity** — Deployers set `AUTH_BYOK=true` and `AUTH_PROVIDER=auth0` as the default; tenants customize via Settings UI
- **Security first** — Provider configs encrypted with `@witylogix/encryption`, refresh tokens stored encrypted in database, JIT role mapping prevents privilege escalation
- **Minimal breaking change** — Local auth endpoint stays identical; external auth adds parallel `/auth/provider/{providerId}` routes
- **Role standardization** — All providers map to Witylogix roles: `SUPER_ADMIN`, `ADMIN`, `DISPATCHER`, `VIEWER`, `DRIVER`

## Options Considered

### Option A: Hardcoded Provider Support (Status Quo)

**Approach:** Add each new provider inline to `routes/auth.ts` with provider-specific logic.

| Dimension        | Assessment                                                  |
| ---------------- | ----------------------------------------------------------- |
| Development time | Quick for 1st provider, exponential slowdown after 5+       |
| Testing          | No unified test suite; each provider needs end-to-end tests |
| Operator control | Zero — must edit code and redeploy for new providers        |
| Security         | Inconsistent token storage, refresh logic; risk of leaks    |
| Scaling          | Fails at enterprise adoption — too much custom code         |

**Pros:**

- Fastest initial implementation
- No abstraction overhead

**Cons:**

- Code duplication (token exchange, JIT, role mapping, refresh logic)
- Provider-specific bugs scattered across codebase
- Impossible for operators (deployers) to test without code changes
- Violates DRY; every provider adds 200+ lines of boilerplate
- No single source of truth for "which providers are available"

**Why rejected:** Platform already uses registry pattern for routing and notifications — this would be inconsistent and harder to maintain.

### Option B: Full OAuth 2.0 Proxy (Over-engineered)

**Approach:** Build an internal OAuth 2.0 server that all providers feed into, like a full IdP proxy.

| Dimension        | Assessment                                                      |
| ---------------- | --------------------------------------------------------------- |
| Development time | 6-8 weeks (build proxy + integrate all providers)               |
| Testing          | Excellent — proxy is fully tested, providers are mocked         |
| Operator control | Maximum — proxy handles discovery, provisioning, token exchange |
| Security         | Excellent — centralized token management, single refresh flow   |
| Complexity       | High — requires understanding OAuth 2.0 spec intimately         |

**Pros:**

- Single token validation endpoint for all downstream services
- Could be productized for other SaaS platforms
- Unified audit trail for all auth events

**Cons:**

- Massive over-engineering for MVP requirements
- Adds latency (internal auth hop) and operational overhead
- Makes deployment more complex (requires separate proxy service)
- Requires deep OAuth 2.0 expertise to maintain
- Harder to debug (three hops: client → proxy → provider → app)

**Why rejected:** Platform is moving toward simplicity (self-hosted OSRM instead of managed routing). A proxy adds infrastructure burden operators don't need.

### Option C: Provider Registry with BYOK Pattern (Selected)

**Approach:** Implement a registry of providers (like routing/notifications) where each provider handles its own token exchange and validation. Tenants can bring their own IdP credentials.

| Dimension        | Assessment                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Development time | 3-4 weeks (build registry + 2-3 concrete providers)                  |
| Testing          | Good — each provider is a testable unit, registry is testable        |
| Operator control | High — operators configure default, tenants override via Settings UI |
| Security         | Good — encrypted storage, isolated token handling per provider       |
| Complexity       | Medium — familiar pattern from routing/notifications                 |

**Pros:**

- Consistent with existing platform architecture (routing, notifications)
- Each provider is a small, focused unit (250-300 lines)
- Operators gain autonomy — can test providers without code changes
- Tenants get choice — enterprise customers select their IdP, SMBs use defaults
- Metering support — tracks fallback usage for billing
- Minimal changes to existing auth routes

**Cons:**

- Each provider must handle its own token refresh/revocation
- No central OAuth proxy — apps must know about multiple token formats
- Requires each provider to document its capabilities (SAML vs OIDC, MFA support)

**Why selected:** Proven pattern in the codebase, balances operator autonomy with implementation simplicity, maintains consistency with routing/notification philosophy.

## Consequences

### Positive

1. **Tenant autonomy** — Enterprise customers choose Auth0, Okta, Cognito, or Firebase without code changes
2. **Deployer flexibility** — Open-source adopters test multiple IdPs by changing `.env`; no code edits needed
3. **Consistent architecture** — Uses same BYOK pattern as routing/notifications; operators understand the model
4. **Security improvements** — Centralized encryption, isolated token storage, standardized JIT provisioning
5. **Metering support** — Tracks fallback usage for billing when `AUTH_BYOK=true`
6. **Easy to extend** — Adding Supabase Auth, Keycloak, or custom OIDC takes 2-3 hours
7. **Local auth fallback** — Email+password always works; external providers are optional

### Negative

1. **More code paths** — Apps must handle multiple JWT formats (Auth0 vs Firebase vs Cognito) until standardization
   - **Mitigation:** Normalize tokens to Witylogix schema in middleware
2. **Token refresh complexity** — Each provider has different refresh semantics (rotating refresh tokens vs issuer-signed expires_at)
   - **Mitigation:** Wrapper interface hides provider differences
3. **Operator burden grows** — Deployers must understand each provider's credential model to configure tenants
   - **Mitigation:** Settings UI provides guided credential forms + validation
4. **Testing multiply** — 7 providers × 5 scenarios (login, refresh, revoke, profile update, MFA) = 35 test cases
   - **Mitigation:** Use provider test harnesses (Auth0 sandbox, Firebase emulator)

## Implementation Roadmap

### Phase 1 (MVP — now)

- Build provider registry + abstraction layer
- Implement Auth0 (most requested by enterprise)
- Implement local provider (fallback)
- Implement Clerk (popular for startups)
- Metering: `AuthMeterEvent` table for billing
- Prisma: `AuthProvider`, `ExternalAuthSession` models

### Phase 2 (Q2 2026)

- Implement Cognito (AWS-native enterprises)
- Implement generic OIDC (works with Keycloak, Okta, custom IdPs)
- Settings UI: provider configuration forms + credential management

### Phase 3 (Q3 2026)

- Implement SAML 2.0 support
- Implement Firebase Auth
- Multi-provider login page (user picks "Sign in with Auth0" or "Email")

### Phase 4 (Q4 2026+)

- MFA enforcement per provider
- Session management dashboard
- Provider health monitoring + fallback logic
- OAuth proxy (if needed for complex deployments)

## Monitoring & Metrics

Track these metrics to validate the decision:

| Metric                             | Target                             | Rationale                                 |
| ---------------------------------- | ---------------------------------- | ----------------------------------------- |
| Providers in registry              | 7+ by Q4 2026                      | Validates extensibility                   |
| Tenant provider adoption           | > 15% of tenants use external auth | Validates tenant demand                   |
| Fallback usage                     | < 5% of login events (per shop)    | External auth is preferred, fallback rare |
| Auth provider latency              | < 500ms p99                        | User experience                           |
| JIT provisioning errors            | < 0.1%                             | Role mapping accuracy                     |
| Provider config validation success | > 95%                              | Good UX for setup                         |

## Related Decisions

- **ADR-001:** Platform rewrite with Turborepo, Fastify, PostgreSQL — this auth registry fits the architectural model
- **Notification Provider Registry:** Established BYOK pattern for multi-channel notifications (email, SMS, WhatsApp, push)
- **Routing Provider Registry:** Established BYOK pattern for multi-provider route optimization (Mapbox, OSRM, Google Maps)

## Questions & Answers

### Q: Why not use a third-party auth service like Supabase or Firebase Auth directly?

**A:** Supabase/Firebase Auth are hard to embed in a self-hosted deployment. Witylogix is AGPL-3.0 open-source and must support self-hosted deployments where cloud services aren't available. The registry pattern allows tenants to use cloud Auth0/Firebase _or_ self-hosted Keycloak/custom OIDC.

### Q: What happens if a tenant configures Auth0 but then the Auth0 integration breaks?

**A:** Fallback to local auth (email+password) on that shop. Each `User` maintains a password hash; if external auth fails, login routes check local auth as backup. This ensures 100% availability even if a provider goes down.

### Q: Can a user belong to multiple providers?

**A:** Yes. A user can have multiple `ExternalAuthSession` records, one per provider. On login, they pick which provider to use. This supports companies migrating from one IdP to another.

### Q: How do roles map from external providers to Witylogix roles?

**A:** Each provider implements `getRoleMapping()` which converts provider-specific roles (e.g., Auth0's `roles[]` claim) to Witylogix roles (SUPER_ADMIN, ADMIN, DISPATCHER, VIEWER, DRIVER). Mapping is configurable in `AuthProvider.config.roleMapping` as a JSON object: `{ "external_role": "WITYLOGIX_ROLE" }`.

### Q: What about MFA? Do all providers support it?

**A:** MFA support varies. Auth0 ✅, Cognito ✅, Firebase ❌, generic OIDC ? (depends on provider). The `AuthProviderCapabilities` interface declares `supportsMFA: boolean`. The Settings UI will warn users if their selected provider doesn't support MFA but they have MFA policies.
