/**
 * AI Monitoring Module - Public API
 *
 * Core exports for the AI-powered monitoring engine:
 * - Types: All domain models for anomalies, alerts, and predictions
 * - AnomalyDetector: Statistical anomaly detection engine
 * - ETAPredictor: Delivery time prediction engine
 * - AlertEngine: Alert management and routing
 */

// ─── Types ───────────────────────────────────────────────────────────

export type {
  AnomalyAlert,
  PredictionResult,
  MonitoringConfig,
  MetricWindow,
  TimeSeriesPoint,
  AlertRule,
  AlertDigest,
} from "./types.js";

export { AnomalyType } from "./types.js";
export type { AlertSeverity } from "./types.js";

// ─── Anomaly Detector ────────────────────────────────────────────────

export { AnomalyDetector } from "./anomaly-detector.js";

// ─── ETA Predictor ───────────────────────────────────────────────────

export { ETAPredictor } from "./eta-predictor.js";
export type { PredictionFeatures } from "./eta-predictor.js";

// ─── Alert Engine ────────────────────────────────────────────────────

export { AlertEngine } from "./alert-engine.js";
