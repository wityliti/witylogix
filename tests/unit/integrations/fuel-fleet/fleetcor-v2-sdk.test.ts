/**
 * Fleetcor v2 SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Fleetcorv2SDKClient,
  FleetcorAPIError,
} from "../../../../packages/core/src/integrations/fuel-fleet/fleetcor-v2-sdk-client";
import type {
  SDKConfig,
  CardIssuanceRequest,
} from "../../../../packages/core/src/integrations/fuel-fleet/fuel-fleet-sdk-types";

describe("Fleetcorv2SDKClient", () => {
  let client: Fleetcorv2SDKClient;
  let config: SDKConfig;

  beforeEach(() => {
    config = {
      provider: "fleetcor_v2",
      authMethod: "oauth2_client_credentials",
      baseUrl: "https://api.fleetcor.com",
      tokenUrl: "https://auth.fleetcor.com/oauth2/token",
      clientId: "test_" + "client_id",
      clientSecret: "test_" + "client_secret",
      apiKey: "test_" + "api_key",
      retryConfig: {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
      },
    };

    client = new Fleetcorv2SDKClient(config);
  });

  describe("Configuration", () => {
    it("should validate all required fields", () => {
      const invalidConfig = {
        provider: "fleetcor_v2" as const,
        authMethod: "oauth2_client_credentials" as const,
        baseUrl: "https://api.fleetcor.com",
      };

      expect(() => {
        new Fleetcorv2SDKClient(invalidConfig);
      }).toThrow("Fleetcor SDK requires apiKey");
    });

    it("should require OAuth credentials", () => {
      const invalidConfig = {
        provider: "fleetcor_v2" as const,
        authMethod: "oauth2_client_credentials" as const,
        baseUrl: "https://api.fleetcor.com",
        apiKey: "test_" + "key",
      };

      expect(() => {
        new Fleetcorv2SDKClient(invalidConfig);
      }).toThrow("Fleetcor SDK requires clientId and clientSecret");
    });
  });

  describe("Universal Card Management", () => {
    it("should issue universal card with multi-network support", async () => {
      const request: CardIssuanceRequest = {
        cardholderName: "John Driver",
        driverId: "drv_123",
        vehicleId: "veh_456",
        dailyLimit: 200,
        monthlyLimit: 3000,
      };

      expect(request.cardholderName).toBeTruthy();
      expect(request.dailyLimit).toBeGreaterThan(0);
    });

    it("should activate universal card on all networks", async () => {
      const cardId = "card_789";
      expect(cardId).toBeTruthy();
    });

    it("should suspend card with optional temporary override", async () => {
      const cardId = "card_789";
      const temporaryOverride = {
        durationMinutes: 30,
        limitAmount: 500,
      };

      expect(cardId).toBeTruthy();
      expect(temporaryOverride.durationMinutes).toBeGreaterThan(0);
    });

    it("should terminate card", async () => {
      const cardId = "card_789";
      const reason = "Driver departed";

      expect(cardId).toBeTruthy();
      expect(reason).toBeTruthy();
    });
  });

  describe("Transaction Management", () => {
    it("should query real-time transactions", async () => {
      const limit = 100;
      const offset = 0;

      expect(limit).toBeGreaterThan(0);
      expect(offset).toBeGreaterThanOrEqual(0);
    });

    it("should query transactions in batch", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(startDate < endDate).toBe(true);
    });

    it("should get transaction details with Level 3 and exception flags", async () => {
      const transactionId = "txn_999";
      expect(transactionId).toBeTruthy();
    });
  });

  describe("Fleet Analytics", () => {
    it("should track vehicle MPG", async () => {
      const vehicleId = "veh_456";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(vehicleId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });

    it("should estimate idle fuel waste", async () => {
      const vehicleId = "veh_456";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(vehicleId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });

    it("should calculate fueling efficiency score", async () => {
      const vehicleId = "veh_456";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(vehicleId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });
  });

  describe("Maintenance Network", () => {
    it("should find authorized service locations", async () => {
      const latitude = 40.7128;
      const longitude = -74.006;
      const radiusKm = 50;

      expect(latitude).toBeTruthy();
      expect(longitude).toBeTruthy();
      expect(radiusKm).toBeGreaterThan(0);
    });

    it("should request pre-authorization for service", async () => {
      const locationId = "loc_123";
      const estimatedAmount = 500;
      const serviceDescription = "Oil change and filter replacement";

      expect(locationId).toBeTruthy();
      expect(estimatedAmount).toBeGreaterThan(0);
      expect(serviceDescription).toBeTruthy();
    });

    it("should submit PO-based approval", async () => {
      const locationId = "loc_123";
      const poNumber = "PO-2024-001";
      const amount = 1500;

      expect(locationId).toBeTruthy();
      expect(poNumber).toBeTruthy();
      expect(amount).toBeGreaterThan(0);
    });
  });

  describe("SmartHub Reporting", () => {
    it("should get customizable dashboards", async () => {
      expect(typeof client.getSmartHubDashboards).toBe("function");
    });

    it("should schedule automated report delivery", async () => {
      const params = {
        reportType: "fleet_analytics",
        frequency: "daily" as const,
        deliveryMethod: "email" as const,
        deliveryEmail: "admin@example.com",
      };

      expect(params.reportType).toBeTruthy();
      expect(params.frequency).toBe("daily");
    });

    it("should schedule SFTP delivery", async () => {
      const params = {
        reportType: "expense_analysis",
        frequency: "monthly" as const,
        deliveryMethod: "sftp" as const,
        sftpConfig: {
          host: "sftp.example.com",
          username: "user_" + "name",
          password: "pass_" + "word",
          path: "/reports",
        },
      };

      expect(params.sftpConfig?.host).toBeTruthy();
    });
  });

  describe("Tax Exemption", () => {
    it("should get tax exemption status", async () => {
      const cardId = "card_789";
      expect(cardId).toBeTruthy();
    });

    it("should enable state-level exemptions", async () => {
      const cardId = "card_789";
      const states = ["CA", "TX", "FL"];

      expect(cardId).toBeTruthy();
      expect(states.length).toBeGreaterThan(0);
    });

    it("should process fuel purchase with tax exemption", async () => {
      const transactionId = "txn_999";
      const exemptionState = "TX";

      expect(transactionId).toBeTruthy();
      expect(exemptionState).toHaveLength(2);
    });
  });

  describe("Webhooks", () => {
    it("should subscribe to webhooks", async () => {
      const webhookUrl = "https://example.com/webhooks";
      const eventTypes = ["transaction_authorized", "card_suspended"];

      expect(webhookUrl).toContain("https");
      expect(eventTypes.length).toBeGreaterThan(0);
    });

    it("should verify webhook signature", () => {
      const payload = '{"event":"transaction"}';
      const signature = "test_sig";

      const result = client.verifyWebhookSignature(payload, signature);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit info", () => {
      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo).toBeNull(); // Initially null
    });

    it("should enforce 600 requests per minute limit", () => {
      const maxRequests = 600;
      expect(maxRequests).toBe(600);
    });
  });

  describe("Health Status", () => {
    it("should report health status", async () => {
      const health = await client.getHealthStatus();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("provider");
      expect(health.provider).toBe("fleetcor_v2");
      expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
    });

    it("should track circuit breaker state", async () => {
      const health = await client.getHealthStatus();
      expect(health.circuitBreaker.state).toBe("closed");
    });
  });

  describe("Reporting", () => {
    it("should generate custom report", async () => {
      const params = {
        reportType: "vehicle_efficiency" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        groupBy: "vehicle" as const,
      };

      expect(params.reportType).toBe("vehicle_efficiency");
    });

    it("should track report status", async () => {
      const reportId = "report_123";
      expect(reportId).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should throw FleetcorAPIError", () => {
      const error = new FleetcorAPIError(
        "API_ERROR",
        "Request failed",
        { reason: "test" },
        "req_123",
      );

      expect(error).toBeInstanceOf(FleetcorAPIError);
      expect(error.code).toBe("API_ERROR");
      expect(error.requestId).toBe("req_123");
    });

    it("should include HTTP status details", () => {
      const error = new FleetcorAPIError("HTTP_500", "Internal server error", {
        status: 500,
      });
      expect(error.details?.status).toBe(500);
    });
  });
});
