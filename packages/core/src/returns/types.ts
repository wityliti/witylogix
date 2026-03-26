/**
 * Returns/RMA Module Types
 *
 * Comprehensive type definitions for returns and RMA (Return Merchandise Authorization):
 * - Return status lifecycle management
 * - Return reasons and item conditions
 * - Refund calculations and policies
 * - Return request tracking with dates and approvals
 */

// ─── RETURN STATUS ENUM ──────────────────────────────────────────

export enum ReturnStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SHIPPED_BACK = 'SHIPPED_BACK',
  RECEIVED = 'RECEIVED',
  INSPECTED = 'INSPECTED',
  REFUNDED = 'REFUNDED',
  CLOSED = 'CLOSED',
}

// ─── RETURN REASON ENUM ──────────────────────────────────────────

export enum ReturnReason {
  DAMAGED = 'DAMAGED',
  WRONG_ITEM = 'WRONG_ITEM',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  CHANGED_MIND = 'CHANGED_MIND',
  DEFECTIVE = 'DEFECTIVE',
  LATE_DELIVERY = 'LATE_DELIVERY',
  OTHER = 'OTHER',
}

// ─── RETURN ITEM ────────────────────────────────────────────────

export type ItemCondition = 'new' | 'opened' | 'damaged' | 'defective';

export interface ReturnItem {
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  returnReason: ReturnReason;
  condition: ItemCondition;
}

// ─── RETURN REQUEST ─────────────────────────────────────────────

export interface ReturnRequest {
  id: string;
  orderId: string;
  tenantId: string;
  customerId: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonDetails: string;
  items: ReturnItem[];
  refundAmount: number;
  restockingFee: number;
  originalOrderTotal: number;
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  receivedAt: Date | null;
  refundedAt: Date | null;
  approvedBy: string | null;
  notes: string | null;
}

// ─── RETURN POLICY ──────────────────────────────────────────────

export interface ReturnPolicy {
  windowDays: number;
  requiresApproval: boolean;
  restockingFeePercent: number;
  freeReturnShipping: boolean;
  excludedCategories: string[];
  maxReturnsPerOrder: number;
}

// ─── INPUT TYPES ────────────────────────────────────────────────

export interface CreateReturnInput {
  orderId: string;
  customerId: string;
  reason: ReturnReason;
  reasonDetails: string;
  items: ReturnItem[];
}

export interface ApproveReturnInput {
  approvedBy: string;
  notes?: string;
  shippingLabelUrl?: string;
  trackingNumber?: string;
}

export interface ProcessRefundInput {
  paymentMethodId: string;
  notes?: string;
}

// ─── CALCULATION RESULTS ────────────────────────────────────────

export interface RefundCalculation {
  subtotal: number;
  restockingFee: number;
  finalRefundAmount: number;
  adjustmentReason?: string;
}

export interface ConditionAdjustment {
  originalAmount: number;
  adjustedAmount: number;
  deductionPercent: number;
  reason: string;
}
