/**
 * ML ETA Engine v2 - Barrel Export
 *
 * Traffic-aware multi-model ETA prediction with confidence intervals.
 */

// Models
export {
  TimeOfDayModel,
  DistanceDecayModel,
  HistoricalDeliveryModel,
  TrafficModel,
  WeatherModel,
} from './models/index.js';

// Ensemble
export { EnsemblePredictor } from './ensemble.js';

// Feature extractor
export { featureExtractor, FeatureExtractor } from './feature-extractor.js';

// Tracking
export { ModelPerformanceTracker } from './model-performance-tracker.ts';

// Types
export type {
  FeatureVector,
  ModelPrediction,
  HistoricalDelivery,
  ETAPrediction,
  CalibrationMetrics,
  ModelPerformanceMetrics,
  TrainingConfig,
  PredictionContext,
  CalibrationResult,
  ModelWeights,
  TimeOfDayModelState,
  TrafficModelState,
  WeatherModelState,
  DistanceDecayModelState,
  HistoricalDeliveryModelState,
  EnsembleState,
  AccuracyReport,
  FeatureImportance,
} from './types.js';
