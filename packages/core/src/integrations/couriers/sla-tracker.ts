/**
 * SLA Tracker — Service Level Agreement Enforcement
 *
 * Tracks, monitors, and enforces SLA compliance for courier partners.
 * Features:
 * - Define SLAs per partner with pickup/delivery time expectations
 * - Track compliance percentage over time periods
 * - Auto-escalate violations based on severity
 * - Generate SLA compliance reports
 */

import { prisma } from "@witylogix/db";
import type { Prisma } from "@witylogix/db";

// ─── TYPES ──────────────────────────────────────────────────────────────

/**
 * SLA configuration for a partner
 */
export interface SLAConfig {
  id: string;
  partnerId: string;
  name: string;
  description?: string;

  // Timing requirements
  pickupTimeMinutes: number; // Expected time from order to pickup
  deliveryTimeMinutes: number; // Expected time from pickup to delivery
  pickupTimePercentile: number; // e.g., 95 = 95% should meet pickup time

  // Quality thresholds
  damageThresholdPercent: number; // Max acceptable damage rate (e.g., 2%)
  cancelledThresholdPercent: number; // Max acceptable cancellation rate
  minCustomerRating: number; // Minimum average customer rating (1-5)

  // SLA windows (UTC offsets for timezone-aware SLAs)
  applicableDaysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  startHourUTC: number; // Hour when SLA starts
  endHourUTC: number; // Hour when SLA ends

  // Escalation rules
  escalationThresholdPercent: number; // e.g., 80% compliance = escalate
  escalationChannels: ("email" | "slack" | "sms")[];
  escalationContacts: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * SLA violation record
 */
export interface SLAViolation {
  id: string;
  slaConfigId: string;
  deliveryId?: string;
  partnerId: string;
  violationType: "late_pickup" | "late_delivery" | "damage" | "cancellation" | "rating";
  violationDetails: {
    expectedTime?: Date;
    actualTime?: Date;
    expectedValue?: number;
    actualValue?: number;
  };
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  escalated: boolean;
  escalatedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SLA compliance metrics
 */
export interface SLAComplianceMetrics {
  partnerId: string;
  period: string; // "30d", "60d", "90d"
  totalDeliveries: number;
  onTimePickups: number;
  onTimeDeliveries: number;
  damageCount: number;
  cancellationCount: number;
  averageCustomerRating: number;
  overallCompliancePercent: number;
  violations: SLAViolation[];
  riskLevel: "green" | "yellow" | "red";
}

/**
 * SLA report entry
 */
export interface SLAReport {
  partnerId: string;
  slaConfigId: string;
  period: string;
  complianceMetrics: SLAComplianceMetrics;
  weeklyBreakdown: Record<string, SLAComplianceMetrics>;
  recentViolations: SLAViolation[];
  summary: {
    compliant: boolean;
    mainIssues: string[];
    recommendations: string[];
  };
  generatedAt: Date;
}

// ─── SLA DEFINITION ──────────────────────────────────────────────────────

/**
 * Define or update SLA for a partner
 */
export async function defineSLA(
  partnerId: string,
  config: Omit<SLAConfig, "id" | "createdAt" | "updatedAt">
): Promise<SLAConfig> {
  // In a real system, this would store in a partner_sla_configs table
  const slaConfig: SLAConfig = {
    id: `sla_${Date.now()}`,
    partnerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...config,
  };

  // Validate configuration
  validateSLAConfig(slaConfig);

  console.log(`[SLA] Defined SLA for partner ${partnerId}:`, {
    pickupTimeMinutes: config.pickupTimeMinutes,
    deliveryTimeMinutes: config.deliveryTimeMinutes,
    damageThreshold: config.damageThresholdPercent,
  });

  return slaConfig;
}

/**
 * Update existing SLA configuration
 */
export async function updateSLA(
  slaConfigId: string,
  updates: Partial<Omit<SLAConfig, "id" | "partnerId" | "createdAt">>
): Promise<SLAConfig> {
  // Get current config
  const config = await getSLAConfig(slaConfigId);
  if (!config) {
    throw new Error(`SLA config not found: ${slaConfigId}`);
  }

  const updated = {
    ...config,
    ...updates,
    updatedAt: new Date(),
  };

  validateSLAConfig(updated);

  console.log(`[SLA] Updated SLA ${slaConfigId}`);

  return updated;
}

/**
 * Get SLA configuration
 */
async function getSLAConfig(slaConfigId: string): Promise<SLAConfig | null> {
  // Would fetch from database
  return null;
}

/**
 * Validate SLA configuration
 */
function validateSLAConfig(config: SLAConfig): void {
  if (config.pickupTimeMinutes <= 0) {
    throw new Error("pickupTimeMinutes must be positive");
  }
  if (config.deliveryTimeMinutes <= 0) {
    throw new Error("deliveryTimeMinutes must be positive");
  }
  if (config.damageThresholdPercent < 0 || config.damageThresholdPercent > 100) {
    throw new Error("damageThresholdPercent must be between 0 and 100");
  }
  if (config.minCustomerRating < 1 || config.minCustomerRating > 5) {
    throw new Error("minCustomerRating must be between 1 and 5");
  }
  if (config.escalationThresholdPercent < 0 || config.escalationThresholdPercent > 100) {
    throw new Error("escalationThresholdPercent must be between 0 and 100");
  }
}

// ─── SLA TRACKING ────────────────────────────────────────────────────────

/**
 * Track SLA compliance for a delivery
 * Check against defined SLA and create violation records if needed
 */
export async function trackSLACompliance(
  deliveryId: string,
  partnerId: string,
  slaConfigId: string
): Promise<{
  compliant: boolean;
  violations: SLAViolation[];
}> {
  const delivery = await (prisma.courierDelivery as any).findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return { compliant: true, violations: [] };
  }

  const slaConfig = await getSLAConfig(slaConfigId);
  if (!slaConfig || !slaConfig.isActive) {
    return { compliant: true, violations: [] };
  }

  const violations: SLAViolation[] = [];

  // Check pickup time SLA
  // (This would check against actual pickup timestamp from courier)
  const violationsCheckPickup = checkPickupTimeSLA(
    delivery,
    slaConfig
  );
  violations.push(...violationsCheckPickup);

  // Check delivery time SLA
  const violationsCheckDelivery = checkDeliveryTimeSLA(
    delivery,
    slaConfig
  );
  violations.push(...violationsCheckDelivery);

  // Check damage SLA
  const violationsCheckDamage = checkDamageSLA(
    delivery,
    slaConfig
  );
  if (violationsCheckDamage) {
    violations.push(violationsCheckDamage);
  }

  // Store violations in database
  for (const violation of violations) {
    await storeViolation(violation);
  }

  const compliant = violations.length === 0;

  // Check if escalation is needed
  if (!compliant) {
    const needsEscalation = violations.some(
      (v) => v.severity === "high" || v.severity === "critical"
    );
    if (needsEscalation) {
      await escalateViolations(violations, slaConfig);
    }
  }

  return { compliant, violations };
}

/**
 * Check pickup time SLA
 */
function checkPickupTimeSLA(
  delivery: any,
  slaConfig: SLAConfig
): SLAViolation[] {
  const violations: SLAViolation[] = [];

  // In real system, we'd have a pickup_timestamp from courier webhook
  // For now, this is a placeholder

  return violations;
}

/**
 * Check delivery time SLA
 */
function checkDeliveryTimeSLA(
  delivery: any,
  slaConfig: SLAConfig
): SLAViolation[] {
  const violations: SLAViolation[] = [];

  if (!delivery.deliveredAt || !delivery.quote) {
    return violations;
  }

  const quote = typeof delivery.quote === "string" ? JSON.parse(delivery.quote) : delivery.quote;
  const estimatedMinutes = quote.estimatedMinutes || slaConfig.deliveryTimeMinutes;
  const expectedDeliveryTime = new Date(
    new Date(delivery.createdAt).getTime() + estimatedMinutes * 60000
  );

  const actualDeliveryTime = new Date(delivery.deliveredAt);

  if (actualDeliveryTime > expectedDeliveryTime) {
    const lateMinutes = Math.round(
      (actualDeliveryTime.getTime() - expectedDeliveryTime.getTime()) / 60000
    );

    let severity: "low" | "medium" | "high" | "critical" = "low";
    if (lateMinutes > 60) severity = "medium";
    if (lateMinutes > 180) severity = "high";
    if (lateMinutes > 360) severity = "critical";

    violations.push({
      id: `viol_${Date.now()}`,
      slaConfigId: slaConfig.id,
      deliveryId: delivery.id,
      partnerId: slaConfig.partnerId,
      violationType: "late_delivery",
      violationDetails: {
        expectedTime: expectedDeliveryTime,
        actualTime: actualDeliveryTime,
      },
      severity,
      message: `Delivery was ${lateMinutes} minutes late (expected ${estimatedMinutes} minutes)`,
      escalated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return violations;
}

/**
 * Check damage SLA
 */
function checkDamageSLA(
  delivery: any,
  slaConfig: SLAConfig
): SLAViolation | null {
  // Check if delivery metadata indicates damage
  const metadata = typeof delivery.metadata === "string" ? JSON.parse(delivery.metadata) : delivery.metadata;

  if (metadata?.damaged) {
    return {
      id: `viol_${Date.now()}`,
      slaConfigId: slaConfig.id,
      deliveryId: delivery.id,
      partnerId: slaConfig.partnerId,
      violationType: "damage",
      violationDetails: {
        actualValue: 1, // One damage report
      },
      severity: "high",
      message: "Delivery reported as damaged",
      escalated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return null;
}

/**
 * Store violation in database
 */
async function storeViolation(violation: SLAViolation): Promise<void> {
  // Would insert into sla_violations table
  console.log(`[SLA] Violation recorded for delivery ${violation.deliveryId}: ${violation.violationType}`);
}

// ─── SLA REPORTING ──────────────────────────────────────────────────────

/**
 * Get SLA compliance report for a partner
 */
export async function getSLAReport(
  partnerId: string,
  period: "7d" | "30d" | "60d" | "90d" = "30d",
  slaConfigId?: string
): Promise<SLAReport> {
  const days = parsePeriod(period);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get deliveries in period
  const deliveries = await (prisma.courierDelivery as any).findMany({
    where: {
      partnerId,
      createdAt: { gte: since },
    },
  });

  // Calculate metrics
  const metrics = calculateComplianceMetrics(
    deliveries,
    partnerId,
    period,
    slaConfigId
  );

  // Get violations
  const violations = await getViolationsForPeriod(
    partnerId,
    since,
    slaConfigId
  );

  // Weekly breakdown
  const weeklyBreakdown = calculateWeeklyBreakdown(
    deliveries,
    partnerId,
    slaConfigId
  );

  // Generate summary
  const summary = generateSummary(metrics, violations);

  return {
    partnerId,
    slaConfigId: slaConfigId || "all",
    period,
    complianceMetrics: metrics,
    weeklyBreakdown,
    recentViolations: violations.slice(0, 10),
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Calculate SLA compliance metrics
 */
function calculateComplianceMetrics(
  deliveries: any[],
  partnerId: string,
  period: string,
  slaConfigId?: string
): SLAComplianceMetrics {
  let onTimeDeliveries = 0;
  let damageCount = 0;
  let cancellationCount = 0;
  let ratings: number[] = [];

  for (const delivery of deliveries) {
    if (delivery.status === "DELIVERED" && delivery.quote && delivery.deliveredAt) {
      const quote = typeof delivery.quote === "string" ? JSON.parse(delivery.quote) : delivery.quote;
      const estimatedMinutes = quote.estimatedMinutes || 0;
      const expectedTime = new Date(
        new Date(delivery.createdAt).getTime() + estimatedMinutes * 60000
      );
      if (new Date(delivery.deliveredAt) <= expectedTime) {
        onTimeDeliveries++;
      }
    }

    if (delivery.status === "CANCELLED") {
      cancellationCount++;
    }

    const metadata = typeof delivery.metadata === "string" ? JSON.parse(delivery.metadata) : delivery.metadata;
    if (metadata?.damaged) {
      damageCount++;
    }

    if (metadata?.customerRating) {
      ratings.push(metadata.customerRating);
    }
  }

  const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 5;
  const overallCompliance = deliveries.length > 0
    ? (onTimeDeliveries / deliveries.length) * 100
    : 100;

  const riskLevel = overallCompliance >= 90 ? "green" : overallCompliance >= 75 ? "yellow" : "red";

  return {
    partnerId,
    period,
    totalDeliveries: deliveries.length,
    onTimePickups: 0, // Would be calculated from pickup tracking
    onTimeDeliveries,
    damageCount,
    cancellationCount,
    averageCustomerRating: averageRating,
    overallCompliancePercent: Math.round(overallCompliance * 10) / 10,
    violations: [],
    riskLevel,
  };
}

/**
 * Get violations for period
 */
async function getViolationsForPeriod(
  partnerId: string,
  since: Date,
  slaConfigId?: string
): Promise<SLAViolation[]> {
  // Would query from sla_violations table
  return [];
}

/**
 * Calculate weekly breakdown
 */
function calculateWeeklyBreakdown(
  deliveries: any[],
  partnerId: string,
  slaConfigId?: string
): Record<string, SLAComplianceMetrics> {
  const breakdown: Record<string, SLAComplianceMetrics> = {};

  // Group by week and calculate metrics for each
  const byWeek: Record<string, any[]> = {};

  for (const delivery of deliveries) {
    const weekStart = getWeekStart(new Date(delivery.createdAt));
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = [];
    }
    byWeek[weekKey].push(delivery);
  }

  for (const [weekKey, weekDeliveries] of Object.entries(byWeek)) {
    breakdown[weekKey] = calculateComplianceMetrics(
      weekDeliveries,
      partnerId,
      "7d",
      slaConfigId
    );
  }

  return breakdown;
}

/**
 * Generate summary from metrics
 */
function generateSummary(
  metrics: SLAComplianceMetrics,
  violations: SLAViolation[]
): SLAReport["summary"] {
  const mainIssues: string[] = [];
  const recommendations: string[] = [];

  if (metrics.overallCompliancePercent < 75) {
    mainIssues.push("Critical: On-time delivery rate below 75%");
    recommendations.push("Escalate to partner management for urgent improvement plan");
  } else if (metrics.overallCompliancePercent < 90) {
    mainIssues.push("Moderate: On-time delivery rate below 90%");
    recommendations.push("Schedule partnership review meeting");
  }

  if (metrics.damageCount > metrics.totalDeliveries * 0.03) {
    mainIssues.push("High damage rate");
    recommendations.push("Request damage investigation and improvement plan");
  }

  if (metrics.averageCustomerRating < 4) {
    mainIssues.push("Low customer satisfaction");
    recommendations.push("Investigate recent customer complaints");
  }

  return {
    compliant: metrics.riskLevel === "green",
    mainIssues,
    recommendations,
  };
}

// ─── VIOLATION ESCALATION ───────────────────────────────────────────────

/**
 * Escalate violations to support team
 */
async function escalateViolations(
  violations: SLAViolation[],
  slaConfig: SLAConfig
): Promise<void> {
  for (const violation of violations) {
    console.log(
      `[SLA] Escalating violation (${violation.severity}): ${violation.message}`
    );

    // Update violation as escalated
    violation.escalated = true;
    violation.escalatedAt = new Date();

    // Send notifications
    for (const channel of slaConfig.escalationChannels) {
      await sendEscalationNotification(
        channel,
        slaConfig.escalationContacts,
        violation
      );
    }
  }
}

/**
 * Send escalation notification
 */
async function sendEscalationNotification(
  channel: "email" | "slack" | "sms",
  contacts: string[],
  violation: SLAViolation
): Promise<void> {
  const message = `[${violation.severity.toUpperCase()}] SLA Violation: ${violation.message}`;

  console.log(`[SLA] Escalation via ${channel}: ${message} to ${contacts.join(", ")}`);

  // Would integrate with notification service
  // - Email: sendEmail()
  // - Slack: postToSlack()
  // - SMS: sendSMS()
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────

/**
 * Parse period string to days
 */
function parsePeriod(period: "7d" | "30d" | "60d" | "90d"): number {
  const match = period.match(/(\d+)d/);
  return match ? parseInt(match[1]) : 30;
}

/**
 * Get start of week for a date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

/**
 * Get SLA compliance trend
 */
export async function getSLATrend(
  partnerId: string,
  slaConfigId: string,
  weeks: number = 12
): Promise<Array<{ week: string; compliance: number }>> {
  const trend: Array<{ week: string; compliance: number }> = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekDate = new Date();
    weekDate.setDate(weekDate.getDate() - i * 7);
    const weekStart = getWeekStart(weekDate);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const deliveries = await (prisma.courierDelivery as any).findMany({
      where: {
        partnerId,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    });

    const metrics = calculateComplianceMetrics(deliveries, partnerId, "7d", slaConfigId);

    trend.push({
      week: weekStart.toISOString().split("T")[0],
      compliance: metrics.overallCompliancePercent,
    });
  }

  return trend;
}
