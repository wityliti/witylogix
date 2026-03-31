/**
 * SLA Compliance Integration Tests
 * Tests SLA definition/evaluation, compliance reports, breach detection,
 * penalty calculation, escalation triggering, and edge cases
 * ~250 lines, 20+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fixtures from "../fixtures/courier-dispatch-fixtures";

// ─── Mock SLA Service ──────────────────────────────────────────────────────

interface DeliveryEvent {
  deliveryId: string;
  assignedAt: Date;
  completedAt: Date;
  courierRating: number;
  successful: boolean;
}

interface SLABreach {
  deliveryId: string;
  slaId: string;
  penaltyAmount: number;
  breachType: "time" | "quality";
  severity: "minor" | "major";
}

interface ComplianceReport {
  slaId: string;
  periodStart: Date;
  periodEnd: Date;
  totalDeliveries: number;
  compliantDeliveries: number;
  breachedDeliveries: number;
  complianceRate: number; // 0-100
  totalPenalties: number;
  breaches: SLABreach[];
}

interface EscalationAction {
  courierId: string;
  action: "warning" | "suspension" | "termination";
  reason: string;
  effectiveDate: Date;
}

class SLAService {
  private slas = new Map<string, fixtures.SLADefinition>();
  private deliveryEvents = new Map<string, DeliveryEvent>();
  private breaches = new Map<string, SLABreach>();
  private escalations = new Map<string, EscalationAction>();

  createSLA(sla: fixtures.SLADefinition): void {
    this.slas.set(sla.id, sla);
  }

  recordDelivery(event: DeliveryEvent): void {
    this.deliveryEvents.set(event.deliveryId, event);
  }

  // ─ SLA Evaluation ──────────────────────────────────────────────────────

  evaluateSLA(delivery: DeliveryEvent, sla: fixtures.SLADefinition): boolean {
    const timeTaken = delivery.completedAt.getTime() - delivery.assignedAt.getTime();
    const minutesTaken = timeTaken / (1000 * 60);

    if (minutesTaken > sla.targetTimeMinutes) {
      return false;
    }

    // If quality-based SLA, check courier rating
    if (sla.metadata?.qualityBased) {
      return delivery.courierRating >= 4.5;
    }

    return true;
  }

  // ─ Breach Detection ────────────────────────────────────────────────────

  detectBreach(delivery: DeliveryEvent, sla: fixtures.SLADefinition): SLABreach | null {
    const isMet = this.evaluateSLA(delivery, sla);

    if (isMet) {
      return null;
    }

    const timeTaken = delivery.completedAt.getTime() - delivery.assignedAt.getTime();
    const minutesTaken = timeTaken / (1000 * 60);

    let breachType: "time" | "quality" = "time";
    let severity: "minor" | "major" = minutesTaken - sla.targetTimeMinutes < 30 ? "minor" : "major";

    if (sla.metadata?.qualityBased && delivery.courierRating < 4.5) {
      breachType = "quality";
      severity = delivery.courierRating < 3.5 ? "major" : "minor";
    }

    const breach: SLABreach = {
      deliveryId: delivery.deliveryId,
      slaId: sla.id,
      penaltyAmount: sla.breachPenalty,
      breachType,
      severity,
    };

    this.breaches.set(delivery.deliveryId, breach);
    return breach;
  }

  // ─ Penalty Calculation ─────────────────────────────────────────────────

  calculatePenalty(delivery: DeliveryEvent, sla: fixtures.SLADefinition): number {
    const isMet = this.evaluateSLA(delivery, sla);

    if (isMet) {
      return 0;
    }

    const timeTaken = delivery.completedAt.getTime() - delivery.assignedAt.getTime();
    const minutesTaken = timeTaken / (1000 * 60);
    const minutesOver = minutesTaken - sla.targetTimeMinutes;

    // Graduated penalty: +5% per 30 minutes over
    const penaltyMultiplier = Math.ceil(minutesOver / 30) * 0.05;
    const adjustedPenalty = sla.breachPenalty * (1 + Math.min(penaltyMultiplier, 2)); // max 2x

    return Math.round(adjustedPenalty * 100) / 100;
  }

  // ─ Compliance Report Generation ────────────────────────────────────────

  generateComplianceReport(
    slaId: string,
    periodStart: Date,
    periodEnd: Date
  ): ComplianceReport {
    const sla = this.slas.get(slaId);
    if (!sla) throw new Error("SLA not found");

    const periodDeliveries = Array.from(this.deliveryEvents.values()).filter(
      (e) => e.assignedAt >= periodStart && e.assignedAt <= periodEnd
    );

    const breachedDeliveries: SLABreach[] = [];
    let totalPenalties = 0;

    for (const delivery of periodDeliveries) {
      const breach = this.detectBreach(delivery, sla);
      if (breach) {
        breachedDeliveries.push(breach);
        totalPenalties += breach.penaltyAmount;
      }
    }

    const compliantDeliveries = periodDeliveries.length - breachedDeliveries.length;
    const complianceRate =
      periodDeliveries.length > 0 ? (compliantDeliveries / periodDeliveries.length) * 100 : 100;

    return {
      slaId,
      periodStart,
      periodEnd,
      totalDeliveries: periodDeliveries.length,
      compliantDeliveries,
      breachedDeliveries: breachedDeliveries.length,
      complianceRate,
      totalPenalties,
      breaches: breachedDeliveries,
    };
  }

  // ─ Escalation Triggering ───────────────────────────────────────────────

  triggerEscalation(report: ComplianceReport, courierId: string): EscalationAction | null {
    let action: "warning" | "suspension" | "termination" | null = null;

    if (report.complianceRate < 50) {
      action = "termination";
    } else if (report.complianceRate < 70) {
      action = "suspension";
    } else if (report.complianceRate < 85) {
      action = "warning";
    }

    if (!action) {
      return null;
    }

    const escalation: EscalationAction = {
      courierId,
      action,
      reason: `SLA compliance rate: ${report.complianceRate.toFixed(1)}%`,
      effectiveDate: new Date(),
    };

    this.escalations.set(courierId, escalation);
    return escalation;
  }

  getEscalation(courierId: string): EscalationAction | undefined {
    return this.escalations.get(courierId);
  }

  getBreaches(slaId: string): SLABreach[] {
    return Array.from(this.breaches.values()).filter((b) => b.slaId === slaId);
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("SLA Compliance Integration Tests", () => {
  let service: SLAService;
  let sla: fixtures.SLADefinition;
  let courier: fixtures.CourierProfile;

  beforeEach(() => {
    service = new SLAService();
    courier = fixtures.createCourierProfile("onfleet");
    sla = fixtures.createSLADefinition({
      courierId: courier.id,
      targetTimeMinutes: 120,
      breachPenalty: 50,
    });

    service.createSLA(sla);
  });

  describe("SLA Definition and Storage", () => {
    it("should create and store SLA", () => {
      expect(sla.id).toBeDefined();
      expect(sla.targetTimeMinutes).toBe(120);
      expect(sla.breachPenalty).toBe(50);
    });

    it("should set start date", () => {
      expect(sla.startDate).toBeDefined();
      expect(sla.startDate <= new Date()).toBe(true);
    });

    it("should support optional end date", () => {
      const endedSLA = fixtures.createSLADefinition({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });

      expect(endedSLA.endDate).toBeDefined();
    });
  });

  describe("SLA Evaluation", () => {
    it("should mark compliant delivery", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 60 * 60 * 1000), // 60 minutes ago
        completedAt: new Date(), // just now, 60 minutes total
        courierRating: 4.8,
        successful: true,
      };

      const isMet = service.evaluateSLA(delivery, sla);
      expect(isMet).toBe(true);
    });

    it("should mark non-compliant delivery (time exceeded)", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 200 * 60 * 1000), // 200 minutes ago
        completedAt: new Date(), // just now, 200 minutes total (exceeds 120)
        courierRating: 4.8,
        successful: true,
      };

      const isMet = service.evaluateSLA(delivery, sla);
      expect(isMet).toBe(false);
    });

    it("should evaluate quality-based SLA", () => {
      const qualitySLA = fixtures.createSLADefinition({
        metadata: { qualityBased: true },
      });
      service.createSLA(qualitySLA);

      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.3,
        successful: true,
      };

      const isMet = service.evaluateSLA(delivery, qualitySLA);
      expect(isMet).toBe(false);
    });
  });

  describe("Breach Detection", () => {
    it("should detect time-based breach", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 200 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const breach = service.detectBreach(delivery, sla);

      expect(breach).toBeDefined();
      expect(breach?.breachType).toBe("time");
    });

    it("should not detect breach for compliant delivery", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const breach = service.detectBreach(delivery, sla);

      expect(breach).toBeNull();
    });

    it("should classify severity correctly", () => {
      // Minor breach (slightly over)
      const minorDelivery: DeliveryEvent = {
        deliveryId: `delivery_minor_${Date.now()}`,
        assignedAt: new Date(Date.now() - 130 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const minorBreach = service.detectBreach(minorDelivery, sla);
      expect(minorBreach?.severity).toBe("minor");

      // Major breach (significantly over)
      const majorDelivery: DeliveryEvent = {
        deliveryId: `delivery_major_${Date.now()}`,
        assignedAt: new Date(Date.now() - 250 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const majorBreach = service.detectBreach(majorDelivery, sla);
      expect(majorBreach?.severity).toBe("major");
    });
  });

  describe("Penalty Calculation", () => {
    it("should calculate zero penalty for compliant delivery", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const penalty = service.calculatePenalty(delivery, sla);
      expect(penalty).toBe(0);
    });

    it("should calculate graduated penalty for time exceeded", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 180 * 60 * 1000), // 60 minutes over
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const penalty = service.calculatePenalty(delivery, sla);
      expect(penalty).toBeGreaterThan(0);
      expect(penalty).toBeLessThanOrEqual(sla.breachPenalty * 3); // max 2x penalty
    });

    it("should cap maximum penalty", () => {
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(Date.now() - 600 * 60 * 1000), // 480 minutes over
        completedAt: new Date(),
        courierRating: 4.8,
        successful: true,
      };

      const penalty = service.calculatePenalty(delivery, sla);
      expect(penalty).toBeLessThanOrEqual(sla.breachPenalty * 3);
    });
  });

  describe("Compliance Report Generation", () => {
    it("should generate compliance report", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = now;

      const report = service.generateComplianceReport(sla.id, start, end);

      expect(report.slaId).toBe(sla.id);
      expect(report.periodStart).toEqual(start);
      expect(report.periodEnd).toEqual(end);
      expect(report.complianceRate).toBeGreaterThanOrEqual(0);
      expect(report.complianceRate).toBeLessThanOrEqual(100);
    });

    it("should calculate compliance rate correctly", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Add 10 compliant deliveries
      for (let i = 0; i < 10; i++) {
        const delivery: DeliveryEvent = {
          deliveryId: `delivery_ok_${i}`,
          assignedAt: start,
          completedAt: new Date(start.getTime() + 60 * 60 * 1000),
          courierRating: 4.8,
          successful: true,
        };
        service.recordDelivery(delivery);
      }

      // Add 5 breached deliveries
      for (let i = 0; i < 5; i++) {
        const delivery: DeliveryEvent = {
          deliveryId: `delivery_breach_${i}`,
          assignedAt: start,
          completedAt: new Date(start.getTime() + 200 * 60 * 1000),
          courierRating: 4.8,
          successful: true,
        };
        service.recordDelivery(delivery);
      }

      const report = service.generateComplianceReport(sla.id, start, now);

      expect(report.totalDeliveries).toBe(15);
      expect(report.compliantDeliveries).toBe(10);
      expect(report.breachedDeliveries).toBe(5);
      expect(Math.round(report.complianceRate)).toBe(67);
    });

    it("should track total penalties", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (let i = 0; i < 3; i++) {
        const delivery: DeliveryEvent = {
          deliveryId: `delivery_${i}`,
          assignedAt: start,
          completedAt: new Date(start.getTime() + 200 * 60 * 1000),
          courierRating: 4.8,
          successful: true,
        };
        service.recordDelivery(delivery);
      }

      const report = service.generateComplianceReport(sla.id, start, now);

      expect(report.totalPenalties).toBeGreaterThan(0);
      expect(report.breaches).toHaveLength(3);
    });
  });

  describe("Escalation Triggering", () => {
    it("should issue warning for poor compliance (85-70%)", () => {
      const report: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 100,
        compliantDeliveries: 80,
        breachedDeliveries: 20,
        complianceRate: 80,
        totalPenalties: 1000,
        breaches: [],
      };

      const escalation = service.triggerEscalation(report, courier.id);

      expect(escalation?.action).toBe("warning");
    });

    it("should suspend for poor compliance (70-50%)", () => {
      const report: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 100,
        compliantDeliveries: 65,
        breachedDeliveries: 35,
        complianceRate: 65,
        totalPenalties: 1750,
        breaches: [],
      };

      const escalation = service.triggerEscalation(report, courier.id);

      expect(escalation?.action).toBe("suspension");
    });

    it("should terminate for critical compliance (<50%)", () => {
      const report: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 100,
        compliantDeliveries: 40,
        breachedDeliveries: 60,
        complianceRate: 40,
        totalPenalties: 3000,
        breaches: [],
      };

      const escalation = service.triggerEscalation(report, courier.id);

      expect(escalation?.action).toBe("termination");
    });

    it("should not escalate for good compliance (>85%)", () => {
      const report: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 100,
        compliantDeliveries: 95,
        breachedDeliveries: 5,
        complianceRate: 95,
        totalPenalties: 250,
        breaches: [],
      };

      const escalation = service.triggerEscalation(report, courier.id);

      expect(escalation).toBeNull();
    });

    it("should store escalation action", () => {
      const report: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 100,
        compliantDeliveries: 60,
        breachedDeliveries: 40,
        complianceRate: 60,
        totalPenalties: 2000,
        breaches: [],
      };

      service.triggerEscalation(report, courier.id);
      const stored = service.getEscalation(courier.id);

      expect(stored).toBeDefined();
      expect(stored?.action).toBe("suspension");
    });
  });

  describe("Edge Cases", () => {
    it("should handle SLA with zero target time", () => {
      const zeroTimeSLA = fixtures.createSLADefinition({
        targetTimeMinutes: 0,
      });
      service.createSLA(zeroTimeSLA);

      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(),
        completedAt: new Date(Date.now() + 1000),
        courierRating: 4.8,
        successful: true,
      };

      const isMet = service.evaluateSLA(delivery, zeroTimeSLA);
      expect(isMet).toBe(false);
    });

    it("should handle SLA changed mid-period", () => {
      const oldSLA = fixtures.createSLADefinition({ targetTimeMinutes: 120 });
      const newSLA = fixtures.createSLADefinition({ targetTimeMinutes: 60 });

      service.createSLA(oldSLA);
      service.createSLA(newSLA);

      // New SLA should be stricter
      const delivery: DeliveryEvent = {
        deliveryId: `delivery_${Date.now()}`,
        assignedAt: new Date(),
        completedAt: new Date(Date.now() + 90 * 60 * 1000),
        courierRating: 4.8,
        successful: true,
      };

      const metOld = service.evaluateSLA(delivery, oldSLA);
      const metNew = service.evaluateSLA(delivery, newSLA);

      expect(metOld).toBe(true);
      expect(metNew).toBe(false);
    });

    it("should handle courier suspension scenario", () => {
      const suspendedReport: ComplianceReport = {
        slaId: sla.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        totalDeliveries: 50,
        compliantDeliveries: 30,
        breachedDeliveries: 20,
        complianceRate: 60,
        totalPenalties: 1000,
        breaches: [],
      };

      const escalation = service.triggerEscalation(suspendedReport, courier.id);
      expect(escalation?.action).toBe("suspension");
      expect(escalation?.reason).toContain("60");
    });
  });
});
