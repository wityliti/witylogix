/**
 * Integration Health Monitor Type Definitions
 *
 * Defines core types for health monitoring including provider health status,
 * SLA tracking, latency histograms, error classification, degradation detection,
 * and alerting rules and escalation policies.
 */

// ─── HEALTH STATUS TYPES ────────────────────────────────────────────────────

/**
 * Health status enumeration.
 */
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

/**
 * Provider health information with real-time status.
 */
export interface ProviderHealth {
  providerId: string;
  providerName: string;
  status: HealthStatus;
  lastChecked: Date;
  lastStatusChange: Date;
  uptime: number; // percentage
  averageLatency: number; // ms
  errorRate: number; // percentage
  totalRequests: number;
  failedRequests: number;
  nextCheckTime: Date;
  lastError?: string;
}

/**
 * Health check execution result.
 */
export interface HealthCheck {
  providerId: string;
  timestamp: Date;
  statusCode?: number;
  responseTime: number; // ms
  success: boolean;
  error?: string;
  endpoint: string;
  region?: string;
}

// ─── SLA TYPES ──────────────────────────────────────────────────────────────

/**
 * SLA configuration per provider.
 */
export interface SLAConfig {
  providerId: string;
  uptimeTarget: number; // percentage (e.g., 99.9)
  latencyTargetP95: number; // ms
  latencyTargetP99: number; // ms
  errorRateTarget: number; // percentage (e.g., 0.1)
  windowDays: number; // rolling window size
  contractual: boolean; // true if this is contractual SLA
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * SLA calculation and breach information.
 */
export interface SLAReport {
  providerId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  uptimeAchieved: number;
  uptimeTarget: number;
  uptimeMet: boolean;
  latencyP95Achieved: number;
  latencyP95Target: number;
  latencyP95Met: boolean;
  latencyP99Achieved: number;
  latencyP99Target: number;
  latencyP99Met: boolean;
  errorRateAchieved: number;
  errorRateTarget: number;
  errorRateMet: boolean;
  breachCount: number;
  breachSeverity?: "critical" | "high" | "medium" | "low";
  creditAmount?: number; // SLA credit value
}

// ─── LATENCY TYPES ──────────────────────────────────────────────────────────

/**
 * Latency percentile bucket for distribution analysis.
 */
export interface LatencyBucket {
  timestamp: Date;
  endpoint: string;
  p50: number; // median
  p95: number; // 95th percentile
  p99: number; // 99th percentile
  p999: number; // 99.9th percentile
  min: number;
  max: number;
  mean: number;
  count: number;
}

/**
 * Time window for latency analysis.
 */
export type LatencyTimeWindow = "1min" | "5min" | "1hr" | "24hr";

// ─── ERROR TYPES ────────────────────────────────────────────────────────────

/**
 * Error classification for categorization and analysis.
 */
export type ErrorClassification =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "server_error"
  | "client_error"
  | "network"
  | "unknown";

/**
 * Error trend direction indicator.
 */
export type ErrorTrend = "increasing" | "decreasing" | "stable" | "spike";

/**
 * Error trend analysis and correlation data.
 */
export interface ErrorTrendData {
  providerId: string;
  timestamp: Date;
  classification: ErrorClassification;
  errorCount: number;
  errorRate: number; // errors per minute
  trend: ErrorTrend;
  percentageChange: number; // compared to baseline
  correlatedProviders?: string[]; // other providers with similar errors
  rootCauseHint?: string;
}

// ─── DEGRADATION TYPES ──────────────────────────────────────────────────────

/**
 * Degradation event from multi-signal anomaly detection.
 */
export interface DegradationEvent {
  providerId: string;
  timestamp: Date;
  severity: "critical" | "high" | "medium" | "low";
  signals: {
    latencyDeviation: number; // std devs from baseline
    errorRateDeviation: number;
    volumeDeviation: number; // request volume change
  };
  anomalyScore: number; // 0-100
  baseline: {
    latency: number;
    errorRate: number;
    volume: number;
  };
  recovered?: {
    timestamp: Date;
    recoveryTime: number; // minutes
  };
}

// ─── ALERT TYPES ────────────────────────────────────────────────────────────

/**
 * Alert severity level.
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Supported alert notification channels.
 */
export type AlertChannel = "slack" | "email" | "pagerduty" | "webhook";

/**
 * Alert rule type for triggering conditions.
 */
export type AlertRuleType = "threshold" | "trend" | "anomaly" | "sla_breach";

/**
 * Alert rule definition with conditions and actions.
 */
export interface AlertRule {
  ruleId: string;
  providerId?: string;
  name: string;
  type: AlertRuleType;
  condition: {
    metric: "latency" | "error_rate" | "uptime" | "volume" | "sla";
    operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
    threshold: number;
    window?: number; // minutes, for trend detection
  };
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Escalation step in an escalation policy.
 */
export interface EscalationStep {
  delayMinutes: number;
  channels: AlertChannel[];
  targetOnCallSchedule?: string; // reference to on-call schedule
}

/**
 * Escalation policy for alert notification chains.
 */
export interface EscalationPolicy {
  policyId: string;
  name: string;
  steps: EscalationStep[];
  maxEscalationLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert instance with lifecycle state.
 */
export interface Alert {
  alertId: string;
  ruleId: string;
  providerId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  status: "firing" | "acknowledged" | "resolved";
  createdAt: Date;
  firedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  escalationLevel: number;
  nextEscalationAt?: Date;
  notificationsSent: AlertChannel[];
}

// ─── ALERT CONFIGURATION ────────────────────────────────────────────────────

/**
 * Alert deduplication and aggregation settings.
 */
export interface AlertDeduplicationConfig {
  enabled: boolean;
  windowMinutes: number;
  groupByLabels: string[];
}

/**
 * Alert acknowledgment with tracking.
 */
export interface AlertAcknowledgment {
  alertId: string;
  acknowledgedBy: string;
  acknowledgedAt: Date;
  comment?: string;
}

/**
 * Alert resolution with details.
 */
export interface AlertResolution {
  alertId: string;
  resolvedBy: string;
  resolvedAt: Date;
  rootCause?: string;
  actionsTaken?: string;
}
