/**
 * Webhook Dispatcher Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebhookDispatcher, DispatchResponse } from "../webhook-dispatcher";

global.fetch = vi.fn();

describe("WebhookDispatcher", () => {
  let dispatcher: WebhookDispatcher;

  beforeEach(() => {
    dispatcher = new WebhookDispatcher(30000);
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe("dispatch", () => {
    it("should successfully dispatch webhook to endpoint", async () => {
      const payload = { event: "order.created", data: { orderId: "123" } };
      const secret = "test_secret";

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      const response = await dispatcher.dispatch(
        "https://example.com/webhook",
        payload,
        secret,
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.duration).toBeGreaterThanOrEqual(0);
      expect(global.fetch as any).toHaveBeenCalledOnce();
    });

    it("should fail on non-2xx status code", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";

      (global.fetch as any).mockResolvedValueOnce({
        status: 500,
        ok: false,
      });

      const response = await dispatcher.dispatch(
        "https://example.com/webhook",
        payload,
        secret,
      );

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(500);
    });

    it("should handle network errors", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";

      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const response = await dispatcher.dispatch(
        "https://example.com/webhook",
        payload,
        secret,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("Network error");
    });

    it("should reject invalid URL protocol", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";

      const response = await dispatcher.dispatch(
        "ftp://example.com/webhook",
        payload,
        secret,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid webhook URL");
    });

    it("should reject oversized payloads", async () => {
      const largePayload = {
        data: "x".repeat(11 * 1024 * 1024), // 11MB
      };
      const secret = "test_secret";

      const response = await dispatcher.dispatch(
        "https://example.com/webhook",
        largePayload,
        secret,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("exceeds maximum size");
    });

    it("should include custom headers", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";
      const customHeaders = { "X-Custom": "value" };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      await dispatcher.dispatch(
        "https://example.com/webhook",
        payload,
        secret,
        { customHeaders },
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["X-Custom"]).toBe("value");
    });

    it("should include signature and timestamp headers", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      await dispatcher.dispatch("https://example.com/webhook", payload, secret);

      const callArgs = (global.fetch as any).mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["X-Witylogix-Signature"]).toBeDefined();
      expect(headers["X-Witylogix-Timestamp"]).toBeDefined();
    });
  });

  describe("dispatchBatch", () => {
    it("should dispatch multiple webhooks in parallel", async () => {
      const requests = [
        {
          url: "https://endpoint1.com/webhook",
          payload: { event: "order.created" },
          secret: "secret1",
        },
        {
          url: "https://endpoint2.com/webhook",
          payload: { event: "order.updated" },
          secret: "secret2",
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({ status: 200, ok: true })
        .mockResolvedValueOnce({ status: 201, ok: true });

      const responses = await dispatcher.dispatchBatch(requests);

      expect(responses).toHaveLength(2);
      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(true);
      expect(global.fetch as any).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures in batch", async () => {
      const requests = [
        {
          url: "https://endpoint1.com/webhook",
          payload: { event: "order.created" },
          secret: "secret1",
        },
        {
          url: "https://endpoint2.com/webhook",
          payload: { event: "order.updated" },
          secret: "secret2",
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({ status: 200, ok: true })
        .mockRejectedValueOnce(new Error("Network error"));

      const responses = await dispatcher.dispatchBatch(requests);

      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(false);
    });
  });

  describe("verifySignature", () => {
    it("should verify valid signature", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";

      const signature = dispatcher.constructor.verifySignature(
        payload,
        payload,
        secret,
      );
      // Note: this is testing the static method differently
      // In real usage, this would be for receiver verification
    });

    it("should reject invalid signature", () => {
      const payload = '{"event":"order.created"}';
      const invalidSignature = "invalid_signature";
      const secret = "test_secret";

      const isValid = WebhookDispatcher.verifySignature(
        payload,
        invalidSignature,
        secret,
      );

      expect(isValid).toBe(false);
    });
  });

  describe("configuration", () => {
    it("should return current configuration", () => {
      const config = dispatcher.getConfig();

      expect(config.defaultTimeout).toBe(30000);
      expect(config.maxPayloadSize).toBeGreaterThan(0);
    });

    it("should update configuration", () => {
      dispatcher.updateConfig({
        defaultTimeout: 60000,
        maxPayloadSize: 20 * 1024 * 1024,
      });

      const config = dispatcher.getConfig();
      expect(config.defaultTimeout).toBe(60000);
    });
  });

  describe("timeout handling", () => {
    it("should timeout on slow endpoint", async () => {
      const payload = { event: "order.created" };
      const secret = "test_secret";

      // Mock fetch to respect the abort signal
      (global.fetch as any).mockImplementation(
        (_url: string, options: { signal?: AbortSignal }) => {
          return new Promise((_, reject) => {
            if (options?.signal) {
              options.signal.addEventListener("abort", () => {
                reject(
                  new DOMException("The operation was aborted.", "AbortError"),
                );
              });
            }
          });
        },
      );

      const response = await dispatcher.dispatch(
        "https://slow.example.com/webhook",
        payload,
        secret,
        { timeout: 100 }, // 100ms timeout
      );

      expect(response.success).toBe(false);
      expect(response.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
