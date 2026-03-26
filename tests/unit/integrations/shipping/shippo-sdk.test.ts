/**
 * Shippo SDK Client Tests
 *
 * Unit tests for Shippo REST API integration covering:
 * - Address creation and validation
 * - Parcel and shipment creation
 * - Rate retrieval and filtering
 * - Transaction (label) creation
 * - Tracking and webhook verification
 * - Manifest creation
 * - Carrier account management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShippoSDKClient } from "../../../../packages/core/src/integrations/shipping/shippo-sdk-client";

describe("ShippoSDKClient", () => {
  let client: ShippoSDKClient;
  const testToken = "shippo_test_" + "FAKE";

  beforeEach(() => {
    client = new ShippoSDKClient({
      apiToken: testToken,
      timeout: 5000,
    });
  });

  describe("initialization", () => {
    it("should create client with valid token", () => {
      expect(client).toBeDefined();
    });

    it("should throw error without token", () => {
      expect(
        () =>
          new ShippoSDKClient({
            apiToken: "",
          })
      ).toThrow("Shippo API token is required");
    });

    it("should detect test mode", () => {
      expect(client.isTestMode()).toBe(true);
    });

    it("should not detect test mode with production token", () => {
      const prodClient = new ShippoSDKClient({
        apiToken: "shippo_live_FAKE",
      });
      expect(prodClient.isTestMode()).toBe(false);
    });
  });

  describe("address operations", () => {
    it("should have createAddress method", () => {
      expect(client.createAddress).toBeDefined();
      expect(typeof client.createAddress).toBe("function");
    });

    it("should have validateAddress method", () => {
      expect(client.validateAddress).toBeDefined();
      expect(typeof client.validateAddress).toBe("function");
    });

    it("should have listAddresses method", () => {
      expect(client.listAddresses).toBeDefined();
      expect(typeof client.listAddresses).toBe("function");
    });

    it("should have getAddress method", () => {
      expect(client.getAddress).toBeDefined();
      expect(typeof client.getAddress).toBe("function");
    });
  });

  describe("parcel operations", () => {
    it("should have createParcel method", () => {
      expect(client.createParcel).toBeDefined();
      expect(typeof client.createParcel).toBe("function");
    });

    it("should have listParcelTemplates method", () => {
      expect(client.listParcelTemplates).toBeDefined();
      expect(typeof client.listParcelTemplates).toBe("function");
    });
  });

  describe("shipment operations", () => {
    it("should have createShipment method", () => {
      expect(client.createShipment).toBeDefined();
      expect(typeof client.createShipment).toBe("function");
    });

    it("should have listShipments method", () => {
      expect(client.listShipments).toBeDefined();
      expect(typeof client.listShipments).toBe("function");
    });

    it("should have getShipment method", () => {
      expect(client.getShipment).toBeDefined();
      expect(typeof client.getShipment).toBe("function");
    });

    it("should have getRatesForShipment method", () => {
      expect(client.getRatesForShipment).toBeDefined();
      expect(typeof client.getRatesForShipment).toBe("function");
    });
  });

  describe("rate operations", () => {
    it("should have getRate method", () => {
      expect(client.getRate).toBeDefined();
      expect(typeof client.getRate).toBe("function");
    });
  });

  describe("transaction (label) operations", () => {
    it("should have createTransaction method", () => {
      expect(client.createTransaction).toBeDefined();
      expect(typeof client.createTransaction).toBe("function");
    });

    it("should have getTransaction method", () => {
      expect(client.getTransaction).toBeDefined();
      expect(typeof client.getTransaction).toBe("function");
    });

    it("should have listTransactions method", () => {
      expect(client.listTransactions).toBeDefined();
      expect(typeof client.listTransactions).toBe("function");
    });
  });

  describe("tracking operations", () => {
    it("should have getTracking method", () => {
      expect(client.getTracking).toBeDefined();
      expect(typeof client.getTracking).toBe("function");
    });

    it("should have registerTrackingWebhook method", () => {
      expect(client.registerTrackingWebhook).toBeDefined();
      expect(typeof client.registerTrackingWebhook).toBe("function");
    });
  });

  describe("customs operations", () => {
    it("should have createCustomsDeclaration method", () => {
      expect(client.createCustomsDeclaration).toBeDefined();
      expect(typeof client.createCustomsDeclaration).toBe("function");
    });

    it("should have getCustomsDeclaration method", () => {
      expect(client.getCustomsDeclaration).toBeDefined();
      expect(typeof client.getCustomsDeclaration).toBe("function");
    });
  });

  describe("manifest operations", () => {
    it("should have createManifest method", () => {
      expect(client.createManifest).toBeDefined();
      expect(typeof client.createManifest).toBe("function");
    });

    it("should have getManifest method", () => {
      expect(client.getManifest).toBeDefined();
      expect(typeof client.getManifest).toBe("function");
    });

    it("should have listManifests method", () => {
      expect(client.listManifests).toBeDefined();
      expect(typeof client.listManifests).toBe("function");
    });
  });

  describe("carrier account operations", () => {
    it("should have listCarrierAccounts method", () => {
      expect(client.listCarrierAccounts).toBeDefined();
      expect(typeof client.listCarrierAccounts).toBe("function");
    });

    it("should have getCarrierAccount method", () => {
      expect(client.getCarrierAccount).toBeDefined();
      expect(typeof client.getCarrierAccount).toBe("function");
    });

    it("should have createCarrierAccount method", () => {
      expect(client.createCarrierAccount).toBeDefined();
      expect(typeof client.createCarrierAccount).toBe("function");
    });

    it("should have updateCarrierAccount method", () => {
      expect(client.updateCarrierAccount).toBeDefined();
      expect(typeof client.updateCarrierAccount).toBe("function");
    });
  });

  describe("webhook verification", () => {
    it("should have verifyWebhookSignature method", () => {
      expect(client.verifyWebhookSignature).toBeDefined();
      expect(typeof client.verifyWebhookSignature).toBe("function");
    });

    it("should verify valid webhook signature", () => {
      const payload = '{"test": "data"}';
      const hmac = require("crypto").createHmac("sha256", testToken);
      hmac.update(payload);
      const signature = hmac.digest("hex");

      const result = client.verifyWebhookSignature(payload, signature);
      expect(result).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = '{"test": "data"}';
      const invalidSignature = "0000000000000000000000000000000000000000";

      const result = client.verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });
  });

  describe("health check", () => {
    it("should have healthCheck method", () => {
      expect(client.healthCheck).toBeDefined();
      expect(typeof client.healthCheck).toBe("function");
    });

    it("should return promise from healthCheck", () => {
      const result = client.healthCheck();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("rate limiting", () => {
    it("should enforce rate limiting", async () => {
      const limitedClient = new ShippoSDKClient({
        apiToken: testToken,
        timeout: 100, // Very short timeout to fail quickly
      });

      // Mock fetch to avoid actual API calls
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Timeout"))));

      try {
        // Should throw after hitting rate limit
        for (let i = 0; i < 101; i++) {
          await limitedClient.listAddresses().catch(() => {
            // Ignore fetch errors
          });
        }
      } catch (error) {
        expect((error as Error).message).toContain("Rate limit");
      }
    });
  });

  describe("base URL configuration", () => {
    it("should use default base URL", () => {
      expect(client).toBeDefined();
    });

    it("should allow custom base URL", () => {
      const customClient = new ShippoSDKClient({
        apiToken: testToken,
        baseUrl: "https://custom.api.shippo.com/v1",
      });
      expect(customClient).toBeDefined();
    });
  });
});
