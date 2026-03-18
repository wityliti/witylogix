/**
 * Refund Calculator
 *
 * Calculates refund amounts based on returned items and return policies.
 * Applies restocking fees and condition-based adjustments.
 */

import type {
  ReturnItem,
  ReturnPolicy,
  ItemCondition,
  RefundCalculation,
  ConditionAdjustment,
} from './types.js';

// ─── CONDITION ADJUSTMENT RATES ──────────────────────────────────

/**
 * Deduction percentages for item conditions
 * Applied to unit price when refunding
 */
const CONDITION_DEDUCTIONS: Record<ItemCondition, number> = {
  new: 0, // No deduction for new condition
  opened: 0.1, // 10% deduction for opened items
  damaged: 0.35, // 35% deduction for damaged items
  defective: 0, // No deduction for defective (manufacturer fault)
};

// ─── REFUND CALCULATIONS ────────────────────────────────────────

/**
 * Calculate total refund for a set of returned items
 *
 * Sums the refund amounts for each item and applies restocking fee.
 * Does not account for condition adjustments.
 *
 * @param items - Array of items being returned
 * @param policy - Return policy defining restocking fee
 * @returns RefundCalculation with subtotal, fee, and final amount
 */
export function calculateRefund(
  items: ReturnItem[],
  policy: ReturnPolicy
): RefundCalculation {
  // Sum up item prices
  const subtotal = items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);

  // Calculate restocking fee
  const restockingFee = calculateRestockingFee(subtotal, policy);

  // Final refund amount
  const finalRefundAmount = subtotal - restockingFee;

  return {
    subtotal,
    restockingFee,
    finalRefundAmount,
  };
}

/**
 * Calculate restocking fee based on policy percentage
 *
 * @param subtotal - Sum of item prices
 * @param policy - Return policy defining fee percentage
 * @returns Restocking fee amount
 */
export function calculateRestockingFee(
  subtotal: number,
  policy: ReturnPolicy
): number {
  return Math.round((subtotal * policy.restockingFeePercent) / 100 * 100) / 100;
}

/**
 * Adjust refund amount based on returned item condition
 *
 * Applies condition-based deductions to the original refund amount.
 * Typically applied during inspection.
 *
 * @param originalAmount - Original refund amount (before condition adjustment)
 * @param condition - Condition of the returned item
 * @returns ConditionAdjustment with adjusted amount and deduction details
 */
export function adjustForCondition(
  originalAmount: number,
  condition: ItemCondition
): ConditionAdjustment {
  const deductionPercent = CONDITION_DEDUCTIONS[condition];
  const deductionAmount = Math.round((originalAmount * deductionPercent) * 100) / 100;
  const adjustedAmount = originalAmount - deductionAmount;

  let reason = '';
  switch (condition) {
    case 'new':
      reason = 'Item returned in new condition';
      break;
    case 'opened':
      reason = 'Item opened but not used';
      break;
    case 'damaged':
      reason = 'Item damaged upon return';
      break;
    case 'defective':
      reason = 'Item defective (manufacturer fault)';
      break;
  }

  return {
    originalAmount,
    adjustedAmount,
    deductionPercent,
    reason,
  };
}

/**
 * Calculate final refund for a single item considering condition
 *
 * Combines base refund with condition-based adjustments.
 *
 * @param unitPrice - Price of individual unit
 * @param quantity - Number of units
 * @param condition - Condition of returned items
 * @returns Final refund amount for this item
 */
export function calculateItemRefund(
  unitPrice: number,
  quantity: number,
  condition: ItemCondition
): number {
  const baseAmount = unitPrice * quantity;
  const adjustment = adjustForCondition(baseAmount, condition);
  return adjustment.adjustedAmount;
}
