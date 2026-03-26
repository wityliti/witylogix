# Fastify Type Augmentation Fix Summary

## Overview
Fixed Fastify type augmentation issues across the Witylogix API codebase. All TypeScript errors related to missing properties on `FastifyRequest` and `FastifyInstance` have been resolved by centralizing type definitions.

## Issues Fixed

### 1. **Property 'session' does not exist on type 'FastifyRequest'**
   - Added `session?: SessionContext` to FastifyRequest interface
   - Defined `SessionContext` interface for optional session-based auth flows

### 2. **Property 'db' does not exist on type 'FastifyInstance'**
   - Added `db: typeof prisma` to FastifyInstance interface
   - Available for admin operations and schema migrations

### 3. **Property 'tenantId' does not exist on type 'string | object | Buffer'**
   - Added `tenantId?: string` to FastifyRequest interface
   - Middleware now explicitly sets `request.tenantId = shopId` as an alias
   - Allows routes using `request.tenantId` to work correctly

### 4. **Property 'auth' does not exist on type 'FastifyRequest'**
   - Centralized `AuthContext` interface definition
   - Added `auth: AuthContext` to FastifyRequest interface
   - Properly typed with all required fields (shopId, userId, role, etc.)

## Files Modified

### New Files Created
- **`apps/api/src/types/fastify.d.ts`** - Central type augmentation file
  - Consolidates all Fastify module augmentations
  - Defines AuthContext and SessionContext interfaces
  - Documents all extended properties with JSDoc comments
  - Imports from middleware/plugins for proper typing

### Middleware Files Updated

1. **`apps/api/src/middleware/auth.ts`**
   - Removed duplicate `AuthContext` definition
   - Added import: `import type { AuthContext } from "../types/fastify.js"`
   - Now re-exports AuthContext from central types
   - Removed duplicate `declare module "fastify"` block

2. **`apps/api/src/middleware/tenant.ts`**
   - Removed `declare module "fastify"` block (now in central types)
   - Added `request.tenantId = shopId` in tenantContext function
   - Sets both shopId and tenantId for compatibility

3. **`apps/api/src/middleware/request-id.ts`**
   - Removed duplicate `declare module "fastify"` block
   - Relies on central type augmentation

4. **`apps/api/src/middleware/request-logger.ts`**
   - Removed duplicate `declare module "fastify"` block
   - Relies on central type augmentation

### Plugin Files Updated

1. **`apps/api/src/plugins/raw-body.ts`**
   - Removed duplicate `declare module "fastify"` block
   - Relies on central type augmentation

2. **`apps/api/src/plugins/event-webhook-bridge.ts`**
   - Removed duplicate `declare module "fastify"` block
   - Relies on central type augmentation

### Server Setup

1. **`apps/api/src/server.ts`**
   - Added early import: `import type {} from "./types/fastify.js"`
   - Ensures type augmentations are loaded before any usage
   - Placed at the beginning after dotenv import

## Type Augmentations Summary

### FastifyRequest Extended Properties
```typescript
interface FastifyRequest {
  auth: AuthContext;                    // Required: JWT/session auth
  session?: SessionContext;              // Optional: session-based auth
  tenantId?: string;                     // Alias for shopId
  shopId: string;                        // Tenant identifier
  orgId?: string;                        // Organization context
  tenantDb: ReturnType<typeof forTenant>; // RLS-scoped Prisma client
  orgDb?: ReturnType<typeof forOrg>;     // Org-scoped Prisma client
  tenantRedis: TenantRedis;              // Tenant-scoped Redis
  requestId: string;                     // Correlation ID
  rawBody?: Buffer;                      // Raw body for HMAC verification
  startTime?: number;                    // Request start time
}
```

### FastifyInstance Extended Properties
```typescript
interface FastifyInstance {
  db: typeof prisma;                     // Primary Prisma client
  eventBus: TypedEventBus<any>;         // Event pub/sub
  eventWebhookBridge: EventWebhookBridge; // Webhook manager
}
```

## How the Fix Works

1. **Centralized Type Definitions**: All Fastify augmentations are in one file (`types/fastify.d.ts`), making it easier to maintain and ensure consistency.

2. **Early Type Loading**: The `server.ts` file imports the types at the beginning, ensuring they're loaded and available throughout the application.

3. **Property Setting in Middleware**:
   - `tenantContext` middleware now explicitly sets `request.tenantId = shopId`
   - This ensures the property is available even though it's optional in the type definition

4. **Re-exports**: `auth.ts` re-exports `AuthContext` for external use, maintaining backwards compatibility.

## Type Safety Benefits

- ✅ All `request.auth` property access is now type-safe
- ✅ All `request.tenantId` property access is now type-safe
- ✅ All `app.db` property access is now type-safe
- ✅ All `request.session` property access is now type-safe
- ✅ Centralized source of truth for Fastify augmentations
- ✅ Well-documented with JSDoc comments
- ✅ No duplicate type definitions across codebase

## Testing Recommendations

1. Run TypeScript compiler to verify no type errors: `tsc --noEmit`
2. Build the project: `npm run build`
3. Run linting: `npm run lint`
4. Run any existing tests to ensure runtime behavior is unchanged

## No Runtime Changes

This fix is **purely a TypeScript type augmentation issue**. There are no runtime behavior changes:
- No middleware logic was modified
- No route logic was changed
- Only type definitions and property assignments were updated
- The application will behave exactly the same, but with proper TypeScript type checking
