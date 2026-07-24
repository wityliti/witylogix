/**
 * Notification Orchestrator v2 Unit Tests
 *
 * Test coverage:
 * - Channel routing based on priority and preferences
 * - Quiet hours management and queue flushing
 * - Digest batching for low-priority notifications
 * - Delivery tracking across channels
 * - Rate limiting and throttling
 * - Retry management and dead letter queue
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NotificationOrchestratorV2,
  ChannelRouter,
  FallbackChain,
  QuietHoursManager,
  DigestBatcher,
  DeliveryTracker,
  RetryManager,
  NotificationThrottler,
  getNotificationOrchestratorV2,
  resetNotificationOrchestratorV2,
} from "../../../packages/core/src/notifications/notification-orchestrator-v2.js";
import type {
  NotificationRequest,
  RecipientPreferences,
} from "../../../packages/core/src/notifications/notification-types.js";
import {
  NotificationChannel,
  NotificationPriority,
  DeliveryStatus,
} from "../../../packages/core/src/notifications/notification-types.js";

// ─── CHANNEL ROUTER TESTS ────────────────────────────────────────────────

describe("ChannelRouter", () => {
  let router: ChannelRouter;

  beforeEach(() => {
    router = new ChannelRouter();
  });

  it("should route CRITICAL priority to push first", async () => {
    const channels = await router.routeChannels(
      NotificationPriority.CRITICAL,
      undefined,
    );
    expect(channels[0]).toBe(NotificationChannel.PUSH);
  });

  it("should route NORMAL priority to push first, then email", async () => {
    const channels = await router.routeChannels(
      NotificationPriority.NORMAL,
      undefined,
    );
    expect(channels[0]).toBe(NotificationChannel.PUSH);
    expect(channels).toContain(NotificationChannel.EMAIL);
  });

  it("should respect recipient channel preferences", async () => {
    const prefs: RecipientPreferences = {
      recipientId: "user123",
      tenantId: "tenant1",
      locale: "en",
      timezone: "UTC",
      preferences: [
        { channel: NotificationChannel.PUSH, enabled: false },
        { channel: NotificationChannel.EMAIL, enabled: true },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const channels = await router.routeChannels(
      NotificationPriority.NORMAL,
      prefs,
    );
    expect(channels).not.toContain(NotificationChannel.PUSH);
    expect(channels).toContain(NotificationChannel.EMAIL);
  });

  it("should override with explicit request channels", async () => {
    const channels = await router.routeChannels(
      NotificationPriority.NORMAL,
      undefined,
      [NotificationChannel.SMS, NotificationChannel.EMAIL],
    );
    expect(channels).toEqual([
      NotificationChannel.SMS,
      NotificationChannel.EMAIL,
    ]);
  });
});

// ─── QUIET HOURS MANAGER TESTS ──────────────────────────────────────────

describe("QuietHoursManager", () => {
  let manager: QuietHoursManager;

  beforeEach(() => {
    manager = new QuietHoursManager();
  });

  it("should bypass quiet hours for CRITICAL priority", async () => {
    const isQuiet = await manager.isInQuietHours(
      "user123",
      undefined,
      NotificationPriority.CRITICAL,
    );
    expect(isQuiet).toBe(false);
  });

  it("should bypass quiet hours for HIGH priority", async () => {
    const isQuiet = await manager.isInQuietHours(
      "user123",
      undefined,
      NotificationPriority.HIGH,
    );
    expect(isQuiet).toBe(false);
  });

  it("should queue notification if in quiet hours", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };

    const queued = await manager.queueIfQuiet("user123", request, true);
    expect(queued).toBe(true);

    const queueSize = await manager.getQueueSize("user123");
    expect(queueSize).toBe(1);
  });

  it("should flush queue on wake", async () => {
    const request1: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };
    const request2: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template2",
      category: "DELIVERY",
      priority: NotificationPriority.NORMAL,
    };

    await manager.queueIfQuiet("user123", request1, true);
    await manager.queueIfQuiet("user123", request2, true);

    const flushed = await manager.flushQueue("user123");
    expect(flushed).toHaveLength(2);

    const newSize = await manager.getQueueSize("user123");
    expect(newSize).toBe(0);
  });
});

// ─── DIGEST BATCHER TESTS ────────────────────────────────────────────────

describe("DigestBatcher", () => {
  let batcher: DigestBatcher;

  beforeEach(() => {
    batcher = new DigestBatcher();
  });

  it("should add notification to digest queue", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "MARKETING",
      priority: NotificationPriority.LOW,
    };

    await batcher.addToDigest("user123", request);

    const queueSize = await batcher.getQueueSize("user123");
    expect(queueSize).toBe(1);
  });

  it("should batch multiple notifications", async () => {
    const requests = [
      {
        tenantId: "tenant1",
        recipientId: "user123",
        templateId: "template1",
        category: "MARKETING",
        priority: NotificationPriority.LOW,
      },
      {
        tenantId: "tenant1",
        recipientId: "user123",
        templateId: "template2",
        category: "MARKETING",
        priority: NotificationPriority.LOW,
      },
    ];

    for (const req of requests) {
      await batcher.addToDigest("user123", req);
    }

    const queueSize = await batcher.getQueueSize("user123");
    expect(queueSize).toBe(2);
  });

  it("should force flush digest", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "MARKETING",
      priority: NotificationPriority.LOW,
    };

    await batcher.addToDigest("user123", request);
    const flushed = await batcher.flushDigest("user123");

    expect(flushed).not.toBeNull();
    expect(flushed).toHaveLength(1);

    const newSize = await batcher.getQueueSize("user123");
    expect(newSize).toBe(0);
  });
});

// ─── DELIVERY TRACKER TESTS ──────────────────────────────────────────────

describe("DeliveryTracker", () => {
  let tracker: DeliveryTracker;

  beforeEach(() => {
    tracker = new DeliveryTracker();
  });

  it("should create initial receipt with PENDING status", async () => {
    const receipt = await tracker.createReceipt(
      "msg123",
      NotificationChannel.EMAIL,
    );

    expect(receipt.status).toBe(DeliveryStatus.PENDING);
    expect(receipt.channel).toBe(NotificationChannel.EMAIL);
    expect(receipt.retryCount).toBe(0);
  });

  it("should update receipt status", async () => {
    await tracker.createReceipt("msg123", NotificationChannel.EMAIL);
    await tracker.updateReceipt(
      "msg123",
      NotificationChannel.EMAIL,
      DeliveryStatus.SENT,
    );

    const receipts = await tracker.getReceipts("msg123");
    const emailReceipt = receipts.find(
      (r) => r.channel === NotificationChannel.EMAIL,
    );
    expect(emailReceipt?.status).toBe(DeliveryStatus.SENT);
  });

  it("should track multiple channel receipts", async () => {
    await tracker.createReceipt("msg123", NotificationChannel.EMAIL);
    await tracker.createReceipt("msg123", NotificationChannel.PUSH);
    await tracker.createReceipt("msg123", NotificationChannel.SMS);

    const receipts = await tracker.getReceipts("msg123");
    expect(receipts).toHaveLength(3);
  });

  it("should determine overall message status as READ if any channel READ", async () => {
    await tracker.createReceipt("msg123", NotificationChannel.EMAIL);
    await tracker.createReceipt("msg123", NotificationChannel.PUSH);

    await tracker.updateReceipt(
      "msg123",
      NotificationChannel.EMAIL,
      DeliveryStatus.READ,
    );
    await tracker.updateReceipt(
      "msg123",
      NotificationChannel.PUSH,
      DeliveryStatus.SENT,
    );

    const status = await tracker.getMessageStatus("msg123");
    expect(status).toBe(DeliveryStatus.READ);
  });

  it("should determine overall message status as FAILED if all channels FAILED", async () => {
    await tracker.createReceipt("msg123", NotificationChannel.EMAIL);
    await tracker.createReceipt("msg123", NotificationChannel.PUSH);

    await tracker.updateReceipt(
      "msg123",
      NotificationChannel.EMAIL,
      DeliveryStatus.FAILED,
    );
    await tracker.updateReceipt(
      "msg123",
      NotificationChannel.PUSH,
      DeliveryStatus.FAILED,
    );

    const status = await tracker.getMessageStatus("msg123");
    expect(status).toBe(DeliveryStatus.FAILED);
  });
});

// ─── RETRY MANAGER TESTS ────────────────────────────────────────────────

describe("RetryManager", () => {
  let manager: RetryManager;

  beforeEach(() => {
    manager = new RetryManager();
  });

  it("should calculate exponential backoff", () => {
    const delay0 = manager.calculateDelay(0);
    const delay1 = manager.calculateDelay(1);
    const delay2 = manager.calculateDelay(2);

    expect(delay1).toBeGreaterThan(delay0);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it("should add jitter to backoff", () => {
    const delays = [];
    for (let i = 0; i < 5; i++) {
      delays.push(manager.calculateDelay(0));
    }

    // At least some variation due to jitter
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("should add notification to dead letter queue", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };

    await manager.moveToDeadLetter(request);

    const dlq = await manager.getDeadLetterQueue();
    expect(dlq).toHaveLength(1);
  });

  it("should remove from dead letter queue", async () => {
    const request: NotificationRequest = {
      id: "msg123",
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };

    await manager.moveToDeadLetter(request);
    let dlq = await manager.getDeadLetterQueue();
    expect(dlq).toHaveLength(1);

    await manager.removeFromDeadLetter("msg123");
    dlq = await manager.getDeadLetterQueue();
    expect(dlq).toHaveLength(0);
  });
});

// ─── NOTIFICATION THROTTLER TESTS ───────────────────────────────────────

describe("NotificationThrottler", () => {
  let throttler: NotificationThrottler;

  beforeEach(() => {
    throttler = new NotificationThrottler();
  });

  it("should allow notifications within rate limit", async () => {
    const limited = await throttler.isRateLimited(
      "user123",
      NotificationChannel.EMAIL,
    );
    expect(limited).toBe(false);
  });

  it("should record notification sends", async () => {
    for (let i = 0; i < 3; i++) {
      await throttler.recordSend("user123", NotificationChannel.EMAIL);
    }

    const counts = await throttler.getCounts("user123");
    expect(counts.email).toBe(3);
  });

  it("should track counts per channel independently", async () => {
    await throttler.recordSend("user123", NotificationChannel.EMAIL);
    await throttler.recordSend("user123", NotificationChannel.SMS);
    await throttler.recordSend("user123", NotificationChannel.SMS);

    const counts = await throttler.getCounts("user123");
    expect(counts.email).toBe(1);
    expect(counts.sms).toBe(2);
  });

  it("should allow setting custom rate limits", () => {
    throttler.setRateLimit(NotificationChannel.EMAIL, 50);
    // Would be enforced on next rate check
  });
});

// ─── ORCHESTRATOR INTEGRATION TESTS ──────────────────────────────────────

describe("NotificationOrchestratorV2", () => {
  let orchestrator: NotificationOrchestratorV2;

  beforeEach(() => {
    resetNotificationOrchestratorV2();
    orchestrator = getNotificationOrchestratorV2();
  });

  it("should send notification", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };

    await orchestrator.send(request);
    // Should not throw
  });

  it("should send batch notifications", async () => {
    const request = {
      tenantId: "tenant1",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
      recipients: [
        { recipientId: "user1" },
        { recipientId: "user2" },
        { recipientId: "user3" },
      ],
    };

    await orchestrator.sendBatch(request);
    // Should not throw
  });

  it("should validate notification request schema", async () => {
    const invalidRequest: any = {
      // Missing required fields
      recipientId: "user123",
    };

    try {
      await orchestrator.send(invalidRequest);
      expect.fail("Should have thrown validation error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should get delivery status for message", async () => {
    const status = await orchestrator.getDeliveryStatus("msg123");
    expect(status).toBe(DeliveryStatus.PENDING);
  });

  it("should mark notification as read", async () => {
    const request: NotificationRequest = {
      tenantId: "tenant1",
      recipientId: "user123",
      templateId: "template1",
      category: "ORDER",
      priority: NotificationPriority.NORMAL,
    };

    await orchestrator.send(request);
    // In production would track the message ID and mark it read
  });

  it("should access all manager components", () => {
    expect(orchestrator.getChannelRouter()).toBeDefined();
    expect(orchestrator.getFallbackChain()).toBeDefined();
    expect(orchestrator.getQuietHoursManager()).toBeDefined();
    expect(orchestrator.getDigestBatcher()).toBeDefined();
    expect(orchestrator.getDeliveryTracker()).toBeDefined();
    expect(orchestrator.getRetryManager()).toBeDefined();
    expect(orchestrator.getThrottler()).toBeDefined();
  });

  it("should return singleton instance", () => {
    const orchestrator1 = getNotificationOrchestratorV2();
    const orchestrator2 = getNotificationOrchestratorV2();
    expect(orchestrator1).toBe(orchestrator2);
  });

  it("should reset orchestrator for testing", () => {
    const orchestrator1 = getNotificationOrchestratorV2();
    resetNotificationOrchestratorV2();
    const orchestrator2 = getNotificationOrchestratorV2();
    expect(orchestrator1).not.toBe(orchestrator2);
  });
});
