/**
 * AI Monitoring Module - Types and Domain Models
 *
 * Core types for the AI-powered monitoring engine including:
 * - AnomalyType: Enumeration of detectable anomalies
 * - AnomalyAlert: Alert records with severity and metadata
 * - PredictionResult: ML model prediction outputs
 * - MonitoringConfig: Configuration for monitoring components
 * - MetricWindow and TimeSeriesPoint: Time-series data structures
 */

/**
 * Types of anomalies that can be detected in delivery operations.
 */
export enum AnomalyType {
  LATE_DELIVERY = "late_delivery",
  DRIVER_IDLE = "driver_idle",
  ROUTE_DEVIATION = "route_deviation",
  SLA_BREACH = "sla_breach",
  VOLUME_SPIKE = "volume_spike",
  ZONE_CONGESTION = "zone_congestion",
}

/**
 * Severity levels for alerts.
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * An anomaly alert record.
 * Contains details about detected anomalies and routing information.
 */
export interface AnomalyAlert {
  /** Unique alert ID for deduplication. */
  id: string;

  /** Type of anomaly detected. */
  anomalyType: AnomalyType;

  /** Severity level of the alert. */
  severity: AlertSeverity;

  /** Shipment ID if applicable. */
  shipmentId?: string;

  /** Driver ID if applicable. */
  driverId?: string;

  /** Delivery zone if applicable. */
  zone?: string;

  /** Alert title/headline. */
  title: string;

  /** Detailed alert message. */
  message: string;

  /** Timestamp when anomaly was detected. */
  detectedAt: string;

  /** Timestamp when alert was created. */
  createdAt: string;

  /** Alert status. */
  status: "open" | "acknowledged" | "resolved";

  /** Optional threshold value that was exceeded. */
  threshold?: number;

  /** Actual measured value. */
  value?: number;

  /** Optional confidence score (0-1). */
  confidence?: number;

  /** Metadata about the alert context. */
  metadata?: Record<string, unknown>;

  /** Who/what should be notified. */
  recipients?: {
    dispatcher?: boolean;
    driver?: boolean;
    customer?: boolean;
    oncall?: boolean;
  };

  /** ID of previous related alerts for correlation. */
  relatedAlertIds?: string[];

  /** Alert acknowledgment timestamp. */
  acknowledgedAt?: string;

  /** Alert resolution timestamp. */
  resolvedAt?: string;
}

/**
 * Result of a prediction model.
 * Contains predicted values, confidence intervals, and metadata.
 */
export interface PredictionResult {
  /** Unique prediction ID. */
  id: string;

  /** Shipment ID being predicted. */
  shipmentId: string;

  /** Driver ID being predicted. */
  driverId?: string;

  /** Predicted ETA in milliseconds from prediction time. */
  estimatedTimeMs: number;

  /** Lower bound of confidence interval (milliseconds). */
  confidenceLowerMs: number;

  /** Upper bound of confidence interval (milliseconds). */
  confidenceUpperMs: number;

  /** Confidence level (0-1). */
  confidence: number;

  /** Actual observed time (if completed). */
  actualTimeMs?: number;

  /** Model accuracy metrics. */
  accuracy?: {
    /** Mean Absolute Error in milliseconds. */
    mae: number;

    /** Root Mean Squared Error in milliseconds. */
    rmse: number;

    /** Mean Absolute Percentage Error. */
    mape: number;
  };

  /** Features used for prediction. */
  features?: {
    distance: number;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    trafficZone: string;
    driverSpeedHistory: number; // avg km/h
    stopsRemaining: number;
  };

  /** Prediction timestamp. */
  timestamp: string;

  /** Whether this was a fallback prediction. */
  isFallback: boolean;

  /** Metadata about the prediction. */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the monitoring system.
 */
export interface MonitoringConfig {
  /** Enable/disable monitoring. */
  enabled: boolean;

  /** Thresholds per anomaly type. */
  thresholds: {
    lateDeliveryMinutesThreshold?: number;
    driverIdleMinutesThreshold?: number;
    routeDeviationKmThreshold?: number;
    slaBreach?: {
      percent: number; // e.g., 95 for 95%
      timeWindowMinutes: number;
    };
    volumeSpikePercentIncrease?: number;
    zongCongestionDeliveryCountThreshold?: number;
  };

  /** Cooldown period in milliseconds before re-alerting same anomaly. */
  alertCooldownMs: number;

  /** Enable ETA prediction. */
  etaPredictionEnabled: boolean;

  /** Minimum prediction accuracy before using predictions. */
  etaMinimumAccuracy: number; // 0-1

  /** Enable anomaly alerts. */
  anomalyDetectionEnabled: boolean;

  /** Time window for analyzing metrics (milliseconds). */
  analysisWindowMs: number;

  /** Number of historical data points to keep. */
  maxHistoryPoints: number;

  /** Maintenance windows when alerts are suppressed. */
  maintenanceWindows?: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
  }[];
}

/**
 * A time window for metric analysis.
 * Represents a period over which metrics are aggregated.
 */
export interface MetricWindow {
  /** Start timestamp (ISO 8601). */
  startTime: string;

  /** End timestamp (ISO 8601). */
  endTime: string;

  /** Number of data points in this window. */
  dataPointCount: number;

  /** Metric type being analyzed. */
  metricType: string;

  /** Aggregated metric value. */
  value: number;

  /** Optional variance of values in window. */
  variance?: number;

  /** Optional standard deviation. */
  standardDeviation?: number;
}

/**
 * A single point in a time series.
 */
export interface TimeSeriesPoint {
  /** Timestamp (ISO 8601). */
  timestamp: string;

  /** Numeric value at this point. */
  value: number;

  /** Associated metric or dimension label. */
  label?: string;

  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Rule-based alert definition.
 */
export interface AlertRule {
  /** Unique rule ID. */
  id: string;

  /** Rule name. */
  name: string;

  /** Rule description. */
  description?: string;

  /** Metric field to monitor. */
  metric: string;

  /** Comparison operator. */
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";

  /** Threshold value or array of values. */
  threshold: number | number[];

  /** Alert severity when rule matches. */
  severity: AlertSeverity;

  /** Whether rule is enabled. */
  enabled: boolean;

  /** Time duration in minutes before triggering alert. */
  durationMinutes?: number;

  /** Recipients for this rule. */
  recipients?: {
    dispatcher?: boolean;
    driver?: boolean;
    customer?: boolean;
    oncall?: boolean;
  };

  /** Alert message template. */
  messageTemplate?: string;
}

/**
 * Daily alert summary digest.
 */
export interface AlertDigest {
  /** Digest ID. */
  id: string;

  /** Tenant/shop ID. */
  tenantId: string;

  /** Date of the digest. */
  date: string;

  /** Total alerts in this period. */
  totalAlerts: number;

  /** Alerts by severity. */
  alertsBySeverity: {
    info: number;
    warning: number;
    critical: number;
  };

  /** Alerts by type. */
  alertsByType: Record<AnomalyType, number>;

  /** Top issues (sorted by frequency). */
  topIssues: Array<{
    anomalyType: AnomalyType;
    count: number;
    affectedEntities: string[];
  }>;

  /** Generated timestamp. */
  generatedAt: string;
}
