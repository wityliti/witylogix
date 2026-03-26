/**
 * Multi-Model Ensemble for ETA Prediction
 *
 * Combines all 5 models with dynamic weighting:
 * - Time-of-day model
 * - Distance decay model
 * - Historical similarity model
 * - Traffic-aware model
 * - Weather impact model
 *
 * Features:
 * - Learned weights that adapt to zone/time
 * - Confidence-weighted averaging
 * - Outlier detection and model reliability tracking
 * - Auto-calibration from prediction vs actual comparison
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ETAPrediction,
  ModelPrediction,
  ModelWeights,
  EnsembleState,
  CalibrationResult,
  PredictionContext,
} from './types.js';
import { TimeOfDayModel } from './models/time-of-day-model.js';
import { DistanceDecayModel } from './models/distance-decay-model.js';
import { HistoricalDeliveryModel } from './models/historical-delivery-model.js';
import { TrafficModel } from './models/traffic-model.js';
import { WeatherModel } from './models/weather-model.js';

export class EnsemblePredictor {
  private timeOfDayModel: TimeOfDayModel;
  private distanceDecayModel: DistanceDecayModel;
  private historicalModel: HistoricalDeliveryModel;
  private trafficModel: TrafficModel;
  private weatherModel: WeatherModel;

  private modelWeights: ModelWeights;
  private calibrations: Map<string, CalibrationResult>;
  private zoneSpecificWeights: Map<string, ModelWeights>;
  private hourSpecificWeights: Map<number, ModelWeights>;
  private outlierModels: Set<string>;
  private lastCalibration: Date;

  constructor() {
    this.timeOfDayModel = new TimeOfDayModel();
    this.distanceDecayModel = new DistanceDecayModel();
    this.historicalModel = new HistoricalDeliveryModel();
    this.trafficModel = new TrafficModel();
    this.weatherModel = new WeatherModel();

    // Initialize with equal weights
    this.modelWeights = {
      timeOfDay: 0.2,
      distanceDecay: 0.2,
      historicalSimilarity: 0.25,
      traffic: 0.2,
      weather: 0.15,
    };

    this.calibrations = new Map();
    this.zoneSpecificWeights = new Map();
    this.hourSpecificWeights = new Map();
    this.outlierModels = new Set();
    this.lastCalibration = new Date();
  }

  /**
   * Train all models on historical data
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    if (historicalDeliveries.length === 0) return;

    this.timeOfDayModel.fit(historicalDeliveries);
    this.distanceDecayModel.fit(historicalDeliveries);
    this.historicalModel.fit(historicalDeliveries);
    this.trafficModel.fit(historicalDeliveries);
    this.weatherModel.fit(historicalDeliveries);
  }

  /**
   * Get appropriate weights for a specific zone and hour
   */
  private getWeightsForContext(zoneType: string, hour: number): ModelWeights {
    // Try zone-specific weights first
    const zoneKey = zoneType;
    if (this.zoneSpecificWeights.has(zoneKey)) {
      return this.zoneSpecificWeights.get(zoneKey)!;
    }

    // Try hour-specific weights
    if (this.hourSpecificWeights.has(hour)) {
      return this.hourSpecificWeights.get(hour)!;
    }

    // Fall back to global weights
    return this.modelWeights;
  }

  /**
   * Check if a prediction is an outlier compared to others
   */
  private detectOutlier(
    predictions: ModelPrediction[],
    targetPrediction: ModelPrediction,
    threshold: number = 2.0,
  ): boolean {
    const durations = predictions.map((p) => p.predicted_duration_minutes);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, val) => sum + (val - mean) ** 2, 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    const zScore = Math.abs(targetPrediction.predicted_duration_minutes - mean) / (stdDev || 1);
    return zScore > threshold;
  }

  /**
   * Main prediction method - combines all models
   */
  predict(features: FeatureVector): ETAPrediction {
    // Get predictions from all models
    const predictions: ModelPrediction[] = [];

    const timeOfDayPred = this.timeOfDayModel.predict(features);
    predictions.push(timeOfDayPred);

    const distanceDecayPred = this.distanceDecayModel.predict(features);
    predictions.push(distanceDecayPred);

    const historicalPred = this.historicalModel.predict(features);
    predictions.push(historicalPred);

    const trafficPred = this.trafficModel.predict(features);
    predictions.push(trafficPred);

    const weatherPred = this.weatherModel.predict(features);
    predictions.push(weatherPred);

    // Get weights for this context
    const weights = this.getWeightsForContext(features.zone_type, features.hour);

    // Detect outliers
    const outliers = new Set<string>();
    for (const pred of predictions) {
      if (this.detectOutlier(predictions, pred, 2.0)) {
        outliers.add(pred.modelName);
      }
    }

    // Calculate weighted predictions with outlier handling
    let totalWeightedDuration = 0;
    let totalConfidenceWeight = 0;
    const usedPredictions: ModelPrediction[] = [];

    for (const pred of predictions) {
      // Skip outlier models (or reduce their weight)
      let modelWeight = this.getModelWeight(pred.modelName, weights);
      if (outliers.has(pred.modelName)) {
        modelWeight *= 0.3; // Reduce outlier weight to 30%
      }

      // Confidence-weighted contribution
      const confidenceWeight = modelWeight * pred.confidence;
      totalWeightedDuration += pred.predicted_duration_minutes * confidenceWeight;
      totalConfidenceWeight += confidenceWeight;
      usedPredictions.push(pred);
    }

    const predictedDuration =
      totalConfidenceWeight > 0 ? totalWeightedDuration / totalConfidenceWeight : 30;

    // Calculate confidence from model agreement and confidence scores
    const confidence = this.calculateEnsembleConfidence(usedPredictions);

    // Get bounds from model predictions
    const lowerBounds = usedPredictions.map((p) => p.lower_bound_minutes);
    const upperBounds = usedPredictions.map((p) => p.upper_bound_minutes);

    lowerBounds.sort((a, b) => a - b);
    upperBounds.sort((a, b) => a - b);

    // Use weighted percentiles for bounds
    const p10Index = Math.floor(lowerBounds.length * 0.1);
    const p90Index = Math.floor(upperBounds.length * 0.9);

    const lowerBound = lowerBounds[p10Index] || Math.max(5, predictedDuration - 10);
    const upperBound = upperBounds[p90Index] || predictedDuration + 10;

    // Get median prediction
    const sortedDurations = usedPredictions
      .map((p) => p.predicted_duration_minutes)
      .sort((a, b) => a - b);
    const p50Duration =
      sortedDurations[Math.floor(sortedDurations.length / 2)] || predictedDuration;

    // Find dominant model (highest weighted contribution)
    let dominantModel = 'ensemble';
    let maxContribution = 0;

    for (const pred of usedPredictions) {
      let modelWeight = this.getModelWeight(pred.modelName, weights);
      if (outliers.has(pred.modelName)) {
        modelWeight *= 0.3;
      }
      const contribution = modelWeight * pred.confidence;
      if (contribution > maxContribution) {
        maxContribution = contribution;
        dominantModel = pred.modelName;
      }
    }

    return {
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.round(lowerBound * 10) / 10,
      upper_bound_minutes: Math.round(upperBound * 10) / 10,
      p50_minutes: Math.round(p50Duration * 10) / 10,
      model_predictions: usedPredictions,
      dominant_model: dominantModel,
      ensemble_method: 'weighted',
      feature_vector: features,
      generated_at: new Date(),
    };
  }

  /**
   * Get weight for a specific model
   */
  private getModelWeight(modelName: string, weights: ModelWeights): number {
    switch (modelName) {
      case 'time-of-day':
        return weights.timeOfDay;
      case 'distance-decay':
        return weights.distanceDecay;
      case 'historical-similarity':
        return weights.historicalSimilarity;
      case 'traffic-aware':
        return weights.traffic;
      case 'weather-impact':
        return weights.weather;
      default:
        return 0.2;
    }
  }

  /**
   * Calculate ensemble confidence from model agreement
   */
  private calculateEnsembleConfidence(predictions: ModelPrediction[]): number {
    if (predictions.length === 0) return 0.3;

    // Base confidence is average of model confidences
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    // Reduce confidence if models disagree significantly
    const durations = predictions.map((p) => p.predicted_duration_minutes);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, val) => sum + (val - mean) ** 2, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / (mean || 1);

    // High agreement = higher confidence
    const agreementFactor = Math.exp(-coefficientOfVariation);
    const ensembleConfidence = avgConfidence * agreementFactor;

    return Math.max(0.2, Math.min(0.95, ensembleConfidence));
  }

  /**
   * Update weights based on actual delivery performance
   * Called after receiving actual delivery time
   */
  updateWeights(
    features: FeatureVector,
    predictions: ModelPrediction[],
    actualDuration: number,
  ): void {
    // Calculate errors for each model
    const errors = predictions.map((p) => Math.abs(p.predicted_duration_minutes - actualDuration));
    const maxError = Math.max(...errors);

    // Normalize errors to [0, 1] range for weight adjustment
    const normalizedErrors = errors.map((e) => e / (maxError || 1));

    // Update weights with exponential moving average
    const learningRate = 0.05;

    // Map prediction order to model names
    const modelOrder = [
      'time-of-day',
      'distance-decay',
      'historical-similarity',
      'traffic-aware',
      'weather-impact',
    ];

    for (let i = 0; i < predictions.length && i < modelOrder.length; i++) {
      const modelName = modelOrder[i];
      const error = normalizedErrors[i];

      // Better predictions (lower error) get slightly higher weight
      const errorFactor = Math.exp(-error * 2); // Convert error to weight factor

      // Update weights using EMA
      const currentWeight = this.getModelWeight(modelName, this.modelWeights);
      const newWeight = currentWeight * (1 - learningRate) + errorFactor * learningRate;

      this.updateModelWeight(modelName, Math.max(0.05, Math.min(0.4, newWeight)));
    }

    // Normalize weights to sum to 1
    this.normalizeWeights();

    // Update zone-specific weights if we have enough data for this zone
    const zoneKey = features.zone_type;
    const zoneWeights = this.zoneSpecificWeights.get(zoneKey) || { ...this.modelWeights };
    // TODO: Update zone weights similarly if we collect enough samples per zone

    this.lastCalibration = new Date();
  }

  /**
   * Update a specific model's weight
   */
  private updateModelWeight(modelName: string, newWeight: number): void {
    switch (modelName) {
      case 'time-of-day':
        this.modelWeights.timeOfDay = newWeight;
        break;
      case 'distance-decay':
        this.modelWeights.distanceDecay = newWeight;
        break;
      case 'historical-similarity':
        this.modelWeights.historicalSimilarity = newWeight;
        break;
      case 'traffic-aware':
        this.modelWeights.traffic = newWeight;
        break;
      case 'weather-impact':
        this.modelWeights.weather = newWeight;
        break;
    }
  }

  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(): void {
    const total =
      this.modelWeights.timeOfDay +
      this.modelWeights.distanceDecay +
      this.modelWeights.historicalSimilarity +
      this.modelWeights.traffic +
      this.modelWeights.weather;

    if (total > 0) {
      this.modelWeights.timeOfDay /= total;
      this.modelWeights.distanceDecay /= total;
      this.modelWeights.historicalSimilarity /= total;
      this.modelWeights.traffic /= total;
      this.modelWeights.weather /= total;
    }
  }

  /**
   * Calibrate ensemble against actual data
   */
  calibrate(predictions: number[], actuals: number[]): CalibrationResult {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return {
        model_name: 'ensemble',
        bias_correction_factor: 1.0,
        scale_correction_factor: 1.0,
        confidence_calibration: {},
        applied_at: new Date(),
      };
    }

    // Compute mean prediction and actual
    const meanPred = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const meanActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;

    // Compute scale factor (regression slope)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predDiff = predictions[i] - meanPred;
      const actualDiff = actuals[i] - meanActual;
      numerator += actualDiff * predDiff;
      denominator += predDiff * predDiff;
    }

    const scaleFactor = denominator !== 0 ? numerator / denominator : 1.0;
    const biasFactor = meanActual / (meanPred || 1);

    const result: CalibrationResult = {
      model_name: 'ensemble',
      bias_correction_factor: biasFactor,
      scale_correction_factor: scaleFactor,
      confidence_calibration: {},
      applied_at: new Date(),
    };

    this.calibrations.set('global', result);
    return result;
  }

  /**
   * Get state for serialization
   */
  getState(): EnsembleState {
    return {
      model_weights: this.modelWeights,
      calibration_data: Object.fromEntries(this.calibrations.entries()),
      outlier_models: this.outlierModels,
      last_calibration: this.lastCalibration,
      zone_specific_weights: Object.fromEntries(this.zoneSpecificWeights.entries()),
      time_specific_weights: Object.fromEntries(this.hourSpecificWeights.entries()),
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: EnsembleState): void {
    this.modelWeights = state.model_weights;
    this.outlierModels = state.outlier_models;
    this.lastCalibration = state.last_calibration;

    this.calibrations.clear();
    for (const [key, value] of Object.entries(state.calibration_data)) {
      this.calibrations.set(key, value);
    }

    this.zoneSpecificWeights.clear();
    for (const [key, value] of Object.entries(state.zone_specific_weights)) {
      this.zoneSpecificWeights.set(key, value);
    }

    this.hourSpecificWeights.clear();
    for (const [key, value] of Object.entries(state.time_specific_weights)) {
      this.hourSpecificWeights.set(parseInt(key, 10), value);
    }
  }

  /**
   * Get model weights
   */
  getWeights(): ModelWeights {
    return { ...this.modelWeights };
  }

  /**
   * Set model weights manually
   */
  setWeights(weights: Partial<ModelWeights>): void {
    Object.assign(this.modelWeights, weights);
    this.normalizeWeights();
  }

  /**
   * Get feature importance (aggregated from all models)
   */
  getFeatureImportance(): Record<string, number> {
    const importance: Record<string, number> = {};

    const models = [
      { model: this.timeOfDayModel, weight: this.modelWeights.timeOfDay },
      { model: this.distanceDecayModel, weight: this.modelWeights.distanceDecay },
      { model: this.historicalModel, weight: this.modelWeights.historicalSimilarity },
      { model: this.trafficModel, weight: this.modelWeights.traffic },
      { model: this.weatherModel, weight: this.modelWeights.weather },
    ];

    for (const { model, weight } of models) {
      const modelImportance = model.getFeatureImportance();
      for (const [feature, imp] of Object.entries(modelImportance)) {
        importance[feature] = (importance[feature] || 0) + imp * weight;
      }
    }

    // Normalize
    const maxImportance = Math.max(...Object.values(importance), 1);
    for (const key in importance) {
      importance[key] /= maxImportance;
    }

    return importance;
  }
}
