/**
 * AI ETA Engine Module
 *
 * Traffic-aware ML ETA prediction with ensemble of models:
 * - Time-of-day adjustments (rush hours, night)
 * - Distance-based linear regression
 * - Historical route similarity matching
 * - Real-time traffic data integration
 *
 * Usage:
 * ```ts
 * import { etaEngine } from '@witylogix/core/ai-eta';
 *
 * const prediction = etaEngine.predictETA({
 *   origin: { lat: 40.7128, lng: -74.0060 },
 *   destination: { lat: 40.7580, lng: -73.9855 },
 *   distanceKm: 5.5,
 *   departureTime: new Date(),
 * });
 *
 * console.log(`Expected delivery: ${prediction.prediction.expected}`);
 * console.log(`Confidence: ${(prediction.confidence * 100).toFixed(0)}%`);
 * ```
 */

// Export types
export type {
  ETAPrediction,
  TimeInterval,
  Coordinates,
  Route,
  HistoricalRoute,
  ModelPrediction,
  AccuracyMetrics,
  TrafficZone,
  TrafficData,
  ETAModelConfig,
  BatchETARequest,
  BatchETAResponse,
  TrafficUpdate,
} from './types.js';

// Export models
export { TimeOfDayModel, timeOfDayModel } from './models/time-of-day-model.js';
export { DistanceModel, distanceModel } from './models/distance-model.js';
export { HistoricalModel, historicalModel } from './models/historical-model.js';
export { TrafficModel, trafficModel } from './models/traffic-model.js';

// Export ensemble
export { ModelEnsemble, modelEnsemble } from './model-ensemble.js';

// Export main engine
export type { ETAEngineConfig } from './eta-engine.js';
export { ETAEngine, etaEngine } from './eta-engine.js';
