/**
 * AI Demand Prediction Module Types
 *
 * Comprehensive TypeScript definitions for demand forecasting system:
 * - Zone demand profiling
 * - Feature engineering (zone, temporal, event)
 * - Demand forecasts with confidence intervals
 * - Capacity recommendations
 * - Anomaly detection
 * - Prediction request/response types
 * - Service interfaces
 *
 * Usage:
 * import {
 *   DemandForecast,
 *   CapacityRecommendation,
 *   IDemandPredictor,
 *   ZoneDemandFeatures,
 * } from '@witylogix/core/demand-prediction';
 */

// ═══════════════════════════════════════════════════════════════
// ZONE PROFILES
// ═══════════════════════════════════════════════════════════════

/**
 * Zone-level demographic and historical performance data
 * Used to personalize predictions for each delivery zone
 */
export interface ZoneProfile {
  id: string;
  orgId: string;
  zoneId: string;

  // Demographics
  populationDensity: number; // people per sq km
  businessDensity: number; // businesses per sq km
  residentialRatio: number; // 0-1
  commercialRatio: number; // 0-1

  // Historical performance
  historicalAvgVolume: number; // deliveries per day
  historicalPeakVolume: number; // 95th percentile
  avgDeliveryDistance: number; // km
  competitorPresence: number; // count

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zone-level demand features computed at training time
 * Captures characteristics that affect demand patterns
 */
export interface ZoneDemandFeatures {
  zoneId: string;
  populationDensity: number;
  businessDensity: number;
  historicalAvgVolume: number;
  historicalPeakVolume: number;
  competitorPresence: number;
  avgDeliveryDistance: number;
  residentialRatio: number;
  commercialRatio: number;
}

// ═══════════════════════════════════════════════════════════════
// TEMPORAL FEATURES
// ═══════════════════════════════════════════════════════════════

/**
 * Time-based features that influence delivery demand
 * Captures daily, weekly, and seasonal patterns
 */
export interface TemporalFeatures {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (0=Sunday)
  dayOfMonth: number; // 1-31
  weekOfYear: number; // 1-52
  isHoliday: boolean;
  seasonalIndex: number; // 0-3 (Q1-Q4)
  isWeekend: boolean;
  isMonday: boolean;
  isFriday: boolean;
  daysUntilHoliday: number;
}

// ═══════════════════════════════════════════════════════════════
// EVENT FEATURES
// ═══════════════════════════════════════════════════════════════

export type WeatherCondition =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "cloudy"
  | "extreme";

/**
 * External event features that impact demand
 * Includes promotions, weather, major events
 */
export interface EventFeatures {
  hasPromotion: boolean;
  promotionIntensity: number; // 0-10
  weatherCondition: WeatherCondition;
  temperatureC: number;
  majorEventNearby: boolean;
  lastMileApiDown: boolean;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════

/**
 * Complete feature snapshot at a specific time
 * Used for training and audit trails
 */
export interface FeatureSnapshot {
  id: string;
  zoneId: string;
  timestamp: Date;

  // Zone features
  populationDensity: number;
  businessDensity: number;
  historicalAvgVolume: number;

  // Temporal features
  hour: number;
  dayOfWeek: number;
  seasonalIndex: number;
  isHoliday: boolean;

  // Event features
  hasPromotion: boolean;
  promotionIntensity: number;
  weatherCondition: WeatherCondition;
  temperature: number;

  // Actual observed volume (for training)
  observedVolume?: number;

  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// DEMAND FORECASTS
// ═══════════════════════════════════════════════════════════════

export type ForecastGranularity = "hourly" | "daily" | "weekly";

/**
 * Forecast interval with confidence bounds
 */
export interface ForecastInterval {
  lower: number; // 80% confidence lower
  upper: number; // 80% confidence upper
  confidence: number; // 0-1 score
}

/**
 * Complete demand forecast record
 */
export interface DemandForecast {
  id: string;
  zoneProfileId: string;

  // Timing
  forecastTime: Date; // when forecast is for
  generatedAt: Date; // when generated

  // Forecast values
  predictedVolume: number;
  confidenceLower: number;
  confidenceUpper: number;
  confidence: number; // 0-1

  // Model breakdown
  seasonalComponent: number;
  regressionComponent: number;
  dayOfWeekComponent: number;

  // Accuracy tracking
  actualVolume?: number;
  accuracy?: number; // |predicted - actual| / predicted

  granularity: ForecastGranularity;
  modelVersion: number;

  createdAt: Date;
}

/**
 * Forecast response for API
 */
export interface ForecastResponse {
  zoneId: string;
  forecastDate: string; // YYYY-MM-DD
  granularity: ForecastGranularity;
  forecasts: DemandForecast[];
  summary: {
    totalExpectedVolume: number;
    peakHour: number;
    peakVolume: number;
    lowVolume: number;
    avgConfidence: number;
    anomaliesDetected: number;
  };
}

/**
 * Hourly breakdown forecast
 */
export interface HourlyForecast {
  hour: number; // 0-23
  predictedVolume: number;
  confidence: number;
  interval: ForecastInterval;
  seasonalComponent: number;
  regressionComponent: number;
  dayOfWeekComponent: number;
  anomalousFlag?: boolean;
  anomalyReason?: string;
}

/**
 * Request to generate a forecast
 */
export interface PredictionRequest {
  id?: string;
  orgId?: string;
  userId?: string;

  zoneId: string;
  forecastDate: Date | string; // YYYY-MM-DD
  granularity: ForecastGranularity;

  // Response data
  prediction?: Record<string, any>;
  status?: "pending" | "completed" | "failed";
  errorMessage?: string;

  createdAt?: Date;
  completedAt?: Date;
}

/**
 * Response from prediction API
 */
export interface PredictionResponse {
  requestId: string;
  zoneId: string;
  forecastDate: string;
  granularity: ForecastGranularity;
  status: "pending" | "completed" | "failed";

  // For completed requests
  forecasts?: HourlyForecast[];
  summary?: {
    totalExpectedVolume: number;
    peakHour: number;
    peakVolume: number;
    confidence: number;
  };

  // For failed requests
  error?: string;

  generatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// CAPACITY RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Slot capacity adjustment for a specific hour
 */
export interface SlotCapacityAdjustment {
  hour: number;
  predictedVolume: number;
  confidence: number;
  recommendedCapacity: number;
  currentCapacity?: number;
  capacityDelta?: number;
  confidenceLower: number;
  confidenceUpper: number;
  rationale?: string;
}

/**
 * Complete capacity recommendation for a day
 */
export interface CapacityRecommendation {
  id: string;
  zoneId: string;
  slotDate: Date;

  // Hourly recommendations
  recommendations: SlotCapacityAdjustment[];

  // Driver allocation
  recommendedDriverCount: number;
  rationale?: string;

  // Status tracking
  applied: boolean;
  appliedAt?: Date;
  appliedBy?: string;

  createdAt: Date;
}

/**
 * Capacity recommendation API response
 */
export interface CapacityRecommendationResponse {
  zoneId: string;
  slotDate: string; // YYYY-MM-DD
  recommendations: SlotCapacityAdjustment[];
  recommendedDriverCount: number;
  applied: boolean;
  appliedAt?: Date;
  totalCapacityRecommended: number;
  totalCurrentCapacity?: number;
  capabilityGain?: number; // percentage increase
}

// ═══════════════════════════════════════════════════════════════
// ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════

export type AnomalyType =
  | "spike"
  | "drop"
  | "trend_shift"
  | "seasonal_break"
  | "outlier";

export type AnomalyReason =
  | "major_event"
  | "weather"
  | "outage"
  | "competitor_promo"
  | "holiday_shift"
  | "api_error"
  | "data_quality"
  | "unknown";

/**
 * Detected demand anomaly
 */
export interface DemandAnomaly {
  id: string;
  zoneId: string;
  timestamp: Date;

  // Anomaly details
  anomalyType: AnomalyType;
  severity: number; // 0-1
  observedVolume: number;
  expectedVolume: number;
  deviation: number; // (observed - expected) / expected

  // Context
  likelyReason?: AnomalyReason;
  description?: string;
  confidence?: number;

  // Investigation status
  investigated: boolean;
  investigatedAt?: Date;
  investigatedBy?: string;
  investigation?: {
    actualCause?: string;
    notes?: string;
  };

  createdAt: Date;
}

/**
 * Anomaly detection response
 */
export interface AnomalyResponse {
  zoneId: string;
  timeRange: {
    from: Date;
    to: Date;
  };
  anomalies: DemandAnomaly[];
  summary: {
    totalDetected: number;
    highSeverity: number; // >0.7
    investigated: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// MODEL PERFORMANCE TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Model accuracy metrics
 */
export interface ModelPerformanceMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error (%)
  r2Score: number; // R² coefficient
  precision: number; // 0-1
  recall: number; // 0-1
}

/**
 * Per-zone performance
 */
export interface ZonePerformance {
  zoneId: string;
  metrics: ModelPerformanceMetrics;
  totalForecasts: number;
  successfulForecasts: number;
  period: {
    from: Date;
    to: Date;
  };
}

/**
 * Model performance response
 */
export interface ModelPerformanceResponse {
  timeRange: {
    from: Date;
    to: Date;
  };
  overallMetrics: ModelPerformanceMetrics;
  byZone: ZonePerformance[];
  modelVersionUsed: number;
  lastRetrained: Date;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE INTERFACES
// ═══════════════════════════════════════════════════════════════

/**
 * Feature store for managing features
 */
export interface IFeatureStore {
  /**
   * Store a feature snapshot
   */
  snapshot(
    zoneId: string,
    timestamp: Date,
    features: Omit<
      FeatureSnapshot,
      "id" | "zoneId" | "timestamp" | "createdAt"
    >,
    observedVolume?: number,
  ): Promise<FeatureSnapshot>;

  /**
   * Retrieve recent features for a zone
   */
  getRecent(zoneId: string, lookbackDays: number): Promise<FeatureSnapshot[]>;

  /**
   * Get zone profile
   */
  getZoneProfile(zoneId: string): Promise<ZoneProfile | null>;

  /**
   * Update zone profile
   */
  updateZoneProfile(
    zoneId: string,
    profile: Partial<ZoneProfile>,
  ): Promise<void>;
}

/**
 * Main demand predictor interface
 */
export interface IDemandPredictor {
  /**
   * Generate forecast for a zone on a specific date
   */
  forecast(
    zoneId: string,
    forecastDate: Date,
    granularity: ForecastGranularity,
  ): Promise<HourlyForecast[]>;

  /**
   * Get capacity recommendation based on forecast
   */
  recommendCapacity(
    zoneId: string,
    slotDate: Date,
  ): Promise<CapacityRecommendation>;

  /**
   * Detect anomalies in demand
   */
  detectAnomalies(
    zoneId: string,
    timeRange: {
      from: Date;
      to: Date;
    },
  ): Promise<DemandAnomaly[]>;

  /**
   * Get model performance metrics
   */
  getPerformance(
    zoneId: string,
    days: number,
  ): Promise<ModelPerformanceMetrics>;

  /**
   * Retrain model with latest data
   */
  retrain(zoneId: string): Promise<{
    modelVersion: number;
    performance: ModelPerformanceMetrics;
    retrainedAt: Date;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Demand prediction configuration
 */
export interface DemandPredictionConfig {
  // Model weights for ensemble
  seasonalWeight: number; // 0.4
  regressionWeight: number; // 0.3
  dayOfWeekWeight: number; // 0.3

  // Capacity calculation
  safetyFactor: number; // 1.2 (20% buffer)
  deliveriesPerSlot: number; // 3

  // Anomaly detection
  anomalySpikeThreshold: number; // 0.5 (50% above prediction)
  anomalyDropThreshold: number; // -0.3 (30% below)
  anomalySeverityScale: number; // 5 (max deviation)

  // Retraining
  retrainFrequencyHours: number; // 24 for low volume, 1 for high
  minHistoryDays: number; // 30 for new zones
  minForecastsPerDay: number; // 10 to trigger hourly retraining

  // API
  forecastCacheTTLMinutes: number; // 60
  maxForecastHorizonDays: number; // 14
}

/**
 * Batch prediction result for multiple zones
 */
export interface BatchPredictionResult {
  zoneId: string;
  status: "success" | "failed";
  forecasts?: HourlyForecast[];
  error?: string;
  durationMs?: number;
}

/**
 * Batch prediction job
 */
export interface BatchPredictionJob {
  jobId: string;
  zoneIds: string[];
  forecastDate: Date;
  granularity: ForecastGranularity;
  status: "pending" | "in_progress" | "completed" | "failed";
  results: BatchPredictionResult[];
  startedAt: Date;
  completedAt?: Date;
}
