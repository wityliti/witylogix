/**
 * Return Service — Core RMA Orchestrator
 *
 * Manages complete return/RMA lifecycle:
 * - Create and validate return requests
 * - Approve/reject returns with shipping labels
 * - Receive and inspect returned items
 * - Calculate and process refunds
 * - Maintain return history and policies
 */

import { z } from 'zod';
import { db } from '@witylogix/db';
import type {
  ReturnRequest,
  ReturnStatus,
  ReturnPolicy,
  CreateReturnInput,
  ApproveReturnInput,
  ProcessRefundInput,
  ItemCondition,
  ReturnItem,
} from './types.js';
import { ReturnStatus as RS } from './types.js';
import {
  validateTransition,
  canTransition,
  isTerminalStatus,
  isActive,
} from './status-machine.js';
import {
  calculateRefund,
  adjustForCondition,
  calculateItemRefund,
} from './refund-calculator.js';

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  reason: z.string(),
  reasonDetails: z.string().min(10),
  items: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      productId: z.string().uuid(),
      productName: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      returnReason: z.string(),
      condition: z.enum(['new', 'opened', 'damaged', 'defective']),
    })
  ).min(1),
}).strict();

const approveReturnSchema = z.object({
  approvedBy: z.string(),
  notes: z.string().optional(),
  shippingLabelUrl: z.string().url().optional(),
  trackingNumber: z.string().optional(),
}).strict();

const inspectReturnSchema = z.object({
  condition: z.enum(['new', 'opened', 'damaged', 'defective']),
  notes: z.string().optional(),
}).strict();

// ─── RETURN SERVICE ──────────────────────────────────────────────

export class ReturnService {
  /**
   * Create a new return request
   *
   * Validates the order exists, checks return window, and creates
   * the return request in REQUESTED status. Calculates initial refund amount.
   *
   * @param input - Return request details
   * @param tenantId - Tenant ID for multi-tenancy
   * @param prisma - Prisma client for database access
   * @returns Created ReturnRequest
   */
  async createReturn(
    input: CreateReturnInput,
    tenantId: string,
    prisma: any
  ): Promise<ReturnRequest> {
    // Validate input
    const validated = createReturnSchema.parse(input);

    // Fetch order to validate it exists and get details
    const order = await db.order.findUnique({
      where: { id: validated.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error(`Order ${validated.orderId} not found`);
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Order does not belong to this tenant');
    }

    // Get return policy for tenant
    const policy = await this.getReturnPolicy(tenantId, prisma);

    // Check return window
    const orderDate = new Date(order.createdAt);
    const daysElapsed = Math.floor(
      (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysElapsed > policy.windowDays) {
      throw new Error(
        `Return window of ${policy.windowDays} days has expired`
      );
    }

    // Check max returns per order
    const existingReturns = await db.returnRequest.count({
      where: {
        orderId: validated.orderId,
        status: { not: RS.REJECTED },
      },
    });

    if (existingReturns >= policy.maxReturnsPerOrder) {
      throw new Error(
        `Maximum returns per order (${policy.maxReturnsPerOrder}) reached`
      );
    }

    // Validate items belong to order
    const orderItemIds = order.items.map((item: any) => item.id);
    const invalidItems = validated.items.filter(
      (item) => !orderItemIds.includes(item.orderItemId)
    );

    if (invalidItems.length > 0) {
      throw new Error('Some items do not belong to this order');
    }

    // Calculate refund amount
    const refundCalc = calculateRefund(validated.items as ReturnItem[], policy);
    const originalOrderTotal = order.total || 0;

    // Create return request
    const returnRequest = await db.returnRequest.create({
      data: {
        id: crypto.randomUUID(),
        orderId: validated.orderId,
        tenantId,
        customerId: validated.customerId,
        status: RS.REQUESTED,
        reason: validated.reason,
        reasonDetails: validated.reasonDetails,
        items: {
          createMany: {
            data: validated.items.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              returnReason: item.returnReason,
              condition: item.condition,
            })),
          },
        },
        refundAmount: refundCalc.finalRefundAmount,
        restockingFee: refundCalc.restockingFee,
        originalOrderTotal,
        shippingLabelUrl: null,
        trackingNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        receivedAt: null,
        refundedAt: null,
        approvedBy: null,
        notes: null,
      },
      include: { items: true },
    });

    return this.returnRequestToType(returnRequest);
  }

  /**
   * Approve a return request
   *
   * Transitions return from REQUESTED to APPROVED status.
   * Optionally generates shipping label and tracking number.
   *
   * @param id - Return ID
   * @param input - Approval details (approved by, notes, shipping info)
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async approveReturn(
    id: string,
    input: ApproveReturnInput,
    prisma: any
  ): Promise<ReturnRequest> {
    const validated = approveReturnSchema.parse(input);

    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    // Validate transition
    validateTransition(returnRequest.status, RS.APPROVED);

    // Update return
    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.APPROVED,
        approvedAt: new Date(),
        approvedBy: validated.approvedBy,
        notes: validated.notes || null,
        shippingLabelUrl: validated.shippingLabelUrl || null,
        trackingNumber: validated.trackingNumber || null,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Reject a return request
   *
   * Transitions return from REQUESTED to REJECTED status.
   *
   * @param id - Return ID
   * @param reason - Rejection reason/notes
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async rejectReturn(id: string, reason: string, prisma: any): Promise<ReturnRequest> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    // Validate transition
    validateTransition(returnRequest.status, RS.REJECTED);

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.REJECTED,
        notes: reason,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Mark return as shipped back by customer
   *
   * Transitions return to SHIPPED_BACK status.
   *
   * @param id - Return ID
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async markShippedBack(id: string, prisma: any): Promise<ReturnRequest> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    validateTransition(returnRequest.status, RS.SHIPPED_BACK);

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.SHIPPED_BACK,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Mark return items as received
   *
   * Transitions return from APPROVED/SHIPPED_BACK to RECEIVED status.
   *
   * @param id - Return ID
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async receiveReturn(id: string, prisma: any): Promise<ReturnRequest> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    validateTransition(returnRequest.status, RS.RECEIVED);

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.RECEIVED,
        receivedAt: new Date(),
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Inspect returned items and adjust refund based on condition
   *
   * Transitions return from RECEIVED to INSPECTED status.
   * Recalculates refund amount based on actual item condition.
   *
   * @param id - Return ID
   * @param condition - Assessed condition of returned items
   * @param notes - Inspection notes
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async inspectReturn(
    id: string,
    condition: ItemCondition,
    notes?: string,
    prisma?: any
  ): Promise<ReturnRequest> {
    const validated = inspectReturnSchema.parse({ condition, notes });

    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    validateTransition(returnRequest.status, RS.INSPECTED);

    // Recalculate refund based on condition
    const adjustment = adjustForCondition(
      returnRequest.refundAmount,
      validated.condition
    );

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.INSPECTED,
        refundAmount: adjustment.adjustedAmount,
        notes: validated.notes || null,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Process refund for an inspected return
   *
   * Transitions return from INSPECTED to REFUNDED status.
   * Marks the return as completed with refund processed.
   *
   * @param id - Return ID
   * @param input - Refund processing details
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async processRefund(
    id: string,
    input: ProcessRefundInput,
    prisma: any
  ): Promise<ReturnRequest> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    validateTransition(returnRequest.status, RS.REFUNDED);

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.REFUNDED,
        refundedAt: new Date(),
        notes: input.notes || null,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Close a return request
   *
   * Transitions return to CLOSED terminal status.
   *
   * @param id - Return ID
   * @param prisma - Prisma client
   * @returns Updated ReturnRequest
   */
  async closeReturn(id: string, prisma: any): Promise<ReturnRequest> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      throw new Error(`Return ${id} not found`);
    }

    validateTransition(returnRequest.status, RS.CLOSED);

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: RS.CLOSED,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    return this.returnRequestToType(updated);
  }

  /**
   * Fetch a single return request
   *
   * @param id - Return ID
   * @param tenantId - Tenant ID for authorization
   * @param prisma - Prisma client
   * @returns ReturnRequest or null if not found
   */
  async getReturn(
    id: string,
    tenantId: string,
    prisma: any
  ): Promise<ReturnRequest | null> {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!returnRequest) {
      return null;
    }

    if (returnRequest.tenantId !== tenantId) {
      throw new Error('Return does not belong to this tenant');
    }

    return this.returnRequestToType(returnRequest);
  }

  /**
   * List returns with filtering and pagination
   *
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria (status, customerId, dateRange)
   * @param pagination - Pagination options (skip, take)
   * @param prisma - Prisma client
   * @returns Paginated list of returns
   */
  async listReturns(
    tenantId: string,
    filters?: {
      status?: ReturnStatus;
      customerId?: string;
      orderId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: {
      skip?: number;
      take?: number;
    },
    prisma?: any
  ): Promise<{
    data: ReturnRequest[];
    total: number;
    skip: number;
    take: number;
  }> {
    const skip = pagination?.skip || 0;
    const take = pagination?.take || 50;

    const where: any = { tenantId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [data, total] = await Promise.all([
      db.returnRequest.findMany({
        where,
        include: { items: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.returnRequest.count({ where }),
    ]);

    return {
      data: data.map((r: any) => this.returnRequestToType(r)),
      total,
      skip,
      take,
    };
  }

  /**
   * Get return policy for a tenant
   *
   * Returns default policy if none configured.
   *
   * @param tenantId - Tenant ID
   * @param prisma - Prisma client
   * @returns ReturnPolicy
   */
  private async getReturnPolicy(
    tenantId: string,
    prisma: any
  ): Promise<ReturnPolicy> {
    const policy = await (prisma as any).returnPolicy.findFirst({
      where: { tenantId },
    });

    // Return tenant policy or default
    return (
      policy || {
        windowDays: 30,
        requiresApproval: true,
        restockingFeePercent: 15,
        freeReturnShipping: true,
        excludedCategories: [],
        maxReturnsPerOrder: 1,
      }
    );
  }

  /**
   * Convert database return record to ReturnRequest type
   *
   * @param record - Raw database record
   * @returns Typed ReturnRequest
   */
  private returnRequestToType(record: any): ReturnRequest {
    return {
      id: record.id,
      orderId: record.orderId,
      tenantId: record.tenantId,
      customerId: record.customerId,
      status: record.status,
      reason: record.reason,
      reasonDetails: record.reasonDetails,
      items: record.items || [],
      refundAmount: record.refundAmount,
      restockingFee: record.restockingFee,
      originalOrderTotal: record.originalOrderTotal,
      shippingLabelUrl: record.shippingLabelUrl,
      trackingNumber: record.trackingNumber,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      approvedAt: record.approvedAt,
      receivedAt: record.receivedAt,
      refundedAt: record.refundedAt,
      approvedBy: record.approvedBy,
      notes: record.notes,
    };
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────

export const returnService = new ReturnService();
