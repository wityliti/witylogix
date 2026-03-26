/**
 * Capacity Alert System
 *
 * Real-time alerting for capacity issues, demand spikes, and anomalies:
 * - Alert rule system with conditions and actions
 * - Built-in rules: demand-spike, capacity-shortage, model-degradation, anomaly-cluster
 * - Multiple alert channels: in-app, email, Slack, SMS
 * - Alert escalation: warning → critical → emergency
 * - Alert acknowledgement and resolution tracking
 * - Alert dashboard data provider
 */

import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Alert severity level
 */
export type AlertSeverity = 'warning' | 'critical' | 'emergency';

/**
 * Alert channel for notification
 */
export type AlertChannel = 'in_app' | 'email' | 'slack' | 'sms';

/**
 * Alert rule condition
 */
export interface AlertCondition {
  type: 'threshold' | 'change' | 'pattern' | 'comparison';
  operator: '>' | '<' | '==' | '>=' | '<=' | 'change_percent' | 'contains';
  value: number | string;
  metric: string; // e.g., "demand_gap_percent", "model_accuracy", "anomaly_count"
}

/**
 * Alert rule action
 */
export interface AlertAction {
  channels: AlertChannel[];
  escalateAfterMinutes?: number; // escalate to next severity level
  requiresAcknowledgement: boolean;
  autoResolveAfterMinutes?: number;
}

/**
 * Alert rule definition
 */
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  // Rule logic
  conditions: AlertCondition[];
  conditionLogic: 'all' | 'any'; // AND or OR
  defaultSeverity: AlertSeverity;
  action: AlertAction;

  // Cooldown to prevent alert spam
  cooldownMinutes: number;
  lastTriggeredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  zoneId?: string;
  severity: AlertSeverity;

  // Content
  title: string;
  message: string;
  context: Record<string, any>;

  // Status
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedReason?: string;

  // Escalation
  escalationLevel: number; // 0 = warning, 1 = critical, 2 = emergency
  nextEscalationAt?: Date;

  // Metadata
  channelsNotified: AlertChannel[];
  notificationsSentAt: Date[];
}

/**
 * Alert dashboard data
 */
export interface AlertDashboard {
  activeAlerts: Alert[];
  acknowledgedAlerts: Alert[];
  resolvedAlerts: Alert[];
  stats: {
    totalActive: number;
    totalAcknowledged: number;
    totalResolved: number;
    criticalCount: number;
    emergencyCount: number;
    mostCommonRule: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// CAPACITY ALERT SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Capacity alert system
 * Evaluates rules and manages alert lifecycle
 */
export class CapacityAlertSystem extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertIdCounter: number = 0;

  // Built-in rule templates
  private readonly builtInRules: Record<string, Partial<AlertRule>> = {
    demand_spike: {
      name: 'Demand Spike Alert',
      description: 'Triggered when demand increases >50% above prediction',
      conditions: [
        {
          type: 'threshold',
          operator: '>',
          value: 0.5,
          metric: 'demand_gap_percent',
        },
      ],
      conditionLogic: 'all',
      defaultSeverity: 'warning',
      cooldownMinutes: 15,
    },
    capacity_shortage: {
      name: 'Capacity Shortage Alert',
      description: 'Triggered when demand exceeds capacity by >30%',
      conditions: [
        {
          type: 'threshold',
          operator: '>',
          value: 0.3,
          metric: 'utilization_gap',
        },
      ],
      conditionLogic: 'all',
      defaultSeverity: 'critical',
      cooldownMinutes: 10,
    },
    model_degradation: {
      name: 'Model Degradation Alert',
      description: 'Triggered when prediction accuracy drops >10%',
      conditions: [
        {
          type: 'change',
          operator: 'change_percent',
          value: -10,
          metric: 'model_accuracy',
        },
      ],
      conditionLogic: 'all',
      defaultSeverity: 'warning',
      cooldownMinutes: 60,
    },
    anomaly_cluster: {
      name: 'Anomaly Cluster Alert',
      description: 'Triggered when >3 anomalies detected in 30 minutes',
      conditions: [
        {
          type: 'threshold',
          operator: '>',
          value: 3,
          metric: 'anomaly_count_30m',
        },
      ],
      conditionLogic: 'all',
      defaultSeverity: 'critical',
      cooldownMinutes: 30,
    },
  };

  constructor() {
    super();
    this.initializeBuiltInRules();
  }

  /**
   * Initialize built-in alert rules
   */
  private initializeBuiltInRules(): void {
    for (const [key, template] of Object.entries(this.builtInRules)) {
      const rule: AlertRule = {
        id: key,
        name: template.name || '',
        description: template.description,
        enabled: true,
        conditions: template.conditions || [],
        conditionLogic: template.conditionLogic || 'all',
        defaultSeverity: template.defaultSeverity || 'warning',
        action: {
          channels: ['in_app', 'email'],
          escalateAfterMinutes: 15,
          requiresAcknowledgement: true,
          autoResolveAfterMinutes: 240,
        },
        cooldownMinutes: template.cooldownMinutes || 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Create custom alert rule
   */
  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(newRule.id, newRule);
    this.emit('rule_created', newRule);

    return newRule;
  }

  /**
   * Update alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates, { updatedAt: new Date() });
    this.emit('rule_updated', rule);

    return true;
  }

  /**
   * Delete alert rule
   */
  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.emit('rule_deleted', ruleId);
    }
    return deleted;
  }

  /**
   * Evaluate all alert rules against current snapshot
   * Checks conditions and triggers alerts as needed
   */
  evaluateAlerts(snapshot: {
    zoneId?: string;
    demandGapPercent?: number;
    utilizationGap?: number;
    modelAccuracy?: number;
    anomalyCount30m?: number;
    [key: string]: any;
  }): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggeredAt) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggeredAt.getTime();
        if (timeSinceLastTrigger < rule.cooldownMinutes * 60 * 1000) {
          continue; // Still in cooldown
        }
      }

      // Evaluate conditions
      const conditionResults = rule.conditions.map((condition) => this.evaluateCondition(condition, snapshot));

      let ruleMatches: boolean;
      if (rule.conditionLogic === 'all') {
        ruleMatches = conditionResults.every((r) => r);
      } else {
        ruleMatches = conditionResults.some((r) => r);
      }

      if (ruleMatches) {
        // Trigger alert
        const alert = this.createAlert(rule, snapshot);
        triggeredAlerts.push(alert);
        rule.lastTriggeredAt = new Date();

        // Notify
        this.notifyAlert(alert, rule.action);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    this.emit('alert_acknowledged', alert);
    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedReason = reason;

    this.emit('alert_resolved', alert);
    return true;
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | null {
    return this.alerts.get(alertId) || null;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.status === 'active');
  }

  /**
   * Get all acknowledged alerts
   */
  getAcknowledgedAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.status === 'acknowledged');
  }

  /**
   * Get alerts by zone
   */
  getAlertsByZone(zoneId: string, status?: Alert['status']): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => {
      if (a.zoneId !== zoneId) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  }

  /**
   * Get alert dashboard data
   */
  getAlertDashboard(): AlertDashboard {
    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = allAlerts.filter((a) => a.status === 'active');
    const acknowledgedAlerts = allAlerts.filter((a) => a.status === 'acknowledged');
    const resolvedAlerts = allAlerts.filter((a) => a.status === 'resolved');

    // Count rule triggers for most common
    const ruleCounts: Record<string, number> = {};
    for (const alert of activeAlerts) {
      ruleCounts[alert.ruleId] = (ruleCounts[alert.ruleId] || 0) + 1;
    }
    const mostCommonRule = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      activeAlerts,
      acknowledgedAlerts,
      resolvedAlerts,
      stats: {
        totalActive: activeAlerts.length,
        totalAcknowledged: acknowledgedAlerts.length,
        totalResolved: resolvedAlerts.length,
        criticalCount: activeAlerts.filter((a) => a.severity === 'critical').length,
        emergencyCount: activeAlerts.filter((a) => a.severity === 'emergency').length,
        mostCommonRule,
      },
    };
  }

  /**
   * Clear alerts older than specified days
   */
  clearOldAlerts(days: number): number {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    let cleared = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt.getTime() < cutoffTime) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: AlertCondition, snapshot: Record<string, any>): boolean {
    const value = snapshot[condition.metric];
    if (value === undefined) return false;

    switch (condition.operator) {
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '>=':
        return value >= condition.value;
      case '<=':
        return value <= condition.value;
      case '==':
        return value === condition.value;
      case 'change_percent':
        return value <= ((condition.value as number) / 100) * value;
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Create an alert from a triggered rule
   */
  private createAlert(rule: AlertRule, snapshot: Record<string, any>): Alert {
    const alertId = `alert-${Date.now()}-${++this.alertIdCounter}`;

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      zoneId: snapshot.zoneId,
      severity: rule.defaultSeverity,
      title: rule.name,
      message: this.generateAlertMessage(rule, snapshot),
      context: snapshot,
      status: 'active',
      triggeredAt: new Date(),
      escalationLevel: this.severityToLevel(rule.defaultSeverity),
      channelsNotified: [],
      notificationsSentAt: [],
    };

    this.alerts.set(alertId, alert);
    this.emit('alert_triggered', alert);

    return alert;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, snapshot: Record<string, any>): string {
    switch (rule.id) {
      case 'demand_spike':
        return `Demand spike detected: ${Math.round((snapshot.demandGapPercent || 0) * 100)}% above predicted`;
      case 'capacity_shortage':
        return `Capacity shortage: demand exceeds capacity by ${Math.round((snapshot.utilizationGap || 0) * 100)}%`;
      case 'model_degradation':
        return `Model accuracy degraded to ${Math.round((snapshot.modelAccuracy || 0) * 100)}%`;
      case 'anomaly_cluster':
        return `Anomaly cluster detected: ${snapshot.anomalyCount30m || 0} anomalies in 30 minutes`;
      default:
        return rule.description || 'Alert triggered';
    }
  }

  /**
   * Notify alert through configured channels
   */
  private notifyAlert(alert: Alert, action: AlertAction): void {
    for (const channel of action.channels) {
      this.sendNotification(alert, channel);
      alert.channelsNotified.push(channel);
      alert.notificationsSentAt.push(new Date());
    }
  }

  /**
   * Send notification through specific channel
   */
  private sendNotification(alert: Alert, channel: AlertChannel): void {
    // In production, these would integrate with real services
    // For now, emit events that can be caught by handlers
    this.emit(`notify_${channel}`, {
      alert,
      timestamp: new Date(),
    });
  }

  /**
   * Convert severity to level for escalation
   */
  private severityToLevel(severity: AlertSeverity): number {
    switch (severity) {
      case 'warning':
        return 0;
      case 'critical':
        return 1;
      case 'emergency':
        return 2;
    }
  }
}
