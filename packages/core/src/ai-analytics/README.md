# AI Analytics Module

Route Analytics ML for planned-vs-actual reporting. Provides efficiency scoring, driver performance analysis, delivery time prediction, anomaly detection, and CO2 emissions tracking.

## Components

### 1. Route Efficiency Scorer (`route-efficiency.ts`)

Calculates route efficiency scores (0-100) based on multiple factors:

- **Distance Efficiency**: Planned vs actual GPS distance
- **Time Efficiency**: Planned vs actual duration
- **Stop Efficiency**: Planned vs actual stop times
- **Idle Time Ratio**: Percentage of route time spent idle
- **Deviation Count**: GPS points deviating >500m from planned path

Includes percentile ranking against historical benchmarks.

```typescript
import { calculateRouteEfficiency } from '@witylogix/core/ai-analytics';

const efficiency = calculateRouteEfficiency(
  'route_123',
  {
    plannedDistance: 50000,
    plannedDuration: 120,
    plannedStops: [...],
  },
  gpsTrace, // Array of GPS points with lat, lng, timestamp, speedKmh
);

console.log(efficiency.score); // 0-100
console.log(efficiency.percentileRank); // 0-100 (vs historical)
console.log(efficiency.breakdown); // Component scores
```

**API:**

- `calculateRouteEfficiency(routeId, planned, gpsTrace, weights?)` - Single route
- `calculateRouteEfficiencyBatch(routes)` - Multiple routes with summary stats

### 2. Driver Performance Scorer (`driver-scorer.ts`)

Composite driver performance score based on:

- **On-time Delivery Rate** (30%) - % deliveries on time
- **Customer Rating Average** (20%) - 0-5 star rating
- **Route Efficiency Average** (20%) - Avg route efficiency score
- **Delivery Success Rate** (15%) - % first-attempt successful
- **Speed Compliance** (15%) - % time within speed limits

Includes trend analysis, peer comparison, and badge assignment.

```typescript
import { calculateDriverScore } from "@witylogix/core/ai-analytics";

const score = calculateDriverScore(
  {
    driverId: "driver_456",
    dateRange: { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now() },
    deliveries: {
      totalCount: 45,
      onTimeCount: 41,
      firstAttemptSuccessCount: 43,
    },
    ratings: { average: 4.6, count: 42 },
    routeEfficiency: { average: 87, count: 45 },
    speedCompliance: { percentWithinLimit: 92, averageExcessKmh: 3 },
    zoneId: "zone_1",
  },
  {}, // custom weights (optional)
  [78, 80, 82, 84, 85], // historical scores for trend
);

console.log(score.compositeScore); // 0-100
console.log(score.trendAnalysis.direction); // 'improving' | 'declining' | 'stable'
console.log(score.badges); // ['top_performer', 'most_improved', etc]
```

**Badges:**

- `top_performer` - Top 10% by score
- `most_improved` - Improving trend + above 50th percentile
- `consistent` - All metrics >80, stable trend
- `needs_coaching` - Score <50

**API:**

- `calculateDriverScore(metrics, weights?, historicalScores?)` - Single driver
- `calculateDriverScoreBatch(driverMetrics)` - Multiple drivers

### 3. Delivery Time Predictor (`delivery-predictor.ts`)

Ensemble of 3 models for predicting delivery arrival times:

1. **Historical Average Model** - Driver's historical speed for same zone/time
2. **Distance-Based Model** - Distance / avg speed adjusted for traffic
3. **Contextual Model** - Traffic, weather, time of day, stop complexity

Returns predictions with 80% and 95% confidence intervals.
Auto-calibrates by tracking prediction accuracy.

```typescript
import {
  predictDeliveryWindow,
  recordDelivery,
} from "@witylogix/core/ai-analytics";

const prediction = predictDeliveryWindow({
  orderId: "ord_789",
  distanceRemaining: 5000, // meters
  currentTrafficFactor: 1.2, // 1.0 = normal
  driverHistoricalSpeed: 40, // km/h
  timeOfDay: 14, // 0-23
  dayOfWeek: 3, // 0-6
  stopComplexity: "apartment",
  weather: { condition: "rain", temperature: 15 },
});

console.log(prediction.estimatedArrival); // Unix timestamp
console.log(prediction.confidence); // 0-100
console.log(prediction.confidenceRange.p80Lower); // 80% bound
console.log(prediction.confidenceRange.p95Upper); // 95% bound

// Record actual time for auto-calibration
recordDelivery(
  prediction.models.ensemble, // predicted minutes
  actualMinutes, // actual delivery time
  context,
);
```

**API:**

- `predictDeliveryWindow(context)` - Single delivery
- `predictDeliveryWindowBatch(contexts)` - Multiple deliveries
- `recordDelivery(predicted, actual, context)` - Calibration
- `getCalibrationInfo()` - Model accuracy metrics

### 4. Route Anomaly Detector (`anomaly-detector.ts`)

Detects 5 types of anomalies:

1. **Unusual Stop Duration** - >2σ from driver's average
2. **Route Deviation** - >1km from planned path for >5 min
3. **Speed Anomaly** - >20 km/h over limit or <5 km/h for >10 min
4. **Unexpected Stop** - >3 min at unplanned location
5. **Delivery Gap** - >30 min between consecutive stops

Classifies severity levels and identifies recurring patterns.

```typescript
import { detectAnomalies } from '@witylogix/core/ai-analytics';

const result = detectAnomalies(
  {
    routeId: 'route_123',
    stops: [...],
    gpsTrace: [...],
    driverHistoricalStopDurations: [4, 5, 5, 4, 5],
  },
  {
    stopDurationSigma: 2,
    routeDeviationMeters: 1000,
    deliveryGapMinutes: 30,
  }, // custom thresholds
);

console.log(result.anomalies); // Array of anomaly events
console.log(result.summary); // { totalCount, criticalCount, warningCount, infoCount }
console.log(result.patterns); // Recurring anomalies at same location/time
```

**Severity Levels:**

- `critical` - Severe operational issue
- `warning` - Notable deviation, needs attention
- `info` - Minor anomaly, informational only

**API:**

- `detectAnomalies(route, thresholds?, speedLimitKmh?)` - Single route
- `detectAnomaliesBatch(routes)` - Multiple routes

### 5. CO2 Calculator (`co2-calculator.ts`)

Calculates CO2 emissions for routes:

- **Vehicle Profiles**: Van (250g/km), Truck (350g/km), Bike (0g/km), EV (50g/km)
- **Terrain Adjustments**: City (+20%), Highway (-15%), Suburban (baseline)
- **Idling Factor**: 2.5-4.0 kg/hour depending on vehicle
- **Savings Calculator**: Compares optimized vs unoptimized routing

```typescript
import { calculateCO2, getCO2Summary } from "@witylogix/core/ai-analytics";

const report = calculateCO2(
  "route_123",
  45000, // distance in meters
  120, // duration in minutes
  15, // idle time in minutes
  "van",
  "suburban",
);

console.log(report.actualCO2); // kg
console.log(report.plannedCO2); // estimated if less optimized
console.log(report.savedCO2); // kg saved by optimization
console.log(report.efficiency); // g/km

// Get tenant-wide summary
const summary = getCO2Summary("tenant_1", "2026-03-01", "2026-03-31");
console.log(summary.totalActualCO2);
console.log(summary.averageSavingsPercent);
console.log(summary.vehicleBreakdown);
console.log(summary.trend); // Daily trend
```

**API:**

- `calculateCO2(routeId, distance, duration, idleTime, vehicleType?, terrain?)` - Single route
- `calculateCO2Batch(routes)` - Multiple routes
- `getCO2Summary(tenantId, startDate, endDate)` - Tenant summary
- `compareCO2(optimized, unoptimized, vehicleType)` - Compare two routes
- `recordCO2(tenantId, date, co2, saved)` - Record for trend tracking

## Usage Examples

### Complete Route Analysis

```typescript
import {
  calculateRouteEfficiency,
  detectAnomalies,
  calculateCO2,
  recordBenchmark,
} from "@witylogix/core/ai-analytics";

// Analyze a completed route
const route = fetchRoute("route_123");
const gpsTrace = fetchGPSTrace("route_123");

// Calculate efficiency
const efficiency = calculateRouteEfficiency(route.id, route.planned, gpsTrace);
recordBenchmark(efficiency.score);

// Detect anomalies
const anomalies = detectAnomalies({
  routeId: route.id,
  stops: route.stops,
  gpsTrace,
  driverHistoricalStopDurations: driverStats.stopDurations,
});

// Calculate emissions
const emissions = calculateCO2(
  route.id,
  efficiency.metrics.actualDistance,
  efficiency.metrics.actualDuration,
  efficiency.metrics.idleTime,
  route.vehicle.type,
  route.terrainType,
);

// Generate report
return {
  efficiency: {
    score: efficiency.score,
    percentile: efficiency.percentileRank,
    breakdown: efficiency.breakdown,
  },
  anomalies: {
    count: anomalies.summary.totalCount,
    critical: anomalies.summary.criticalCount,
    events: anomalies.anomalies,
  },
  emissions: {
    actual: emissions.actualCO2,
    saved: emissions.savedCO2,
    efficiency: emissions.efficiency,
  },
};
```

### Real-time Delivery Prediction

```typescript
import {
  predictDeliveryWindow,
  recordDelivery,
} from "@witylogix/core/ai-analytics";

// Get real-time traffic
const traffic = fetchCurrentTraffic();

// Predict next delivery
const prediction = predictDeliveryWindow({
  orderId: currentStop.orderId,
  distanceRemaining: currentStop.distanceToNext,
  currentTrafficFactor: traffic.factor,
  driverHistoricalSpeed: driver.avgSpeed,
  timeOfDay: new Date().getHours(),
  dayOfWeek: new Date().getDay(),
  stopComplexity: currentStop.complexity,
  weather: fetchWeather(),
});

// Send to customer
sendETAToCustomer({
  estimatedArrival: new Date(prediction.estimatedArrival),
  confidence: `${prediction.confidence}%`,
  window: {
    earliest: new Date(prediction.confidenceRange.p80Lower),
    latest: new Date(prediction.confidenceRange.p80Upper),
  },
});

// Later: record actual for model improvement
recordDelivery(prediction.models.ensemble, actualMinutes, prediction.context);
```

### Driver Leaderboard

```typescript
import { calculateDriverScoreBatch } from "@witylogix/core/ai-analytics";

// Get all drivers in zone
const drivers = fetchDrivers({ zoneId: "zone_1" });

const scores = calculateDriverScoreBatch(
  drivers.map((d) => ({
    metrics: {
      driverId: d.id,
      dateRange: { start: weekAgo, end: now },
      deliveries: d.weeklyMetrics.deliveries,
      ratings: d.weeklyMetrics.ratings,
      routeEfficiency: d.weeklyMetrics.efficiency,
      speedCompliance: d.weeklyMetrics.speedCompliance,
      zoneId: "zone_1",
    },
    historicalScores: d.scoreHistory.slice(-4), // Last 4 weeks
  })),
);

// Create leaderboard
const leaderboard = scores.scores
  .sort((a, b) => b.compositeScore - a.compositeScore)
  .map((s, idx) => ({
    rank: idx + 1,
    name: driverMap[s.driverId].name,
    score: s.compositeScore,
    trend: s.trendAnalysis.direction,
    badge: s.badges[0],
  }));
```

## API Routes

All routes require authentication and tenant context.

### GET `/api/ai/analytics/route-efficiency/:routeId`

Returns route efficiency score with breakdown.

**Response:**

```json
{
  "data": {
    "score": 87,
    "percentileRank": 75,
    "breakdown": {...},
    "metrics": {...}
  }
}
```

### GET `/api/ai/analytics/driver-score/:driverId`

Returns driver performance score with trends and badges.

**Response:**

```json
{
  "data": {
    "compositeScore": 85,
    "breakdown": {...},
    "trendAnalysis": {...},
    "peerComparison": {...},
    "badges": ["top_performer"]
  }
}
```

### POST `/api/ai/analytics/predict-delivery`

Predicts delivery arrival time.

**Request:**

```json
{
  "orderId": "ord_123",
  "distanceRemaining": 5000,
  "currentTrafficFactor": 1.2,
  "driverHistoricalSpeed": 40,
  "timeOfDay": 14,
  "dayOfWeek": 3,
  "stopComplexity": "apartment",
  "weather": { "condition": "rain", "temperature": 15 }
}
```

**Response:**

```json
{
  "data": {
    "estimatedArrival": 1715425200000,
    "confidence": 82,
    "confidenceRange": {
      "p80Lower": 1715425100000,
      "p80Upper": 1715425300000,
      "p95Lower": 1715425000000,
      "p95Upper": 1715425400000
    },
    "models": {...},
    "calibrationInfo": {...}
  }
}
```

### GET `/api/ai/analytics/anomalies/:routeId`

Detects anomalies on a route.

**Response:**

```json
{
  "data": {
    "routeId": "route_123",
    "anomalies": [
      {
        "type": "unusual_stop_duration",
        "severity": "warning",
        "timestamp": 1715420000000,
        "context": {...}
      }
    ],
    "summary": {
      "totalCount": 2,
      "criticalCount": 0,
      "warningCount": 2,
      "infoCount": 0
    }
  }
}
```

### GET `/api/ai/analytics/co2/:routeId`

Returns CO2 report for a route.

**Response:**

```json
{
  "data": {
    "routeId": "route_123",
    "actualCO2": 12.5,
    "plannedCO2": 14.8,
    "savedCO2": 2.3,
    "savingsPercent": 15,
    "efficiency": 278
  }
}
```

### GET `/api/ai/analytics/co2/summary/:tenantId`

Returns tenant-wide CO2 summary.

**Query Parameters:**

- `startDate` - ISO date string
- `endDate` - ISO date string

**Response:**

```json
{
  "data": {
    "totalActualCO2": 425,
    "totalPlannedCO2": 502,
    "totalSavedCO2": 77,
    "averageSavingsPercent": 15,
    "vehicleBreakdown": [...],
    "trend": [...]
  }
}
```

### GET `/api/ai/analytics/leaderboard`

Returns driver leaderboard.

**Query Parameters:**

- `period` - '24h' | '7d' | '30d' (default: '7d')
- `zoneId` - Zone filter (optional)

**Response:**

```json
{
  "data": {
    "period": "7d",
    "entries": [
      {
        "rank": 1,
        "driverId": "driver_456",
        "compositeScore": 92,
        "onTimePercent": 95,
        "badge": "top_performer",
        "trend": "improving"
      }
    ]
  }
}
```

## Testing

Run comprehensive test suites:

```bash
npm test -- route-efficiency.test.ts
npm test -- driver-scorer.test.ts
npm test -- delivery-predictor.test.ts
npm test -- anomaly-detector.test.ts
```

Test coverage includes:

- Component calculation accuracy
- Ensemble weighting and calibration
- Edge cases and boundary conditions
- Batch processing
- Statistical validity

## Performance Notes

- Route Efficiency: O(n) where n = GPS points
- Driver Scoring: O(1) calculation + O(n) peer comparison
- Delivery Prediction: O(1) ensemble + optional O(n) historical lookup
- Anomaly Detection: O(n) where n = stops + GPS points
- CO2 Calculation: O(1)

All models use lightweight statistics (mean, std dev, linear regression).
No external ML libraries required.

## Future Enhancements

- Machine learning model integration for demand forecasting
- Real-time model retraining with streaming data
- Advanced traffic pattern prediction
- Driver behavior clustering and segmentation
- Environmental impact optimization
