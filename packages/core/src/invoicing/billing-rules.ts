/**
 * Billing Rules Engine
 * Configurable rules for calculating charges based on delivery characteristics
 * Supports per-delivery, per-mile, per-hour, per-kg, subscription, and flat-rate billing
 * with tiered pricing, surcharges, minimums, and combined rules
 */

import type { InvoiceLineItem } from './types.js';

// ─── BILLING RULE TYPES ──────────────────────────────────────────────────

export type BillingRuleType = 'per-delivery' | 'per-mile' | 'per-hour' | 'per-kg' | 'subscription' | 'flat-rate';

export interface Tier {
  min: number;
  max: number | null; // null = no upper limit
  rate: number;
}

export interface Surcharge {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  condition?: (context: BillingContext) => boolean; // Optional condition for applying surcharge
}

export interface BillingRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: BillingRuleType;
  baseAmount?: number; // For per-delivery, flat-rate
  unitRate?: number; // For per-mile, per-hour, per-kg
  tiers?: Tier[]; // For tiered pricing
  surcharges?: Surcharge[];
  minimumCharge?: number;
  maximumCharge?: number;
  isActive: boolean;
  appliesTo?: {
    customerIds?: string[];
    deliveryTypes?: string[];
    timeWindows?: Array<{
      dayOfWeek: number; // 0-6
      startHour: number;
      endHour: number;
    }>;
  };
  priority?: number; // For rule ordering (higher = applied first)
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingContext {
  deliveryId: string;
  customerId?: string;
  distance?: number; // miles/km
  weight?: number; // kg
  duration?: number; // hours
  pickupTime?: Date;
  deliveryTime?: Date;
  serviceType?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionPlan {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  monthlyAmount: number;
  includedDeliveries?: number;
  overage?: {
    rate: number;
    unit: 'per-delivery' | 'per-mile' | 'per-kg';
  };
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineItemWithMetadata extends Omit<InvoiceLineItem, 'createdAt'> {
  ruleId?: string;
  ruleName?: string;
  baseAmount?: number;
  surchargeAmount?: number;
}

// ─── BILLING RULE ENGINE ────────────────────────────────────────────────

export class BillingRuleEngine {
  /**
   * Evaluate all applicable billing rules for a delivery and generate line items
   * @param context - Delivery context with distance, weight, duration, etc.
   * @param rules - Array of billing rules to evaluate
   * @returns Array of line items generated from matching rules
   */
  evaluateRules(context: BillingContext, rules: BillingRule[]): LineItemWithMetadata[] {
    const lineItems: LineItemWithMetadata[] = [];

    // Filter and sort applicable rules
    const applicableRules = rules
      .filter(rule => this.isRuleApplicable(rule, context))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Evaluate each rule
    for (const rule of applicableRules) {
      const items = this.evaluateRule(rule, context);
      lineItems.push(...items);
    }

    return lineItems;
  }

  /**
   * Evaluate a single billing rule and generate line items
   */
  private evaluateRule(rule: BillingRule, context: BillingContext): LineItemWithMetadata[] {
    const items: LineItemWithMetadata[] = [];

    switch (rule.type) {
      case 'per-delivery':
        items.push(this.calculatePerDelivery(rule, context));
        break;

      case 'per-mile':
        if (context.distance !== undefined) {
          items.push(this.calculatePerMile(rule, context));
        }
        break;

      case 'per-hour':
        if (context.duration !== undefined) {
          items.push(this.calculatePerHour(rule, context));
        }
        break;

      case 'per-kg':
        if (context.weight !== undefined) {
          items.push(this.calculatePerKg(rule, context));
        }
        break;

      case 'flat-rate':
        items.push(this.calculateFlatRate(rule, context));
        break;

      case 'subscription':
        // Subscriptions are handled separately, not as line items
        break;
    }

    return items;
  }

  /**
   * Calculate per-delivery charge
   */
  private calculatePerDelivery(rule: BillingRule, context: BillingContext): LineItemWithMetadata {
    let amount = rule.baseAmount ?? 0;
    const baseAmount = amount;

    // Apply surcharges
    const surchargeAmount = this.calculateSurcharges(rule, context, amount);
    amount += surchargeAmount;

    // Apply minimum/maximum
    amount = this.applyLimits(amount, rule.minimumCharge, rule.maximumCharge);

    return {
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: rule.description || `${rule.name || 'Delivery Charge'} (${rule.type})`,
      deliveryId: context.deliveryId,
      quantity: 1,
      unitPrice: amount,
      amount: amount,
      ruleId: rule.id,
      ruleName: rule.name,
      baseAmount,
      surchargeAmount,
      metadata: {
        ruleType: rule.type,
        context,
      },
    };
  }

  /**
   * Calculate per-mile charge with tiered pricing support
   */
  private calculatePerMile(rule: BillingRule, context: BillingContext): LineItemWithMetadata {
    const distance = context.distance!;
    const unitRate = rule.unitRate ?? 0;

    // Apply cumulative tiered pricing if available
    let amount: number;
    if (rule.tiers && rule.tiers.length > 0) {
      amount = 0;
      for (const tier of rule.tiers) {
        if (distance <= tier.min) break;
        const segmentEnd = tier.max === null ? distance : Math.min(distance, tier.max);
        amount += (segmentEnd - tier.min) * tier.rate;
      }
    } else {
      amount = distance * unitRate;
    }
    const baseAmount = amount;

    // Apply surcharges
    const surchargeAmount = this.calculateSurcharges(rule, context, amount);
    amount += surchargeAmount;

    // Apply minimum/maximum
    amount = this.applyLimits(amount, rule.minimumCharge, rule.maximumCharge);

    return {
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: rule.name || `Distance Charge (${distance} miles)`,
      deliveryId: context.deliveryId,
      quantity: distance,
      unitPrice: unitRate,
      amount: amount,
      ruleId: rule.id,
      ruleName: rule.name,
      baseAmount,
      surchargeAmount,
      metadata: {
        ruleType: rule.type,
        distance,
        unitRate,
        context,
      },
    };
  }

  /**
   * Calculate per-hour charge
   */
  private calculatePerHour(rule: BillingRule, context: BillingContext): LineItemWithMetadata {
    const hours = context.duration!;
    const unitRate = rule.unitRate ?? 0;

    let amount = hours * unitRate;
    const baseAmount = amount;

    // Apply surcharges
    const surchargeAmount = this.calculateSurcharges(rule, context, amount);
    amount += surchargeAmount;

    // Apply minimum/maximum
    amount = this.applyLimits(amount, rule.minimumCharge, rule.maximumCharge);

    return {
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: rule.name || `Time Charge (${hours} hours)`,
      deliveryId: context.deliveryId,
      quantity: hours,
      unitPrice: unitRate,
      amount: amount,
      ruleId: rule.id,
      ruleName: rule.name,
      baseAmount,
      surchargeAmount,
      metadata: {
        ruleType: rule.type,
        hours,
        unitRate,
        context,
      },
    };
  }

  /**
   * Calculate per-kilogram charge
   */
  private calculatePerKg(rule: BillingRule, context: BillingContext): LineItemWithMetadata {
    const weight = context.weight!;
    const unitRate = rule.unitRate ?? 0;

    // Apply cumulative tiered pricing if available
    let amount: number;
    if (rule.tiers && rule.tiers.length > 0) {
      amount = 0;
      for (const tier of rule.tiers) {
        if (weight <= tier.min) break;
        const segmentEnd = tier.max === null ? weight : Math.min(weight, tier.max);
        amount += (segmentEnd - tier.min) * tier.rate;
      }
    } else {
      amount = weight * unitRate;
    }
    const baseAmount = amount;

    // Apply surcharges
    const surchargeAmount = this.calculateSurcharges(rule, context, amount);
    amount += surchargeAmount;

    // Apply minimum/maximum
    amount = this.applyLimits(amount, rule.minimumCharge, rule.maximumCharge);

    return {
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: rule.name || `Weight Charge (${weight} kg)`,
      deliveryId: context.deliveryId,
      quantity: weight,
      unitPrice: unitRate,
      amount: amount,
      ruleId: rule.id,
      ruleName: rule.name,
      baseAmount,
      surchargeAmount,
      metadata: {
        ruleType: rule.type,
        weight,
        unitRate,
        context,
      },
    };
  }

  /**
   * Calculate flat-rate charge
   */
  private calculateFlatRate(rule: BillingRule, context: BillingContext): LineItemWithMetadata {
    let amount = rule.baseAmount ?? 0;
    const baseAmount = amount;

    // Apply surcharges
    const surchargeAmount = this.calculateSurcharges(rule, context, amount);
    amount += surchargeAmount;

    // Apply minimum/maximum
    amount = this.applyLimits(amount, rule.minimumCharge, rule.maximumCharge);

    return {
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: rule.name || 'Fixed Charge',
      deliveryId: context.deliveryId,
      quantity: 1,
      unitPrice: amount,
      amount: amount,
      ruleId: rule.id,
      ruleName: rule.name,
      baseAmount,
      surchargeAmount,
      metadata: {
        ruleType: rule.type,
        context,
      },
    };
  }

  /**
   * Check if a rule is applicable to the delivery context
   */
  private isRuleApplicable(rule: BillingRule, context: BillingContext): boolean {
    if (!rule.isActive) {
      return false;
    }

    const { appliesTo } = rule;
    if (!appliesTo) {
      return true;
    }

    // Check customer applicability
    if (appliesTo.customerIds && appliesTo.customerIds.length > 0) {
      if (!context.customerId || !appliesTo.customerIds.includes(context.customerId)) {
        return false;
      }
    }

    // Check delivery type applicability
    if (appliesTo.deliveryTypes && appliesTo.deliveryTypes.length > 0) {
      if (!context.serviceType || !appliesTo.deliveryTypes.includes(context.serviceType)) {
        return false;
      }
    }

    // Check time window applicability
    if (appliesTo.timeWindows && appliesTo.timeWindows.length > 0 && context.pickupTime) {
      const hour = context.pickupTime.getHours();
      const dayOfWeek = context.pickupTime.getDay();

      const matchesWindow = appliesTo.timeWindows.some(
        window => dayOfWeek === window.dayOfWeek && hour >= window.startHour && hour < window.endHour,
      );

      if (!matchesWindow) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate total surcharges for a line item
   */
  private calculateSurcharges(rule: BillingRule, context: BillingContext, baseAmount: number): number {
    if (!rule.surcharges || rule.surcharges.length === 0) {
      return 0;
    }

    return rule.surcharges.reduce((total, surcharge) => {
      // Check if surcharge condition is met
      if (surcharge.condition && !surcharge.condition(context)) {
        return total;
      }

      const surchargeAmount =
        surcharge.type === 'percentage' ? (baseAmount * surcharge.value) / 100 : surcharge.value;

      return total + surchargeAmount;
    }, 0);
  }

  /**
   * Apply minimum and maximum charge limits
   */
  private applyLimits(amount: number, minimum?: number, maximum?: number): number {
    if (minimum !== undefined && amount < minimum) {
      return minimum;
    }

    if (maximum !== undefined && amount > maximum) {
      return maximum;
    }

    return amount;
  }

  /**
   * Generate a unique line item ID
   */
  private generateLineItemId(): string {
    return `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply discounts to line items
   * @param items - Line items to discount
   * @param discounts - Array of discount definitions
   * @returns Discounted line items
   */
  applyDiscounts(items: LineItemWithMetadata[], discounts: Array<{ type: 'percentage' | 'fixed'; value: number; description?: string }>): LineItemWithMetadata[] {
    if (!discounts || discounts.length === 0) {
      return items;
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    let totalDiscount = 0;

    for (const discount of discounts) {
      if (discount.type === 'percentage') {
        totalDiscount += (subtotal * discount.value) / 100;
      } else {
        totalDiscount += discount.value;
      }
    }

    // Distribute discount proportionally across items
    if (totalDiscount > 0) {
      const discountProportion = totalDiscount / subtotal;

      return items.map(item => ({
        ...item,
        amount: item.amount * (1 - discountProportion),
      }));
    }

    return items;
  }

  /**
   * Calculate taxes on line items
   * @param items - Line items to tax
   * @param taxRules - Tax rate configurations
   * @returns Object containing tax items and total tax amount
   */
  calculateTax(
    items: LineItemWithMetadata[],
    taxRules: Array<{ rate: number; description?: string; jurisdiction?: string }>,
  ): {
    items: Array<{ description: string; rate: number; amount: number; jurisdiction?: string }>;
    total: number;
  } {
    if (!taxRules || taxRules.length === 0) {
      return { items: [], total: 0 };
    }

    const taxableAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const taxItems = [];
    let totalTax = 0;

    for (const rule of taxRules) {
      const taxAmount = (taxableAmount * rule.rate) / 100;
      totalTax += taxAmount;

      taxItems.push({
        description: rule.description || `Tax (${rule.jurisdiction || 'N/A'})`,
        rate: rule.rate,
        amount: taxAmount,
        jurisdiction: rule.jurisdiction,
      });
    }

    return { items: taxItems, total: totalTax };
  }

  /**
   * Generate recurring invoice for subscription plans
   * @param plan - Subscription plan details
   * @param billingStartDate - Start date for this billing period
   * @returns Line items for subscription invoice
   */
  generateRecurringInvoice(plan: SubscriptionPlan, billingStartDate: Date): LineItemWithMetadata[] {
    const items: LineItemWithMetadata[] = [];

    // Base subscription charge
    items.push({
      id: this.generateLineItemId(),
      invoiceId: '', // Will be set by invoice service
      description: `${plan.name} - ${plan.billingCycle} Subscription`,
      quantity: 1,
      unitPrice: plan.monthlyAmount,
      amount: plan.monthlyAmount,
      metadata: {
        planId: plan.id,
        billingCycle: plan.billingCycle,
        billingStartDate,
      },
    });

    return items;
  }

  /**
   * Combine multiple rules' results (e.g., base + per-mile + surcharge)
   * @param baseRule - Primary billing rule
   * @param additionalRules - Additional rules to combine
   * @param context - Billing context
   * @returns Combined line items
   */
  combineRules(baseRule: BillingRule, additionalRules: BillingRule[], context: BillingContext): LineItemWithMetadata[] {
    const allRules = [baseRule, ...additionalRules];
    return this.evaluateRules(context, allRules);
  }
}

/**
 * Helper function to create a billing rule
 */
export function createBillingRule(
  id: string,
  tenantId: string,
  name: string,
  type: BillingRuleType,
  config: Partial<BillingRule> = {},
): BillingRule {
  return {
    id,
    tenantId,
    name,
    type,
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...config,
  };
}

/**
 * Helper function to create a surcharge
 */
export function createSurcharge(
  name: string,
  value: number,
  type: 'percentage' | 'fixed' = 'percentage',
  condition?: (context: BillingContext) => boolean,
): Surcharge {
  return { name, value, type, condition };
}

/**
 * Helper function to create a tier
 */
export function createTier(min: number, max: number | null, rate: number): Tier {
  return { min, max, rate };
}
