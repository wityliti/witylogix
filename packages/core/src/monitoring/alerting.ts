/**
 * Alert Rules Engine — Threshold-based alerting with deduplication.
 *
 * Features:
 * - Threshold-based alerts (error rate > 5%, p99 > 2s)
 * - Alert channels: webhook, email, Slack
 * - Deduplication and grouping
 * - Cooldown period (don't re-alert for 15 min)
 * - Severity levels: info, warning, critical
 *
 * Usage:
 * const alertMgr = new AlertManager();
 * alertMgr.addChannel("slack", slackHandler);
 * alertMgr.registerRule("high_error_rate", { threshold: 0.05, severity: "critical" });
 * alertMgr.checkAndAlert({ errorRate: 0.08 }, "high_error_rate");
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: Record<string, unknown>) => boolean;
  severity: AlertSeverity;
  cooldownMinutes?: number;
  groupingKey?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: AlertSeverity;
  title: string;
  message: string;
  metrics: Record<string, unknown>;
  groupingKey?: string;
}

export interface AlertChannelHandler {
  send(alert: Alert): Promise<void>;
}

export interface WebhookChannelConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface EmailChannelConfig {
  from: string;
  to: string[];
  subject?: string;
  timeout?: number;
}

export interface SlackChannelConfig {
  webhookUrl: string;
  channel?: string;
  botName?: string;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const DEFAULT_COOLDOWN_MINUTES = 15;
const ALERT_HISTORY_LIMIT = 1000;

// ─── CHANNEL IMPLEMENTATIONS ──────────────────────────────────────────

/**
 * Webhook alert channel.
 */
export class WebhookChannel implements AlertChannelHandler {
  constructor(private config: WebhookChannelConfig) {}

  async send(alert: Alert): Promise<void> {
    const timeout = this.config.timeout || 5000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(alert),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Webhook returned ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Webhook channel error:", error);
      throw error;
    }
  }
}

/**
 * Email alert channel (interface only, requires email service).
 */
export class EmailChannel implements AlertChannelHandler {
  constructor(private config: EmailChannelConfig) {}

  async send(alert: Alert): Promise<void> {
    // In production, this would send via SMTP or email service
    const emailBody = `
Alert: ${alert.title}
Severity: ${alert.severity}
Timestamp: ${alert.timestamp}

Message: ${alert.message}

Metrics:
${Object.entries(alert.metrics)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
    `;

    console.log(`[EMAIL] To: ${this.config.to.join(", ")}`);
    console.log(`[EMAIL] Subject: ${alert.title}`);
    console.log(`[EMAIL] Body:\n${emailBody}`);
  }
}

/**
 * Slack alert channel.
 */
export class SlackChannel implements AlertChannelHandler {
  constructor(private config: SlackChannelConfig) {}

  async send(alert: Alert): Promise<void> {
    const color =
      alert.severity === "critical"
        ? "ff0000"
        : alert.severity === "warning"
          ? "ffaa00"
          : "0099ff";

    const payload = {
      channel: this.config.channel,
      username: this.config.botName || "Alert Bot",
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: "Severity",
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: "Time",
              value: alert.timestamp.toISOString(),
              short: true,
            },
            {
              title: "Metrics",
              value: Object.entries(alert.metrics)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n"),
              short: false,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Slack returned ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Slack channel error:", error);
      throw error;
    }
  }
}

// ─── ALERT MANAGER ────────────────────────────────────────────────────

/**
 * Manages alert rules, channels, and deduplication.
 */
export class AlertManager {
  private rules = new Map<string, AlertRule>();
  private channels = new Map<string, AlertChannelHandler>();
  private alertHistory: Alert[] = [];
  private lastAlertTime = new Map<string, number>();
  private alertQueue: Alert[] = [];

  /**
   * Register an alert rule.
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister an alert rule.
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Add an alert channel.
   */
  addChannel(name: string, handler: AlertChannelHandler): void {
    this.channels.set(name, handler);
  }

  /**
   * Remove an alert channel.
   */
  removeChannel(name: string): void {
    this.channels.delete(name);
  }

  /**
   * Check metrics against rules and trigger alerts.
   */
  async checkAndAlert(metrics: Record<string, unknown>): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      try {
        // Check if rule condition is met
        if (!rule.condition(metrics)) {
          continue;
        }

        // Check cooldown
        const lastTime = this.lastAlertTime.get(rule.id) || 0;
        const cooldown = (rule.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES) * 60 * 1000;

        if (Date.now() - lastTime < cooldown) {
          continue;
        }

        // Create alert
        const alert: Alert = {
          id: `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          timestamp: new Date(),
          severity: rule.severity,
          title: rule.name,
          message: `Alert triggered: ${rule.name}`,
          metrics,
          groupingKey: rule.groupingKey,
        };

        triggeredAlerts.push(alert);
        this.lastAlertTime.set(rule.id, Date.now());
      } catch (error) {
        console.error(`Error checking rule ${rule.id}:`, error);
      }
    }

    // Send alerts through channels
    for (const alert of triggeredAlerts) {
      await this.sendAlert(alert);
    }

    return triggeredAlerts;
  }

  /**
   * Send an alert to all registered channels.
   */
  async sendAlert(alert: Alert): Promise<void> {
    this.alertHistory.push(alert);

    // Limit history size
    if (this.alertHistory.length > ALERT_HISTORY_LIMIT) {
      this.alertHistory.shift();
    }

    // Send to all channels
    const promises = Array.from(this.channels.values()).map((channel) =>
      channel
        .send(alert)
        .catch((error) =>
          console.error("Error sending alert:", error)
        )
    );

    await Promise.all(promises);
  }

  /**
   * Get alert history.
   */
  getHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get active alerts (within last hour).
   */
  getActiveAlerts(): Alert[] {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.alertHistory.filter(
      (a) => a.timestamp.getTime() > oneHourAgo
    );
  }

  /**
   * Get alert count by severity.
   */
  getAlertStats(): Record<AlertSeverity, number> {
    const stats: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };

    for (const alert of this.alertHistory) {
      stats[alert.severity]++;
    }

    return stats;
  }

  /**
   * Clear alert history.
   */
  clearHistory(): void {
    this.alertHistory = [];
    this.lastAlertTime.clear();
  }
}

// ─── PREDEFINED RULES ──────────────────────────────────────────────────

/**
 * Create a rule for high error rate.
 */
export function createHighErrorRateRule(threshold: number = 0.05): AlertRule {
  return {
    id: "high_error_rate",
    name: "High Error Rate",
    condition: (metrics) => {
      const errorRate = (metrics.errorRate as number) || 0;
      return errorRate > threshold;
    },
    severity: "critical",
    cooldownMinutes: 15,
    groupingKey: "error_rate",
  };
}

/**
 * Create a rule for high latency.
 */
export function createHighLatencyRule(thresholdMs: number = 2000): AlertRule {
  return {
    id: "high_latency",
    name: "High Latency Detected",
    condition: (metrics) => {
      const p99 = (metrics.p99Latency as number) || 0;
      return p99 > thresholdMs;
    },
    severity: "warning",
    cooldownMinutes: 10,
    groupingKey: "latency",
  };
}

/**
 * Create a rule for low success rate.
 */
export function createLowSuccessRateRule(threshold: number = 0.95): AlertRule {
  return {
    id: "low_success_rate",
    name: "Low Success Rate",
    condition: (metrics) => {
      const successRate = (metrics.successRate as number) || 0;
      return successRate < threshold;
    },
    severity: "critical",
    cooldownMinutes: 15,
    groupingKey: "success_rate",
  };
}

// ─── SINGLETON INSTANCE ────────────────────────────────────────────────

let alertManagerInstance: AlertManager | null = null;

/**
 * Get the global alert manager instance.
 */
export function getAlertManager(): AlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager();
  }
  return alertManagerInstance;
}
