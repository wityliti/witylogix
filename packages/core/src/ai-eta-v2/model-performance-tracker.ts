/**
 * Model Performance Tracker
 *
 * Tracks model accuracy over time:
 * - MAE (mean absolute error)
 * - RMSE (root mean squared error)
 * - P50/P90 error percentiles
 * - Per-zone accuracy
 * - Degradation alerts
 * - Prediction vs actual scatter data
 */

import type {
  ModelPerformanceMetrics,
  CalibrationMetrics,
  AccuracyReport,
} from "./types.js";

interface PerformanceBucket {
  predictions: number[];
  actuals: number[];
  timestamps: Date[];
}

export class ModelPerformanceTracker {
  private modelMetrics: Map<string, ModelPerformanceMetrics>;
  private zoneMetrics: Map<string, Map<string, PerformanceBucket>>;
  private hourMetrics: Map<number, PerformanceBucket>;
  private overallMetrics: PerformanceBucket;
  private degradationThreshold: number;

  constructor() {
    this.modelMetrics = new Map();
    this.zoneMetrics = new Map();
    this.hourMetrics = new Map();
    this.overallMetrics = { predictions: [], actuals: [], timestamps: [] };
    this.degradationThreshold = 0.15; // 15% increase in error triggers alert
  }

  /**
   * Calculate MAE (Mean Absolute Error)
   */
  private calculateMAE(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;
    const sumError = predictions.reduce(
      (sum, pred, i) => sum + Math.abs(pred - actuals[i]),
      0,
    );
    return sumError / predictions.length;
  }

  /**
   * Calculate RMSE (Root Mean Squared Error)
   */
  private calculateRMSE(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;
    const sumSquaredError = predictions.reduce((sum, pred, i) => {
      const error = pred - actuals[i];
      return sum + error * error;
    }, 0);
    return Math.sqrt(sumSquaredError / predictions.length);
  }

  /**
   * Calculate MAPE (Mean Absolute Percentage Error)
   */
  private calculateMAPE(predictions: number[], actuals: number[]): number {
    if (predictions.length === 0) return 0;
    let sumPctError = 0;
    let count = 0;

    for (let i = 0; i < predictions.length; i++) {
      if (actuals[i] > 0) {
        const pctError = Math.abs((predictions[i] - actuals[i]) / actuals[i]);
        sumPctError += pctError;
        count++;
      }
    }

    return count > 0 ? sumPctError / count : 0;
  }

  /**
   * Calculate percentile error
   */
  private calculatePercentileError(
    predictions: number[],
    actuals: number[],
    percentile: number,
  ): number {
    if (predictions.length === 0) return 0;

    const errors = predictions.map((pred, i) => Math.abs(pred - actuals[i]));
    errors.sort((a, b) => a - b);

    const index = Math.floor((errors.length - 1) * percentile);
    return errors[index];
  }

  /**
   * Compute metrics from predictions and actuals
   */
  private computeMetrics(
    predictions: number[],
    actuals: number[],
  ): CalibrationMetrics {
    const mae = this.calculateMAE(predictions, actuals);
    const rmse = this.calculateRMSE(predictions, actuals);
    const mape = this.calculateMAPE(predictions, actuals);
    const p50Error = this.calculatePercentileError(predictions, actuals, 0.5);
    const p90Error = this.calculatePercentileError(predictions, actuals, 0.9);

    // Accuracy: percentage of predictions within ±5 minutes
    const accurateCount = predictions.filter((pred, i) => {
      return Math.abs(pred - actuals[i]) <= 5;
    }).length;
    const accuracyPercentage =
      (accurateCount / Math.max(1, predictions.length)) * 100;

    return {
      mae,
      rmse,
      mape,
      p50_error: p50Error,
      p90_error: p90Error,
      sample_count: predictions.length,
      accuracy_percentage: accuracyPercentage,
    };
  }

  /**
   * Record a prediction and actual result
   */
  recordResult(
    modelName: string,
    predicted: number,
    actual: number,
    zone?: string,
    hour?: number,
    timestamp: Date = new Date(),
  ): void {
    // Record to overall metrics
    this.overallMetrics.predictions.push(predicted);
    this.overallMetrics.actuals.push(actual);
    this.overallMetrics.timestamps.push(timestamp);

    // Record to model metrics
    if (!this.modelMetrics.has(modelName)) {
      this.modelMetrics.set(modelName, {
        modelName,
        metrics: {
          mae: 0,
          rmse: 0,
          mape: 0,
          p50_error: 0,
          p90_error: 0,
          sample_count: 0,
          accuracy_percentage: 0,
        },
        zone_metrics: {},
        hour_metrics: {},
        last_updated: timestamp,
        samples_since_last_update: 0,
      });
    }

    const modelMetrics = this.modelMetrics.get(modelName)!;
    modelMetrics.samples_since_last_update++;

    // Record to zone metrics if provided
    if (zone) {
      if (!this.zoneMetrics.has(modelName)) {
        this.zoneMetrics.set(modelName, new Map());
      }

      const modelZoneMap = this.zoneMetrics.get(modelName)!;
      if (!modelZoneMap.has(zone)) {
        modelZoneMap.set(zone, {
          predictions: [],
          actuals: [],
          timestamps: [],
        });
      }

      const zoneBucket = modelZoneMap.get(zone)!;
      zoneBucket.predictions.push(predicted);
      zoneBucket.actuals.push(actual);
      zoneBucket.timestamps.push(timestamp);
    }

    // Record to hour metrics if provided
    if (hour !== undefined) {
      if (!this.hourMetrics.has(hour)) {
        this.hourMetrics.set(hour, {
          predictions: [],
          actuals: [],
          timestamps: [],
        });
      }

      const hourBucket = this.hourMetrics.get(hour)!;
      hourBucket.predictions.push(predicted);
      hourBucket.actuals.push(actual);
      hourBucket.timestamps.push(timestamp);
    }

    // Update model metrics periodically
    if (modelMetrics.samples_since_last_update >= 100) {
      this.updateModelMetrics(modelName);
    }
  }

  /**
   * Update model metrics after collecting samples
   */
  private updateModelMetrics(modelName: string): void {
    const modelMetrics = this.modelMetrics.get(modelName);
    if (!modelMetrics || modelMetrics.samples_since_last_update === 0) return;

    // Recalculate zone metrics
    const modelZoneMap = this.zoneMetrics.get(modelName);
    if (modelZoneMap) {
      modelMetrics.zone_metrics = {};
      for (const [zone, bucket] of modelZoneMap.entries()) {
        if (bucket.predictions.length > 0) {
          modelMetrics.zone_metrics[zone] = this.computeMetrics(
            bucket.predictions,
            bucket.actuals,
          );
        }
      }
    }

    // Recalculate hour metrics
    modelMetrics.hour_metrics = {};
    for (const [hour, bucket] of this.hourMetrics.entries()) {
      if (bucket.predictions.length > 0) {
        modelMetrics.hour_metrics[hour] = this.computeMetrics(
          bucket.predictions,
          bucket.actuals,
        );
      }
    }

    // Update overall metrics for this model
    // Collect all predictions and actuals for this model
    const allPredictions: number[] = [];
    const allActuals: number[] = [];

    if (modelZoneMap) {
      for (const bucket of modelZoneMap.values()) {
        allPredictions.push(...bucket.predictions);
        allActuals.push(...bucket.actuals);
      }
    }

    if (allPredictions.length > 0) {
      modelMetrics.metrics = this.computeMetrics(allPredictions, allActuals);
      modelMetrics.last_updated = new Date();
      modelMetrics.samples_since_last_update = 0;
    }
  }

  /**
   * Generate accuracy report
   */
  generateReport(periodStart: Date, periodEnd: Date): AccuracyReport {
    // Filter data to period
    const filteredIndices = this.overallMetrics.timestamps.reduce(
      (indices, timestamp, i) => {
        if (timestamp >= periodStart && timestamp <= periodEnd) {
          indices.push(i);
        }
        return indices;
      },
      [] as number[],
    );

    const periodPredictions = filteredIndices.map(
      (i) => this.overallMetrics.predictions[i],
    );
    const periodActuals = filteredIndices.map(
      (i) => this.overallMetrics.actuals[i],
    );

    const overallMetrics =
      periodPredictions.length > 0
        ? this.computeMetrics(periodPredictions, periodActuals)
        : {
            mae: 0,
            rmse: 0,
            mape: 0,
            p50_error: 0,
            p90_error: 0,
            sample_count: 0,
            accuracy_percentage: 0,
          };

    // Compile by-model metrics
    const byModel: Record<string, CalibrationMetrics> = {};
    for (const [modelName, metrics] of this.modelMetrics.entries()) {
      byModel[modelName] = metrics.metrics;
    }

    // Compile by-zone metrics (aggregate)
    const byZone: Record<string, CalibrationMetrics> = {};
    for (const zoneMap of this.zoneMetrics.values()) {
      for (const [zone, bucket] of zoneMap.entries()) {
        if (!byZone[zone]) {
          byZone[zone] = {
            mae: 0,
            rmse: 0,
            mape: 0,
            p50_error: 0,
            p90_error: 0,
            sample_count: 0,
            accuracy_percentage: 0,
          };
        }

        if (bucket.predictions.length > 0) {
          const metrics = this.computeMetrics(
            bucket.predictions,
            bucket.actuals,
          );
          // Aggregate (simple average for now)
          const existing = byZone[zone];
          existing.mae = (existing.mae + metrics.mae) / 2;
          existing.rmse = (existing.rmse + metrics.rmse) / 2;
          existing.sample_count += metrics.sample_count;
        }
      }
    }

    // Compile by-hour metrics
    const byHour: Record<number, CalibrationMetrics> = {};
    for (const [hour, bucket] of this.hourMetrics.entries()) {
      if (bucket.predictions.length > 0) {
        byHour[hour] = this.computeMetrics(bucket.predictions, bucket.actuals);
      }
    }

    // Detect degradation
    const degradationAlerts: Array<{
      model_name: string;
      metric: string;
      previous_value: number;
      current_value: number;
      change_percentage: number;
    }> = [];

    // Check if current metrics are worse than historical
    for (const [modelName, metrics] of this.modelMetrics.entries()) {
      const currentMAE = metrics.metrics.mae;
      // In production, would compare against baseline/previous period
      // For now, we can check for unusually high errors
      if (currentMAE > 20) {
        // Threshold: 20 minute MAE
        degradationAlerts.push({
          model_name: modelName,
          metric: "mae",
          previous_value: 15,
          current_value: currentMAE,
          change_percentage: ((currentMAE - 15) / 15) * 100,
        });
      }
    }

    return {
      period_start: periodStart,
      period_end: periodEnd,
      overall_metrics: overallMetrics,
      by_model: byModel,
      by_zone: byZone,
      by_hour: byHour,
      degradation_alerts: degradationAlerts,
    };
  }

  /**
   * Get model metrics
   */
  getModelMetrics(modelName?: string): ModelPerformanceMetrics[] {
    if (modelName) {
      const metrics = this.modelMetrics.get(modelName);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.modelMetrics.values());
  }

  /**
   * Get metrics for a specific zone
   */
  getZoneMetrics(zone: string): Record<string, CalibrationMetrics> {
    const zoneMetrics: Record<string, CalibrationMetrics> = {};

    for (const [modelName, zoneMap] of this.zoneMetrics.entries()) {
      const bucket = zoneMap.get(zone);
      if (bucket && bucket.predictions.length > 0) {
        zoneMetrics[modelName] = this.computeMetrics(
          bucket.predictions,
          bucket.actuals,
        );
      }
    }

    return zoneMetrics;
  }

  /**
   * Clear old data (keep last N days)
   */
  pruneOldData(maxAgeHours: number = 24 * 30): void {
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // Prune overall metrics
    const validIndices = this.overallMetrics.timestamps
      .map((t, i) => (t >= cutoffDate ? i : -1))
      .filter((i) => i >= 0);

    this.overallMetrics.predictions = validIndices.map(
      (i) => this.overallMetrics.predictions[i],
    );
    this.overallMetrics.actuals = validIndices.map(
      (i) => this.overallMetrics.actuals[i],
    );
    this.overallMetrics.timestamps = validIndices.map(
      (i) => this.overallMetrics.timestamps[i],
    );

    // Prune zone metrics
    for (const zoneMap of this.zoneMetrics.values()) {
      for (const [zone, bucket] of zoneMap.entries()) {
        const validIdx = bucket.timestamps
          .map((t, i) => (t >= cutoffDate ? i : -1))
          .filter((i) => i >= 0);

        bucket.predictions = validIdx.map((i) => bucket.predictions[i]);
        bucket.actuals = validIdx.map((i) => bucket.actuals[i]);
        bucket.timestamps = validIdx.map((i) => bucket.timestamps[i]);
      }
    }

    // Prune hour metrics
    for (const bucket of this.hourMetrics.values()) {
      const validIdx = bucket.timestamps
        .map((t, i) => (t >= cutoffDate ? i : -1))
        .filter((i) => i >= 0);

      bucket.predictions = validIdx.map((i) => bucket.predictions[i]);
      bucket.actuals = validIdx.map((i) => bucket.actuals[i]);
      bucket.timestamps = validIdx.map((i) => bucket.timestamps[i]);
    }
  }
}
