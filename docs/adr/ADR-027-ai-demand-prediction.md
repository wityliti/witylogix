# ADR-027: AI Demand Prediction Architecture

**Status**: Proposed
**Date**: 2026-03-11
**Authors**: Arjun (CTO)
**Decision Drivers**: Delivery volume forecasting, dynamic slot capacity, driver allocation optimization, SLA compliance
**Context**: Witylogix must forecast delivery demand by zone, time, and day to optimize slot capacity, schedule drivers proactively, and maintain SLA compliance during demand spikes.

## Problem Statement

Current platform lacks predictive capabilities:
- Static delivery slots cannot adapt to demand fluctuations
- Driver allocation decided day-of without forecasting
- No visibility into peak demand periods for capacity planning
- Unable to prevent overselling or underutilization
- SLA breaches due to unexpected demand spikes
- Customer frustration from unavailable time slots during peak hours

We need an intelligent system that forecasts delivery volume using historical patterns, zone characteristics, and external events to enable:
- Automatic slot capacity adjustment
- Proactive driver scheduling
- Demand spike prediction (e.g., weekend, promotional days)
- Anomaly detection for suspicious patterns
- Confidence intervals for forecast uncertainty

## Decision

Implement a **multi-model ensemble demand prediction system** with:

1. **Time-series decomposition** — Extract seasonal, trend, and residual components
2. **Zone clustering** — Group similar zones for pattern sharing
3. **Temporal feature engineering** — Capture day-of-week, hour, holiday, promotional effects
4. **Ensemble predictions** — Combine seasonal decomposition, zone-weighted regression, and day-of-week patterns
5. **Capacity recommendations** — Auto-adjust slot availability based on forecasts
6. **Anomaly detection** — Flag unusual demand patterns for investigation

## Architecture

### 1. Data Pipeline

```
Historical Delivery Aggregation
         ↓
Raw data: (zone_id, timestamp, delivery_count)
         ↓
Feature Extraction
         ↓
Zone features (density, business count, historical volume)
Temporal features (day_of_week, hour, season, is_holiday)
Event features (promotions, weather)
         ↓
Feature Store (Prisma FeatureSnapshot)
         ↓
Model Training (hourly batch job)
         ↓
Prediction Serving (GET /demand-prediction endpoints)
         ↓
Capacity Recommendation Engine
         ↓
Auto-adjust slot capacity + Driver allocation suggestions
```

### 2. Feature Store Design

**Zone-Level Features:**
```typescript
interface ZoneDemandFeatures {
  zoneId: string;
  populationDensity: number;      // people per sq km
  businessDensity: number;         // businesses per sq km
  historicalAvgVolume: number;     // avg deliveries per day
  historicalPeakVolume: number;    // 95th percentile
  competitorPresence: number;      // count of competitors in zone
  avgDeliveryDistance: number;     // km (affects time slots)
  residentialRatio: number;        // 0-1, proportion of residential
  commercialRatio: number;         // 0-1, proportion of commercial
}
```

**Temporal Features:**
```typescript
interface TemporalFeatures {
  hour: number;                    // 0-23
  dayOfWeek: number;               // 0-6 (0=Sunday)
  dayOfMonth: number;              // 1-31
  weekOfYear: number;              // 1-52
  isHoliday: boolean;              // public holidays
  seasonalIndex: number;           // 0-3 (Q1-Q4)
  isWeekend: boolean;
  isMonday: boolean;               // special handling for Mondays
  isFriday: boolean;               // special handling for Fridays
  daysUntilHoliday: number;        // anticipation effect
}
```

**Event Features:**
```typescript
interface EventFeatures {
  hasPromotion: boolean;           // active marketing campaign
  promotionIntensity: number;      // 0-10 scale
  weatherCondition: 'clear' | 'rain' | 'snow' | 'fog';
  temperatureC: number;
  majorEventNearby: boolean;       // concert, sports, etc.
  lastMileApiDown: boolean;        // external service outages
}
```

### 3. Model Architecture

**Ensemble Approach (Best of Breed):**

#### 3.1 Seasonal Decomposition Model
Decomposes historical series into additive components:
```
demand(t) = trend(t) + seasonal(t) + residual(t)
```

- **Trend**: 30-day moving average (captures growth/decline)
- **Seasonal**: Historical average for same hour/day-of-week
- **Residual**: Recent deviation from pattern

Used for: Smooth forecasts, handling strong repeating patterns

#### 3.2 Zone-Weighted Regression
Learns feature → demand mapping per zone:
```
demand = β₀ + β₁×hour + β₂×dayOfWeek + β₃×isHoliday
       + β₄×promotion + β₅×temperature + β₆×competitorCount
```

- Per-zone coefficients capture zone personality
- Regularization prevents overfitting
- Handles external features (weather, events)

Used for: Feature-driven predictions, external variable incorporation

#### 3.3 Day-of-Week Patterns
Simple but effective for weekly periodicity:
```
forecast = historical_avg(hour, day_of_week) × trend_multiplier
```

- Historical average for exact (hour, day_of_week) pair
- Trend multiplier: 30-day moving avg / 365-day moving avg
- Very accurate for short-term (1-7 day horizon)

Used for: Baseline predictions, handling strong weekly patterns

**Ensemble Voting:**
```typescript
forecast = 0.4 × seasonalModel + 0.3 × regressionModel + 0.3 × dayOfWeekModel

// With optional weather & event adjustments
if (eventFeatures.hasPromotion) {
  forecast *= (1 + promotionIntensity * 0.15);
}
if (eventFeatures.weatherCondition === 'rain') {
  forecast *= 1.1; // rain increases delivery demand
}
```

### 4. Prisma Data Models

```prisma
// Zone demand profiles
model ZoneProfile {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId         String   @map("org_id") @db.Uuid
  zoneId        String   @map("zone_id") @db.Uuid

  // Demographics
  populationDensity     Float
  businessDensity       Float
  residentialRatio      Float
  commercialRatio       Float

  // Historical performance
  historicalAvgVolume   Float   // avg deliveries/day
  historicalPeakVolume  Float   // 95th percentile
  avgDeliveryDistance   Float   // km
  competitorPresence    Int

  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  zone         DeliveryZone @relation(fields: [zoneId], references: [id])
  forecasts    DemandForecast[]

  @@unique([orgId, zoneId])
  @@index([orgId])
  @@map("zone_profiles")
}

// Snapshot of features at training time
model FeatureSnapshot {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  zoneId        String   @map("zone_id") @db.Uuid
  timestamp     DateTime

  // Zone features
  populationDensity     Float
  businessDensity       Float
  historicalAvgVolume   Float

  // Temporal features
  hour          Int
  dayOfWeek     Int
  seasonalIndex Int
  isHoliday     Boolean

  // Event features
  hasPromotion  Boolean
  promotionIntensity Float
  weatherCondition String
  temperature   Float

  // Actual observed volume (for training)
  observedVolume Float?

  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([zoneId, timestamp])
  @@index([timestamp])
  @@map("feature_snapshots")
}

// Demand forecast results
model DemandForecast {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  zoneProfileId String   @map("zone_profile_id") @db.Uuid

  forecastTime  DateTime @map("forecast_time") // when forecast is for
  generatedAt   DateTime @default(now()) @map("generated_at") // when generated

  // Forecast values
  predictedVolume      Float
  confidenceLower      Float   // 80% confidence interval lower bound
  confidenceUpper      Float   // 80% confidence interval upper bound
  confidence           Float   // 0-1 confidence score

  // Model breakdown
  seasonalComponent    Float
  regressionComponent  Float
  dayOfWeekComponent   Float

  // Actual result (populated after forecast time passes)
  actualVolume         Float?
  accuracy             Float?  // |predicted - actual| / predicted

  granularity          String  // 'hourly', 'daily', 'weekly'
  modelVersion         Int     // for tracking model changes

  createdAt    DateTime  @default(now()) @map("created_at")

  zoneProfile  ZoneProfile @relation(fields: [zoneProfileId], references: [id], onDelete: Cascade)

  @@index([zoneProfileId, forecastTime])
  @@index([generatedAt])
  @@map("demand_forecasts")
}

// User-initiated prediction requests
model PredictionRequest {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId         String   @map("org_id") @db.Uuid
  userId        String   @map("user_id") @db.Uuid

  // Request parameters
  zoneId        String   @map("zone_id") @db.Uuid
  forecastDate  DateTime @map("forecast_date") // what date to forecast for
  granularity   String   // 'hourly', 'daily', 'weekly'

  // Response
  prediction    Json     @default("{}")
  metadata      Json     @default("{}")

  status        String   @default("completed") // pending, completed, failed
  errorMessage  String?

  createdAt    DateTime  @default(now()) @map("created_at")
  completedAt  DateTime?

  @@index([orgId, zoneId])
  @@index([createdAt])
  @@map("prediction_requests")
}

// Capacity recommendations based on forecasts
model CapacityRecommendation {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  zoneId        String   @map("zone_id") @db.Uuid
  slotDate      DateTime @map("slot_date") // which day

  // Time slot recommendations
  recommendations Json // array of { hour, recommendedCapacity, currentCapacity, confidence }

  // Driver allocation
  recommendedDriverCount Int
  rationale      String? // explanation of recommendation

  // Status tracking
  applied        Boolean  @default(false)
  appliedAt      DateTime?
  appliedBy      String?  // user ID

  createdAt    DateTime  @default(now()) @map("created_at")

  @@unique([zoneId, slotDate])
  @@index([zoneId])
  @@map("capacity_recommendations")
}

// Anomaly detection results
model DemandAnomaly {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  zoneId        String   @map("zone_id") @db.Uuid
  timestamp     DateTime

  // Anomaly details
  anomalyType   String   // 'spike', 'drop', 'trend_shift', 'seasonal_break'
  severity      Float    // 0-1, how anomalous
  observedVolume Float
  expectedVolume Float
  deviation      Float   // (observed - expected) / expected

  // Context
  likelyReason  String?  // 'major_event', 'weather', 'outage', 'competitor_promo', 'unknown'
  description   String?

  // Investigation status
  investigated  Boolean  @default(false)
  investigatedAt DateTime?
  investigatedBy String?

  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([zoneId, timestamp])
  @@index([severity])
  @@map("demand_anomalies")
}
```

### 5. API Design

**Endpoints Overview:**

```
GET /demand-prediction/forecast
  Query: zoneId, date (YYYY-MM-DD), granularity (hourly|daily|weekly)
  Returns: ForecastResponse with predictions, intervals, anomalies

GET /demand-prediction/forecast/hourly
  Query: zoneId, date
  Returns: Hourly breakdown with 0-24 hour predictions

GET /demand-prediction/capacity-recommendations
  Query: zoneId, startDate, endDate
  Returns: Array of CapacityRecommendation with applied status

POST /demand-prediction/capacity-recommendations/:id/apply
  Body: { appliedBy: userId }
  Action: Mark recommendation as applied, update slot capacities

GET /demand-prediction/anomalies
  Query: zoneId, limit (default 50), severity (min)
  Returns: Recent detected anomalies

GET /demand-prediction/model-performance
  Query: zoneId, timeRange (days)
  Returns: Model accuracy metrics, precision/recall by day

POST /demand-prediction/manual-request
  Body: { zoneId, forecastDate, granularity }
  Action: Trigger on-demand forecast generation
  Returns: PredictionRequest with polling endpoint
```

### 6. Smart Scheduling Implementation

**Automatic Slot Capacity Adjustment:**

```typescript
async function adjustSlotCapacity(zoneId: string, slotDate: Date) {
  // 1. Get demand forecast for zone on that date
  const forecasts = await db.demandForecast.findMany({
    where: {
      zoneProfile: { zoneId },
      forecastTime: { gte: startOfDay(slotDate), lt: endOfDay(slotDate) },
    },
  });

  // 2. For each hour, calculate recommended capacity
  const recommendations = [];
  for (let hour = 0; hour < 24; hour++) {
    const forecast = forecasts.find(f => getHour(f.forecastTime) === hour);
    if (!forecast) continue;

    // 3. Convert predicted volume to slot capacity
    // Capacity = predicted_volume × safety_factor / avg_deliveries_per_slot
    const safetyFactor = 1.2; // 20% buffer for uncertainty
    const deliveriesPerSlot = 3; // avg deliveries per time slot

    const recommended = Math.ceil(
      (forecast.predictedVolume * safetyFactor) / deliveriesPerSlot
    );

    recommendations.push({
      hour,
      predictedVolume: forecast.predictedVolume,
      confidence: forecast.confidence,
      recommendedCapacity: recommended,
      confidenceLower: forecast.confidenceLower,
      confidenceUpper: forecast.confidenceUpper,
    });
  }

  // 4. Create capacity recommendation record
  const recommendation = await db.capacityRecommendation.upsert({
    where: { zoneId_slotDate: { zoneId, slotDate } },
    create: {
      zoneId,
      slotDate,
      recommendations: JSON.stringify(recommendations),
      recommendedDriverCount: calculateOptimalDriverCount(recommendations),
    },
    update: {
      recommendations: JSON.stringify(recommendations),
      recommendedDriverCount: calculateOptimalDriverCount(recommendations),
    },
  });

  return recommendation;
}
```

**Driver Allocation Suggestion:**

```typescript
function calculateOptimalDriverCount(hourlyRecommendations: any[]): number {
  // Find peak hour demand
  const peakHour = hourlyRecommendations.reduce((max, curr) =>
    curr.recommendedCapacity > max.recommendedCapacity ? curr : max
  );

  // Estimate drivers needed (1 driver can handle ~5 deliveries in peak period)
  const deliveriesPerDriver = 5;
  const driversForPeak = Math.ceil(peakHour.recommendedCapacity / deliveriesPerDriver);

  // Add 20% reserve for contingencies
  return Math.ceil(driversForPeak * 1.2);
}
```

### 7. Anomaly Detection Algorithm

Flags suspicious demand patterns:

```typescript
async function detectAnomalies(zoneId: string, forecastTime: Date) {
  const forecast = await db.demandForecast.findFirst({
    where: { zoneProfile: { zoneId }, forecastTime },
  });

  if (!forecast || !forecast.actualVolume) return null;

  const deviation = (forecast.actualVolume - forecast.predictedVolume) / forecast.predictedVolume;
  const absDeviation = Math.abs(deviation);

  // Spike: >50% above prediction
  if (deviation > 0.5 && absDeviation > 2) {
    return {
      anomalyType: 'spike',
      severity: Math.min(absDeviation / 5, 1),
      likelyReason: await inferAnomalyReason(zoneId, forecastTime, deviation),
    };
  }

  // Drop: >30% below prediction
  if (deviation < -0.3 && absDeviation > 1.5) {
    return {
      anomalyType: 'drop',
      severity: Math.min(absDeviation / 3, 1),
      likelyReason: await inferAnomalyReason(zoneId, forecastTime, deviation),
    };
  }

  // Seasonal break: different pattern than historical
  if (await isSeasonalBreak(zoneId, forecastTime, forecast)) {
    return {
      anomalyType: 'seasonal_break',
      severity: 0.7,
      likelyReason: 'holiday_shift_or_promotional_event',
    };
  }

  return null;
}
```

## Testing Strategy

1. **Unit Tests** — Feature engineering calculations, ensemble voting logic
2. **Integration Tests** — End-to-end forecast generation, recommendation creation
3. **Performance Tests** — Forecast latency (target: <500ms), batch job efficiency
4. **Validation Tests** — Compare forecasts against baseline models (persistence, moving average)
5. **Accuracy Metrics** — MAE, RMSE, MAPE tracking over time

## Monitoring & Observability

- **Forecast Accuracy Dashboard** — Daily MAPE by zone
- **Anomaly Alert Rate** — Monitor for anomaly detector false positives
- **Recommendation Application Rate** — Track human usage of auto-recommendations
- **Model Retraining Frequency** — Hourly batch jobs complete successfully
- **API Response Latency** — Forecast endpoint <500ms, capacity recommendations <200ms

## Rollout Plan

**Phase 1 (Sprint 4.8):**
- ADR-027 + core types
- Zone profile feature store
- Seasonal decomposition + day-of-week models
- Basic demand forecast API

**Phase 2 (Sprint 4.9):**
- Zone-weighted regression model
- Ensemble voting integration
- Capacity recommendation engine
- Dashboard visualization

**Phase 3 (Sprint 5.0):**
- Anomaly detection system
- Platform health dashboard
- Auto-apply capacity recommendations (with manual override)
- Advanced analytics (model performance, drill-down)

## Rationale

**Why ensemble approach?**
- No single model dominates all scenarios; ensemble reduces systematic bias
- Seasonal + regression + day-of-week captures different aspects of demand
- Weighted voting allows easy model updates without retraining

**Why zone clustering?**
- Enables transfer learning; zones with similar profiles share patterns
- Reduces cold-start problem for new zones
- Improves prediction for low-volume zones

**Why confidence intervals?**
- Uncertainty quantification helps with risk-aware capacity planning
- High uncertainty → conservative recommendation (more drivers/capacity)
- Low uncertainty → aggressive optimization possible

**Why Prisma models?**
- Feature snapshots create audit trail for model debugging
- Forecasts enable backtest/accuracy tracking
- Recommendation records track adoption and ROI

## Open Questions

1. Should external features (weather, competitor activity) be ingested real-time or batch?
   - **Decision**: Batch daily; real-time too expensive at scale

2. How to handle edge cases (new zones, brand new merchants)?
   - **Decision**: Use regional aggregate until sufficient zone-level history (30 days)

3. What's the retraining frequency? Daily, weekly, hourly?
   - **Decision**: Hourly for active zones (>10 forecasts/day); weekly for quiet zones

4. How to incorporate real-time demand signals (API traffic spikes)?
   - **Decision**: Phase 2 feature; today use historical + features only

## Alternatives Considered

1. **Single time-series model (ARIMA)** — Simpler but less accurate with external features
2. **Deep learning (LSTM/Transformer)** — Better accuracy but hard to debug, needs more data
3. **Manual capacity planning** — Current state; doesn't scale, SLA breaches frequent
4. **Third-party SaaS (Demand.io, Lokad)** — Expensive, vendor lock-in, privacy concerns

## References

- Witylogix analytics.ts, ai-eta-v2, ai-slots modules
- Route planning benchmarks: Routific, Route4Me demand handling
- Time-series best practices: seasonal decomposition, ensemble methods
- Industry: Uber/Lyft dynamic capacity, Instacart batch processing
