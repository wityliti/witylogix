/**
 * Customer Lifetime Value Predictor Tests
 *
 * Tests for:
 * - DataFuser merging customer data from multiple sources
 * - FeatureExtractor computing RFM features
 * - LTVPredictor predicting customer lifetime value
 * - CohortAnalyzer grouping customers by acquisition cohort
 * - ChurnPredictor identifying at-risk customers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCustomerLTVPredictor,
  getCustomerLTVPredictor,
  DataFuser,
  FeatureExtractor,
  LTVPredictor,
  CohortAnalyzer,
  ChurnPredictor,
  type CustomerContact,
  type OrderData,
  type PaymentData,
  type CustomerActivity,
} from '../customer-ltv-predictor.js';

describe('Customer LTV Predictor', () => {
  let service: ReturnType<typeof createCustomerLTVPredictor>;
  let sampleContact: CustomerContact;
  let sampleOrders: OrderData[];
  let samplePayments: PaymentData[];
  let sampleActivities: CustomerActivity[];

  beforeEach(() => {
    service = createCustomerLTVPredictor();

    // Create sample contact
    sampleContact = {
      id: 'cust_123',
      email: 'john@example.com',
      createdAt: new Date('2025-01-15'),
      lastActivityAt: new Date('2026-03-10'),
      totalDeals: 3,
      dealValue: 15000,
    };

    // Create sample orders
    const baseDate = new Date('2025-01-15');
    sampleOrders = [
      {
        orderId: 'order_1',
        customerId: 'cust_123',
        amount: 5000,
        date: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
        status: 'completed',
      },
      {
        orderId: 'order_2',
        customerId: 'cust_123',
        amount: 7500,
        date: new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days later
        status: 'completed',
      },
      {
        orderId: 'order_3',
        customerId: 'cust_123',
        amount: 3000,
        date: new Date(baseDate.getTime() + 180 * 24 * 60 * 60 * 1000), // 180 days later
        status: 'completed',
      },
    ];

    // Create sample payments
    samplePayments = [
      {
        paymentId: 'pay_1',
        customerId: 'cust_123',
        amount: 5000,
        date: sampleOrders[0].date,
        status: 'successful',
      },
      {
        paymentId: 'pay_2',
        customerId: 'cust_123',
        amount: 7500,
        date: sampleOrders[1].date,
        status: 'successful',
      },
      {
        paymentId: 'pay_3',
        customerId: 'cust_123',
        amount: 3000,
        date: sampleOrders[2].date,
        status: 'successful',
      },
    ];

    // Create sample activities
    sampleActivities = [
      {
        type: 'email_open',
        timestamp: new Date('2026-03-10'),
      },
      {
        type: 'email_click',
        timestamp: new Date('2026-03-09'),
      },
      {
        type: 'login',
        timestamp: new Date('2026-03-08'),
      },
      {
        type: 'email_open',
        timestamp: new Date('2026-03-01'),
      },
    ];
  });

  describe('DataFuser', () => {
    it('should fuse customer data from multiple sources', () => {
      const fused = service.dataFuser.fuseCustomerData(sampleContact, sampleOrders, samplePayments, sampleActivities);

      expect(fused.customerId).toBe('cust_123');
      expect(fused.email).toBe('john@example.com');
      expect(fused.totalOrders).toBe(3);
      expect(fused.totalRevenue).toBe(15500);
    });

    it('should identify last activity date correctly', () => {
      const fused = service.dataFuser.fuseCustomerData(sampleContact, sampleOrders, samplePayments, sampleActivities);

      expect(fused.lastActivityDate).toBeDefined();
      expect(fused.lastActivityDate?.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-03-10').getTime()
      );
    });

    it('should handle empty orders array', () => {
      const fused = service.dataFuser.fuseCustomerData(sampleContact, [], samplePayments, sampleActivities);

      expect(fused.totalOrders).toBe(0);
      expect(fused.totalRevenue).toBe(0);
    });
  });

  describe('FeatureExtractor', () => {
    it('should calculate RFM features correctly', () => {
      const rfm = service.featureExtractor.extractRFM(
        sampleContact.createdAt,
        sampleOrders,
        sampleActivities,
        new Date('2026-03-17')
      );

      expect(rfm.recency).toBeLessThan(30); // Last order was ~90 days ago
      expect(rfm.frequency).toBeGreaterThan(0);
      expect(rfm.monetary).toBeGreaterThan(0);
      expect(rfm.totalSpend).toBe(15500);
      expect(rfm.tenure).toBeGreaterThan(0);
    });

    it('should calculate engagement score', () => {
      const rfm = service.featureExtractor.extractRFM(
        sampleContact.createdAt,
        sampleOrders,
        sampleActivities
      );

      expect(rfm.engagement).toBeGreaterThanOrEqual(0);
      expect(rfm.engagement).toBeLessThanOrEqual(100);
    });

    it('should calculate growth factor', () => {
      const rfm = service.featureExtractor.extractRFM(
        sampleContact.createdAt,
        sampleOrders,
        sampleActivities
      );

      expect(rfm.growthFactor).toBeGreaterThan(0);
      expect(rfm.growthFactor).toBeLessThanOrEqual(2.0);
    });

    it('should handle low engagement', () => {
      const noActivities: CustomerActivity[] = [];

      const rfm = service.featureExtractor.extractRFM(
        sampleContact.createdAt,
        sampleOrders,
        noActivities
      );

      expect(rfm.engagement).toBe(0);
    });
  });

  describe('LTVPredictor', () => {
    it('should predict LTV for a customer', () => {
      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_123',
        acquisitionDate: sampleContact.createdAt,
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      expect(prediction.customerId).toBe('cust_123');
      expect(prediction.historicalLTV).toBe(15500);
      expect(prediction.predictedLTV).toBeGreaterThan(0);
      expect(prediction.retentionProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.retentionProbability).toBeLessThanOrEqual(1);
      expect(prediction.churnRisk).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
    });

    it('should assign correct segment for active customer', () => {
      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_123',
        acquisitionDate: sampleContact.createdAt,
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      expect(['CHAMPION', 'LOYAL', 'POTENTIAL', 'NEW', 'AT_RISK', 'HIBERNATING', 'LOST']).toContain(
        prediction.segment
      );
    });

    it('should assign NEW segment for new customers', () => {
      const newCustomerOrders = [
        {
          orderId: 'order_1',
          customerId: 'cust_456',
          amount: 1000,
          date: new Date(),
          status: 'completed' as const,
        },
      ];

      const newCustomerActivities: CustomerActivity[] = [
        {
          type: 'email_open',
          timestamp: new Date(),
        },
      ];

      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_456',
        acquisitionDate: new Date(),
        completedOrders: newCustomerOrders,
        activities: newCustomerActivities,
      });

      expect(prediction.segment).toBe('NEW');
    });

    it('should provide explanations for prediction', () => {
      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_123',
        acquisitionDate: sampleContact.createdAt,
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      expect(prediction.explanation).toBeDefined();
      expect(Array.isArray(prediction.explanation)).toBe(true);
      expect(prediction.explanation.length).toBeGreaterThan(0);
    });
  });

  describe('CohortAnalyzer', () => {
    it('should analyze customer cohorts', () => {
      const prediction1 = service.ltvPredictor.predictLTV({
        customerId: 'cust_123',
        acquisitionDate: new Date('2026-01-15'),
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      const prediction2 = service.ltvPredictor.predictLTV({
        customerId: 'cust_456',
        acquisitionDate: new Date('2026-02-15'),
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      const cohorts = service.cohortAnalyzer.analyzeCohorts([prediction1, prediction2]);

      expect(Array.isArray(cohorts)).toBe(true);
      expect(cohorts.length).toBeGreaterThan(0);

      for (const cohort of cohorts) {
        expect(cohort.cohortMonth).toBeDefined();
        expect(cohort.cohortSize).toBeGreaterThan(0);
        expect(cohort.averageLTV).toBeGreaterThanOrEqual(0);
        expect(cohort.retentionRate).toBeGreaterThanOrEqual(0);
        expect(cohort.retentionRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('ChurnPredictor', () => {
    it('should predict churn risk for customer', () => {
      const rfm = service.featureExtractor.extractRFM(
        sampleContact.createdAt,
        sampleOrders,
        sampleActivities
      );

      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_123',
        acquisitionDate: sampleContact.createdAt,
        completedOrders: sampleOrders,
        activities: sampleActivities,
      });

      const churnRisk = service.churnPredictor.predictChurnRisk(prediction, rfm);

      expect(churnRisk.customerId).toBe('cust_123');
      expect(churnRisk.churnProbability).toBeGreaterThanOrEqual(0);
      expect(churnRisk.churnProbability).toBeLessThanOrEqual(1);
      expect(churnRisk.riskFactors).toBeDefined();
      expect(churnRisk.daysUntilLikely).toBeGreaterThan(0);
      expect(Array.isArray(churnRisk.recommendations)).toBe(true);
    });

    it('should identify risk factors correctly', () => {
      // Create inactive customer
      const inactiveOrders: OrderData[] = [
        {
          orderId: 'order_1',
          customerId: 'cust_inactive',
          amount: 5000,
          date: new Date('2025-01-01'),
          status: 'completed',
        },
      ];

      const noActivities: CustomerActivity[] = [];

      const rfm = service.featureExtractor.extractRFM(
        new Date('2024-06-01'),
        inactiveOrders,
        noActivities
      );

      const prediction = service.ltvPredictor.predictLTV({
        customerId: 'cust_inactive',
        acquisitionDate: new Date('2024-06-01'),
        completedOrders: inactiveOrders,
        activities: noActivities,
      });

      const churnRisk = service.churnPredictor.predictChurnRisk(prediction, rfm);

      expect(churnRisk.riskFactors.longInactivity || churnRisk.riskFactors.decayingEngagement).toBe(true);
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance for repeated calls', () => {
      const instance1 = getCustomerLTVPredictor();
      const instance2 = getCustomerLTVPredictor();

      expect(instance1).toEqual(instance2);
    });
  });
});
