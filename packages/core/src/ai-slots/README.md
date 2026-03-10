# AI Slot Recommendation Module

ML-powered delivery slot recommendation system that intelligently ranks available delivery slots based on multiple factors including demand prediction, driver availability, customer preferences, zone congestion, and weather impact.

## Features

- **Smart Slot Ranking**: Composite scoring algorithm combining 5 key factors
- **Demand Prediction**: Historical pattern analysis with seasonal factors
- **Driver Availability Forecasting**: Shift-based availability with no-show rates
- **Customer Preference Learning**: Historical order patterns and preferences
- **Zone Congestion Analysis**: Real-time and historical congestion data
- **Weather Impact Modeling**: Delivery delay factors by weather condition

## Architecture

### Core Components

1. **DemandPredictor** (`demand-predictor.ts`)
   - Predicts order volume by hour for zones
   - Uses historical patterns, seasonal factors, and trend analysis
   - Simple linear regression for trend detection
   - Day-of-week and hourly patterns

2. **DriverAvailabilityPredictor** (`driver-availability.ts`)
   - Forecasts available drivers by time and zone
   - Accounts for scheduled shifts and no-show history
   - Calculates optimal driver counts for demand
   - Zone-based distribution analysis

3. **SlotRecommender** (`slot-recommender.ts`)
   - Main orchestrator combining all factors
   - Weighted scoring algorithm (demand: 25%, drivers: 25%, preference: 20%, congestion: 15%, weather: 15%)
   - Returns top N recommended slots with reasoning
   - Confidence scores for each recommendation

## Usage

### Basic Recommendation

```typescript
import { slotRecommender } from '@witylogix/core/ai-slots';

// Get top 5 recommended slots for a customer
const slots = slotRecommender.recommendSlots({
  customerId: 'cust_123',
  zoneId: 'zone_456',
  date: new Date('2026-03-15'),
  maxSlots: 5,
});

console.log(slots[0]); // Top recommendation
// {
//   slotId: 'slot_1',
//   slotName: '09:00 - 12:00',
//   score: 85,
//   reasoning: '09:00 - 12:00: Low demand, Available drivers, Good weather',
//   driverAvailability: 0.9,
//   congestionRisk: 0.2,
//   weatherImpact: 0,
//   customerPreferenceMatch: 0.75
// }
```

### Demand Forecasting

```typescript
import { demandPredictor } from '@witylogix/core/ai-slots';

// Get demand forecast for a specific hour
const forecast = demandPredictor.predictDemand('zone_456', new Date(), 10);
console.log(`Predicted orders at 10 AM: ${forecast.predictedOrders}`);
console.log(`Confidence: ${(forecast.confidence * 100).toFixed(0)}%`);
console.log(`Trend: ${forecast.trend}`); // 'increasing', 'stable', 'decreasing'

// Get full day forecast
const dayForecasts = demandPredictor.predictDemandBatch('zone_456', new Date());
```

### Driver Availability

```typescript
import { driverAvailabilityPredictor } from '@witylogix/core/ai-slots';

// Set up driver shifts
const shifts = [
  {
    driverId: 'driver_1',
    date: new Date(),
    startHour: 9,
    endHour: 17,
    zoneId: 'zone_456',
    vehicleType: 'car',
    packageCapacity: 35,
    noShowHistory: 0.05,
  },
  // ... more shifts
];

driverAvailabilityPredictor.addShifts(shifts);

// Predict availability for a specific time
const forecast = driverAvailabilityPredictor.predictAvailability(
  new Date(),
  10, // 10 AM
);
console.log(`Available drivers: ${forecast.expectedAvailableDrivers}`);
```

### Customer Preferences

```typescript
const preference = {
  customerId: 'cust_123',
  averageDeliveryValue: 75.50,
  preferredHours: [9, 10, 18, 19], // Morning and evening
  preferredDays: [1, 2, 3, 4, 5], // Weekdays
  successRate: 0.95,
  totalOrders: 120,
  lastOrderDate: new Date('2026-03-10'),
  averageDeliveryDuration: 25,
};

slotRecommender.setCustomerPreference(preference);
```

## ML Models

### Demand Prediction Model

Uses historical delivery data to predict order volume:

1. **Base Pattern**: Historical average orders per hour
2. **Seasonal Factor**: Holiday/event multipliers
   - Holiday: 1.3x
   - Eve of Holiday: 1.2x
   - Post-Holiday: 0.85x
   - Weekend: 1.15x
   - Weekday: 1.0x

3. **Trend Analysis**: Linear regression on last 30 days
   - Detects increasing/decreasing patterns
   - Capped at ±10% impact

4. **Peak Hour Detection**: Hours with 30%+ above average demand

### Scoring Algorithm

Each slot gets a composite score (0-100):

```
score = (
  demandScore * 0.25 +        // Lower is better (fast delivery)
  driverScore * 0.25 +         // Higher is better (availability)
  preferenceScore * 0.20 +     // How well it matches customer
  congestionScore * 0.15 +     // Light is better
  weatherScore * 0.15          // Good weather is better
) * 100
```

**Confidence Intervals**: Based on historical data volume and model variance

## Data Requirements

### Historical Delivery Data

```typescript
interface HistoricalDeliveryData {
  orderId: string;
  customerId: string;
  zoneId: string;
  slotStartTime: Date;
  slotEndTime: Date;
  orderPlacedAt: Date;
  actualDeliveryTime: Date;
  estimatedDeliveryTime: Date;
  dayOfWeek: number;
  hourOfDay: number;
  distanceKm: number;
  weight: number;
  items: number;
  driverId: string;
  weatherCondition?: string;
  trafficLevel?: 'light' | 'moderate' | 'heavy';
  success: boolean;
}
```

## API Endpoints

### GET /api/ai/slots/recommend

Recommend delivery slots for a customer.

**Query Parameters:**
- `customerId` (uuid, required): Customer ID
- `zoneId` (uuid, required): Delivery zone
- `date` (ISO datetime, required): Delivery date
- `maxSlots` (number, default 5): Number of recommendations

**Response:**
```json
{
  "recommendations": [
    {
      "slotId": "slot_1",
      "slotName": "09:00 - 12:00",
      "score": 85,
      "reasoning": "09:00 - 12:00: Low demand, Available drivers",
      "demandForecast": {...},
      "driverAvailability": 0.9,
      "congestionRisk": 0.2,
      "weatherImpact": 0,
      "customerPreferenceMatch": 0.75
    }
  ],
  "count": 5,
  "timestamp": "2026-03-11T10:00:00Z"
}
```

### GET /api/ai/demand

Forecast demand for a zone.

**Query Parameters:**
- `zoneId` (uuid, required): Zone ID
- `date` (ISO datetime, required): Date
- `hour` (number, optional): Specific hour (0-23)

**Response:**
```json
{
  "forecast": {
    "zoneId": "zone_456",
    "date": "2026-03-15",
    "hour": 10,
    "predictedOrders": 45,
    "confidence": 0.85,
    "historicalAverage": 42,
    "seasonalFactor": 1.0,
    "trend": "stable"
  },
  "timestamp": "2026-03-11T10:00:00Z"
}
```

### GET /api/ai/slots/top

Get single top recommended slot.

## Fallback Behavior

- **No historical data**: Uses default multipliers (7 AM rush: 1.4x, night: 0.85x)
- **No driver shifts**: Assumes moderate availability
- **No weather data**: Assumes neutral impact
- **No customer preferences**: Neutral scoring (0.5)
- **No congestion data**: Assumes moderate congestion

## Performance Characteristics

- **Prediction Latency**: < 50ms per slot
- **Batch Processing**: < 5ms per slot with 50+ slots
- **Memory Footprint**: ~5MB per zone with 6 months history
- **Model Accuracy**: Improves with sample size
  - 10+ historical orders: 60-70% accuracy
  - 100+ orders: 75-85% accuracy
  - 1000+ orders: 80-90% accuracy

## Continuous Improvement

Record actual delivery times to improve model accuracy:

```typescript
// After delivery completion
const historicalData: HistoricalDeliveryData = {
  orderId: 'order_123',
  customerId: 'cust_456',
  zoneId: 'zone_789',
  slotStartTime: new Date('2026-03-15T09:00:00'),
  slotEndTime: new Date('2026-03-15T12:00:00'),
  orderPlacedAt: new Date('2026-03-13T14:30:00'),
  actualDeliveryTime: new Date('2026-03-15T10:45:00'),
  estimatedDeliveryTime: new Date('2026-03-15T10:50:00'),
  dayOfWeek: 0,
  hourOfDay: 10,
  distanceKm: 5.2,
  weight: 2.5,
  items: 3,
  driverId: 'driver_123',
  weatherCondition: 'sunny',
  trafficLevel: 'light',
  success: true,
};

slotRecommender.updateDemandData([historicalData]);
```

## Testing

Run the test suite:

```bash
npm test -- ai-slots
```

Tests include:
- Slot recommendation accuracy
- Demand prediction validation
- Driver availability forecasting
- Customer preference matching
- Weather impact calculation
- Score ranking verification
