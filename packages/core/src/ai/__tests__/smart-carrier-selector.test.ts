/**
 * Smart Carrier Selector Tests
 *
 * Tests for:
 * - Multi-criteria carrier scoring
 * - Cost optimization
 * - Speed optimization
 * - Reliability tracking
 * - Green shipping scoring
 * - A/B testing infrastructure
 * - Recommendation ranking
 * - Default carrier selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSmartCarrierSelector,
  CarrierScorer,
  ReliabilityTracker,
  CostOptimizer,
  SpeedOptimizer,
  GreenShippingOptimizer,
  CarrierABTestManager,
  type CarrierRate,
  type ScoringWeights,
} from '../smart-carrier-selector.js';

describe('Smart Carrier Selector', () => {
  let selector = createSmartCarrierSelector();

  beforeEach(() => {
    selector = createSmartCarrierSelector();
  });

  // ─── Carrier Scoring ──────────────────────────────────────────────────

  describe('Carrier Scoring', () => {
    const rates: CarrierRate[] = [
      {
        carrier: 'ups',
        service: 'Ground',
        serviceCode: 'ups_ground',
        serviceLevel: 'ground',
        cost: 15.5,
        currency: 'USD',
        estimatedDays: 3,
        estimatedDeliveryDate: new Date('2026-03-19'),
      },
      {
        carrier: 'fedex',
        service: 'Express',
        serviceCode: 'fedex_express',
        serviceLevel: 'express',
        cost: 25.0,
        currency: 'USD',
        estimatedDays: 2,
        estimatedDeliveryDate: new Date('2026-03-18'),
      },
      {
        carrier: 'usps',
        service: 'Priority Mail',
        serviceCode: 'usps_priority',
        serviceLevel: 'ground',
        cost: 12.0,
        currency: 'USD',
        estimatedDays: 4,
        estimatedDeliveryDate: new Date('2026-03-20'),
      },
    ];

    it('should rank carriers by overall score', () => {
      const scorer = new CarrierScorer();
      const scores = scorer.scoreAllCarriers(rates, 'CA-NY');

      expect(scores.length).toBe(3);
      expect(scores[0].overallScore).toBeGreaterThanOrEqual(scores[1].overallScore);
      expect(scores[1].overallScore).toBeGreaterThanOrEqual(scores[2].overallScore);
    });

    it('should favor cheapest carrier when cost is prioritized', () => {
      const scorer = new CarrierScorer();
      const weights: ScoringWeights = { cost: 0.8, speed: 0.1, reliability: 0.05, tracking: 0.025, rating: 0.025 };

      const scores = scorer.scoreAllCarriers(rates, 'CA-NY', undefined, weights);

      // USPS is cheapest at $12
      expect(scores[0].carrier).toBe('usps');
    });

    it('should favor fastest carrier when speed is prioritized', () => {
      const scorer = new CarrierScorer();
      const weights: ScoringWeights = { cost: 0.1, speed: 0.8, reliability: 0.05, tracking: 0.025, rating: 0.025 };

      const scores = scorer.scoreAllCarriers(rates, 'CA-NY', undefined, weights);

      // FedEx is fastest at 2 days
      expect(scores[0].carrier).toBe('fedex');
    });

    it('should filter carriers not meeting deadline', () => {
      const scorer = new CarrierScorer();
      const deadlineDays = 2;

      const scores = scorer.scoreAllCarriers(rates, 'CA-NY', deadlineDays);

      // Only FedEx meets 2-day deadline
      expect(scores.every((s) => s.estimatedDays <= deadlineDays)).toBe(true);
    });
  });

  // ─── Recommendation ───────────────────────────────────────────────────

  describe('Carrier Recommendation', () => {
    const rates: CarrierRate[] = [
      {
        carrier: 'ups',
        service: 'Ground',
        serviceCode: 'ups_ground',
        serviceLevel: 'ground',
        cost: 15.5,
        currency: 'USD',
        estimatedDays: 3,
        estimatedDeliveryDate: new Date('2026-03-19'),
      },
      {
        carrier: 'fedex',
        service: 'Express',
        serviceCode: 'fedex_express',
        serviceLevel: 'express',
        cost: 25.0,
        currency: 'USD',
        estimatedDays: 2,
        estimatedDeliveryDate: new Date('2026-03-18'),
      },
    ];

    it('should return a recommendation with reasoning', () => {
      const recommendation = selector.recommend('tenant_1', rates, '10001', '90001');

      expect(recommendation.recommendedCarrier).toBeDefined();
      expect(recommendation.estimatedCost).toBeGreaterThan(0);
      expect(recommendation.estimatedDays).toBeGreaterThan(0);
      expect(recommendation.reasoning.length).toBeGreaterThan(0);
      expect(recommendation.score).toBeGreaterThan(0);
    });

    it('should respect deadline constraints', () => {
      const recommendation = selector.recommend('tenant_1', rates, '10001', '90001', 2);

      // Should only recommend carriers that meet 2-day deadline
      expect(recommendation.estimatedDays).toBeLessThanOrEqual(2);
    });

    it('should provide alternatives', () => {
      const recommendation = selector.recommend('tenant_1', rates, '10001', '90001');

      expect(recommendation.alternatives.length).toBeGreaterThan(0);
      expect(recommendation.alternatives[0].score).toBeLessThanOrEqual(recommendation.score);
    });

    it('should throw error when no carriers available', () => {
      expect(() => {
        selector.recommend('tenant_1', [], '10001', '90001');
      }).toThrow();
    });

    it('should throw error when no carriers meet deadline', () => {
      expect(() => {
        const tooFastRates: CarrierRate[] = [
          {
            carrier: 'usps',
            service: 'Ground',
            serviceCode: 'usps_ground',
            serviceLevel: 'ground',
            cost: 12.0,
            currency: 'USD',
            estimatedDays: 5,
            estimatedDeliveryDate: new Date('2026-03-21'),
          },
        ];
        selector.recommend('tenant_1', tooFastRates, '10001', '90001', 2);
      }).toThrow();
    });
  });

  // ─── Reliability Tracking ─────────────────────────────────────────────

  describe('Reliability Tracking', () => {
    it('should track on-time delivery rate', () => {
      const tracker = new ReliabilityTracker();

      tracker.recordShipment('ups', 'CA-NY', true, false, false, 4.5, true);
      tracker.recordShipment('ups', 'CA-NY', true, false, false, 5, true);
      tracker.recordShipment('ups', 'CA-NY', false, false, true, 3, false);

      const reliability = tracker.getReliability('ups', 'CA-NY');

      expect(reliability).toBeDefined();
      expect(reliability!.onTimeRate).toBeCloseTo(2 / 3, 1);
      expect(reliability!.sampleCount).toBe(3);
    });

    it('should track damage rate', () => {
      const tracker = new ReliabilityTracker();

      tracker.recordShipment('fedex', 'CA-TX', true, false, false, 5, true);
      tracker.recordShipment('fedex', 'CA-TX', true, true, false, 2, true);

      const reliability = tracker.getReliability('fedex', 'CA-TX');

      expect(reliability!.damageRate).toBeCloseTo(0.5, 1);
    });

    it('should track exception rate', () => {
      const tracker = new ReliabilityTracker();

      tracker.recordShipment('dhl', 'NY-LA', true, false, false, 5, true);
      tracker.recordShipment('dhl', 'NY-LA', true, false, true, 3, true);

      const reliability = tracker.getReliability('dhl', 'NY-LA');

      expect(reliability!.exceptionRate).toBeCloseTo(0.5, 1);
    });

    it('should track customer rating', () => {
      const tracker = new ReliabilityTracker();

      tracker.recordShipment('ups', 'CA-NY', true, false, false, 5, true);
      tracker.recordShipment('ups', 'CA-NY', true, false, false, 4, true);
      tracker.recordShipment('ups', 'CA-NY', true, false, false, 3, true);

      const reliability = tracker.getReliability('ups', 'CA-NY');

      expect(reliability!.customerRating).toBeCloseTo(4, 1);
    });
  });

  // ─── Cost Optimization ────────────────────────────────────────────────

  describe('Cost Optimization', () => {
    const rates: CarrierRate[] = [
      {
        carrier: 'ups',
        service: 'Ground',
        serviceCode: 'ups_ground',
        serviceLevel: 'ground',
        cost: 20.0,
        currency: 'USD',
        estimatedDays: 3,
        estimatedDeliveryDate: new Date('2026-03-19'),
      },
      {
        carrier: 'fedex',
        service: 'Express',
        serviceCode: 'fedex_express',
        serviceLevel: 'express',
        cost: 15.0,
        currency: 'USD',
        estimatedDays: 2,
        estimatedDeliveryDate: new Date('2026-03-18'),
      },
      {
        carrier: 'usps',
        service: 'Ground',
        serviceCode: 'usps_ground',
        serviceLevel: 'ground',
        cost: 10.0,
        currency: 'USD',
        estimatedDays: 5,
        estimatedDeliveryDate: new Date('2026-03-21'),
      },
    ];

    it('should find cheapest option meeting deadline', () => {
      const optimizer = new CostOptimizer();

      const cheapest = optimizer.findCheapestMeetingDeadline(rates, 3);

      expect(cheapest).toBeDefined();
      expect(cheapest!.carrier).toBe('ups');
      expect(cheapest!.cost).toBe(20.0);
    });

    it('should calculate savings potential', () => {
      const optimizer = new CostOptimizer();

      const savings = optimizer.calculateSavings(rates);

      expect(savings.cheapest).toBe(10.0);
      expect(savings.mostExpensive).toBe(20.0);
      expect(savings.savings).toBe(10.0);
      expect(savings.percentSavings).toBeCloseTo(50, 1);
    });
  });

  // ─── Speed Optimization ───────────────────────────────────────────────

  describe('Speed Optimization', () => {
    const rates: CarrierRate[] = [
      {
        carrier: 'ups',
        service: 'Ground',
        serviceCode: 'ups_ground',
        serviceLevel: 'ground',
        cost: 15.0,
        currency: 'USD',
        estimatedDays: 3,
        estimatedDeliveryDate: new Date('2026-03-19'),
      },
      {
        carrier: 'fedex',
        service: 'Overnight',
        serviceCode: 'fedex_overnight',
        serviceLevel: 'overnight',
        cost: 35.0,
        currency: 'USD',
        estimatedDays: 1,
        estimatedDeliveryDate: new Date('2026-03-17'),
      },
      {
        carrier: 'usps',
        service: 'Ground',
        serviceCode: 'usps_ground',
        serviceLevel: 'ground',
        cost: 10.0,
        currency: 'USD',
        estimatedDays: 5,
        estimatedDeliveryDate: new Date('2026-03-21'),
      },
    ];

    it('should find fastest option within budget', () => {
      const optimizer = new SpeedOptimizer();

      const fastest = optimizer.findFastestWithinBudget(rates, 30);

      expect(fastest).toBeDefined();
      expect(fastest!.carrier).toBe('ups'); // FedEx is $35, exceeds budget
      expect(fastest!.estimatedDays).toBe(3);
    });

    it('should calculate speed advantage', () => {
      const optimizer = new SpeedOptimizer();

      const advantage = optimizer.calculateSpeedAdvantage(rates);

      expect(advantage).toBe(4); // 5 days - 1 day = 4 days advantage
    });
  });

  // ─── Green Shipping ───────────────────────────────────────────────────

  describe('Green Shipping Optimization', () => {
    it('should calculate eco score', () => {
      const optimizer = new GreenShippingOptimizer();

      optimizer.setEcoInfo('ups', {
        carrier: 'ups',
        carbonOffsetPerKilo: 100,
        consolidatedShippingAvailable: true,
        renewableEnergyPercent: 50,
        ecoRating: 4,
      });

      const score = optimizer.getEcoScore('ups');

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should calculate carbon footprint', () => {
      const optimizer = new GreenShippingOptimizer();

      optimizer.setEcoInfo('fedex', {
        carrier: 'fedex',
        carbonOffsetPerKilo: 50,
        consolidatedShippingAvailable: true,
        renewableEnergyPercent: 30,
        ecoRating: 3,
      });

      const footprint = optimizer.calculateCarbonFootprint('fedex', 10, 1000);

      expect(footprint).toBeGreaterThan(0);
    });
  });

  // ─── A/B Testing ──────────────────────────────────────────────────────

  describe('A/B Testing', () => {
    it('should create and manage experiments', () => {
      const manager = new CarrierABTestManager();

      const experiment = manager.createExperiment('exp_1', 'ups', 'fedex', 50, 'onTimeRate');

      expect(experiment.experimentId).toBe('exp_1');
      expect(experiment.controlCarrier).toBe('ups');
      expect(experiment.variantCarrier).toBe('fedex');
      expect(experiment.active).toBe(true);
    });

    it('should select control or variant based on split', () => {
      const manager = new CarrierABTestManager();

      manager.createExperiment('exp_2', 'ups', 'fedex', 50);

      // Run multiple times to test split (statistically should be roughly 50/50)
      const variants: string[] = [];
      for (let i = 0; i < 100; i++) {
        const variant = manager.getVariant('exp_2');
        if (variant) variants.push(variant);
      }

      const upsCount = variants.filter((v) => v === 'ups').length;
      const fedexCount = variants.filter((v) => v === 'fedex').length;

      // Should be roughly balanced (allowing for randomness)
      expect(upsCount).toBeGreaterThan(30);
      expect(upsCount).toBeLessThan(70);
      expect(fedexCount).toBeGreaterThan(30);
      expect(fedexCount).toBeLessThan(70);
    });

    it('should record outcomes and calculate winner', () => {
      const manager = new CarrierABTestManager();

      manager.createExperiment('exp_3', 'ups', 'fedex', 50, 'onTimeRate');

      // Simulate control outcomes (70% success)
      for (let i = 0; i < 10; i++) {
        manager.recordOutcome('exp_3', 'control', 'ups', Math.random() < 0.7, Math.random());
      }

      // Simulate test outcomes (85% success)
      for (let i = 0; i < 10; i++) {
        manager.recordOutcome('exp_3', 'test', 'fedex', Math.random() < 0.85, Math.random());
      }

      const results = manager.getResults('exp_3');

      expect(results).toBeDefined();
      expect(results!.totalOutcomes).toBe(20);
      expect(results!.controlSuccessRate).toBeGreaterThan(0);
      expect(results!.testSuccessRate).toBeGreaterThan(0);
    });
  });
});
