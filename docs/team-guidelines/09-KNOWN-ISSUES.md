# 09 — Known Issues & Gotchas

These are recurring problems that have bitten us multiple times. Check this list before every sprint.

## Shell & File System

### 1. `(dashboard)` Directory and Shell Parentheses
The `(dashboard)` route group directory has parentheses that are special characters in bash. This affects `find`, `ls`, and other commands.

**Problem:**
```bash
find apps/dashboard/src/app -name "page.tsx"  # Returns only 7 results instead of 180
```

**Fix:**
```bash
# Use git ls-files (ignores shell parsing)
git ls-files 'apps/dashboard/src/app/(dashboard)' | grep 'page.tsx'

# Or escape parentheses
ls apps/dashboard/src/app/\(dashboard\)/
```

### 2. Escaped `\(dashboard\)` Directory Bug
Sometimes agents create a literal `\(dashboard\)` directory with backslashes in the name instead of writing to the `(dashboard)` directory.

**Check after every sprint:**
```bash
ls -d apps/dashboard/src/app/\\\\* 2>/dev/null
# Should return nothing. If it finds files, they're in the wrong place.
```

## Recurring Code Issues

### 3. Validators Test Import Path
`packages/validators/src/__tests__/schemas.test.ts` has an import that keeps getting reverted by agents from `'../index'` to `'../schemas'`.

**Correct import:**
```typescript
import { ... } from '../index';
```

**Check after every sprint:**
```bash
head -15 packages/validators/src/__tests__/schemas.test.ts | grep import
```

### 4. Agents Modify Unrelated package.json Files
Agents frequently change `package.json` files outside their scope, especially:
- `packages/framework/package.json` — exports/module paths
- `packages/validators/package.json` — zod version
- `packages/core/package.json` — added deps

**Fix:** After agents finish, check for unexpected changes:
```bash
git diff --name-only | grep package.json
# Revert any that shouldn't be changed:
git checkout -- packages/framework/package.json
```

### 5. Button "outline" Variant Doesn't Exist
Agents (especially those trained on shadcn/ui) frequently use `variant="outline"` on buttons. Our system only has: `primary`, `secondary`, `ghost`, `danger`.

**Find violations:**
```bash
grep -r 'variant="outline"' apps/dashboard/src/ 2>/dev/null
# Replace with "secondary"
```

### 6. Badge "destructive" Variant Doesn't Exist
Similarly, agents use `variant="destructive"` from shadcn defaults. Ours is `danger`.

```bash
grep -r 'variant="destructive"' apps/dashboard/src/ 2>/dev/null
# Replace with "danger"
```

## Build & Tooling

### 7. Prisma Version Mismatch
```bash
# CORRECT — use the local binary (v6.19.2):
./node_modules/.pnpm/node_modules/.bin/prisma generate

# WRONG — npx resolves to v7.5.0 and breaks:
npx prisma generate
```

### 8. Stale `.next/types` After Page Migration
When pages are moved (e.g., from root to `(dashboard)/`), the `.next/types` directory caches the old paths and produces hundreds of false TypeScript errors.

**Fix:** `rm -rf apps/dashboard/.next`

### 9. `tsconfig.tsbuildinfo` Changes
This file changes on every TypeScript compilation. Never commit it.

**Fix:** `git checkout -- apps/dashboard/tsconfig.tsbuildinfo`

### 10. pnpm PATH
pnpm is installed to a non-standard location. Every shell session needs:
```bash
export PATH="/sessions/wizardly-great-planck/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
```

## Database

### 11. All Prisma Access Uses `(prisma as any)`
The codebase has 520+ references to `(prisma as any).modelName`. This is because `prisma generate` hasn't been run in the sandbox (no database). Type-safe helpers exist at `packages/db/src/helpers.ts` but adoption is gradual.

### 12. Schema Root File
`packages/db/prisma/schema.prisma` must point to the `schema/` directory via the `prismaSchemaFolder` preview feature. If this file gets reset to empty (5 lines), `prisma generate` will fail.

## Testing

### 13. ~762 Test Failures Baseline
The test suite has a known baseline of ~762 failures from prior sprints. This is not a regression — it's accumulated debt. Do not try to fix all of them at once.

### 14. Vitest Binary Location
```bash
./node_modules/.pnpm/node_modules/.bin/vitest
```
Not `npx vitest` which may resolve to a different version.
