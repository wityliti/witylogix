/**
 * ETA Prediction Engine
 *
 * Predicts delivery Estimated Time of Arrival using:
 * - Feature extraction: distance, time of day, day of week, traffic zone, etc.
 * - Simple regression model (weights-based, no external ML library)
 * - Historical accuracy tracking
 * - Confidence interval calculation
 * - Fallback to distance/speed when insufficient data
 */

import type { PredictionResult } from "./types.js";

/**
 * Features used for ETA prediction.
 */
export interface PredictionFeatures {
  /** Distance to destination in kilometers. */
  distance: number;

  /** Time of day (0-23 hours). */
  timeOfDay: number;

  /** Day of week (0-6, where 0 is Sunday). */
  dayOfWeek: number;

  /** Traffic/congestion zone identifier. */
  trafficZone: string;

  /** Driver's average speed history in km/h. */
  driverSpeedHistory: number;

  /** Number of stops remaining. */
  stopsRemaining: number;
}

/**
 * Historical prediction data point for accuracy tracking.
 */
interface PredictionHistory {
  /** Predicted time in milliseconds. */
  predicted: number;

  /** Actual time in milliseconds. */
  actual: number;

  /** Features used for prediction. */
  features: PredictionFeatures;

  /** Timestamp of prediction. */
  timestamp: string;
}

/**
 * Model weights for regression.
 */
interface ModelWeights {
  intercept: number;
  distance: number;
  timeOfDay: number;
  dayOfWeek: number;
  driverSpeedHistory: number;
  stopsRemaining: number;
  zoneFactors: Map<string, number>;
}

/**
 * Configuration for ETA predictor.
 */
interface ETAPredictorConfig {
  /** Minimum number of historical points for learning. */
  minimumTrainingData: number;

  /** Maximum training history to maintain. */
  maxHistorySize: number;

  /** Confidence interval width (standard deviations). */
  confidenceIntervalSigma: number;

  /** Default confidence level when insufficient data. */
  defaultConfidence: number;

  /** Use fallback model when insufficient training data. */
  useFallback: boolean;

  /** Base speed for fallback model (km/h). */
  fallbackBaseSpeed: number;

  /** Stop time overhead in milliseconds. */
  stopTimeOverheadMs: number;
}

/**
 * ETAPredictor class for delivery time prediction.
 */
export class ETAPredictor {
  private config: ETAPredictorConfig;
  private history: PredictionHistory[] = [];
  private weights: ModelWeights;
  private predictionCount: number = 0;

  constructor(config: Partial<ETAPredictorConfig> = {}) {
    this.config = {
      minimumTrainingData: config.minimumTrainingData ?? 20,
      maxHistorySize: config.maxHistorySize ?? 1000,
      confidenceIntervalSigma: config.confidenceIntervalSigma ?? 1.96, // 95% CI
      defaultConfidence: config.defaultConfidence ?? 0.7,
      useFallback: config.useFallback ?? true,
      fallbackBaseSpeed: config.fallbackBaseSpeed ?? 40, // km/h
      stopTimeOverheadMs: config.stopTimeOverheadMs ?? 120000, // 2 minutes per stop
    };

    this.weights = this.initializeWeights();
  }

  /**
   * Predict ETA for a shipment.
   *
   * @param shipmentId - Shipment identifier
   * @param features - Prediction features
   * @returns Prediction result with confidence intervals
   */
  predict(shipmentId: string, features: PredictionFeatures): PredictionResult {
    const timestamp = new Date().toISOString();
    const id = `prediction_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Validate features
    if (!this.validateFeatures(features)) {
      return this.createFallbackPrediction(shipmentId, features, id, timestamp);
    }

    // Use actual model if we have enough training data
    if (this.history.length >= this.config.minimumTrainingData) {
      // Update model with recent data
      this.updateWeights();

      const estimatedMs = this.predictWithModel(features);
      const accuracy = this.calculateAccuracy();
      const confidence = this.calculateConfidence(accuracy);
      const { lower, upper } = this.calculateConfidenceInterval(
        estimatedMs,
        accuracy,
      );

      this.predictionCount++;

      return {
        id,
        shipmentId,
        estimatedTimeMs: estimatedMs,
        confidenceLowerMs: lower,
        confidenceUpperMs: upper,
        confidence,
        features,
        accuracy: accuracy || undefined,
        timestamp,
        isFallback: false,
      };
    }

    // Use fallback model
    if (this.config.useFallback) {
      return this.createFallbackPrediction(shipmentId, features, id, timestamp);
    }

    // Return a generic prediction with low confidence
    const estimatedMs = (features.distance / 50) * 3600000; // Assume 50 km/h avg
    return {
      id,
      shipmentId,
      estimatedTimeMs: estimatedMs,
      confidenceLowerMs: estimatedMs * 0.7,
      confidenceUpperMs: estimatedMs * 1.3,
      confidence: 0.5,
      features,
      timestamp,
      isFallback: true,
    };
  }

  /**
   * Record actual delivery time for a prediction (training data).
   *
   * @param shipmentId - Shipment identifier
   * @param actualTimeMs - Actual time taken in milliseconds
   * @param features - Features used for the prediction
   */
  recordActual(
    shipmentId: string,
    actualTimeMs: number,
    features: PredictionFeatures,
  ): void {
    const predicted = this.predictWithModel(features);

    this.history.push({
      predicted,
      actual: actualTimeMs,
      features: { ...features },
      timestamp: new Date().toISOString(),
    });

    // Maintain history size
    if (this.history.length > this.config.maxHistorySize) {
      const itemsToRemove = this.history.length - this.config.maxHistorySize;
      this.history.splice(0, itemsToRemove);
    }

    // Periodically update weights with new data
    if (this.history.length % 10 === 0) {
      this.updateWeights();
    }
  }

  /**
   * Predict time using the regression model.
   */
  private predictWithModel(features: PredictionFeatures): number {
    let timeMs = this.weights.intercept;

    // Distance coefficient (more distance = more time)
    timeMs += features.distance * this.weights.distance;

    // Time of day adjustment (rush hours)
    timeMs += features.timeOfDay * this.weights.timeOfDay;

    // Day of week adjustment (weekends vs weekdays)
    timeMs += features.dayOfWeek * this.weights.dayOfWeek;

    // Driver speed adjustment
    timeMs +=
      (50 - features.driverSpeedHistory) * this.weights.driverSpeedHistory;

    // Stops overhead
    timeMs += features.stopsRemaining * this.weights.stopsRemaining;

    // Zone-specific factors
    const zoneFactor =
      this.weights.zoneFactors.get(features.trafficZone) ?? 1.0;
    timeMs *= zoneFactor;

    return Math.max(timeMs, 60000); // Minimum 1 minute
  }

  /**
   * Create a fallback prediction based on distance and speed.
   */
  private createFallbackPrediction(
    shipmentId: string,
    features: PredictionFeatures,
    id: string,
    timestamp: string,
  ): PredictionResult {
    // Basic calculation: time = distance / speed + stops overhead
    const travelTimeMs =
      (features.distance / this.config.fallbackBaseSpeed) * 3600000;
    const stopsTimeMs =
      features.stopsRemaining * this.config.stopTimeOverheadMs;
    const estimatedMs = travelTimeMs + stopsTimeMs;

    // Wider confidence interval for fallback
    const confidence = this.config.defaultConfidence;
    const stdDev = estimatedMs * 0.3; // 30% uncertainty
    const zScore = this.config.confidenceIntervalSigma;

    return {
      id,
      shipmentId,
      estimatedTimeMs: estimatedMs,
      confidenceLowerMs: Math.max(estimatedMs - zScore * stdDev, 60000),
      confidenceUpperMs: estimatedMs + zScore * stdDev,
      confidence,
      features,
      timestamp,
      isFallback: true,
    };
  }

  /**
   * Update model weights based on historical data.
   */
  private updateWeights(): void {
    if (this.history.length < this.config.minimumTrainingData) {
      return;
    }

    // Simple gradient descent-like update
    const learningRate = 0.01;
    const recentHistory = this.history.slice(-100); // Use recent 100 points

    for (const point of recentHistory) {
      const predicted = this.predictWithModel(point.features);
      const error = point.actual - predicted;
      const errorRate = error / (point.actual || 1);

      // Adjust weights based on prediction error
      this.weights.distance +=
        learningRate * errorRate * point.features.distance;
      this.weights.timeOfDay +=
        learningRate * errorRate * point.features.timeOfDay;
      this.weights.dayOfWeek +=
        learningRate * errorRate * point.features.dayOfWeek;
      this.weights.driverSpeedHistory +=
        learningRate * errorRate * (50 - point.features.driverSpeedHistory);
      this.weights.stopsRemaining +=
        learningRate * errorRate * point.features.stopsRemaining;

      // Update zone factor
      const currentZoneFactor =
        this.weights.zoneFactors.get(point.features.trafficZone) ?? 1.0;
      this.weights.zoneFactors.set(
        point.features.trafficZone,
        currentZoneFactor + learningRate * errorRate * 0.1,
      );
    }

    // Recalibrate intercept
    const avgError =
      recentHistory.reduce((sum, p) => sum + (p.actual - p.predicted), 0) /
      recentHistory.length;
    this.weights.intercept += learningRate * avgError;
  }

  /**
   * Calculate accuracy metrics from historical predictions.
   */
  private calculateAccuracy(): {
    mae: number;
    rmse: number;
    mape: number;
  } | null {
    if (this.history.length === 0) {
      return null;
    }

    let sumAbsError = 0;
    let sumSquaredError = 0;
    let sumPercentError = 0;
    const recentHistory = this.history.slice(-100);

    for (const point of recentHistory) {
      const error = Math.abs(point.actual - point.predicted);
      sumAbsError += error;
      sumSquaredError += error * error;

      const percentError = Math.abs(
        (point.actual - point.predicted) / point.actual,
      );
      sumPercentError += percentError;
    }

    const count = recentHistory.length;

    return {
      mae: sumAbsError / count,
      rmse: Math.sqrt(sumSquaredError / count),
      mape: (sumPercentError / count) * 100,
    };
  }

  /**
   * Calculate confidence based on accuracy metrics.
   */
  private calculateConfidence(
    accuracy: { mae: number; rmse: number; mape: number } | null,
  ): number {
    if (!accuracy) {
      return this.config.defaultConfidence;
    }

    // Confidence inversely related to MAPE
    // If MAPE < 10%, confidence is high; if MAPE > 50%, confidence is low
    const confidenceFromMape = Math.max(0.3, 1 - accuracy.mape / 100);
    return Math.min(confidenceFromMape, 1.0);
  }

  /**
   * Calculate confidence interval for prediction.
   */
  private calculateConfidenceInterval(
    estimated: number,
    accuracy: { mae: number; rmse: number; mape: number } | null,
  ): { lower: number; upper: number } {
    let stdDev = estimated * 0.2; // Default 20% uncertainty

    if (accuracy) {
      stdDev = accuracy.rmse;
    }

    const zScore = this.config.confidenceIntervalSigma;
    const margin = zScore * stdDev;

    return {
      lower: Math.max(estimated - margin, 60000), // Minimum 1 minute
      upper: estimated + margin,
    };
  }

  /**
   * Validate prediction features.
   */
  private validateFeatures(features: PredictionFeatures): boolean {
    return (
      features.distance > 0 &&
      features.distance < 500 && // Max 500 km
      features.timeOfDay >= 0 &&
      features.timeOfDay < 24 &&
      features.dayOfWeek >= 0 &&
      features.dayOfWeek < 7 &&
      features.driverSpeedHistory > 0 &&
      features.driverSpeedHistory < 200 &&
      features.stopsRemaining >= 0 &&
      features.trafficZone.length > 0
    );
  }

  /**
   * Initialize model weights.
   */
  private initializeWeights(): ModelWeights {
    return {
      intercept: 600000, // 10 minutes base
      distance: 60000, // 1 minute per km (60 km/h base)
      timeOfDay: 2000, // Adjust for rush hours
      dayOfWeek: 3000, // Adjust for day of week
      driverSpeedHistory: 1000, // Adjust for driver speed
      stopsRemaining: 120000, // 2 minutes per stop
      zoneFactors: new Map([
        ["urban", 1.2], // Urban congestion
        ["suburban", 1.0],
        ["highway", 0.8],
        ["industrial", 1.0],
      ]),
    };
  }

  /**
   * Get accuracy metrics from all historical predictions.
   */
  getAccuracyMetrics(): {
    mae: number;
    rmse: number;
    mape: number;
    totalPredictions: number;
  } | null {
    const accuracy = this.calculateAccuracy();
    if (!accuracy) {
      return null;
    }

    return {
      ...accuracy,
      totalPredictions: this.history.length,
    };
  }

  /**
   * Get history size.
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Clear training history.
   */
  clearHistory(): void {
    this.history = [];
    this.weights = this.initializeWeights();
  }

  /**
   * Get current model weights.
   */
  getWeights(): ModelWeights {
    return {
      ...this.weights,
      zoneFactors: new Map(this.weights.zoneFactors),
    };
  }

  /**
   * Get total predictions made.
   */
  getPredictionCount(): number {
    return this.predictionCount;
  }
}
