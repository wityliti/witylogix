/**
 * Freight Audit Engine Unit Tests
 * Tests for invoice auditing, duplicate detection, dispute management, and reporting
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InvoiceAuditor,
  AccessorialValidator,
  DuplicateDetector,
  DisputeManager,
  AuditReporter,
  type InvoiceAuditorConfig,
  type DuplicateDetectorConfig,
} from "../freight-audit-engine";
import {
  FreightInvoice,
  InvoiceLineItem,
  AccessorialCharge,
  AccessorialType,
  DisputeStatus,
  AuditStatus,
} from "../freight-types";

// ────────────────────────────────────────────────────────────────────────────
// INVOICE AUDITOR TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("InvoiceAuditor", () => {
  let auditor: InvoiceAuditor;

  beforeEach(() => {
    auditor = new InvoiceAuditor({
      tolerancePercent: 3,
      minOverchargeThreshold: 50,
    });
  });

  describe("auditLineItems", () => {
    it("should approve items within tolerance", () => {
      const lineItems: InvoiceLineItem[] = [
        {
          lineId: "line-1",
          loadNumber: "LOAD-001",
          origin: "Chicago",
          destination: "Dallas",
          miles: 920,
          weight: 40000,
          rate: 2.5,
          baseCharge: 2300,
          accessorials: [],
          accessorialTotal: 0,
          total: 2300,
          contractedRate: 2.45,
        },
      ];

      const rateSheets = [
        {
          id: "sheet-1",
          contractId: "contract-1",
          effectiveDate: new Date("2024-01-01"),
          expiryDate: new Date("2024-12-31"),
          baseRate: 2.45,
          fuelSurcharge: 0,
          accessorials: [],
          conditions: [],
        },
      ];

      const results = auditor.auditLineItems(lineItems, rateSheets);

      expect(results[0].status).toBe("approved");
      expect(results[0].variance).toBeCloseTo(46, 0);
      expect(results[0].variancePercent).toBeLessThan(3);
    });

    it("should flag items exceeding tolerance", () => {
      const lineItems: InvoiceLineItem[] = [
        {
          lineId: "line-1",
          loadNumber: "LOAD-001",
          origin: "Chicago",
          destination: "Dallas",
          miles: 920,
          weight: 40000,
          rate: 3.0,
          baseCharge: 2760,
          accessorials: [],
          accessorialTotal: 0,
          total: 2760,
          contractedRate: 2.45,
        },
      ];

      const rateSheets = [
        {
          id: "sheet-1",
          contractId: "contract-1",
          effectiveDate: new Date("2024-01-01"),
          expiryDate: new Date("2024-12-31"),
          baseRate: 2.45,
          fuelSurcharge: 0,
          accessorials: [],
          conditions: [],
        },
      ];

      const results = auditor.auditLineItems(lineItems, rateSheets);

      expect(results[0].status).toBe("flagged");
      expect(Math.abs(results[0].variance)).toBeGreaterThan(50);
    });

    it("should handle multiple line items", () => {
      const lineItems: InvoiceLineItem[] = [
        {
          lineId: "line-1",
          loadNumber: "LOAD-001",
          origin: "Chicago",
          destination: "Dallas",
          miles: 920,
          weight: 40000,
          rate: 2.5,
          baseCharge: 2300,
          accessorials: [],
          accessorialTotal: 0,
          total: 2300,
          contractedRate: 2.45,
        },
        {
          lineId: "line-2",
          loadNumber: "LOAD-002",
          origin: "Dallas",
          destination: "Houston",
          miles: 240,
          weight: 38000,
          rate: 3.5,
          baseCharge: 840,
          accessorials: [],
          accessorialTotal: 0,
          total: 840,
          contractedRate: 2.8,
        },
      ];

      const rateSheets = [
        {
          id: "sheet-1",
          contractId: "contract-1",
          effectiveDate: new Date("2024-01-01"),
          expiryDate: new Date("2024-12-31"),
          baseRate: 2.8,
          fuelSurcharge: 0,
          accessorials: [],
          conditions: [],
        },
      ];

      const results = auditor.auditLineItems(lineItems, rateSheets);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("approved");
      expect(results[1].status).toBe("flagged");
    });
  });

  describe("autoApprove", () => {
    it("should return approved line item IDs", () => {
      const auditItems = [
        {
          lineId: "line-1",
          loadNumber: "LOAD-001",
          contractRate: 2.45,
          invoicedRate: 2.5,
          variance: 23,
          variancePercent: 0.94,
          tolerance: 3,
          status: "approved" as const,
        },
        {
          lineId: "line-2",
          loadNumber: "LOAD-002",
          contractRate: 2.8,
          invoicedRate: 3.5,
          variance: 168,
          variancePercent: 25,
          tolerance: 3,
          status: "flagged" as const,
        },
      ];

      const approved = auditor.autoApprove(auditItems);

      expect(approved).toEqual(["line-1"]);
      expect(approved).not.toContain("line-2");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ACCESSORIAL VALIDATOR TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("AccessorialValidator", () => {
  let validator: AccessorialValidator;

  beforeEach(() => {
    validator = new AccessorialValidator();
  });

  describe("validateCharges", () => {
    it("should validate detention charges", () => {
      const charges: AccessorialCharge[] = [
        {
          chargeId: "acc-1",
          type: AccessorialType.DETENTION,
          description: "2-day detention",
          amount: 200,
          unit: "flat",
        },
      ];

      const contractedCharges: AccessorialCharge[] = [
        {
          chargeId: "contract-acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 100,
          unit: "per_hour",
        },
      ];

      const results = validator.validateCharges(charges, contractedCharges);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(AccessorialType.DETENTION);
      expect(results[0].variance).toBeGreaterThan(0);
    });

    it("should reject uncontracted charges", () => {
      const charges: AccessorialCharge[] = [
        {
          chargeId: "acc-1",
          type: AccessorialType.INSIDE_DELIVERY,
          description: "Inside delivery",
          amount: 150,
          unit: "flat",
        },
      ];

      const contractedCharges: AccessorialCharge[] = [
        {
          chargeId: "contract-acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 100,
          unit: "flat",
        },
      ];

      const results = validator.validateCharges(charges, contractedCharges);

      expect(results[0].valid).toBe(false);
      expect(results[0].reason).toContain("not in contract");
    });

    it("should validate multiple accessorial charges", () => {
      const charges: AccessorialCharge[] = [
        {
          chargeId: "acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 100,
          unit: "flat",
        },
        {
          chargeId: "acc-2",
          type: AccessorialType.LIFTGATE,
          description: "Liftgate",
          amount: 75,
          unit: "flat",
        },
      ];

      const contractedCharges: AccessorialCharge[] = [
        {
          chargeId: "contract-acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 100,
          unit: "flat",
        },
        {
          chargeId: "contract-acc-2",
          type: AccessorialType.LIFTGATE,
          description: "Liftgate",
          amount: 75,
          unit: "flat",
        },
      ];

      const results = validator.validateCharges(charges, contractedCharges);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
    });
  });

  describe("setTariffRate", () => {
    it("should allow custom tariff rate registration", () => {
      validator.setTariffRate(AccessorialType.DETENTION, 150);

      const charges: AccessorialCharge[] = [
        {
          chargeId: "acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 200,
          unit: "flat",
        },
      ];

      const contractedCharges: AccessorialCharge[] = [
        {
          chargeId: "contract-acc-1",
          type: AccessorialType.DETENTION,
          description: "Detention",
          amount: 200,
          unit: "flat",
        },
      ];

      const results = validator.validateCharges(charges, contractedCharges);

      expect(results[0].approvedAmount).toBeLessThanOrEqual(200);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// DUPLICATE DETECTOR TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("DuplicateDetector", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  describe("detectDuplicates", () => {
    it("should detect identical duplicate charges", () => {
      const invoice: FreightInvoice = {
        id: "invoice-1",
        tenantId: "tenant-1",
        carrierId: "carrier-1",
        invoiceNumber: "INV-001",
        invoiceDate: new Date(),
        dueDate: new Date(),
        loads: [
          {
            lineId: "line-1",
            loadNumber: "LOAD-001",
            proNumber: "PRO-123456",
            origin: "Chicago",
            destination: "Dallas",
            miles: 920,
            weight: 40000,
            rate: 2.5,
            baseCharge: 2300,
            accessorials: [],
            accessorialTotal: 0,
            total: 2300,
          },
          {
            lineId: "line-2",
            loadNumber: "LOAD-002",
            proNumber: "PRO-123456",
            origin: "Chicago",
            destination: "Dallas",
            miles: 920,
            weight: 40000,
            rate: 2.5,
            baseCharge: 2300,
            accessorials: [],
            accessorialTotal: 0,
            total: 2300,
          },
        ],
        subtotal: 4600,
        taxes: 0,
        total: 4600,
        status: "received",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const duplicates = detector.detectDuplicates(invoice);

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].proNumber).toBe("PRO-123456");
      expect(duplicates[0].similarityScore).toBeGreaterThanOrEqual(75);
    });

    it("should not flag different shipments as duplicates", () => {
      const invoice: FreightInvoice = {
        id: "invoice-1",
        tenantId: "tenant-1",
        carrierId: "carrier-1",
        invoiceNumber: "INV-001",
        invoiceDate: new Date(),
        dueDate: new Date(),
        loads: [
          {
            lineId: "line-1",
            loadNumber: "LOAD-001",
            proNumber: "PRO-111111",
            origin: "Chicago",
            destination: "Dallas",
            miles: 920,
            weight: 40000,
            rate: 2.5,
            baseCharge: 2300,
            accessorials: [],
            accessorialTotal: 0,
            total: 2300,
          },
          {
            lineId: "line-2",
            loadNumber: "LOAD-002",
            proNumber: "PRO-222222",
            origin: "Dallas",
            destination: "Houston",
            miles: 240,
            weight: 35000,
            rate: 2.8,
            baseCharge: 672,
            accessorials: [],
            accessorialTotal: 0,
            total: 672,
          },
        ],
        subtotal: 2972,
        taxes: 0,
        total: 2972,
        status: "received",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const duplicates = detector.detectDuplicates(invoice);

      expect(duplicates.length).toBe(0);
    });

    it("should handle empty invoice gracefully", () => {
      const invoice: FreightInvoice = {
        id: "invoice-1",
        tenantId: "tenant-1",
        carrierId: "carrier-1",
        invoiceNumber: "INV-001",
        invoiceDate: new Date(),
        dueDate: new Date(),
        loads: [],
        subtotal: 0,
        taxes: 0,
        total: 0,
        status: "received",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const duplicates = detector.detectDuplicates(invoice);

      expect(duplicates).toEqual([]);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// DISPUTE MANAGER TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("DisputeManager", () => {
  let manager: DisputeManager;

  beforeEach(() => {
    manager = new DisputeManager();
  });

  describe("generateDispute", () => {
    it("should generate disputes from audit findings", () => {
      const disputes = manager.generateDispute({
        invoiceId: "inv-1",
        lineItemIds: ["line-1", "line-2"],
        reason: "Rate exceeds contract",
        amount: 200,
        evidence: ["rate-sheet-001", "invoice-page-2"],
      });

      expect(disputes).toHaveLength(2);
      expect(disputes[0].invoiceId).toBe("inv-1");
      expect(disputes[0].status).toBe(DisputeStatus.OPEN);
      expect(disputes[0].createdAt).toBeDefined();
      expect(disputes[0].amount).toBe(100); // 200 / 2
    });

    it("should distribute amount equally across line items", () => {
      const disputes = manager.generateDispute({
        invoiceId: "inv-1",
        lineItemIds: ["line-1", "line-2", "line-3"],
        reason: "Overcharge",
        amount: 300,
        evidence: [],
      });

      expect(disputes).toHaveLength(3);
      disputes.forEach((d) => {
        expect(d.amount).toBe(100); // 300 / 3
      });
    });
  });

  describe("resolveDispute", () => {
    it("should update dispute with resolution", () => {
      const dispute = {
        disputeId: "disp-1",
        invoiceId: "inv-1",
        lineItemId: "line-1",
        amount: 100,
        reason: "Overcharge",
        evidence: [],
        status: DisputeStatus.OPEN,
        createdAt: new Date(),
      };

      const resolved = manager.resolveDispute(dispute, {
        disputeId: "disp-1",
        resolution: "Approved for credit",
        approvedAmount: 100,
        dateResolved: new Date(),
      });

      expect(resolved.status).toBe(DisputeStatus.SETTLED);
      expect(resolved.resolution).toBe("Approved for credit");
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe("shouldEscalate", () => {
    it("should detect disputes needing escalation", () => {
      const oldDispute = {
        disputeId: "disp-1",
        invoiceId: "inv-1",
        lineItemId: "line-1",
        amount: 100,
        reason: "Overcharge",
        evidence: [],
        status: DisputeStatus.OPEN,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
      };

      const shouldEscalate = manager.shouldEscalate(oldDispute);

      expect(shouldEscalate).toBe(true);
    });

    it("should not escalate recent disputes", () => {
      const recentDispute = {
        disputeId: "disp-1",
        invoiceId: "inv-1",
        lineItemId: "line-1",
        amount: 100,
        reason: "Overcharge",
        evidence: [],
        status: DisputeStatus.OPEN,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
      };

      const shouldEscalate = manager.shouldEscalate(recentDispute);

      expect(shouldEscalate).toBe(false);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AUDIT REPORTER TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("AuditReporter", () => {
  let reporter: AuditReporter;

  beforeEach(() => {
    reporter = new AuditReporter();
  });

  describe("generateMetrics", () => {
    it("should calculate metrics from audit results", () => {
      const auditResults = [
        {
          id: "audit-1",
          invoiceId: "inv-1",
          auditDate: new Date(),
          auditedBy: "user-1",
          status: AuditStatus.APPROVED,
          lineItems: [
            {
              lineId: "line-1",
              loadNumber: "LOAD-001",
              contractRate: 2.45,
              invoicedRate: 2.5,
              variance: 23,
              variancePercent: 0.94,
              tolerance: 3,
              status: "approved" as const,
            },
          ],
          duplicates: [],
          disputes: [],
          savings: {
            overchargeAmount: 0,
            duplicateAmount: 0,
            accessorialSavings: 0,
            total: 0,
          },
          notes: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metrics = reporter.generateMetrics(auditResults);

      expect(metrics.totalInvoicesAudited).toBe(1);
      expect(metrics.totalSavingsAmount).toBe(0);
      expect(metrics.complianceScore).toBeGreaterThanOrEqual(0);
    });

    it("should rank carriers by accuracy", () => {
      const auditResults = [
        {
          id: "audit-1",
          invoiceId: "inv-1",
          auditDate: new Date(),
          auditedBy: "user-1",
          status: AuditStatus.DISPUTED,
          lineItems: [
            {
              lineId: "line-1",
              loadNumber: "LOAD-001",
              contractRate: 2.45,
              invoicedRate: 3.0,
              variance: 460,
              variancePercent: 18.78,
              tolerance: 3,
              status: "disputed" as const,
            },
          ],
          duplicates: [],
          disputes: [
            {
              disputeId: "disp-1",
              invoiceId: "inv-1",
              lineItemId: "line-1",
              amount: 460,
              reason: "Rate overcharge",
              evidence: [],
              status: DisputeStatus.SETTLED,
              createdAt: new Date(),
              resolvedAt: new Date(),
            },
          ],
          savings: {
            overchargeAmount: 460,
            duplicateAmount: 0,
            accessorialSavings: 0,
            total: 460,
          },
          notes: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metrics = reporter.generateMetrics(auditResults);

      expect(metrics.carrierAccuracyRanking).toBeDefined();
      expect(metrics.totalSavingsAmount).toBe(460);
      expect(metrics.disputeWinRate).toBe(100);
    });
  });

  describe("calculateCarrierScore", () => {
    it("should calculate lower score for flagged audits", () => {
      const auditResultsWithFlags = [
        {
          id: "audit-1",
          invoiceId: "inv-1",
          auditDate: new Date(),
          auditedBy: "user-1",
          status: AuditStatus.FLAGGED,
          lineItems: [
            {
              lineId: "line-1",
              loadNumber: "LOAD-001",
              contractRate: 2.45,
              invoicedRate: 2.5,
              variance: 23,
              variancePercent: 0.94,
              tolerance: 3,
              status: "flagged" as const,
            },
          ],
          duplicates: [],
          disputes: [],
          savings: {
            overchargeAmount: 0,
            duplicateAmount: 0,
            accessorialSavings: 0,
            total: 0,
          },
          notes: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const score = reporter.calculateCarrierScore(auditResultsWithFlags);

      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it("should return 100 for no audits", () => {
      const score = reporter.calculateCarrierScore([]);

      expect(score).toBe(100);
    });
  });
});
