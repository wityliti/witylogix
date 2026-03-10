/**
 * AI Slot Recommendation Module Types
 *
 * Defines core types for ML-powered delivery slot recommendations,
 * demand forecasting, and driver availability prediction.
 */

/**
 * Scored delivery slot with ML ranking
 */
export interface ScoredSlot {
  slotId: string;
  slotName: string;
  startTime: Date;
  endTime: Date;
  score: number; // 0-100, higher is better
  reasoning: string; // Human-readable explanation of the score
  demandForecast: DemandForecast;
  driverAvailability: number; // 0-1, proportion of drivers available
  congestionRisk: number; // 0-1, likelihood of zone congestion
  weatherImpact: number; // -0.5 to 0.5, impact on delivery time
  customerPreferenceMatch: number; // 0-1, how well it matches customer patterns
}

/**
 * Demand forecast for a zone and time period
 */
export interface DemandForecast {
  zoneId: string;
  date: Date;
  hour: number;
  predictedOrders: number; // Expected number of orders
  confidence: number; // 0-1, model confidence
  historicalAverage: number; // Orders at this time historically
  seasonalFactor: number; // Seasonal multiplier
  trend: "increasing" | "stable" | "decreasing";
  peakLoadForecast?: {
    isPeakHour: boolean;
    loadPercentage: number; // 0-100
  };
}

/**
 * Historical demand pattern for a zone
 */
export interface DemandPattern {
  zoneId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hourlyAverages: number[]; // 24 hours of average order counts
  weekendMultiplier: number; // Demand multiplier for weekends
  seasonalFactors: Record<string, number>; // Seasonal adjustments
}

/**
 * Driver availability forecast
 */
export interface DriverForecast {
  date: Date;
  hour: number;
  expectedAvailableDrivers: number;
  totalScheduledDrivers: number;
  noShowProbability: number; // 0-1, estimated no-show rate
  zoneDistribution: Record<string, number>; // Zone -> driver count
  vehicleCapacityTotal: number; // Total package capacity
}

/**
 * Customer preference history
 */
export interface CustomerPreference {
  customerId: string;
  averageDeliveryValue: number; // Average order value
  preferredHours: number[]; // Hours they typically order
  preferredDays: number[]; // Days of week they order
  successRate: number; // Delivery success rate
  totalOrders: number;
  lastOrderDate: Date | null;
  averageDeliveryDuration: number; // minutes
}

/**
 * Recommendation request parameters
 */
export interface RecommendSlotRequest {
  customerId: string;
  zoneId: string;
  date: Date;
  maxSlots?: number; // Default 5
  includeReasons?: boolean;
  customerPreference?: CustomerPreference;
}

/**
 * ML model metrics for accuracy tracking
 */
export interface ModelMetrics {
  modelName: string;
  accuracy: number; // 0-1
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  lastUpdated: Date;
  sampleSize: number;
}

/**
 * Prediction with confidence interval
 */
export interface PredictionWithConfidence<T> {
  value: T;
  low: T;
  high: T;
  confidence: number; // 0-1
}

/**
 * Historical delivery data for model training
 */
export interface HistoricalDeliveryData {
  orderId: string;
  customerId: string;
  zoneId: string;
  slotStartTime: Date;
  slotEndTime: Date;
  orderPlacedAt: Date;
  actualDeliveryTime: Date;
  estimatedDeliveryTime: Date;
  estimationError: number; // minutes
  dayOfWeek: number;
  hourOfDay: number;
  distanceKm: number;
  weight: number;
  items: number;
  driverId: string;
  weatherCondition?: string;
  trafficLevel?: "light" | "moderate" | "heavy";
  success: boolean;
}

/**
 * Zone congestion metrics
 */
export interface ZoneCongestion {
  zoneId: string;
  timestamp: Date;
  activeDeliveries: number;
  totalCapacity: number;
  congestionLevel: "light" | "moderate" | "heavy";
  estimatedWaitTime: number; // minutes
}

/**
 * Weather impact data
 */
export interface WeatherImpact {
  date: Date;
  zoneId: string;
  condition: string; // "sunny", "rainy", "snowy", etc.
  temperature: number;
  windSpeed: number; // km/h
  visibility: number; // km
  deliveryDelayFactor: number; // 1.0 = normal, 1.5 = 50% slower
}
