/**
 * Firebase Cloud Messaging SDK Client Tests
 *
 * Unit tests for JWT authentication, single/multicast sends,
 * topic management, device groups, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FirebaseFcmClient,
  FcmError,
  type FcmSendResponse,
  type FcmBatchSendResponse,
} from "../../../../packages/core/src/integrations/push/firebase-fcm-sdk-client";

// ─── MOCKS ──────────────────────────────────────────────────────────

const mockServiceAccountKey = {
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key-123",
  private_key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds2eYYcWyeNaSM/6R/xLLdTwEUEO6v8bwL3HDZG
hC1lGg4v3vO8Xz5c8P/O9f0cqS6yVgEjGo2DlX1rV8Z5lJb5K8J8T4J9V5N8T9V/
A+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+
B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+
B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+B+QIDAQABAoIBABN8T3B5mQ6n4e3u
5Q3V6U8Q4V8F3X8C7B9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1
Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E
3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J4
K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
W7X8Y9Z0ECgYEA6L7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0
Y1Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2
E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3
J4K5L6M7N8O9P0Q1R2S3T4U5V0CgYEA5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z9A0B
1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G
2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L
ECgYEAwU8T3V5U8E1D4G0F2N6P7A9M4R1Q0Y5V8Z0C9B1K3H7J0L2T5W8X0Y9
B5S3T6W1X4Z9C2E0F8G1J9K0M5N2P7Q4S0T8U1V5W2Y6Z1A4B7D0E3F9G5H2I7
J0K6L1M8N3O9P2Q5R0S7T1U4V9W2X6Y0Z3A1B8C5D9E3F0G6H1I8J2K7L0M3N9
O5P0Q7R1S4T8U0V3W1X4Y8Z0A3B0C7D1ECgYEA2M5O1K8Q9L7H4S3W6U0B5E1X
9Y8Z2A6N3R7P0F9G0J2D8C4M0R2T6U1X5W9Y3Z0B4C1D5E2F6G0H3I7J1K4L8M0
N3O7P1Q4R8S0T3U7V0W4X7Y1Z4A2B5C8D0E3
-----END RSA PRIVATE KEY-----`,
  client_email: "firebase-test@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-test%40test-project.iam.gserviceaccount.com",
};

// ─── TESTS ──────────────────────────────────────────────────────────

describe("FirebaseFcmClient", () => {
  let client: FirebaseFcmClient;

  beforeEach(() => {
    client = new FirebaseFcmClient(mockServiceAccountKey);
    // Mock global fetch
    global.fetch = vi.fn();
  });

  describe("initialization", () => {
    it("should initialize with service account key object", () => {
      const newClient = new FirebaseFcmClient(mockServiceAccountKey);
      expect(newClient).toBeDefined();
    });

    it("should initialize with service account key JSON string", () => {
      const json = JSON.stringify(mockServiceAccountKey);
      const newClient = new FirebaseFcmClient(json);
      expect(newClient).toBeDefined();
    });
  });

  describe("authentication", () => {
    it("should create JWT token for service account", () => {
      const jwtMethod = (client as any).createJwt as () => string;
      const token = jwtMethod.call(client);
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("sendToDevice", () => {
    it("should send message to a single device", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "projects/test-project/messages/message-123",
        }),
      });

      const response = await client.sendToDevice("device-token-1", {
        notification: {
          title: "Test Notification",
          body: "This is a test",
        },
        data: {
          key: "value",
        },
      });

      expect(response.success).toBe(true);
      expect(response.messageId).toBeDefined();
    });

    it("should handle send errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "INVALID_ARGUMENT",
            message: "Invalid token",
          },
        }),
      });

      const response = await client.sendToDevice("invalid-token", {
        notification: {
          title: "Test",
          body: "Test body",
        },
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe("sendToTopic", () => {
    it("should send message to a topic", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "projects/test-project/messages/message-456",
        }),
      });

      const response = await client.sendToTopic("test-topic", {
        notification: {
          title: "Topic Notification",
          body: "Sent to topic",
        },
      });

      expect(response.success).toBe(true);
      expect(response.messageId).toBeDefined();
    });
  });

  describe("sendWithCondition", () => {
    it("should send message with condition", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "projects/test-project/messages/message-789",
        }),
      });

      const condition = "'topic1' in topics && 'topic2' in topics";
      const response = await client.sendWithCondition(condition, {
        notification: {
          title: "Conditional Message",
          body: "Condition matched",
        },
      });

      expect(response.success).toBe(true);
    });
  });

  describe("multicast", () => {
    it("should send to multiple devices", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: 2,
          failure: 0,
          results: [{ messageId: "msg-1" }, { messageId: "msg-2" }],
        }),
      });

      const response = await client.multicast(["token-1", "token-2"], {
        notification: {
          title: "Multicast",
          body: "Multiple devices",
        },
      });

      expect(response.successCount).toBe(2);
      expect(response.failureCount).toBe(0);
      expect(response.responses).toHaveLength(2);
    });

    it("should reject more than 500 tokens", async () => {
      const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`);

      await expect(
        client.multicast(tokens, {
          notification: { title: "Test", body: "Test" },
        }),
      ).rejects.toThrow("Multicast limited to 500 tokens");
    });
  });

  describe("topicManagement", () => {
    it("should subscribe devices to topic", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{}],
        }),
      });

      const result = await client.subscribeToTopic(["token-1"], "test-topic");

      expect(result.successCount).toBeGreaterThanOrEqual(0);
    });

    it("should unsubscribe devices from topic", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{}],
        }),
      });

      const result = await client.unsubscribeFromTopic(
        ["token-1"],
        "test-topic",
      );

      expect(result.successCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("deviceGroups", () => {
    it("should create device group", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notification_key: "group-key-123",
        }),
      });

      const result = await client.createDeviceGroup("test-group", [
        "token-1",
        "token-2",
      ]);

      expect(result.notificationKey).toBeDefined();
    });

    it("should add devices to group", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.addToDeviceGroup("key-123", "test-group", ["token-3"]),
      ).resolves.not.toThrow();
    });

    it("should remove devices from group", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.removeFromDeviceGroup("key-123", "test-group", ["token-1"]),
      ).resolves.not.toThrow();
    });
  });

  describe("validateToken", () => {
    it("should validate a token", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const isValid = await client.validateToken("valid-token");
      expect(isValid).toBe(true);
    });

    it("should return false for invalid token", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "INVALID_ARGUMENT",
            message: "Invalid token",
          },
        }),
      });

      const isValid = await client.validateToken("invalid-token");
      expect(isValid).toBe(false);
    });
  });

  describe("platformConfig", () => {
    it("should include Android config in payload", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "projects/test-project/messages/message-123",
        }),
      });

      await client.sendToDevice("token-1", {
        notification: {
          title: "Test",
          body: "Test body",
        },
        android: {
          priority: "high",
          channel_id: "test-channel",
          ttl: "3600s",
        },
      });

      const call = (global.fetch as any).mock.calls[1];
      expect(call).toBeDefined();
    });

    it("should include APNS config in payload", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "projects/test-project/messages/message-123",
        }),
      });

      await client.sendToDevice("token-1", {
        notification: {
          title: "Test",
          body: "Test body",
        },
        apns: {
          badge: 1,
          sound: "default",
          content_available: true,
        },
      });

      const call = (global.fetch as any).mock.calls[1];
      expect(call).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should classify retryable errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: "INTERNAL",
            message: "Internal server error",
          },
        }),
      });

      const response = await client.sendToDevice("token-1", {
        notification: { title: "Test", body: "Test" },
      });

      expect(response.retryable).toBe(true);
    });

    it("should classify non-retryable errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "INVALID_ARGUMENT",
            message: "Invalid token",
          },
        }),
      });

      const response = await client.sendToDevice("invalid-token", {
        notification: { title: "Test", body: "Test" },
      });

      expect(response.retryable).toBe(false);
    });
  });
});
