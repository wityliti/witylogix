/**
 * AI Analytics Module
 *
 * Barrel export for all analytics components:
 * - Route Efficiency Scoring
 * - Driver Performance Scoring
 * - Delivery Time Prediction
 * - Route Anomaly Detection
 * - CO2 Emissions Calculator
 */

// Type exports
export type {
  RouteDataPoint,
  PlannedRouteSegment,
  Stop,
  RouteEfficiencyScore,
  ScoringWeights,
  DriverScore,
  DriverScoringWeights,
  DriverMetrics,
  DeliveryContext,
  DeliveryPrediction,
  AnomalyEvent,
  AnomalyDetectionResult,
  AnomalyThresholds,
  CO2Report,
  CO2Summary,
  VehicleProfile,
  LeaderboardEntry,
  Leaderboard,
} from "./types.js";

// Enum exports
export {
  TrendDirection,
  BadgeType,
  AnomalySeverity,
  AnomalyType,
} from "./types.js";

// Route Efficiency exports
export {
  calculateRouteEfficiency,
  calculateRouteEfficiencyBatch,
  recordBenchmark,
} from "./route-efficiency.js";

// Driver Scoring exports
export {
  calculateDriverScore,
  calculateDriverScoreBatch,
  recordPeerScore,
} from "./driver-scorer.js";

// Delivery Prediction exports
export {
  predictDeliveryWindow,
  predictDeliveryWindowBatch,
  recordDelivery,
  getCalibrationInfo,
} from "./delivery-predictor.js";

// Anomaly Detection exports
export { detectAnomalies, detectAnomaliesBatch } from "./anomaly-detector.js";

// CO2 Calculator exports
export {
  calculateCO2,
  calculateCO2Batch,
  getCO2Summary,
  compareCO2,
  recordCO2,
} from "./co2-calculator.js";
