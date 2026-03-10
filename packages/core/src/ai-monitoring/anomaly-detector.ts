/**
 * Anomaly Detection Engine
 *
 * Implements statistical anomaly detection algorithms:
 * - Z-score detection (Gaussian distribution-based)
 * - Interquartile Range (IQR) detection (distribution-free)
 * - Moving Average Deviation (trend-based)
 * - Sliding window analysis for delivery times
 * - Configurable severity classification
 * - Alert deduplication with cooldown periods
 */

import type {
  AnomalyAlert,
  AnomalyType,
  AlertSeverity,
  MonitoringConfig,
  TimeSeriesPoint,
} from "./types.js";

/**
 * Configuration for anomaly detection.
 */
interface AnomalyDetectorConfig {
  /** Z-score threshold for anomalies (typically 2-3). */
  zScoreThreshold: number;

  /** Cooldown period in milliseconds before re-alerting. */
  alertCooldownMs: number;

  /** Minimum number of data points required for detection. */
  minimumDataPoints: number;

  /** Enable z-score detection. */
  enableZScore: boolean;

  /** Enable IQR detection. */
  enableIQR: boolean;

  /** Enable moving average detection. */
  enableMovingAverage: boolean;

  /** Window size for moving average (number of points). */
  movingAverageWindowSize: number;

  /** Moving average deviation multiplier (sigma). */
  movingAverageDeviationMultiplier: number;
}

/**
 * Statistical summary of a dataset.
 */
interface Statistics {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  iqr: number;
}

/**
 * Internal alert tracking for deduplication.
 */
interface AlertRecord {
  id: string;
  timestamp: number;
  anomalyType: AnomalyType;
  entityId?: string; // shipment/driver/zone ID
}

/**
 * AnomalyDetector class for statistical anomaly detection.
 */
export class AnomalyDetector {
  private config: AnomalyDetectorConfig;
  private recentAlerts: Map<string, AlertRecord> = new Map();
  private dataHistory: Map<string, TimeSeriesPoint[]> = new Map();
  private maxHistorySize: number = 1000;

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = {
      zScoreThreshold: config.zScoreThreshold ?? 2.5,
      alertCooldownMs: config.alertCooldownMs ?? 5 * 60 * 1000, // 5 minutes
      minimumDataPoints: config.minimumDataPoints ?? 5,
      enableZScore: config.enableZScore ?? true,
      enableIQR: config.enableIQR ?? true,
      enableMovingAverage: config.enableMovingAverage ?? true,
      movingAverageWindowSize: config.movingAverageWindowSize ?? 5,
      movingAverageDeviationMultiplier: config.movingAverageDeviationMultiplier ?? 2,
    };
  }

  /**
   * Add data points to the history for a metric.
   */
  addDataPoints(metricName: string, points: TimeSeriesPoint[]): void {
    if (!this.dataHistory.has(metricName)) {
      this.dataHistory.set(metricName, []);
    }

    const history = this.dataHistory.get(metricName)!;
    history.push(...points);

    // Maintain maximum history size with FIFO eviction
    if (history.length > this.maxHistorySize) {
      const itemsToRemove = history.length - this.maxHistorySize;
      history.splice(0, itemsToRemove);
    }
  }

  /**
   * Detect anomalies in a metric using multiple statistical methods.
   *
   * @param metricName - Name/ID of the metric
   * @param anomalyType - Type of anomaly to detect
   * @param threshold - Threshold for the metric
   * @returns Array of detected anomalies
   */
  detectAnomalies(
    metricName: string,
    anomalyType: AnomalyType,
    threshold: number,
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const dataPoints = this.dataHistory.get(metricName) || [];

    if (dataPoints.length < this.config.minimumDataPoints) {
      return alerts;
    }

    const values = dataPoints.map((p) => p.value);
    const stats = this.calculateStatistics(values);

    // Z-score detection
    if (this.config.enableZScore) {
      const zScoreAnomalies = this.detectByZScore(
        dataPoints,
        stats,
        anomalyType,
        threshold,
      );
      alerts.push(...zScoreAnomalies);
    }

    // IQR detection
    if (this.config.enableIQR) {
      const iqrAnomalies = this.detectByIQR(dataPoints, stats, anomalyType, threshold);
      alerts.push(...iqrAnomalies);
    }

    // Moving Average Deviation detection
    if (this.config.enableMovingAverage) {
      const maAnomalies = this.detectByMovingAverageDeviation(
        dataPoints,
        anomalyType,
        threshold,
      );
      alerts.push(...maAnomalies);
    }

    // Deduplicate and filter by cooldown
    return this.deduplicateAlerts(alerts);
  }

  /**
   * Detect anomalies using Z-score method.
   * Z-score = (value - mean) / stdDev
   * Anomaly if |Z| > threshold
   */
  private detectByZScore(
    dataPoints: TimeSeriesPoint[],
    stats: Statistics,
    anomalyType: AnomalyType,
    threshold: number,
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    if (stats.stdDev === 0) {
      // No variance, can't use z-score
      return alerts;
    }

    for (const point of dataPoints) {
      const zScore = (point.value - stats.mean) / stats.stdDev;

      if (Math.abs(zScore) > this.config.zScoreThreshold) {
        alerts.push(
          this.createAlert(
            anomalyType,
            `Z-score anomaly detected: ${Math.abs(zScore).toFixed(2)}`,
            point.value,
            threshold,
            stats.mean + this.config.zScoreThreshold * stats.stdDev,
            Math.abs(zScore) / this.config.zScoreThreshold, // confidence
            point.timestamp,
            point.label,
          ),
        );
      }
    }

    return alerts;
  }

  /**
   * Detect anomalies using Interquartile Range (IQR) method.
   * Anomaly if value < Q1 - 1.5*IQR or value > Q3 + 1.5*IQR
   */
  private detectByIQR(
    dataPoints: TimeSeriesPoint[],
    stats: Statistics,
    anomalyType: AnomalyType,
    threshold: number,
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    for (const point of dataPoints) {
      if (point.value < lowerBound || point.value > upperBound) {
        const severity = point.value > upperBound ? "warning" : "info";
        alerts.push(
          this.createAlert(
            anomalyType,
            `IQR anomaly detected: value outside range [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
            point.value,
            threshold,
            upperBound,
            0.8, // confidence
            point.timestamp,
            point.label,
            severity,
          ),
        );
      }
    }

    return alerts;
  }

  /**
   * Detect anomalies using moving average deviation.
   * Compares each value against a moving average of previous values.
   */
  private detectByMovingAverageDeviation(
    dataPoints: TimeSeriesPoint[],
    anomalyType: AnomalyType,
    threshold: number,
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const windowSize = this.config.movingAverageWindowSize;

    if (dataPoints.length < windowSize + 1) {
      return alerts;
    }

    for (let i = windowSize; i < dataPoints.length; i++) {
      const window = dataPoints.slice(i - windowSize, i);
      const windowValues = window.map((p) => p.value);
      const windowStats = this.calculateStatistics(windowValues);

      const currentPoint = dataPoints[i];
      const deviation = Math.abs(
        currentPoint.value - windowStats.mean,
      ) / (windowStats.stdDev || 1);

      if (deviation > this.config.movingAverageDeviationMultiplier) {
        alerts.push(
          this.createAlert(
            anomalyType,
            `Moving average deviation: ${deviation.toFixed(2)}σ from mean`,
            currentPoint.value,
            threshold,
            windowStats.mean + this.config.movingAverageDeviationMultiplier * (windowStats.stdDev || 1),
            Math.min(deviation / this.config.movingAverageDeviationMultiplier, 1.0),
            currentPoint.timestamp,
            currentPoint.label,
          ),
        );
      }
    }

    return alerts;
  }

  /**
   * Detect anomalies using sliding window analysis for delivery times.
   * Identifies unexpected patterns in sequential delivery metrics.
   */
  detectSlidingWindowAnomalies(
    metricName: string,
    anomalyType: AnomalyType,
    windowSizeMinutes: number,
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const dataPoints = this.dataHistory.get(metricName) || [];

    if (dataPoints.length < 3) {
      return alerts;
    }

    const windowMs = windowSizeMinutes * 60 * 1000;
    const now = Date.now();

    let windowStart = now - windowMs;
    const windowPoints: TimeSeriesPoint[] = [];

    for (const point of dataPoints) {
      const pointTime = new Date(point.timestamp).getTime();
      if (pointTime >= windowStart && pointTime <= now) {
        windowPoints.push(point);
      }
    }

    if (windowPoints.length < 2) {
      return alerts;
    }

    const values = windowPoints.map((p) => p.value);
    const stats = this.calculateStatistics(values);

    // Check for unusual patterns: extremely high variance or sudden spikes
    const coefficientOfVariation = stats.stdDev / (stats.mean || 1);

    if (coefficientOfVariation > 1.5) {
      // High variability
      alerts.push(
        this.createAlert(
          anomalyType,
          `High variability in metric over ${windowSizeMinutes} minutes`,
          stats.mean,
          stats.mean * 1.5,
          stats.max,
          coefficientOfVariation / 1.5,
          new Date().toISOString(),
          metricName,
          "warning",
        ),
      );
    }

    return this.deduplicateAlerts(alerts);
  }

  /**
   * Classify alert severity based on how far the value deviates from threshold.
   */
  private classifySeverity(value: number, threshold: number): AlertSeverity {
    const deviation = Math.abs(value - threshold) / threshold;

    if (deviation > 0.5) {
      return "critical";
    } else if (deviation > 0.25) {
      return "warning";
    } else {
      return "info";
    }
  }

  /**
   * Calculate statistical summary of values.
   */
  private calculateStatistics(values: number[]): Statistics {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        variance: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const q1Index = Math.floor(sorted.length / 4);
    const q3Index = Math.floor((sorted.length * 3) / 4);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return {
      mean,
      median,
      stdDev,
      variance,
      min,
      max,
      q1,
      q3,
      iqr,
    };
  }

  /**
   * Create an alert object.
   */
  private createAlert(
    anomalyType: AnomalyType,
    message: string,
    value: number,
    threshold: number,
    alertThreshold: number,
    confidence: number,
    timestamp: string,
    entityId?: string,
    severity?: AlertSeverity,
  ): AnomalyAlert {
    const finalSeverity = severity || this.classifySeverity(value, threshold);

    return {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      anomalyType,
      severity: finalSeverity,
      title: `${anomalyType}: ${value.toFixed(2)}`,
      message,
      value,
      threshold,
      confidence: Math.min(confidence, 1.0),
      detectedAt: timestamp,
      createdAt: new Date().toISOString(),
      status: "open",
      shipmentId: entityId,
      metadata: {
        alertThreshold,
        detectionMethod: "statistical",
      },
    };
  }

  /**
   * Deduplicate alerts and apply cooldown periods.
   * Prevents alerting on the same anomaly repeatedly.
   */
  private deduplicateAlerts(alerts: AnomalyAlert[]): AnomalyAlert[] {
    const now = Date.now();
    const filtered: AnomalyAlert[] = [];

    // Remove expired alert records (outside cooldown window)
    for (const [key, record] of this.recentAlerts.entries()) {
      if (now - record.timestamp > this.config.alertCooldownMs) {
        this.recentAlerts.delete(key);
      }
    }

    // Filter new alerts
    for (const alert of alerts) {
      const alertKey = `${alert.anomalyType}_${alert.shipmentId || "global"}`;

      if (!this.recentAlerts.has(alertKey)) {
        filtered.push(alert);
        this.recentAlerts.set(alertKey, {
          id: alert.id,
          timestamp: now,
          anomalyType: alert.anomalyType,
          entityId: alert.shipmentId,
        });
      }
    }

    return filtered;
  }

  /**
   * Clear history for a specific metric.
   */
  clearHistory(metricName: string): void {
    this.dataHistory.delete(metricName);
  }

  /**
   * Clear all history.
   */
  clearAllHistory(): void {
    this.dataHistory.clear();
  }

  /**
   * Get current configuration.
   */
  getConfig(): AnomalyDetectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<AnomalyDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get history size for a metric.
   */
  getHistorySize(metricName: string): number {
    return this.dataHistory.get(metricName)?.length ?? 0;
  }
}
