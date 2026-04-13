/**
 * SLA Enforcement Engine
 *
 * Manages Service Level Agreements with courier partners:
 * - Define SLA terms and metrics
 * - Evaluate compliance
 * - Track breaches and escalation
 * - Calculate penalties
 * - Generate compliance reports
 */

import type { Prisma } from "@prisma/client";

// ─── SLA Data Types ────────────────────────────────────────

/**
 * SLA configuration for a partner.
 */
export interface SLAConfig {
  /** Partner ID */
  partnerId: string;

  /** SLA name/version */
  name: string;

  /** Description */
  description?: string;

  /** Maximum pickup time in minutes */
  maxPickupTimeMinutes: number;

  /** Maximum delivery time in minutes */
  maxDeliveryTimeMinutes: number;

  /** Maximum damage rate (percentage) */
  maxDamageRate: number;

  /** Minimum customer rating (1-5 scale) */
  minRating: number;

  /** Response time target in minutes */
  responseTimeTargetMinutes: number;

  /** On-time delivery target (percentage) */
  onTimeTargetPercent: number;

  /** Penalty per SLA breach */
  penalties: {
    latePickupPenalty: number; // USD per minute late
    lateDeliveryPenalty: number; // USD per minute late
    damagePenalty: number; // USD per incident
    lowRatingPenalty: number; // USD per complaint
  };

  /** Escalation rules */
  escalation: {
    warningThreshold: number; // Number of breaches before warning
    reviewThreshold: number; // Number of breaches before review
    suspensionThreshold: number; // Number of breaches before suspension
  };

  /** Effective from date */
  effectiveFrom: Date;

  /** Expires on date */
  expiresOn?: Date;

  /** SLA status */
  status: "draft" | "active" | "inactive" | "archived";
}

/**
 * Delivery compliance check result.
 */
export interface DeliveryCompliance {
  /** Delivery ID */
  deliveryId: string;

  /** Partner ID */
  partnerId: string;

  /** Overall compliance status */
  compliant: boolean;

  /** Metrics compliance */
  metrics: {
    pickupTime: {
      compliant: boolean;
      targetMinutes: number;
      actualMinutes?: number;
      variance?: number;
    };
    deliveryTime: {
      compliant: boolean;
      targetMinutes: number;
      actualMinutes?: number;
      variance?: number;
    };
    noticedDamage: {
      compliant: boolean;
      maxRate: number;
      actualDamaged: boolean;
    };
    customerRating: {
      compliant: boolean;
      minRating: number;
      actualRating?: number;
    };
  };

  /** Breaches detected */
  breaches: Array<{
    metric: string;
    description: string;
    severity: "warning" | "critical";
  }>;

  /** Penalty calculated */
  penaltyAmount: number;

  /** Timestamp */
  evaluatedAt: Date;
}

/**
 * Compliance report for a period.
 */
export interface ComplianceReport {
  /** Partner ID */
  partnerId: string;

  /** Partner name */
  partnerName: string;

  /** Period analyzed */
  period: {
    start: Date;
    end: Date;
  };

  /** Total deliveries */
  totalDeliveries: number;

  /** Compliance metrics */
  metrics: {
    pickupTimeCompliance: number; // Percentage
    deliveryTimeCompliance: number; // Percentage
    damageCompliance: number; // Percentage
    ratingCompliance: number; // Percentage
    overallCompliance: number; // Percentage
  };

  /** Breach summary */
  breaches: {
    totalBreaches: number;
    byType: Record<string, number>;
    severity: {
      warnings: number;
      critical: number;
    };
  };

  /** Financial impact */
  financialImpact: {
    totalPenalties: number;
    averagePenaltyPerDelivery: number;
    costAvoidedByCompliance: number;
  };

  /** Escalation status */
  escalationStatus: "none" | "warning" | "under_review" | "suspended";

  /** Next escalation trigger */
  nextEscalation?: {
    threshold: number;
    currentBreaches: number;
    breachesUntilEscalation: number;
  };

  /** Recommendations */
  recommendations: string[];
}

/**
 * Breach incident record.
 */
export interface BreachIncident {
  /** Incident ID */
  id: string;

  /** Delivery ID */
  deliveryId: string;

  /** Partner ID */
  partnerId: string;

  /** Breach type */
  type: "late_pickup" | "late_delivery" | "damage" | "low_rating";

  /** Description */
  description: string;

  /** Severity level */
  severity: "warning" | "critical";

  /** Penalty amount */
  penaltyAmount: number;

  /** Whether reported to partner */
  reportedToPartner: boolean;

  /** Resolution status */
  status: "open" | "acknowledged" | "disputed" | "resolved";

  /** Notes */
  notes?: string;

  /** Recorded at */
  recordedAt: Date;

  /** Resolved at */
  resolvedAt?: Date;
}

/**
 * SLA breach escalation event.
 */
export interface EscalationEvent {
  /** Event ID */
  id: string;

  /** Partner ID */
  partnerId: string;

  /** Escalation level */
  level: "warning" | "review" | "suspension";

  /** Number of breaches that triggered escalation */
  breachCount: number;

  /** Previous escalation level */
  previousLevel?: "warning" | "review";

  /** Description */
  description: string;

  /** Action taken */
  action?: string;

  /** Escalation triggered at */
  triggeredAt: Date;

  /** Escalation resolved at */
  resolvedAt?: Date;

  /** Resolution notes */
  resolutionNotes?: string;
}

// ─── SLA Enforcement Service ────────────────────────────────

/**
 * SLA enforcement engine.
 */
export class SLAEnforcer {
  private slaConfigs: Map<string, SLAConfig> = new Map();
  private breachHistory: BreachIncident[] = [];
  private escalations: EscalationEvent[] = [];

  /**
   * Define or update SLA for a partner.
   *
   * @param config SLA configuration
   */
  defineSLA(config: SLAConfig): void {
    this.slaConfigs.set(config.partnerId, config);
  }

  /**
   * Get SLA configuration for a partner.
   *
   * @param partnerId Partner ID
   * @returns SLA config or undefined
   */
  getSLA(partnerId: string): SLAConfig | undefined {
    return this.slaConfigs.get(partnerId);
  }

  /**
   * Evaluate a delivery against SLA.
   *
   * @param delivery Delivery data
   * @param slaConfig SLA configuration
   * @returns Compliance result
   */
  evaluateCompliance(
    deliveryId: string,
    partnerId: string,
    deliveryData: {
      pickupTime?: number; // Minutes from creation
      deliveryTime?: number; // Minutes from pickup
      damageClaimed?: boolean;
      customerRating?: number;
    },
  ): DeliveryCompliance {
    const slaConfig = this.getSLA(partnerId);

    if (!slaConfig) {
      return {
        deliveryId,
        partnerId,
        compliant: true,
        metrics: {
          pickupTime: { compliant: true, targetMinutes: 0 },
          deliveryTime: { compliant: true, targetMinutes: 0 },
          noticedDamage: { compliant: true, maxRate: 100, actualDamaged: false },
          customerRating: { compliant: true, minRating: 0 },
        },
        breaches: [],
        penaltyAmount: 0,
        evaluatedAt: new Date(),
      };
    }

    const breaches: DeliveryCompliance["breaches"] = [];
    let penaltyAmount = 0;
    let compliant = true;

    // Check pickup time
    const pickupCompliant = !deliveryData.pickupTime || deliveryData.pickupTime <= slaConfig.maxPickupTimeMinutes;
    if (!pickupCompliant) {
      compliant = false;
      const variance = (deliveryData.pickupTime || 0) - slaConfig.maxPickupTimeMinutes;
      penaltyAmount += variance * slaConfig.penalties.latePickupPenalty;
      breaches.push({
        metric: "pickup_time",
        description: `Pickup took ${deliveryData.pickupTime} minutes (max allowed: ${slaConfig.maxPickupTimeMinutes})`,
        severity: variance > 30 ? "critical" : "warning",
      });
    }

    // Check delivery time
    const deliveryCompliant = !deliveryData.deliveryTime || deliveryData.deliveryTime <= slaConfig.maxDeliveryTimeMinutes;
    if (!deliveryCompliant) {
      compliant = false;
      const variance = (deliveryData.deliveryTime || 0) - slaConfig.maxDeliveryTimeMinutes;
      penaltyAmount += variance * slaConfig.penalties.lateDeliveryPenalty;
      breaches.push({
        metric: "delivery_time",
        description: `Delivery took ${deliveryData.deliveryTime} minutes (max allowed: ${slaConfig.maxDeliveryTimeMinutes})`,
        severity: variance > 60 ? "critical" : "warning",
      });
    }

    // Check damage
    const damageCompliant = !deliveryData.damageClaimed;
    if (!damageCompliant) {
      compliant = false;
      penaltyAmount += slaConfig.penalties.damagePenalty;
      breaches.push({
        metric: "damage",
        description: "Delivery arrived damaged",
        severity: "critical",
      });
    }

    // Check rating
    const ratingCompliant = !deliveryData.customerRating || deliveryData.customerRating >= slaConfig.minRating;
    if (!ratingCompliant) {
      compliant = false;
      penaltyAmount += slaConfig.penalties.lowRatingPenalty;
      breaches.push({
        metric: "rating",
        description: `Customer rating ${deliveryData.customerRating} below minimum ${slaConfig.minRating}`,
        severity: "warning",
      });
    }

    // Record breaches
    if (breaches.length > 0) {
      for (const breach of breaches) {
        const incident: BreachIncident = {
          id: `incident-${Date.now()}-${Math.random()}`,
          deliveryId,
          partnerId,
          type: breach.metric as BreachIncident["type"],
          description: breach.description,
          severity: breach.severity,
          penaltyAmount: 0, // Allocated proportionally
          reportedToPartner: false,
          status: "open",
          recordedAt: new Date(),
        };
        this.breachHistory.push(incident);
      }
    }

    // Check escalation
    this.checkAndEscalate(partnerId);

    return {
      deliveryId,
      partnerId,
      compliant,
      metrics: {
        pickupTime: {
          compliant: pickupCompliant,
          targetMinutes: slaConfig.maxPickupTimeMinutes,
          actualMinutes: deliveryData.pickupTime,
          variance: deliveryData.pickupTime ? deliveryData.pickupTime - slaConfig.maxPickupTimeMinutes : 0,
        },
        deliveryTime: {
          compliant: deliveryCompliant,
          targetMinutes: slaConfig.maxDeliveryTimeMinutes,
          actualMinutes: deliveryData.deliveryTime,
          variance: deliveryData.deliveryTime ? deliveryData.deliveryTime - slaConfig.maxDeliveryTimeMinutes : 0,
        },
        noticedDamage: {
          compliant: damageCompliant,
          maxRate: slaConfig.maxDamageRate,
          actualDamaged: deliveryData.damageClaimed || false,
        },
        customerRating: {
          compliant: ratingCompliant,
          minRating: slaConfig.minRating,
          actualRating: deliveryData.customerRating,
        },
      },
      breaches,
      penaltyAmount: Math.round(penaltyAmount * 100) / 100,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Get compliance report for a period.
   *
   * @param partnerId Partner ID
   * @param periodDays Number of days to look back
   * @returns Compliance report
   */
  getComplianceReport(partnerId: string, periodDays: number = 30): ComplianceReport {
    const slaConfig = this.getSLA(partnerId);
    if (!slaConfig) {
      throw new Error(`No SLA configured for partner ${partnerId}`);
    }

    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const relevantBreaches = this.breachHistory.filter((b) => b.partnerId === partnerId && b.recordedAt > cutoff);

    // Count breach types
    const breachByType: Record<string, number> = {};
    let criticalCount = 0;
    let warningCount = 0;

    for (const breach of relevantBreaches) {
      breachByType[breach.type] = (breachByType[breach.type] || 0) + 1;
      if (breach.severity === "critical") criticalCount++;
      else warningCount++;
    }

    // Get recent escalations
    const recentEscalations = this.escalations.filter((e) => e.partnerId === partnerId && e.triggeredAt > cutoff);

    let escalationStatus: ComplianceReport["escalationStatus"] = "none";
    if (recentEscalations.length > 0) {
      const latest = recentEscalations[recentEscalations.length - 1];
      if (!latest.resolvedAt) {
        escalationStatus = latest.level === "warning" ? "warning" : latest.level === "review" ? "under_review" : "suspended";
      }
    }

    const totalPenalties = relevantBreaches.reduce((sum, b) => sum + b.penaltyAmount, 0);
    const estimatedDeliveries = Math.max(1, relevantBreaches.length * 10); // Rough estimate

    return {
      partnerId,
      partnerName: "Unknown",
      period: {
        start: cutoff,
        end: new Date(),
      },
      totalDeliveries: estimatedDeliveries,
      metrics: {
        pickupTimeCompliance: 100 - (((breachByType["late_pickup"] || 0) / estimatedDeliveries) * 100),
        deliveryTimeCompliance: 100 - (((breachByType["late_delivery"] || 0) / estimatedDeliveries) * 100),
        damageCompliance: 100 - (((breachByType["damage"] || 0) / estimatedDeliveries) * 100),
        ratingCompliance: 100 - (((breachByType["low_rating"] || 0) / estimatedDeliveries) * 100),
        overallCompliance: 100 - ((relevantBreaches.length / estimatedDeliveries) * 100),
      },
      breaches: {
        totalBreaches: relevantBreaches.length,
        byType: breachByType,
        severity: {
          warnings: warningCount,
          critical: criticalCount,
        },
      },
      financialImpact: {
        totalPenalties: Math.round(totalPenalties * 100) / 100,
        averagePenaltyPerDelivery: Math.round((totalPenalties / estimatedDeliveries) * 100) / 100,
        costAvoidedByCompliance: 0,
      },
      escalationStatus,
      nextEscalation: this.getNextEscalationThreshold(partnerId, slaConfig, relevantBreaches.length),
      recommendations: this.generateRecommendations(partnerId, slaConfig, relevantBreaches.length, escalationStatus),
    };
  }

  /**
   * Check and trigger escalation if needed.
   *
   * @param partnerId Partner ID
   */
  private checkAndEscalate(partnerId: string): void {
    const slaConfig = this.getSLA(partnerId);
    if (!slaConfig) return;

    // Count recent breaches (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentBreaches = this.breachHistory.filter((b) => b.partnerId === partnerId && b.recordedAt > thirtyDaysAgo);

    const breachCount = recentBreaches.length;
    const escalation = slaConfig.escalation;

    // Check if new escalation needed
    const lastEscalation = this.escalations
      .filter((e) => e.partnerId === partnerId)
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())[0];

    let currentLevel = lastEscalation ? lastEscalation.level : null;

    // Determine if escalation threshold exceeded
    let newLevel: EscalationEvent["level"] | null = null;

    if (breachCount >= escalation.suspensionThreshold && currentLevel !== "suspension") {
      newLevel = "suspension";
    } else if (breachCount >= escalation.reviewThreshold && (!currentLevel || currentLevel === "warning")) {
      newLevel = "review";
    } else if (breachCount >= escalation.warningThreshold && !currentLevel) {
      newLevel = "warning";
    }

    if (newLevel) {
      const event: EscalationEvent = {
        id: `escalation-${Date.now()}-${Math.random()}`,
        partnerId,
        level: newLevel,
        breachCount,
        previousLevel: currentLevel as EscalationEvent["previousLevel"],
        description: `Escalated to ${newLevel} after ${breachCount} SLA breaches`,
        triggeredAt: new Date(),
      };
      this.escalations.push(event);
    }
  }

  /**
   * Get next escalation threshold.
   */
  private getNextEscalationThreshold(partnerId: string, slaConfig: SLAConfig, currentBreaches: number) {
    const escalation = slaConfig.escalation;

    if (currentBreaches < escalation.warningThreshold) {
      return {
        threshold: escalation.warningThreshold,
        currentBreaches,
        breachesUntilEscalation: escalation.warningThreshold - currentBreaches,
      };
    } else if (currentBreaches < escalation.reviewThreshold) {
      return {
        threshold: escalation.reviewThreshold,
        currentBreaches,
        breachesUntilEscalation: escalation.reviewThreshold - currentBreaches,
      };
    } else if (currentBreaches < escalation.suspensionThreshold) {
      return {
        threshold: escalation.suspensionThreshold,
        currentBreaches,
        breachesUntilEscalation: escalation.suspensionThreshold - currentBreaches,
      };
    }

    return undefined;
  }

  /**
   * Generate recommendations based on compliance.
   */
  private generateRecommendations(
    partnerId: string,
    slaConfig: SLAConfig,
    breachCount: number,
    escalationStatus: ComplianceReport["escalationStatus"],
  ): string[] {
    const recommendations: string[] = [];

    if (escalationStatus === "warning") {
      recommendations.push("Partner is under warning status. Address compliance issues immediately.");
    } else if (escalationStatus === "under_review") {
      recommendations.push("Partner is under review. Consider contract renegotiation or replacement.");
    } else if (escalationStatus === "suspended") {
      recommendations.push("Partner is suspended. Route deliveries to alternative couriers.");
    }

    if (breachCount > 5) {
      recommendations.push("High breach rate detected. Review partner performance and service areas.");
    }

    recommendations.push("Monitor SLA metrics closely over next 30 days.");

    return recommendations;
  }

  /**
   * Resolve escalation event.
   *
   * @param escalationId Escalation event ID
   * @param resolutionNotes Notes
   */
  resolveEscalation(escalationId: string, resolutionNotes: string): void {
    const escalation = this.escalations.find((e) => e.id === escalationId);
    if (escalation) {
      escalation.resolvedAt = new Date();
      escalation.resolutionNotes = resolutionNotes;
    }
  }

  /**
   * Get escalation history for a partner.
   *
   * @param partnerId Partner ID
   * @returns Array of escalation events
   */
  getEscalationHistory(partnerId: string): EscalationEvent[] {
    return this.escalations.filter((e) => e.partnerId === partnerId).sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }
}

/**
 * Singleton instance of SLA enforcer.
 */
export const slaEnforcer = new SLAEnforcer();
