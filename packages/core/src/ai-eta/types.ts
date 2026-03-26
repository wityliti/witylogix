/**
 * AI ETA Engine Module Types
 *
 * Defines types for traffic-aware ML ETA prediction with confidence intervals,
 * model accuracy metrics, and ensemble predictions.
 */

/**
 * ETA prediction with confidence intervals
 */
export interface ETAPrediction {
  orderId?: string;
  origin: Coordinates;
  destination: Coordinates;
  departureTime: Date;
  prediction: TimeInterval;
  confidence: number; // 0-1
  modelUsed: string;
  modelsConsidered: string[];
  trafficCondition: 'light' | 'moderate' | 'heavy' | 'unknown';
  estimationError?: number; // minutes (if actual delivery time is known)
  metadata?: Record<string, unknown>;
}

/**
 * Time interval (low, expected, high)
 */
export interface TimeInterval {
  low: Date;
  expected: Date;
  high: Date;
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Route information
 */
export interface Route {
  origin: Coordinates;
  destination: Coordinates;
  distanceKm: number;
  estimatedTimeMinutes: number;
  zoneType: 'urban' | 'suburban' | 'rural';
}

/**
 * Historical route data for model training
 */
export interface HistoricalRoute {
  routeId: string;
  origin: Coordinates;
  destination: Coordinates;
  distanceKm: number;
  departureTime: Date;
  estimatedArrival: Date;
  actualArrival: Date;
  dayOfWeek: number;
  hourOfDay: number;
  trafficCondition: 'light' | 'moderate' | 'heavy';
  zoneType: 'urban' | 'suburban' | 'rural';
  driverId: string;
  success: boolean;
}

/**
 * Single model prediction
 */
export interface ModelPrediction {
  modelName: string;
  prediction: TimeInterval;
  confidence: number;
  errorMetrics?: {
    mae: number; // Mean Absolute Error in minutes
    rmse: number; // Root Mean Square Error
    mape: number; // Mean Absolute Percentage Error
  };
}

/**
 * Model accuracy metrics
 */
export interface AccuracyMetrics {
  modelName: string;
  meanAbsoluteError: number; // minutes
  rootMeanSquareError: number; // minutes
  medianAbsoluteError: number; // minutes
  percentileErrors: {
    p50: number;
    p90: number;
    p95: number;
  };
  sampleSize: number;
  lastUpdated: Date;
  accuracy: number; // 0-1
}

/**
 * Traffic zone data
 */
export interface TrafficZone {
  zoneId: string;
  zoneName: string;
  zoneType: 'urban' | 'suburban' | 'rural';
  center: Coordinates;
  boundingBox: {
    ne: Coordinates;
    sw: Coordinates;
  };
  averageSpeed: number; // km/h
  peakHours: number[]; // 0-23
}

/**
 * Real-time traffic data
 */
export interface TrafficData {
  origin: Coordinates;
  destination: Coordinates;
  timestamp: Date;
  trafficCondition: 'light' | 'moderate' | 'heavy';
  averageSpeed: number; // km/h
  averageDuration: number; // minutes
  confidence: number; // 0-1
}

/**
 * ETA model configuration
 */
export interface ETAModelConfig {
  modelName: string;
  enabled: boolean;
  weight: number; // 0-1, for ensemble weighting
  minDataPoints: number; // Minimum historical data needed
  maxAge: number; // Hours, max age of training data
  trainingDataPath?: string;
}

/**
 * Batch ETA prediction request
 */
export interface BatchETARequest {
  deliveries: Array<{
    orderId?: string;
    origin: Coordinates;
    destination: Coordinates;
    departureTime: Date;
  }>;
}

/**
 * Batch ETA prediction response
 */
export interface BatchETAResponse {
  predictions: ETAPrediction[];
  processingTimeMs: number;
}

/**
 * Real-time traffic update
 */
export interface TrafficUpdate {
  timestamp: Date;
  zone: string;
  condition: 'light' | 'moderate' | 'heavy';
  affectedZones: string[];
  expectedDuration: number; // minutes
}
