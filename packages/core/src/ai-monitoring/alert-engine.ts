/**
 * Alert Engine
 *
 * Generates and manages alerts based on:
 * - Rule-based conditions (thresholds, operators)
 * - Anomaly detection results
 * - Alert routing (dispatcher, driver, customer, oncall)
 * - Escalation chains
 * - Alert suppression during maintenance windows
 * - Daily summary digest generation
 */

import type {
  AnomalyAlert,
  AlertRule,
  AlertDigest,
  AlertSeverity,
  AnomalyType,
} from "./types.js";

/**
 * Configuration for the alert engine.
 */
interface AlertEngineConfig {
  /** Enable alert generation. */
  enabled: boolean;

  /** Enable escalation. */
  escalationEnabled: boolean;

  /** Time to escalate from warning to critical (milliseconds). */
  escalationTimeMs: number;

  /** Enable alert suppression. */
  suppressionEnabled: boolean;

  /** Maintenance windows for alert suppression. */
  maintenanceWindows: Array<{
    startHour: number;
    endHour: number;
    timezone: string;
  }>;

  /** Enable digest generation. */
  digestEnabled: boolean;

  /** Digest generation time (HH:MM format). */
  digestTimeUTC: string;
}

/**
 * Internal alert tracking record.
 */
interface AlertRecord {
  alert: AnomalyAlert;
  createdAt: number;
  acknowledgedAt?: number;
  escalatedAt?: number;
  deliveredTo?: Set<string>;
}

/**
 * AlertEngine class for alert management and routing.
 */
export class AlertEngine {
  private config: AlertEngineConfig;
  private alertRecords: Map<string, AlertRecord> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private lastDigestTime: number = 0;

  constructor(config: Partial<AlertEngineConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      escalationEnabled: config.escalationEnabled ?? true,
      escalationTimeMs: config.escalationTimeMs ?? 30 * 60 * 1000, // 30 minutes
      suppressionEnabled: config.suppressionEnabled ?? true,
      maintenanceWindows: config.maintenanceWindows ?? [],
      digestEnabled: config.digestEnabled ?? true,
      digestTimeUTC: config.digestTimeUTC ?? "06:00",
    };
  }

  /**
   * Process an anomaly alert and route it appropriately.
   *
   * @param alert - Anomaly alert to process
   * @returns Processed alert with routing information
   */
  processAlert(alert: AnomalyAlert): AnomalyAlert {
    if (!this.config.enabled) {
      return alert;
    }

    // Check if alert should be suppressed
    if (this.isMaintenanceWindow()) {
      return alert;
    }

    // Check for duplicate/existing alert
    const existingRecord = this.alertRecords.get(alert.id);
    if (existingRecord) {
      return existingRecord.alert;
    }

    // Determine recipients based on severity
    const recipients = this.determineRecipients(
      alert.severity,
      alert.anomalyType,
    );
    alert.recipients = recipients;

    // Create tracking record
    const record: AlertRecord = {
      alert: { ...alert },
      createdAt: Date.now(),
      deliveredTo: new Set<string>(),
    };

    this.alertRecords.set(alert.id, record);

    return alert;
  }

  /**
   * Add or update an alert rule.
   *
   * @param rule - Alert rule to add/update
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, { ...rule });
  }

  /**
   * Evaluate rules against current metrics.
   * Returns new alerts generated from rule evaluation.
   *
   * @param metrics - Metric values to evaluate
   * @returns Array of generated alerts
   */
  evaluateRules(metrics: Record<string, number>): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      const metricValue = metrics[rule.metric];
      if (metricValue === undefined) {
        continue;
      }

      if (this.evaluateRule(rule, metricValue)) {
        const alert = this.createAlertFromRule(rule, metricValue);
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Acknowledge an alert.
   *
   * @param alertId - Alert ID to acknowledge
   * @returns Updated alert
   */
  acknowledgeAlert(alertId: string): AnomalyAlert | null {
    const record = this.alertRecords.get(alertId);
    if (!record) {
      return null;
    }

    record.alert.status = "acknowledged";
    record.alert.acknowledgedAt = new Date().toISOString();
    record.acknowledgedAt = Date.now();

    return record.alert;
  }

  /**
   * Resolve an alert.
   *
   * @param alertId - Alert ID to resolve
   * @returns Updated alert
   */
  resolveAlert(alertId: string): AnomalyAlert | null {
    const record = this.alertRecords.get(alertId);
    if (!record) {
      return null;
    }

    record.alert.status = "resolved";
    record.alert.resolvedAt = new Date().toISOString();

    // Keep for history but mark as resolved
    return record.alert;
  }

  /**
   * Check for alerts that should be escalated.
   * Returns alerts that have been open for escalation threshold.
   */
  checkEscalations(): AnomalyAlert[] {
    const escalated: AnomalyAlert[] = [];

    if (!this.config.escalationEnabled) {
      return escalated;
    }

    const now = Date.now();

    for (const record of this.alertRecords.values()) {
      // Skip if already acknowledged/resolved
      if (
        record.alert.status === "acknowledged" ||
        record.alert.status === "resolved"
      ) {
        continue;
      }

      // Check if past escalation threshold
      const openTime = now - record.createdAt;
      if (openTime > this.config.escalationTimeMs && !record.escalatedAt) {
        record.escalatedAt = now;

        // Escalate to critical if not already
        if (record.alert.severity !== "critical") {
          record.alert.severity = "critical";
          record.alert.recipients = {
            dispatcher: true,
            oncall: true,
          };

          escalated.push(record.alert);
        }
      }
    }

    return escalated;
  }

  /**
   * Generate a daily digest of alerts.
   *
   * @param tenantId - Tenant ID
   * @param date - Date for the digest (ISO format)
   * @returns Alert digest
   */
  generateDigest(tenantId: string, date: string): AlertDigest {
    const digestId = `digest_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayEndMs = dayEnd.getTime();

    // Filter alerts from this day
    const dayAlerts: AlertRecord[] = [];
    for (const record of this.alertRecords.values()) {
      if (record.createdAt >= dayStartMs && record.createdAt <= dayEndMs) {
        dayAlerts.push(record);
      }
    }

    // Count by severity
    const alertsBySeverity = { info: 0, warning: 0, critical: 0 };
    const alertsByType = new Map<AnomalyType, number>();

    for (const record of dayAlerts) {
      alertsBySeverity[record.alert.severity]++;

      const type = record.alert.anomalyType;
      alertsByType.set(type, (alertsByType.get(type) ?? 0) + 1);
    }

    // Get top issues
    const topIssues = Array.from(alertsByType.entries())
      .map(([type, count]) => ({
        anomalyType: type,
        count,
        affectedEntities: Array.from(
          new Set(
            dayAlerts
              .filter((r) => r.alert.anomalyType === type)
              .map((r) => r.alert.shipmentId || "unknown")
              .filter((id) => id !== "unknown"),
          ),
        ),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      id: digestId,
      tenantId,
      date,
      totalAlerts: dayAlerts.length,
      alertsBySeverity,
      alertsByType: Object.fromEntries(alertsByType) as Record<
        AnomalyType,
        number
      >,
      topIssues,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get open alerts.
   */
  getOpenAlerts(): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    for (const record of this.alertRecords.values()) {
      if (record.alert.status === "open") {
        alerts.push(record.alert);
      }
    }

    return alerts;
  }

  /**
   * Get acknowledged alerts.
   */
  getAcknowledgedAlerts(): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    for (const record of this.alertRecords.values()) {
      if (record.alert.status === "acknowledged") {
        alerts.push(record.alert);
      }
    }

    return alerts;
  }

  /**
   * Get all alerts with optional filtering.
   */
  getAllAlerts(options?: {
    severity?: AlertSeverity;
    anomalyType?: AnomalyType;
    status?: string;
    limit?: number;
  }): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    for (const record of this.alertRecords.values()) {
      const alert = record.alert;

      if (options?.severity && alert.severity !== options.severity) {
        continue;
      }

      if (options?.anomalyType && alert.anomalyType !== options.anomalyType) {
        continue;
      }

      if (options?.status && alert.status !== options.status) {
        continue;
      }

      alerts.push(alert);

      if (options?.limit && alerts.length >= options.limit) {
        break;
      }
    }

    return alerts;
  }

  /**
   * Clear resolved alerts older than specified time.
   *
   * @param ageMs - Age in milliseconds
   * @returns Number of alerts cleared
   */
  clearOldAlerts(ageMs: number): number {
    const cutoffTime = Date.now() - ageMs;
    let cleared = 0;

    for (const [id, record] of this.alertRecords.entries()) {
      if (record.alert.status === "resolved" && record.createdAt < cutoffTime) {
        this.alertRecords.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get statistics about alerts.
   */
  getStatistics(): {
    totalAlerts: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    alertsByType: Record<AnomalyType, number>;
    alertsBySeverity: Record<AlertSeverity, number>;
  } {
    const stats = {
      totalAlerts: this.alertRecords.size,
      openAlerts: 0,
      acknowledgedAlerts: 0,
      resolvedAlerts: 0,
      alertsByType: {} as Record<AnomalyType, number>,
      alertsBySeverity: { info: 0, warning: 0, critical: 0 } as Record<
        AlertSeverity,
        number
      >,
    };

    for (const record of this.alertRecords.values()) {
      const alert = record.alert;

      if (alert.status === "open") {
        stats.openAlerts++;
      } else if (alert.status === "acknowledged") {
        stats.acknowledgedAlerts++;
      } else if (alert.status === "resolved") {
        stats.resolvedAlerts++;
      }

      stats.alertsByType[alert.anomalyType] =
        (stats.alertsByType[alert.anomalyType] ?? 0) + 1;
      stats.alertsBySeverity[alert.severity]++;
    }

    return stats;
  }

  /**
   * Check if currently in a maintenance window.
   */
  private isMaintenanceWindow(): boolean {
    if (!this.config.suppressionEnabled) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();

    for (const window of this.config.maintenanceWindows) {
      // Simplified check - doesn't account for timezone properly
      if (currentHour >= window.startHour && currentHour < window.endHour) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine recipients based on alert severity and type.
   */
  private determineRecipients(
    severity: AlertSeverity,
    anomalyType: AnomalyType,
  ): AnomalyAlert["recipients"] {
    const recipients: AnomalyAlert["recipients"] = {
      dispatcher: false,
      driver: false,
      customer: false,
      oncall: false,
    };

    switch (severity) {
      case "critical":
        recipients.dispatcher = true;
        recipients.oncall = true;
        if (anomalyType === AnomalyType.LATE_DELIVERY) {
          recipients.customer = true;
        }
        break;

      case "warning":
        recipients.dispatcher = true;
        if (
          [AnomalyType.DRIVER_IDLE, AnomalyType.ROUTE_DEVIATION].includes(
            anomalyType,
          )
        ) {
          recipients.driver = true;
        }
        break;

      case "info":
        recipients.dispatcher = true;
        break;
    }

    return recipients;
  }

  /**
   * Evaluate a single rule against a metric value.
   */
  private evaluateRule(rule: AlertRule, value: number): boolean {
    const threshold = rule.threshold;

    if (Array.isArray(threshold)) {
      // Multiple values for "in" operator
      if (rule.operator === "in") {
        return threshold.includes(value);
      }
      return false;
    }

    switch (rule.operator) {
      case "eq":
        return value === threshold;
      case "neq":
        return value !== threshold;
      case "gt":
        return value > threshold;
      case "gte":
        return value >= threshold;
      case "lt":
        return value < threshold;
      case "lte":
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * Create an alert from a rule.
   */
  private createAlertFromRule(rule: AlertRule, value: number): AnomalyAlert {
    const message =
      rule.messageTemplate || `Rule '${rule.name}' triggered: ${value}`;

    return {
      id: `rule_alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      anomalyType: "VOLUME_SPIKE" as AnomalyType,
      severity: rule.severity,
      title: rule.name,
      message,
      value,
      detectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "open",
      recipients: rule.recipients,
    };
  }
}
