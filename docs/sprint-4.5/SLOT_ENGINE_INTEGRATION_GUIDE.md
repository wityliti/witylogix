# Slot Engine Integration Guide

Quick start guide for integrating the Slot Engine into Witylogix API.

## Files Created

### Core Modules (packages/core/src/slots/)
```
├── types.ts                    # All type definitions
├── slot-engine.ts              # Slot management (350+ lines)
├── capacity-manager.ts         # Capacity tracking (310+ lines)
├── zone-rate-calculator.ts     # Rate calculations (380+ lines)
├── deadline-engine.ts          # Deadline management (320+ lines)
├── blackout-manager.ts         # Blackout dates (330+ lines)
├── index.ts                    # Package exports
├── README.md                   # Complete documentation (500+ lines)
└── __tests__/
    ├── slot-engine.test.ts     # Engine tests (480+ lines)
    └── zone-rate-calculator.test.ts # Rate tests (440+ lines)
```

### API Routes (apps/api/src/routes/checkout/)
```
├── slots.ts                    # Slot endpoints (380+ lines)
├── rates.ts                    # Rate endpoints (340+ lines)
└── index.ts                    # Router composition
```

### Database Schema (packages/db/prisma/schema/)
```
└── 43-delivery-slots.prisma    # 8 Prisma models (200+ lines)
```

## Integration Steps

### 1. Database Migration

```bash
# Apply the new schema
npx prisma migrate dev --name add-delivery-slots

# Generate updated client
npx prisma generate
```

The schema adds these models:
- `DeliverySlot` - Time slots with capacity
- `SlotReservation` - Order reservations
- `CapacityConfig` - Daily limits
- `BlackoutDate` - Unavailable dates
- `DeadlineConfig` - Deadline settings
- `DeliveryZone` - Enhanced zones
- `LocationZoneLink` - Location-zone mapping
- `SurgePrice` - Dynamic pricing

### 2. Register API Routes

In your main app file (apps/api/src/app.ts or server.ts):

```typescript
import checkoutRouter from "./routes/checkout/index.js";

async function build() {
  const fastify = Fastify({ logger: true });

  // ... existing middleware ...

  // Register checkout router
  await fastify.register(checkoutRouter);

  // ... rest of app ...
}
```

### 3. Initialize Slot Engines

In a service or middleware file:

```typescript
import { initializeSlotEngines } from "@witylogix/core/slots";

// Initialize once at app startup
export const slotEngines = initializeSlotEngines(prisma);

// Export for use in routes
export const {
  slotEngine,
  capacityManager,
  zoneRateCalculator,
  deadlineEngine,
  blackoutManager
} = slotEngines;
```

Alternatively, engines lazy-initialize in routes on first use.

### 4. Configure Locations

After database setup, configure each location:

```typescript
const locationId = "loc-1"; // Your location ID
const today = new Date();

// Set prep time (120 minutes = 2 hours)
await deadlineEngine.setPrepTime(locationId, 120);

// Set cutoff time (8 PM, 24 hours before delivery)
await deadlineEngine.setCutoffTime(locationId, "20:00", 24);

// Set daily capacity
const date = new Date();
date.setDate(date.getDate() + 1);
await capacityManager.setDailyLimit(locationId, date, 100);
```

### 5. Create Delivery Zones

Create zones with rates:

```typescript
// Using prisma directly or your admin API
const zone = await prisma.deliveryZone.create({
  data: {
    name: "Downtown Zone",
    baseRate: 10.00,
    perKmRate: 1.50,
    minOrder: 5.00,
    freeAbove: 50.00,
    isActive: true,
    metadata: {
      weightRates: [
        { minWeight: 0, maxWeight: 5, ratePerUnit: 2 },
        { minWeight: 5, maxWeight: 10, ratePerUnit: 1.50 }
      ],
      cartValueTiers: [
        { minValue: 0, maxValue: 50, rate: 5, rateName: "Standard" },
        { minValue: 50, maxValue: 100, rate: 3, rateName: "Economy" },
        { minValue: 100, rate: 2, rateName: "Premium" }
      ]
    }
  }
});
```

### 6. Create Test Slots

```typescript
const slot = await slotEngine.createSlot({
  locationId: "loc-1",
  zoneId: zone.id,
  date: new Date("2026-04-05"),
  startTime: "09:00",
  endTime: "12:00",
  maxCapacity: 20,
  price: 15.00
});

// Or bulk create recurring slots
for (let i = 0; i < 14; i++) {
  const date = new Date();
  date.setDate(date.getDate() + i);

  // Skip Sundays
  if (date.getDay() === 0) continue;

  await slotEngine.createSlot({
    locationId: "loc-1",
    date,
    startTime: "09:00",
    endTime: "12:00",
    maxCapacity: 20,
    price: 15
  });
}
```

### 7. Set Blackout Dates

```typescript
// Add single holiday
await blackoutManager.addBlackout(
  "loc-1",
  new Date("2026-12-25"),
  "Christmas"
);

// Add recurring (e.g., Sundays)
await blackoutManager.addRecurringBlackout(
  "loc-1",
  0, // Sunday (0=Sun, 6=Sat)
  "Closed on Sundays"
);

// Bulk add holidays
await blackoutManager.bulkAddBlackouts("loc-1", [
  { date: new Date("2026-01-01"), reason: "New Year" },
  { date: new Date("2026-07-04"), reason: "Independence Day" },
  { date: new Date("2026-12-25"), reason: "Christmas" }
]);
```

## API Endpoints

### Checkout Slots

**Get Available Slots**
```bash
GET /api/checkout/slots?date=2026-04-05&zoneId=zone-1&locationId=loc-1
```

**Get Slots for Date Range**
```bash
GET /api/checkout/slots/range?start=2026-04-01&end=2026-04-30&zoneId=zone-1
```

**Reserve a Slot**
```bash
POST /api/checkout/slots/reserve
Content-Type: application/json

{
  "slotId": "slot-1",
  "orderId": "order-123",
  "expiresInMinutes": 30
}
```

**Release Reservation**
```bash
DELETE /api/checkout/slots/reserve/reservation-id
Content-Type: application/json

{
  "orderId": "order-123"
}
```

**Get Capacity Info**
```bash
GET /api/checkout/slots/capacity?date=2026-04-05&locationId=loc-1
```

**Get Order Deadline**
```bash
GET /api/checkout/slots/deadline?slotId=slot-1&date=2026-04-05
```

### Checkout Rates

**Get Zone Rate**
```bash
GET /api/checkout/rates?zipcode=10001
```

**Calculate Delivery Rate**
```bash
POST /api/checkout/rates/calculate
Content-Type: application/json

{
  "zipcode": "10001",
  "cartValue": 75.00,
  "weight": 2.5,
  "originLatitude": 40.7128,
  "originLongitude": -74.006,
  "destinationLatitude": 40.6782,
  "destinationLongitude": -73.9442
}
```

**List Delivery Zones**
```bash
GET /api/checkout/zones?page=1&limit=20&isActive=true
```

**Get Zone Details**
```bash
GET /api/checkout/zones/zone-1
```

**Update Zone Rates**
```bash
PATCH /api/checkout/zones/zone-1/rates
Content-Type: application/json

{
  "baseRate": 12.00,
  "perKmRate": 1.75,
  "freeThreshold": 60.00
}
```

## Example Usage in Frontend

```typescript
// Get available slots for checkout
async function getCheckoutSlots(date: string, locationId: string) {
  const response = await fetch(`/api/checkout/slots?date=${date}&locationId=${locationId}`);
  const { data: slots } = await response.json();
  return slots;
}

// Calculate delivery fee
async function calculateDeliveryFee(zipcode: string, cartValue: number, weight: number) {
  const response = await fetch("/api/checkout/rates/calculate", {
    method: "POST",
    body: JSON.stringify({
      zipcode,
      cartValue,
      weight
    })
  });
  const { data: rates } = await response.json();
  return rates.total;
}

// Reserve a slot
async function reserveDeliverySlot(slotId: string, orderId: string) {
  const response = await fetch("/api/checkout/slots/reserve", {
    method: "POST",
    body: JSON.stringify({
      slotId,
      orderId,
      expiresInMinutes: 30
    })
  });
  const { data } = await response.json();
  return data;
}

// Check if date is available
async function isDateAvailable(date: string, locationId: string) {
  const slots = await getCheckoutSlots(date, locationId);
  return slots.length > 0;
}
```

## Environment Setup

### Required Environment Variables

```bash
# Database (should already exist)
DATABASE_URL="postgresql://..."

# Optional: Redis for rate limiting/caching
REDIS_URL="redis://..."

# Optional: Timezone configuration
TZ="America/New_York"
```

### TypeScript Configuration

Ensure tsconfig.json includes:
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "module": "esnext",
    "moduleResolution": "node"
  }
}
```

## Testing

### Run Tests

```bash
# All tests
npm test -- packages/core/src/slots

# Specific test file
npm test -- slot-engine.test.ts

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Manual Testing

```bash
# 1. Start your API server
npm run dev

# 2. Test slot retrieval
curl "http://localhost:3000/api/checkout/slots?date=2026-04-05&locationId=loc-1"

# 3. Test rate calculation
curl -X POST http://localhost:3000/api/checkout/rates/calculate \
  -H "Content-Type: application/json" \
  -d '{"zipcode":"10001","cartValue":75,"weight":2.5}'

# 4. Test reservation
curl -X POST http://localhost:3000/api/checkout/slots/reserve \
  -H "Content-Type: application/json" \
  -d '{"slotId":"slot-1","orderId":"order-123"}'
```

## Performance Optimization

### Database Indexes
All critical queries have indexes (already in schema).

### Caching Recommendations
```typescript
// Cache zone rates in Redis
const cacheKey = `zone-rate:${zoneId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const rate = await zoneRateCalculator.getZoneRates(zoneId);
await redis.set(cacheKey, JSON.stringify(rate), "EX", 3600); // 1 hour
return rate;
```

### Connection Pooling
Configure Prisma connection pool:
```
DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=0"
```

## Monitoring

### Key Metrics to Track
1. Slot reservation rate
2. Average utilization %
3. Peak hours
4. Failed reservations
5. Rate calculation latency
6. API response times

### Logging
Add to your existing logger:
```typescript
logger.info("Slot reserved", {
  slotId, orderId, expiresAt,
  locationId, zone,
  timestamp: new Date()
});

logger.error("Reservation failed", {
  slotId, orderId, error,
  remainingCapacity, maxCapacity
});
```

## Troubleshooting

### Slots not appearing
1. Check if location is blacked out: `await blackoutManager.isBlackedOut(locationId, date)`
2. Verify slots exist: `SELECT * FROM delivery_slots WHERE location_id=$1 AND date=$2`
3. Check if past cutoff: `await deadlineEngine.isOrderCutoffPassed(date, slotId)`

### Rate calculation wrong
1. Verify zone exists for zipcode
2. Check weight/cart tiers are configured
3. Verify distance calculation: use Haversine formula
4. Check free threshold configuration

### Reservations failing
1. Check slot capacity: `await slotEngine.checkCapacity(slotId)`
2. Verify slot is active
3. Check for duplicate reservation
4. Verify transaction support in database

## Support & Debugging

### Enable Debug Logging
```typescript
// In your app initialization
if (process.env.DEBUG_SLOTS) {
  const originalReserve = slotEngine.reserveSlot;
  slotEngine.reserveSlot = async (...args) => {
    console.time(`reserve-${args[1]}`);
    const result = await originalReserve.apply(slotEngine, args);
    console.timeEnd(`reserve-${args[1]}`);
    return result;
  };
}
```

### Common Issues
| Issue | Solution |
|-------|----------|
| "Slot not found" | Verify slotId exists and isActive=true |
| "Slot is full" | Check capacity and active reservations |
| "Blackout date" | Check blackout manager configuration |
| "Deadline passed" | Verify cutoff time settings |
| "No zone found" | Create zone or verify zipcode mapping |

## Next Steps

1. Apply database migration
2. Register checkout router
3. Initialize slot engines
4. Configure locations and zones
5. Create test slots and blackout dates
6. Run integration tests
7. Monitor API endpoints
8. Enable rate limiting
9. Set up caching layer
10. Deploy to production

## Questions?

Refer to:
- `/packages/core/src/slots/README.md` - Complete documentation
- `/SLOT_ENGINE_IMPLEMENTATION.md` - Technical overview
- Test files for usage examples
- Type definitions for API contracts

Built for Witylogix by Rahul (Backend Lead)
Sprint 4.5 - March 2026
