/**
 * Model Retraining Pipeline
 *
 * Automatic model retraining and validation system:
 * - Monitor model accuracy and trigger retraining when degraded
 * - Collect recent training data
 * - Retrain models with new data
 * - A/B test new vs old models
 * - Promote model if performance improves
 * - Weekly retraining schedule or on-demand
 * - Detailed retraining logs with metrics
 */

import { EventEmitter } from 'events';
import type { ModelPerformanceMetrics } from './types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Training data point for model
 */
export interface TrainingDataPoint {
  timestamp: Date;
  zoneId: string;
  features: Record<string, number>;
  actualVolume: number;
}

/**
 * Model version information
 */
export interface ModelVersion {
  version: number;
  modelType: 'seasonal' | 'regression' | 'pattern' | 'ensemble';
  trainedAt: Date;
  trainingDataSize: number;
  metrics: ModelPerformanceMetrics;
  dataWindow: {
    from: Date;
    to: Date;
  };
  active: boolean;
  promotedAt?: Date;
  demotedAt?: Date;
}

/**
 * Retraining job
 */
export interface RetrainingJob {
  id: string;
  zoneId: string;
  modelType: 'seasonal' | 'regression' | 'pattern' | 'ensemble';
  status: 'pending' | 'running' | 'completed' | 'failed';

  // Timing
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Data
  trainingDataSize: number;
  dataWindow: {
    from: Date;
    to: Date;
  };

  // Results
  oldMetrics?: ModelPerformanceMetrics;
  newMetrics?: ModelPerformanceMetrics;
  improvementPercent?: number;
  promoted: boolean;

  // Metadata
  reason: 'scheduled' | 'degradation_detected' | 'manual' | 'data_refresh';
  error?: string;
}

/**
 * Retraining configuration
 */
export interface RetrainingConfig {
  // Degradation thresholds
  accuracyDegradationThreshold: number; // % drop to trigger (e.g., 10)
  minAccuracyScore: number; // MAPE % above which to consider degraded
  minImprovementPercent: number; // % improvement needed to promote (e.g., 2)

  // Retraining frequency
  scheduleIntervalHours: number; // Weekly = 168, Daily = 24
  minDataDays: number; // Use at least N days of data
  maxDataDays: number; // Don't go beyond N days

  // Data requirements
  minSamplesRequired: number; // minimum training samples
  validationSplit: number; // 0-1, fraction for validation

  // Scheduling
  autoRetrain: boolean;
  retainPreviousVersions: number; // keep N old versions
}

/**
 * Retraining report
 */
export interface RetrainingReport {
  jobId: string;
  zoneId: string;
  modelType: string;
  status: 'success' | 'failure' | 'no_improvement';

  // Metrics comparison
  oldMetrics: ModelPerformanceMetrics;
  newMetrics: ModelPerformanceMetrics;
  improvementPercent: number;

  // Decision
  promoted: boolean;
  reason: string;

  // Timeline
  requestedAt: Date;
  completedAt: Date;
  durationSeconds: number;

  // Data
  trainingDataSize: number;
  dataWindow: {
    from: Date;
    to: Date;
  };

  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// MODEL RETRAINER SERVICE
// ═══════════════════════════════════════════════════════════════

/**
 * Model retraining pipeline
 * Manages model updates and performance monitoring
 */
export class ModelRetrainer extends EventEmitter {
  private config: RetrainingConfig;
  private modelVersions: Map<string, ModelVersion[]> = new Map(); // zoneId -> versions
  private retrainingJobs: Map<string, RetrainingJob> = new Map();
  private retrainingHistory: RetrainingReport[] = [];
  private lastRetrainingTime: Map<string, Date> = new Map();
  private jobCounter: number = 0;
  private accuracyHistory: Map<string, Array<{ accuracy: number; timestamp: Date }>> = new Map();

  constructor(config?: Partial<RetrainingConfig>) {
    super();
    this.config = {
      accuracyDegradationThreshold: 10, // 10% drop
      minAccuracyScore: 15, // MAPE of 15%
      minImprovementPercent: 2, // 2% improvement needed
      scheduleIntervalHours: 168, // Weekly
      minDataDays: 14,
      maxDataDays: 90,
      minSamplesRequired: 100,
      validationSplit: 0.2,
      autoRetrain: true,
      retainPreviousVersions: 3,
      ...config,
    };
  }

  /**
   * Check if model should be retrained
   * Compares current accuracy to historical baseline
   */
  shouldRetrain(zoneId: string, currentMetrics: ModelPerformanceMetrics): boolean {
    const history = this.accuracyHistory.get(zoneId) || [];

    if (history.length === 0) {
      return false; // No baseline yet
    }

    // Get baseline (average of last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter((h) => h.timestamp > sevenDaysAgo);

    if (recentHistory.length === 0) {
      return false;
    }

    const baselineAccuracy =
      recentHistory.reduce((sum, h) => sum + h.accuracy, 0) / recentHistory.length;

    // Check if degraded - for MAPE, higher is worse
    const currentAccuracy = currentMetrics.mape; // Mean Absolute Percentage Error
    const degradation = ((currentAccuracy - baselineAccuracy) / baselineAccuracy) * 100;

    const shouldRetrain =
      degradation > this.config.accuracyDegradationThreshold ||
      currentAccuracy > this.config.minAccuracyScore;

    if (shouldRetrain) {
      this.emit('degradation_detected', {
        zoneId,
        baselineAccuracy,
        currentAccuracy,
        degradation,
      });
    }

    return shouldRetrain;
  }

  /**
   * Check if enough time has passed since last retraining
   */
  isScheduledForRetraining(zoneId: string): boolean {
    if (!this.config.autoRetrain) {
      return false;
    }

    const lastTime = this.lastRetrainingTime.get(zoneId);
    if (!lastTime) {
      return true; // Never trained, schedule it
    }

    const timeSinceLastRetrain = Date.now() - lastTime.getTime();
    const intervalMs = this.config.scheduleIntervalHours * 60 * 60 * 1000;

    return timeSinceLastRetrain > intervalMs;
  }

  /**
   * Collect training data for a model
   * Gathers recent historical data for retraining
   */
  collectTrainingData(zoneId: string, lookbackDays?: number): TrainingDataPoint[] {
    const days = lookbackDays || this.config.maxDataDays;
    const dataPoints: TrainingDataPoint[] = [];

    // In production, this would fetch from database
    // For now, generate mock data
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const pointCount = Math.max(this.config.minSamplesRequired * 2, Math.min(days * 24, 720));
    for (let i = 0; i < pointCount; i++) {
      const timestamp = new Date(startDate.getTime() + i * 60 * 60 * 1000);

      // Skip if beyond current time
      if (timestamp > now) {
        break;
      }

      dataPoints.push({
        timestamp,
        zoneId,
        features: {
          hour: timestamp.getHours(),
          dayOfWeek: timestamp.getDay(),
          isWeekend: timestamp.getDay() === 0 || timestamp.getDay() === 6 ? 1 : 0,
          isHoliday: 0, // Would be fetched from calendar
          temperature: 20 + Math.random() * 15,
          promotion: Math.random() > 0.8 ? 1 : 0,
        },
        actualVolume: 50 + Math.random() * 50,
      });
    }

    return dataPoints.length >= this.config.minSamplesRequired ? dataPoints : [];
  }

  /**
   * Retrain a specific model
   * Triggers the actual retraining process
   */
  async retrain(
    zoneId: string,
    modelType: 'seasonal' | 'regression' | 'pattern' | 'ensemble',
    trainingData: TrainingDataPoint[],
    reason: 'scheduled' | 'degradation_detected' | 'manual' | 'data_refresh' = 'manual'
  ): Promise<RetrainingJob> {
    if (trainingData.length < this.config.minSamplesRequired) {
      throw new Error(`Insufficient training data. Need ${this.config.minSamplesRequired}, got ${trainingData.length}`);
    }

    const jobId = `retrain-${Date.now()}-${++this.jobCounter}`;

    const job: RetrainingJob = {
      id: jobId,
      zoneId,
      modelType,
      status: 'pending',
      requestedAt: new Date(),
      trainingDataSize: trainingData.length,
      dataWindow: {
        from: trainingData[0].timestamp,
        to: trainingData[trainingData.length - 1].timestamp,
      },
      promoted: false,
      reason,
    };

    this.retrainingJobs.set(jobId, job);

    // Simulate async retraining
    job.status = 'running';
    job.startedAt = new Date();

    try {
      // Simulate training delay (short for testing)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Generate mock metrics (in production, would be from actual model)
      const oldMetrics: ModelPerformanceMetrics = {
        mae: 8.2,
        rmse: 10.1,
        mape: 12.5,
        r2Score: 0.82,
        precision: 0.88,
        recall: 0.85,
      };

      const newMetrics: ModelPerformanceMetrics = {
        mae: 7.8,
        rmse: 9.5,
        mape: 11.9,
        r2Score: 0.84,
        precision: 0.89,
        recall: 0.86,
      };

      job.oldMetrics = oldMetrics;
      job.newMetrics = newMetrics;

      // Calculate improvement
      const mapeImprovement = ((oldMetrics.mape - newMetrics.mape) / oldMetrics.mape) * 100;
      const r2Improvement = ((newMetrics.r2Score - oldMetrics.r2Score) / oldMetrics.r2Score) * 100;
      const improvement = (mapeImprovement + r2Improvement) / 2;

      job.improvementPercent = improvement;
      job.status = 'completed';
      job.completedAt = new Date();

      this.emit('retraining_completed', job);

      return job;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      this.emit('retraining_failed', job);

      throw error;
    }
  }

  /**
   * Validate retrained model vs old model
   * A/B test new model on test data
   */
  validateRetrained(
    zoneId: string,
    oldMetrics: ModelPerformanceMetrics,
    newMetrics: ModelPerformanceMetrics
  ): {
    isImprovement: boolean;
    improvementPercent: number;
    recommendation: string;
  } {
    // Calculate overall improvement score
    const mapeImprovement = ((oldMetrics.mape - newMetrics.mape) / oldMetrics.mape) * 100;
    const r2Improvement = ((newMetrics.r2Score - oldMetrics.r2Score) / oldMetrics.r2Score) * 100;
    const precisionImprovement = ((newMetrics.precision - oldMetrics.precision) / oldMetrics.precision) * 100;

    const overallImprovement = (mapeImprovement + r2Improvement + precisionImprovement) / 3;

    const isImprovement = overallImprovement >= this.config.minImprovementPercent;

    let recommendation = '';
    if (isImprovement) {
      recommendation = `Promote model: ${overallImprovement.toFixed(2)}% improvement`;
    } else {
      recommendation = `Keep current model: only ${overallImprovement.toFixed(2)}% improvement (need ${this.config.minImprovementPercent}%)`;
    }

    return {
      isImprovement,
      improvementPercent: overallImprovement,
      recommendation,
    };
  }

  /**
   * Promote a retrained model (swap as active)
   */
  promoteModel(jobId: string): boolean {
    const job = this.retrainingJobs.get(jobId);
    if (!job || !job.newMetrics) {
      return false;
    }

    const validation = this.validateRetrained(job.zoneId, job.oldMetrics || ({} as any), job.newMetrics);

    if (!validation.isImprovement) {
      return false;
    }

    // Create new model version
    const newVersion: ModelVersion = {
      version: (this.getModelVersions(job.zoneId).length || 0) + 1,
      modelType: job.modelType,
      trainedAt: job.completedAt || new Date(),
      trainingDataSize: job.trainingDataSize,
      metrics: job.newMetrics,
      dataWindow: job.dataWindow,
      active: true,
      promotedAt: new Date(),
    };

    // Deactivate old versions
    const versions = this.getModelVersions(job.zoneId);
    for (const v of versions) {
      if (v.active) {
        v.active = false;
        v.demotedAt = new Date();
      }
    }

    // Add new version
    versions.push(newVersion);

    // Prune old versions if needed
    if (versions.length > this.config.retainPreviousVersions) {
      const toRemove = versions.length - this.config.retainPreviousVersions;
      versions.splice(0, toRemove);
    }

    // Update tracking
    this.lastRetrainingTime.set(job.zoneId, new Date());
    job.promoted = true;

    // Record history
    const report: RetrainingReport = {
      jobId,
      zoneId: job.zoneId,
      modelType: job.modelType,
      status: 'success',
      oldMetrics: job.oldMetrics || ({} as any),
      newMetrics: job.newMetrics,
      improvementPercent: validation.improvementPercent,
      promoted: true,
      reason: validation.recommendation,
      requestedAt: job.requestedAt,
      completedAt: job.completedAt || new Date(),
      durationSeconds: Math.round(((job.completedAt || new Date()).getTime() - job.requestedAt.getTime()) / 1000),
      trainingDataSize: job.trainingDataSize,
      dataWindow: job.dataWindow,
    };

    this.retrainingHistory.push(report);

    this.emit('model_promoted', {
      zoneId: job.zoneId,
      modelType: job.modelType,
      version: newVersion.version,
      improvement: validation.improvementPercent,
    });

    return true;
  }

  /**
   * Get model versions for a zone
   */
  getModelVersions(zoneId: string): ModelVersion[] {
    if (!this.modelVersions.has(zoneId)) {
      this.modelVersions.set(zoneId, []);
    }
    return this.modelVersions.get(zoneId)!;
  }

  /**
   * Get active model version for a zone
   */
  getActiveModel(zoneId: string): ModelVersion | null {
    const versions = this.getModelVersions(zoneId);
    return versions.find((v) => v.active) || versions[versions.length - 1] || null;
  }

  /**
   * Record model accuracy for trend tracking
   */
  recordAccuracy(zoneId: string, mape: number): void {
    const history = this.accuracyHistory.get(zoneId) || [];
    history.push({
      accuracy: mape,
      timestamp: new Date(),
    });

    // Keep only last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filtered = history.filter((h) => h.timestamp > thirtyDaysAgo);

    this.accuracyHistory.set(zoneId, filtered);
  }

  /**
   * Get retraining history
   */
  getRetrainingHistory(zoneId?: string, limit?: number): RetrainingReport[] {
    let history = this.retrainingHistory;

    if (zoneId) {
      history = history.filter((r) => r.zoneId === zoneId);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalJobsRun: number;
    successfulJobs: number;
    promotedModels: number;
    averageImprovement: number;
    activeModes: number;
  } {
    const reports = this.retrainingHistory;
    const promoted = reports.filter((r) => r.promoted);

    return {
      totalJobsRun: reports.length,
      successfulJobs: reports.filter((r) => r.status === 'success').length,
      promotedModels: promoted.length,
      averageImprovement:
        promoted.length > 0 ? promoted.reduce((sum, r) => sum + r.improvementPercent, 0) / promoted.length : 0,
      activeModes: this.modelVersions.size,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize model versions for a zone
   */
  private initializeModelVersions(zoneId: string): void {
    if (!this.modelVersions.has(zoneId)) {
      this.modelVersions.set(zoneId, []);
    }
  }
}
