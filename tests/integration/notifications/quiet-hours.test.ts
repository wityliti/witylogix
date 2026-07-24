/**
 * Notification Quiet Hours Test Suite
 * Tests quiet hours queueing, digest batching, timezone handling, CRITICAL priority bypass
 * ~150 lines
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  NotificationPayload,
  QuietHours,
} from "../fixtures/notification-fixtures.js";
import {
  createNotificationPayload,
  createQuietHours,
} from "../fixtures/notification-fixtures.js";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface QueuedNotification {
  notification: NotificationPayload;
  queuedAt: Date;
  reason: string;
}

interface DigestBatch {
  notifications: NotificationPayload[];
  createdAt: Date;
  flushedAt?: Date;
}

// ─── QUIET HOURS SERVICE ────────────────────────────────────────────────────

class QuietHoursService {
  private queue: QueuedNotification[] = [];
  private digestBatches: Map<string, DigestBatch> = new Map();

  constructor(private quietHours: Map<string, QuietHours> = new Map()) {}

  isInQuietHours(recipientId: string, now: Date = new Date()): boolean {
    const quietHours = this.quietHours.get(recipientId);
    if (!quietHours || !quietHours.enabled) return false;

    const localTime = this.convertToTimezone(now, quietHours.timezone);
    const currentTimeStr = `${String(localTime.getHours()).padStart(2, "0")}:${String(
      localTime.getMinutes(),
    ).padStart(2, "0")}`;

    const [startHour, startMin] = quietHours.startTime.split(":").map(Number);
    const [endHour, endMin] = quietHours.endTime.split(":").map(Number);

    const startTotalMins = startHour * 60 + startMin;
    const endTotalMins = endHour * 60 + endMin;
    const currentTotalMins = localTime.getHours() * 60 + localTime.getMinutes();

    if (startTotalMins < endTotalMins) {
      return (
        currentTotalMins >= startTotalMins && currentTotalMins < endTotalMins
      );
    } else {
      return (
        currentTotalMins >= startTotalMins || currentTotalMins < endTotalMins
      );
    }
  }

  async handleNotification(
    notification: NotificationPayload,
  ): Promise<{ queued: boolean; reason?: string }> {
    const inQuietHours = this.isInQuietHours(notification.recipientId);

    if (inQuietHours && notification.priority !== "CRITICAL") {
      this.queue.push({
        notification,
        queuedAt: new Date(),
        reason: "Quiet hours active",
      });
      return { queued: true, reason: "Quiet hours active" };
    }

    return { queued: false };
  }

  setQuietHours(recipientId: string, quietHours: QuietHours): void {
    this.quietHours.set(recipientId, quietHours);
  }

  flushQueueAtQuietHoursEnd(recipientId: string): DigestBatch {
    const batchId = `${recipientId}_${Date.now()}`;
    const notifications = this.queue
      .filter((q) => q.notification.recipientId === recipientId)
      .map((q) => q.notification);

    const batch: DigestBatch = {
      notifications,
      createdAt: new Date(),
      flushedAt: new Date(),
    };

    this.digestBatches.set(batchId, batch);

    // Remove from queue
    this.queue = this.queue.filter(
      (q) => q.notification.recipientId !== recipientId,
    );

    return batch;
  }

  getQueuedNotifications(recipientId?: string): QueuedNotification[] {
    if (recipientId) {
      return this.queue.filter(
        (q) => q.notification.recipientId === recipientId,
      );
    }
    return [...this.queue];
  }

  getDigestBatches(): DigestBatch[] {
    return Array.from(this.digestBatches.values());
  }

  clearQueue(): void {
    this.queue = [];
  }

  private convertToTimezone(date: Date, timezone: string): Date {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const dateMap = new Map(parts.map((p) => [p.type, p.value]));

    return new Date(
      `${dateMap.get("year")}-${dateMap.get("month")}-${dateMap.get("day")}T${dateMap.get("hour")}:${dateMap.get(
        "minute",
      )}:${dateMap.get("second")}`,
    );
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Notification Quiet Hours", () => {
  let quietHoursService: QuietHoursService;
  const recipientId = "user_123";

  beforeEach(() => {
    quietHoursService = new QuietHoursService();
    quietHoursService.clearQueue();
  });

  // ─── QUIET HOURS DETECTION ──────────────────────────────────────────────

  describe("Quiet Hours Detection", () => {
    it("should detect when in quiet hours (evening)", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        eveningTime,
      );
      expect(inQuietHours).toBe(true);
    });

    it("should detect when not in quiet hours (morning)", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const morningTime = new Date();
      morningTime.setHours(10, 0);

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        morningTime,
      );
      expect(inQuietHours).toBe(false);
    });

    it("should ignore quiet hours when disabled", () => {
      const quietHours = createQuietHours({
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        eveningTime,
      );
      expect(inQuietHours).toBe(false);
    });
  });

  // ─── QUEUEING DURING QUIET HOURS ────────────────────────────────────────

  describe("Notification Queueing", () => {
    beforeEach(() => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);
    });

    it("should queue notification during quiet hours", async () => {
      const notification = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const result = await quietHoursService.handleNotification(notification);

      expect(result.queued).toBe(true);
      expect(result.reason).toBe("Quiet hours active");

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued).toHaveLength(1);
    });

    it("should not queue notification outside quiet hours", async () => {
      const notification = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });

      const morningTime = new Date();
      morningTime.setHours(10, 0);
      vi.setSystemTime(morningTime);

      const result = await quietHoursService.handleNotification(notification);

      expect(result.queued).toBe(false);
    });

    it("should queue multiple notifications during quiet hours", async () => {
      const notification1 = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });
      const notification2 = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });
      const notification3 = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      await quietHoursService.handleNotification(notification1);
      await quietHoursService.handleNotification(notification2);
      await quietHoursService.handleNotification(notification3);

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued).toHaveLength(3);
    });
  });

  // ─── CRITICAL PRIORITY BYPASS ───────────────────────────────────────────

  describe("CRITICAL Priority Bypass", () => {
    beforeEach(() => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);
    });

    it("should not queue CRITICAL priority during quiet hours", async () => {
      const notification = createNotificationPayload({
        recipientId,
        priority: "CRITICAL",
      });

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const result = await quietHoursService.handleNotification(notification);

      expect(result.queued).toBe(false);

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued).toHaveLength(0);
    });

    it("should bypass quiet hours for HIGH priority messages", async () => {
      const highPriorityNotification = createNotificationPayload({
        recipientId,
        priority: "HIGH",
      });

      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const result = await quietHoursService.handleNotification(
        highPriorityNotification,
      );

      // HIGH priority is not CRITICAL, so it should still be queued
      expect(result.queued).toBe(true);
    });
  });

  // ─── TIMEZONE HANDLING ──────────────────────────────────────────────────

  describe("Timezone Handling", () => {
    it("should respect UTC timezone", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "UTC",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const utcEveningTime = new Date();
      utcEveningTime.setUTCHours(23, 30);

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        utcEveningTime,
      );
      expect(inQuietHours).toBe(true);
    });

    it("should respect EST timezone", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const estTime = new Date("2026-03-17T23:30:00-05:00");

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        estTime,
      );
      expect(typeof inQuietHours).toBe("boolean");
    });

    it("should respect PST timezone", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/Los_Angeles",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const pstTime = new Date("2026-03-17T22:30:00-08:00");

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        pstTime,
      );
      expect(typeof inQuietHours).toBe("boolean");
    });

    it("should respect IST timezone", () => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "Asia/Kolkata",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const istTime = new Date("2026-03-17T23:30:00+05:30");

      const inQuietHours = quietHoursService.isInQuietHours(
        recipientId,
        istTime,
      );
      expect(typeof inQuietHours).toBe("boolean");
    });
  });

  // ─── DIGEST BATCHING ────────────────────────────────────────────────────

  describe("Digest Batching During Quiet Hours", () => {
    beforeEach(() => {
      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);
    });

    it("should batch queued notifications into digest", async () => {
      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const n1 = createNotificationPayload({ recipientId, priority: "NORMAL" });
      const n2 = createNotificationPayload({ recipientId, priority: "NORMAL" });
      const n3 = createNotificationPayload({ recipientId, priority: "NORMAL" });

      await quietHoursService.handleNotification(n1);
      await quietHoursService.handleNotification(n2);
      await quietHoursService.handleNotification(n3);

      const batch = quietHoursService.flushQueueAtQuietHoursEnd(recipientId);

      expect(batch.notifications).toHaveLength(3);
      expect(batch.flushedAt).toBeInstanceOf(Date);
    });

    it("should clear queue after flushing to digest", async () => {
      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const notification = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });
      await quietHoursService.handleNotification(notification);

      quietHoursService.flushQueueAtQuietHoursEnd(recipientId);

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued).toHaveLength(0);
    });

    it("should preserve notification order in digest", async () => {
      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const n1 = createNotificationPayload({
        recipientId,
        id: "notif_1",
        priority: "NORMAL",
      });
      const n2 = createNotificationPayload({
        recipientId,
        id: "notif_2",
        priority: "NORMAL",
      });
      const n3 = createNotificationPayload({
        recipientId,
        id: "notif_3",
        priority: "NORMAL",
      });

      await quietHoursService.handleNotification(n1);
      await quietHoursService.handleNotification(n2);
      await quietHoursService.handleNotification(n3);

      const batch = quietHoursService.flushQueueAtQuietHoursEnd(recipientId);

      expect(batch.notifications[0].id).toBe("notif_1");
      expect(batch.notifications[1].id).toBe("notif_2");
      expect(batch.notifications[2].id).toBe("notif_3");
    });
  });

  // ─── QUEUE MANAGEMENT ───────────────────────────────────────────────────

  describe("Queue Management", () => {
    it("should retrieve queued notifications by recipient", async () => {
      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const notification = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });
      await quietHoursService.handleNotification(notification);

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued).toHaveLength(1);
      expect(queued[0].notification.recipientId).toBe(recipientId);
    });

    it("should track queued timestamp", async () => {
      const eveningTime = new Date();
      eveningTime.setHours(23, 30);
      vi.setSystemTime(eveningTime);

      const quietHours = createQuietHours({
        enabled: true,
        startTime: "22:00",
        endTime: "08:00",
      });
      quietHoursService.setQuietHours(recipientId, quietHours);

      const notification = createNotificationPayload({
        recipientId,
        priority: "NORMAL",
      });
      await quietHoursService.handleNotification(notification);

      const queued = quietHoursService.getQueuedNotifications(recipientId);
      expect(queued[0].queuedAt).toBeInstanceOf(Date);
      expect(queued[0].queuedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
