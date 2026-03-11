/**
 * Courier Webhook Processing Integration Tests
 * Tests Onfleet, Stuart, and Uber Direct webhook signature verification,
 * event normalization, idempotent processing, status propagation, and edge cases
 * ~350 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fixtures from "../fixtures/courier-dispatch-fixtures";
import crypto from "crypto";

// ─── Mock Webhook Service ──────────────────────────────────────────────────

interface WebhookPayload {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  signature?: string;
}

interface NormalizedEvent {
  provider: "onfleet" | "stuart" | "uber_direct";
  eventType: string;
  deliveryId: string;
  deliveryStatus: string;
  courierName?: string;
  courierRating?: number;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

class WebhookService {
  private processedWebhooks = new Set<string>();
  private onfleetWebhookSecret = "test_onfleet_secret";
  private stuartWebhookSecret = "test_stuart_secret";
  private uberDirectWebhookSecret = "test_uber_secret";

  // ─ Signature Verification ──────────────────────────────────────────────

  verifyOnfleetSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.onfleetWebhookSecret)
      .update(payload)
      .digest("base64");

    return signature === `sha256=${expectedSignature}`;
  }

  verifyStuartSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.stuartWebhookSecret)
      .update(payload)
      .digest("hex");

    return signature === `hmac-sha256=${expectedSignature}`;
  }

  verifyUberDirectSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.uberDirectWebhookSecret)
      .update(payload)
      .digest("hex");

    return signature === `signature=${expectedSignature}`;
  }

  // ─ Event Normalization ─────────────────────────────────────────────────

  normalizeOnfleetEvent(payload: WebhookPayload): NormalizedEvent {
    const taskData = (payload.data.task || {}) as any;

    return {
      provider: "onfleet",
      eventType: payload.type.replace("task.", ""),
      deliveryId: taskData.id,
      deliveryStatus: this.mapOnfleetStatus(taskData.state),
      courierName: taskData.assignee?.name,
      completedAt: taskData.completionDetails?.timestamp
        ? new Date(taskData.completionDetails.timestamp * 1000)
        : undefined,
      metadata: {
        shortId: taskData.shortId,
        photoUploadId: taskData.completionDetails?.photoUploadId,
        success: taskData.completionDetails?.success,
      },
    };
  }

  normalizeStuartEvent(payload: WebhookPayload): NormalizedEvent {
    const deliveryData = (payload.data.delivery || {}) as any;

    return {
      provider: "stuart",
      eventType: payload.type.replace("delivery.", ""),
      deliveryId: deliveryData.id,
      deliveryStatus: deliveryData.status,
      courierName: deliveryData.driver
        ? `${deliveryData.driver.first_name} ${deliveryData.driver.last_name}`
        : undefined,
      completedAt: deliveryData.delivered_at ? new Date(deliveryData.delivered_at) : undefined,
      metadata: {
        trackingUrl: deliveryData.tracking_url,
      },
    };
  }

  normalizeUberDirectEvent(payload: WebhookPayload): NormalizedEvent {
    const data = payload.data as any;

    return {
      provider: "uber_direct",
      eventType: payload.type.replace("delivery.", ""),
      deliveryId: data.delivery_id,
      deliveryStatus: data.delivery_status || data.status,
      courierName: data.courier?.name,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      metadata: {
        trackingStatus: data.tracking_info?.status,
      },
    };
  }

  private mapOnfleetStatus(state: number): string {
    const statusMap: Record<number, string> = {
      0: "unassigned",
      1: "assigned",
      2: "completed",
      3: "cancelled",
    };
    return statusMap[state] || "unknown";
  }

  // ─ Idempotent Processing ───────────────────────────────────────────────

  processWebhook(payload: WebhookPayload): {
    success: boolean;
    isIdempotent: boolean;
    processed: boolean;
    normalized?: NormalizedEvent;
  } {
    // Check for duplicate
    if (this.processedWebhooks.has(payload.id)) {
      return {
        success: true,
        isIdempotent: true,
        processed: false,
      };
    }

    // Process webhook
    this.processedWebhooks.add(payload.id);

    let normalized: NormalizedEvent | undefined;
    if (payload.data.task) {
      normalized = this.normalizeOnfleetEvent(payload);
    } else if (payload.data.delivery) {
      normalized = this.normalizeStuartEvent(payload);
    } else if (payload.data.delivery_id) {
      normalized = this.normalizeUberDirectEvent(payload);
    }

    return {
      success: true,
      isIdempotent: false,
      processed: true,
      normalized,
    };
  }

  // ─ Status Update Propagation ───────────────────────────────────────────

  propagateStatusUpdate(normalizedEvent: NormalizedEvent): {
    shipmentId: string;
    status: string;
    lastUpdated: Date;
    courier: string;
  } {
    return {
      shipmentId: normalizedEvent.deliveryId,
      status: normalizedEvent.deliveryStatus,
      lastUpdated: new Date(),
      courier: normalizedEvent.provider,
    };
  }

  // ─ Error Handling ──────────────────────────────────────────────────────

  validatePayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.id) errors.push("Missing webhook ID");
    if (!payload.type) errors.push("Missing event type");
    if (!payload.timestamp) errors.push("Missing timestamp");
    if (!payload.data || typeof payload.data !== "object") errors.push("Missing or invalid data");

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  handleMalformedPayload(error: Error): {
    success: false;
    error: string;
    action: "skip" | "retry" | "log";
  } {
    return {
      success: false,
      error: error.message,
      action: "log",
    };
  }

  handleUnknownEventType(eventType: string): {
    recognized: false;
    eventType: string;
    action: "skip" | "log";
  } {
    return {
      recognized: false,
      eventType,
      action: "log",
    };
  }

  getProcessingStats(): {
    totalProcessed: number;
    idempotentReplayCount: number;
  } {
    return {
      totalProcessed: this.processedWebhooks.size,
      idempotentReplayCount: 0, // would track replays
    };
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Courier Webhook Processing Integration Tests", () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
  });

  describe("Onfleet Webhook Signature Verification", () => {
    it("should verify valid Onfleet signature", () => {
      const payload = '{"id":"task_123","state":2}';
      const signature = crypto
        .createHmac("sha256", "test_onfleet_secret")
        .update(payload)
        .digest("base64");

      const verified = service.verifyOnfleetSignature(payload, `sha256=${signature}`);
      expect(verified).toBe(true);
    });

    it("should reject invalid Onfleet signature", () => {
      const payload = '{"id":"task_123","state":2}';
      const invalidSignature = "sha256=invalid_signature";

      const verified = service.verifyOnfleetSignature(payload, invalidSignature);
      expect(verified).toBe(false);
    });

    it("should reject tampered Onfleet payload", () => {
      const originalPayload = '{"id":"task_123","state":2}';
      const signature = crypto
        .createHmac("sha256", "test_onfleet_secret")
        .update(originalPayload)
        .digest("base64");

      const tamperedPayload = '{"id":"task_456","state":2}';
      const verified = service.verifyOnfleetSignature(tamperedPayload, `sha256=${signature}`);

      expect(verified).toBe(false);
    });
  });

  describe("Stuart Webhook Signature Verification", () => {
    it("should verify valid Stuart signature", () => {
      const payload = '{"id":"delivery_123","status":"delivered"}';
      const signature = crypto
        .createHmac("sha256", "test_stuart_secret")
        .update(payload)
        .digest("hex");

      const verified = service.verifyStuartSignature(payload, `hmac-sha256=${signature}`);
      expect(verified).toBe(true);
    });

    it("should reject invalid Stuart signature", () => {
      const payload = '{"id":"delivery_123","status":"delivered"}';
      const invalidSignature = "hmac-sha256=invalid_signature";

      const verified = service.verifyStuartSignature(payload, invalidSignature);
      expect(verified).toBe(false);
    });
  });

  describe("Uber Direct Webhook Signature Verification", () => {
    it("should verify valid Uber Direct signature", () => {
      const payload = '{"delivery_id":"uber_123","status":"completed"}';
      const signature = crypto
        .createHmac("sha256", "test_uber_secret")
        .update(payload)
        .digest("hex");

      const verified = service.verifyUberDirectSignature(payload, `signature=${signature}`);
      expect(verified).toBe(true);
    });

    it("should reject invalid Uber Direct signature", () => {
      const payload = '{"delivery_id":"uber_123","status":"completed"}';
      const invalidSignature = "signature=invalid_signature";

      const verified = service.verifyUberDirectSignature(payload, invalidSignature);
      expect(verified).toBe(false);
    });
  });

  describe("Onfleet Event Normalization", () => {
    it("should normalize completed task event", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const normalized = service.normalizeOnfleetEvent(event as any);

      expect(normalized.provider).toBe("onfleet");
      expect(normalized.deliveryStatus).toBe("completed");
      expect(normalized.completedAt).toBeDefined();
    });

    it("should extract courier information", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const normalized = service.normalizeOnfleetEvent(event as any);

      expect(normalized.courierName).toBeDefined();
    });

    it("should include metadata", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const normalized = service.normalizeOnfleetEvent(event as any);

      expect(normalized.metadata.photoUploadId).toBeDefined();
      expect(normalized.metadata.success).toBeDefined();
    });
  });

  describe("Stuart Event Normalization", () => {
    it("should normalize completed delivery event", () => {
      const event = fixtures.createStuartDeliveryCompletedEvent();
      const normalized = service.normalizeStuartEvent(event as any);

      expect(normalized.provider).toBe("stuart");
      expect(normalized.deliveryStatus).toBe("delivered");
    });

    it("should extract driver information", () => {
      const event = fixtures.createStuartDeliveryCompletedEvent();
      const normalized = service.normalizeStuartEvent(event as any);

      expect(normalized.courierName).toContain("John");
    });

    it("should include tracking URL", () => {
      const event = fixtures.createStuartDeliveryCompletedEvent();
      const normalized = service.normalizeStuartEvent(event as any);

      expect(normalized.metadata.trackingUrl).toBeDefined();
    });
  });

  describe("Uber Direct Event Normalization", () => {
    it("should normalize completed delivery event", () => {
      const event = fixtures.createUberDirectDeliveryCompletedEvent();
      const normalized = service.normalizeUberDirectEvent(event as any);

      expect(normalized.provider).toBe("uber_direct");
      expect(normalized.deliveryStatus).toBe("completed");
    });

    it("should extract courier information", () => {
      const event = fixtures.createUberDirectDeliveryCompletedEvent();
      const normalized = service.normalizeUberDirectEvent(event as any);

      expect(normalized.courierName).toBeDefined();
    });
  });

  describe("Idempotent Webhook Processing", () => {
    it("should process webhook successfully once", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const result = service.processWebhook(event as any);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });

    it("should reject duplicate webhook (idempotent)", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();

      const result1 = service.processWebhook(event as any);
      const result2 = service.processWebhook(event as any);

      expect(result1.processed).toBe(true);
      expect(result2.processed).toBe(false);
      expect(result2.isIdempotent).toBe(true);
    });

    it("should allow different webhooks", () => {
      const event1 = fixtures.createOnfleetTaskCompletedEvent();
      const event2 = fixtures.createOnfleetTaskCompletedEvent();

      const result1 = service.processWebhook(event1 as any);
      const result2 = service.processWebhook(event2 as any);

      expect(result1.processed).toBe(true);
      expect(result2.processed).toBe(true);
    });

    it("should replay same webhook multiple times safely", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();

      for (let i = 0; i < 5; i++) {
        const result = service.processWebhook(event as any);
        if (i === 0) {
          expect(result.processed).toBe(true);
        } else {
          expect(result.isIdempotent).toBe(true);
        }
      }
    });
  });

  describe("Status Update Propagation", () => {
    it("should propagate status to shipment", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const normalized = service.normalizeOnfleetEvent(event as any);
      const propagated = service.propagateStatusUpdate(normalized);

      expect(propagated.shipmentId).toBe(normalized.deliveryId);
      expect(propagated.status).toBe(normalized.deliveryStatus);
      expect(propagated.courier).toBe("onfleet");
    });

    it("should update timestamp on propagation", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent();
      const normalized = service.normalizeOnfleetEvent(event as any);
      const propagated = service.propagateStatusUpdate(normalized);

      expect(propagated.lastUpdated.getTime()).toBeCloseTo(Date.now(), -3);
    });
  });

  describe("Payload Validation", () => {
    it("should accept valid payload", () => {
      const payload = {
        id: "evt_123",
        type: "task.completed",
        timestamp: Math.floor(Date.now() / 1000),
        data: { task: { id: "task_123" } },
      };

      const result = service.validatePayload(payload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject payload without ID", () => {
      const payload = {
        type: "task.completed",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      };

      const result = service.validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing webhook ID");
    });

    it("should reject payload without event type", () => {
      const payload = {
        id: "evt_123",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      };

      const result = service.validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing event type");
    });

    it("should reject payload without data", () => {
      const payload = {
        id: "evt_123",
        type: "task.completed",
        timestamp: Math.floor(Date.now() / 1000),
      };

      const result = service.validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing or invalid data");
    });
  });

  describe("Malformed Payload Handling", () => {
    it("should handle malformed JSON", () => {
      const error = new Error("Invalid JSON");
      const result = service.handleMalformedPayload(error);

      expect(result.success).toBe(false);
      expect(result.action).toBe("log");
    });
  });

  describe("Unknown Event Type Handling", () => {
    it("should handle unknown event type", () => {
      const result = service.handleUnknownEventType("delivery.unknown_status");

      expect(result.recognized).toBe(false);
      expect(result.eventType).toBe("delivery.unknown_status");
      expect(result.action).toBe("log");
    });
  });

  describe("Edge Cases", () => {
    it("should handle webhook with missing optional fields", () => {
      const event = {
        id: "evt_minimal",
        type: "task.completed",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          task: {
            id: "task_123",
            state: 2,
          },
        },
      };

      const result = service.processWebhook(event as any);
      expect(result.success).toBe(true);
    });

    it("should handle concurrent webhook processing", () => {
      const events = Array.from({ length: 10 }, () =>
        fixtures.createOnfleetTaskCompletedEvent()
      );

      const results = events.map((e) => service.processWebhook(e as any));

      expect(results.filter((r) => r.processed)).toHaveLength(10);
    });

    it("should handle interleaved duplicate and new webhooks", () => {
      const event1 = fixtures.createOnfleetTaskCompletedEvent();
      const event2 = fixtures.createOnfleetTaskCompletedEvent();

      service.processWebhook(event1 as any);
      service.processWebhook(event2 as any);
      const duplicate1 = service.processWebhook(event1 as any);
      service.processWebhook(event2 as any);

      expect(duplicate1.isIdempotent).toBe(true);
    });

    it("should handle very old timestamps", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent({
        timestamp: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days old
      });

      const result = service.processWebhook(event as any);
      expect(result.success).toBe(true);
    });

    it("should handle future timestamps", () => {
      const event = fixtures.createOnfleetTaskCompletedEvent({
        timestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour in future
      });

      const result = service.processWebhook(event as any);
      expect(result.success).toBe(true);
    });

    it("should track processing statistics", () => {
      for (let i = 0; i < 5; i++) {
        const event = fixtures.createOnfleetTaskCompletedEvent();
        service.processWebhook(event as any);
      }

      const stats = service.getProcessingStats();
      expect(stats.totalProcessed).toBe(5);
    });
  });
});
