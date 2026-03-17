/**
 * Work Order Engine — Lifecycle management, time tracking, parts inventory, and invoicing.
 *
 * Manages complete work order lifecycle:
 * - State transitions (created → completed/cancelled)
 * - Parts inventory tracking and reorder alerts
 * - Time tracking (clock in/out, travel, breaks, overtime)
 * - Signature capture for customer sign-off
 * - Automatic invoice generation with tax calculation
 * - SLA monitoring with escalation alerts
 *
 * Core principle: Immutable event log for audit trail.
 * Time complexity: O(1) for state transitions, O(n) for invoice generation.
 */

import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPart,
  SignatureData,
  PhotoData,
  SLAStatus,
} from "./field-service-types.js";

// ─── INVOICE TYPES ──────────────────────────────────────────────

/**
 * Invoice line item.
 */
export interface InvoiceLineItem {
  /** Item type: "LABOR", "PART", "TRAVEL", "MISC" */
  type: "LABOR" | "PART" | "TRAVEL" | "MISC";

  /** Item description. */
  description: string;

  /** Quantity. */
  quantity: number;

  /** Unit price. */
  unitPrice: number;

  /** Line total (quantity * unitPrice). */
  lineTotal: number;

  /** Tax amount. */
  taxAmount: number;

  /** Tax rate (%). */
  taxRate: number;
}

/**
 * Generated invoice from work order.
 */
export interface WorkOrderInvoice {
  /** Unique invoice ID. */
  id: string;

  /** Work order ID. */
  jobId: string;

  /** Customer ID. */
  customerId: string;

  /** Invoice date. */
  invoiceDate: Date;

  /** Due date. */
  dueDate: Date;

  /** Service address. */
  serviceAddress: string;

  /** Technician name. */
  technicianName: string;

  /** Technician ID. */
  technicianId: string;

  /** Work description summary. */
  workDescription: string;

  /** Service date. */
  serviceDate: Date;

  /** Line items (labor, parts, travel, etc.). */
  items: InvoiceLineItem[];

  /** Subtotal (before tax). */
  subtotal: number;

  /** Total tax. */
  totalTax: number;

  /** Grand total. */
  total: number;

  /** Payment status. */
  paid: boolean;

  /** Notes. */
  notes?: string;
}

/**
 * Time tracking entry.
 */
export interface TimeEntry {
  /** Timestamp of clock-in/out. */
  timestamp: Date;

  /** Type of time entry. */
  type: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END" | "TRAVEL_START" | "TRAVEL_END";

  /** Duration (for break/travel end). */
  duration?: number;

  /** Location coordinates. */
  location?: {
    latitude: number;
    longitude: number;
  };

  /** Notes. */
  notes?: string;
}

/**
 * Work order time summary.
 */
export interface TimeSummary {
  /** Clock-in time. */
  clockInTime: Date;

  /** Clock-out time. */
  clockOutTime?: Date;

  /** Total time on job (minutes). */
  totalTimeOnJob: number;

  /** Travel time to/from job (minutes). */
  travelTime: number;

  /** Break time (minutes). */
  breakTime: number;

  /** Billable time (total - breaks). */
  billableTime: number;

  /** Overtime minutes (over 8 hours). */
  overtimeMinutes: number;

  /** Is overtime (> 8 hours). */
  isOvertime: boolean;

  /** All time entries. */
  entries: TimeEntry[];
}

// ─── WORK ORDER LIFECYCLE ───────────────────────────────────────

/**
 * State machine for work order lifecycle.
 */
export class WorkOrderLifecycle {
  /**
   * Transition work order to new status.
   * Enforces valid state transitions.
   */
  static transition(
    job: WorkOrder,
    newStatus: WorkOrderStatus
  ): {
    success: boolean;
    job: WorkOrder;
    error?: string;
  } {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      CREATED: ["SCHEDULED", "CANCELLED"],
      SCHEDULED: ["DISPATCHED", "CANCELLED"],
      DISPATCHED: ["EN_ROUTE", "CANCELLED"],
      EN_ROUTE: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[job.status]?.includes(newStatus)) {
      return {
        success: false,
        job,
        error: `Cannot transition from ${job.status} to ${newStatus}`,
      };
    }

    const updated = {
      ...job,
      status: newStatus,
      updatedAt: new Date(),
      ...(newStatus === "COMPLETED" && { completedAt: new Date() }),
    };

    return { success: true, job: updated };
  }

  /**
   * Get available next states for current status.
   */
  static getAvailableTransitions(status: WorkOrderStatus): WorkOrderStatus[] {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      CREATED: ["SCHEDULED", "CANCELLED"],
      SCHEDULED: ["DISPATCHED", "CANCELLED"],
      DISPATCHED: ["EN_ROUTE", "CANCELLED"],
      EN_ROUTE: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    return validTransitions[status] || [];
  }
}

// ─── PARTS TRACKER ──────────────────────────────────────────────

/**
 * Manages parts usage and inventory deductions.
 */
export class PartsTracker {
  /**
   * Record parts used for a job.
   */
  static recordUsage(
    job: WorkOrder,
    parts: WorkOrderPart[]
  ): {
    job: WorkOrder;
    reorderAlerts: string[];
  } {
    const reorderAlerts: string[] = [];

    // Add parts to job
    const updatedJob = {
      ...job,
      parts: [...job.parts, ...parts],
      updatedAt: new Date(),
    };

    // Check for reorder thresholds (simplified)
    for (const part of parts) {
      if (part.quantity > 5) {
        reorderAlerts.push(`High quantity used for part ${part.name} (${part.quantity}x)`);
      }
    }

    return {
      job: updatedJob,
      reorderAlerts,
    };
  }

  /**
   * Calculate total parts cost for job.
   */
  static calculatePartsCost(parts: WorkOrderPart[]): {
    total: number;
    billable: number;
    nonBillable: number;
  } {
    let total = 0;
    let billable = 0;
    let nonBillable = 0;

    for (const part of parts) {
      const cost = part.quantity * part.unitCost;
      total += cost;

      if (part.billable) {
        billable += cost;
      } else {
        nonBillable += cost;
      }
    }

    return { total, billable, nonBillable };
  }

  /**
   * Get part usage report for job.
   */
  static getUsageReport(job: WorkOrder): {
    partCount: number;
    totalQuantity: number;
    uniqueParts: number;
    partsCost: number;
  } {
    const uniqueParts = new Set(job.parts.map((p) => p.partId)).size;
    const totalQuantity = job.parts.reduce((sum, p) => sum + p.quantity, 0);
    const partsCost = job.parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);

    return {
      partCount: job.parts.length,
      totalQuantity,
      uniqueParts,
      partsCost,
    };
  }
}

// ─── TIME TRACKER ───────────────────────────────────────────────

/**
 * Tracks time spent on job, travel, breaks, and calculates overtime.
 */
export class TimeTracker {
  /**
   * Record time entry (clock in/out, break, travel).
   */
  static recordEntry(
    summary: TimeSummary,
    entry: TimeEntry
  ): TimeSummary {
    const updated = {
      ...summary,
      entries: [...summary.entries, entry],
    };

    // Recalculate totals
    return this.calculateTotals(updated);
  }

  /**
   * Clock in technician.
   */
  static clockIn(jobId: string, location: { latitude: number; longitude: number }): TimeEntry {
    return {
      timestamp: new Date(),
      type: "CLOCK_IN",
      location,
    };
  }

  /**
   * Clock out technician.
   */
  static clockOut(jobId: string, location: { latitude: number; longitude: number }): TimeEntry {
    return {
      timestamp: new Date(),
      type: "CLOCK_OUT",
      location,
    };
  }

  /**
   * Calculate time totals from entries.
   */
  static calculateTotals(summary: TimeSummary): TimeSummary {
    let clockInTime: Date | null = null;
    let clockOutTime: Date | null = null;
    let breakTime = 0;
    let travelTime = 0;

    for (const entry of summary.entries) {
      if (entry.type === "CLOCK_IN") {
        clockInTime = entry.timestamp;
      } else if (entry.type === "CLOCK_OUT") {
        clockOutTime = entry.timestamp;
      } else if (entry.type === "BREAK_END" && entry.duration) {
        breakTime += entry.duration;
      } else if (entry.type === "TRAVEL_END" && entry.duration) {
        travelTime += entry.duration;
      }
    }

    let totalTimeOnJob = 0;
    if (clockInTime && clockOutTime) {
      totalTimeOnJob = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000);
    }

    const billableTime = totalTimeOnJob - breakTime;
    const overtimeMinutes = Math.max(0, billableTime - 480); // 480 = 8 hours
    const isOvertime = overtimeMinutes > 0;

    return {
      clockInTime: clockInTime || summary.clockInTime,
      clockOutTime: clockOutTime || summary.clockOutTime,
      totalTimeOnJob,
      travelTime,
      breakTime,
      billableTime,
      overtimeMinutes,
      isOvertime,
      entries: summary.entries,
    };
  }
}

// ─── SIGNATURE CAPTURE ──────────────────────────────────────────

/**
 * Manages customer signature capture for sign-off.
 */
export class SignatureCapture {
  /**
   * Add signature to work order.
   */
  static addSignature(
    job: WorkOrder,
    signerName: string,
    signatureData: string, // Base64 or S3 URL
    type: "CUSTOMER" | "TECHNICIAN" = "CUSTOMER"
  ): WorkOrder {
    const signature: SignatureData = {
      timestamp: new Date(),
      signerName,
      signatureData,
      type,
    };

    return {
      ...job,
      signatures: [...job.signatures, signature],
      updatedAt: new Date(),
    };
  }

  /**
   * Check if work order has valid customer signature.
   */
  static hasCustomerSignature(job: WorkOrder): boolean {
    return job.signatures.some((s) => s.type === "CUSTOMER");
  }

  /**
   * Get customer signature metadata.
   */
  static getSignatureMetadata(job: WorkOrder): {
    hasSignature: boolean;
    signerName?: string;
    signatureTime?: Date;
  } {
    const sig = job.signatures.find((s) => s.type === "CUSTOMER");
    return {
      hasSignature: !!sig,
      signerName: sig?.signerName,
      signatureTime: sig?.timestamp,
    };
  }
}

// ─── INVOICE GENERATOR ──────────────────────────────────────────

/**
 * Generates invoices from completed work orders.
 */
export class InvoiceGenerator {
  /**
   * Generate invoice from completed work order.
   */
  static generateInvoice(
    job: WorkOrder,
    timeSummary: TimeSummary,
    technicianName: string,
    laborRatePerHour: number = 125,
    travelRatePerHour: number = 50,
    taxRate: number = 0.08 // 8% sales tax
  ): WorkOrderInvoice | null {
    if (job.status !== "COMPLETED" || !job.scheduledStart || !job.scheduledEnd) {
      return null;
    }

    const items: InvoiceLineItem[] = [];

    // Labor charges
    const laborHours = timeSummary.billableTime / 60;
    const laborAmount = laborHours * laborRatePerHour;
    const laborTax = laborAmount * taxRate;
    items.push({
      type: "LABOR",
      description: `Service labor (${laborHours.toFixed(2)} hours @ $${laborRatePerHour}/hr)`,
      quantity: 1,
      unitPrice: laborAmount,
      lineTotal: laborAmount,
      taxAmount: laborTax,
      taxRate: taxRate * 100,
    });

    // Overtime charges (if applicable)
    if (timeSummary.isOvertime) {
      const overtimeHours = timeSummary.overtimeMinutes / 60;
      const overtimeAmount = overtimeHours * laborRatePerHour * 1.5; // 1.5x overtime
      const overtimeTax = overtimeAmount * taxRate;
      items.push({
        type: "LABOR",
        description: `Overtime (${overtimeHours.toFixed(2)} hours @ $${(laborRatePerHour * 1.5).toFixed(2)}/hr)`,
        quantity: 1,
        unitPrice: overtimeAmount,
        lineTotal: overtimeAmount,
        taxAmount: overtimeTax,
        taxRate: taxRate * 100,
      });
    }

    // Travel charges
    const travelHours = timeSummary.travelTime / 60;
    if (travelHours > 0) {
      const travelAmount = travelHours * travelRatePerHour;
      const travelTax = travelAmount * taxRate;
      items.push({
        type: "TRAVEL",
        description: `Travel time (${travelHours.toFixed(2)} hours @ $${travelRatePerHour}/hr)`,
        quantity: 1,
        unitPrice: travelAmount,
        lineTotal: travelAmount,
        taxAmount: travelTax,
        taxRate: taxRate * 100,
      });
    }

    // Parts
    const partsCost = PartsTracker.calculatePartsCost(job.parts);
    if (partsCost.billable > 0) {
      const partsTax = partsCost.billable * taxRate;
      items.push({
        type: "PART",
        description: `Materials and parts (${job.parts.length} items)`,
        quantity: 1,
        unitPrice: partsCost.billable,
        lineTotal: partsCost.billable,
        taxAmount: partsTax,
        taxRate: taxRate * 100,
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + totalTax;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30-day net terms

    return {
      id: `inv_${job.id}_${Date.now()}`,
      jobId: job.id,
      customerId: job.customerId,
      invoiceDate: new Date(),
      dueDate,
      serviceAddress: `${job.address.street}, ${job.address.city}, ${job.address.state} ${job.address.postalCode}`,
      technicianName,
      technicianId: job.technicianId || "UNKNOWN",
      workDescription: job.description,
      serviceDate: job.completedAt || new Date(),
      items,
      subtotal,
      totalTax,
      total,
      paid: false,
    };
  }
}

// ─── SLA MONITOR ────────────────────────────────────────────────

/**
 * Monitors SLA compliance and triggers escalations.
 */
export class SLAMonitor {
  /**
   * Calculate current SLA status for work order.
   */
  static calculateStatus(job: WorkOrder, slaRule: { windows: Array<{ priority: string; responseTimeMinutes: number; completionTimeMinutes: number }> }): SLAStatus {
    const slaWindow = slaRule.windows.find((w) => w.priority === job.priority);
    if (!slaWindow) {
      throw new Error(`No SLA window defined for priority ${job.priority}`);
    }

    const responseDeadline = new Date(job.createdAt.getTime() + slaWindow.responseTimeMinutes * 60 * 1000);
    const completionDeadline = new Date(job.createdAt.getTime() + slaWindow.completionTimeMinutes * 60 * 1000);

    let breached = false;
    let breachType: "RESPONSE" | "COMPLETION" | undefined;
    let minutesLate = 0;

    const now = new Date();

    // Check response breach
    if (job.status === "CREATED" && now > responseDeadline) {
      breached = true;
      breachType = "RESPONSE";
      minutesLate = Math.floor((now.getTime() - responseDeadline.getTime()) / 60000);
    }

    // Check completion breach
    if (["CREATED", "SCHEDULED", "DISPATCHED", "EN_ROUTE", "IN_PROGRESS"].includes(job.status) && now > completionDeadline) {
      breached = true;
      breachType = "COMPLETION";
      minutesLate = Math.floor((now.getTime() - completionDeadline.getTime()) / 60000);
    }

    // Calculate status percent (0-100)
    const timeSinceCreation = now.getTime() - job.createdAt.getTime();
    const statusPercent = Math.min(100, Math.floor((timeSinceCreation / (slaWindow.completionTimeMinutes * 60 * 1000)) * 100));

    return {
      jobId: job.id,
      slaRuleId: job.slaRuleId,
      priority: job.priority,
      responseDeadline,
      completionDeadline,
      breached,
      breachType,
      minutesLate: breached ? minutesLate : undefined,
      statusPercent,
    };
  }

  /**
   * Check if SLA needs escalation (at 80% and 100% thresholds).
   */
  static getEscalationLevel(slaStatus: SLAStatus): "NONE" | "WARNING" | "CRITICAL" {
    if (slaStatus.breached) {
      return "CRITICAL";
    }

    if (slaStatus.statusPercent >= 80) {
      return "WARNING";
    }

    return "NONE";
  }

  /**
   * Generate SLA report for set of work orders.
   */
  static generateReport(
    jobs: WorkOrder[],
    slaRule: { windows: Array<{ priority: string; responseTimeMinutes: number; completionTimeMinutes: number }> }
  ): {
    totalJobs: number;
    compliantJobs: number;
    breachedJobs: number;
    complianceRate: number;
    criticalAlerts: number;
  } {
    let compliantJobs = 0;
    let breachedJobs = 0;
    let criticalAlerts = 0;

    for (const job of jobs) {
      const status = this.calculateStatus(job, slaRule);
      if (status.breached) {
        breachedJobs++;
        if (this.getEscalationLevel(status) === "CRITICAL") {
          criticalAlerts++;
        }
      } else {
        compliantJobs++;
      }
    }

    return {
      totalJobs: jobs.length,
      compliantJobs,
      breachedJobs,
      complianceRate: jobs.length > 0 ? (compliantJobs / jobs.length) * 100 : 0,
      criticalAlerts,
    };
  }
}
