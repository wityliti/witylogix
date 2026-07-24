# Slot Engine & Capacity Management

Complete slot availability, capacity management, rate calculation, and deadline management system for Witylogix last-mile delivery platform.

## Overview

The Slot Engine provides:

- **Slot Management**: Create, update, and manage delivery time slots
- **Capacity Tracking**: Real-time capacity utilization and forecasting
- **Rate Calculation**: Zone-based, distance-based, weight-based, and cart-value tier pricing
- **Deadline Management**: Order deadlines, cut-off times, and prep time configuration
- **Blackout Management**: Holiday and closure date handling (one-time and recurring)
- **Atomic Reservations**: Transaction-based slot reservations preventing double-booking

## Architecture

### Core Modules

#### 1. SlotEngine (`slot-engine.ts`)

Primary class for slot management and reservations.

**Key Methods:**

```typescript
// Get available slots for a date
getAvailableSlots(date: Date, zoneId?: string, locationId?: string): Promise<SlotAvailability[]>

// Check slot capacity
checkCapacity(slotId: string): Promise<{ available: number; total: number; isFull: boolean }>

// Reserve a slot (atomic operation)
reserveSlot(slotId: string, orderId: string, expiresInMinutes?: number): Promise<ReservationResult>

// Release a reservation
releaseSlot(slotId: string, orderId: string): Promise<void>

// Get slots for date range
getSlotsByDateRange(startDate: Date, endDate: Date, zoneId?: string): Promise<Map<string, SlotAvailability[]>>

// Find next available slot
getNextAvailableSlot(zoneId: string, locationId: string): Promise<{ date: Date; slot: SlotAvailability } | null>
```

**Features:**

- Prevents double-booking using database transactions
- Validates dates and times
- Integrates with blackout and deadline managers
- Supports multi-location deployments

#### 2. CapacityManager (`capacity-manager.ts`)

Manages daily capacity limits and utilization tracking.

**Key Methods:**

```typescript
// Set daily order limit
setDailyLimit(locationId: string, date: Date, maxOrders: number): Promise<CapacityConfig>

// Set slot capacity
setSlotCapacity(slotId: string, maxOrders: number): Promise<void>

// Get capacity utilization report
getCapacityUtilization(locationId: string, date: Date): Promise<CapacityReport>

// Check if slot is available
isSlotAvailable(slotId: string): Promise<boolean>

// Adjust capacity by demand (AI integration hook)
adjustCapacityByDemand(locationId: string, date: Date, factor: number): Promise<CapacityAdjustmentResult>

// Get capacity forecast
getCapacityForecast(locationId: string, days?: number): Promise<CapacityReport[]>

// Get high-demand dates
getHighDemandDates(locationId: string, startDate: Date, endDate: Date, thresholdPercent?: number): Promise<Date[]>
```

**Features:**

- Real-time capacity tracking
- Demand factor adjustment (0.5 = 50% reduction, 1.5 = 50% increase)
- Automatic high-demand identification
- Recommendation generation
- Recurring capacity configuration

#### 3. ZoneRateCalculator (`zone-rate-calculator.ts`)

Calculates delivery rates based on multiple factors.

**Key Methods:**

```typescript
// Calculate comprehensive rate breakdown
calculateRate(input: RateCalculationInput): Promise<RateBreakdown>

// Get zone rate by zipcode
getRateByZipcode(zipcode: string): Promise<ZoneRate | null>

// Calculate distance-based rate (Haversine formula)
calculateDistanceRate(origin: Coordinates, destination: Coordinates, zone: ZoneRate): DistanceRate

// Get delivery free threshold
getDeliveryFreeThreshold(zoneId: string): Promise<number>

// Update zone rates
updateZoneRates(zoneId: string, updates: Partial<ZoneRate>): Promise<ZoneRate>
```

**Pricing Models Supported:**

1. **Flat Rate**: Fixed base fee
2. **Per-Km**: Distance-based (km)
3. **Per-Mile**: Distance-based (miles)
4. **Weight-Based**: Tiered weight surcharges
5. **Cart-Value Tiers**: Pricing based on order value
6. **Free Delivery Threshold**: Free delivery above cart value
7. **Minimum Charge**: Ensure minimum order value

**Example Rate Calculation:**

```typescript
const rate = await calculator.calculateRate({
  address: { zipcode: "10001" },
  cartValue: 75,
  weight: 2.5,
  origin: { latitude: 40.7128, longitude: -74.006 },
  destination: { latitude: 40.6782, longitude: -73.9442 },
});

// Returns:
// {
//   baseFee: 5,
//   distanceFee: 15,
//   weightFee: 2.5,
//   cartValueFee: 0,
//   discounts: 0,
//   subtotal: 22.5,
//   total: 22.5,
//   currency: "USD",
//   breakdown: [...]
// }
```

#### 4. DeadlineEngine (`deadline-engine.ts`)

Manages order deadlines and cut-off times.

**Key Methods:**

```typescript
// Get order deadline for a delivery slot
getOrderDeadline(deliveryDate: Date, slotId: string): Promise<OrderDeadline>

// Check if order cut-off has passed
isOrderCutoffPassed(deliveryDate: Date, slotId: string): Promise<boolean>

// Set prep time for location
setPrepTime(locationId: string, minutes: number): Promise<DeadlineConfig>

// Set cut-off time for location
setCutoffTime(locationId: string, cutoffTime: string, cutoffHours: number): Promise<DeadlineConfig>

// Get next available slot with open deadline
getNextAvailableSlot(zoneId: string, locationId: string): Promise<{ date: Date; slotId: string } | null>

// Check deadline compliance
checkDeadlineCompliance(orderId: string, slotId: string, deliveryDate: Date): Promise<{ compliant: boolean; hoursRemaining: number; message: string }>
```

**Features:**

- Configurable prep time per location
- Customizable cut-off times
- Deadline compliance checking
- Extended deadline support (VIP orders)
- Bulk deadline configuration

#### 5. BlackoutManager (`blackout-manager.ts`)

Manages unavailable dates and recurring closures.

**Key Methods:**

```typescript
// Add single blackout date
addBlackout(locationId: string, date: Date, reason: string): Promise<BlackoutDate>

// Add recurring blackout (e.g., Sundays)
addRecurringBlackout(locationId: string, dayOfWeek: number, reason: string): Promise<BlackoutDate>

// Remove blackout
removeBlackout(locationId: string, date: Date): Promise<void>

// Get blackouts for date range
getBlackouts(locationId: string, startDate: Date, endDate: Date): Promise<BlackoutDate[]>

// Check if date is blacked out
isBlackedOut(locationId: string, date: Date): Promise<boolean>

// Get next available date
getNextAvailableDate(locationId: string, startDate?: Date): Promise<Date | null>

// Get available dates (exclude blackouts)
getAvailableDates(locationId: string, startDate: Date, endDate: Date): Promise<Date[]>

// Bulk add blackouts
bulkAddBlackouts(locationId: string, blackouts: Array<{ date: Date; reason: string }>): Promise<BlackoutDate[]>
```

**Features:**

- One-time blackout dates (holidays, special closures)
- Recurring blackouts (e.g., no Sunday delivery)
- Bulk operations for efficiency
- Automatic expansion of recurring dates
- Next available date finder

## API Routes

### Checkout Slots (`/api/checkout/slots/`)

**GET** `/api/checkout/slots?date=2026-04-01&zoneId=zone-1&locationId=loc-1`

Get available slots for a specific date.

```json
{
  "data": [
    {
      "id": "slot-1",
      "locationId": "loc-1",
      "date": "2026-04-01T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "12:00",
      "available": 8,
      "total": 10,
      "isFull": false,
      "price": 15.0,
      "zone": { "id": "zone-1", "name": "Downtown" }
    }
  ],
  "count": 1,
  "date": "2026-04-01"
}
```

**GET** `/api/checkout/slots/range?start=2026-04-01&end=2026-04-07&zoneId=zone-1`

Get slots for a date range (max 90 days).

```json
{
  "data": {
    "2026-04-01": [{ ... }],
    "2026-04-02": [{ ... }],
    "2026-04-03": [{ ... }]
  },
  "startDate": "2026-04-01",
  "endDate": "2026-04-07",
  "dayCount": 3
}
```

**POST** `/api/checkout/slots/reserve`

Reserve a slot for an order.

```json
{
  "slotId": "slot-1",
  "orderId": "order-12345",
  "expiresInMinutes": 30
}
```

Response:

```json
{
  "data": {
    "slotId": "slot-1",
    "orderId": "order-12345",
    "expiresAt": "2026-04-01T10:30:00.000Z",
    "status": "PENDING"
  },
  "message": "Slot reserved successfully. Expires at 2026-04-01T10:30:00.000Z"
}
```

**DELETE** `/api/checkout/slots/reserve/:reservationId`

Release a slot reservation.

```json
{
  "orderId": "order-12345"
}
```

**GET** `/api/checkout/slots/capacity?date=2026-04-01&locationId=loc-1`

Get capacity information.

```json
{
  "data": {
    "locationId": "loc-1",
    "date": "2026-04-01T00:00:00.000Z",
    "totalCapacity": 100,
    "currentUsage": 75,
    "availableSlots": 25,
    "percentUtilized": 75.0,
    "status": "high_demand",
    "peakHours": [
      { "startTime": "12:00", "endTime": "15:00" },
      { "startTime": "17:00", "endTime": "19:00" }
    ],
    "recommendations": [
      "High demand. Monitor closely and prepare for scale.",
      "Consider offering off-peak time incentives."
    ]
  }
}
```

**GET** `/api/checkout/slots/deadline?slotId=slot-1&date=2026-04-01`

Get order deadline for a slot.

```json
{
  "data": {
    "deadline": "2026-03-31T04:00:00.000Z",
    "cutoffHours": 20,
    "prepTime": 120,
    "isPastDeadline": false,
    "hoursRemaining": 18.5,
    "message": "Order can be placed. Deadline in 18 hours."
  }
}
```

### Checkout Rates (`/api/checkout/rates/`)

**GET** `/api/checkout/rates?zipcode=10001`

Get zone rate by zipcode.

```json
{
  "data": {
    "zoneId": "zone-1",
    "zoneName": "Downtown Manhattan",
    "baseRate": 10.0,
    "perKmRate": 1.5,
    "freeThreshold": 50.0,
    "minimumCharge": 5.0
  }
}
```

**POST** `/api/checkout/rates/calculate`

Calculate delivery rate.

```json
{
  "zipcode": "10001",
  "cartValue": 75,
  "weight": 2.5,
  "originLatitude": 40.7128,
  "originLongitude": -74.006,
  "destinationLatitude": 40.6782,
  "destinationLongitude": -73.9442
}
```

Response:

```json
{
  "data": {
    "baseFee": 10.0,
    "distanceFee": 15.23,
    "weightFee": 2.5,
    "cartValueFee": 0.0,
    "discounts": 0.0,
    "subtotal": 27.73,
    "total": 27.73,
    "currency": "USD",
    "breakdown": [
      { "label": "Base Delivery Fee", "amount": 10.0, "method": "flat" },
      {
        "label": "Distance Fee (10.15 km)",
        "amount": 15.23,
        "method": "per_km"
      },
      {
        "label": "Weight Surcharge (2.5kg)",
        "amount": 2.5,
        "method": "weight_based"
      }
    ]
  }
}
```

**GET** `/api/checkout/zones?page=1&limit=20&isActive=true`

List delivery zones.

```json
{
  "data": [
    {
      "id": "zone-1",
      "name": "Downtown",
      "baseRate": 10.0,
      "perKmRate": 1.5,
      "minimumOrder": 5.0,
      "freeAbove": 50.0,
      "isActive": true,
      "priority": 10
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

**GET** `/api/checkout/zones/:zoneId`

Get zone details with rates.

**PATCH** `/api/checkout/zones/:zoneId/rates`

Update zone rates (admin only).

```json
{
  "baseRate": 12.0,
  "perKmRate": 1.75,
  "freeThreshold": 60.0
}
```

## Data Models

### Prisma Schema

All models are defined in `packages/db/prisma/schema/43-delivery-slots.prisma`:

- `DeliverySlot`: Time slots with capacity
- `SlotReservation`: Orders reserved for slots
- `CapacityConfig`: Daily capacity limits
- `BlackoutDate`: Unavailable dates
- `DeadlineConfig`: Deadline configuration
- `DeliveryZone`: Delivery zones with rates
- `LocationZoneLink`: Links locations to zones
- `SurgePrice`: Dynamic surge pricing

## Usage Examples

### Initialize Engines

```typescript
import { initializeSlotEngines } from "@witylogix/core/slots";

const engines = initializeSlotEngines(prisma);
const {
  slotEngine,
  capacityManager,
  zoneRateCalculator,
  deadlineEngine,
  blackoutManager,
} = engines;
```

### Get Available Slots

```typescript
const date = new Date("2026-04-01");
const slots = await slotEngine.getAvailableSlots(date, "zone-1", "loc-1");

// Filter to only morning slots
const morningSlots = slots.filter((s) => {
  const [hour] = s.startTime.split(":").map(Number);
  return hour < 12;
});
```

### Reserve a Slot

```typescript
const reservation = await slotEngine.reserveSlot("slot-1", "order-123", 30);

if (reservation.success) {
  console.log(`Reservation expires at ${reservation.expiresAt}`);
} else {
  console.log(`Failed: ${reservation.error}`);
}
```

### Calculate Delivery Rate

```typescript
const rate = await zoneRateCalculator.calculateRate({
  address: { zipcode: "10001" },
  cartValue: 100,
  weight: 3,
  origin: { latitude: 40.7128, longitude: -74.006 },
  destination: { latitude: 40.6782, longitude: -73.9442 },
});

console.log(`Delivery fee: $${rate.total}`);
```

### Set Deadline Configuration

```typescript
// Set 2-hour prep time and 8pm cut-off
await deadlineEngine.setPrepTime("loc-1", 120);
await deadlineEngine.setCutoffTime("loc-1", "20:00", 24);

// Check deadline
const deadline = await deadlineEngine.getOrderDeadline(
  new Date("2026-04-01"),
  "slot-1",
);
console.log(`Order must be placed by ${deadline.deadline}`);
```

### Manage Blackout Dates

```typescript
// Add holiday
await blackoutManager.addBlackout("loc-1", new Date("2026-12-25"), "Christmas");

// Add recurring Sunday closure
await blackoutManager.addRecurringBlackout("loc-1", 0, "Closed on Sundays");

// Check availability
const isAvailable = !(await blackoutManager.isBlackedOut(
  "loc-1",
  new Date("2026-04-05"),
));
```

### Adjust Capacity by Demand

```typescript
// Reduce capacity by 20% (0.8 factor)
await capacityManager.adjustCapacityByDemand("loc-1", date, 0.8);

// Increase capacity by 50% (1.5 factor)
await capacityManager.adjustCapacityByDemand("loc-1", date, 1.5);
```

## Error Handling

All errors extend `SlotEngineError`:

```typescript
try {
  await slotEngine.reserveSlot("invalid", "order-1");
} catch (error) {
  if (error instanceof SlotNotFoundError) {
    console.log("Slot does not exist");
  } else if (error instanceof SlotFullError) {
    console.log("Slot at full capacity");
  } else if (error instanceof BlackoutDateError) {
    console.log("Location is blacked out");
  } else if (error instanceof DeadlinePastError) {
    console.log("Order deadline has passed");
  }
}
```

## Testing

Comprehensive test suites included:

```bash
# Run slot engine tests
npm test -- slot-engine.test.ts

# Run rate calculator tests
npm test -- zone-rate-calculator.test.ts
```

## Performance Considerations

1. **Database Indexes**: All critical queries are indexed
2. **Atomic Transactions**: Prevents race conditions in reservations
3. **Lazy Loading**: Engines initialize on first use
4. **Caching**: Zone rates can be cached in Redis
5. **Batch Operations**: Bulk methods for efficiency
6. **Date Range Limits**: 90-day maximum for range queries

## Multi-Location Support

System supports 20+ independent locations:

```typescript
// Each location has independent config
await deadlineEngine.setPrepTime("loc-1", 120);
await deadlineEngine.setPrepTime("loc-2", 180);

// Check capacity by location
const report = await capacityManager.getCapacityUtilization("loc-1", date);
```

## AI Integration Hooks

- `CapacityManager.adjustCapacityByDemand()`: Integrates with demand forecasting models
- Demand factor parameter allows dynamic capacity adjustment based on ML predictions
- Recommendations generated based on utilization patterns

## Future Enhancements

- Real-time surge pricing
- Advanced demand forecasting integration
- Multi-language support
- GraphQL API
- WebSocket real-time updates
- Advanced analytics dashboard
