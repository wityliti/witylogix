/**
 * Billing Rules Engine Tests
 * Comprehensive test suite for billing rule evaluation, discounts, taxes, and combined rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BillingRuleEngine,
  createBillingRule,
  createSurcharge,
  createTier,
  type BillingRule,
  type BillingContext,
  type SubscriptionPlan,
} from '../billing-rules.js';

describe('BillingRuleEngine', () => {
  let engine: BillingRuleEngine;
  let context: BillingContext;

  beforeEach(() => {
    engine = new BillingRuleEngine();
    context = {
      deliveryId: 'deliv_123',
      customerId: 'cust_456',
      distance: 10,
      weight: 5,
      duration: 1,
      pickupTime: new Date(),
      serviceType: 'standard',
    };
  });

  describe('Per-Delivery Billing', () => {
    it('should calculate per-delivery charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Delivery', 'per-delivery', {
        baseAmount: 25,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(25);
      expect(items[0].quantity).toBe(1);
      expect(items[0].description).toContain('Per Delivery');
    });

    it('should apply minimum charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Delivery', 'per-delivery', {
        baseAmount: 5,
        minimumCharge: 15,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items[0].amount).toBe(15);
    });

    it('should apply maximum charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Delivery', 'per-delivery', {
        baseAmount: 100,
        maximumCharge: 50,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items[0].amount).toBe(50);
    });

    it('should apply surcharges to per-delivery', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Delivery', 'per-delivery', {
        baseAmount: 20,
        surcharges: [
          { name: 'Fuel Surcharge', type: 'percentage', value: 10 },
          { name: 'Peak Charge', type: 'fixed', value: 5 },
        ],
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items[0].baseAmount).toBe(20);
      expect(items[0].surchargeAmount).toBe(7); // 10% of 20 + 5
      expect(items[0].amount).toBe(27);
    });
  });

  describe('Per-Mile Billing', () => {
    it('should calculate per-mile charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Mile', 'per-mile', {
        unitRate: 2.5,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(25); // 10 miles * $2.5
      expect(items[0].quantity).toBe(10);
    });

    it('should apply tiered pricing for per-mile', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Mile Tiered', 'per-mile', {
        tiers: [
          createTier(0, 5, 3.0),
          createTier(5, 20, 2.5),
          createTier(20, null, 2.0),
        ],
      });

      const items = engine.evaluateRules(context, [rule]);

      // Cumulative (tax-bracket) tiered pricing across 10 miles:
      // (5 - 0) * $3.0 + (10 - 5) * $2.5 = 15 + 12.5 = 27.5
      expect(items[0].amount).toBe(27.5);
      expect(items[0].metadata).toEqual(expect.objectContaining({
        distance: 10,
        unitRate: 0, // tiered rule has no flat unitRate
      }));
    });

    it('should apply surcharges to per-mile', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Mile', 'per-mile', {
        unitRate: 2.0,
        surcharges: [
          { name: 'Congestion', type: 'percentage', value: 15 },
        ],
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items[0].baseAmount).toBe(20); // 10 * 2.0
      expect(items[0].surchargeAmount).toBe(3); // 15% of 20
      expect(items[0].amount).toBe(23);
    });

    it('should handle zero distance gracefully', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Mile', 'per-mile', {
        unitRate: 2.0,
      });

      const noDistanceContext = { ...context, distance: undefined };
      const items = engine.evaluateRules(noDistanceContext, [rule]);

      expect(items).toHaveLength(0);
    });
  });

  describe('Per-Hour Billing', () => {
    it('should calculate per-hour charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Hour', 'per-hour', {
        unitRate: 50,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(50); // 1 hour * $50
      expect(items[0].quantity).toBe(1);
    });

    it('should calculate multi-hour charges', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per Hour', 'per-hour', {
        unitRate: 40,
      });

      const multiHourContext = { ...context, duration: 2.5 };
      const items = engine.evaluateRules(multiHourContext, [rule]);

      expect(items[0].amount).toBe(100); // 2.5 hours * $40
    });
  });

  describe('Per-Kilogram Billing', () => {
    it('should calculate per-kg charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Per KG', 'per-kg', {
        unitRate: 1.5,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(7.5); // 5 kg * $1.5
      expect(items[0].quantity).toBe(5);
    });
  });

  describe('Flat-Rate Billing', () => {
    it('should calculate flat-rate charge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Flat Rate', 'flat-rate', {
        baseAmount: 35,
      });

      const items = engine.evaluateRules(context, [rule]);

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(35);
      expect(items[0].quantity).toBe(1);
    });
  });

  describe('Rule Applicability Filters', () => {
    it('should filter by customer ID', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'VIP Rate', 'per-delivery', {
        baseAmount: 15,
        appliesTo: {
          customerIds: ['cust_456', 'cust_789'],
        },
      });

      const items = engine.evaluateRules(context, [rule]);
      expect(items).toHaveLength(1);

      const otherCustomerContext = { ...context, customerId: 'cust_999' };
      const noItems = engine.evaluateRules(otherCustomerContext, [rule]);
      expect(noItems).toHaveLength(0);
    });

    it('should filter by delivery type', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Express Rate', 'per-delivery', {
        baseAmount: 50,
        appliesTo: {
          deliveryTypes: ['express', 'overnight'],
        },
      });

      const expressContext = { ...context, serviceType: 'express' };
      const items = engine.evaluateRules(expressContext, [rule]);
      expect(items).toHaveLength(1);

      const standardContext = { ...context, serviceType: 'standard' };
      const noItems = engine.evaluateRules(standardContext, [rule]);
      expect(noItems).toHaveLength(0);
    });

    it('should filter by time window', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Peak Hour Charge', 'per-delivery', {
        baseAmount: 10,
        surcharges: [{ name: 'Peak', type: 'percentage', value: 25 }],
        appliesTo: {
          timeWindows: [
            { dayOfWeek: 1, startHour: 8, endHour: 10 }, // Monday 8-10am
            { dayOfWeek: 1, startHour: 17, endHour: 19 }, // Monday 5-7pm
          ],
        },
      });

      // Monday 9am
      const peakContext = {
        ...context,
        pickupTime: new Date(2024, 0, 1, 9, 0), // Monday
      };
      const items = engine.evaluateRules(peakContext, [rule]);
      expect(items).toHaveLength(1);

      // Wednesday 9am
      const offPeakContext = {
        ...context,
        pickupTime: new Date(2024, 0, 3, 9, 0), // Wednesday
      };
      const noItems = engine.evaluateRules(offPeakContext, [rule]);
      expect(noItems).toHaveLength(0);
    });

    it('should respect inactive rules', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Inactive Rule', 'per-delivery', {
        baseAmount: 25,
        isActive: false,
      });

      const items = engine.evaluateRules(context, [rule]);
      expect(items).toHaveLength(0);
    });
  });

  describe('Discount Application', () => {
    it('should apply percentage discount', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const discounts = [{ type: 'percentage' as const, value: 10 }];
      const discounted = engine.applyDiscounts(items, discounts);

      expect(discounted[0].amount).toBe(90);
    });

    it('should apply fixed discount', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const discounts = [{ type: 'fixed' as const, value: 15 }];
      const discounted = engine.applyDiscounts(items, discounts);

      expect(discounted[0].amount).toBe(85);
    });

    it('should apply multiple discounts', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const discounts = [
        { type: 'percentage' as const, value: 10 },
        { type: 'fixed' as const, value: 5 },
      ];
      const discounted = engine.applyDiscounts(items, discounts);

      // Should be: 100 - (10% of 100) - 5 = 100 - 10 - 5 = 85
      expect(discounted[0].amount).toBe(85);
    });

    it('should distribute discount proportionally', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Item 1',
          quantity: 1,
          unitPrice: 60,
          amount: 60,
        },
        {
          id: 'item_2',
          invoiceId: '',
          description: 'Item 2',
          quantity: 1,
          unitPrice: 40,
          amount: 40,
        },
      ];

      const discounts = [{ type: 'percentage' as const, value: 20 }]; // 20% of $100
      const discounted = engine.applyDiscounts(items, discounts);

      expect(discounted[0].amount).toBe(48); // 60 * 0.8
      expect(discounted[1].amount).toBe(32); // 40 * 0.8
      expect(discounted[0].amount + discounted[1].amount).toBe(80);
    });
  });

  describe('Tax Calculation', () => {
    it('should calculate single tax', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const taxRules = [{ rate: 10, description: 'Sales Tax', jurisdiction: 'CA' }];
      const result = engine.calculateTax(items, taxRules);

      expect(result.total).toBe(10); // 10% of 100
      expect(result.items).toHaveLength(1);
      expect(result.items[0].amount).toBe(10);
    });

    it('should calculate multiple taxes', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const taxRules = [
        { rate: 8, description: 'Sales Tax' },
        { rate: 2, description: 'Local Tax' },
      ];
      const result = engine.calculateTax(items, taxRules);

      expect(result.total).toBe(10); // 8% + 2% of 100
      expect(result.items).toHaveLength(2);
    });

    it('should handle no taxes', () => {
      const items = [
        {
          id: 'item_1',
          invoiceId: '',
          description: 'Delivery',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        },
      ];

      const result = engine.calculateTax(items, []);

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('Combined Rules', () => {
    it('should combine base + per-mile + surcharge', () => {
      const baseRule = createBillingRule('rule_1', 'tenant_1', 'Base', 'per-delivery', {
        baseAmount: 5,
      });

      const mileRule = createBillingRule('rule_2', 'tenant_1', 'Per Mile', 'per-mile', {
        unitRate: 2,
      });

      const items = engine.evaluateRules(context, [baseRule, mileRule]);

      expect(items).toHaveLength(2);
      expect(items[0].amount).toBe(5); // Base delivery
      expect(items[1].amount).toBe(20); // 10 miles * 2
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      expect(total).toBe(25);
    });

    it('should combine rules with priority', () => {
      const rule1 = createBillingRule('rule_1', 'tenant_1', 'First Rule', 'per-delivery', {
        baseAmount: 10,
        priority: 1,
      });

      const rule2 = createBillingRule('rule_2', 'tenant_1', 'Second Rule', 'per-delivery', {
        baseAmount: 20,
        priority: 2,
      });

      const items = engine.evaluateRules(context, [rule1, rule2]);

      // Higher priority should be first in results
      expect(items[0].ruleName).toBe('Second Rule');
      expect(items[1].ruleName).toBe('First Rule');
    });
  });

  describe('Recurring Invoices (Subscriptions)', () => {
    it('should generate subscription line item', () => {
      const plan: SubscriptionPlan = {
        id: 'plan_1',
        tenantId: 'tenant_1',
        name: 'Premium Plan',
        monthlyAmount: 299,
        billingCycle: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const items = engine.generateRecurringInvoice(plan, new Date());

      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(299);
      expect(items[0].description).toContain('Premium Plan');
      expect(items[0].description).toContain('monthly');
    });

    it('should include subscription metadata', () => {
      const plan: SubscriptionPlan = {
        id: 'plan_1',
        tenantId: 'tenant_1',
        name: 'Annual Plan',
        monthlyAmount: 2400,
        billingCycle: 'annual',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const billingStart = new Date('2024-03-01');
      const items = engine.generateRecurringInvoice(plan, billingStart);

      expect(items[0].metadata).toEqual(expect.objectContaining({
        planId: 'plan_1',
        billingCycle: 'annual',
      }));
    });
  });

  describe('Conditional Surcharges', () => {
    it('should apply conditional surcharge', () => {
      const rule = createBillingRule('rule_1', 'tenant_1', 'Conditional', 'per-delivery', {
        baseAmount: 20,
        surcharges: [
          {
            name: 'Heavy Item Surcharge',
            type: 'percentage',
            value: 25,
            condition: (ctx) => (ctx.weight ?? 0) > 10,
          },
        ],
      });

      // Light item - no surcharge
      const lightContext = { ...context, weight: 5 };
      const lightItems = engine.evaluateRules(lightContext, [rule]);
      expect(lightItems[0].amount).toBe(20);

      // Heavy item - with surcharge
      const heavyContext = { ...context, weight: 15 };
      const heavyItems = engine.evaluateRules(heavyContext, [rule]);
      expect(heavyItems[0].amount).toBe(25); // 20 + (20 * 0.25)
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex delivery pricing', () => {
      // Scenario: Base fee + distance + peak surcharge + minimum
      const baseRule = createBillingRule('rule_base', 'tenant_1', 'Base Fee', 'per-delivery', {
        baseAmount: 3,
      });

      const distanceRule = createBillingRule('rule_dist', 'tenant_1', 'Distance', 'per-mile', {
        unitRate: 0.5,
        minimumCharge: 5,
      });

      const peakRule = createBillingRule('rule_peak', 'tenant_1', 'Peak Charge', 'per-delivery', {
        baseAmount: 0,
        surcharges: [
          {
            name: 'Peak Hour',
            type: 'fixed',
            value: 3,
            condition: (ctx) => {
              const hour = ctx.pickupTime?.getHours() ?? 0;
              return hour >= 17 && hour < 20;
            },
          },
        ],
      });

      const peakContext = {
        ...context,
        pickupTime: new Date(2024, 0, 1, 18, 0), // 6 PM
      };

      const items = engine.evaluateRules(peakContext, [baseRule, distanceRule, peakRule]);
      const total = items.reduce((sum, item) => sum + item.amount, 0);

      expect(total).toBeGreaterThan(0);
      expect(items.length).toBe(3);
    });
  });
});
