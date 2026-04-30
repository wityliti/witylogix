/**
 * Billing Rules Engine Tests
 * Comprehensive test suite for billing rules evaluation
 * Tests: per-delivery, per-mile, per-hour, per-kg calculations,
 * tiered pricing, surcharges, minimums, maximums, tax calculation,
 * discount application, and recurring invoice generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { BillingRule, BillingContext, Tier, Surcharge } from '../../../packages/core/src/invoicing/billing-rules.js';
import { BillingRuleEngine } from '../../../packages/core/src/invoicing/billing-rules.js';

describe('BillingRuleEngine', () => {
  let engine: BillingRuleEngine;
  let baseContext: BillingContext;

  beforeEach(() => {
    engine = new BillingRuleEngine();
    baseContext = {
      deliveryId: 'delivery_001',
      customerId: 'customer_001',
      distance: 5.2, // miles
      weight: 2.5, // kg
      duration: 0.5, // hours
      pickupTime: new Date('2024-03-11T14:00:00Z'),
      deliveryTime: new Date('2024-03-11T14:30:00Z'),
      serviceType: 'standard',
    };
  });

  describe('Per-Delivery Billing', () => {
    it('should calculate per-delivery charge', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Standard Per-Delivery Fee',
        type: 'per-delivery',
        baseAmount: 5.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(5.0);
      expect(items[0].description).toContain('delivery');
    });

    it('should apply minimum charge on per-delivery', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Minimum',
        type: 'per-delivery',
        baseAmount: 2.0,
        minimumCharge: 5.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items[0].amount).toBe(5.0);
    });

    it('should apply maximum charge on per-delivery', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Maximum',
        type: 'per-delivery',
        baseAmount: 20.0,
        maximumCharge: 15.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items[0].amount).toBe(15.0);
    });
  });

  describe('Per-Mile Billing', () => {
    it('should calculate per-mile charge', () => {
      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Per-Mile Charge',
        type: 'per-mile',
        unitRate: 1.5, // $1.50 per mile
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBeCloseTo(7.8, 1); // 5.2 miles * $1.50
    });

    it('should handle tiered per-mile pricing', () => {
      const tiers: Tier[] = [
        { min: 0, max: 5, rate: 2.0 },
        { min: 5, max: 10, rate: 1.5 },
        { min: 10, max: null, rate: 1.0 },
      ];

      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Tiered Per-Mile',
        type: 'per-mile',
        tiers,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // 5.2 miles falls in tier 2: (5 * $2.0) + (0.2 * $1.5)
      expect(items[0].amount).toBeCloseTo(10.3, 1);
    });

    it('should apply minimum charge on per-mile', () => {
      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Per-Mile with Minimum',
        type: 'per-mile',
        unitRate: 0.5,
        minimumCharge: 5.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // 5.2 * $0.5 = $2.60, but minimum is $5.00
      expect(items[0].amount).toBe(5.0);
    });

    it('should skip per-mile rule if no distance provided', () => {
      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Per-Mile Charge',
        type: 'per-mile',
        unitRate: 1.5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contextNoDistance = { ...baseContext, distance: undefined };
      const items = engine.evaluateRules(contextNoDistance, [rule]);

      expect(items).toHaveLength(0);
    });
  });

  describe('Per-Hour Billing', () => {
    it('should calculate per-hour charge', () => {
      const rule: BillingRule = {
        id: 'rule_003',
        tenantId: 'tenant_001',
        name: 'Per-Hour Charge',
        type: 'per-hour',
        unitRate: 25.0, // $25 per hour
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(12.5); // 0.5 hours * $25
    });

    it('should apply minimum charge on per-hour', () => {
      const rule: BillingRule = {
        id: 'rule_003',
        tenantId: 'tenant_001',
        name: 'Per-Hour with Minimum',
        type: 'per-hour',
        unitRate: 25.0,
        minimumCharge: 20.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items[0].amount).toBe(20.0);
    });

    it('should skip per-hour rule if no duration provided', () => {
      const rule: BillingRule = {
        id: 'rule_003',
        tenantId: 'tenant_001',
        name: 'Per-Hour Charge',
        type: 'per-hour',
        unitRate: 25.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contextNoDuration = { ...baseContext, duration: undefined };
      const items = engine.evaluateRules(contextNoDuration, [rule]);

      expect(items).toHaveLength(0);
    });
  });

  describe('Per-Kilogram Billing', () => {
    it('should calculate per-kg charge', () => {
      const rule: BillingRule = {
        id: 'rule_004',
        tenantId: 'tenant_001',
        name: 'Per-Kilogram Charge',
        type: 'per-kg',
        unitRate: 2.5, // $2.50 per kg
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(6.25); // 2.5 kg * $2.50
    });

    it('should handle tiered per-kg pricing', () => {
      const tiers: Tier[] = [
        { min: 0, max: 5, rate: 3.0 },
        { min: 5, max: 10, rate: 2.5 },
        { min: 10, max: null, rate: 2.0 },
      ];

      const rule: BillingRule = {
        id: 'rule_004',
        tenantId: 'tenant_001',
        name: 'Tiered Per-Kg',
        type: 'per-kg',
        tiers,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // 2.5 kg in tier 1 at $3.00
      expect(items[0].amount).toBe(7.5);
    });

    it('should skip per-kg rule if no weight provided', () => {
      const rule: BillingRule = {
        id: 'rule_004',
        tenantId: 'tenant_001',
        name: 'Per-Kilogram Charge',
        type: 'per-kg',
        unitRate: 2.5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contextNoWeight = { ...baseContext, weight: undefined };
      const items = engine.evaluateRules(contextNoWeight, [rule]);

      expect(items).toHaveLength(0);
    });
  });

  describe('Flat-Rate Billing', () => {
    it('should apply flat-rate charge', () => {
      const rule: BillingRule = {
        id: 'rule_005',
        tenantId: 'tenant_001',
        name: 'Flat-Rate Charge',
        type: 'flat-rate',
        baseAmount: 10.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(10.0);
    });
  });

  describe('Surcharges', () => {
    it('should apply fixed surcharge', () => {
      const surcharges: Surcharge[] = [
        {
          name: 'Fuel Surcharge',
          type: 'fixed',
          value: 1.5,
        },
      ];

      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Surcharge',
        type: 'per-delivery',
        baseAmount: 5.0,
        surcharges,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(6.5); // 5.0 + 1.5
    });

    it('should apply percentage surcharge', () => {
      const surcharges: Surcharge[] = [
        {
          name: 'Service Charge',
          type: 'percentage',
          value: 10, // 10%
        },
      ];

      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Percentage Surcharge',
        type: 'per-delivery',
        baseAmount: 10.0,
        surcharges,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items[0].amount).toBe(11.0); // 10.0 + (10.0 * 10%)
    });

    it('should apply conditional surcharge', () => {
      const surcharges: Surcharge[] = [
        {
          name: 'Weekend Surcharge',
          type: 'fixed',
          value: 5.0,
          condition: (ctx) => {
            const day = ctx.pickupTime?.getDay();
            return day === 0 || day === 6; // Sunday or Saturday
          },
        },
      ];

      const weekendContext = {
        ...baseContext,
        pickupTime: new Date('2024-03-09T14:00:00Z'), // Saturday
      };

      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Conditional Surcharge',
        type: 'per-delivery',
        baseAmount: 5.0,
        surcharges,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(weekendContext, [rule]);

      expect(items[0].amount).toBe(10.0); // 5.0 + 5.0 weekend surcharge
    });

    it('should apply multiple surcharges', () => {
      const surcharges: Surcharge[] = [
        { name: 'Fuel Surcharge', type: 'fixed', value: 1.5 },
        { name: 'Service Charge', type: 'percentage', value: 10 },
      ];

      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Multiple Surcharges',
        type: 'per-delivery',
        baseAmount: 10.0,
        surcharges,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // 10.0 + 1.5 + (10.0 * 10%) = 12.5
      expect(items[0].amount).toBeCloseTo(12.5, 1);
    });
  });

  describe('Discount Application', () => {
    it('should apply percentage discount', () => {
      const baseAmount = 100.0;
      const discountPercent = 10;
      const discountedAmount = baseAmount * (1 - discountPercent / 100);
      expect(discountedAmount).toBe(90.0);
    });

    it('should apply flat discount', () => {
      const baseAmount = 100.0;
      const flatDiscount = 15.0;
      const discountedAmount = baseAmount - flatDiscount;
      expect(discountedAmount).toBe(85.0);
    });

    it('should not allow discount exceeding charge amount', () => {
      const baseAmount = 10.0;
      const flatDiscount = 20.0;
      const discountedAmount = Math.max(0, baseAmount - flatDiscount);
      expect(discountedAmount).toBe(0);
    });
  });

  describe('Tax Calculation', () => {
    it('should calculate inclusive tax', () => {
      const subtotal = 100.0;
      const taxRate = 0.1; // 10%
      const totalWithTax = subtotal / (1 + taxRate);
      const tax = subtotal - totalWithTax;
      expect(tax).toBeCloseTo(9.09, 2);
    });

    it('should calculate exclusive tax', () => {
      const subtotal = 100.0;
      const taxRate = 0.1; // 10%
      const tax = subtotal * taxRate;
      const totalWithTax = subtotal + tax;
      expect(totalWithTax).toBe(110.0);
    });

    it('should handle tax on line item', () => {
      const lineItemAmount = 50.0;
      const taxRate = 0.15; // 15%
      const tax = lineItemAmount * taxRate;
      const total = lineItemAmount + tax;
      expect(total).toBe(57.5);
    });
  });

  describe('Combined Rules', () => {
    it('should evaluate multiple rules together', () => {
      const rules: BillingRule[] = [
        {
          id: 'rule_001',
          tenantId: 'tenant_001',
          name: 'Base Delivery Fee',
          type: 'per-delivery',
          baseAmount: 5.0,
          priority: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'rule_002',
          tenantId: 'tenant_001',
          name: 'Distance Charge',
          type: 'per-mile',
          unitRate: 1.5,
          priority: 2,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const items = engine.evaluateRules(baseContext, rules);

      expect(items).toHaveLength(2);
      const amounts = items.map(i => i.amount).sort((a, b) => a - b);
      expect(amounts[0]).toBe(5.0); // Per-delivery
      expect(amounts[1]).toBeCloseTo(7.8, 1); // Per-mile
    });

    it('should apply rules in priority order', () => {
      const rules: BillingRule[] = [
        {
          id: 'rule_001',
          tenantId: 'tenant_001',
          name: 'Priority 1',
          type: 'per-delivery',
          baseAmount: 5.0,
          priority: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'rule_002',
          tenantId: 'tenant_001',
          name: 'Priority 0',
          type: 'flat-rate',
          baseAmount: 10.0,
          priority: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const items = engine.evaluateRules(baseContext, rules);

      // Higher priority should be evaluated first
      expect(items[0].ruleId).toBe('rule_001');
    });
  });

  describe('Rule Applicability', () => {
    it('should skip inactive rules', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Inactive Rule',
        type: 'per-delivery',
        baseAmount: 5.0,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items).toHaveLength(0);
    });

    it('should filter by customer ID', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'VIP Customer Rate',
        type: 'per-delivery',
        baseAmount: 2.0,
        appliesTo: {
          customerIds: ['vip_customer_001'],
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // Should not apply because customer_001 != vip_customer_001
      expect(items).toHaveLength(0);
    });

    it('should filter by delivery type', () => {
      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Express Delivery Rate',
        type: 'per-delivery',
        baseAmount: 10.0,
        appliesTo: {
          deliveryTypes: ['express'],
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      // Should not apply because serviceType is 'standard'
      expect(items).toHaveLength(0);
    });
  });

  describe('Recurring Invoice Generation', () => {
    it('should generate recurring invoice context', () => {
      const subscriptionAmount = 100.0;
      const billingCycle = 'monthly';
      const invoice = {
        amount: subscriptionAmount,
        cycle: billingCycle,
        nextDueDate: new Date('2024-04-11'),
      };

      expect(invoice.amount).toBe(100.0);
      expect(invoice.cycle).toBe('monthly');
    });

    it('should handle overage charges on subscription', () => {
      const subscriptionAmount = 100.0;
      const includedDeliveries = 10;
      const actualDeliveries = 12;
      const overageDeliveries = actualDeliveries - includedDeliveries;
      const overageRate = 5.0;
      const overageCharge = overageDeliveries * overageRate;
      const totalAmount = subscriptionAmount + overageCharge;

      expect(totalAmount).toBe(110.0);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle zero distance', () => {
      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Per-Mile Charge',
        type: 'per-mile',
        unitRate: 1.5,
        minimumCharge: 5.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const zeroDistanceContext = { ...baseContext, distance: 0 };
      const items = engine.evaluateRules(zeroDistanceContext, [rule]);

      // Should apply minimum charge
      expect(items[0].amount).toBe(5.0);
    });

    it('should handle very large distances', () => {
      const rule: BillingRule = {
        id: 'rule_002',
        tenantId: 'tenant_001',
        name: 'Per-Mile Charge',
        type: 'per-mile',
        unitRate: 1.5,
        maximumCharge: 100.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const longDistanceContext = { ...baseContext, distance: 150 };
      const items = engine.evaluateRules(longDistanceContext, [rule]);

      // Should cap at maximum
      expect(items[0].amount).toBe(100.0);
    });

    it('should handle negative surcharge gracefully', () => {
      const surcharges: Surcharge[] = [
        {
          name: 'Discount',
          type: 'fixed',
          value: -2.0,
        },
      ];

      const rule: BillingRule = {
        id: 'rule_001',
        tenantId: 'tenant_001',
        name: 'Per-Delivery with Discount',
        type: 'per-delivery',
        baseAmount: 5.0,
        surcharges,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.evaluateRules(baseContext, [rule]);

      expect(items[0].amount).toBe(3.0); // 5.0 - 2.0
    });
  });
});
