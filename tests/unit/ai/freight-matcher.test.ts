/**
 * Freight Matcher Unit Tests
 * Test multi-criteria scoring algorithm, carrier matching, bundling, and deadhead optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreightMatcher, type MatchCriteria, type CarrierMatch } from '../../../packages/core/src/ai/freight-matcher.js';
import type { FreightLoad, Lane, EquipmentType } from '../../../packages/core/src/freight/freight-types.js';
import type { Carrier } from '../../../packages/core/src/ai/freight-matcher.js';

// ─── MOCK DATA ───────────────────────────────────────────────────────────

const createMockFreightLoad = (overrides?: Partial<FreightLoad>): FreightLoad => ({
  id: 'load-001',
  tenantId: 'tenant-1',
  laneId: 'lane-1',
  loadNumber: 'LF-2024-001',
  origin: {
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    country: 'USA',
  },
  destination: {
    address: '456 Oak Ave',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    country: 'USA',
  },
  weight: 45000,
  weightUnit: 'lbs',
  commodity: 'General merchandise',
  hazmat: false,
  equipment: 'DRY_VAN' as EquipmentType,
  pickupDate: new Date(Date.now() + 86400000),
  deliveryDate: new Date(Date.now() + 3 * 86400000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockLane = (overrides?: Partial<Lane>): Lane => ({
  id: 'lane-1',
  tenantId: 'tenant-1',
  name: 'LA to Chicago',
  origin: {
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    country: 'USA',
  },
  destination: {
    address: '456 Oak Ave',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    country: 'USA',
  },
  miles: 2000,
  equipment: 'DRY_VAN' as EquipmentType,
  avgWeeklyVolume: 50,
  avgWeight: 45000,
  hazmatCapable: false,
  pricingTiers: [],
  volumeCommitments: [],
  contractTerms: {
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 86400000),
    autoRenewal: true,
    noticeperiodDays: 30,
    paymentTermsDays: 30,
  },
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockCarrier = (overrides?: Partial<Carrier>): Carrier => ({
  id: 'carrier-001',
  name: 'TruckCo Express',
  dotNumber: '1234567',
  safetyRating: 'satisfactory',
  insuranceStatus: 'active',
  operatingAuthority: 'active',
  metrics: {
    onTimePercentage: 92,
    claimsRatio: 0.05,
    tenderAcceptanceRate: 88,
    costPerMile: 1.85,
    safetyRating: 'satisfactory',
    inspectionDeficitPercentage: 15,
    outOfServiceRate: 2,
    cargoClaimsCount: 1,
    cargoClaimsAmount: 5000,
    trafficViolationsCount: 0,
  },
  availableTrucks: 45,
  totalFleetSize: 100,
  specializations: ['DRY_VAN', 'GENERAL_CARGO'],
  averageRatePerMile: 2.15,
  preferredCarrier: false,
  lastUsedDate: new Date(),
  ...overrides,
});

// ─── TEST SUITE ──────────────────────────────────────────────────────────

describe('FreightMatcher', () => {
  let matcher: FreightMatcher;

  beforeEach(() => {
    matcher = new FreightMatcher();
  });

  describe('matchLoad', () => {
    it('should match load to carriers and return ranked results', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carriers = [
        createMockCarrier({ id: 'c1', name: 'Carrier 1', averageRatePerMile: 2.15 }),
        createMockCarrier({ id: 'c2', name: 'Carrier 2', averageRatePerMile: 2.35 }),
        createMockCarrier({ id: 'c3', name: 'Carrier 3', averageRatePerMile: 1.95 }),
      ];

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: carriers,
        maxResults: 5,
        considerBackhauls: false,
        deadheadOptimization: false,
      };

      const result = await matcher.matchLoad(criteria);

      expect(result).toBeDefined();
      expect(result.loadId).toBe(load.id);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.matchQuality).toBeDefined();
    });

    it('should exclude non-compliant carriers', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carriers = [
        createMockCarrier({
          id: 'good-carrier',
          safetyRating: 'satisfactory',
          insuranceStatus: 'active',
        }),
        createMockCarrier({
          id: 'bad-carrier',
          safetyRating: 'unsatisfactory',
          insuranceStatus: 'expired',
        }),
      ];

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: carriers,
      };

      const result = await matcher.matchLoad(criteria);

      const badCarrier = result.recommendations.find((r) => r.carrierId === 'bad-carrier');
      expect(badCarrier).toBeUndefined();
    });

    it('should rank carriers by weighted score', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carriers = [
        createMockCarrier({
          id: 'c1',
          name: 'Excellent Carrier',
          metrics: {
            onTimePercentage: 95,
            claimsRatio: 0.02,
            tenderAcceptanceRate: 92,
            costPerMile: 1.85,
            safetyRating: 'satisfactory',
            inspectionDeficitPercentage: 10,
            outOfServiceRate: 1,
            cargoClaimsCount: 0,
            cargoClaimsAmount: 0,
            trafficViolationsCount: 0,
          },
          averageRatePerMile: 2.25,
        }),
        createMockCarrier({
          id: 'c2',
          name: 'Fair Carrier',
          metrics: {
            onTimePercentage: 75,
            claimsRatio: 0.1,
            tenderAcceptanceRate: 70,
            costPerMile: 1.75,
            safetyRating: 'conditional',
            inspectionDeficitPercentage: 35,
            outOfServiceRate: 5,
            cargoClaimsCount: 5,
            cargoClaimsAmount: 25000,
            trafficViolationsCount: 2,
          },
          averageRatePerMile: 2.0,
        }),
      ];

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: carriers,
      };

      const result = await matcher.matchLoad(criteria);

      // Better carrier should rank first
      expect(result.recommendations[0]?.carrierId).toBe('c1');
      expect(result.recommendations[0]?.totalScore).toBeGreaterThan(
        result.recommendations[1]?.totalScore ?? 0
      );
    });

    it('should identify risk flags for low-scoring carriers', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const riskyCarrier = createMockCarrier({
        availableTrucks: 2,
        totalFleetSize: 100,
        metrics: {
          onTimePercentage: 60,
          claimsRatio: 0.2,
          tenderAcceptanceRate: 50,
          costPerMile: 1.5,
          safetyRating: 'conditional',
          inspectionDeficitPercentage: 50,
          outOfServiceRate: 10,
          cargoClaimsCount: 10,
          cargoClaimsAmount: 50000,
          trafficViolationsCount: 5,
        },
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [riskyCarrier],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.recommendations[0]?.riskFlags).toBeDefined();
      expect(result.recommendations[0]?.riskFlags.length).toBeGreaterThan(0);
    });

    it('should respect preferred carrier rules', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const preferredCarrier = createMockCarrier({
        id: 'preferred',
        name: 'Preferred Partner',
        averageRatePerMile: 2.5, // Higher rate
      });
      const betterCarrier = createMockCarrier({
        id: 'better',
        name: 'Better Rate Carrier',
        averageRatePerMile: 1.95,
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [preferredCarrier, betterCarrier],
        preferredCarrierId: 'preferred',
      };

      const result = await matcher.matchLoad(criteria);

      // Preferred carrier should be in primary tier
      const preferred = result.recommendations.find((r) => r.carrierId === 'preferred');
      expect(preferred?.fallbackTier).toBe('primary');
    });

    it('should generate detailed rationale for recommendations', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carrier = createMockCarrier();

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [carrier],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.recommendations[0]?.rationale).toBeTruthy();
      expect(result.recommendations[0]?.rationale.length).toBeGreaterThan(20);
    });
  });

  describe('Lane fit scoring', () => {
    it('should score carriers based on lane history', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carrier = createMockCarrier();

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [carrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.laneFit).toBeDefined();
      expect(scores?.laneFit.score).toBeGreaterThanOrEqual(0);
      expect(scores?.laneFit.score).toBeLessThanOrEqual(100);
      expect(scores?.laneFit.weight).toBe(0.3);
    });
  });

  describe('Rate competitiveness scoring', () => {
    it('should score carriers at benchmark as excellent', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const benchmark = 2.25;
      const carrier = createMockCarrier({
        averageRatePerMile: benchmark,
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: benchmark,
        carrierPool: [carrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.rateCompetitiveness.score).toBeGreaterThanOrEqual(95);
    });

    it('should penalize carriers far from benchmark', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const benchmark = 2.25;
      const expensiveCarrier = createMockCarrier({
        averageRatePerMile: 3.5, // 55% above benchmark
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: benchmark,
        carrierPool: [expensiveCarrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.rateCompetitiveness.score).toBeLessThan(50);
    });
  });

  describe('Capacity availability scoring', () => {
    it('should score carriers with moderate utilization highly', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carrier = createMockCarrier({
        availableTrucks: 35, // 35% utilization
        totalFleetSize: 100,
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [carrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.capacityAvailability.score).toBeGreaterThan(80);
    });

    it('should penalize carriers with very tight capacity', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const tightCarrier = createMockCarrier({
        availableTrucks: 3, // Only 3% available
        totalFleetSize: 100,
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [tightCarrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.capacityAvailability.score).toBeLessThan(50);
    });
  });

  describe('Reliability scoring', () => {
    it('should score reliable carriers highly', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const reliableCarrier = createMockCarrier({
        metrics: {
          onTimePercentage: 96,
          claimsRatio: 0.01,
          tenderAcceptanceRate: 95,
          costPerMile: 1.85,
          safetyRating: 'satisfactory',
          inspectionDeficitPercentage: 5,
          outOfServiceRate: 1,
          cargoClaimsCount: 0,
          cargoClaimsAmount: 0,
          trafficViolationsCount: 0,
        },
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [reliableCarrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.reliability.score).toBeGreaterThan(90);
    });
  });

  describe('Compliance scoring', () => {
    it('should heavily penalize unsatisfactory safety rating', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const unsafeCarrier = createMockCarrier({
        safetyRating: 'unsatisfactory',
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [unsafeCarrier],
      };

      const result = await matcher.matchLoad(criteria);
      const scores = result.recommendations[0]?.scores;

      expect(scores?.compliance.score).toBeLessThan(50);
    });

    it('should exclude carriers with expired insurance', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const noInsurance = createMockCarrier({
        insuranceStatus: 'expired',
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [noInsurance],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('Match quality determination', () => {
    it('should mark excellent matches', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const excellentCarrier = createMockCarrier({
        metrics: {
          onTimePercentage: 95,
          claimsRatio: 0.01,
          tenderAcceptanceRate: 92,
          costPerMile: 1.85,
          safetyRating: 'satisfactory',
          inspectionDeficitPercentage: 10,
          outOfServiceRate: 1,
          cargoClaimsCount: 0,
          cargoClaimsAmount: 0,
          trafficViolationsCount: 0,
        },
        averageRatePerMile: 2.25,
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [excellentCarrier],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.matchQuality).toBe('excellent');
    });

    it('should mark poor matches when no good carriers available', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const poorCarrier = createMockCarrier({
        safetyRating: 'conditional',
        metrics: {
          onTimePercentage: 65,
          claimsRatio: 0.15,
          tenderAcceptanceRate: 55,
          costPerMile: 1.5,
          safetyRating: 'conditional',
          inspectionDeficitPercentage: 45,
          outOfServiceRate: 8,
          cargoClaimsCount: 8,
          cargoClaimsAmount: 40000,
          trafficViolationsCount: 3,
        },
      });

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [poorCarrier],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.matchQuality).toBe('poor');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty carrier pool', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: [],
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.recommendations.length).toBe(0);
      expect(result.matchQuality).toBe('poor');
    });

    it('should handle invalid load or lane', async () => {
      const criteria: MatchCriteria = {
        laneId: 'invalid',
        loadId: 'invalid',
        load: null as any,
        lane: null as any,
        marketBenchmark: 2.25,
        carrierPool: [],
      };

      await expect(matcher.matchLoad(criteria)).rejects.toThrow();
    });

    it('should limit results to maxResults parameter', async () => {
      const load = createMockFreightLoad();
      const lane = createMockLane();
      const carriers = Array.from({ length: 20 }, (_, i) =>
        createMockCarrier({ id: `carrier-${i}` })
      );

      const criteria: MatchCriteria = {
        laneId: lane.id,
        loadId: load.id,
        load,
        lane,
        marketBenchmark: 2.25,
        carrierPool: carriers,
        maxResults: 3,
      };

      const result = await matcher.matchLoad(criteria);

      expect(result.recommendations.length).toBeLessThanOrEqual(3);
    });
  });
});
