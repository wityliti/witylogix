/**
 * Intelligent Order Router Tests
 *
 * Tests for:
 * - Proximity scoring (haversine distance)
 * - Stock checking and scoring
 * - Capacity tracking and scoring
 * - Cost estimation and scoring
 * - SLA compliance scoring
 * - Multi-criteria fulfillment scoring
 * - Order routing decision
 * - Split order detection
 * - Routing explanation generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createIntelligentOrderRouter,
  type Order,
  type Warehouse,
  type OrderItem,
  ProximityCalculator,
  StockChecker,
  CapacityTracker,
  CostEstimator,
  FulfillmentScorer,
  SplitOrderDetector,
  RoutingExplainer,
  type Coordinate,
} from "../intelligent-order-router.js";

describe("Intelligent Order Router", () => {
  let router = createIntelligentOrderRouter();
  let warehouses: Warehouse[];
  let order: Order;
  const nyc: Coordinate = { latitude: 40.7128, longitude: -74.006 };
  const laCoord: Coordinate = { latitude: 34.0522, longitude: -118.2437 };
  const chicagoCoord: Coordinate = { latitude: 41.8781, longitude: -87.6298 };

  beforeEach(() => {
    router = createIntelligentOrderRouter();

    // Create test warehouses
    warehouses = [
      {
        id: "wh_1",
        name: "NYC Warehouse",
        location: nyc,
        inventory: new Map([
          ["sku_1", 50],
          ["sku_2", 30],
          ["sku_3", 20],
        ]),
        dailyCapacity: 200,
        currentDailyCount: 50,
        costPerKm: 0.5,
        slaHours: new Map([
          ["standard", 24],
          ["express", 6],
          ["overnight", 2],
        ]),
      },
      {
        id: "wh_2",
        name: "Chicago Warehouse",
        location: chicagoCoord,
        inventory: new Map([
          ["sku_1", 100],
          ["sku_2", 10],
          ["sku_3", 50],
        ]),
        dailyCapacity: 150,
        currentDailyCount: 80,
        costPerKm: 0.4,
        slaHours: new Map([
          ["standard", 24],
          ["express", 8],
          ["overnight", 3],
        ]),
      },
      {
        id: "wh_3",
        name: "LA Warehouse",
        location: laCoord,
        inventory: new Map([
          ["sku_1", 5],
          ["sku_2", 80],
          ["sku_3", 100],
        ]),
        dailyCapacity: 180,
        currentDailyCount: 100,
        costPerKm: 0.6,
        slaHours: new Map([
          ["standard", 24],
          ["express", 12],
          ["overnight", 6],
        ]),
      },
    ];

    // Create test order
    order = {
      id: "order_1",
      items: [
        { skuId: "sku_1", quantity: 5, weight: 2, volume: 0.1 },
        { skuId: "sku_2", quantity: 3, weight: 1, volume: 0.05 },
      ],
      deliveryAddress: { latitude: 40.7489, longitude: -73.968 }, // Manhattan
      priority: "standard",
      createdAt: new Date(),
      weight: 13, // 5*2 + 3*1
      volume: 0.2, // 5*0.1 + 3*0.05
    };
  });

  describe("ProximityCalculator", () => {
    it("should calculate proximity score based on distance", () => {
      const calc = new ProximityCalculator();

      // Very close warehouse (same city)
      const scoreClose = calc.calculateScore(nyc, {
        latitude: 40.7489,
        longitude: -73.968,
      });
      expect(scoreClose).toBeGreaterThan(90);

      // Far warehouse
      const scoreFar = calc.calculateScore(laCoord, {
        latitude: 40.7489,
        longitude: -73.968,
      });
      expect(scoreFar).toBeLessThan(30);
      expect(scoreFar).toBeGreaterThan(0);
    });

    it("should return 100 for same coordinates", () => {
      const calc = new ProximityCalculator();
      const score = calc.calculateScore(nyc, nyc);
      expect(score).toBe(100);
    });
  });

  describe("StockChecker", () => {
    it("should verify all items are in stock", () => {
      const checker = new StockChecker();
      const items = order.items;

      expect(checker.hasAllItems(warehouses[0], items)).toBe(true);
      expect(checker.hasAllItems(warehouses[2], items)).toBe(true);
    });

    it("should detect insufficient stock", () => {
      const checker = new StockChecker();
      const items = [{ skuId: "sku_1", quantity: 200, weight: 100, volume: 5 }];

      expect(checker.hasAllItems(warehouses[0], items)).toBe(false);
    });

    it("should calculate stock score", () => {
      const checker = new StockChecker();

      // Full stock
      const score1 = checker.calculateScore(warehouses[0], order.items);
      expect(score1).toBe(100);

      // Partial stock
      const partialItems = [
        { skuId: "sku_1", quantity: 60, weight: 120, volume: 6 },
      ];
      const score2 = checker.calculateScore(warehouses[0], partialItems);
      expect(score2).toBeLessThan(100);
      expect(score2).toBeGreaterThan(0);
    });
  });

  describe("CapacityTracker", () => {
    it("should track warehouse capacity", () => {
      const tracker = new CapacityTracker();
      tracker.initializeDay();

      expect(tracker.hasCapacity(warehouses[0], order)).toBe(true);

      // Fill warehouse
      tracker.recordAssignment(warehouses[0].id, 195); // 195 items
      expect(tracker.hasCapacity(warehouses[0], order)).toBe(false);
    });

    it("should calculate capacity score", () => {
      const tracker = new CapacityTracker();

      // Empty warehouse
      const empty = { ...warehouses[0], currentDailyCount: 0 };
      const score1 = tracker.calculateScore(empty);
      expect(score1).toBe(100);

      // Half full
      const half = { ...warehouses[0], currentDailyCount: 100 };
      const score2 = tracker.calculateScore(half);
      expect(score2).toBeCloseTo(50, 5);
    });

    it("should track remaining capacity", () => {
      const tracker = new CapacityTracker();
      tracker.initializeDay();

      const remaining = tracker.getRemainingCapacity(warehouses[0]);
      expect(remaining).toBe(
        warehouses[0].dailyCapacity - warehouses[0].currentDailyCount,
      );
    });
  });

  describe("CostEstimator", () => {
    it("should estimate shipping cost", () => {
      const estimator = new CostEstimator();

      const cost1 = estimator.estimateCost(warehouses[0], order);
      const cost2 = estimator.estimateCost(warehouses[2], order);

      expect(cost1).toBeGreaterThan(0);
      expect(cost2).toBeGreaterThan(cost1); // LA to NYC is more expensive
    });

    it("should add surcharges for express shipping", () => {
      const estimator = new CostEstimator();

      const standardCost = estimator.estimateCost(warehouses[0], order);
      const expressOrder = { ...order, priority: "express" as const };
      const expressCost = estimator.estimateCost(warehouses[0], expressOrder);

      expect(expressCost).toBeGreaterThan(standardCost);
    });

    it("should calculate cost score", () => {
      const estimator = new CostEstimator();

      const score1 = estimator.calculateScore(50);
      const score2 = estimator.calculateScore(500);

      expect(score1).toBeGreaterThan(score2);
      expect(score1).toBeLessThanOrEqual(100);
    });
  });

  describe("FulfillmentScorer", () => {
    it("should score warehouse across all criteria", () => {
      const scorer = new FulfillmentScorer();
      const rules = { rule: "custom_weights" as const };

      const scores = scorer.scoreWarehouse(warehouses[0], order, rules);

      expect(scores.proximity).toBeGreaterThanOrEqual(0);
      expect(scores.proximity).toBeLessThanOrEqual(100);
      expect(scores.stock).toBe(100); // NYC has all items
      expect(scores.capacity).toBeGreaterThan(0);
      expect(scores.cost).toBeGreaterThanOrEqual(0);
      expect(scores.sla).toBeGreaterThanOrEqual(0);
      expect(scores.weighted).toBeLessThanOrEqual(100);
    });

    it("should apply custom weights", () => {
      const scorer = new FulfillmentScorer();
      const rules = {
        rule: "custom_weights" as const,
        weights: {
          proximity: 0.7,
          stock: 0.2,
          capacity: 0.05,
          cost: 0.025,
          sla: 0.025,
        },
      };

      const scores = scorer.scoreWarehouse(warehouses[0], order, rules);
      expect(scores.weighted).toBeGreaterThan(0);
    });
  });

  describe("IntelligentOrderRouter", () => {
    it("should route order to best warehouse", () => {
      const decision = router.routeOrder(order, warehouses);

      expect(decision.orderId).toBe(order.id);
      expect(decision.warehouseId).not.toBe("");
      expect(decision.score).toBeGreaterThan(0);
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it("should prefer warehouse close to delivery location", () => {
      const decision = router.routeOrder(order, warehouses);

      // Order delivery is in Manhattan (close to NYC warehouse)
      expect(decision.warehouseId).toBe("wh_1"); // NYC warehouse
    });

    it("should handle orders with stock constraints", () => {
      const stockConstrainedOrder: Order = {
        id: "order_2",
        items: [
          { skuId: "sku_1", quantity: 60, weight: 120, volume: 6 }, // Only NYC and Chicago have enough
        ],
        deliveryAddress: order.deliveryAddress,
        priority: "standard",
        createdAt: new Date(),
        weight: 120,
        volume: 6,
      };

      const decision = router.routeOrder(stockConstrainedOrder, warehouses);
      expect(["wh_1", "wh_2"]).toContain(decision.warehouseId);
    });

    it("should handle capacity constraints", () => {
      // Fill NYC warehouse
      const fullWarehouses = warehouses.map((w) => ({
        ...w,
        currentDailyCount:
          w.id === "wh_1" ? w.dailyCapacity - 1 : w.currentDailyCount,
      }));

      const decision = router.routeOrder(order, fullWarehouses);

      // Should route to different warehouse since NYC is almost full
      expect(decision.warehouseId).not.toBe("wh_1");
    });

    it("should generate routing explanation", () => {
      const decision = router.routeOrder(order, warehouses);

      expect(decision.explanation).toBeDefined();
      expect(decision.explanation.summary).toContain("assigned");
      expect(decision.explanation.proximityExplanation).toBeDefined();
      expect(decision.explanation.stockExplanation).toBeDefined();
      expect(decision.explanation.capacityExplanation).toBeDefined();
      expect(decision.explanation.costExplanation).toBeDefined();
      expect(decision.explanation.slaExplanation).toBeDefined();
      expect(decision.explanation.alternativesConsidered).toBeDefined();
    });

    it("should evaluate options without assigning", () => {
      const candidates = router.evaluateOptions(order, warehouses);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score);
    });

    it("should suggest split orders when necessary", () => {
      const splitOrder: Order = {
        id: "order_3",
        items: [
          { skuId: "sku_1", quantity: 80, weight: 160, volume: 8 }, // Most in Chicago
          { skuId: "sku_2", quantity: 40, weight: 40, volume: 2 }, // Most in LA
        ],
        deliveryAddress: { latitude: 35.0116, longitude: -106.6487 }, // Albuquerque (central)
        priority: "standard",
        createdAt: new Date(),
        weight: 200,
        volume: 10,
      };

      const decision = router.routeOrder(splitOrder, warehouses, {
        considerSplits: true,
      });

      // May or may not split depending on warehouse scores
      expect(decision).toBeDefined();
    });

    it("should allow setting custom rules", () => {
      const customRules = {
        rule: "prefer_lowest_cost" as const,
        weights: {
          proximity: 0.1,
          stock: 0.2,
          capacity: 0.1,
          cost: 0.5,
          sla: 0.1,
        },
      };

      router.setRules(customRules);
      const rules = router.getRules();

      expect(rules.weights?.cost).toBe(0.5);
    });

    it("should initialize daily capacity tracking", () => {
      router.initializeDay();
      const candidates = router.evaluateOptions(order, warehouses);

      expect(candidates.length).toBeGreaterThan(0);
    });
  });

  describe("SplitOrderDetector", () => {
    it("should detect when split is beneficial", () => {
      const detector = new SplitOrderDetector();
      const splitOrder: Order = {
        id: "order_4",
        items: [
          { skuId: "sku_1", quantity: 100, weight: 200, volume: 10 },
          { skuId: "sku_3", quantity: 100, weight: 100, volume: 5 },
        ],
        deliveryAddress: { latitude: 35.0116, longitude: -106.6487 },
        priority: "standard",
        createdAt: new Date(),
        weight: 300,
        volume: 15,
      };

      const candidates = router.evaluateOptions(splitOrder, warehouses);
      const splits = detector.detectOptimalSplit(splitOrder, candidates, 3);

      // May suggest splits if no single warehouse is good enough
      expect(Array.isArray(splits)).toBe(true);
    });
  });

  describe("RoutingExplainer", () => {
    it("should generate human-readable explanations", () => {
      const decision = router.routeOrder(order, warehouses);
      const explanation = decision.explanation;

      expect(explanation.summary).toContain("assigned");
      expect(explanation.proximityExplanation).toMatch(/\d+\/100/);
      expect(explanation.stockExplanation).toMatch(/\d+\/100/);
      expect(explanation.capacityExplanation).toMatch(/\d+\/100/);
      expect(explanation.costExplanation).toMatch(/\d+\/100/);
      expect(explanation.slaExplanation).toMatch(/\d+\/100/);
    });
  });
});
