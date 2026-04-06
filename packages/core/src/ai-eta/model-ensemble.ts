/**
 * Model Ensemble
 *
 * Combines predictions from multiple ETA models using weighted averaging.
 * Dynamically adjusts weights based on recent model accuracy.
 *
 * Models:
 * - TimeOfDayModel: Adjusts for rush hours
 * - DistanceModel: Linear regression on distance
 * - HistoricalModel: Similar past routes
 * - TrafficModel: Real-time traffic data
 */

import type {
  ModelPrediction,
  ETAPrediction,
  AccuracyMetrics,
  TimeInterval,
  Coordinates,
} from './types.js';

/**
 * Model instance with metadata
 */
interface ModelInstance {
  name: string;
  predict: (params: any) => ModelPrediction;
  lastAccuracy?: AccuracyMetrics;
  weight: number;
  enabled: boolean;
}

export class ModelEnsemble {
  /**
   * Registered models
   */
  private models: Map<string, ModelInstance> = new Map();

  /**
   * Model accuracy tracking
   */
  private accuracyMetrics: Map<string, AccuracyMetrics> = new Map();

  /**
   * Prediction history for calibration
   */
  private predictionHistory: Array<{
    prediction: ETAPrediction;
    actualTime: Date;
  }> = [];

  /**
   * Default weights
   */
  private readonly DEFAULT_WEIGHTS = {
    'TimeOfDayModel': 0.25,
    'DistanceModel': 0.3,
    'HistoricalModel': 0.25,
    'TrafficModel': 0.2,
  };

  /**
   * Register a model
   */
  registerModel(
    name: string,
    predictor: (params: any) => ModelPrediction,
    enabled: boolean = true,
    weight?: number,
  ): void {
    this.models.set(name, {
      name,
      predict: predictor,
      weight: weight ?? this.DEFAULT_WEIGHTS[name as keyof typeof this.DEFAULT_WEIGHTS] ?? 0.25,
      enabled,
    });
  }

  /**
   * Enable/disable a model
   */
  setModelEnabled(name: string, enabled: boolean): void {
    const model = this.models.get(name);
    if (model) {
      model.enabled = enabled;
    }
  }

  /**
   * Set model weight
   */
  setModelWeight(name: string, weight: number): void {
    const model = this.models.get(name);
    if (model) {
      model.weight = Math.max(0, Math.min(1, weight));
    }
  }

  /**
   * Combine predictions from multiple models
   */
  combineETAs(
    predictions: ModelPrediction[],
    departureTime: Date,
  ): ETAPrediction {
    if (predictions.length === 0) {
      return this.getEmptyPrediction(departureTime);
    }

    // Filter and validate predictions
    const validPredictions = predictions.filter(
      (p) =>
        p.prediction &&
        p.prediction.expected &&
        !isNaN(p.prediction.expected.getTime()),
    );

    if (validPredictions.length === 0) {
      return this.getEmptyPrediction(departureTime);
    }

    // Get weighted models.
    // Apply a minimum confidence floor (0.1) so models that have zero historical
    // confidence (cold-start) can still contribute via their default multipliers
    // (e.g. TimeOfDayModel rush-hour factor, DistanceModel zone speeds).
    // Without the floor, zero-confidence models are discarded, letting a single
    // moderate-confidence model (TrafficModel fallback) dominate and erasing any
    // time-of-day differentiation.
    const MIN_CONFIDENCE = 0.1;
    const weightedModels = validPredictions
      .map((pred) => {
        const model = this.models.get(pred.modelName);
        const weight = model ? model.weight : 1 / validPredictions.length;
        const confidence = Math.max(pred.confidence ?? 0, MIN_CONFIDENCE);

        return {
          prediction: pred,
          weight: weight * confidence,
        };
      })
      .filter((m) => m.weight > 0);

    // Normalize weights
    const totalWeight = weightedModels.reduce(
      (sum, m) => sum + m.weight,
      0,
    );
    const normalizedModels = weightedModels.map((m) => ({
      ...m,
      weight: m.weight / totalWeight,
    }));

    // Combine time intervals
    const combinedInterval = this.combineTimeIntervals(
      normalizedModels.map((m) => ({
        interval: m.prediction.prediction,
        weight: m.weight,
      })),
    );

    // Average confidence
    const avgConfidence =
      normalizedModels.reduce(
        (sum, m) => sum + m.prediction.confidence * m.weight,
        0,
      ) / normalizedModels.length;

    // Select best model (highest accuracy)
    let bestModel = validPredictions[0]!;
    let bestAccuracy = 0;

    for (const pred of validPredictions) {
      const metrics = this.accuracyMetrics.get(pred.modelName);
      const accuracy = metrics ? 1 - (metrics.meanAbsoluteError / 60) : 0.5;

      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestModel = pred;
      }
    }

    return {
      origin: { lat: 0, lng: 0 },
      destination: { lat: 0, lng: 0 },
      departureTime,
      prediction: combinedInterval,
      confidence: Math.max(0, Math.min(1, avgConfidence)),
      modelUsed: 'Ensemble',
      modelsConsidered: validPredictions.map((p) => p.modelName),
      trafficCondition: 'unknown',
    };
  }

  /**
   * Combine time intervals using weighted median
   */
  private combineTimeIntervals(
    weightedIntervals: Array<{
      interval: TimeInterval;
      weight: number;
    }>,
  ): TimeInterval {
    // Extract all time points with weights
    const points: Array<{
      time: number;
      weight: number;
      type: 'low' | 'expected' | 'high';
    }> = [];

    weightedIntervals.forEach(({ interval, weight }) => {
      points.push({
        time: interval.low.getTime(),
        weight: weight * 0.25, // Lower weight for low
        type: 'low',
      });
      points.push({
        time: interval.expected.getTime(),
        weight: weight * 0.5, // Higher weight for expected
        type: 'expected',
      });
      points.push({
        time: interval.high.getTime(),
        weight: weight * 0.25, // Lower weight for high
        type: 'high',
      });
    });

    // Sort by time
    points.sort((a, b) => a.time - b.time);

    // Find weighted percentiles
    const low = this.weightedPercentile(points, 0.15);
    const expected = this.weightedPercentile(points, 0.5);
    const high = this.weightedPercentile(points, 0.85);

    return {
      low: new Date(low),
      expected: new Date(expected),
      high: new Date(high),
    };
  }

  /**
   * Calculate weighted percentile
   */
  private weightedPercentile(
    points: Array<{ time: number; weight: number }>,
    percentile: number,
  ): number {
    const totalWeight = points.reduce((sum, p) => sum + p.weight, 0);
    let cumulativeWeight = 0;

    for (const point of points) {
      cumulativeWeight += point.weight;
      if (cumulativeWeight >= totalWeight * percentile) {
        return point.time;
      }
    }

    return points[points.length - 1]!.time;
  }

  /**
   * Get empty prediction (fallback)
   */
  private getEmptyPrediction(departureTime: Date): ETAPrediction {
    const expected = new Date(departureTime.getTime() + 30 * 60000); // 30 min default
    const stdDev = 10 * 60000; // 10 min std dev

    return {
      origin: { lat: 0, lng: 0 },
      destination: { lat: 0, lng: 0 },
      departureTime,
      prediction: {
        low: new Date(expected.getTime() - stdDev * 1.96),
        expected,
        high: new Date(expected.getTime() + stdDev * 1.96),
      },
      confidence: 0.3,
      modelUsed: 'Fallback',
      modelsConsidered: [],
      trafficCondition: 'unknown',
    };
  }

  /**
   * Update model accuracy based on actual delivery
   */
  recordActualDelivery(
    prediction: ETAPrediction,
    actualTime: Date,
  ): void {
    // Record in history
    this.predictionHistory.push({ prediction, actualTime });

    // Keep only last 1000 predictions
    if (this.predictionHistory.length > 1000) {
      this.predictionHistory = this.predictionHistory.slice(-1000);
    }

    // Recalculate model accuracy
    this.recalculateModelAccuracy();
  }

  /**
   * Recalculate accuracy for all models
   */
  private recalculateModelAccuracy(): void {
    const modelPredictions: Map<string, number[]> = new Map();

    this.predictionHistory.forEach(({ prediction, actualTime }) => {
      const expectedTime = prediction.prediction.expected.getTime();
      const error = Math.abs(actualTime.getTime() - expectedTime) / 60000; // Convert to minutes

      for (const modelName of prediction.modelsConsidered) {
        if (!modelPredictions.has(modelName)) {
          modelPredictions.set(modelName, []);
        }
        modelPredictions.get(modelName)!.push(error);
      }
    });

    // Calculate metrics for each model
    modelPredictions.forEach((errors, modelName) => {
      if (errors.length === 0) return;

      const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
      const rmse = Math.sqrt(
        errors.reduce((sum, e) => sum + e * e, 0) / errors.length,
      );

      const sorted = [...errors].sort((a, b) => a - b);
      const medianIndex = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[medianIndex - 1]! + sorted[medianIndex]!) / 2
          : sorted[medianIndex]!;

      const metrics: AccuracyMetrics = {
        modelName,
        meanAbsoluteError: mae,
        rootMeanSquareError: rmse,
        medianAbsoluteError: median,
        percentileErrors: {
          p50: sorted[Math.floor(sorted.length * 0.5)]!,
          p90: sorted[Math.floor(sorted.length * 0.9)]!,
          p95: sorted[Math.floor(sorted.length * 0.95)]!,
        },
        sampleSize: errors.length,
        lastUpdated: new Date(),
        accuracy: Math.max(0, 1 - mae / 60),
      };

      this.accuracyMetrics.set(modelName, metrics);

      // Adjust weight based on accuracy
      const model = this.models.get(modelName);
      if (model) {
        // Better accuracy = higher weight
        const accuracyFactor = metrics.accuracy;
        model.weight =
          this.DEFAULT_WEIGHTS[modelName as keyof typeof this.DEFAULT_WEIGHTS] *
          accuracyFactor;
      }
    });
  }

  /**
   * Get model accuracy
   */
  getModelAccuracy(modelName: string): AccuracyMetrics | null {
    return this.accuracyMetrics.get(modelName) ?? null;
  }

  /**
   * Get all model accuracies
   */
  getAllAccuracies(): AccuracyMetrics[] {
    return Array.from(this.accuracyMetrics.values());
  }

  /**
   * Get model statistics
   */
  getStatistics(): {
    registeredModels: number;
    enabledModels: number;
    predictionsRecorded: number;
    averageEnsembleAccuracy: number;
  } {
    const enabledCount = Array.from(this.models.values()).filter(
      (m) => m.enabled,
    ).length;

    const accuracies = Array.from(this.accuracyMetrics.values());
    const avgAccuracy =
      accuracies.length > 0
        ? accuracies.reduce((sum, m) => sum + m.accuracy, 0) /
          accuracies.length
        : 0;

    return {
      registeredModels: this.models.size,
      enabledModels: enabledCount,
      predictionsRecorded: this.predictionHistory.length,
      averageEnsembleAccuracy: avgAccuracy,
    };
  }

  /**
   * Clear prediction history
   */
  clearHistory(): void {
    this.predictionHistory = [];
  }

  /**
   * Reset model weights to defaults
   */
  resetWeights(): void {
    this.models.forEach((model) => {
      model.weight =
        this.DEFAULT_WEIGHTS[model.name as keyof typeof this.DEFAULT_WEIGHTS] ??
        0.25;
    });
  }
}

/**
 * Singleton instance
 */
export const modelEnsemble = new ModelEnsemble();
