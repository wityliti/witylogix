/**
 * Payment Reminder Service
 * Automated payment reminders and overdue invoice escalation
 * Handles scheduling, sending, and tracking reminders
 */

import type { Invoice } from "./types.js";

// ─── REMINDER TYPES ──────────────────────────────────────────────────────

export type ReminderType = "before-due" | "on-due" | "after-due" | "escalation";

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  reminderType: ReminderType;
  daysOffset: number; // Days relative to due date (negative = before, positive = after)
  scheduledFor: Date;
  sentAt?: Date;
  status: "scheduled" | "sent" | "failed" | "skipped";
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ReminderConfig {
  sendRemindersBeforeDue: boolean;
  daysBeforeDue?: number[]; // e.g., [7, 1]
  sendReminderOnDue: boolean;
  sendRemindersAfterDue: boolean;
  daysAfterDue?: number[]; // e.g., [3, 7, 14]
  escalateAfterDays?: number; // Default: 30 days
  maxReminderAttempts?: number; // Default: 3
}

export interface OverdueReport {
  invoiceId: string;
  invoiceNumber: string;
  customerId?: string;
  daysOverdue: number;
  amount: number;
  agingBucket: "1-30" | "31-60" | "61-90" | "90+";
  lastReminderSent?: Date;
}

// ─── REMINDER SCHEDULE CONFIG ───────────────────────────────────────────

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  sendRemindersBeforeDue: true,
  daysBeforeDue: [7, 1],
  sendReminderOnDue: true,
  sendRemindersAfterDue: true,
  daysAfterDue: [3, 7, 14],
  escalateAfterDays: 30,
  maxReminderAttempts: 3,
};

// ─── PAYMENT REMINDER SERVICE ───────────────────────────────────────────

export class PaymentReminderService {
  /**
   * Schedule reminders for an invoice
   */
  static scheduleReminders(
    invoice: Invoice,
    config: ReminderConfig = DEFAULT_REMINDER_CONFIG,
  ): PaymentReminder[] {
    const reminders: PaymentReminder[] = [];
    const dueDate = invoice.dueAt;

    // Schedule reminders before due date
    if (config.sendRemindersBeforeDue && config.daysBeforeDue) {
      for (const days of config.daysBeforeDue) {
        const scheduledFor = new Date(dueDate);
        scheduledFor.setDate(scheduledFor.getDate() - days);

        reminders.push({
          id: this.generateId(),
          invoiceId: invoice.id,
          reminderType: "before-due",
          daysOffset: -days,
          scheduledFor,
          status: "scheduled",
          createdAt: new Date(),
        });
      }
    }

    // Schedule reminder on due date
    if (config.sendReminderOnDue) {
      reminders.push({
        id: this.generateId(),
        invoiceId: invoice.id,
        reminderType: "on-due",
        daysOffset: 0,
        scheduledFor: dueDate,
        status: "scheduled",
        createdAt: new Date(),
      });
    }

    // Schedule reminders after due date
    if (config.sendRemindersAfterDue && config.daysAfterDue) {
      for (const days of config.daysAfterDue) {
        const scheduledFor = new Date(dueDate);
        scheduledFor.setDate(scheduledFor.getDate() + days);

        reminders.push({
          id: this.generateId(),
          invoiceId: invoice.id,
          reminderType: "after-due",
          daysOffset: days,
          scheduledFor,
          status: "scheduled",
          createdAt: new Date(),
        });
      }
    }

    // Schedule escalation after X days overdue
    if (config.escalateAfterDays) {
      const escalationDate = new Date(dueDate);
      escalationDate.setDate(
        escalationDate.getDate() + config.escalateAfterDays,
      );

      reminders.push({
        id: this.generateId(),
        invoiceId: invoice.id,
        reminderType: "escalation",
        daysOffset: config.escalateAfterDays,
        scheduledFor: escalationDate,
        status: "scheduled",
        metadata: {
          escalationLevel: 1,
          action: "flag_for_manual_followup",
        },
        createdAt: new Date(),
      });
    }

    return reminders;
  }

  /**
   * Build reminder email subject
   */
  static getReminderSubject(
    invoice: Invoice,
    reminderType: ReminderType,
  ): string {
    const daysOverdue = this.getDaysOverdue(invoice);

    switch (reminderType) {
      case "before-due":
        return `Payment Reminder: Invoice ${invoice.invoiceNumber} Due Soon`;

      case "on-due":
        return `Payment Due Today: Invoice ${invoice.invoiceNumber}`;

      case "after-due":
        return `Past Due: Invoice ${invoice.invoiceNumber} Requires Immediate Payment`;

      case "escalation":
        return `Urgent: Invoice ${invoice.invoiceNumber} is ${daysOverdue} Days Overdue`;

      default:
        return `Payment Reminder: Invoice ${invoice.invoiceNumber}`;
    }
  }

  /**
   * Build reminder email body
   */
  static getReminderBody(
    invoice: Invoice,
    reminderType: ReminderType,
    paymentLink?: string,
  ): string {
    const daysOverdue = this.getDaysOverdue(invoice);
    const dueDate = invoice.dueAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let body = "";

    switch (reminderType) {
      case "before-due":
        body = `
Dear Customer,

This is a friendly reminder that your invoice ${invoice.invoiceNumber} is due on ${dueDate}.

Invoice Amount: $${invoice.total.toFixed(2)} ${invoice.currency}
Due Date: ${dueDate}

${paymentLink ? `Please use the following link to pay: ${paymentLink}` : "Please arrange payment by the due date."}

Thank you for your business.

Best regards,
Witylogix Billing
`;
        break;

      case "on-due":
        body = `
Dear Customer,

Your invoice ${invoice.invoiceNumber} is due today.

Invoice Amount: $${invoice.total.toFixed(2)} ${invoice.currency}
Due Date: ${dueDate}

${paymentLink ? `Please use the following link to pay: ${paymentLink}` : "Please arrange immediate payment."}

Thank you for your prompt payment.

Best regards,
Witylogix Billing
`;
        break;

      case "after-due":
        body = `
Dear Customer,

Your invoice ${invoice.invoiceNumber} is now past due by ${daysOverdue} days.

Invoice Amount: $${invoice.total.toFixed(2)} ${invoice.currency}
Due Date: ${dueDate}
Days Overdue: ${daysOverdue}

Immediate payment is required to avoid service interruption.

${paymentLink ? `Please use the following link to pay now: ${paymentLink}` : "Please contact us to arrange payment."}

Thank you,
Witylogix Billing
`;
        break;

      case "escalation":
        body = `
Dear Customer,

Your invoice ${invoice.invoiceNumber} is now ${daysOverdue} days overdue and requires immediate attention.

Invoice Amount: $${invoice.total.toFixed(2)} ${invoice.currency}
Days Overdue: ${daysOverdue}

Payment must be made immediately to avoid account suspension.

${paymentLink ? `Pay now: ${paymentLink}` : "Please contact our accounting department for payment arrangements."}

If you have already paid this invoice, please disregard this notice and contact us with your payment reference.

Witylogix Billing Department
`;
        break;

      default:
        body = `
Dear Customer,

This is a reminder regarding invoice ${invoice.invoiceNumber}.

Invoice Amount: $${invoice.total.toFixed(2)} ${invoice.currency}
Due Date: ${dueDate}

Please arrange payment at your earliest convenience.

Thank you,
Witylogix Billing
`;
    }

    return body.trim();
  }

  /**
   * Get overdue report for invoices
   */
  static getOverdueReport(invoices: Invoice[]): OverdueReport[] {
    const overdueInvoices = invoices.filter(
      (inv) => inv.status === "overdue" && !inv.paidAt,
    );

    return overdueInvoices.map((invoice) => {
      const daysOverdue = this.getDaysOverdue(invoice);
      const agingBucket = this.getAgingBucket(daysOverdue);

      const totalPaid = (invoice.payments || []).reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const remainingAmount = invoice.total - totalPaid;

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        daysOverdue,
        amount: remainingAmount,
        agingBucket,
      };
    });
  }

  /**
   * Get summary of overdue invoices by aging bucket
   */
  static getOverdueSummary(overdueReports: OverdueReport[]): {
    "1-30": OverdueReport[];
    "31-60": OverdueReport[];
    "61-90": OverdueReport[];
    "90+": OverdueReport[];
    total: number;
  } {
    const summary = {
      "1-30": [] as OverdueReport[],
      "31-60": [] as OverdueReport[],
      "61-90": [] as OverdueReport[],
      "90+": [] as OverdueReport[],
      total: 0,
    };

    for (const report of overdueReports) {
      summary[report.agingBucket].push(report);
      summary.total += report.amount;
    }

    return summary;
  }

  /**
   * Escalate overdue invoices
   */
  static escalateOverdue(
    invoices: Invoice[],
    escalationDays: number = 30,
  ): Invoice[] {
    return invoices.filter((invoice) => {
      if (invoice.status !== "overdue") {
        return false;
      }

      const daysOverdue = this.getDaysOverdue(invoice);
      return daysOverdue >= escalationDays;
    });
  }

  /**
   * Check if reminder should be sent
   */
  static shouldSendReminder(
    reminder: PaymentReminder,
    invoice: Invoice,
    now: Date = new Date(),
  ): boolean {
    // Skip if already sent or failed too many times
    if (reminder.status === "sent" || reminder.status === "failed") {
      return false;
    }

    // Skip if not yet scheduled
    if (now < reminder.scheduledFor) {
      return false;
    }

    // Skip if invoice is already paid or voided
    if (invoice.status === "paid" || invoice.status === "voided") {
      return false;
    }

    return true;
  }

  /**
   * Mark reminder as sent
   */
  static markReminderSent(reminder: PaymentReminder): PaymentReminder {
    return {
      ...reminder,
      status: "sent",
      sentAt: new Date(),
    };
  }

  /**
   * Mark reminder as failed
   */
  static markReminderFailed(
    reminder: PaymentReminder,
    reason: string,
  ): PaymentReminder {
    return {
      ...reminder,
      status: "failed",
      failureReason: reason,
    };
  }

  /**
   * Get days overdue for an invoice
   */
  static getDaysOverdue(invoice: Invoice, now: Date = new Date()): number {
    if (invoice.status === "paid" || invoice.status === "draft") {
      return 0;
    }

    const daysOverdue = Math.floor(
      (now.getTime() - invoice.dueAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, daysOverdue);
  }

  /**
   * Get aging bucket for overdue invoice
   */
  private static getAgingBucket(
    daysOverdue: number,
  ): "1-30" | "31-60" | "61-90" | "90+" {
    if (daysOverdue <= 30) {
      return "1-30";
    } else if (daysOverdue <= 60) {
      return "31-60";
    } else if (daysOverdue <= 90) {
      return "61-90";
    }
    return "90+";
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Helper function to create reminder config
 */
export function createReminderConfig(
  options?: Partial<ReminderConfig>,
): ReminderConfig {
  return {
    ...DEFAULT_REMINDER_CONFIG,
    ...options,
  };
}

/**
 * Helper function to get aging bucket description
 */
export function getAgingBucketDescription(
  bucket: "1-30" | "31-60" | "61-90" | "90+",
): string {
  const descriptions: Record<string, string> = {
    "1-30": "1-30 Days Overdue",
    "31-60": "31-60 Days Overdue",
    "61-90": "61-90 Days Overdue",
    "90+": "90+ Days Overdue",
  };

  return descriptions[bucket] || "Unknown";
}
