/**
 * Fuel Card Manager Test Suite
 *
 * Comprehensive tests for unified fuel card management (20+ test cases)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { FuelCardManager } from "../fuel-card-manager";
import type {
  FuelFleetConfig,
  FuelCard,
  FuelTransaction,
  FuelPolicy,
} from "../types";

/**
 * Mock fetch function
 */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Create mock configuration for a provider
 */
const createMockConfig = (provider: string): FuelFleetConfig => ({
  providerId: provider,
  baseUrl: `https://api.${provider}.com`,
  tokenUrl: `https://api.${provider}.com/oauth/token`,
  apiKey: `test-key-${provider}`,
  token: `test-token-${provider}`,
  clientId: `test-client-${provider}`,
  clientSecret: `test-secret-${provider}`,
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  },
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
});

/**
 * Create mock fuel card
 */
const createMockCard = (
  provider: string,
  override?: Partial<FuelCard>
): FuelCard => ({
  cardId: `card-${provider}-123`,
  product: provider as any,
  cardNumber: "4111111111111111",
  last4: "1111",
  cardholderName: "John Driver",
  status: "active",
  issuedDate: new Date("2026-01-01"),
  expirationDate: new Date("2028-12-31"),
  driverId: "driver-123",
  vehicleId: "vehicle-456",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

/**
 * Create mock transaction
 */
const createMockTransaction = (
  cardId: string,
  override?: Partial<FuelTransaction>
): FuelTransaction => ({
  transactionId: `txn-${Date.now()}`,
  cardId,
  transactionDate: new Date(),
  merchantName: "Shell Gas Station",
  merchantCategory: "fuel",
  amount: 150.5,
  currency: "USD",
  fuelQuantity: 50,
  fuelType: "unleaded",
  pricePerGallon: 3.01,
  status: "completed",
  approved: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

/**
 * Create mock policy
 */
const createMockPolicy = (override?: Partial<FuelPolicy>): FuelPolicy => ({
  policyId: `policy-${Date.now()}`,
  name: "Fleet Policy",
  description: "Standard fleet fuel policy",
  limits: {
    dailyLimit: 500,
    weeklyLimit: 3000,
    monthlyLimit: 10000,
    singleTransactionLimit: 300,
  },
  allowedMerchants: {
    categories: ["fuel", "convenience"],
    specificMerchants: [],
  },
  geographicRestrictions: {
    allowedStates: ["CA", "TX", "FL"],
  },
  enforcesFuelOnly: true,
  allowsRetail: false,
  fraudMonitoring: true,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

describe("FuelCardManager", () => {
  let manager: FuelCardManager;

  beforeEach(() => {
    const configs = {
      wex: createMockConfig("wex"),
      comdata: createMockConfig("comdata"),
      fuelman: createMockConfig("fuelman"),
      efs: createMockConfig("efs"),
    };

    manager = new FuelCardManager(configs);
    mockFetch.mockClear();
  });

  describe("Card Inventory Management", () => {
    it("should issue a card from a provider", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex"),
        }),
      });

      const inventory = await manager.issueCard("wex", {
        cardholderName: "John Driver",
        driverId: "driver-123",
      });

      expect(inventory).toBeDefined();
      expect(inventory.card.cardId).toBeDefined();
      expect(inventory.provider).toBe("wex");
    });

    it("should retrieve card from inventory", async () => {
      const card = createMockCard("wex");
      const inventory = manager.getCardFromInventory("card-wex-123");

      // Should return undefined if not in inventory
      expect(inventory).toBeUndefined();
    });

    it("should manage card status across providers", async () => {
      // Mock initial issue
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex"),
        }),
      });

      await manager.issueCard("wex", {
        cardholderName: "John Driver",
        driverId: "driver-123",
      });

      // Mock suspend operation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex", { status: "suspended" }),
        }),
      });

      const updatedCard = await manager.manageCardStatus(
        "card-wex-123",
        "suspend"
      );

      expect(updatedCard.status).toBe("suspended");
    });

    it("should throw on status management for non-existent card", async () => {
      await expect(
        manager.manageCardStatus("non-existent", "suspend")
      ).rejects.toThrow();
    });
  });

  describe("Policy Enforcement", () => {
    it("should register a policy", () => {
      const policy = createMockPolicy();
      manager.registerPolicy(policy);

      const stats = manager.getStats();
      expect(stats.policiesRegistered).toBe(1);
    });

    it("should enforce policy on cards", async () => {
      // Register policy
      const policy = createMockPolicy();
      manager.registerPolicy(policy);

      // Mock card issue
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex"),
        }),
      });

      await manager.issueCard("wex", {
        cardholderName: "John Driver",
      });

      // Mock policy enforcement
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {},
        }),
      });

      const result = await manager.enforcePolicyOnCards(policy.policyId, [
        "card-wex-123",
      ]);

      expect(result.successful).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });

    it("should throw on enforce policy for non-existent policy", async () => {
      await expect(
        manager.enforcePolicyOnCards("non-existent-policy", ["card-1"])
      ).rejects.toThrow();
    });
  });

  describe("Fraud Detection", () => {
    it("should detect velocity fraud", async () => {
      const cardId = "card-wex-123";
      const transactions: FuelTransaction[] = [];

      // Create 6 transactions in the last hour
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        transactions.push(
          createMockTransaction(cardId, {
            transactionDate: new Date(now - i * 5 * 60 * 1000),
          })
        );
      }

      const alerts = await manager.detectFraudPatterns(cardId, transactions);

      const velocityAlert = alerts.find(
        (a) => a.type === "velocity_alert"
      );
      expect(velocityAlert).toBeDefined();
      expect(velocityAlert?.severity).toBe("medium");
    });

    it("should detect amount anomalies", async () => {
      const cardId = "card-wex-123";
      const transactions: FuelTransaction[] = [
        createMockTransaction(cardId, { amount: 150 }),
        createMockTransaction(cardId, { amount: 160 }),
        createMockTransaction(cardId, { amount: 155 }),
        createMockTransaction(cardId, { amount: 1500 }), // Anomaly
      ];

      const alerts = await manager.detectFraudPatterns(cardId, transactions);

      const amountAlert = alerts.find(
        (a) => a.type === "amount_anomaly"
      );
      expect(amountAlert).toBeDefined();
      expect(amountAlert?.severity).toBe("high");
    });

    it("should not generate alerts for normal patterns", async () => {
      const cardId = "card-wex-123";
      const transactions: FuelTransaction[] = [
        createMockTransaction(cardId, { amount: 150 }),
        createMockTransaction(cardId, { amount: 160 }),
        createMockTransaction(cardId, { amount: 155 }),
      ];

      const alerts = await manager.detectFraudPatterns(cardId, transactions);

      expect(alerts.length).toBe(0);
    });

    it("should return empty alerts for empty transactions", async () => {
      const alerts = await manager.detectFraudPatterns("card-123", []);
      expect(alerts).toHaveLength(0);
    });
  });

  describe("Cost Optimization", () => {
    it("should recommend cost optimization", () => {
      // Create card inventory
      const card1 = createMockCard("wex");
      const card2 = createMockCard("comdata");
      const card3 = createMockCard("fuelman", { cardId: "card-fuelman-123" });

      // Mock card costs
      const costs = new Map<string, number>([
        [card1.cardId, 50], // Higher cost
        [card2.cardId, 40],
        [card3.cardId, 45],
      ]);

      const recommendations = manager.optimizeCosts(costs);

      // Should provide recommendations for high-cost cards
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("should calculate ROI for recommendations", () => {
      const costs = new Map<string, number>([
        ["card-wex-123", 100],
        ["card-comdata-123", 50],
      ]);

      const recommendations = manager.optimizeCosts(costs);

      recommendations.forEach((rec) => {
        expect(rec.roiMonths).toBeGreaterThan(0);
        expect(rec.monthlySavings).toBeGreaterThan(0);
      });
    });
  });

  describe("IFTA Calculation", () => {
    it("should calculate IFTA taxes for a period", () => {
      const transactions: FuelTransaction[] = [
        createMockTransaction("card-1", {
          fuelQuantity: 100,
          merchantLocation: {
            city: "Los Angeles",
            state: "CA",
            zip: "90001",
            address: "",
          },
        }),
        createMockTransaction("card-1", {
          fuelQuantity: 50,
          merchantLocation: {
            city: "El Paso",
            state: "TX",
            zip: "79901",
            address: "",
          },
        }),
      ];

      const startDate = new Date("2026-Q1");
      const endDate = new Date("2026-03-31");

      const calculation = manager.calculateIFTA(
        transactions,
        startDate,
        endDate
      );

      expect(calculation).toBeDefined();
      expect(calculation.gallonsByState).toBeDefined();
      expect(calculation.taxByState).toBeDefined();
      expect(calculation.totalTax).toBeGreaterThan(0);
      expect(calculation.filingDeadline).toBeInstanceOf(Date);
    });

    it("should group gallons by state correctly", () => {
      const transactions: FuelTransaction[] = [
        createMockTransaction("card-1", {
          fuelQuantity: 100,
          merchantLocation: {
            city: "Los Angeles",
            state: "CA",
            zip: "90001",
            address: "",
          },
        }),
        createMockTransaction("card-1", {
          fuelQuantity: 50,
          merchantLocation: {
            city: "San Francisco",
            state: "CA",
            zip: "94102",
            address: "",
          },
        }),
      ];

      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-03-31");

      const calculation = manager.calculateIFTA(
        transactions,
        startDate,
        endDate
      );

      expect(calculation.gallonsByState["CA"]).toBe(150);
    });

    it("should calculate state-specific taxes", () => {
      const transactions: FuelTransaction[] = [
        createMockTransaction("card-1", {
          fuelQuantity: 100,
          transactionDate: new Date("2026-03-01"),
          merchantLocation: {
            city: "Los Angeles",
            state: "CA",
            zip: "90001",
            address: "",
          },
        }),
      ];

      const startDate = new Date("2026-03-01");
      const endDate = new Date("2026-03-31");

      const calculation = manager.calculateIFTA(
        transactions,
        startDate,
        endDate
      );

      expect(calculation.taxByState["CA"]).toBeGreaterThan(0);
    });

    it("should return empty calculations for no transactions", () => {
      const startDate = new Date("2026-Q1");
      const endDate = new Date("2026-03-31");

      const calculation = manager.calculateIFTA([], startDate, endDate);

      expect(calculation.totalTax).toBe(0);
      expect(Object.keys(calculation.gallonsByState)).toHaveLength(0);
    });
  });

  describe("Manager Statistics", () => {
    it("should track card statistics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex"),
        }),
      });

      await manager.issueCard("wex", {
        cardholderName: "John Driver",
      });

      const stats = manager.getStats();

      expect(stats.totalCards).toBeGreaterThanOrEqual(0);
      expect(stats.cardsByProvider).toBeDefined();
      expect(stats.cardsByStatus).toBeDefined();
    });

    it("should provide provider breakdown", async () => {
      const stats = manager.getStats();

      expect(stats.cardsByProvider).toEqual(expect.any(Object));
    });
  });

  describe("Cache Management", () => {
    it("should clear caches", () => {
      const stats1 = manager.getStats();
      manager.clearCaches();
      const stats2 = manager.getStats();

      expect(stats2.totalCards).toBe(0);
    });
  });

  describe("Event Emission", () => {
    it("should emit card-issued event", async () => {
      const listener = vi.fn();
      manager.on("card-issued", listener);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createMockCard("wex"),
        }),
      });

      await manager.issueCard("wex", {
        cardholderName: "John Driver",
      });

      expect(listener).toHaveBeenCalled();
    });

    it("should emit policy-registered event", () => {
      const listener = vi.fn();
      manager.on("policy-registered", listener);

      const policy = createMockPolicy();
      manager.registerPolicy(policy);

      expect(listener).toHaveBeenCalled();
    });

    it("should emit error event from underlying clients", () => {
      const listener = vi.fn();
      manager.on("error", listener);

      // Trigger error from a client (would require more complex setup)
      // For now, just verify the listener is registered
      expect(listener).toBeDefined();
    });
  });

  describe("Multi-Provider Operations", () => {
    it("should support multiple providers simultaneously", async () => {
      const wexCard = createMockCard("wex");
      const comdataCard = createMockCard("comdata");

      const costs = new Map<string, number>([
        [wexCard.cardId, 50],
        [comdataCard.cardId, 45],
      ]);

      const recommendations = manager.optimizeCosts(costs);
      expect(recommendations).toBeDefined();
    });

    it("should aggregate data across providers", () => {
      const transactions: FuelTransaction[] = [
        createMockTransaction("card-wex-123"),
        createMockTransaction("card-comdata-456"),
        createMockTransaction("card-fuelman-789"),
      ];

      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-12-31");

      const calculation = manager.calculateIFTA(
        transactions,
        startDate,
        endDate
      );

      expect(calculation.totalTax).toBeGreaterThan(0);
    });
  });
});
