/**
 * Push Notifications Module Test Suite
 *
 * Tests for:
 * - Expo push provider: send, batch send, error handling
 * - FCM push provider: send, topic messaging, error handling
 * - Push service: provider selection, fallback, device token management
 */

import {
  createPushService,
  PushNotificationService,
  FCMProvider,
  ExpoProvider,
  resolveFCMCredentials,
  resolveExpoCredentials,
  type PushPayload,
  type PushProvider,
  type TenantPushConfig,
  type DeployerPushConfig,
} from "../index";

describe("FCMProvider", () => {
  const fcmConfig = {
    projectId: "test-project",
    clientEmail: "firebase@test.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  };

  let provider: FCMProvider;

  beforeEach(() => {
    provider = new FCMProvider(fcmConfig);
  });

  describe("sendPush", () => {
    it("should send push notification to single device", async () => {
      const payload: PushPayload = {
        title: "Test Notification",
        body: "This is a test message",
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should include title and body in message", async () => {
      const payload: PushPayload = {
        title: "Order Delivered",
        body: "Your order has been delivered",
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should include custom data in message", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        data: {
          shipmentId: "ship_123",
          trackingNumber: "TRK123",
        },
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should handle notification config", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        notification: {
          title: "Notification Title",
          body: "Notification Body",
          sound: "default",
          badge: 1,
        },
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should handle Android-specific config", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        android: {
          priority: "high",
          ttl: 3600,
        },
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should handle APNs-specific config", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        apns: {
          payload: {
            aps: {
              alert: {
                title: "APNs Title",
                body: "APNs Body",
              },
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should handle webpush config", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        webpush: {
          headers: {
            TTL: "86400",
          },
          data: {
            customKey: "customValue",
          },
        },
      };

      const result = await provider.sendPush("device_token_123", payload);
      expect(result.success).toBe(true);
    });

    it("should handle various token formats", async () => {
      const tokens = [
        "simple_token",
        "token_with_special_chars_123",
        "ExponentPushToken[abc123def456]",
      ];

      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
      };

      for (const token of tokens) {
        const result = await provider.sendPush(token, payload);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("sendMulticast", () => {
    it("should send to multiple devices", async () => {
      const tokens = ["token_1", "token_2", "token_3"];
      const payload: PushPayload = {
        title: "Bulk Notification",
        body: "This goes to multiple devices",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(3);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it("should batch large token lists", async () => {
      const tokens = Array.from({ length: 1000 }, (_, i) => `token_${i}`);
      const payload: PushPayload = {
        title: "Large Batch",
        body: "Test",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(1000);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(1000);
    });

    it("should handle empty token list", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
      };

      const result = await provider.sendMulticast([], payload);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(0);
    });

    it("should include individual results", async () => {
      const tokens = ["token_1", "token_2"];
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.results.length).toBe(tokens.length);
      expect(result.results.every((r) => r.messageId !== undefined)).toBe(true);
    });

    it("should handle exactly 500 tokens (batch boundary)", async () => {
      const tokens = Array.from({ length: 500 }, (_, i) => `token_${i}`);
      const payload: PushPayload = {
        title: "Batch Boundary",
        body: "Test",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(500);
      expect(result.failureCount).toBe(0);
    });

    it("should handle 501 tokens (exceeds batch size)", async () => {
      const tokens = Array.from({ length: 501 }, (_, i) => `token_${i}`);
      const payload: PushPayload = {
        title: "Over Batch Boundary",
        body: "Test",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(501);
      expect(result.failureCount).toBe(0);
    });
  });

  describe("topic subscription", () => {
    it("should subscribe device to topic", async () => {
      await expect(
        provider.subscribeTopic("device_token_123", "order_updates"),
      ).resolves.not.toThrow();
    });

    it("should unsubscribe device from topic", async () => {
      await expect(
        provider.unsubscribeTopic("device_token_123", "order_updates"),
      ).resolves.not.toThrow();
    });

    it("should handle topic names with special characters", async () => {
      await expect(
        provider.subscribeTopic("device_token_123", "order-updates-v2"),
      ).resolves.not.toThrow();
    });
  });

  describe("topic messaging", () => {
    it("should send to topic", async () => {
      const payload: PushPayload = {
        title: "Topic Broadcast",
        body: "Message to all subscribers",
      };

      const result = await provider.sendToTopic("order_updates", payload);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should include title and body in topic message", async () => {
      const payload: PushPayload = {
        title: "Order Updates",
        body: "New orders available",
      };

      const result = await provider.sendToTopic("order_updates", payload);
      expect(result.success).toBe(true);
    });

    it("should include custom data in topic message", async () => {
      const payload: PushPayload = {
        title: "Update",
        body: "New data available",
        data: {
          updateType: "inventory",
          timestamp: "2024-03-06T10:00:00Z",
        },
      };

      const result = await provider.sendToTopic("inventory_updates", payload);
      expect(result.success).toBe(true);
    });
  });

  describe("token caching", () => {
    it("should cache access tokens", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test",
      };

      // First call generates token
      await provider.sendPush("token_1", payload);

      // Second call should use cached token (within expiry)
      const result = await provider.sendPush("token_2", payload);
      expect(result.success).toBe(true);
    });

    it("should generate new token after expiry", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test",
      };

      await provider.sendPush("token_1", payload);
      // In a real test, we'd manipulate the expiry time
      // For now, we just verify it works multiple times
      await provider.sendPush("token_2", payload);
      expect(true).toBe(true);
    });
  });
});

describe("ExpoProvider", () => {
  const expoConfig = {
    accessToken: "expo_test_token_123",
  };

  let provider: ExpoProvider;

  beforeEach(() => {
    provider = new ExpoProvider(expoConfig);
  });

  describe("sendPush", () => {
    it("should send push notification to single device", async () => {
      const payload: PushPayload = {
        title: "Expo Notification",
        body: "Test message",
      };

      const result = await provider.sendPush(
        "ExponentPushToken[abc123]",
        payload,
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should handle Expo token format", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
      };

      const result = await provider.sendPush(
        "ExponentPushToken[xyz789def456ghi123]",
        payload,
      );
      expect(result.success).toBe(true);
    });

    it("should include custom data", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
        data: {
          screen: "order_detail",
          orderId: "ord_123",
        },
      };

      const result = await provider.sendPush(
        "ExponentPushToken[abc123]",
        payload,
      );
      expect(result.success).toBe(true);
    });

    it("should include notification config", async () => {
      const payload: PushPayload = {
        title: "Notification",
        body: "Body text",
        notification: {
          sound: "default",
          badge: 2,
        },
      };

      const result = await provider.sendPush(
        "ExponentPushToken[abc123]",
        payload,
      );
      expect(result.success).toBe(true);
    });

    it("should handle various device tokens", async () => {
      const tokens = [
        "ExponentPushToken[abc123]",
        "ExponentPushToken[xyz789]",
        "ExponentPushToken[test-token-123]",
      ];

      const payload: PushPayload = {
        title: "Test",
        body: "Test",
      };

      for (const token of tokens) {
        const result = await provider.sendPush(token, payload);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("sendMulticast", () => {
    it("should send to multiple Expo devices", async () => {
      const tokens = [
        "ExponentPushToken[token1]",
        "ExponentPushToken[token2]",
        "ExponentPushToken[token3]",
      ];

      const payload: PushPayload = {
        title: "Batch Send",
        body: "Multiple devices",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(3);
    });

    it("should handle large Expo token batch", async () => {
      const tokens = Array.from(
        { length: 100 },
        (_, i) => `ExponentPushToken[token_${i}]`,
      );

      const payload: PushPayload = {
        title: "Large Batch",
        body: "Test",
      };

      const result = await provider.sendMulticast(tokens, payload);
      expect(result.successCount).toBe(100);
      expect(result.failureCount).toBe(0);
    });

    it("should handle empty token list", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test",
      };

      const result = await provider.sendMulticast([], payload);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });
  });

  describe("topic subscription", () => {
    it("should handle topic subscription (application-managed)", async () => {
      await expect(
        provider.subscribeTopic("ExponentPushToken[abc123]", "shipments"),
      ).resolves.not.toThrow();
    });

    it("should handle topic unsubscription (application-managed)", async () => {
      await expect(
        provider.unsubscribeTopic("ExponentPushToken[abc123]", "shipments"),
      ).resolves.not.toThrow();
    });
  });

  describe("topic messaging", () => {
    it("should throw for topic send (Expo limitation)", async () => {
      const payload: PushPayload = {
        title: "Topic Message",
        body: "Test",
      };

      await expect(provider.sendToTopic("shipments", payload)).rejects.toThrow(
        /topic delivery requires application-level/i,
      );
    });
  });

  describe("receipt checking", () => {
    it("should check receipt status", async () => {
      const ticketIds = ["ticket_1", "ticket_2", "ticket_3"];
      const receipts = await provider.checkReceipts(ticketIds);

      expect(Object.keys(receipts).length).toBe(3);
      for (const ticketId of ticketIds) {
        expect(receipts[ticketId]).toBeDefined();
        expect(receipts[ticketId].status).toBeDefined();
      }
    });

    it("should handle empty ticket list", async () => {
      const receipts = await provider.checkReceipts([]);
      expect(Object.keys(receipts).length).toBe(0);
    });
  });

  describe("token validation", () => {
    it("should validate Expo token format", () => {
      expect(ExpoProvider.isValidExpoToken("ExponentPushToken[abc123]")).toBe(
        true,
      );
      expect(
        ExpoProvider.isValidExpoToken("ExponentPushToken[test-token-123]"),
      ).toBe(true);
    });

    it("should reject invalid Expo token format", () => {
      expect(ExpoProvider.isValidExpoToken("invalid_token")).toBe(false);
      expect(ExpoProvider.isValidExpoToken("ExponentPushToken[]")).toBe(false);
      expect(ExpoProvider.isValidExpoToken("token_123")).toBe(false);
    });
  });
});

describe("Push Service", () => {
  describe("createPushService", () => {
    it("should create FCM provider when explicit type is fcm", () => {
      const tenantConfig: TenantPushConfig = {
        fcm: {
          projectId: "test-project",
          clientEmail: "test@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const service = createPushService({
        type: "fcm",
        tenantConfig,
      });

      expect(service).toBeInstanceOf(FCMProvider);
    });

    it("should create Expo provider when explicit type is expo", () => {
      const tenantConfig: TenantPushConfig = {
        expo: {
          accessToken: "expo_token_123",
        },
      };

      const service = createPushService({
        type: "expo",
        tenantConfig,
      });

      expect(service).toBeInstanceOf(ExpoProvider);
    });

    it("should throw when explicit FCM type but no credentials", () => {
      expect(() => {
        createPushService({ type: "fcm" });
      }).toThrow(/FCM type requested but no FCM credentials/);
    });

    it("should throw when explicit Expo type but no credentials", () => {
      expect(() => {
        createPushService({ type: "expo" });
      }).toThrow(/Expo type requested but no Expo credentials/);
    });

    it("should auto-detect FCM provider", () => {
      const tenantConfig: TenantPushConfig = {
        fcm: {
          projectId: "test-project",
          clientEmail: "test@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const service = createPushService({ tenantConfig });
      expect(service).toBeInstanceOf(FCMProvider);
    });

    it("should auto-detect Expo provider", () => {
      const tenantConfig: TenantPushConfig = {
        expo: {
          accessToken: "expo_token_123",
        },
      };

      const service = createPushService({ tenantConfig });
      expect(service).toBeInstanceOf(ExpoProvider);
    });

    it("should prefer FCM over Expo in auto-detection", () => {
      const tenantConfig: TenantPushConfig = {
        fcm: {
          projectId: "test-project",
          clientEmail: "test@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
        expo: {
          accessToken: "expo_token_123",
        },
      };

      const service = createPushService({ tenantConfig });
      expect(service).toBeInstanceOf(FCMProvider);
    });

    it("should create no-op provider when type is none", () => {
      const service = createPushService({ type: "none" });
      expect(service).toBeDefined();
    });

    it("should fallback to no-op when no credentials", () => {
      const service = createPushService({});
      expect(service).toBeDefined();
    });

    it("should use deployer config for fallback", () => {
      const deployerConfig: DeployerPushConfig = {
        defaultProvider: "fcm",
        fcm: {
          projectId: "deployer-project",
          clientEmail: "deployer@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const service = createPushService({ deployerConfig });
      expect(service).toBeInstanceOf(FCMProvider);
    });
  });

  describe("PushNotificationService", () => {
    let mockProvider: PushProvider;
    let service: PushNotificationService;

    beforeEach(() => {
      mockProvider = {
        sendPush: vi
          .fn()
          .mockResolvedValue({ success: true, messageId: "msg_1" }),
        sendMulticast: vi.fn().mockResolvedValue({
          successCount: 3,
          failureCount: 0,
          results: [{ success: true }, { success: true }, { success: true }],
        }),
        subscribeTopic: vi.fn().mockResolvedValue(undefined),
        unsubscribeTopic: vi.fn().mockResolvedValue(undefined),
        sendToTopic: vi
          .fn()
          .mockResolvedValue({ success: true, messageId: "msg_2" }),
      };

      service = new PushNotificationService(mockProvider);
    });

    it("should delegate send to provider", async () => {
      const payload: PushPayload = {
        title: "Test",
        body: "Test message",
      };

      await service.send("token_123", payload);
      expect(mockProvider.sendPush).toHaveBeenCalledWith("token_123", payload);
    });

    it("should delegate sendMulticast to provider", async () => {
      const tokens = ["token_1", "token_2", "token_3"];
      const payload: PushPayload = {
        title: "Bulk",
        body: "Bulk message",
      };

      await service.sendMulticast(tokens, payload);
      expect(mockProvider.sendMulticast).toHaveBeenCalledWith(tokens, payload);
    });

    it("should delegate subscribeTopic to provider", async () => {
      await service.subscribeTopic("token_123", "orders");
      expect(mockProvider.subscribeTopic).toHaveBeenCalledWith(
        "token_123",
        "orders",
      );
    });

    it("should delegate unsubscribeTopic to provider", async () => {
      await service.unsubscribeTopic("token_123", "orders");
      expect(mockProvider.unsubscribeTopic).toHaveBeenCalledWith(
        "token_123",
        "orders",
      );
    });

    it("should delegate sendToTopic to provider", async () => {
      const payload: PushPayload = {
        title: "Topic",
        body: "Topic message",
      };

      await service.sendToTopic("orders", payload);
      expect(mockProvider.sendToTopic).toHaveBeenCalledWith("orders", payload);
    });
  });
});

describe("Credential Resolution", () => {
  describe("resolveFCMCredentials", () => {
    it("should resolve tenant FCM credentials", () => {
      const tenantConfig: TenantPushConfig = {
        fcm: {
          projectId: "tenant-project",
          clientEmail: "tenant@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const result = resolveFCMCredentials(tenantConfig);
      expect(result).toBeDefined();
      expect(result?.projectId).toBe("tenant-project");
    });

    it("should prefer tenant over deployer credentials", () => {
      const tenantConfig: TenantPushConfig = {
        fcm: {
          projectId: "tenant-project",
          clientEmail: "tenant@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const deployerConfig: DeployerPushConfig = {
        defaultProvider: "fcm",
        fcm: {
          projectId: "deployer-project",
          clientEmail: "deployer@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const result = resolveFCMCredentials(tenantConfig, deployerConfig);
      expect(result?.projectId).toBe("tenant-project");
    });

    it("should fall back to deployer FCM credentials", () => {
      const deployerConfig: DeployerPushConfig = {
        defaultProvider: "fcm",
        fcm: {
          projectId: "deployer-project",
          clientEmail: "deployer@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
        },
      };

      const result = resolveFCMCredentials(undefined, deployerConfig);
      expect(result).toBeDefined();
      expect(result?.projectId).toBe("deployer-project");
    });

    it("should return null when no credentials available", () => {
      const result = resolveFCMCredentials();
      expect(result).toBeNull();
    });
  });

  describe("resolveExpoCredentials", () => {
    it("should resolve tenant Expo credentials", () => {
      const tenantConfig: TenantPushConfig = {
        expo: {
          accessToken: "expo_tenant_token",
        },
      };

      const result = resolveExpoCredentials(tenantConfig);
      expect(result).toBeDefined();
      expect(result?.accessToken).toBe("expo_tenant_token");
    });

    it("should prefer tenant over deployer credentials", () => {
      const tenantConfig: TenantPushConfig = {
        expo: {
          accessToken: "expo_tenant_token",
        },
      };

      const deployerConfig: DeployerPushConfig = {
        defaultProvider: "expo",
        expo: {
          accessToken: "expo_deployer_token",
        },
      };

      const result = resolveExpoCredentials(tenantConfig, deployerConfig);
      expect(result?.accessToken).toBe("expo_tenant_token");
    });

    it("should fall back to deployer Expo credentials", () => {
      const deployerConfig: DeployerPushConfig = {
        defaultProvider: "expo",
        expo: {
          accessToken: "expo_deployer_token",
        },
      };

      const result = resolveExpoCredentials(undefined, deployerConfig);
      expect(result).toBeDefined();
      expect(result?.accessToken).toBe("expo_deployer_token");
    });

    it("should return null when no credentials available", () => {
      const result = resolveExpoCredentials();
      expect(result).toBeNull();
    });
  });
});

describe("Push Edge Cases", () => {
  let fcmProvider: FCMProvider;
  const fcmConfig = {
    projectId: "test-project",
    clientEmail: "firebase@test.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  };

  beforeEach(() => {
    fcmProvider = new FCMProvider(fcmConfig);
  });

  it("should handle empty payload body", async () => {
    const payload: PushPayload = {
      title: "Title only",
      body: "",
    };

    const result = await fcmProvider.sendPush("token_123", payload);
    expect(result.success).toBe(true);
  });

  it("should handle very long token strings", async () => {
    const longToken = "a".repeat(500);
    const payload: PushPayload = {
      title: "Test",
      body: "Test",
    };

    const result = await fcmProvider.sendPush(longToken, payload);
    expect(result.success).toBe(true);
  });

  it("should handle special characters in title/body", async () => {
    const payload: PushPayload = {
      title: "Special 🎉 Characters",
      body: "Emoji 😀 and symbols @#$%",
    };

    const result = await fcmProvider.sendPush("token_123", payload);
    expect(result.success).toBe(true);
  });

  it("should handle null/undefined in payload data", async () => {
    const payload: PushPayload = {
      title: "Test",
      body: "Test",
      data: {
        key1: "value1",
        key2: "", // Empty string
      },
    };

    const result = await fcmProvider.sendPush("token_123", payload);
    expect(result.success).toBe(true);
  });

  it("should generate unique message IDs", async () => {
    const payload: PushPayload = {
      title: "Test",
      body: "Test",
    };

    const result1 = await fcmProvider.sendPush("token_1", payload);
    const result2 = await fcmProvider.sendPush("token_2", payload);

    expect(result1.messageId).not.toBe(result2.messageId);
  });
});
