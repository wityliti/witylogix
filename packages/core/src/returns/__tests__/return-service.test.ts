import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ReturnItem,
  ReturnPolicy,
  ItemCondition,
} from '../types';
import { ReturnStatus } from '../types';
import {
  calculateRefund,
  adjustForCondition,
  calculateRestockingFee,
  calculateItemRefund,
} from '../refund-calculator';
import {
  canTransition,
  getNextStatuses,
  validateTransition,
  isTerminalStatus,
  isActive,
} from '../status-machine';

describe('Returns Service Tests', () => {
  // ──────────────────────────────────────────────────────────────
  // REFUND CALCULATOR TESTS
  // ──────────────────────────────────────────────────────────────

  describe('calculateRefund()', () => {
    const defaultPolicy: ReturnPolicy = {
      windowDays: 30,
      requiresApproval: true,
      restockingFeePercent: 15,
      freeReturnShipping: true,
      excludedCategories: [],
      maxReturnsPerOrder: 1,
    };

    it('should calculate refund with single item', () => {
      const items: ReturnItem[] = [
        {
          orderItemId: '1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 1,
          unitPrice: 100,
          returnReason: 'CHANGED_MIND',
          condition: 'new',
        },
      ];

      const result = calculateRefund(items, defaultPolicy);

      expect(result.subtotal).toBe(100);
      expect(result.restockingFee).toBe(15);
      expect(result.finalRefundAmount).toBe(85);
    });

    it('should calculate refund with multiple items', () => {
      const items: ReturnItem[] = [
        {
          orderItemId: '1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 2,
          unitPrice: 50,
          returnReason: 'CHANGED_MIND',
          condition: 'new',
        },
        {
          orderItemId: '2',
          productId: 'prod-2',
          productName: 'Gadget',
          quantity: 1,
          unitPrice: 200,
          returnReason: 'DEFECTIVE',
          condition: 'defective',
        },
      ];

      const result = calculateRefund(items, defaultPolicy);

      expect(result.subtotal).toBe(300); // 100 + 200
      expect(result.restockingFee).toBe(45); // 15% of 300
      expect(result.finalRefundAmount).toBe(255);
    });

    it('should handle zero restocking fee policy', () => {
      const policyNoFee: ReturnPolicy = { ...defaultPolicy, restockingFeePercent: 0 };
      const items: ReturnItem[] = [
        {
          orderItemId: '1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 1,
          unitPrice: 100,
          returnReason: 'CHANGED_MIND',
          condition: 'new',
        },
      ];

      const result = calculateRefund(items, policyNoFee);

      expect(result.restockingFee).toBe(0);
      expect(result.finalRefundAmount).toBe(100);
    });

    it('should handle high restocking fee policy', () => {
      const policyHighFee: ReturnPolicy = { ...defaultPolicy, restockingFeePercent: 30 };
      const items: ReturnItem[] = [
        {
          orderItemId: '1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 1,
          unitPrice: 100,
          returnReason: 'CHANGED_MIND',
          condition: 'new',
        },
      ];

      const result = calculateRefund(items, policyHighFee);

      expect(result.restockingFee).toBe(30);
      expect(result.finalRefundAmount).toBe(70);
    });
  });

  describe('calculateRestockingFee()', () => {
    const defaultPolicy: ReturnPolicy = {
      windowDays: 30,
      requiresApproval: true,
      restockingFeePercent: 15,
      freeReturnShipping: true,
      excludedCategories: [],
      maxReturnsPerOrder: 1,
    };

    it('should calculate restocking fee correctly', () => {
      const fee = calculateRestockingFee(100, defaultPolicy);
      expect(fee).toBe(15);
    });

    it('should handle decimal amounts', () => {
      const fee = calculateRestockingFee(99.99, defaultPolicy);
      expect(fee).toBeCloseTo(14.99, 2);
    });

    it('should round to 2 decimal places', () => {
      const fee = calculateRestockingFee(123.45, defaultPolicy);
      expect(fee).toBe(18.52);
    });

    it('should handle zero subtotal', () => {
      const fee = calculateRestockingFee(0, defaultPolicy);
      expect(fee).toBe(0);
    });
  });

  describe('adjustForCondition()', () => {
    it('should apply no deduction for new condition', () => {
      const adjustment = adjustForCondition(100, 'new');

      expect(adjustment.originalAmount).toBe(100);
      expect(adjustment.adjustedAmount).toBe(100);
      expect(adjustment.deductionPercent).toBe(0);
      expect(adjustment.reason).toBe('Item returned in new condition');
    });

    it('should apply 10% deduction for opened condition', () => {
      const adjustment = adjustForCondition(100, 'opened');

      expect(adjustment.originalAmount).toBe(100);
      expect(adjustment.adjustedAmount).toBe(90);
      expect(adjustment.deductionPercent).toBe(0.1);
      expect(adjustment.reason).toBe('Item opened but not used');
    });

    it('should apply 35% deduction for damaged condition', () => {
      const adjustment = adjustForCondition(100, 'damaged');

      expect(adjustment.originalAmount).toBe(100);
      expect(adjustment.adjustedAmount).toBe(65);
      expect(adjustment.deductionPercent).toBe(0.35);
      expect(adjustment.reason).toBe('Item damaged upon return');
    });

    it('should apply no deduction for defective condition', () => {
      const adjustment = adjustForCondition(100, 'defective');

      expect(adjustment.originalAmount).toBe(100);
      expect(adjustment.adjustedAmount).toBe(100);
      expect(adjustment.deductionPercent).toBe(0);
      expect(adjustment.reason).toBe('Item defective (manufacturer fault)');
    });

    it('should handle decimal amounts correctly', () => {
      const adjustment = adjustForCondition(99.99, 'opened');

      expect(adjustment.adjustedAmount).toBeCloseTo(89.99, 2);
    });

    it('should handle large amounts', () => {
      const adjustment = adjustForCondition(5000, 'damaged');

      expect(adjustment.adjustedAmount).toBe(3250);
    });
  });

  describe('calculateItemRefund()', () => {
    it('should calculate refund for new items', () => {
      const refund = calculateItemRefund(100, 2, 'new');
      expect(refund).toBe(200);
    });

    it('should calculate refund for opened items with deduction', () => {
      const refund = calculateItemRefund(100, 2, 'opened');
      expect(refund).toBe(180); // 200 - 10%
    });

    it('should calculate refund for damaged items with significant deduction', () => {
      const refund = calculateItemRefund(100, 1, 'damaged');
      expect(refund).toBe(65); // 100 - 35%
    });

    it('should calculate refund for defective items without deduction', () => {
      const refund = calculateItemRefund(100, 3, 'defective');
      expect(refund).toBe(300);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // STATUS MACHINE TESTS
  // ──────────────────────────────────────────────────────────────

  describe('canTransition()', () => {
    it('should allow REQUESTED to APPROVED', () => {
      expect(canTransition(ReturnStatus.REQUESTED, ReturnStatus.APPROVED)).toBe(true);
    });

    it('should allow REQUESTED to REJECTED', () => {
      expect(canTransition(ReturnStatus.REQUESTED, ReturnStatus.REJECTED)).toBe(true);
    });

    it('should not allow REQUESTED to SHIPPED_BACK', () => {
      expect(canTransition(ReturnStatus.REQUESTED, ReturnStatus.SHIPPED_BACK)).toBe(false);
    });

    it('should allow APPROVED to SHIPPED_BACK', () => {
      expect(canTransition(ReturnStatus.APPROVED, ReturnStatus.SHIPPED_BACK)).toBe(true);
    });

    it('should allow APPROVED to REJECTED', () => {
      expect(canTransition(ReturnStatus.APPROVED, ReturnStatus.REJECTED)).toBe(true);
    });

    it('should allow SHIPPED_BACK to RECEIVED', () => {
      expect(canTransition(ReturnStatus.SHIPPED_BACK, ReturnStatus.RECEIVED)).toBe(true);
    });

    it('should allow SHIPPED_BACK to CLOSED', () => {
      expect(canTransition(ReturnStatus.SHIPPED_BACK, ReturnStatus.CLOSED)).toBe(true);
    });

    it('should allow RECEIVED to INSPECTED', () => {
      expect(canTransition(ReturnStatus.RECEIVED, ReturnStatus.INSPECTED)).toBe(true);
    });

    it('should allow RECEIVED to CLOSED', () => {
      expect(canTransition(ReturnStatus.RECEIVED, ReturnStatus.CLOSED)).toBe(true);
    });

    it('should allow INSPECTED to REFUNDED', () => {
      expect(canTransition(ReturnStatus.INSPECTED, ReturnStatus.REFUNDED)).toBe(true);
    });

    it('should allow INSPECTED to REJECTED', () => {
      expect(canTransition(ReturnStatus.INSPECTED, ReturnStatus.REJECTED)).toBe(true);
    });

    it('should allow REFUNDED to CLOSED', () => {
      expect(canTransition(ReturnStatus.REFUNDED, ReturnStatus.CLOSED)).toBe(true);
    });

    it('should not allow transitions from CLOSED', () => {
      expect(canTransition(ReturnStatus.CLOSED, ReturnStatus.APPROVED)).toBe(false);
      expect(canTransition(ReturnStatus.CLOSED, ReturnStatus.CLOSED)).toBe(false);
    });

    it('should not allow invalid transitions', () => {
      expect(canTransition(ReturnStatus.REQUESTED, ReturnStatus.REFUNDED)).toBe(false);
      expect(canTransition(ReturnStatus.APPROVED, ReturnStatus.RECEIVED)).toBe(false);
    });
  });

  describe('getNextStatuses()', () => {
    it('should return valid next statuses from REQUESTED', () => {
      const next = getNextStatuses(ReturnStatus.REQUESTED);
      expect(next).toEqual([ReturnStatus.APPROVED, ReturnStatus.REJECTED]);
    });

    it('should return valid next statuses from APPROVED', () => {
      const next = getNextStatuses(ReturnStatus.APPROVED);
      expect(next).toEqual([ReturnStatus.SHIPPED_BACK, ReturnStatus.REJECTED]);
    });

    it('should return valid next statuses from SHIPPED_BACK', () => {
      const next = getNextStatuses(ReturnStatus.SHIPPED_BACK);
      expect(next).toEqual([ReturnStatus.RECEIVED, ReturnStatus.CLOSED]);
    });

    it('should return valid next statuses from RECEIVED', () => {
      const next = getNextStatuses(ReturnStatus.RECEIVED);
      expect(next).toEqual([ReturnStatus.INSPECTED, ReturnStatus.CLOSED]);
    });

    it('should return valid next statuses from INSPECTED', () => {
      const next = getNextStatuses(ReturnStatus.INSPECTED);
      expect(next).toEqual([ReturnStatus.REFUNDED, ReturnStatus.REJECTED]);
    });

    it('should return valid next statuses from REFUNDED', () => {
      const next = getNextStatuses(ReturnStatus.REFUNDED);
      expect(next).toEqual([ReturnStatus.CLOSED]);
    });

    it('should return empty array for CLOSED', () => {
      const next = getNextStatuses(ReturnStatus.CLOSED);
      expect(next).toEqual([]);
    });

    it('should return empty array for REJECTED', () => {
      const next = getNextStatuses(ReturnStatus.REJECTED);
      expect(next).toEqual([ReturnStatus.CLOSED]);
    });
  });

  describe('validateTransition()', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        validateTransition(ReturnStatus.REQUESTED, ReturnStatus.APPROVED);
      }).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => {
        validateTransition(ReturnStatus.REQUESTED, ReturnStatus.REFUNDED);
      }).toThrow(/Invalid status transition/);
    });

    it('should throw error with helpful message', () => {
      expect(() => {
        validateTransition(ReturnStatus.REQUESTED, ReturnStatus.SHIPPED_BACK);
      }).toThrow(/Allowed transitions.*APPROVED.*REJECTED/);
    });

    it('should throw when transitioning from terminal status', () => {
      expect(() => {
        validateTransition(ReturnStatus.CLOSED, ReturnStatus.APPROVED);
      }).toThrow(/Invalid status transition/);
    });
  });

  describe('isTerminalStatus()', () => {
    it('should return true for CLOSED', () => {
      expect(isTerminalStatus(ReturnStatus.CLOSED)).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(isTerminalStatus(ReturnStatus.REQUESTED)).toBe(false);
      expect(isTerminalStatus(ReturnStatus.APPROVED)).toBe(false);
      expect(isTerminalStatus(ReturnStatus.SHIPPED_BACK)).toBe(false);
      expect(isTerminalStatus(ReturnStatus.RECEIVED)).toBe(false);
      expect(isTerminalStatus(ReturnStatus.INSPECTED)).toBe(false);
      expect(isTerminalStatus(ReturnStatus.REFUNDED)).toBe(false);
    });

    it('should return false for REJECTED', () => {
      expect(isTerminalStatus(ReturnStatus.REJECTED)).toBe(false);
    });
  });

  describe('isActive()', () => {
    it('should return false for CLOSED', () => {
      expect(isActive(ReturnStatus.CLOSED)).toBe(false);
    });

    it('should return true for non-terminal statuses', () => {
      expect(isActive(ReturnStatus.REQUESTED)).toBe(true);
      expect(isActive(ReturnStatus.APPROVED)).toBe(true);
      expect(isActive(ReturnStatus.SHIPPED_BACK)).toBe(true);
      expect(isActive(ReturnStatus.RECEIVED)).toBe(true);
      expect(isActive(ReturnStatus.INSPECTED)).toBe(true);
      expect(isActive(ReturnStatus.REFUNDED)).toBe(true);
      expect(isActive(ReturnStatus.REJECTED)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // LIFECYCLE TESTS
  // ──────────────────────────────────────────────────────────────

  describe('Complete return lifecycle transitions', () => {
    it('should allow full happy path: REQUESTED -> APPROVED -> SHIPPED_BACK -> RECEIVED -> INSPECTED -> REFUNDED -> CLOSED', () => {
      let status: ReturnStatus = ReturnStatus.REQUESTED;

      status = ReturnStatus.APPROVED;
      expect(canTransition(ReturnStatus.REQUESTED, status)).toBe(true);

      status = ReturnStatus.SHIPPED_BACK;
      expect(canTransition(ReturnStatus.APPROVED, status)).toBe(true);

      status = ReturnStatus.RECEIVED;
      expect(canTransition(ReturnStatus.SHIPPED_BACK, status)).toBe(true);

      status = ReturnStatus.INSPECTED;
      expect(canTransition(ReturnStatus.RECEIVED, status)).toBe(true);

      status = ReturnStatus.REFUNDED;
      expect(canTransition(ReturnStatus.INSPECTED, status)).toBe(true);

      status = ReturnStatus.CLOSED;
      expect(canTransition(ReturnStatus.REFUNDED, status)).toBe(true);
    });

    it('should allow rejection from REQUESTED', () => {
      expect(canTransition(ReturnStatus.REQUESTED, ReturnStatus.REJECTED)).toBe(true);
      expect(canTransition(ReturnStatus.REJECTED, ReturnStatus.CLOSED)).toBe(true);
    });

    it('should allow rejection from APPROVED', () => {
      expect(canTransition(ReturnStatus.APPROVED, ReturnStatus.REJECTED)).toBe(true);
      expect(canTransition(ReturnStatus.REJECTED, ReturnStatus.CLOSED)).toBe(true);
    });

    it('should allow inspection rejection path', () => {
      let status = ReturnStatus.REQUESTED;
      expect(canTransition(status, (status = ReturnStatus.APPROVED))).toBe(true);
      expect(canTransition(status, (status = ReturnStatus.SHIPPED_BACK))).toBe(true);
      expect(canTransition(status, (status = ReturnStatus.RECEIVED))).toBe(true);
      expect(canTransition(status, (status = ReturnStatus.INSPECTED))).toBe(true);
      expect(canTransition(status, ReturnStatus.REJECTED)).toBe(true);
    });
  });
});
