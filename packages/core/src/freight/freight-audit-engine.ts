/**
 * Freight Audit Engine
 * Handles invoice auditing, charge validation, duplicate detection, and dispute management
 */

import {
  FreightInvoice,
  InvoiceLineItem,
  AuditResult,
  AuditLineItem,
  AccessorialCharge,
  AccessorialType,
  DuplicateDetection,
  DisputeItem,
  DisputeStatus,
  AuditStatus,
  RateSheet,
} from "./freight-types";

// ────────────────────────────────────────────────────────────────────────────
// INVOICE AUDITOR
// ────────────────────────────────────────────────────────────────────────────

export interface InvoiceAuditorConfig {
  tolerancePercent: number; // e.g., 3 for 3%
  minOverchargeThreshold: number; // minimum $ to flag
  flagForReview: boolean;
}

export class InvoiceAuditor {
  private config: InvoiceAuditorConfig;

  constructor(config: Partial<InvoiceAuditorConfig> = {}) {
    this.config = {
      tolerancePercent: config.tolerancePercent ?? 3,
      minOverchargeThreshold: config.minOverchargeThreshold ?? 50,
      flagForReview: config.flagForReview ?? true,
    };
  }

  /**
   * Audit invoice line items against contracted rates
   */
  auditLineItems(
    lineItems: InvoiceLineItem[],
    rateSheets: RateSheet[]
  ): AuditLineItem[] {
    return lineItems.map((item) => {
      const contractRate = this.getContractedRate(item, rateSheets);
      const variance = item.baseCharge - (contractRate * item.miles);
      const variancePercent = (variance / (contractRate * item.miles)) * 100;

      let status: "approved" | "flagged" | "disputed" = "approved";
      let finding: string | undefined;

      if (Math.abs(variancePercent) > this.config.tolerancePercent) {
        status = "flagged";
        finding = `Rate variance of ${variancePercent.toFixed(2)}% exceeds tolerance`;
        if (Math.abs(variance) < this.config.minOverchargeThreshold) {
          status = "approved"; // Below threshold
          finding = undefined;
        }
      }

      return {
        lineId: item.lineId,
        loadNumber: item.loadNumber,
        contractRate,
        invoicedRate: item.rate,
        variance,
        variancePercent,
        tolerance: this.config.tolerancePercent,
        status,
        finding,
      };
    });
  }

  /**
   * Get contracted rate for a line item from rate sheets
   */
  private getContractedRate(
    item: InvoiceLineItem,
    rateSheets: RateSheet[]
  ): number {
    // Find applicable rate sheet by date
    const applicableSheet = rateSheets.find((sheet) => {
      const now = new Date();
      return (
        sheet.effectiveDate <= now && now <= sheet.expiryDate
      );
    });

    if (!applicableSheet) {
      return item.rate; // fallback to invoiced rate
    }

    return applicableSheet.baseRate;
  }

  /**
   * Flag high-risk line items requiring manual review
   */
  flagForReview(auditItems: AuditLineItem[]): AuditLineItem[] {
    return auditItems.filter((item) => item.status === "flagged");
  }

  /**
   * Auto-approve items within tolerance
   */
  autoApprove(auditItems: AuditLineItem[]): string[] {
    return auditItems
      .filter((item) => item.status === "approved")
      .map((item) => item.lineId);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ACCESSORIAL VALIDATOR
// ────────────────────────────────────────────────────────────────────────────

export interface AccessorialValidationResult {
  chargeId: string;
  type: AccessorialType;
  invoicedAmount: number;
  approvedAmount: number;
  variance: number;
  valid: boolean;
  reason?: string;
}

export class AccessorialValidator {
  private tariffRates: Map<AccessorialType, number> = new Map([
    [AccessorialType.DETENTION, 100], // $ per day
    [AccessorialType.LIFTGATE, 75],
    [AccessorialType.INSIDE_DELIVERY, 200],
    [AccessorialType.RESIDENTIAL, 150],
    [AccessorialType.HAZMAT, 250],
    [AccessorialType.OVERNIGHT, 300],
    [AccessorialType.APPOINTMENT, 50],
  ]);

  /**
   * Validate accessorial charges against industry tariffs
   */
  validateCharges(
    charges: AccessorialCharge[],
    contractedCharges: AccessorialCharge[]
  ): AccessorialValidationResult[] {
    return charges.map((charge) => {
      const contracted = contractedCharges.find(
        (c) => c.type === charge.type
      );

      if (!contracted) {
        return {
          chargeId: charge.chargeId,
          type: charge.type,
          invoicedAmount: charge.amount,
          approvedAmount: 0,
          variance: charge.amount,
          valid: false,
          reason: "Charge type not in contract",
        };
      }

      const approved = this.validateAmount(charge, contracted);
      const variance = charge.amount - approved;

      return {
        chargeId: charge.chargeId,
        type: charge.type,
        invoicedAmount: charge.amount,
        approvedAmount: approved,
        variance,
        valid: Math.abs(variance) <= 5, // $5 tolerance
        reason: variance > 0 ? "Amount exceeds contracted rate" : undefined,
      };
    });
  }

  /**
   * Validate amount against contracted and tariff rates
   */
  private validateAmount(
    charge: AccessorialCharge,
    contractedCharge: AccessorialCharge
  ): number {
    const tariffRate = this.tariffRates.get(charge.type) ?? 0;
    const maxAllowed = Math.min(contractedCharge.amount, tariffRate);

    if (charge.unit === "flat") {
      return Math.min(charge.amount, maxAllowed);
    }

    return Math.min(charge.amount, maxAllowed);
  }

  /**
   * Register custom tariff rates
   */
  setTariffRate(type: AccessorialType, rate: number): void {
    this.tariffRates.set(type, rate);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DUPLICATE DETECTOR
// ────────────────────────────────────────────────────────────────────────────

export interface DuplicateDetectorConfig {
  proNumberThreshold: number;
  dateThreshold: number; // days
  amountThreshold: number; // %
}

export class DuplicateDetector {
  private config: DuplicateDetectorConfig;

  constructor(config: Partial<DuplicateDetectorConfig> = {}) {
    this.config = {
      proNumberThreshold: config.proNumberThreshold ?? 0.95,
      dateThreshold: config.dateThreshold ?? 3,
      amountThreshold: config.amountThreshold ?? 5,
    };
  }

  /**
   * Detect duplicate charges in invoice
   */
  detectDuplicates(
    invoice: FreightInvoice
  ): DuplicateDetection[] {
    const duplicates: DuplicateDetection[] = [];

    for (let i = 0; i < invoice.loads.length; i++) {
      for (let j = i + 1; j < invoice.loads.length; j++) {
        const item1 = invoice.loads[i];
        const item2 = invoice.loads[j];

        const similarity = this.calculateSimilarity(item1, item2);
        if (similarity > 75) {
          duplicates.push({
            duplicate1: item1.lineId,
            duplicate2: item2.lineId,
            proNumber: item1.proNumber,
            bol: item1.loadNumber,
            similarityScore: similarity,
            amount: item1.total,
            foundAt: new Date(),
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Calculate similarity between two line items
   */
  private calculateSimilarity(
    item1: InvoiceLineItem,
    item2: InvoiceLineItem
  ): number {
    let similarity = 0;

    // Check PRO numbers
    if (item1.proNumber && item2.proNumber) {
      if (this.stringSimilarity(item1.proNumber, item2.proNumber) > 0.8) {
        similarity += 30;
      }
    }

    // Check BOL
    if (
      item1.loadNumber === item2.loadNumber
    ) {
      similarity += 25;
    }

    // Check date (within threshold)
    // (Would need date from invoice context)

    // Check amount (within threshold %)
    const amountVariance = Math.abs(
      item1.total - item2.total
    ) / item1.total;
    if (amountVariance < this.config.amountThreshold / 100) {
      similarity += 25;
    }

    // Check origin/destination match
    if (
      item1.origin === item2.origin &&
      item1.destination === item2.destination
    ) {
      similarity += 20;
    }

    return Math.min(similarity, 100);
  }

  /**
   * Simple string similarity function
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance for string matching
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DISPUTE MANAGER
// ────────────────────────────────────────────────────────────────────────────

export interface DisputeGenerationRequest {
  invoiceId: string;
  lineItemIds: string[];
  reason: string;
  amount: number;
  evidence: string[];
}

export interface DisputeResolution {
  disputeId: string;
  resolution: string;
  approvedAmount: number;
  dateResolved: Date;
}

export class DisputeManager {
  private escalationTiers = [
    { tier: 1, maxDaysToResolve: 7, notify: ["carrier_manager"] },
    { tier: 2, maxDaysToResolve: 14, notify: ["finance", "carrier_manager"] },
    { tier: 3, maxDaysToResolve: 30, notify: ["cfo", "carrier_manager", "legal"] },
  ];

  /**
   * Generate dispute from audit findings
   */
  generateDispute(
    request: DisputeGenerationRequest
  ): DisputeItem[] {
    return request.lineItemIds.map((lineItemId) => ({
      disputeId: this.generateDisputeId(),
      invoiceId: request.invoiceId,
      lineItemId,
      amount: request.amount / request.lineItemIds.length,
      reason: request.reason,
      evidence: request.evidence,
      status: DisputeStatus.OPEN,
      createdAt: new Date(),
    }));
  }

  /**
   * Track dispute resolution
   */
  resolveDispute(
    dispute: DisputeItem,
    resolution: DisputeResolution
  ): DisputeItem {
    return {
      ...dispute,
      status: DisputeStatus.SETTLED,
      resolvedAt: resolution.dateResolved,
      resolution: resolution.resolution,
    };
  }

  /**
   * Escalate dispute to higher tier
   */
  escalateDispute(dispute: DisputeItem, tier: number): DisputeItem {
    if (tier > this.escalationTiers.length) {
      throw new Error("Invalid escalation tier");
    }

    return {
      ...dispute,
      status: DisputeStatus.APPEALED,
    };
  }

  /**
   * Get escalation notifications for dispute
   */
  getEscalationNotifications(
    daysSinceCreated: number
  ): string[] {
    const tier = this.escalationTiers.find(
      (t) => daysSinceCreated > t.maxDaysToResolve
    );

    return tier?.notify ?? [];
  }

  /**
   * Check if dispute should auto-escalate
   */
  shouldEscalate(dispute: DisputeItem): boolean {
    if (!dispute.createdAt) return false;

    const daysSinceCreated = Math.floor(
      (new Date().getTime() - dispute.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return this.escalationTiers.some(
      (t) => daysSinceCreated > t.maxDaysToResolve
    );
  }

  private generateDisputeId(): string {
    return `DSP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// AUDIT REPORTER
// ────────────────────────────────────────────────────────────────────────────

export interface AuditMetrics {
  totalInvoicesAudited: number;
  totalSavingsAmount: number;
  averageSavingsPerInvoice: number;
  disputeWinRate: number; // %
  carrierAccuracyRanking: CarrierAccuracy[];
  topOverchargedItems: string[];
  topDuplicateRates: string[];
  complianceScore: number; // 0-100
}

export interface CarrierAccuracy {
  carrierId: string;
  carrierName: string;
  invoicesAudited: number;
  overchargeCount: number;
  overchargePercent: number;
  accuracy: number; // 0-100
  trend: "improving" | "stable" | "declining";
}

export class AuditReporter {
  /**
   * Generate audit metrics report
   */
  generateMetrics(
    auditResults: AuditResult[]
  ): AuditMetrics {
    const carrierMap = new Map<
      string,
      { audited: number; overcharges: number }
    >();
    let totalSavings = 0;
    let disputeResolved = 0;
    let disputeTotal = 0;

    auditResults.forEach((result) => {
      totalSavings += result.savings.total;

      const carrierKey = result.id;
      carrierMap.set(carrierKey, {
        audited: (carrierMap.get(carrierKey)?.audited ?? 0) + 1,
        overcharges:
          (carrierMap.get(carrierKey)?.overcharges ?? 0) +
          result.lineItems.filter((li) => li.status === "disputed").length,
      });

      result.disputes.forEach((d) => {
        disputeTotal++;
        if (d.status === DisputeStatus.SETTLED) {
          disputeResolved++;
        }
      });
    });

    const carrierAccuracyRanking: CarrierAccuracy[] = Array.from(
      carrierMap.entries()
    ).map(([id, data]) => ({
      carrierId: id,
      carrierName: `Carrier-${id}`,
      invoicesAudited: data.audited,
      overchargeCount: data.overcharges,
      overchargePercent: (data.overcharges / data.audited) * 100,
      accuracy: 100 - (data.overcharges / data.audited) * 100,
      trend: "stable",
    }));

    return {
      totalInvoicesAudited: auditResults.length,
      totalSavingsAmount: totalSavings,
      averageSavingsPerInvoice: totalSavings / auditResults.length,
      disputeWinRate: disputeTotal > 0 ? (disputeResolved / disputeTotal) * 100 : 0,
      carrierAccuracyRanking,
      topOverchargedItems: this.getTopViolations(auditResults),
      topDuplicateRates: this.getTopDuplicates(auditResults),
      complianceScore: this.calculateComplianceScore(auditResults),
    };
  }

  /**
   * Calculate carrier scorecard from audit history
   */
  calculateCarrierScore(
    auditResults: AuditResult[]
  ): number {
    if (auditResults.length === 0) return 100;

    const flaggedCount = auditResults.filter(
      (r) =>
        r.lineItems.some((li) => li.status === "flagged") ||
        r.duplicates.length > 0
    ).length;

    return Math.max(50, 100 - (flaggedCount / auditResults.length) * 25);
  }

  /**
   * Get top overcharged items by frequency
   */
  private getTopViolations(auditResults: AuditResult[]): string[] {
    const violations = new Map<string, number>();

    auditResults.forEach((result) => {
      result.lineItems.forEach((item) => {
        if (item.status === "disputed" && item.finding) {
          violations.set(item.finding, (violations.get(item.finding) ?? 0) + 1);
        }
      });
    });

    return Array.from(violations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([finding]) => finding);
  }

  /**
   * Get top duplicate detection types
   */
  private getTopDuplicates(auditResults: AuditResult[]): string[] {
    const types = new Map<string, number>();

    auditResults.forEach((result) => {
      result.duplicates.forEach((dup) => {
        const key = `${dup.proNumber || "NOPRO"}-${dup.bol || "NOBOL"}`;
        types.set(key, (types.get(key) ?? 0) + 1);
      });
    });

    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(auditResults: AuditResult[]): number {
    if (auditResults.length === 0) return 100;

    let totalLines = 0;
    let approvedLines = 0;

    auditResults.forEach((result) => {
      totalLines += result.lineItems.length;
      approvedLines += result.lineItems.filter(
        (li) => li.status === "approved"
      ).length;
    });

    return Math.round((approvedLines / totalLines) * 100);
  }
}
