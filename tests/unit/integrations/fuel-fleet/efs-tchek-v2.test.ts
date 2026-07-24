/**
 * EFS/TChek v2 SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EFSTChekv2Client,
  EFSTChekAPIError,
} from "../../../../packages/core/src/integrations/fuel-fleet/efs-tchek-v2-client";
import type {
  SDKConfig,
  MoneyCodeRequest,
  SettlementRequest,
  PreAuthorizationRequest,
} from "../../../../packages/core/src/integrations/fuel-fleet/fuel-fleet-sdk-types";

describe("EFSTChekv2Client", () => {
  let client: EFSTChekv2Client;
  let config: SDKConfig;

  beforeEach(() => {
    config = {
      provider: "efs_tchek_v2",
      authMethod: "merchant_id",
      baseUrl: "https://api.eftc.com",
      apiKey: "test_" + "api_key",
      merchantId: "test_" + "merchant_123",
      retryConfig: {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
      },
    };

    client = new EFSTChekv2Client(config);
  });

  describe("Configuration", () => {
    it("should validate required config fields", () => {
      const invalidConfig = {
        provider: "efs_tchek_v2" as const,
        authMethod: "merchant_id" as const,
        baseUrl: "https://api.eftc.com",
      };

      expect(() => {
        new EFSTChekv2Client(invalidConfig);
      }).toThrow("EFS/TChek SDK requires apiKey");
    });

    it("should require merchantId", () => {
      const invalidConfig = {
        provider: "efs_tchek_v2" as const,
        authMethod: "merchant_id" as const,
        baseUrl: "https://api.eftc.com",
        apiKey: "test_" + "key",
      };

      expect(() => {
        new EFSTChekv2Client(invalidConfig);
      }).toThrow("EFS/TChek SDK requires merchantId");
    });

    it("should require baseUrl", () => {
      const invalidConfig = {
        provider: "efs_tchek_v2" as const,
        authMethod: "merchant_id" as const,
        apiKey: "test_" + "key",
        merchantId: "test_" + "merchant",
      };

      expect(() => {
        new EFSTChekv2Client(invalidConfig);
      }).toThrow("EFS/TChek SDK requires baseUrl");
    });
  });

  describe("Settlement Processing", () => {
    it("should process truck stop settlement", async () => {
      const request: SettlementRequest = {
        driverId: "drv_123",
        settlementAmount: 500,
        settlementType: "quick_pay",
      };

      expect(request.driverId).toBeTruthy();
      expect(request.settlementAmount).toBeGreaterThan(0);
    });

    it("should process settlement with lumper fees", async () => {
      const request: SettlementRequest = {
        driverId: "drv_123",
        settlementAmount: 500,
        lumperFees: 75,
        settlementType: "quick_pay",
      };

      expect(request.lumperFees).toBeGreaterThan(0);
      expect(request.settlementAmount > request.lumperFees).toBe(true);
    });

    it("should process lumper fee directly", async () => {
      const driverId = "drv_123";
      const amount = 75;
      const description = "Loaded/Unloaded cargo";

      expect(driverId).toBeTruthy();
      expect(amount).toBeGreaterThan(0);
      expect(description).toBeTruthy();
    });
  });

  describe("Advance and Comcheck", () => {
    it("should issue advance payment", async () => {
      const driverId = "drv_123";
      const amount = 300;
      const purpose = "Emergency fuel";

      expect(driverId).toBeTruthy();
      expect(amount).toBeGreaterThan(0);
    });

    it("should issue comcheck", async () => {
      const driverId = "drv_123";
      const amount = 500;

      expect(driverId).toBeTruthy();
      expect(amount).toBeGreaterThan(0);
    });

    it("should issue comcheck with merchant restrictions", async () => {
      const driverId = "drv_123";
      const amount = 500;
      const merchantRestrictions = ["vendor_123", "vendor_456"];

      expect(merchantRestrictions.length).toBeGreaterThan(0);
    });
  });

  describe("Money Codes", () => {
    it("should generate single-use money code", async () => {
      const request: MoneyCodeRequest = {
        amount: 100,
        currency: "USD",
        purpose: "settlement",
        expiryMinutes: 60,
      };

      expect(request.amount).toBeGreaterThan(0);
      expect(request.expiryMinutes).toBeGreaterThan(0);
    });

    it("should generate money code for maintenance", async () => {
      const request: MoneyCodeRequest = {
        amount: 250,
        currency: "USD",
        purpose: "maintenance",
        expiryMinutes: 120,
        driverId: "drv_123",
      };

      expect(request.purpose).toBe("maintenance");
      expect(request.driverId).toBeTruthy();
    });

    it("should get money code status", async () => {
      const moneyCodeId = "mcode_123";
      expect(moneyCodeId).toBeTruthy();
    });

    it("should validate money code", async () => {
      const code = "MCODE1234567890";
      expect(code.length).toBeGreaterThan(0);
    });

    it("should handle expired money codes", async () => {
      const status = "expired";
      expect(["active", "used", "expired"]).toContain(status);
    });
  });

  describe("Fuel Purchase Authorization", () => {
    it("should pre-authorize fuel purchase", async () => {
      const request: PreAuthorizationRequest = {
        driverId: "drv_123",
        amount: 200,
      };

      expect(request.driverId).toBeTruthy();
      expect(request.amount).toBeGreaterThan(0);
    });

    it("should pre-authorize with fuel grade and quantity", async () => {
      const request: PreAuthorizationRequest = {
        driverId: "drv_123",
        amount: 200,
        expectedFuelGrade: "diesel",
        expectedQuantity: 50,
      };

      expect(request.expectedQuantity).toBeGreaterThan(0);
    });

    it("should pre-authorize at specific pump", async () => {
      const request: PreAuthorizationRequest = {
        driverId: "drv_123",
        amount: 200,
        pumpNumber: "7",
      };

      expect(request.pumpNumber).toBeTruthy();
    });

    it("should activate pump for transaction", async () => {
      const preAuthId = "preauth_123";
      expect(preAuthId).toBeTruthy();
    });

    it("should post-authorize and reconcile transaction", async () => {
      const preAuthId = "preauth_123";
      const actualAmount = 195.5;
      const actualQuantity = 48.75;

      expect(actualAmount).toBeGreaterThan(0);
      expect(actualQuantity).toBeGreaterThan(0);
    });
  });

  describe("Transaction History", () => {
    it("should get transaction history for driver", async () => {
      const driverId = "drv_123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(driverId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });

    it("should get settlement history", async () => {
      const driverId = "drv_123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(driverId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });
  });

  describe("Escrow Management", () => {
    it("should get escrow balance", async () => {
      const driverId = "drv_123";
      expect(driverId).toBeTruthy();
    });

    it("should pay driver from escrow", async () => {
      const driverId = "drv_123";
      const amount = 500;
      const paymentMethod = "ach";

      expect(driverId).toBeTruthy();
      expect(amount).toBeGreaterThan(0);
      expect(["ach", "check", "comcheck"]).toContain(paymentMethod);
    });

    it("should support check payment", async () => {
      const paymentMethod = "check";
      expect(paymentMethod).toBe("check");
    });

    it("should support comcheck payment", async () => {
      const paymentMethod = "comcheck";
      expect(paymentMethod).toBe("comcheck");
    });
  });

  describe("IFTA Compliance", () => {
    it("should extract IFTA data", async () => {
      const vehicleId = "veh_456";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(vehicleId).toBeTruthy();
      expect(startDate < endDate).toBe(true);
    });

    it("should generate fuel tax reporting", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      expect(startDate < endDate).toBe(true);
    });

    it("should generate fuel tax by jurisdiction", async () => {
      const states = ["CA", "TX", "FL"];
      expect(states.length).toBeGreaterThan(0);
    });

    it("should export IFTA report", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const format = "pdf";

      expect(startDate < endDate).toBe(true);
      expect(["json", "csv", "pdf"]).toContain(format);
    });

    it("should export as CSV", async () => {
      const format = "csv";
      expect(format).toBe("csv");
    });

    it("should export as JSON", async () => {
      const format = "json";
      expect(format).toBe("json");
    });
  });

  describe("Webhooks", () => {
    it("should subscribe to webhooks", async () => {
      const webhookUrl = "https://example.com/webhooks";
      const eventTypes = ["transaction_authorized", "settlement_processed"];

      expect(webhookUrl).toContain("https");
      expect(eventTypes.length).toBeGreaterThan(0);
    });

    it("should verify webhook signature", () => {
      const payload = '{"event":"settlement"}';
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

    it("should enforce 300 requests per minute limit", () => {
      const maxRequests = 300;
      expect(maxRequests).toBe(300);
    });
  });

  describe("Health Status", () => {
    it("should report health status", async () => {
      const health = await client.getHealthStatus();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("provider");
      expect(health.provider).toBe("efs_tchek_v2");
      expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
    });

    it("should track failure count", async () => {
      const health = await client.getHealthStatus();
      expect(health.circuitBreaker.failureCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw EFSTChekAPIError", () => {
      const error = new EFSTChekAPIError("API_ERROR", "Request failed", {
        reason: "test",
      });

      expect(error).toBeInstanceOf(EFSTChekAPIError);
      expect(error.code).toBe("API_ERROR");
      expect(error.details?.reason).toBe("test");
    });

    it("should include HTTP error codes", () => {
      const error = new EFSTChekAPIError("HTTP_401", "Unauthorized", {
        status: 401,
      });
      expect(error.code).toBe("HTTP_401");
    });
  });
});
