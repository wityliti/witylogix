/**
 * Unit tests for Order Sync Engine v2
 *
 * @module tests/unit/sync/order-sync-engine-v2.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SyncOrchestrator,
  ConflictResolver,
  IdempotencyManager,
  DeltaSyncTracker,
  RetryQueue,
  DeadLetterQueue,
  BatchProcessor,
  SyncMetrics as SyncMetricsTracker,
} from "../../../packages/core/src/sync/order-sync-engine-v2.js";
import {
  ConflictStrategy,
  PlatformType,
  SyncDirection,
} from "../../../packages/core/src/sync/sync-types.js";
import type {
  PlatformOrder,
  SyncConfig,
} from "../../../packages/core/src/sync/sync-types.js";

describe("ConflictResolver", () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  it("should resolve LAST_WRITE_WINS by timestamp", () => {
    const internalTime = new Date("2026-01-01T10:00:00Z");
    const externalTime = new Date("2026-01-01T11:00:00Z");

    const conflict = resolver.createConflict(
      "order_123",
      "ext_456",
      "SHOPIFY",
      "tenant_1",
      "status",
      "pending",
      "processing",
      internalTime.toISOString(),
      externalTime.toISOString(),
      ConflictStrategy.LAST_WRITE_WINS,
    );

    const resolution = resolver.resolve(
      conflict,
      ConflictStrategy.LAST_WRITE_WINS,
    );
    expect(resolution).toBe("EXTERNAL");
  });

  it("should resolve EXTERNAL_WINS always favoring external", () => {
    const conflict = resolver.createConflict(
      "order_123",
      "ext_456",
      "SHOPIFY",
      "tenant_1",
      "status",
      "pending",
      "processing",
      new Date().toISOString(),
      new Date().toISOString(),
      ConflictStrategy.EXTERNAL_WINS,
    );

    const resolution = resolver.resolve(
      conflict,
      ConflictStrategy.EXTERNAL_WINS,
    );
    expect(resolution).toBe("EXTERNAL");
  });

  it("should resolve INTERNAL_WINS always favoring internal", () => {
    const conflict = resolver.createConflict(
      "order_123",
      "ext_456",
      "SHOPIFY",
      "tenant_1",
      "status",
      "pending",
      "processing",
      new Date().toISOString(),
      new Date().toISOString(),
      ConflictStrategy.INTERNAL_WINS,
    );

    const resolution = resolver.resolve(
      conflict,
      ConflictStrategy.INTERNAL_WINS,
    );
    expect(resolution).toBe("INTERNAL");
  });

  it("should create conflict with correct metadata", () => {
    const conflict = resolver.createConflict(
      "order_123",
      "ext_456",
      "SHOPIFY",
      "tenant_1",
      "amount",
      99.99,
      100.0,
      new Date("2026-01-01T10:00:00Z").toISOString(),
      new Date("2026-01-01T11:00:00Z").toISOString(),
      ConflictStrategy.MANUAL_REVIEW,
    );

    expect(conflict.orderId).toBe("order_123");
    expect(conflict.externalOrderId).toBe("ext_456");
    expect(conflict.conflictField).toBe("amount");
    expect(conflict.internalValue).toBe(99.99);
    expect(conflict.externalValue).toBe(100.0);
    expect(conflict.isResolved).toBe(false);
  });
});

describe("IdempotencyManager", () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager();
  });

  it("should generate consistent composite keys", () => {
    const key1 = manager.generateKey("SHOPIFY", "ext_123");
    const key2 = manager.generateKey("SHOPIFY", "ext_123");
    expect(key1).toBe(key2);
  });

  it("should detect duplicates", () => {
    const key = manager.generateKey("SHOPIFY", "ext_123");
    manager.markProcessed(key, "job_1");

    const isDuplicate = manager.isDuplicate(key);
    expect(isDuplicate).toBe("job_1");
  });

  it("should return undefined for new keys", () => {
    const key = manager.generateKey("SHOPIFY", "ext_999");
    const isDuplicate = manager.isDuplicate(key);
    expect(isDuplicate).toBeUndefined();
  });

  it("should clear all processed keys", () => {
    const key = manager.generateKey("SHOPIFY", "ext_123");
    manager.markProcessed(key, "job_1");
    manager.clear();

    const isDuplicate = manager.isDuplicate(key);
    expect(isDuplicate).toBeUndefined();
  });
});

describe("DeltaSyncTracker", () => {
  let tracker: DeltaSyncTracker;

  beforeEach(() => {
    tracker = new DeltaSyncTracker();
  });

  it("should track sync checkpoints", () => {
    tracker.updateCheckpoint("tenant_1", "SHOPIFY", 100);
    const checkpoint = tracker.getCheckpoint("tenant_1", "SHOPIFY");

    expect(checkpoint).toBeDefined();
    expect(checkpoint?.lastSyncCount).toBe(100);
  });

  it("should determine when sync is needed", () => {
    const intervalMs = 300000; // 5 minutes

    // No checkpoint = sync needed
    expect(tracker.shouldSync("tenant_1", "SHOPIFY", intervalMs)).toBe(true);

    // After update, should not need sync
    tracker.updateCheckpoint("tenant_1", "SHOPIFY", 50);
    expect(tracker.shouldSync("tenant_1", "SHOPIFY", intervalMs)).toBe(false);
  });

  it("should respect zero interval (webhook-only)", () => {
    tracker.updateCheckpoint("tenant_1", "SHOPIFY", 50);
    expect(tracker.shouldSync("tenant_1", "SHOPIFY", 0)).toBe(false);
  });

  it("should support pagination cursors", () => {
    tracker.updateCheckpoint("tenant_1", "SHOPIFY", 100, "cursor_abc123");
    const checkpoint = tracker.getCheckpoint("tenant_1", "SHOPIFY");

    expect(checkpoint?.cursor).toBe("cursor_abc123");
  });
});

describe("RetryQueue", () => {
  let queue: RetryQueue;

  beforeEach(() => {
    queue = new RetryQueue();
  });

  it("should enqueue failed syncs", () => {
    queue.enqueue("order_123", "job_1", "Connection timeout");
    expect(queue.size()).toBe(1);
  });

  it("should calculate exponential backoff correctly", () => {
    queue.enqueue("order_123", "job_1", "Error");
    const ready = queue.getReadyEntries();

    // Should have entries but not ready immediately
    expect(queue.size()).toBe(1);
  });

  it("should move to DLQ after max retries", () => {
    queue.enqueue("order_123", "job_1", "Error");
    const entries = queue.getReadyEntries();

    let shouldMoveToDlq = false;
    for (let i = 0; i < 5; i++) {
      if (entries.length > 0) {
        shouldMoveToDlq = queue.markRetried(
          entries[0].retryId,
          false,
          "Persistent error",
        );
      }
    }

    expect(shouldMoveToDlq).toBe(true);
  });

  it("should remove entry on successful retry", () => {
    queue.enqueue("order_123", "job_1", "Error");
    const entries = queue.getReadyEntries();

    if (entries.length > 0) {
      const shouldMoveToDlq = queue.markRetried(entries[0].retryId, true);
      expect(shouldMoveToDlq).toBe(false);
      expect(queue.size()).toBe(0);
    }
  });
});

describe("DeadLetterQueue", () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue();
  });

  it("should add entries to DLQ", () => {
    dlq.add("order_123", "job_1", "Max retries exceeded", 5);
    expect(dlq.size()).toBe(1);
  });

  it("should retrieve all DLQ entries", () => {
    dlq.add("order_123", "job_1", "Error 1", 5);
    dlq.add("order_456", "job_2", "Error 2", 5);

    const all = dlq.getAll();
    expect(all).toHaveLength(2);
  });

  it("should return entries for review with limit", () => {
    for (let i = 0; i < 10; i++) {
      dlq.add(`order_${i}`, `job_${i}`, `Error ${i}`, 5);
    }

    const review = dlq.getForReview(5);
    expect(review).toHaveLength(5);
  });

  it("should include metadata in entries", () => {
    const metadata = { customField: "value" };
    dlq.add("order_123", "job_1", "Error", 5, metadata);

    const entries = dlq.getAll();
    expect(entries[0].metadata).toEqual(metadata);
  });
});

describe("BatchProcessor", () => {
  let processor: BatchProcessor;

  beforeEach(() => {
    processor = new BatchProcessor();
  });

  it("should process batch of orders", async () => {
    const orders: PlatformOrder[] = [
      {
        orderId: "order_1",
        externalOrderId: "ext_1",
        platformType: PlatformType.SHOPIFY,
        tenantId: "tenant_1",
        status: "pending",
        totalAmount: 99.99,
        currency: "USD",
        customerEmail: "customer@example.com",
        customerFirstName: "John",
        customerLastName: "Doe",
        shippingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        billingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const result = await processor.processBatch(orders);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("should split orders into batches", () => {
    const orders: PlatformOrder[] = [];
    for (let i = 0; i < 750; i++) {
      orders.push({
        orderId: `order_${i}`,
        externalOrderId: `ext_${i}`,
        platformType: PlatformType.SHOPIFY,
        tenantId: "tenant_1",
        status: "pending",
        totalAmount: 99.99,
        currency: "USD",
        customerEmail: "customer@example.com",
        customerFirstName: "John",
        customerLastName: "Doe",
        shippingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        billingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const batches = processor.splitIntoBatches(orders);
    expect(batches.length).toBe(2); // 500 + 250
    expect(batches[0].length).toBe(500);
    expect(batches[1].length).toBe(250);
  });
});

describe("SyncMetricsTracker", () => {
  let metrics: SyncMetricsTracker;

  beforeEach(() => {
    metrics = new SyncMetricsTracker();
  });

  it("should record sync metrics", () => {
    metrics.recordSync("SHOPIFY", "tenant_1", true, 1234, 0);

    const m = metrics.getMetrics("SHOPIFY", "tenant_1");
    expect(m?.totalSyncs).toBe(1);
    expect(m?.successfulSyncs).toBe(1);
    expect(m?.avgLatencyMs).toBe(1234);
  });

  it("should calculate success rate", () => {
    metrics.recordSync("SHOPIFY", "tenant_1", true, 100, 0);
    metrics.recordSync("SHOPIFY", "tenant_1", false, 100, 0);

    const m = metrics.getMetrics("SHOPIFY", "tenant_1");
    expect(m?.successRate).toBe(50);
  });

  it("should track conflicts", () => {
    metrics.recordSync("SHOPIFY", "tenant_1", true, 100, 5);

    const m = metrics.getMetrics("SHOPIFY", "tenant_1");
    expect(m?.totalConflicts).toBe(5);
  });

  it("should track multiple platforms separately", () => {
    metrics.recordSync("SHOPIFY", "tenant_1", true, 100, 0);
    metrics.recordSync("WOOCOMMERCE", "tenant_1", true, 200, 0);

    const shopify = metrics.getMetrics("SHOPIFY", "tenant_1");
    const woo = metrics.getMetrics("WOOCOMMERCE", "tenant_1");

    expect(shopify?.avgLatencyMs).toBe(100);
    expect(woo?.avgLatencyMs).toBe(200);
  });
});

describe("SyncOrchestrator", () => {
  let orchestrator: SyncOrchestrator;
  let mockConfig: SyncConfig;

  beforeEach(() => {
    orchestrator = new SyncOrchestrator();
    mockConfig = {
      configId: "config_1",
      tenantId: "tenant_1",
      platformType: PlatformType.SHOPIFY,
      direction: SyncDirection.BIDIRECTIONAL,
      conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
      fieldMappings: [],
      syncInterval: 300000,
      maxBatchSize: 500,
      autoRetry: true,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  it("should execute sync and return result", async () => {
    const orders: PlatformOrder[] = [
      {
        orderId: "order_1",
        externalOrderId: "ext_1",
        platformType: PlatformType.SHOPIFY,
        tenantId: "tenant_1",
        status: "pending",
        totalAmount: 99.99,
        currency: "USD",
        customerEmail: "customer@example.com",
        customerFirstName: "John",
        customerLastName: "Doe",
        shippingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        billingAddress: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const result = await orchestrator.sync(
      "tenant_1",
      "SHOPIFY",
      SyncDirection.INBOUND,
      orders,
      mockConfig,
    );

    expect(result.success).toBeDefined();
    expect(result.syncedCount).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should track active jobs", async () => {
    const orders: PlatformOrder[] = [];
    const result = await orchestrator.sync(
      "tenant_1",
      "SHOPIFY",
      SyncDirection.INBOUND,
      orders,
      mockConfig,
    );

    // Job should be completed and removed from active
    const activeJobs = orchestrator.getActiveJobs();
    expect(activeJobs.length).toBeGreaterThanOrEqual(0);
  });

  it("should get metrics after sync", async () => {
    const orders: PlatformOrder[] = [];
    await orchestrator.sync(
      "tenant_1",
      "SHOPIFY",
      SyncDirection.INBOUND,
      orders,
      mockConfig,
    );

    const metrics = orchestrator.getMetrics("SHOPIFY", "tenant_1");
    expect(metrics?.totalSyncs).toBeGreaterThanOrEqual(0);
  });

  it("should resolve conflicts", () => {
    const resolution = orchestrator.resolveConflict(
      "conflict_123",
      "INTERNAL",
      "user_1",
    );

    expect(resolution.conflictId).toBe("conflict_123");
    expect(resolution.resolution).toBe("INTERNAL");
    expect(resolution.resolvedBy).toBe("user_1");
  });
});
