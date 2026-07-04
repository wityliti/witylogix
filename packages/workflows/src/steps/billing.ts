/**
 * Billing Step
 * Creates billing record for completed delivery
 * Compensation: void/cancel billing record
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface TriggerBillingInput {
  orderId: string;
  shipmentId?: string;
  shopId: string;
  driverId?: string;
  shippingCost: number;
  codAmount?: number;
  insuranceAmount?: number;
  discountAmount?: number;
  notes?: string;
}

export interface TriggerBillingOutput {
  billingId: string;
  orderId: string;
  totalAmount: number;
  billingStatus: string;
  createdAt: Date;
}

export const triggerBillingStep: WorkflowStep<
  TriggerBillingInput,
  TriggerBillingOutput
> = {
  name: "triggerBilling",
  description: "Create billing record for completed delivery",

  async invoke(
    input: TriggerBillingInput,
    context: WorkflowContext,
  ): Promise<StepResult<TriggerBillingOutput>> {
    const logger = context.logger;
    logger?.info("Creating billing record", {
      orderId: input.orderId,
      shippingCost: input.shippingCost,
    });

    try {
      const prisma = context.prisma as any;

      // ─── Validate Input ────────────────────────────────────────────
      if (!input.orderId || input.orderId.trim().length === 0) {
        return {
          success: false,
          error: "Order ID is required for billing",
          code: "INVALID_ORDER_ID",
        };
      }

      if (input.shippingCost < 0) {
        return {
          success: false,
          error: "Shipping cost cannot be negative",
          code: "INVALID_SHIPPING_COST",
        };
      }

      if (input.codAmount && input.codAmount < 0) {
        return {
          success: false,
          error: "COD amount cannot be negative",
          code: "INVALID_COD_AMOUNT",
        };
      }

      // ─── Calculate Total Amount ────────────────────────────────────
      let totalAmount = input.shippingCost;

      if (input.codAmount) {
        totalAmount += input.codAmount;
      }

      if (input.insuranceAmount) {
        totalAmount += input.insuranceAmount;
      }

      if (input.discountAmount) {
        totalAmount -= input.discountAmount;
      }

      // Ensure total is non-negative
      totalAmount = Math.max(0, totalAmount);

      // ─── Create Payment Transaction Record ──────────────────────────
      // This represents the billing entry in the system
      const paymentTransaction = await prisma.paymentTransaction.create({
        data: {
          orderId: input.orderId,
          shipmentId: input.shipmentId,
          shopId: input.shopId,
          type: "DELIVERY_CHARGE",
          status: "PENDING", // Will be marked COMPLETED when payment is received
          amount: totalAmount,
          currency: "USD", // Default; should be shop-specific
          description: `Delivery charge for order ${input.orderId}`,
          metadata: {
            shippingCost: input.shippingCost,
            codAmount: input.codAmount || 0,
            insuranceAmount: input.insuranceAmount || 0,
            discountAmount: input.discountAmount || 0,
            driverId: input.driverId,
            billingNotes: input.notes,
          },
          paymentMethod: "INTERNAL", // Internal billing/accounting
          processedAt: new Date(),
        },
      });

      logger?.info("Billing record created", {
        billingId: paymentTransaction.id,
        orderId: input.orderId,
        totalAmount,
        status: paymentTransaction.status,
      });

      return {
        success: true,
        data: {
          billingId: paymentTransaction.id,
          orderId: input.orderId,
          totalAmount,
          billingStatus: paymentTransaction.status,
          createdAt: paymentTransaction.createdAt,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Billing creation failed", { error: errorMsg });
      return {
        success: false,
        error: `Billing error: ${errorMsg}`,
        code: "BILLING_ERROR",
      };
    }
  },

  async compensate(
    input: TriggerBillingInput,
    context: WorkflowContext,
  ): Promise<void> {
    const logger = context.logger;
    logger?.info("Compensating billing record", {
      orderId: input.orderId,
    });

    try {
      const prisma = context.prisma as any;

      // Find and void the billing record
      const billing = await prisma.paymentTransaction.findFirst({
        where: {
          orderId: input.orderId,
          type: "DELIVERY_CHARGE",
          status: { in: ["PENDING", "COMPLETED"] },
        },
      });

      if (billing) {
        await prisma.paymentTransaction.update({
          where: { id: billing.id },
          data: {
            status: "VOIDED",
            metadata: {
              ...billing.metadata,
              voidedReason: "Workflow compensation",
              voidedAt: new Date().toISOString(),
            },
          },
        });

        logger?.info("Billing record voided", {
          billingId: billing.id,
        });
      }
    } catch (error) {
      logger?.error("Compensation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
