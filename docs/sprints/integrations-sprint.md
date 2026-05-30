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
- Source (non-test) errors: **2102** → currently **2048**
- Test-file errors: ~1659 (mostly vitest-globals config noise — TS2582)

> ⚠️ The "Not implemented" throws in base *adapter* classes
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

| # | Scope | Status |
|---|-------|--------|
| 0 | **Foundation**: fix broken relative imports; declare used deps (express/pino/bullmq) | 🟡 in progress (PR sprint/WIT-450) |
| 1 | Native/missing deps decision: sharp, bcrypt, argon2, qrcode, mongodb (POD photo/QR, password hashing, mongo migration) | ⬜ |
| 2 | Barrel dedup: `src/index.ts` ambiguous re-exports (150× TS2308) | ⬜ |
| 3 | Test config: vitest globals so `tsc` recognises describe/it (≈339× TS2582) | ⬜ |
| 4 | **ecommerce** providers (shopify / woocommerce / magento / bigcommerce) | ⬜ |
| 5 | payments providers | ⬜ |
| 6 | couriers + shipping providers | ⬜ |
| 7 | messaging / email / chat / collaboration | ⬜ |
| 8 | maps / traffic / routing | ⬜ |
| 9 | crm / erp / accounting / pos | ⬜ |
| 10 | telematics / eld / fuel-fleet / freight / supply-chain | ⬜ |
| 11 | healthcare / field-service / esignatures / analytics | ⬜ |
| 12 | gateway / registry / resolver / metering / oauth / webhooks wiring | ⬜ |
| 13 | **Final**: add `typecheck` script to core + wire into CI (lock the gain) | ⬜ |

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
