# Billing System Integration Checklist

Use this checklist to integrate the billing system with your application.

## Phase 1: Review & Testing (30 mins)

- [ ] Read `/BILLING_IMPLEMENTATION.md` for complete technical overview
- [ ] Review `/BILLING_DELIVERY_SUMMARY.md` for what was built
- [ ] Check `/packages/core/src/billing/README.md` for API reference
- [ ] Review example tests in `/apps/api/src/routes/__tests__/billing.test.example.ts`
- [ ] Test billing endpoints locally using provided examples

## Phase 2: Integration (1-2 hours)

- [ ] Copy test examples to your test suite
- [ ] Update shipments route to check `checkUsageLimit("shipments", ...)`
- [ ] Update drivers route to check `checkUsageLimit("drivers", ...)`
- [ ] Update API routes to record `RoutingMeterEvent` (already done)
- [ ] Update notification routes to record `NotificationMeterEvent` (already done)
- [ ] Verify activity logs are recorded for plan changes

## Phase 3: Dashboard Integration (2-3 hours)

- [ ] Display current plan tier on dashboard
- [ ] Show usage metrics: `GET /api/v4/billing/subscription`
- [ ] Show detailed usage: `GET /api/v4/billing/usage`
- [ ] Display usage trends (daily breakdown)
- [ ] Show plan limits with progress bars
- [ ] Add warnings at 80% usage

## Phase 4: Upgrade Flow (2-3 hours)

- [ ] Create plan selection UI
- [ ] Call `POST /api/v4/billing/subscription` to upgrade
- [ ] Redirect to Shopify confirmation URL
- [ ] Handle plan upgrade completion
- [ ] Show proration amount to user
- [ ] Log plan changes to activity feed

## Phase 5: User Notifications (1-2 hours)

- [ ] Email when approaching limit (80%)
- [ ] Email when at limit (100%)
- [ ] In-app notification for plan changes
- [ ] Show upgrade recommendation for limited plans
- [ ] Display next billing date

## Phase 6: Shopify Integration (Phase 2)

- [ ] Implement Shopify GraphQL client
- [ ] Create actual recurring charges (not mocked)
- [ ] Handle charge acceptance/decline
- [ ] Implement charge renewal webhook
- [ ] Handle failed payment scenarios
- [ ] Generate PDF invoices

## Detailed Integration Steps

### Step 1: Add Limit Checks to Shipments Route

File: `/apps/api/src/routes/shipments.ts`

```typescript
import { checkUsageLimit } from "@witylogix/core/billing/index.js";

// In POST /shipments handler
fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
  const shop = await request.tenantDb.shop.findUnique({
    where: { id: request.shopId },
  });

  // Get current shipment count this month
  const shipmentsThisMonth = await request.tenantDb.shipment.count({
    where: {
      shopId: request.shopId,
      createdAt: {
        gte: getMonthStart(new Date()),
      },
    },
  });

  // Check if allowed
  const limitCheck = checkUsageLimit(
    shop.planTier,
    "shipments",
    shipmentsThisMonth,
  );

  if (!limitCheck.allowed) {
    throw new ConflictError(
      `Shipment limit reached (${limitCheck.limit}/month). ` +
        `Upgrade your plan to continue: /billing/subscription`,
    );
  }

  // Continue with shipment creation...
});
```

### Step 2: Add Limit Checks to Drivers Route

File: `/apps/api/src/routes/drivers.ts`

```typescript
import { checkUsageLimit } from "@witylogix/core/billing/index.js";

// In POST /drivers handler
fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
  const shop = await request.tenantDb.shop.findUnique({
    where: { id: request.shopId },
  });

  // Get current driver count
  const driversCount = await request.tenantDb.driver.count({
    where: { shopId: request.shopId },
  });

  // Check if allowed
  const limitCheck = checkUsageLimit(shop.planTier, "drivers", driversCount);

  if (!limitCheck.allowed) {
    throw new ConflictError(
      `Driver limit reached (${limitCheck.limit}). ` +
        `Upgrade your plan to add more drivers: /billing/subscription`,
    );
  }

  // Continue with driver creation...
});
```

### Step 3: Add Billing Information to Dashboard

File: `apps/dashboard/src/components/BillingCard.tsx`

```typescript
import { useEffect, useState } from "react";

interface SubscriptionData {
  plan: string;
  limits: {
    shipments: { used: number; limit: number; remaining: number };
    drivers: { used: number; limit: number; remaining: number };
  };
}

export function BillingCard() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    fetch("/api/v4/billing/subscription", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setSubscription);
  }, [token]);

  if (!subscription) return <div>Loading...</div>;

  const shipmentsPercent =
    (subscription.limits.shipments.used / subscription.limits.shipments.limit) * 100;

  return (
    <div>
      <h2>Plan: {subscription.plan}</h2>
      <div>
        <p>Shipments: {subscription.limits.shipments.used}/{subscription.limits.shipments.limit}</p>
        <progress value={shipmentsPercent} max={100} />
        {shipmentsPercent > 80 && (
          <p style={{ color: "orange" }}>
            Consider upgrading your plan
          </p>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Create Plan Upgrade Dialog

File: `apps/dashboard/src/components/UpgradeDialog.tsx`

```typescript
import { useState } from "react";

interface Plan {
  tier: string;
  features: { shipmentsPerMonth: number; monthlyPrice: number };
}

export function UpgradeDialog({ plans }: { plans: Plan[] }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v4/billing/subscription", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planId: selectedPlan })
      });

      const result = await response.json();

      // Redirect to Shopify confirmation
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upgrade Plan</h2>
      {plans.map(plan => (
        <button
          key={plan.tier}
          onClick={() => setSelectedPlan(plan.tier)}
          style={{
            backgroundColor: selectedPlan === plan.tier ? "blue" : "white"
          }}
        >
          {plan.tier} - ${plan.features.monthlyPrice}/month
          {plan.features.shipmentsPerMonth === Infinity
            ? " Unlimited"
            : ` ${plan.features.shipmentsPerMonth} shipments`}
        </button>
      ))}
      <button onClick={handleUpgrade} disabled={!selectedPlan || loading}>
        {loading ? "Upgrading..." : "Upgrade"}
      </button>
    </div>
  );
}
```

### Step 5: Display Usage Trends

File: `apps/dashboard/src/components/UsageChart.tsx`

```typescript
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface UsageData {
  trends: {
    dailyShipments: Array<{ date: string; count: number }>;
  };
}

export function UsageChart() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/v4/billing/usage", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setUsage);
  }, []);

  if (!usage) return <div>Loading...</div>;

  return (
    <LineChart width={600} height={300} data={usage.trends.dailyShipments}>
      <CartesianGrid />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="count" stroke="#8884d8" />
    </LineChart>
  );
}
```

## Testing Checklist

### Unit Tests

- [ ] `checkUsageLimit()` returns correct values
- [ ] `calculateProration()` calculates correctly
- [ ] `createUsageSummary()` generates proper structure
- [ ] `getPlanComparison()` returns all plans

### Integration Tests

- [ ] GET /plans returns 4 plans
- [ ] GET /subscription returns current plan
- [ ] POST /subscription upgrades plan
- [ ] POST /subscription/cancel cancels plan
- [ ] GET /usage returns detailed metrics
- [ ] GET /invoices returns paginated invoices

### E2E Tests

- [ ] User can see subscription status
- [ ] User can upgrade plan
- [ ] User receives Shopify confirmation URL
- [ ] Usage limits are enforced
- [ ] Warnings show at 80% usage
- [ ] Invoice history is accessible

## Deployment Checklist

- [ ] No new database migrations needed
- [ ] No new environment variables needed (for MVP)
- [ ] All TypeScript compiles without errors
- [ ] All tests pass
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Billing routes registered in server.ts
- [ ] Error handling works correctly
- [ ] Rate limiting applies to billing endpoints
- [ ] Authentication required for all endpoints

## Post-Deployment

- [ ] Monitor billing endpoint response times
- [ ] Monitor error rates in billing routes
- [ ] Track plan distribution (how many on each plan)
- [ ] Track usage patterns (which metrics are used most)
- [ ] Collect user feedback on billing UI
- [ ] Plan Phase 2 enhancements (Shopify webhooks)

## Common Issues & Solutions

### Issue: Import error for @witylogix/core/billing

**Solution:** Ensure the file exists at `/packages/core/src/billing/index.ts`

### Issue: Database query too slow

**Solution:**

- Add indexes on `shopId` and `createdAt` (already in schema)
- Use monthly aggregation for old data
- Implement caching for usage metrics

### Issue: Proration calculation seems off

**Solution:** Use the provided `calculateProration()` function - it handles all edge cases

### Issue: Users confused about upgrade redirect

**Solution:** Show clear message: "You will be redirected to Shopify to confirm your plan change"

## Support & Documentation

### For Backend Developers

- See `/packages/core/src/billing/README.md` for API reference
- See `/BILLING_QUICK_START.md` for code examples
- See `/BILLING_IMPLEMENTATION.md` for technical details

### For Frontend Developers

- See `/BILLING_QUICK_START.md` for API endpoints
- See test examples in `/apps/api/src/routes/__tests__/billing.test.example.ts`
- Example React components above in this checklist

### For Devops/Deployment

- No new services needed
- No new databases needed
- No new environment variables (for MVP)
- See `/BILLING_IMPLEMENTATION.md` for monitoring setup

## Timeline Estimate

| Phase     | Task                | Time      |
| --------- | ------------------- | --------- |
| 1         | Review & Testing    | 0.5h      |
| 2         | Backend Integration | 1-2h      |
| 3         | Dashboard Display   | 2-3h      |
| 4         | Upgrade Flow        | 2-3h      |
| 5         | Notifications       | 1-2h      |
| **Total** |                     | **7-11h** |

Add 1-2 weeks for Phase 6 (Shopify webhooks) if needed.

## Success Metrics

After integration, you should have:

- ✓ All billing endpoints working
- ✓ Usage limits enforced
- ✓ Plan upgrades functional
- ✓ Usage displayed on dashboard
- ✓ Trends visible in charts
- ✓ Clear upgrade path for users
- ✓ Activity logs recorded
- ✓ Tests passing
- ✓ Monitoring in place

## Next Steps

1. **Immediate:** Follow Steps 1-2 (add limit checks)
2. **Short-term:** Follow Steps 3-5 (dashboard integration)
3. **Medium-term:** Implement Phase 6 (Shopify webhooks)
4. **Long-term:** Phase 7+ (usage-based pricing, advanced analytics)

## Questions?

See the detailed documentation:

- `/BILLING_IMPLEMENTATION.md` — Full technical guide
- `/BILLING_QUICK_START.md` — Code examples
- `/packages/core/src/billing/README.md` — API reference
- Test examples — `/apps/api/src/routes/__tests__/billing.test.example.ts`

---

**Ready to integrate?** Start with Phase 1: Review & Testing
