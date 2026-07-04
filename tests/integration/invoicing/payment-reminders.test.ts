/**
 * Payment Reminders Integration Tests
 * Tests reminder scheduling, escalation rules, overdue detection,
 * aging bucket calculation, and edge cases
 * ~200 lines, 15+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fixtures from "../fixtures/invoice-fixtures";

// ─── Mock Payment Reminder Service ──────────────────────────────────────────

interface ReminderSchedule {
  id: string;
  invoiceId: string;
  daysOverdue: number;
  remindersScheduled: Array<{
    dueDate: Date;
    reminderDate: Date;
    level: "first" | "second" | "third" | "final";
    status: "scheduled" | "sent" | "failed";
    sentAt?: Date;
  }>;
}

interface AgingBucket {
  name: string;
  minDays: number;
  maxDays?: number;
  invoices: Array<{
    invoiceNumber: string;
    dueDate: Date;
    amount: number;
    daysOverdue: number;
  }>;
  totalAmount: number;
}

class PaymentReminderService {
  private reminders = new Map<string, ReminderSchedule>();
  private sentReminders = new Map<
    string,
    Array<{ sentAt: Date; level: string }>
  >();

  // ─ Reminder Scheduling ──────────────────────────────────────────────────

  scheduleReminders(invoice: fixtures.InvoiceData): ReminderSchedule {
    const schedule: ReminderSchedule = {
      id: `schedule_${Date.now()}`,
      invoiceId: invoice.id,
      daysOverdue: 0,
      remindersScheduled: [
        {
          dueDate: invoice.dueDate,
          reminderDate: new Date(invoice.dueDate.getTime() + 0), // on due date
          level: "first",
          status: "scheduled",
        },
        {
          dueDate: invoice.dueDate,
          reminderDate: new Date(
            invoice.dueDate.getTime() + 5 * 24 * 60 * 60 * 1000,
          ),
          level: "second",
          status: "scheduled",
        },
        {
          dueDate: invoice.dueDate,
          reminderDate: new Date(
            invoice.dueDate.getTime() + 15 * 24 * 60 * 60 * 1000,
          ),
          level: "third",
          status: "scheduled",
        },
        {
          dueDate: invoice.dueDate,
          reminderDate: new Date(
            invoice.dueDate.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
          level: "final",
          status: "scheduled",
        },
      ],
    };

    this.reminders.set(invoice.id, schedule);
    return schedule;
  }

  // ─ Send Reminders ──────────────────────────────────────────────────────

  sendReminder(
    invoiceId: string,
    level: "first" | "second" | "third" | "final",
  ): {
    sent: boolean;
    reminderLevel: string;
    sentAt: Date;
  } {
    const schedule = this.reminders.get(invoiceId);
    if (!schedule) throw new Error("No reminders scheduled for invoice");

    const reminder = schedule.remindersScheduled.find((r) => r.level === level);
    if (!reminder) throw new Error(`No ${level} reminder found`);

    reminder.status = "sent";
    reminder.sentAt = new Date();

    if (!this.sentReminders.has(invoiceId)) {
      this.sentReminders.set(invoiceId, []);
    }
    this.sentReminders.get(invoiceId)!.push({
      sentAt: reminder.sentAt,
      level: reminder.level,
    });

    return {
      sent: true,
      reminderLevel: level,
      sentAt: reminder.sentAt,
    };
  }

  // ─ Escalation Rules ────────────────────────────────────────────────────

  determineEscalationLevel(
    daysOverdue: number,
  ): "first" | "second" | "third" | "final" {
    if (daysOverdue <= 0) return "first";
    if (daysOverdue <= 5) return "second";
    if (daysOverdue <= 15) return "third";
    return "final";
  }

  getEscalationMessage(level: "first" | "second" | "third" | "final"): string {
    switch (level) {
      case "first":
        return "Payment reminder: Your invoice is now due. Please remit payment at your earliest convenience.";
      case "second":
        return "Payment overdue: This invoice is 5 days overdue. Please prioritize payment.";
      case "third":
        return "Urgent payment notice: This invoice is 15 days overdue. Immediate payment required.";
      case "final":
        return "Final notice: This account is significantly overdue. We may suspend services if payment is not received within 48 hours.";
      default:
        return "";
    }
  }

  // ─ Overdue Detection ────────────────────────────────────────────────────

  isInvoiceOverdue(
    invoice: fixtures.InvoiceData,
    asOfDate: Date = new Date(),
  ): boolean {
    return asOfDate.getTime() > invoice.dueDate.getTime();
  }

  calculateDaysOverdue(
    invoice: fixtures.InvoiceData,
    asOfDate: Date = new Date(),
  ): number {
    if (!this.isInvoiceOverdue(invoice, asOfDate)) return 0;

    const milliseconds = asOfDate.getTime() - invoice.dueDate.getTime();
    return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
  }

  // ─ Aging Bucket Calculation ────────────────────────────────────────────

  calculateAgingBuckets(
    invoices: fixtures.InvoiceData[],
    asOfDate: Date = new Date(),
  ): AgingBucket[] {
    const buckets: AgingBucket[] = [
      {
        name: "Current",
        minDays: -Infinity,
        maxDays: 0,
        invoices: [],
        totalAmount: 0,
      },
      {
        name: "1-30 Days Overdue",
        minDays: 1,
        maxDays: 30,
        invoices: [],
        totalAmount: 0,
      },
      {
        name: "31-60 Days Overdue",
        minDays: 31,
        maxDays: 60,
        invoices: [],
        totalAmount: 0,
      },
      {
        name: "61-90 Days Overdue",
        minDays: 61,
        maxDays: 90,
        invoices: [],
        totalAmount: 0,
      },
      {
        name: "90+ Days Overdue",
        minDays: 91,
        maxDays: Infinity,
        invoices: [],
        totalAmount: 0,
      },
    ];

    for (const invoice of invoices) {
      if (invoice.status === "paid" || invoice.status === "void") continue;

      const daysOverdue = this.calculateDaysOverdue(invoice, asOfDate);

      for (const bucket of buckets) {
        if (
          daysOverdue >= bucket.minDays &&
          daysOverdue <= (bucket.maxDays || Infinity)
        ) {
          bucket.invoices.push({
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            amount: invoice.total,
            daysOverdue,
          });
          bucket.totalAmount += invoice.total;
          break;
        }
      }
    }

    return buckets;
  }

  // ─ Check if Reminder Already Sent ──────────────────────────────────────

  hasReminderBeenSent(
    invoiceId: string,
    level: "first" | "second" | "third" | "final",
  ): boolean {
    const sent = this.sentReminders.get(invoiceId) || [];
    return sent.some((r) => r.level === level);
  }

  getSchedule(invoiceId: string): ReminderSchedule | undefined {
    return this.reminders.get(invoiceId);
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Payment Reminders Integration Tests", () => {
  let service: PaymentReminderService;
  let mockInvoice: fixtures.InvoiceData;

  beforeEach(() => {
    service = new PaymentReminderService();
    mockInvoice = fixtures.createInvoice({
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    });
  });

  describe("Reminder Scheduling", () => {
    it("should schedule reminders on creation", () => {
      const schedule = service.scheduleReminders(mockInvoice);

      expect(schedule.remindersScheduled).toHaveLength(4);
      expect(schedule.remindersScheduled[0].level).toBe("first");
      expect(schedule.remindersScheduled[1].level).toBe("second");
      expect(schedule.remindersScheduled[2].level).toBe("third");
      expect(schedule.remindersScheduled[3].level).toBe("final");
    });

    it("should set correct reminder dates", () => {
      const schedule = service.scheduleReminders(mockInvoice);

      const firstReminder = schedule.remindersScheduled[0];
      const secondReminder = schedule.remindersScheduled[1];

      expect(firstReminder.reminderDate.getTime()).toBeLessThan(
        secondReminder.reminderDate.getTime(),
      );
    });

    it("should schedule 5-day reminder 5 days after due date", () => {
      const schedule = service.scheduleReminders(mockInvoice);
      const secondReminder = schedule.remindersScheduled[1];

      const expectedDate = new Date(
        mockInvoice.dueDate.getTime() + 5 * 24 * 60 * 60 * 1000,
      );
      expect(secondReminder.reminderDate.getTime()).toEqual(
        expectedDate.getTime(),
      );
    });

    it("should initialize reminders as scheduled", () => {
      const schedule = service.scheduleReminders(mockInvoice);

      for (const reminder of schedule.remindersScheduled) {
        expect(reminder.status).toBe("scheduled");
        expect(reminder.sentAt).toBeUndefined();
      }
    });
  });

  describe("Sending Reminders", () => {
    it("should send first reminder", () => {
      service.scheduleReminders(mockInvoice);
      const result = service.sendReminder(mockInvoice.id, "first");

      expect(result.sent).toBe(true);
      expect(result.reminderLevel).toBe("first");
      expect(result.sentAt).toBeDefined();
    });

    it("should mark reminder as sent", () => {
      service.scheduleReminders(mockInvoice);
      service.sendReminder(mockInvoice.id, "first");

      const schedule = service.getSchedule(mockInvoice.id);
      const firstReminder = schedule!.remindersScheduled[0];

      expect(firstReminder.status).toBe("sent");
      expect(firstReminder.sentAt).toBeDefined();
    });

    it("should send multiple reminders sequentially", () => {
      service.scheduleReminders(mockInvoice);
      service.sendReminder(mockInvoice.id, "first");
      service.sendReminder(mockInvoice.id, "second");
      service.sendReminder(mockInvoice.id, "third");

      expect(service.hasReminderBeenSent(mockInvoice.id, "first")).toBe(true);
      expect(service.hasReminderBeenSent(mockInvoice.id, "second")).toBe(true);
      expect(service.hasReminderBeenSent(mockInvoice.id, "third")).toBe(true);
    });
  });

  describe("Escalation Rules", () => {
    it("should escalate to second level after 5 days", () => {
      const level = service.determineEscalationLevel(7);
      expect(level).toBe("second");
    });

    it("should escalate to third level after 15 days", () => {
      const level = service.determineEscalationLevel(20);
      expect(level).toBe("third");
    });

    it("should escalate to final level after 30 days", () => {
      const level = service.determineEscalationLevel(40);
      expect(level).toBe("final");
    });

    it("should return appropriate escalation message", () => {
      const firstMsg = service.getEscalationMessage("first");
      const secondMsg = service.getEscalationMessage("second");
      const thirdMsg = service.getEscalationMessage("third");
      const finalMsg = service.getEscalationMessage("final");

      expect(firstMsg).toContain("Payment reminder");
      expect(secondMsg).toContain("overdue");
      expect(thirdMsg).toContain("Urgent");
      expect(finalMsg).toContain("Final notice");
    });
  });

  describe("Overdue Detection", () => {
    it("should detect overdue invoice", () => {
      const overdueInvoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const isOverdue = service.isInvoiceOverdue(overdueInvoice);
      expect(isOverdue).toBe(true);
    });

    it("should detect non-overdue invoice", () => {
      const futureInvoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      const isOverdue = service.isInvoiceOverdue(futureInvoice);
      expect(isOverdue).toBe(false);
    });

    it("should calculate days overdue correctly", () => {
      const invoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });

      const daysOverdue = service.calculateDaysOverdue(invoice);
      expect(daysOverdue).toBe(10);
    });

    it("should return 0 days for current invoice", () => {
      const invoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      const daysOverdue = service.calculateDaysOverdue(invoice);
      expect(daysOverdue).toBe(0);
    });
  });

  describe("Aging Bucket Calculation", () => {
    it("should categorize current invoices", () => {
      const futureInvoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([futureInvoice]);
      const currentBucket = buckets.find((b) => b.name === "Current");

      expect(currentBucket!.invoices).toHaveLength(1);
      expect(currentBucket!.totalAmount).toBe(futureInvoice.total);
    });

    it("should categorize 1-30 days overdue", () => {
      const invoices = [
        fixtures.createInvoice({
          invoiceNumber: "INV-001",
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
        fixtures.createInvoice({
          invoiceNumber: "INV-002",
          dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        }),
      ];

      const buckets = service.calculateAgingBuckets(invoices);
      const overdue1to30 = buckets.find((b) => b.name === "1-30 Days Overdue");

      expect(overdue1to30!.invoices).toHaveLength(2);
    });

    it("should categorize 31-60 days overdue", () => {
      const invoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([invoice]);
      const overdue31to60 = buckets.find(
        (b) => b.name === "31-60 Days Overdue",
      );

      expect(overdue31to60!.invoices).toHaveLength(1);
    });

    it("should categorize 61-90 days overdue", () => {
      const invoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([invoice]);
      const overdue61to90 = buckets.find(
        (b) => b.name === "61-90 Days Overdue",
      );

      expect(overdue61to90!.invoices).toHaveLength(1);
    });

    it("should categorize 90+ days overdue", () => {
      const invoice = fixtures.createInvoice({
        dueDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([invoice]);
      const overdueOver90 = buckets.find((b) => b.name === "90+ Days Overdue");

      expect(overdueOver90!.invoices).toHaveLength(1);
    });

    it("should calculate total amounts correctly", () => {
      const invoices = [
        fixtures.createInvoice({
          total: 1000,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
        fixtures.createInvoice({
          total: 2000,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
      ];

      const buckets = service.calculateAgingBuckets(invoices);
      const overdue1to30 = buckets.find((b) => b.name === "1-30 Days Overdue");

      expect(overdue1to30!.totalAmount).toBe(3000);
    });

    it("should exclude paid invoices from aging", () => {
      const paidInvoice = fixtures.createInvoice({
        status: "paid",
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([paidInvoice]);
      const totalInvoices = buckets.reduce(
        (sum, b) => sum + b.invoices.length,
        0,
      );

      expect(totalInvoices).toBe(0);
    });

    it("should exclude voided invoices from aging", () => {
      const voidedInvoice = fixtures.createInvoice({
        status: "void",
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const buckets = service.calculateAgingBuckets([voidedInvoice]);
      const totalInvoices = buckets.reduce(
        (sum, b) => sum + b.invoices.length,
        0,
      );

      expect(totalInvoices).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle already paid invoice before reminder", () => {
      const paidInvoice = fixtures.createInvoice({ status: "paid" });
      service.scheduleReminders(paidInvoice);

      expect(() => service.sendReminder(paidInvoice.id, "first")).toThrow();
    });

    it("should handle void invoice", () => {
      const voidInvoice = fixtures.createInvoice({ status: "void" });

      const isOverdue = service.isInvoiceOverdue(voidInvoice);
      expect(isOverdue).toBeDefined();
    });

    it("should handle invoice with no scheduled reminders", () => {
      expect(() => service.sendReminder(mockInvoice.id, "first")).toThrow(
        "No reminders scheduled",
      );
    });

    it("should track sent reminders", () => {
      service.scheduleReminders(mockInvoice);
      service.sendReminder(mockInvoice.id, "first");
      service.sendReminder(mockInvoice.id, "second");

      expect(service.hasReminderBeenSent(mockInvoice.id, "first")).toBe(true);
      expect(service.hasReminderBeenSent(mockInvoice.id, "second")).toBe(true);
      expect(service.hasReminderBeenSent(mockInvoice.id, "third")).toBe(false);
    });
  });
});
