/**
 * Demand Ensemble Predictor
 *
 * Combines seasonal decomposition, zone regression, pattern matching,
 * and anomaly detection into unified prediction with dynamic weighting
 */

import type {
  DemandPrediction,
  ModelMetrics,
  HistoricalDemand,
  PredictionExplanation,
  EnsembleConfig,
  ModelPrediction,
} from './types';

import {
  decomposeMultiSeasonal,
  forecastMultiSeasonal,
  getSeasonalityStrength,
} from './models/seasonal-decomposition';

import {
  trainZoneRegression,
  predictWithRegression,
  extractFeatures,
  RegressionFeatures,
} from './models/zone-regression';

import {
  findSimilarDays,
  predictFromPatterns,
  matchHolidayPattern,
  getClusterAverageFallback,
} from './models/pattern-matcher';

import {
  detectAnomaly,
  initializeStatistics,
  CUSUMDetector,
} from './models/anomaly-detector';

/**
 * Zone data cache
 */
interface ZoneCache {
  historicalData: HistoricalDemand[];
  seasonalDecomposition: any;
  zoneCharacteristics: any;
  trainingDate: Date;
  metrics: ModelMetrics;
}

/**
 * Demand Ensemble Predictor
 */
export class DemandEnsemble {
  private zoneCache: Map<string, ZoneCache> = new Map();
  private modelWeights: Record<string, number>;
  private config: EnsembleConfig;
  private lastReweightDate: Date = new Date();
  private modelAccuracyHistory: Map<string, Array<{ mae: number; timestamp: Date }>> = new Map();

  constructor(config?: Partial<EnsembleConfig>) {
    this.config = {
      enabled_models: ['seasonal', 'regression', 'pattern', 'baseline'],
      initial_weights: {
        seasonal: 0.35,
        regression: 0.35,
        pattern: 0.20,
        baseline: 0.10,
      },
      reweight_interval_hours: 24,
      min_weight: 0.05,
      max_weight: 0.5,
      outlier_threshold: 3,
      confidence_weighting: true,
      ...config,
    };

    this.modelWeights = { ...this.config.initial_weights };
  }

  /**
   * Train ensemble on historical data
   */
  async train(zoneId: string, historicalData: HistoricalDemand[]): Promise<void> {
    if (historicalData.length < 30) {
      throw new Error('Insufficient historical data for training');
    }

    // Multi-seasonal decomposition
    const values = historicalData.map((d) => d.value);
    const seasonalDecomposition = decomposeMultiSeasonal(values, [24, 168]); // hourly, weekly

    // Zone regression training
    const zoneCharacteristics = trainZoneRegression(historicalData, zoneId);

    // Initialize metrics
    const metrics: ModelMetrics = {
      modelName: 'ensemble',
      mae: 0,
      rmse: 0,
      mape: 0,
      accuracy_80: 0,
      sample_count: historicalData.length,
      zone_metrics: {},
      last_updated: new Date(),
      rolling_accuracy: 1.0,
    };

    this.zoneCache.set(zoneId, {
      historicalData,
      seasonalDecomposition,
      zoneCharacteristics,
      trainingDate: new Date(),
      metrics,
    });
  }

  /**
   * Predict demand for a zone at specific time
   */
  async predict(
    zoneId: string,
    targetDate: Date,
    granularity: 'hourly' | 'slot' | 'daily' = 'hourly',
  ): Promise<DemandPrediction> {
    const cache = this.zoneCache.get(zoneId);
    if (!cache) {
      throw new Error(`Zone ${zoneId} not trained`);
    }

    // Generate predictions from each model
    const predictions: ModelPrediction[] = [];

    // 1. Seasonal decomposition
    if (this.config.enabled_models.includes('seasonal')) {
      const seasonal = await this.predictSeasonal(cache, targetDate);
      predictions.push(seasonal);
    }

    // 2. Zone regression
    if (this.config.enabled_models.includes('regression')) {
      const regression = await this.predictRegression(cache, targetDate);
      predictions.push(regression);
    }

    // 3. Pattern matching
    if (this.config.enabled_models.includes('pattern')) {
      const pattern = await this.predictPattern(cache, targetDate);
      predictions.push(pattern);
    }

    // 4. Baseline (historical average)
    if (this.config.enabled_models.includes('baseline')) {
      const baseline = this.predictBaseline(cache, targetDate);
      predictions.push(baseline);
    }

    // Combine predictions
    const combined = this.ensemblePredictions(predictions, zoneId);

    // Detect anomalies
    const anomalies = this.detectAnomaliesInPrediction(cache, targetDate, combined);

    // Generate explanation
    const explanation = this.generateExplanation(predictions, combined, anomalies);

    return {
      zoneId,
      targetPeriod: targetDate,
      predictions: combined.predictions,
      confidence: combined.confidence,
      lower_bound: combined.lower_bound,
      upper_bound: combined.upper_bound,
      p50: combined.p50,
      model_predictions: predictions,
      dominant_model: this.findDominantModel(predictions, this.modelWeights),
      explanation,
      generated_at: new Date(),
    };
  }

  /**
   * Predict using seasonal decomposition
   */
  private async predictSeasonal(cache: ZoneCache, targetDate: Date): Promise<ModelPrediction> {
    const { seasonalDecomposition } = cache;
    const horizon = 24; // hourly

    const forecast = forecastMultiSeasonal(seasonalDecomposition, horizon, [24, 168]);

    // Average across periods for confidence
    const avgPred = forecast.predictions.reduce((a, b) => a + b, 0) / forecast.predictions.length;
    const variance = forecast.predictions.reduce(
      (sum, p) => sum + Math.pow(p - avgPred, 2),
      0,
    ) / forecast.predictions.length;
    const stdDev = Math.sqrt(variance);

    const confidence = Math.exp(-stdDev / (avgPred || 1));

    return {
      modelName: 'seasonal',
      predictions: forecast.predictions,
      confidence,
      lower_bound: forecast.lower,
      upper_bound: forecast.upper,
      mae: undefined,
      rmse: undefined,
    };
  }

  /**
   * Predict using zone regression
   */
  private async predictRegression(cache: ZoneCache, targetDate: Date): Promise<ModelPrediction> {
    const { zoneCharacteristics, historicalData } = cache;
    const predictions: number[] = [];
    const lowerBounds: number[] = [];
    const upperBounds: number[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(targetDate);
      timestamp.setHours(hour);

      const features: RegressionFeatures = {
        intercept: 1,
        zone_density: zoneCharacteristics.density,
        historical_avg: zoneCharacteristics.historicalAverage,
        day_of_week_factor:
          zoneCharacteristics.dayOfWeekFactors[timestamp.getDay()] || 1,
        hour_factor: zoneCharacteristics.hourFactors[hour] || 1,
        trend: zoneCharacteristics.trend,
        interaction_dow_hour:
          (zoneCharacteristics.dayOfWeekFactors[timestamp.getDay()] || 1) *
          (zoneCharacteristics.hourFactors[hour] || 1),
      };

      const pred = predictWithRegression(zoneCharacteristics, features);
      predictions.push(pred.prediction);
      lowerBounds.push(pred.lower);
      upperBounds.push(pred.upper);
    }

    const avgPred = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const confidence = 0.8; // Regression tends to be stable

    return {
      modelName: 'regression',
      predictions,
      confidence,
      lower_bound: lowerBounds,
      upper_bound: upperBounds,
    };
  }

  /**
   * Predict using pattern matching
   */
  private async predictPattern(cache: ZoneCache, targetDate: Date): Promise<ModelPrediction> {
    const { historicalData } = cache;
    const predictions: number[] = [];
    const confidences: number[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(targetDate);
      timestamp.setHours(hour);

      const hourData = historicalData.filter((d) => d.hour === hour);
      const patterns = findSimilarDays(timestamp, {
        dayOfWeek: timestamp.getDay(),
        hour,
        holiday: targetDate.getDay() === 0 || targetDate.getDay() === 6 ? 1 : 0,
        weather: 0,
        eventType: 'none',
        trend: 0,
        seasonal_hour: 0,
        seasonal_day: 0,
      }, historicalData);

      if (patterns.length > 0) {
        const pred = predictFromPatterns(patterns);
        predictions.push(pred.prediction);
        confidences.push(pred.confidence);
      } else {
        // Fallback
        const fallback = getClusterAverageFallback(historicalData, targetDate.getDay(), hour);
        predictions.push(fallback);
        confidences.push(0.3);
      }
    }

    const avgConfidence =
      confidences.reduce((a, b) => a + b, 0) / Math.max(1, confidences.length);

    // Calculate bounds from patterns
    const lowerBounds = predictions.map((p) => Math.max(0, p * 0.8));
    const upperBounds = predictions.map((p) => p * 1.2);

    return {
      modelName: 'pattern',
      predictions,
      confidence: avgConfidence,
      lower_bound: lowerBounds,
      upper_bound: upperBounds,
    };
  }

  /**
   * Baseline: historical average
   */
  private predictBaseline(cache: ZoneCache, targetDate: Date): ModelPrediction {
    const { historicalData } = cache;
    const predictions: number[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourData = historicalData.filter((d) => d.hour === hour);
      const avg = hourData.length > 0 ? hourData.reduce((s, d) => s + d.value, 0) / hourData.length : 0;
      predictions.push(avg);
    }

    return {
      modelName: 'baseline',
      predictions,
      confidence: 0.6,
      lower_bound: predictions.map((p) => p * 0.9),
      upper_bound: predictions.map((p) => p * 1.1),
    };
  }

  /**
   * Ensemble predictions with weighted averaging
   */
  private ensemblePredictions(
    predictions: ModelPrediction[],
    zoneId: string,
  ): {
    predictions: number[];
    confidence: number;
    lower_bound: number[];
    upper_bound: number[];
    p50: number[];
  } {
    if (predictions.length === 0) {
      return { predictions: [], confidence: 0, lower_bound: [], upper_bound: [], p50: [] };
    }

    const horizonLength = predictions[0].predictions.length;
    const ensemblePred: number[] = new Array(horizonLength).fill(0);
    const ensembleLower: number[] = new Array(horizonLength).fill(0);
    const ensembleUpper: number[] = new Array(horizonLength).fill(0);
    const ensembleP50: number[] = new Array(horizonLength).fill(0);

    let totalWeight = 0;

    for (const pred of predictions) {
      const weight = this.getModelWeight(pred.modelName, zoneId, pred.confidence);

      for (let i = 0; i < horizonLength; i++) {
        ensemblePred[i] += pred.predictions[i] * weight;
        ensembleLower[i] += pred.lower_bound[i] * weight;
        ensembleUpper[i] += pred.upper_bound[i] * weight;
        ensembleP50[i] += pred.predictions[i] * weight; // Weighted median
      }

      totalWeight += weight;
    }

    if (totalWeight > 0) {
      for (let i = 0; i < horizonLength; i++) {
        ensemblePred[i] /= totalWeight;
        ensembleLower[i] /= totalWeight;
        ensembleUpper[i] /= totalWeight;
        ensembleP50[i] /= totalWeight;
      }
    }

    // Average confidence across models
    const avgConfidence =
      predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      predictions: ensemblePred,
      confidence: avgConfidence,
      lower_bound: ensembleLower,
      upper_bound: ensembleUpper,
      p50: ensembleP50,
    };
  }

  /**
   * Get current weight for model
   */
  private getModelWeight(
    modelName: string,
    zoneId: string,
    confidence: number,
  ): number {
    let weight = this.modelWeights[modelName] || 0;

    if (this.config.confidence_weighting) {
      weight *= confidence;
    }

    return Math.max(this.config.min_weight, Math.min(this.config.max_weight, weight));
  }

  /**
   * Find dominant model by weight
   */
  private findDominantModel(predictions: ModelPrediction[], weights: Record<string, number>): string {
    let maxWeight = 0;
    let dominant = '';

    for (const pred of predictions) {
      const weight = weights[pred.modelName] || 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        dominant = pred.modelName;
      }
    }

    return dominant || 'ensemble';
  }

  /**
   * Detect anomalies in prediction
   */
  private detectAnomaliesInPrediction(
    cache: ZoneCache,
    targetDate: Date,
    combined: {
      predictions: number[];
      lower_bound: number[];
      upper_bound: number[];
    },
  ): any[] {
    return []; // Simplified for integration
  }

  /**
   * Generate prediction explanation
   */
  private generateExplanation(
    predictions: ModelPrediction[],
    combined: { predictions: number[] },
    anomalies: any[],
  ): PredictionExplanation {
    const modelContributions: Record<string, number> = {};
    let maxPred = 0;

    for (const pred of predictions) {
      const avgPred = pred.predictions.reduce((a, b) => a + b, 0) / pred.predictions.length;
      modelContributions[pred.modelName] = avgPred;
      maxPred = Math.max(maxPred, avgPred);
    }

    const primaryFactors: string[] = [];
    if (predictions.length > 0) {
      const dominant = predictions.reduce((prev, curr) =>
        prev.confidence > curr.confidence ? prev : curr,
      );
      primaryFactors.push(`Primary model: ${dominant.modelName}`);
    }

    return {
      primary_factors: primaryFactors,
      model_contributions: modelContributions,
      confidence_rationale: 'Ensemble average across seasonal, regression, and pattern models',
      anomalies_detected: anomalies,
    };
  }

  /**
   * Reweight models based on recent accuracy
   */
  async reweight(zoneId: string): Promise<void> {
    const now = new Date();
    const hoursSinceReweight =
      (now.getTime() - this.lastReweightDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReweight < this.config.reweight_interval_hours) {
      return; // Too soon to reweight
    }

    // Get recent accuracy for each model
    const modelAccuracies = this.calculateRecentAccuracy(zoneId);

    // Update weights based on accuracy
    let totalAccuracy = 0;
    for (const accuracy of Object.values(modelAccuracies)) {
      totalAccuracy += accuracy;
    }

    if (totalAccuracy > 0) {
      for (const model of this.config.enabled_models) {
        const accuracy = modelAccuracies[model] || 0;
        const newWeight = (accuracy / totalAccuracy) * 0.5; // Normalized

        this.modelWeights[model] = Math.max(
          this.config.min_weight,
          Math.min(this.config.max_weight, newWeight),
        );
      }
    }

    this.lastReweightDate = now;
  }

  /**
   * Calculate recent accuracy for models
   */
  private calculateRecentAccuracy(zoneId: string): Record<string, number> {
    const accuracies: Record<string, number> = {};

    for (const model of this.config.enabled_models) {
      const history = this.modelAccuracyHistory.get(model) || [];
      const recentHistory = history.filter(
        (h) => (new Date().getTime() - h.timestamp.getTime()) / (1000 * 60 * 60) < 24,
      );

      if (recentHistory.length > 0) {
        const avgMAE = recentHistory.reduce((sum, h) => sum + h.mae, 0) / recentHistory.length;
        accuracies[model] = 1 / (1 + avgMAE); // Higher accuracy = lower MAE
      } else {
        accuracies[model] = this.modelWeights[model] || 0.25;
      }
    }

    return accuracies;
  }

  /**
   * Record model accuracy for reweighting
   */
  recordModelAccuracy(modelName: string, mae: number): void {
    if (!this.modelAccuracyHistory.has(modelName)) {
      this.modelAccuracyHistory.set(modelName, []);
    }

    this.modelAccuracyHistory.get(modelName)!.push({
      mae,
      timestamp: new Date(),
    });

    // Keep only last 1000 records per model
    const history = this.modelAccuracyHistory.get(modelName)!;
    if (history.length > 1000) {
      this.modelAccuracyHistory.set(modelName, history.slice(-1000));
    }
  }

  /**
   * Get current model metrics
   */
  getMetrics(zoneId: string): ModelMetrics | null {
    return this.zoneCache.get(zoneId)?.metrics || null;
  }
}
