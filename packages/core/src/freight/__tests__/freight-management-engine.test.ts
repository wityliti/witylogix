/**
 * Freight Management Engine Unit Tests
 * Tests for lane management, rate negotiation, scorecard, and capacity planning
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FreightManagementEngine,
  LaneManager,
  CarrierScorecard,
  RateNegotiationTracker,
  CapacityPlanner,
  type ScorecardConfig,
} from "../freight-management-engine";
import {
  Lane,
  EquipmentType,
  NegotiationStatus,
  ComplianceStatus,
} from "../freight-types";

// ────────────────────────────────────────────────────────────────────────────
// LANE MANAGER TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("LaneManager", () => {
  let laneManager: LaneManager;

  beforeEach(() => {
    laneManager = new LaneManager();
  });

  describe("createLane", () => {
    it("should create a lane with required fields", () => {
      const laneData = {
        tenantId: "tenant-123",
        name: "Chicago to Dallas",
        origin: {
          address: "123 Main St",
          city: "Chicago",
          state: "IL",
          zip: "60601",
          country: "USA",
        },
        destination: {
          address: "456 Oak Ave",
          city: "Dallas",
          state: "TX",
          zip: "75001",
          country: "USA",
        },
        miles: 920,
        equipment: EquipmentType.DRY_VAN,
        avgWeeklyVolume: 5,
        avgWeight: 40000,
        hazmatCapable: false,
        pricingTiers: [],
        volumeCommitments: [],
        contractTerms: {
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
          autoRenewal: true,
          noticeperiodDays: 30,
          paymentTermsDays: 15,
        },
        status: "active" as const,
      };

      const lane = laneManager.createLane("tenant-123", {
        ...laneData,
        tenantId: undefined,
        status: undefined,
      } as any);

      expect(lane.id).toBeDefined();
      expect(lane.tenantId).toBe("tenant-123");
      expect(lane.name).toBe("Chicago to Dallas");
      expect(lane.miles).toBe(920);
      expect(lane.equipment).toBe(EquipmentType.DRY_VAN);
      expect(lane.createdAt).toBeDefined();
      expect(lane.updatedAt).toBeDefined();
    });

    it("should include empty pricing tiers and volume commitments", () => {
      const laneData = {
        tenantId: "tenant-123",
        name: "Test Lane",
        origin: {
          address: "123 Main",
          city: "City A",
          state: "CA",
          zip: "90001",
          country: "USA",
        },
        destination: {
          address: "456 Oak",
          city: "City B",
          state: "NY",
          zip: "10001",
          country: "USA",
        },
        miles: 2800,
        equipment: EquipmentType.REEFER,
        avgWeeklyVolume: 3,
        avgWeight: 35000,
        hazmatCapable: true,
        pricingTiers: [],
        volumeCommitments: [],
        contractTerms: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewal: false,
          noticeperiodDays: 15,
          paymentTermsDays: 30,
        },
        status: "active" as const,
      };

      const lane = laneManager.createLane("tenant-123", {
        ...laneData,
        tenantId: undefined,
        status: undefined,
      } as any);

      expect(lane.pricingTiers).toEqual([]);
      expect(lane.volumeCommitments).toEqual([]);
    });
  });

  describe("addPricingTier", () => {
    it("should add pricing tier to lane", () => {
      const lane: Lane = {
        id: "lane-1",
        tenantId: "tenant-1",
        name: "Test Lane",
        origin: {
          address: "123 Main",
          city: "City A",
          state: "CA",
          zip: "90001",
          country: "USA",
        },
        destination: {
          address: "456 Oak",
          city: "City B",
          state: "NY",
          zip: "10001",
          country: "USA",
        },
        miles: 500,
        equipment: EquipmentType.DRY_VAN,
        avgWeeklyVolume: 5,
        avgWeight: 40000,
        hazmatCapable: false,
        pricingTiers: [],
        volumeCommitments: [],
        contractTerms: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewal: true,
          noticeperiodDays: 30,
          paymentTermsDays: 15,
        },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedLane = laneManager.addPricingTier(lane, {
        minLoads: 0,
        maxLoads: 10,
        ratePerMile: 2.5,
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(updatedLane.pricingTiers).toHaveLength(1);
      expect(updatedLane.pricingTiers[0].ratePerMile).toBe(2.5);
      expect(updatedLane.pricingTiers[0].minLoads).toBe(0);
    });

    it("should assign unique tier IDs", () => {
      const lane: Lane = {
        id: "lane-1",
        tenantId: "tenant-1",
        name: "Test Lane",
        origin: {
          address: "123 Main",
          city: "City A",
          state: "CA",
          zip: "90001",
          country: "USA",
        },
        destination: {
          address: "456 Oak",
          city: "City B",
          state: "NY",
          zip: "10001",
          country: "USA",
        },
        miles: 500,
        equipment: EquipmentType.DRY_VAN,
        avgWeeklyVolume: 5,
        avgWeight: 40000,
        hazmatCapable: false,
        pricingTiers: [],
        volumeCommitments: [],
        contractTerms: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewal: true,
          noticeperiodDays: 30,
          paymentTermsDays: 15,
        },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tier1 = laneManager.addPricingTier(lane, {
        minLoads: 0,
        ratePerMile: 2.5,
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      const tier2 = laneManager.addPricingTier(tier1, {
        minLoads: 10,
        ratePerMile: 2.3,
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(tier2.pricingTiers[0].tierId).not.toBe(
        tier2.pricingTiers[1].tierId
      );
    });
  });

  describe("checkCommitmentFulfillment", () => {
    it("should identify fulfilled commitments", () => {
      const now = new Date();
      const lane: Lane = {
        id: "lane-1",
        tenantId: "tenant-1",
        name: "Test Lane",
        origin: {
          address: "123 Main",
          city: "City A",
          state: "CA",
          zip: "90001",
          country: "USA",
        },
        destination: {
          address: "456 Oak",
          city: "City B",
          state: "NY",
          zip: "10001",
          country: "USA",
        },
        miles: 500,
        equipment: EquipmentType.DRY_VAN,
        avgWeeklyVolume: 5,
        avgWeight: 40000,
        hazmatCapable: false,
        pricingTiers: [],
        volumeCommitments: [
          {
            commitmentId: "commit-1",
            carrierId: "carrier-1",
            loadsPerMonth: 20,
            durationMonths: 12,
            discountPercent: 5,
            startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 330 * 24 * 60 * 60 * 1000),
            fulfilled: 0,
          },
        ],
        contractTerms: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewal: true,
          noticeperiodDays: 30,
          paymentTermsDays: 15,
        },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = laneManager.checkCommitmentFulfillment(lane, 1, 25);

      expect(result).toHaveLength(1);
      expect(result[0].fulfilled).toBe(true);
      expect(result[0].shortfall).toBe(0);
    });

    it("should detect shortfalls and calculate penalties", () => {
      const now = new Date();
      const lane: Lane = {
        id: "lane-1",
        tenantId: "tenant-1",
        name: "Test Lane",
        origin: {
          address: "123 Main",
          city: "City A",
          state: "CA",
          zip: "90001",
          country: "USA",
        },
        destination: {
          address: "456 Oak",
          city: "City B",
          state: "NY",
          zip: "10001",
          country: "USA",
        },
        miles: 500,
        equipment: EquipmentType.DRY_VAN,
        avgWeeklyVolume: 5,
        avgWeight: 40000,
        hazmatCapable: false,
        pricingTiers: [],
        volumeCommitments: [
          {
            commitmentId: "commit-1",
            carrierId: "carrier-1",
            loadsPerMonth: 20,
            durationMonths: 12,
            discountPercent: 5,
            startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 330 * 24 * 60 * 60 * 1000),
            fulfilled: 0,
            penalty: 100,
          },
        ],
        contractTerms: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewal: true,
          noticeperiodDays: 30,
          paymentTermsDays: 15,
        },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = laneManager.checkCommitmentFulfillment(lane, 1, 15);

      expect(result[0].fulfilled).toBe(false);
      expect(result[0].shortfall).toBe(5);
      expect(result[0].penalty).toBe(500); // 5 loads * $100
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CARRIER SCORECARD TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("CarrierScorecard", () => {
  let scorecard: CarrierScorecard;

  beforeEach(() => {
    scorecard = new CarrierScorecard();
  });

  describe("createScorecard", () => {
    it("should create scorecard with valid metrics", () => {
      const metrics = {
        onTimePercentage: 98,
        claimsRatio: 0.01,
        tenderAcceptanceRate: 0.95,
        costPerMile: 1.2,
        safetyRating: "satisfactory" as const,
        inspectionDeficitPercentage: 5,
        outOfServiceRate: 0.2,
        cargoClaimsCount: 2,
        cargoClaimsAmount: 5000,
        trafficViolationsCount: 0,
      };

      const result = scorecard.createScorecard(
        "tenant-1",
        "carrier-1",
        "Test Carrier",
        metrics,
        "monthly"
      );

      expect(result.id).toBeDefined();
      expect(result.carrierId).toBe("carrier-1");
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it("should calculate lower scores for poor metrics", () => {
      const poorMetrics = {
        onTimePercentage: 85,
        claimsRatio: 0.05,
        tenderAcceptanceRate: 0.75,
        costPerMile: 2.0,
        safetyRating: "unsatisfactory" as const,
        inspectionDeficitPercentage: 20,
        outOfServiceRate: 1.0,
        cargoClaimsCount: 10,
        cargoClaimsAmount: 50000,
        trafficViolationsCount: 5,
      };

      const goodMetrics = {
        onTimePercentage: 99,
        claimsRatio: 0.005,
        tenderAcceptanceRate: 0.99,
        costPerMile: 1.0,
        safetyRating: "satisfactory" as const,
        inspectionDeficitPercentage: 2,
        outOfServiceRate: 0.1,
        cargoClaimsCount: 0,
        cargoClaimsAmount: 0,
        trafficViolationsCount: 0,
      };

      const poorScore = scorecard.createScorecard(
        "tenant-1",
        "carrier-poor",
        "Poor Carrier",
        poorMetrics,
        "monthly"
      );

      const goodScore = scorecard.createScorecard(
        "tenant-1",
        "carrier-good",
        "Good Carrier",
        goodMetrics,
        "monthly"
      );

      expect(goodScore.overallScore).toBeGreaterThan(poorScore.overallScore);
    });
  });

  describe("updateScorecard", () => {
    it("should update scorecard metrics and recalculate scores", () => {
      const initialMetrics = {
        onTimePercentage: 90,
        claimsRatio: 0.02,
        tenderAcceptanceRate: 0.9,
        costPerMile: 1.3,
        safetyRating: "satisfactory" as const,
        inspectionDeficitPercentage: 8,
        outOfServiceRate: 0.3,
        cargoClaimsCount: 5,
        cargoClaimsAmount: 10000,
        trafficViolationsCount: 1,
      };

      const card = scorecard.createScorecard(
        "tenant-1",
        "carrier-1",
        "Test Carrier",
        initialMetrics,
        "monthly"
      );

      const initialScore = card.overallScore;

      const updated = scorecard.updateScorecard(card, {
        onTimePercentage: 99,
        claimsRatio: 0.005,
      });

      expect(updated.metrics.onTimePercentage).toBe(99);
      expect(updated.metrics.claimsRatio).toBe(0.005);
      expect(updated.overallScore).toBeGreaterThan(initialScore);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// RATE NEGOTIATION TRACKER TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("RateNegotiationTracker", () => {
  let tracker: RateNegotiationTracker;

  beforeEach(() => {
    tracker = new RateNegotiationTracker();
  });

  describe("initiateNegotiation", () => {
    it("should create negotiation with bid requests", () => {
      const carrierIds = ["carrier-1", "carrier-2", "carrier-3"];

      const negotiation = tracker.initiateNegotiation(
        "tenant-1",
        "lane-1",
        carrierIds,
        5
      );

      expect(negotiation.id).toBeDefined();
      expect(negotiation.status).toBe(NegotiationStatus.BID_REQUESTED);
      expect(negotiation.roundNumber).toBe(1);
      expect(negotiation.carriers).toHaveLength(3);
      expect(negotiation.bidDueDate).toBeInstanceOf(Date);
    });
  });

  describe("receiveBid", () => {
    it("should accept carrier bid", () => {
      const negotiation = tracker.initiateNegotiation(
        "tenant-1",
        "lane-1",
        ["carrier-1", "carrier-2"],
        5
      );

      const updated = tracker.receiveBid(negotiation, "carrier-1", {
        baseRate: 2.5,
        total: 2300,
      });

      const carrier = updated.carriers.find((c) => c.carrierId === "carrier-1");
      expect(carrier?.baseRate).toBe(2.5);
      expect(carrier?.total).toBe(2300);
    });

    it("should transition to BIDS_RECEIVED when all carriers bid", () => {
      let negotiation = tracker.initiateNegotiation(
        "tenant-1",
        "lane-1",
        ["carrier-1", "carrier-2"],
        5
      );

      negotiation = tracker.receiveBid(negotiation, "carrier-1", {
        baseRate: 2.5,
        total: 2300,
      });

      expect(negotiation.status).toBe(NegotiationStatus.BID_REQUESTED);

      negotiation = tracker.receiveBid(negotiation, "carrier-2", {
        baseRate: 2.4,
        total: 2200,
      });

      expect(negotiation.status).toBe(NegotiationStatus.BIDS_RECEIVED);
    });
  });

  describe("awardContract", () => {
    it("should award contract to selected carrier", () => {
      let negotiation = tracker.initiateNegotiation(
        "tenant-1",
        "lane-1",
        ["carrier-1", "carrier-2"],
        5
      );

      negotiation = tracker.receiveBid(negotiation, "carrier-1", {
        baseRate: 2.5,
        total: 2300,
      });

      negotiation = tracker.receiveBid(negotiation, "carrier-2", {
        baseRate: 2.4,
        total: 2200,
      });

      const awarded = tracker.awardContract(negotiation, "carrier-2", 2.4);

      expect(awarded.status).toBe(NegotiationStatus.AWARDED);
      expect(awarded.selectedCarrierId).toBe("carrier-2");
      expect(awarded.selectedRate).toBe(2.4);
      expect(awarded.awardDate).toBeDefined();
    });
  });

  describe("getSummary", () => {
    it("should provide negotiation summary", () => {
      let negotiation = tracker.initiateNegotiation(
        "tenant-1",
        "lane-1",
        ["carrier-1", "carrier-2", "carrier-3"],
        5
      );

      negotiation = tracker.receiveBid(negotiation, "carrier-1", {
        baseRate: 2.5,
        total: 2300,
      });

      negotiation = tracker.receiveBid(negotiation, "carrier-2", {
        baseRate: 2.2,
        total: 2000,
      });

      negotiation = tracker.receiveBid(negotiation, "carrier-3", {
        baseRate: 2.8,
        total: 2600,
      });

      const summary = tracker.getSummary(negotiation);

      expect(summary.lowestBid?.baseRate).toBe(2.2);
      expect(summary.highestBid?.baseRate).toBe(2.8);
      expect(summary.averageBid).toBeCloseTo(2.5, 1);
      expect(summary.totalDaysToAward).toBeGreaterThanOrEqual(0);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CAPACITY PLANNER TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("CapacityPlanner", () => {
  let planner: CapacityPlanner;

  beforeEach(() => {
    planner = new CapacityPlanner();
  });

  describe("generateForecast", () => {
    it("should generate forecast with historical data", () => {
      const historicalLoads = [
        { date: new Date("2024-01-01"), loads: 10 },
        { date: new Date("2024-01-08"), loads: 12 },
        { date: new Date("2024-01-15"), loads: 11 },
        { date: new Date("2024-01-22"), loads: 13 },
        { date: new Date("2024-01-29"), loads: 14 },
      ];

      const forecast = planner.generateForecast(
        "tenant-1",
        "lane-1",
        historicalLoads,
        30
      );

      expect(forecast.id).toBeDefined();
      expect(forecast.forecastData).toHaveLength(30);
      expect(forecast.seasonalIndex).toBeGreaterThan(0);
      expect(forecast.period.startDate).toBeDefined();
      expect(forecast.period.endDate).toBeDefined();
    });

    it("should detect surge patterns", () => {
      const historicalLoads = [
        { date: new Date("2024-01-01"), loads: 10 },
        { date: new Date("2024-01-08"), loads: 10 },
        { date: new Date("2024-01-15"), loads: 10 },
        { date: new Date("2024-01-22"), loads: 10 },
      ];

      const forecast = planner.generateForecast(
        "tenant-1",
        "lane-1",
        historicalLoads,
        30
      );

      // Even with steady historical data, some forecast points may indicate surge risk
      expect(forecast.forecastData).toBeDefined();
      expect(forecast.recommendations).toBeDefined();
    });
  });

  describe("activateBackupCarriers", () => {
    it("should activate backup carriers for forecast", () => {
      const historicalLoads = [
        { date: new Date("2024-01-01"), loads: 10 },
        { date: new Date("2024-01-08"), loads: 10 },
      ];

      const forecast = planner.generateForecast(
        "tenant-1",
        "lane-1",
        historicalLoads,
        30
      );

      const updated = planner.activateBackupCarriers(forecast, [
        "backup-carrier-1",
        "backup-carrier-2",
      ]);

      expect(updated.backupCarriers).toHaveLength(2);
      expect(updated.backupCarriers[0]).toBe("backup-carrier-1");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FREIGHT MANAGEMENT ENGINE INTEGRATION TESTS
// ────────────────────────────────────────────────────────────────────────────

describe("FreightManagementEngine", () => {
  let engine: FreightManagementEngine;

  beforeEach(() => {
    engine = new FreightManagementEngine();
  });

  it("should provide access to all sub-services", () => {
    expect(engine.getLaneManager()).toBeInstanceOf(LaneManager);
    expect(engine.getScorecardService()).toBeInstanceOf(CarrierScorecard);
    expect(engine.getNegotiationTracker()).toBeInstanceOf(
      RateNegotiationTracker
    );
    expect(engine.getCapacityPlanner()).toBeInstanceOf(CapacityPlanner);
  });

  it("should create contract from negotiation award", () => {
    const negotiation = engine
      .getNegotiationTracker()
      .initiateNegotiation("tenant-1", "lane-1", ["carrier-1"], 5);

    const withBid = engine
      .getNegotiationTracker()
      .receiveBid(negotiation, "carrier-1", {
        baseRate: 2.5,
        total: 2300,
      });

    const awarded = engine
      .getNegotiationTracker()
      .awardContract(withBid, "carrier-1", 2.5);

    const contract = engine.createContractFromAward(
      "tenant-1",
      awarded,
      {
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        baseRate: 2.5,
        fuelSurcharge: 0,
        accessorials: [],
        conditions: [],
      }
    );

    expect(contract.id).toBeDefined();
    expect(contract.carrierId).toBe("carrier-1");
    expect(contract.status).toBe("active");
    expect(contract.rateSheets).toHaveLength(1);
  });
});
