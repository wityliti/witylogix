# ADR-031: ML ETA Model v2 — GBDT Ensemble + Holt-Winters Slot Demand Forecasting

**Status**: Accepted  
**Date**: 2026-04-05  
**Authors**: Zara Rahman (AI/ML Engineer)  
**Decision Drivers**: ETA prediction accuracy, slot demand planning, competitive parity with Route4Me/Routific, open-source contribution viability

---

## Problem Statement

The original ETA system used a static formula based on distance and traffic multipliers, producing errors of ±35% on average. Competitive platforms (Routific, Route4Me, Fleetbase) offer AI-driven ETAs with <15% error rates. Additionally, slot demand was planned manually, leading to overselling during peak periods and under-utilization on quiet days.

Two gaps required addressing:

1. **ETA accuracy**: Need gradient-boosted decision trees trained on historical shipment data to capture nonlinear interactions between distance, traffic, time-of-day, weather, and driver experience.
2. **Slot demand forecasting**: Need time-series forecasting with weekly seasonality to predict slot utilization 1–7 days ahead so operators can proactively add/remove capacity.

---

## Decision

### 1. GBDT ETA Model (Sprint 4.6)

Implement a **pure TypeScript Gradient Boosted Decision Trees** model for ETA prediction with:

- **Algorithm**: Gradient boosting with regression trees, MSE loss
- **Hyperparameters**: 60 estimators, learning rate 0.1, max depth 4, row subsampling 80%
- **Features** (17 inputs): `distance_km`, `zone_type`, `hour`, `day_of_week`, `is_holiday`, `is_weekend`, `weather_condition`, `weather_intensity`, `traffic_condition`, `traffic_multiplier`, `historical_avg_minutes`, `driver_experience_score`, `vehicle_type`, `num_stops_remaining`, `temperature_celsius`, `wind_speed_kmh`, `precipitation_mm`
- **Integration**: Added to the existing 5-model ensemble (`EnsemblePredictor`) with 30% initial weight, boosted after training
- **No external dependencies**: Pure TypeScript for open-source contribution without ML library lock-in

### 2. Holt-Winters Slot Demand Forecasting (Sprint 4.6)

Implement **Holt-Winters Triple Exponential Smoothing** for weekly demand patterns:

- **Algorithm**: Additive Holt-Winters with multiplicative seasonality (m = 7 days)
- **Parameters**: α=0.3 (level), β=0.1 (trend), γ=0.4 (seasonality)
- **Integration**: `HoltWintersModel` class in `@witylogix/core/ai-slots`, consumed by `DemandPredictor`
- **Blending**: 60% Holt-Winters + 40% historical regression for hourly demand
- **Hourly distribution**: Forecast daily totals distributed via `DEFAULT_HOURLY_PROFILE` (peaks at morning 9-10 and evening 18-19)

### 3. Persistence

Two new Prisma models in schema `67-eta-logs.prisma`:

- **`EtaLog`**: Records each ETA prediction with feature inputs, output bounds, and actual delivery time for model accuracy tracking and retraining
- **`SlotDemandForecast`**: Stores Holt-Winters forecasts per (tenant, zone, date) for operator dashboards and retrospective accuracy analysis

---

## Architecture

```
EnsemblePredictor
├── TimeOfDayModel       (15% weight)
├── DistanceDecayModel   (15% weight)
├── HistoricalKNNModel   (20% weight)
├── TrafficModel         (15% weight)
├── WeatherModel         (10% weight)
└── GBDTModel            (25% weight, 30% post-training)
        ↓
    ETAPrediction
    {predicted_minutes, confidence, lower_bound, upper_bound, dominant_model}


DemandPredictor
├── HoltWintersModel     (60% contribution)  ← NEW
│   └── Weekly seasonality, level, trend
└── HistoricalRegression (40% contribution)
        ↓
    DemandForecast
    {predictedOrders, confidence, seasonalFactor, trend}
```

---

## Alternatives Considered

| Option                             | Why Rejected                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| TensorFlow.js GBDT                 | Adds 120MB dependency, not viable for self-hosted Docker images                   |
| Python microservice (scikit-learn) | Requires separate service, deployment complexity, latency overhead                |
| ONNX runtime                       | Binary model files can't be edited by community contributors                      |
| ARIMA for slot demand              | Doesn't capture weekly seasonality as cleanly as Holt-Winters; requires more data |
| Prophet                            | Node.js bindings are fragile; Python-only first-class support                     |

---

## Consequences

### Positive

- GBDT captures nonlinear feature interactions that the linear models miss (e.g., distance × traffic × time-of-day)
- Holt-Winters slots forecasting enables 7-day capacity planning with confidence intervals
- All ML code is pure TypeScript — community contributors can read, test, and modify without Python knowledge
- `EtaLog` table enables continuous model evaluation and drift detection
- Feature importance from GBDT surfaces actionable insights (e.g., "traffic is the #1 driver in urban-core zones during rush hour")

### Negative / Mitigations

- GBDT training is O(n × features × trees) — at 10K historical deliveries, training takes ~200ms on a modern CPU (acceptable for background jobs)
- Holt-Winters requires minimum 14 days of history — new tenants fall back to historical averages for the first two weeks
- In-memory model storage: ensemble predictors are per-tenant in-process; in production, models should be serialized to Redis/PostgreSQL for multi-instance deployments (tracked in `WIT-60`)

---

## Implementation

| Component                  | Location                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| GBDT model                 | `packages/core/src/ai-eta-v2/models/gbdt-model.ts`                                          |
| Ensemble integration       | `packages/core/src/ai-eta-v2/ensemble.ts`                                                   |
| Holt-Winters model         | `packages/core/src/ai-slots/holt-winters.ts`                                                |
| Demand predictor (updated) | `packages/core/src/ai-slots/demand-predictor.ts`                                            |
| Prisma schema              | `packages/db/prisma/schema/67-eta-logs.prisma`                                              |
| API routes                 | `apps/api/src/routes/ai/eta-v2.ts`, `apps/api/src/routes/ai/slots.ts`                       |
| Tests                      | `src/ai-eta-v2/__tests__/gbdt-model.test.ts`, `src/ai-slots/__tests__/holt-winters.test.ts` |

---

## Related

- [ADR-027: AI Demand Prediction](./ADR-027-ai-demand-prediction.md) — multi-model ensemble demand forecasting (Sprint 4.8-4.9)
- [ADR-026: Telematics Gateway](./ADR-026-telematics-gateway.md) — real-time GPS data that feeds traffic features
- [ADR-025: Route Analytics](./ADR-025-route-analytics.md) — planned vs actual data source for ETA training
