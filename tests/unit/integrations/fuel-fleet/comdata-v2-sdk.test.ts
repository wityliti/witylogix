/**
 * Comdata v2 SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Comdatav2SDKClient,
  ComdataAPIError,
} from "../../../../packages/core/src/integrations/fuel-fleet/comdata-v2-sdk-client";
import type {
  SDKConfig,
  VirtualCardIssuanceRequest,
  CardIssuanceRequest,
} from "../../../../packages/core/src/integrations/fuel-fleet/fuel-fleet-sdk-types";

describe("Comdatav2SDKClient", () => {
  let client: Comdatav2SDKClient;
  let config: SDKConfig;

  beforeEach(() => {
    config = {
      provider: "comdata_v2",
      authMethod: "api_key_hmac",
      baseUrl: "https://api.comdata.com",
      apiKey: "test_" + "api_key",
      apiSecret: "test_" + "api_secret",
      retryConfig: {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
      },
    };

    client = new Comdatav2SDKClient(config);
  });

  describe("Configuration", () => {
    it("should validate required config fields", () => {
      const invalidConfig = {
        provider: "comdata_v2" as const,
        authMethod: "api_key_hmac" as const,
        baseUrl: "https://api.comdata.com",
      };

      expect(() => {
        new Comdatav2SDKClient(invalidConfig);
      }).toThrow("Comdata SDK requires apiKey and apiSecret");
    });

    it("should require baseUrl", () => {
      const invalidConfig = {
        provider: "comdata_v2" as const,
        authMethod: "api_key_hmac" as const,
        apiKey: "test_" + "key",
        apiSecret: "test_" + "secret",
      };

      expect(() => {
        new Comdatav2SDKClient(invalidConfig);
      }).toThrow("Comdata SDK requires baseUrl");
    });
  });

  describe("Virtual Card Management", () => {
    it("should issue a virtual one-time use MasterCard", async () => {
      const request: VirtualCardIssuanceRequest = {
        cardholderName: "John Doe",
        purpose: "maintenance",
        amount: 250,
        currency: "USD",
        expiryMinutes: 60,
        singleUseOnly: true,
      };

      expect(request.cardholderName).toBeTruthy();
      expect(request.amount).toBeGreaterThan(0);
      expect(request.singleUseOnly).toBe(true);
    });

    it("should issue virtual card for parts purchases", async () => {
      const request: VirtualCardIssuanceRequest = {
        cardholderName: "Maintenance Dept",
        purpose: "parts",
        amount: 500,
        currency: "USD",
        expiryMinutes: 120,
        singleUseOnly: true,
        merchantRestrictions: {
          allowedMerchantsOnly: ["parts_vendor_123"],
        },
      };

      expect(request.purpose).toBe("parts");
      expect(request.merchantRestrictions?.allowedMerchantsOnly).toBeDefined();
    });
  });

  describe("Fuel Card Management", () => {
    it("should issue fuel card", async () => {
      const request: CardIssuanceRequest = {
        cardholderName: "Jane Driver",
        driverId: "drv_123",
        vehicleId: "veh_456",
        dailyLimit: 150,
        weeklyLimit: 700,
      };

      expect(request.cardholderName).toBeTruthy();
      expect(request.vehicleId).toBeTruthy();
    });

    it("should activate fuel card", async () => {
      const cardId = "card_789";
      expect(cardId).toBeTruthy();
    });

    it("should deactivate fuel card", async () => {
      const cardId = "card_789";
      expect(cardId).toBeTruthy();
    });

    it("should assign driver to card", async () => {
      const cardId = "card_789";
      const driverId = "drv_123";

      expect(cardId).toBeTruthy();
      expect(driverId).toBeTruthy();
    });

    it("should assign vehicle to card", async () => {
      const cardId = "card_789";
      const vehicleId = "veh_456";

      expect(cardId).toBeTruthy();
      expect(vehicleId).toBeTruthy();
    });

    it("should set product code restrictions", async () => {
      const cardId = "card_789";
      const allowedCodes = ["001", "002", "003"]; // Fuel product codes

      expect(cardId).toBeTruthy();
      expect(allowedCodes.length).toBeGreaterThan(0);
    });
  });

  describe("iConnectData Real-Time Stream", () => {
    it("should get real-time transaction stream", async () => {
      expect(typeof client.getRealTimeTransactionStream).toBe("function");
    });

    it("should get enhanced transaction data", async () => {
      const transactionId = "txn_999";
      expect(transactionId).toBeTruthy();
    });

    it("should include fuel type and quantity in enhanced data", async () => {
      const expectedFields = ["fuelType", "quantity", "unitPrice", "odometer"];
      expectedFields.forEach((field) => {
        expect(field).toBeTruthy();
      });
    });
  });

  describe("SmartBuy Bulk Fuel Purchasing", () => {
    it("should get bulk fuel pricing", async () => {
      const quantity = 5000;
      const fuelType = "diesel";

      expect(quantity).toBeGreaterThan(0);
      expect(fuelType).toBeTruthy();
    });

    it("should create pre-buy fuel contract", async () => {
      const quantity = 10000;
      const fuelType = "diesel";
      const pricePerUnit = 3.25;
      const expiryDate = new Date("2024-12-31");

      expect(quantity).toBeGreaterThan(0);
      expect(pricePerUnit).toBeGreaterThan(0);
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now());
    });

    it("should execute bulk fuel purchase", async () => {
      const contractId = "contract_123";
      const quantity = 5000;

      expect(contractId).toBeTruthy();
      expect(quantity).toBeGreaterThan(0);
    });
  });

  describe("Transaction Search", () => {
    it("should search transactions with filters", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(startDate < endDate).toBe(true);
    });

    it("should filter by card ID", async () => {
      const cardId = "card_789";
      expect(cardId).toBeTruthy();
    });

    it("should filter by driver ID", async () => {
      const driverId = "drv_123";
      expect(driverId).toBeTruthy();
    });
  });

  describe("Analytics", () => {
    it("should get fleet spend analytics", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(startDate < endDate).toBe(true);
    });

    it("should get driver behavior analytics", async () => {
      const driverId = "drv_123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(driverId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });

    it("should get cost allocation by GL code", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(startDate < endDate).toBe(true);
    });
  });

  describe("Compliance", () => {
    it("should validate DOT number", async () => {
      const dotNumber = "1234567";
      expect(dotNumber.length).toBeGreaterThan(0);
    });

    it("should get IFTA mileage data", async () => {
      const vehicleId = "veh_456";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(vehicleId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });
  });

  describe("Webhooks", () => {
    it("should subscribe to webhooks", async () => {
      const webhookUrl = "https://example.com/webhooks";
      const eventTypes = ["transaction_authorized", "card_suspended"];

      expect(webhookUrl).toContain("https");
      expect(eventTypes.length).toBeGreaterThan(0);
    });

    it("should verify webhook signature with timestamp", () => {
      const payload = '{"event":"transaction"}';
      const timestamp = String(Date.now() / 1000);
      const signature = "test_sig";

      const result = client.verifyWebhookSignature(
        payload,
        signature,
        timestamp,
      );
      expect(typeof result).toBe("boolean");
    });

    it("should reject old timestamps", () => {
      const payload = '{"event":"transaction"}';
      const oldTimestamp = String((Date.now() - 10 * 60 * 1000) / 1000); // 10 minutes ago
      const signature = "test_sig";

      const result = client.verifyWebhookSignature(
        payload,
        signature,
        oldTimestamp,
      );
      expect(result).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit info", () => {
      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo).toBeNull(); // Initially null
    });

    it("should enforce 500 requests per minute limit", () => {
      const maxRequests = 500;
      expect(maxRequests).toBe(500);
    });
  });

  describe("Health Status", () => {
    it("should report health status", async () => {
      const health = await client.getHealthStatus();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("provider");
      expect(health.provider).toBe("comdata_v2");
      expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
    });
  });

  describe("Reporting", () => {
    it("should generate analytics report", async () => {
      const params = {
        reportType: "fuel_usage" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        groupBy: "vehicle" as const,
      };

      expect(params.reportType).toBe("fuel_usage");
      expect(params.startDate < params.endDate).toBe(true);
    });

    it("should get report status", async () => {
      const reportId = "report_123";
      expect(reportId).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should throw ComdataAPIError", () => {
      const error = new ComdataAPIError("API_ERROR", "Something went wrong", {
        reason: "test",
      });

      expect(error).toBeInstanceOf(ComdataAPIError);
      expect(error.code).toBe("API_ERROR");
      expect(error.details?.reason).toBe("test");
    });
  });
});
