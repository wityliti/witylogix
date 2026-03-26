# AI Engine Integration Guide

Quick start guide for integrating the Smart Slot Recommendation and ML ETA Engine into your Witylogix platform.

---

## 1. Quick Start (5 minutes)

### Import the Modules

```typescript
// In your API or service file
import {
  slotRecommender,
  demandPredictor,
  driverAvailabilityPredictor,
  type TimeSlot,
  type DriverShift,
} from '@witylogix/core/ai-slots';

import {
  etaEngine,
  type HistoricalRoute,
  type TrafficZone,
} from '@witylogix/core/ai-eta';
```

### Get a Slot Recommendation

```typescript
// Minimal example - works immediately with no data
const recommendations = slotRecommender.recommendSlots({
  customerId: 'cust_123',
  zoneId: 'zone_456',
  date: new Date('2026-03-15'),
  maxSlots: 5,
});

console.log(recommendations[0]); // Top recommendation
```

### Predict an ETA

```typescript
// Minimal example - returns reasonable estimate
const prediction = etaEngine.predictETA({
  origin: { lat: 40.7128, lng: -74.006 },
  destination: { lat: 40.758, lng: -73.9855 },
  distanceKm: 5.5,
  departureTime: new Date(),
});

console.log(prediction.prediction.expected); // Estimated arrival time
```

---

## 2. Database Setup

### Create Required Tables (if not using existing)

You may already have these in your schema. If not, create them:

```sql
-- Time Slots Table
CREATE TABLE time_slots (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL,
  zone_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Driver Shifts Table
CREATE TABLE driver_shifts (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  date DATE NOT NULL,
  start_hour INT NOT NULL (0-23),
  end_hour INT NOT NULL (0-23),
  zone_id UUID NOT NULL,
  vehicle_type VARCHAR(50),
  package_capacity INT,
  no_show_history FLOAT DEFAULT 0.05,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Traffic Zones Table
CREATE TABLE traffic_zones (
  id UUID PRIMARY KEY,
  zone_id VARCHAR(100) PRIMARY KEY,
  zone_name VARCHAR(255),
  zone_type VARCHAR(20), -- 'urban', 'suburban', 'rural'
  center_lat FLOAT,
  center_lng FLOAT,
  ne_lat FLOAT, -- NE corner
  ne_lng FLOAT,
  sw_lat FLOAT, -- SW corner
  sw_lng FLOAT,
  average_speed INT,
  peak_hours INT[] -- [7, 8, 17, 18]
);

-- Historical Routes Table (for ETA training)
CREATE TABLE historical_routes (
  id UUID PRIMARY KEY,
  route_id VARCHAR(100),
  origin_lat FLOAT NOT NULL,
  origin_lng FLOAT NOT NULL,
  destination_lat FLOAT NOT NULL,
  destination_lng FLOAT NOT NULL,
  distance_km FLOAT NOT NULL,
  departure_time TIMESTAMP NOT NULL,
  estimated_arrival TIMESTAMP NOT NULL,
  actual_arrival TIMESTAMP NOT NULL,
  day_of_week INT (0-6),
  hour_of_day INT (0-23),
  traffic_condition VARCHAR(20), -- 'light', 'moderate', 'heavy'
  zone_type VARCHAR(20),
  driver_id UUID,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customer Preferences Table
CREATE TABLE customer_delivery_preferences (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  average_order_value DECIMAL(10, 2),
  preferred_hours INT[],
  preferred_days INT[],
  success_rate FLOAT DEFAULT 0.8,
  total_orders INT DEFAULT 0,
  last_order_date TIMESTAMP,
  average_delivery_duration INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Initialize Modules

### On Application Startup

```typescript
// In your main.ts or initialization file

import {
  slotRecommender,
  demandPredictor,
  driverAvailabilityPredictor,
} from '@witylogix/core/ai-slots';
import { etaEngine } from '@witylogix/core/ai-eta';
import { db } from '@witylogix/db'; // Your Prisma client

// Initialize Slot Recommender
async function initializeSlotRecommender() {
  try {
    // Load all time slots from database
    const slots = await db.timeSlot.findMany({
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        zoneId: true,
        isActive: true,
      },
    });

    const convertedSlots = slots.map((s) => ({
      id: s.id,
      name: s.name,
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
      zoneId: s.zoneId,
      isActive: s.isActive,
    }));

    slotRecommender.setAvailableSlots(convertedSlots);

    // Load driver shifts
    const shifts = await db.driverShift.findMany({
      select: {
        driverId: true,
        date: true,
        startHour: true,
        endHour: true,
        zoneId: true,
        vehicleType: true,
        packageCapacity: true,
        noShowHistory: true,
      },
    });

    slotRecommender.setDriverShifts(shifts);

    console.log('✅ Slot Recommender initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Slot Recommender:', error);
  }
}

// Initialize ETA Engine
async function initializeETAEngine() {
  try {
    // Load traffic zones
    const zones = await db.trafficZone.findMany({
      select: {
        zoneId: true,
        zoneName: true,
        zoneType: true,
        centerLat: true,
        centerLng: true,
        neLat: true,
        neLng: true,
        swLat: true,
        swLng: true,
        averageSpeed: true,
        peakHours: true,
      },
    });

    const convertedZones = zones.map((z) => ({
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      zoneType: z.zoneType as 'urban' | 'suburban' | 'rural',
      center: { lat: z.centerLat, lng: z.centerLng },
      boundingBox: {
        ne: { lat: z.neLat, lng: z.neLng },
        sw: { lat: z.swLat, lng: z.swLng },
      },
      averageSpeed: z.averageSpeed,
      peakHours: z.peakHours || [7, 8, 17, 18],
    }));

    etaEngine.registerTrafficZones(convertedZones);

    // Load historical routes for model training
    const routes = await db.historicalRoute.findMany({
      where: {
        success: true,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        routeId: true,
        originLat: true,
        originLng: true,
        destinationLat: true,
        destinationLng: true,
        distanceKm: true,
        departureTime: true,
        estimatedArrival: true,
        actualArrival: true,
        dayOfWeek: true,
        hourOfDay: true,
        trafficCondition: true,
        zoneType: true,
        driverId: true,
        success: true,
      },
    });

    const convertedRoutes = routes.map((r) => ({
      routeId: r.routeId,
      origin: { lat: r.originLat, lng: r.originLng },
      destination: { lat: r.destinationLat, lng: r.destinationLng },
      distanceKm: r.distanceKm,
      departureTime: new Date(r.departureTime),
      estimatedArrival: new Date(r.estimatedArrival),
      actualArrival: new Date(r.actualArrival),
      dayOfWeek: r.dayOfWeek,
      hourOfDay: r.hourOfDay,
      trafficCondition: r.trafficCondition as 'light' | 'moderate' | 'heavy',
      zoneType: r.zoneType as 'urban' | 'suburban' | 'rural',
      driverId: r.driverId,
      success: r.success,
    }));

    etaEngine.loadHistoricalData(convertedRoutes);

    console.log('✅ ETA Engine initialized');
  } catch (error) {
    console.error('❌ Failed to initialize ETA Engine:', error);
  }
}

// Call on startup
async function initializeAIEngines() {
  await initializeSlotRecommender();
  await initializeETAEngine();
}

// In your Fastify setup
fastify.addHook('onReady', initializeAIEngines);
```

---

## 4. Integrate with Order Flow

### When Customer Selects Delivery Date

```typescript
// In your order service or API route
export async function recommendDeliverySlots(customerId: string, zoneId: string, date: Date) {
  const recommendations = slotRecommender.recommendSlots({
    customerId,
    zoneId,
    date,
    maxSlots: 5,
  });

  // Return to frontend with recommendations
  return recommendations.map((r) => ({
    slotId: r.slotId,
    name: r.slotName,
    timeRange: `${r.startTime.toLocaleTimeString()} - ${r.endTime.toLocaleTimeString()}`,
    score: r.score,
    recommended: recommendations[0]?.slotId === r.slotId,
    reasoning: r.reasoning,
  }));
}
```

### When Creating a Delivery

```typescript
// In your order creation flow
export async function createDelivery(orderData: any) {
  // ... existing order creation logic ...

  // Predict ETA for this delivery
  const eta = etaEngine.predictETA({
    origin: warehouse.coordinates,
    destination: orderData.deliveryCoordinates,
    distanceKm: orderData.distanceKm,
    departureTime: estimatedPickupTime,
    zoneId: orderData.zoneId,
    orderId: order.id,
  });

  // Store ETA with order
  await db.order.update({
    where: { id: order.id },
    data: {
      estimatedArrival: eta.prediction.expected,
      estimationConfidence: eta.confidence,
      estimationModel: eta.modelUsed,
      metadata: {
        ...order.metadata,
        etaPrediction: {
          low: eta.prediction.low,
          expected: eta.prediction.expected,
          high: eta.prediction.high,
          confidence: eta.confidence,
        },
      },
    },
  });

  return { order, eta };
}
```

### When Delivery Completes

```typescript
// After delivery is marked as completed
export async function completeDelivery(orderId: string, actualTime: Date) {
  const order = await db.order.findUnique({ where: { id: orderId } });

  // Record actual delivery for model training
  const prediction = {
    orderId: order.id,
    prediction: {
      low: new Date(order.metadata.etaPrediction.low),
      expected: new Date(order.metadata.etaPrediction.expected),
      high: new Date(order.metadata.etaPrediction.high),
    },
    confidence: order.metadata.etaPrediction.confidence,
    modelsConsidered: JSON.parse(order.metadata.etaPrediction.models || '[]'),
  };

  // This feeds the models to improve future predictions
  etaEngine.recordActualDelivery(prediction, actualTime);

  // Update order
  await db.order.update({
    where: { id: orderId },
    data: {
      actualDelivery: actualTime,
      status: 'DELIVERED',
      estimationError: Math.abs(
        actualTime.getTime() - prediction.prediction.expected.getTime()
      ) / 60000, // Minutes
    },
  });
}
```

---

## 5. API Integration

### Register Routes in Fastify

```typescript
// In your main API setup
import aiSlotsRoutes from './routes/ai/slots';
import aiETARoutes from './routes/ai/eta';

export async function setupAPIRoutes(fastify: FastifyInstance) {
  // Register AI routes
  fastify.register(aiSlotsRoutes, { prefix: '/api/ai/slots' });
  fastify.register(aiETARoutes, { prefix: '/api/ai/eta' });

  // ... other routes ...
}
```

### Example: Frontend Integration

```typescript
// Frontend code to get slot recommendations
async function getSlotRecommendations(customerId: string, zoneId: string, date: string) {
  const response = await fetch(`/api/ai/slots/recommend`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      zoneId,
      date,
      maxSlots: 5,
    }),
  });

  const data = await response.json();
  return data.recommendations;
}

// Display recommendations to user
const slots = await getSlotRecommendations('cust_123', 'zone_456', '2026-03-15');
slots.forEach((slot) => {
  console.log(`${slot.slotName}: Score ${slot.score} - ${slot.reasoning}`);
});
```

---

## 6. Monitoring & Optimization

### Check Model Accuracy

```typescript
// Check current model performance
export async function getModelPerformance() {
  const accuracies = etaEngine.getModelAccuracy();
  const stats = etaEngine.getStatistics();

  console.log('Model Performance:');
  accuracies.forEach((acc) => {
    console.log(`${acc.modelName}:`);
    console.log(`  MAE: ${acc.meanAbsoluteError.toFixed(2)} minutes`);
    console.log(`  RMSE: ${acc.rootMeanSquareError.toFixed(2)} minutes`);
    console.log(`  Accuracy: ${(acc.accuracy * 100).toFixed(2)}%`);
  });

  console.log('\nEngine Stats:');
  console.log(`Average Accuracy: ${(stats.averageAccuracy * 100).toFixed(2)}%`);
  console.log(`Predictions Recorded: ${stats.predictionsRecorded}`);
}
```

### Monitor via API

```bash
# Check engine health
curl http://localhost:3000/api/ai/eta/health

# Get accuracy metrics
curl http://localhost:3000/api/ai/eta/accuracy

# Get statistics
curl http://localhost:3000/api/ai/eta/statistics
```

### Adjust Model Weights (if needed)

```typescript
// If one model is significantly more accurate, increase its weight
etaEngine.setModelWeight('HistoricalModel', 0.35); // Increase from 0.25
etaEngine.setModelWeight('TimeOfDayModel', 0.20); // Decrease from 0.25
```

---

## 7. Data Collection Best Practices

### To Improve Models Over Time:

1. **Record All Deliveries**
   ```typescript
   await recordActualDelivery(prediction, actualArrivalTime);
   ```

2. **Maintain Historical Data**
   - Keep at least 2-4 weeks of data
   - Archive old data after 1 year

3. **Monitor Data Quality**
   - Check for missing values
   - Validate coordinates
   - Ensure timestamps are accurate

4. **Regular Retraining**
   - Models auto-improve as data is added
   - Check accuracy every week
   - Adjust weights if trends change

---

## 8. Troubleshooting

### Slot Recommendations Are Generic

**Issue**: All slots have similar scores
**Solution**: Add historical delivery data to models

```typescript
// Feed the models actual delivery data
const historicalData = [
  {
    orderId: 'order_1',
    customerId: 'cust_123',
    zoneId: 'zone_456',
    slotStartTime: new Date('2026-03-10T09:00:00'),
    slotEndTime: new Date('2026-03-10T12:00:00'),
    orderPlacedAt: new Date('2026-03-08T14:30:00'),
    actualDeliveryTime: new Date('2026-03-10T10:15:00'),
    estimatedDeliveryTime: new Date('2026-03-10T10:30:00'),
    dayOfWeek: 2,
    hourOfDay: 10,
    distanceKm: 5.2,
    weight: 2.5,
    items: 3,
    driverId: 'driver_1',
    success: true,
  },
  // ... more routes
];

slotRecommender.updateDemandData(historicalData);
```

### ETA Predictions Are Inaccurate

**Issue**: Predictions consistently off by X minutes
**Solution**: Load more historical route data

```typescript
// Load at least 100+ historical routes
const routes = await db.historicalRoute.findMany({
  where: { success: true },
  take: 500, // Start with recent deliveries
});

etaEngine.loadHistoricalData(routes);
```

### High Estimation Errors

**Issue**: Actual delivery time is often far from predicted
**Solutions**:
1. Check data quality (valid coordinates, times)
2. Ensure traffic data is being updated
3. Verify zone type classifications
4. Check for edge cases (very short/long distances)

---

## 9. Performance Tips

### For High-Volume Deployments (1000+ deliveries/day)

```typescript
// 1. Cache predictions for same origin-destination pairs
const predictionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedETA(key: string) {
  const cached = predictionCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.prediction;
  }
  return null;
}

// 2. Use batch processing
const predictions = etaEngine.predictBatch({
  deliveries: orderBatch.map((o) => ({
    orderId: o.id,
    origin: warehouse.coordinates,
    destination: o.deliveryCoordinates,
    distanceKm: o.distance,
    departureTime: o.estimatedPickup,
  })),
});

// 3. Asynchronously record actual times
async function recordDeliveriesAsync(deliveries: any[]) {
  for (const delivery of deliveries) {
    // Non-blocking - doesn't wait for response
    etaEngine.recordActualDelivery(
      delivery.prediction,
      delivery.actualTime
    );
  }
}
```

---

## 10. Quick Reference

### Slot Recommender
```typescript
// Single recommendation
const top = slotRecommender.getTopRecommendation({
  customerId, zoneId, date
});

// Multiple recommendations
const slots = slotRecommender.recommendSlots({
  customerId, zoneId, date, maxSlots: 5
});

// Demand forecast
const forecast = demandPredictor.predictDemand(zoneId, date, hour);
const dayForecasts = demandPredictor.predictDemandBatch(zoneId, date);

// Driver availability
const availability = driverAvailabilityPredictor.predictAvailability(date, hour);
const dayAvailability = driverAvailabilityPredictor.predictDayAvailability(date);
```

### ETA Engine
```typescript
// Single prediction
const eta = etaEngine.predictETA({
  origin, destination, distanceKm, departureTime
});

// Batch predictions
const batch = etaEngine.predictBatch({ deliveries });

// Record actual delivery
etaEngine.recordActualDelivery(prediction, actualTime);

// Model performance
const accuracies = etaEngine.getModelAccuracy();
const stats = etaEngine.getStatistics();

// Configuration
etaEngine.setModelWeight('ModelName', 0.3);
etaEngine.setModelEnabled('ModelName', true);
```

---

## Summary

Your AI engines are now integrated! Next:

1. ✅ Initialize modules on startup
2. ✅ Integrate with order flow
3. ✅ Register API routes
4. ✅ Start collecting delivery data
5. ✅ Monitor model accuracy
6. ✅ Optimize as data accumulates

Models will automatically improve as more deliveries are recorded. Good luck! 🚀
