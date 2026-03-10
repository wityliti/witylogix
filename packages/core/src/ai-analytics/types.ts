/**
 * AI Analytics Types
 *
 * Core types for route efficiency, driver performance, delivery prediction,
 * and anomaly detection.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum TrendDirection {
  IMPROVING = 'improving',
  DECLINING = 'declining',
  STABLE = 'stable',
}

export enum BadgeType {
  TOP_PERFORMER = 'top_performer',
  MOST_IMPROVED = 'most_improved',
  CONSISTENT = 'consistent',
  NEEDS_COACHING = 'needs_coaching',
}

export enum AnomalySeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AnomalyType {
  UNUSUAL_STOP_DURATION = 'unusual_stop_duration',
  ROUTE_DEVIATION = 'route_deviation',
  SPEED_ANOMALY = 'speed_anomaly',
  UNEXPECTED_STOP = 'unexpected_stop',
  DELIVERY_GAP = 'delivery_gap',
}

// ─── Configuration Types ────────────────────────────────────────────────────

export interface ScoringWeights {
  distanceEfficiency: number; // 0-1
  timeEfficiency: number; // 0-1
  stopEfficiency: number; // 0-1
  idleTimeRatio: number; // 0-1
  deviationCount: number; // 0-1
}

export interface DriverScoringWeights {
  onTimeDeliveryRate: number; // 0.30
  customerRating: number; // 0.20
  routeEfficiency: number; // 0.20
  deliverySuccessRate: number; // 0.15
  speedCompliance: number; // 0.15
}

export interface VehicleProfile {
  type: 'van' | 'truck' | 'bike' | 'ev';
  baseEmissionsFactor: number; // g/km
  idlingEmissions: number; // kg/hour
}

export interface AnomalyThresholds {
  stopDurationSigma: number; // 2 standard deviations
  routeDeviationMeters: number; // 1000m
  routeDeviationMinutes: number; // 5 min
  speedLimitExcess: number; // 20 km/h
  minimumSpeedDuration: number; // 10 min
  minimumSpeed: number; // 5 km/h
  unexpectedStopDuration: number; // 3 min
  deliveryGapMinutes: number; // 30 min
}

// ─── Route Efficiency Types ─────────────────────────────────────────────────

export interface RouteDataPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speedKmh?: number;
}

export interface PlannedRouteSegment {
  plannedDistance: number; // meters
  plannedDuration: number; // minutes
  plannedStops: Stop[];
}

export interface Stop {
  id: string;
  lat: number;
  lng: number;
  plannedArrivalTime: number; // unix timestamp
  plannedDuration: number; // minutes
  actualArrivalTime?: number;
  actualDuration?: number;
  orderId: string;
  type: 'delivery' | 'pickup' | 'service';
}

export interface RouteEfficiencyScore {
  score: number; // 0-100
  percentileRank: number; // 0-100 (against historical benchmarks)
  breakdown: {
    distanceEfficiency: number; // 0-1
    timeEfficiency: number; // 0-1
    stopEfficiency: number; // 0-1
    idleTimeRatio: number; // 0-1 (lower is better)
    deviationCount: number; // count of deviations > 500m
  };
  metrics: {
    actualDistance: number; // meters
    plannedDistance: number; // meters
    actualDuration: number; // minutes
    plannedDuration: number; // minutes
    idleTime: number; // minutes
    deviations: number; // count
  };
}

// ─── Driver Performance Types ───────────────────────────────────────────────

export interface DriverScore {
  driverId: string;
  compositeScore: number; // 0-100
  breakdown: {
    onTimeDeliveryRate: number; // 0-100
    customerRatingAverage: number; // 0-5
    routeEfficiencyAverage: number; // 0-100
    deliverySuccessRate: number; // 0-100
    speedCompliancePercent: number; // 0-100
  };
  trendAnalysis: {
    direction: TrendDirection;
    changePercent: number; // percentage change over 4 weeks
    weeksOfData: number;
  };
  peerComparison: {
    rank: number;
    totalPeersInZone: number;
    percentilRank: number; // 0-100
  };
  badges: BadgeType[];
  periodStart: number; // unix timestamp
  periodEnd: number; // unix timestamp
}

// ─── Delivery Prediction Types ──────────────────────────────────────────────

export interface DeliveryContext {
  orderId: string;
  distanceRemaining: number; // meters
  currentTrafficFactor: number; // 0.5-2.0
  driverHistoricalSpeed: number; // km/h
  timeOfDay: number; // 0-23 (hour)
  dayOfWeek: number; // 0-6 (0 = Sunday)
  weather?: {
    condition: 'clear' | 'rain' | 'snow' | 'fog';
    temperature: number;
  };
  stopComplexity: 'house' | 'apartment' | 'business' | 'warehouse'; // affects dwell time
}

export interface DeliveryPrediction {
  estimatedArrival: number; // unix timestamp
  confidence: number; // 0-100
  confidenceRange: {
    p80Lower: number; // unix timestamp
    p80Upper: number;
    p95Lower: number;
    p95Upper: number;
  };
  models: {
    historicalModel: number; // estimated minutes
    distanceModel: number;
    contextualModel: number;
    ensemble: number;
  };
  calibrationInfo?: {
    recentAccuracyMAPE: number; // mean absolute percentage error
    adjustmentFactor: number; // 0.8-1.2
  };
}

// ─── Anomaly Detection Types ────────────────────────────────────────────────

export interface AnomalyEvent {
  id: string;
  routeId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: number; // unix timestamp
  stopId?: string;
  details: Record<string, unknown>;
  context: {
    actualValue: number | string;
    expectedValue: number | string;
    threshold: number | string;
  };
}

export interface AnomalyDetectionResult {
  routeId: string;
  anomalies: AnomalyEvent[];
  summary: {
    totalCount: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  patterns?: {
    location: string;
    frequency: number;
    lastOccurrence: number;
  }[];
}

// ─── CO2 Calculator Types ───────────────────────────────────────────────────

export interface CO2Report {
  routeId: string;
  plannedCO2: number; // kg
  actualCO2: number; // kg
  savedCO2: number; // kg
  savingsPercent: number;
  breakdown: {
    drivingEmissions: number;
    idlingEmissions: number;
  };
  vehicleProfile: VehicleProfile;
  distance: number; // meters
  duration: number; // minutes
  idleTime: number; // minutes
  efficiency: number; // kg CO2 per km
  periodStart: number; // unix timestamp
  periodEnd: number;
}

export interface CO2Summary {
  tenantId: string;
  period: {
    start: number;
    end: number;
  };
  totalPlannedCO2: number; // kg
  totalActualCO2: number; // kg
  totalSavedCO2: number; // kg
  averageSavingsPercent: number;
  vehicleBreakdown: Array<{
    type: 'van' | 'truck' | 'bike' | 'ev';
    count: number;
    totalCO2: number;
  }>;
  trend: Array<{
    date: string; // ISO date
    co2: number;
    saved: number;
  }>;
}

// ─── Leaderboard Types ──────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string;
  compositeScore: number; // 0-100
  onTimePercent: number;
  routeEfficiencyAvg: number;
  customerRatingAvg: number;
  deliverySuccessPercent: number;
  badge?: BadgeType;
  trend: TrendDirection;
  trendPercent: number;
}

export interface Leaderboard {
  period: '24h' | '7d' | '30d';
  entries: LeaderboardEntry[];
  generatedAt: number; // unix timestamp
}
