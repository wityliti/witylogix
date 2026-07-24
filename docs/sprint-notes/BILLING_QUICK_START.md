# Billing System — Quick Start Guide

## Overview

The Witylogix billing system manages Shopify subscriptions, tracks usage, and enforces plan limits. This guide helps developers integrate billing checks into their code.

## For Route Developers

### Checking Usage Limits

When creating a new shipment, driver, or API operation:

```typescript
import { checkUsageLimit } from "@witylogix/core/billing/index.js";

// In your route handler
const shop = await request.tenantDb.shop.findUnique({
  where: { id: request.shopId },
});

const shipmentCount = await request.tenantDb.shipment.count({
  where: { shopId: request.shopId },
});

const limitCheck = checkUsageLimit(shop.planTier, "shipments", shipmentCount);

if (!limitCheck.allowed) {
  throw new ConflictError(
    `Shipment limit reached. Upgrade your plan at /billing/subscription`,
  );
}

// Continue with creating shipment
await request.tenantDb.shipment.create({
  /* ... */
});
```

### Recording Metrics

The system automatically records metrics:

```typescript
// Metrics are recorded automatically when you:
// 1. Create a Shipment → shipmentsUsed increments
// 2. Create a Driver → driversUsed increments
// 3. Call routing API → RoutingMeterEvent recorded
// 4. Send notification → NotificationMeterEvent recorded

// No explicit calls needed in most cases!
```

## For Dashboard Developers

### Getting Subscription Status

```typescript
// GET /api/v4/billing/subscription
const response = await fetch("/api/v4/billing/subscription", {
  headers: { Authorization: `Bearer ${token}` },
});

const subscription = await response.json();
console.log(subscription.plan); // 'STARTER'
console.log(subscription.limits.shipments.remaining); // 255
console.log(subscription.overageProjection.willExceedShipments); // false
```

### Displaying Usage

```typescript
// GET /api/v4/billing/usage
const response = await fetch("/api/v4/billing/usage", {
  headers: { Authorization: `Bearer ${token}` },
});

const usage = await response.json();

// Show progress bars
const shipmentPercent = usage.usage.shipments.percentageUsed;
const shipmentRemaining = usage.usage.shipments.remaining;

// Show daily trends
usage.trends.dailyShipments.forEach((day) => {
  console.log(`${day.date}: ${day.count} shipments`);
});
```

### Upgrading Plan

```typescript
// POST /api/v4/billing/subscription
const response = await fetch("/api/v4/billing/subscription", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ planId: "GROWTH" }),
});

const result = await response.json();
console.log(result.confirmationUrl); // Direct to Shopify
```

## Plan Limits

### Quick Reference

```typescript
import { PLANS } from "@witylogix/core/billing/index.js";

PLANS.STARTER.shipmentsPerMonth; // 500
PLANS.STARTER.driversLimit; // 5
PLANS.STARTER.apiCallsPerMonth; // 10,000
PLANS.STARTER.notificationsPerMonth; // 5,000

PLANS.ENTERPRISE.shipmentsPerMonth; // Infinity
```

### Feature Flags

```typescript
import { PLANS } from "@witylogix/core/billing/index.js";

if (PLANS[shop.planTier].hasRouteOptimization) {
  // Show route optimization UI
}

if (PLANS[shop.planTier].hasMultiCarrier) {
  // Allow multiple carriers
}
```

## Common Patterns

### 1. Prevent Over-usage

```typescript
// In POST /shipments
const limitCheck = checkUsageLimit(plan, "shipments", currentCount);

if (!limitCheck.allowed) {
  return reply.status(429).send({
    error: "Plan limit reached",
    limit: limitCheck.limit,
    current: currentCount,
    remaining: limitCheck.remaining,
    upgradeUrl: "/billing/plans",
  });
}
```

### 2. Show Warning at 80%

```typescript
const limitCheck = checkUsageLimit(plan, "shipments", currentCount);

if (limitCheck.percentageUsed > 80) {
  await notifyUser({
    type: "warning",
    message: `You're using ${limitCheck.percentageUsed}% of your shipment limit`,
  });
}
```

### 3. Calculate Proration

```typescript
import { calculateProration } from "@witylogix/core/billing/index.js";

const billingPeriodEnd = new Date(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  0,
);
const daysRemaining = Math.ceil(
  (billingPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
);

const dueAmount = calculateProration("STARTER", "GROWTH", daysRemaining);

// Positive = charge, Negative = credit
if (dueAmount > 0) {
  console.log(`Customer owes $${dueAmount}`);
} else {
  console.log(`Refund $${Math.abs(dueAmount)}`);
}
```

## API Routes Cheat Sheet

```bash
# Get available plans
GET /api/v4/billing/plans

# Get current subscription & limits
GET /api/v4/billing/subscription

# Upgrade/downgrade plan
POST /api/v4/billing/subscription
body: { "planId": "GROWTH" }

# Cancel subscription
POST /api/v4/billing/subscription/cancel

# Get detailed usage & trends
GET /api/v4/billing/usage

# Record usage event (internal)
POST /api/v4/billing/usage/event
body: { "type": "shipment_created", "metadata": {...} }

# List invoices
GET /api/v4/billing/invoices?page=1&limit=20
```

## Types

```typescript
import type { PlanTier } from "@prisma/client";
import type { UsageSummary, LimitCheckResult } from "@witylogix/core/billing";

// Plan tiers
type PlanTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

// Usage summary response
interface UsageSummary {
  plan: PlanTier;
  status: "active" | "trial" | "cancelled" | "past_due";
  billingCycle: string;
  nextBillingDate: Date | null;
  currentMetrics: UsageMetrics;
  limits: {
    shipments: { used: number; limit: number; remaining: number };
    drivers: { used: number; limit: number; remaining: number };
    apiCalls: { used: number; limit: number; remaining: number };
    notifications: { used: number; limit: number; remaining: number };
  };
  overageProjection: {
    willExceedShipments: boolean;
    willExceedDrivers: boolean;
    willExceedApiCalls: boolean;
    willExceedNotifications: boolean;
  };
}

// Limit check result
interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  percentageUsed: number;
}
```

## Troubleshooting

### Issue: "Plan limit reached"

**Solution:** Check current usage and recommend plan upgrade.

```typescript
const usage = await fetch("/api/v4/billing/usage");
console.log(usage.limits); // Show which limits are exceeded
```

### Issue: Metrics not updating

**Metrics are recorded automatically** when you:

- Create shipments (Shipment model)
- Create drivers (Driver model)
- Make API calls (RoutingMeterEvent model)
- Send notifications (NotificationMeterEvent model)

No manual recording needed!

### Issue: Proration calculation off

**Use the provided function** - it handles all the math:

```typescript
const amount = calculateProration("STARTER", "GROWTH", daysRemaining);
// Returns exact charge/credit amount
```

## Testing

### Test Plan Limits

```bash
# Create multiple shipments until hitting FREE plan limit (50)
for i in {1..50}; do
  curl -X POST /api/v4/shipments \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"...": "..."}'
done

# 51st should fail with limit reached
```

### Test Usage Endpoint

```bash
curl https://localhost:3000/api/v4/billing/usage \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Test Plan Upgrade

```bash
curl -X POST https://localhost:3000/api/v4/billing/subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"GROWTH"}' | jq .
```

## Next Steps

1. **Integrate limit checks** into existing routes (shipments, drivers, API calls)
2. **Update dashboard** to show billing information
3. **Add warning system** for approaching limits
4. **Implement Shopify webhooks** for production (see BILLING_IMPLEMENTATION.md)
5. **Set up monitoring** for plan usage and upgrades

## Related Files

- Implementation details: `/BILLING_IMPLEMENTATION.md`
- Core service: `/packages/core/src/billing/index.ts`
- API routes: `/apps/api/src/routes/billing.ts`
- Database schema: `/packages/db/prisma/schema/02-shops.prisma`
