# Sprint 2.2 Test Files Quick Reference

## File Structure

```
witylogix-platform/
├── packages/core/src/
│   ├── compliance/
│   │   └── __tests__/
│   │       ├── anonymizer.test.ts (669 lines, 60+ tests)
│   │       ├── consent-manager.test.ts (467 lines, 55+ tests)
│   │       └── retention.test.ts (477 lines, 50+ tests)
│   └── cache/
│       └── __tests__/
│           ├── client.test.ts (674 lines, 50+ tests)
│           └── strategies.test.ts (678 lines, 40+ tests)
└── apps/api/src/routes/
    └── __tests__/
        ├── settings.test.ts (749 lines, 55+ tests)
        └── shopify-webhooks.test.ts (725 lines, 60+ tests)
```

---

## Compliance Tests

### anonymizer.test.ts - Data Anonymization Test Suite

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/packages/core/src/compliance/__tests__/anonymizer.test.ts`

**Test Suites (11 total):**

1. `hashPII` - SHA-256 hashing operations
2. `redactField` - Field redaction with visible chars
3. `generalizeLocation` - Location generalization
4. `anonymizeRecord` - Per-field masking strategies
5. `anonymizeInBatch` - Batch record processing
6. `Edge Cases` - Unicode, empty strings, long strings
7. `Report Generation` - Statistics and reporting
8. `Configuration Validation` - Config validation
9. `Statistics Management` - Stat reset and tracking

**Key Test Cases:**

- `hashPII with known inputs/outputs consistency`
- `redactField with various visible char counts (0-N)`
- `generalizeLocation reduces precision to city/region/country`
- `anonymizeRecord applies correct strategy per field`
- `anonymizeInBatch processes multiple records`
- `Handle unicode characters and special chars`
- `generateAnonymizationReport accuracy`
- `validateConfig rejects invalid strategies`

---

### consent-manager.test.ts - GDPR Consent Management

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/packages/core/src/compliance/__tests__/consent-manager.test.ts`

**Test Suites (11 total):**

1. `recordConsent` - Create consent records
2. `revokeConsent` - Revoke active consent
3. `getConsentStatus` - Get active/revoked consents
4. `validateConsent` - Validate consent exists
5. `Consent Versioning` - Multiple grants/revokes
6. `exportConsentRecords` - GDPR export format
7. `getConsentSummary` - Consent aggregation
8. `Concurrent Modifications` - Race conditions
9. `validateMultipleConsents` - Bulk checking
10. `getUsersWithConsent` - Find consented users
11. `Cleanup` - Clear consents for testing

**Key Test Cases:**

- `recordConsent creates new record with version`
- `revokeConsent updates timestamp`
- `getConsentStatus returns all consents`
- `validateConsent checks active consent`
- `Consent versioning tracks multiple changes`
- `exportConsentRecords for GDPR Article 20`
- `Concurrent grant/revoke cycles`
- `getUsersWithConsent for targeted comms`

---

### retention.test.ts - Data Retention Policies

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/packages/core/src/compliance/__tests__/retention.test.ts`

**Test Suites (12 total):**

1. `setRetentionPolicy` - Policy creation
2. `applyRetentionPolicy` - Flag expired records
3. `exemptFromRetention` - Legal holds
4. `scheduleAnonymization` - Queue anonymization
5. `getRecordsDueForAnonymization` - Find overdue
6. `getRecordsDueForDeletion` - Find deletions
7. `getRetentionReport` - Report generation
8. `Boundary Cases` - Edge case handling
9. `Status Tracking` - Status transitions
10. `scheduleForDeletion` - Queue deletion
11. `markAsDeleted` - Mark as deleted
12. `Multi-Entity Tests` - Multiple entity types

**Key Test Cases:**

- `applyRetentionPolicy flags expired records`
- `exemptFromRetention creates legal hold`
- `scheduleAnonymization queues correctly`
- `scheduleForDeletion sets correct date`
- `Retention report accuracy`
- `Boundary cases at retention period`
- `Multi-entity policies with different periods`
- `Status tracking (active → anonymize → delete → deleted)`

---

## Cache Tests

### client.test.ts - Redis Cache Client

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/packages/core/src/cache/__tests__/client.test.ts`

**Test Suites (12 total):**

1. `get/set` - Serialization and retrieval
2. `TTL expiration` - Expiry handling
3. `deleteByPattern` - Glob pattern matching
4. `deleteByTag` - Tag-based invalidation
5. `getOrSet` - Cache-aside pattern
6. `getMulti` - Batch retrieval
7. `increment` - Atomic counters
8. `key prefixing` - Multi-app isolation
9. `stats tracking` - Hit/miss metrics
10. `exists and ttl` - Key checking
11. `delete` - Single key deletion
12. `flush and invalidation events`

**Key Test Cases:**

- `get/set with serialization`
- `TTL expiration after timeout`
- `deleteByPattern matches glob patterns`
- `deleteByTag invalidates correct entries`
- `getOrSet implements cache-aside`
- `getMulti retrieves multiple keys`
- `increment atomicity`
- `Key prefixing isolates apps`
- `Stats tracking hits/misses`

**Mock Implementation:**

- Full `MockRedis` class implementing RedisLike interface
- Supports all cache operations for testing
- TTL and expiration simulation

---

### strategies.test.ts - Cache Strategies

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/packages/core/src/cache/__tests__/strategies.test.ts`

**Test Suites (6 total + 1 cross-strategy):**

1. `TenantCacheStrategy` - Tenant namespacing
2. `EntityCacheStrategy` - Entity relationships
3. `QueryCacheStrategy` - Query parameter keys
4. `RateLimitStrategy` - Token bucket limiting
5. `SessionCacheStrategy` - Session management
6. `Cross-Strategy Combinations` - Combined patterns

**Key Test Cases:**

- `TenantCacheStrategy namespaces by shopId`
- `EntityCacheStrategy relationship invalidation`
- `QueryCacheStrategy parameter-based keys`
- `RateLimitStrategy token bucket behavior`
- `SessionCacheStrategy sliding expiration`
- `Tenant/Entity/Query combined patterns`

**Strategy Implementations:**

- Key generation per strategy
- Pattern-based invalidation
- Tag creation for bulk operations
- Deterministic hashing for parameters

---

## API Routes Tests

### settings.test.ts - Settings and Configuration API

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/apps/api/src/routes/__tests__/settings.test.ts`

**Test Suites (12 total):**

1. `GET /` - Return all settings
2. `PUT /general` - Update general settings
3. `PUT /branding` - Update branding
4. `POST /api-keys` - Create API key
5. `GET /api-keys` - List keys (masked)
6. `DELETE /api-keys/:id` - Revoke key
7. `GET /team` - List team members
8. `POST /team/invite` - Invite team member
9. `Tenant Isolation` - Multi-tenant security
10. `Authentication` - Auth enforcement
11. `Input Validation` - Field validation
12. `API Key Security` - Key management

**Key Test Cases:**

- `GET / returns all settings for tenant`
- `PUT /general updates timezone, currency`
- `PUT /branding validates colors and URLs`
- `POST /api-keys creates key, returns plaintext once`
- `GET /api-keys masks key values`
- `DELETE /api-keys/:id revokes key with soft delete`
- `GET /team lists members with roles`
- `POST /team/invite sends 7-day expiry invitations`
- `Authentication required on all routes`
- `Tenant isolation enforced`

**Validation Coverage:**

- Email format validation
- Hex color validation (`#RRGGBB`)
- URL format validation
- Timezone and currency validation
- Role enum validation (admin/manager/viewer)
- Business hours format validation

---

### shopify-webhooks.test.ts - Shopify Webhook Handlers

**Location:** `/sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/apps/api/src/routes/__tests__/shopify-webhooks.test.ts`

**Test Suites (12 total):**

1. `HMAC Verification` - Signature validation
2. `POST /app/installed` - Shop installation
3. `POST /app/uninstalled` - Shop uninstall
4. `POST /gdpr/data-request` - GDPR data access
5. `POST /gdpr/redact` - GDPR redaction
6. `POST /gdpr/shop-redact` - Shop redaction
7. `POST /order/create` - Order sync
8. `POST /order/updated` - Order updates
9. `POST /product/update` - Product sync
10. `Webhook Idempotency` - Duplicate handling
11. `Error Handling` - Error scenarios
12. `Webhook Format Validation` - Schema validation

**Key Test Cases:**

- `HMAC verification accepts valid signature`
- `HMAC verification rejects invalid signature`
- `POST /app/installed creates shop record`
- `POST /app/uninstalled deactivates shop`
- `POST /gdpr/data-request queues export`
- `POST /gdpr/redact anonymizes data`
- `POST /order/create syncs new order`
- `POST /order/updated syncs status changes`
- `POST /product/update syncs products`
- `Webhook idempotency via duplicate detection`

**HMAC Testing:**

- Valid signature acceptance
- Invalid signature rejection
- Modified payload detection
- Case-sensitivity validation

**GDPR Compliance:**

- Data subject access requests (DSAR)
- Right to be forgotten (redaction)
- Order-level redaction
- Shop-level data cleanup

---

## Test Execution

### Run all tests:

```bash
cd /sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform
npm test
# or
vitest
```

### Run specific test file:

```bash
vitest packages/core/src/compliance/__tests__/anonymizer.test.ts
vitest apps/api/src/routes/__tests__/settings.test.ts
```

### Run tests with coverage:

```bash
vitest --coverage
```

### Watch mode:

```bash
vitest --watch
```

### Specific test suite:

```bash
vitest -t "hashPII"
vitest -t "HMAC Verification"
```

---

## Summary Statistics

| Category            | Count                |
| ------------------- | -------------------- |
| Total Test Files    | 7                    |
| Total Lines of Code | 4,439                |
| Total Test Suites   | 76                   |
| Total Test Cases    | 370+                 |
| Compliance Tests    | 3 files, 1,613 lines |
| Cache Tests         | 2 files, 1,352 lines |
| API Tests           | 2 files, 1,474 lines |

---

## Coverage Goals

- **Compliance:** 95%+ coverage (PII, consent, retention)
- **Cache:** 90%+ coverage (all strategies, edge cases)
- **API Routes:** 85%+ coverage (endpoints, validation)
- **Security:** 100% coverage (HMAC, PII, tenant isolation)

---

## Notes for QA Team

1. All tests use industry-standard vitest patterns
2. Mock implementations allow offline testing
3. No external dependencies required (self-contained tests)
4. Each test is independent and can run in any order
5. Security-critical operations (HMAC, PII) have comprehensive coverage
6. Edge cases and boundary conditions are explicitly tested
7. Tests can be run in CI/CD pipeline
8. Clear error messages for debugging test failures

---

Document created: 2026-03-06
Last updated: 2026-03-06
Status: Complete and ready for review
