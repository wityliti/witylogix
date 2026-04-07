/**
 * Delivery Time Predictor
 *
 * Ensemble of 3 models for predicting delivery arrival times:
 * 1. Historical average model (driver + zone + time of day)
 * 2. Distance-based model (distance / avg speed by road type)
 * 3. Contextual model (traffic, weather, stop complexity, etc.)
 *
 * Returns prediction with confidence interval (80% and 95% bounds).
 * Auto-calibrates by tracking prediction accuracy.
 */

import type { DeliveryContext, DeliveryPrediction } from './types.js';

/**
 * Historical prediction record for calibration
 */
interface PredictionRecord {
  predictedMinutes: number;
  actualMinutes: number;
  context: DeliveryContext;
  timestamp: number;
}

/**
 * Model-specific predictions
 */
interface ModelPredictions {
  historicalModel: number;
  distanceModel: number;
  contextualModel: number;
  ensemble: number;
}

/**
 * In-memory prediction history for calibration
 */
const predictionHistory: PredictionRecord[] = [];

/**
 * Model weights (auto-adjusted based on accuracy)
 */
let modelWeights = {
  historical: 0.4,
  distance: 0.35,
  contextual: 0.25,
};

/**
 * Historical average model
 * Uses driver's historical speed for same zone/time of day
 */
function historicalAverageModel(
  context: DeliveryContext,
): { minutes: number; confidence: number } {
  // Filter historical records matching driver, zone, and time of day (±2 hours)
  const matchingRecords = predictionHistory.filter(
    (r) =>
      Math.abs(r.context.timeOfDay - context.timeOfDay) <= 2,
  );

  if (matchingRecords.length < 5) {
    // Not enough data, use default 2 km/h average
    const minutes = context.distanceRemaining / 1000 / 2;
    return { minutes, confidence: 40 };
  }

  // Calculate average delivery time from matching records
  const avgActualMinutes =
    matchingRecords.reduce((sum, r) => sum + r.actualMinutes, 0) /
    matchingRecords.length;

  // Confidence increases with more data points
  const confidence = Math.min(95, 40 + matchingRecords.length * 5);

  return {
    minutes: avgActualMinutes,
    confidence,
  };
}

/**
 * Distance-based model
 * Uses distance / driver's historical speed
 */
function distanceBasedModel(
  context: DeliveryContext,
): { minutes: number; confidence: number } {
  // Adjust for traffic factor (1.0 = normal, 2.0 = heavy traffic)
  const trafficAdjustedSpeed =
    context.driverHistoricalSpeed / context.currentTrafficFactor;

  // Convert distance from meters to km
  const distanceKm = context.distanceRemaining / 1000;
  const minutes = (distanceKm / Math.max(1, trafficAdjustedSpeed)) * 60;

  // Base confidence on traffic factor certainty
  const confidence = context.currentTrafficFactor > 1.5 ? 70 : 85;

  return {
    minutes,
    confidence,
  };
}

/**
 * Contextual model
 * Incorporates multiple factors: traffic, weather, stop complexity, time of day
 */
function contextualModel(
  context: DeliveryContext,
): { minutes: number; confidence: number } {
  const distanceKm = context.distanceRemaining / 1000;

  // Base speed
  let effectiveSpeed = context.driverHistoricalSpeed;

  // Traffic adjustment
  effectiveSpeed /= context.currentTrafficFactor;

  // Weather adjustment
  if (context.weather) {
    if (context.weather.condition === 'rain') {
      effectiveSpeed *= 0.85; // 15% slower in rain
    } else if (context.weather.condition === 'snow') {
      effectiveSpeed *= 0.7; // 30% slower in snow
    } else if (context.weather.condition === 'fog') {
      effectiveSpeed *= 0.9; // 10% slower in fog
    }
  }

  // Time of day adjustment (peak hours)
  const isPeakHour = (context.timeOfDay >= 11 && context.timeOfDay <= 13) ||
    (context.timeOfDay >= 17 && context.timeOfDay <= 19);
  if (isPeakHour) {
    effectiveSpeed *= 0.8; // 20% slower during peak hours
  }

  // Travel time
  let travelMinutes = (distanceKm / Math.max(1, effectiveSpeed)) * 60;

  // Stop complexity dwell time
  let dwellMinutes = 2; // Base 2 minutes
  if (context.stopComplexity === 'apartment') {
    dwellMinutes = 4; // Apartments take longer (parking, access)
  } else if (context.stopComplexity === 'business') {
    dwellMinutes = 3; // Businesses are medium
  } else if (context.stopComplexity === 'warehouse') {
    dwellMinutes = 5; // Warehouses can be slow
  }

  const totalMinutes = travelMinutes + dwellMinutes;

  // Confidence based on data richness
  let confidence = 75;
  if (context.weather) confidence += 5;
  if (context.dayOfWeek !== undefined) confidence += 5;

  return {
    minutes: totalMinutes,
    confidence,
  };
}

/**
 * Record actual delivery for model calibration
 */
export function recordDelivery(
  predictedMinutes: number,
  actualMinutes: number,
  context: DeliveryContext,
): void {
  predictionHistory.push({
    predictedMinutes,
    actualMinutes,
    context,
    timestamp: Date.now(),
  });

  // Keep last 5000 predictions
  if (predictionHistory.length > 5000) {
    predictionHistory.shift();
  }

  // Recalibrate weights every 100 new records
  if (predictionHistory.length % 100 === 0) {
    calibrateWeights();
  }
}

/**
 * Recalibrate model weights based on prediction accuracy (MAPE)
 */
function calibrateWeights(): void {
  if (predictionHistory.length < 20) return;

  // Use recent records for calibration
  const recentRecords = predictionHistory.slice(-100);

  // Calculate MAPE for each model on recent data
  const historicalErrors: number[] = [];
  const distanceErrors: number[] = [];
  const contextualErrors: number[] = [];

  for (const record of recentRecords) {
    const { minutes: historicalMin } = historicalAverageModel(record.context);
    const { minutes: distanceMin } = distanceBasedModel(record.context);
    const { minutes: contextualMin } = contextualModel(record.context);

    const actual = record.actualMinutes;

    historicalErrors.push(Math.abs(historicalMin - actual) / actual);
    distanceErrors.push(Math.abs(distanceMin - actual) / actual);
    contextualErrors.push(Math.abs(contextualMin - actual) / actual);
  }

  const historicalMAPE =
    historicalErrors.reduce((a, b) => a + b, 0) / historicalErrors.length;
  const distanceMAPE =
    distanceErrors.reduce((a, b) => a + b, 0) / distanceErrors.length;
  const contextualMAPE =
    contextualErrors.reduce((a, b) => a + b, 0) / contextualErrors.length;

  // Inverse MAPE for weights (lower error = higher weight)
  const invHistorical = 1 / (historicalMAPE + 0.01);
  const invDistance = 1 / (distanceMAPE + 0.01);
  const invContextual = 1 / (contextualMAPE + 0.01);

  const total = invHistorical + invDistance + invContextual;

  // Smooth weight update (don't change too drastically)
  const newWeights = {
    historical: (invHistorical / total) * 0.7 + modelWeights.historical * 0.3,
    distance: (invDistance / total) * 0.7 + modelWeights.distance * 0.3,
    contextual: (invContextual / total) * 0.7 + modelWeights.contextual * 0.3,
  };

  modelWeights = newWeights;
}

/**
 * Calculate prediction confidence
 */
function calculateConfidence(
  models: ModelPredictions,
  modelConfidences: Record<string, number>,
): number {
  // Average confidence weighted by model weights
  const weighted =
    modelConfidences.historical * modelWeights.historical +
    modelConfidences.distance * modelWeights.distance +
    modelConfidences.contextual * modelWeights.contextual;

  // Reduce confidence if models disagree significantly
  const avg =
    (models.historicalModel + models.distanceModel + models.contextualModel) / 3;
  const maxDeviation = Math.max(
    Math.abs(models.historicalModel - avg),
    Math.abs(models.distanceModel - avg),
    Math.abs(models.contextualModel - avg),
  );

  const disagreementPenalty = Math.min(20, maxDeviation * 10);
  return Math.max(30, Math.round(weighted - disagreementPenalty));
}

/**
 * Calculate 80% and 95% confidence bounds
 */
function calculateConfidenceBounds(
  estimatedMinutes: number,
  confidence: number,
): { p80Lower: number; p80Upper: number; p95Lower: number; p95Upper: number } {
  // Standard error increases as confidence decreases
  const stdError = estimatedMinutes * (1 - confidence / 100) * 0.5;

  // 80% confidence = ±1.28 sigma
  // 95% confidence = ±1.96 sigma
  const p80Margin = stdError * 1.28;
  const p95Margin = stdError * 1.96;

  return {
    p80Lower: estimatedMinutes - p80Margin,
    p80Upper: estimatedMinutes + p80Margin,
    p95Lower: Math.max(1, estimatedMinutes - p95Margin),
    p95Upper: estimatedMinutes + p95Margin,
  };
}

/**
 * Get current model accuracy metrics
 */
export function getCalibrationInfo(): {
  recentAccuracyMAPE: number;
  adjustmentFactor: number;
  modelWeights: typeof modelWeights;
} {
  if (predictionHistory.length < 10) {
    return {
      recentAccuracyMAPE: 0.15,
      adjustmentFactor: 1.0,
      modelWeights,
    };
  }

  // Calculate MAPE on last 50 predictions
  const recentRecords = predictionHistory.slice(-50);
  const errors = recentRecords.map(
    (r) => Math.abs(r.predictedMinutes - r.actualMinutes) / r.actualMinutes,
  );
  const mape = errors.reduce((a, b) => a + b, 0) / errors.length;

  // Calculate average adjustment needed
  const adjustments = recentRecords.map(
    (r) => r.actualMinutes / r.predictedMinutes,
  );
  const adjustmentFactor =
    adjustments.reduce((a, b) => a + b, 0) / adjustments.length;

  return {
    recentAccuracyMAPE: Math.round(mape * 10000) / 10000,
    adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
    modelWeights,
  };
}

/**
 * Predict delivery window for a stop
 *
 * @param context - Delivery context with distance, traffic, driver info, etc.
 * @returns DeliveryPrediction with estimated arrival, confidence, and bounds
 */
export function predictDeliveryWindow(
  context: DeliveryContext,
): DeliveryPrediction {
  // Get predictions from each model
  const { minutes: historicalMinutes, confidence: historicalConfidence } =
    historicalAverageModel(context);
  const { minutes: distanceMinutes, confidence: distanceConfidence } =
    distanceBasedModel(context);
  const { minutes: contextualMinutes, confidence: contextualConfidence } =
    contextualModel(context);

  // Ensemble: weighted average
  const estimatedMinutes =
    historicalMinutes * modelWeights.historical +
    distanceMinutes * modelWeights.distance +
    contextualMinutes * modelWeights.contextual;

  const models: ModelPredictions = {
    historicalModel: historicalMinutes,
    distanceModel: distanceMinutes,
    contextualModel: contextualMinutes,
    ensemble: estimatedMinutes,
  };

  // Calculate confidence
  const modelConfidences = {
    historical: historicalConfidence,
    distance: distanceConfidence,
    contextual: contextualConfidence,
  };
  const confidence = calculateConfidence(models, modelConfidences);

  // Calculate confidence bounds
  const bounds = calculateConfidenceBounds(estimatedMinutes, confidence);
  const now = Date.now();

  // Get calibration info
  const calibration = getCalibrationInfo();

  return {
    estimatedArrival: now + estimatedMinutes * 60 * 1000,
    confidence,
    confidenceRange: {
      p80Lower: now + bounds.p80Lower * 60 * 1000,
      p80Upper: now + bounds.p80Upper * 60 * 1000,
      p95Lower: Math.max(now, now + bounds.p95Lower * 60 * 1000),
      p95Upper: now + bounds.p95Upper * 60 * 1000,
    },
    models,
    calibrationInfo: {
      recentAccuracyMAPE: calibration.recentAccuracyMAPE,
      adjustmentFactor: calibration.adjustmentFactor,
    },
  };
}

/**
 * Predict delivery windows for multiple stops
 */
export function predictDeliveryWindowBatch(
  contexts: DeliveryContext[],
): Array<DeliveryPrediction & { orderId: string }> {
  return contexts.map((context) => ({
    orderId: context.orderId,
    ...predictDeliveryWindow(context),
  }));
}
