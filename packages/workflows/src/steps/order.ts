/**
 * Order Creation Step
 * Creates order record in database with all validated/geocoded data
 * Compensation: soft-delete or cancel the order
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface CreateOrderRecordInput {
  shopId: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  deliveryLat: number;
  deliveryLng: number;
  totalPrice?: number;
  totalWeight?: number;
  itemCount: number;
  lineItems?: any[];
  deliveryDate?: Date;
  timeSlotId?: string;
  notes?: string;
  tags?: string[];
}

export interface CreateOrderRecordOutput {
  orderId: string;
  shopifyOrderId: string;
  status: string;
  createdAt: Date;
  trackingToken: string;
}

export const createOrderRecordStep: WorkflowStep<
  CreateOrderRecordInput,
  CreateOrderRecordOutput
> = {
  name: "createOrderRecord",
  description: "Create order record in database",

  async invoke(
    input: CreateOrderRecordInput,
    context: WorkflowContext
  ): Promise<StepResult<CreateOrderRecordOutput>> {
    const logger = context.logger;
    logger?.info("Creating order record", {
      shopifyOrderId: input.shopifyOrderId,
      shopId: input.shopId,
    });

    try {
      const prisma = (context.prisma as any);

      // Check for duplicate
      const existingOrder = await prisma.order.findUnique({
        where: {
          shopId_shopifyOrderId: {
            shopId: input.shopId,
            shopifyOrderId: input.shopifyOrderId,
          },
        },
      });

      if (existingOrder) {
        logger?.warn("Order already exists", {
          orderId: existingOrder.id,
          shopifyOrderId: input.shopifyOrderId,
        });
        return {
          success: false,
          error: "Order already exists",
          code: "DUPLICATE_ORDER",
        };
      }

      // Generate tracking token (simple UUID-like string)
      const trackingToken = generateTrackingToken();

      // Create order
      const order = await prisma.order.create({
        data: {
          shopId: input.shopId,
          shopifyOrderId: input.shopifyOrderId,
          shopifyOrderNumber: input.shopifyOrderNumber,
          status: "PENDING",
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          country: input.country,
          deliveryLocation: {
            lat: input.deliveryLat,
            lng: input.deliveryLng,
          },
          deliveryDate: input.deliveryDate,
          timeSlotId: input.timeSlotId,
          totalPrice: input.totalPrice ? parseFloat(input.totalPrice.toString()) : null,
          totalWeight: input.totalWeight ? parseFloat(input.totalWeight.toString()) : null,
          itemCount: input.itemCount,
          lineItems: input.lineItems || [],
          trackingToken,
          notes: input.notes,
          tags: input.tags || [],
          metadata: {
            createdVia: "workflow",
            customerId: input.customerId,
          },
        },
      });

      logger?.info("Order record created", {
        orderId: order.id,
        status: order.status,
        trackingToken,
      });

      return {
        success: true,
        data: {
          orderId: order.id,
          shopifyOrderId: order.shopifyOrderId,
          status: order.status,
          createdAt: order.createdAt,
          trackingToken,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Order creation failed", { error: errorMsg });
      return {
        success: false,
        error: `Order creation error: ${errorMsg}`,
        code: "ORDER_CREATION_ERROR",
      };
    }
  },

  async compensate(
    input: CreateOrderRecordInput,
    context: WorkflowContext
  ): Promise<void> {
    const logger = context.logger;
    logger?.info("Compensating order creation", {
      shopifyOrderId: input.shopifyOrderId,
    });

    try {
      const prisma = (context.prisma as any);

      // Find and soft-delete the order
      const order = await prisma.order.findUnique({
        where: {
          shopId_shopifyOrderId: {
            shopId: input.shopId,
            shopifyOrderId: input.shopifyOrderId,
          },
        },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            notes: (order.notes || "") + "\n[CANCELLED via workflow compensation]",
          },
        });

        logger?.info("Order cancelled via compensation", {
          orderId: order.id,
        });
      }
    } catch (error) {
      logger?.error("Compensation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * Generate a tracking token for customer reference
 */
function generateTrackingToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
