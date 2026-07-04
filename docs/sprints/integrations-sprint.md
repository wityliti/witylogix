# Integrations Sprint — making `packages/core/src/integrations/*` functional

**Started:** 2026-05-30 · **Owner:** autonomous agent sprint · **Base branch:** `staging`

## Problem

~124 integrations are registered with `status: 'production'`, but the code carries
~100 `throw "Not implemented"` and ~152 mock/stub/placeholder references. Many
provider clients don't type-check.

### Root cause

`@witylogix/core` has **no `typecheck` script** and its `build` is `echo build-ok`,
so `turbo typecheck` skips it. Core integration code has never been type-checked
in CI and has accumulated large type debt.

**Baseline (real `tsc -p packages/core/tsconfig.json`, deps built):**

- Source (non-test) errors: **2102** → **821** (as of 2026-05-30)
  - integration **category** provider files: **0** ✅ (was ~1,500)
  - `src/index.ts` top-level barrel ambiguous re-exports: **144** (TS2308 — item 2)
  - non-integration core modules (fleet/sso/returns/etc.): **676** (out of original scope — item 14)
- Test-file errors: ~1659 (mostly vitest-globals config noise — TS2582)

> ⚠️ The "Not implemented" throws in base _adapter_ classes
> (e.g. `ecommerce/ecommerce-adapter.ts`) are abstract defaults meant to be
> overridden by concrete providers — NOT bugs. Verify per concrete provider.

## How to measure

```bash
pnpm install
pnpm --filter @witylogix/db db:generate
pnpm exec tsc -p packages/core/tsconfig.json --noEmit 2>&1 \
  | grep -vE "__tests__|\.test\.ts" | grep -cE "error TS"
```

## Plan (one PR per row, base `staging`)

> **All integration provider categories are type-clean (0 errors) and merged to `staging`.**
> Remaining sprint work is non-provider: the top-level barrel, the unrelated core
> modules, and wiring CI to lock the gain. The recurring routine should now pick up
> rows 2, 14, 3, then 13 (in that order).

| #   | Scope                                                                                                                                                                                               | Status                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0   | **Foundation**: broken relative imports; declare used deps (express/pino/bullmq)                                                                                                                    | ✅ #221                                              |
| 1   | Native/missing deps decision: sharp, bcrypt, argon2, qrcode, mongodb (POD photo/QR, password hashing, mongo migration)                                                                              | ⬜ (deferred — needs native-dep + security decision) |
| 4   | **ecommerce** (shopify/woocommerce/magento/bigcommerce/etsy/ebay/amazon/square) 196→0                                                                                                               | ✅ #222                                              |
| 6   | couriers + shipping 44→0                                                                                                                                                                            | ✅ #223                                              |
| 8   | maps / traffic / routing 66→0                                                                                                                                                                       | ✅ #224                                              |
| 7   | messaging / email / chat / collaboration 180→0                                                                                                                                                      | ✅ #225                                              |
| 5   | payments 43→0                                                                                                                                                                                       | ✅ #226                                              |
| 12  | gateway / registry / oauth / webhooks / migration / credentials wiring 28→0                                                                                                                         | ✅ #227                                              |
| 10  | telematics / eld / fuel-fleet / freight / supply-chain 287→0                                                                                                                                        | ✅ #228                                              |
| 11  | healthcare / field-service / esignatures / analytics 120→0                                                                                                                                          | ✅ #229                                              |
| 9   | crm / erp / accounting / pos 197→0                                                                                                                                                                  | ✅ #230                                              |
| —   | remaining categories: platform-bridge/google/push/health/lastmile/docs/woocommerce/realtime 73→0                                                                                                    | ✅ #231                                              |
| 2   | **Barrel dedup**: `src/index.ts` ambiguous re-exports (**144× TS2308**) — explicit named re-exports for clashing types (RateLimitInfo, SyncOptions/Status/Metrics/State, ETAResult, Coordinates, …) | ⬜ NEXT                                              |
| 14  | **Non-integration core** type errors (**676**): fleet, auth/sso-providers, returns, demand-prediction, etc. — out of original scope but blocks CI wiring                                            | ⬜                                                   |
| 3   | Test config: vitest globals so `tsc` recognises describe/it (≈339× TS2582)                                                                                                                          | ⬜                                                   |
| 13  | **Final**: add `typecheck` script to core + wire into CI (lock the gain). Blocked on rows 2, 14, 3 reaching 0.                                                                                      | ⬜                                                   |

## Per-category error counts (top source-error files, 2026-05-30)

```
 52 integrations/pos/toast-pos-client.ts
 48 integrations/migration/migration-api.ts
 43 integrations/supply-chain/{manhattan,korber,blue-yonder,deposco}-client.ts
 38 integrations/collaboration/teams-sdk-client.ts
 34 integrations/collaboration/index.ts
 25 integrations/ecommerce/shopify-sdk-client.ts
 24 integrations/collaboration/slack-sdk-client.ts
 23 integrations/email/sendgrid-sdk-client.ts
 20 integrations/ecommerce/bigcommerce-client.ts
 19 integrations/ecommerce/magento-client.ts
```

## Constraints

- Branch from `staging`; PR to `staging`; never push to `staging`/`main`.
- Run `pnpm lint && pnpm typecheck && pnpm test:run` before commit.
- No Railway deploy; don't touch Docker/Paperclip/CLAUDE.md.
- `Deploy Preview` CI check fails env-only (missing artifact) — not a merge gate.
