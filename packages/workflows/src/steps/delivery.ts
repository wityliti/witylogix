/**
 * Delivery Completion Steps
 * - verifyProofOfDeliveryStep: Validates POD (photo, signature, code)
 * - updateDeliveryStatusStep: Updates order/shipment status
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

// ─── VERIFY PROOF OF DELIVERY STEP ──────────────────────────────────────

export interface VerifyProofOfDeliveryInput {
  orderId: string;
  shipmentId?: string;
  photoUrls: string[];
  signatureUrl?: string;
  recipientName?: string;
  deliveryLat: number;
  deliveryLng: number;
  code?: string;
  notes?: string;
}

export interface VerifyProofOfDeliveryOutput {
  podId: string;
  isValid: boolean;
  photoCount: number;
  hasSignature: boolean;
  deliveredAt: Date;
  validationNotes: string[];
}

export const verifyProofOfDeliveryStep: WorkflowStep<
  VerifyProofOfDeliveryInput,
  VerifyProofOfDeliveryOutput
> = {
  name: "verifyProofOfDelivery",
  description: "Validate proof of delivery (photo, signature, code)",

  async invoke(
    input: VerifyProofOfDeliveryInput,
    context: WorkflowContext,
  ): Promise<StepResult<VerifyProofOfDeliveryOutput>> {
    const logger = context.logger;
    logger?.info("Verifying proof of delivery", {
      orderId: input.orderId,
      photoCount: input.photoUrls.length,
    });

    try {
      const validationNotes: string[] = [];

      // ─── Photo Validation ───────────────────────────────────────
      if (!input.photoUrls || input.photoUrls.length === 0) {
        return {
          success: false,
          error: "At least one delivery photo is required",
          code: "NO_PHOTOS",
        };
      }

      if (input.photoUrls.length > 10) {
        validationNotes.push("More than 10 photos provided (unusual)");
      }

      // Validate photo URLs are accessible
      for (const url of input.photoUrls) {
        if (!isValidUrl(url)) {
          validationNotes.push(`Invalid photo URL format: ${url}`);
        }
      }

      // ─── Signature Validation ──────────────────────────────────────
      let hasSignature = false;
      if (input.signatureUrl && input.signatureUrl.trim().length > 0) {
        if (!isValidUrl(input.signatureUrl)) {
          validationNotes.push(`Invalid signature URL format`);
        } else {
          hasSignature = true;
        }
      }

      // ─── Recipient Name Validation ────────────────────────────────
      if (input.recipientName && input.recipientName.trim().length === 0) {
        validationNotes.push("Recipient name is empty");
      }

      // ─── Location Validation ──────────────────────────────────────
      if (
        !Number.isFinite(input.deliveryLat) ||
        !Number.isFinite(input.deliveryLng)
      ) {
        return {
          success: false,
          error: "Invalid delivery coordinates",
          code: "INVALID_COORDINATES",
        };
      }

      // Check if delivery location makes sense (basic sanity check)
      if (
        Math.abs(input.deliveryLat) > 90 ||
        Math.abs(input.deliveryLng) > 180
      ) {
        return {
          success: false,
          error: "Delivery coordinates out of range",
          code: "OUT_OF_RANGE_COORDINATES",
        };
      }

      // ─── Code Validation (optional) ────────────────────────────────
      if (input.code && input.code.trim().length > 0) {
        if (input.code.length < 3 || input.code.length > 20) {
          validationNotes.push("Delivery code has unusual length");
        }
      }

      logger?.info("Proof of delivery verified", {
        orderId: input.orderId,
        photoCount: input.photoUrls.length,
        hasSignature,
        validationWarnings: validationNotes.length,
      });

      return {
        success: true,
        data: {
          podId: `pod_${input.orderId}`,
          isValid: true,
          photoCount: input.photoUrls.length,
          hasSignature,
          deliveredAt: new Date(),
          validationNotes,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("POD verification failed", { error: errorMsg });
      return {
        success: false,
        error: `POD verification error: ${errorMsg}`,
        code: "POD_VERIFICATION_ERROR",
      };
    }
  },

  // No compensation needed — verification is read-only
};

// ─── UPDATE DELIVERY STATUS STEP ────────────────────────────────────────

export interface UpdateDeliveryStatusInput {
  orderId: string;
  shipmentId?: string;
  newStatus: string;
  podData?: {
    photoUrls: string[];
    signatureUrl?: string;
    recipientName?: string;
    deliveryLocation?: { lat: number; lng: number };
    notes?: string;
  };
  notes?: string;
}

export interface UpdateDeliveryStatusOutput {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  updatedAt: Date;
  shipmentId?: string;
}

export const updateDeliveryStatusStep: WorkflowStep<
  UpdateDeliveryStatusInput,
  UpdateDeliveryStatusOutput
> = {
  name: "updateDeliveryStatus",
  description: "Update order/shipment delivery status",

  async invoke(
    input: UpdateDeliveryStatusInput,
    context: WorkflowContext,
  ): Promise<StepResult<UpdateDeliveryStatusOutput>> {
    const logger = context.logger;
    logger?.info("Updating delivery status", {
      orderId: input.orderId,
      newStatus: input.newStatus,
    });

    try {
      const prisma = context.prisma as any;

      // ─── Update Order Status ───────────────────────────────────────
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, shopId: true },
      });

      if (!order) {
        return {
          success: false,
          error: `Order not found: ${input.orderId}`,
          code: "ORDER_NOT_FOUND",
        };
      }

      const previousStatus = order.status;

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        PENDING: ["ACCEPTED", "CANCELLED"],
        ACCEPTED: ["ASSIGNED", "CANCELLED"],
        ASSIGNED: ["PICKED_UP", "CANCELLED"],
        PICKED_UP: ["OUT_FOR_DELIVERY", "FAILED"],
        OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
        ARRIVED: ["DELIVERED", "FAILED"],
        DELIVERED: [], // Terminal state
        FAILED: ["PICKED_UP", "CANCELLED"], // Can retry
        CANCELLED: [], // Terminal state
        RETURNED: [], // Terminal state
      };

      if (!validTransitions[previousStatus]?.includes(input.newStatus)) {
        logger?.warn("Invalid status transition", {
          from: previousStatus,
          to: input.newStatus,
        });
        return {
          success: false,
          error: `Invalid status transition from ${previousStatus} to ${input.newStatus}`,
          code: "INVALID_STATUS_TRANSITION",
        };
      }

      // Update order
      const updatedOrder = await prisma.order.update({
        where: { id: input.orderId },
        data: {
          status: input.newStatus,
          actualDelivery:
            input.newStatus === "DELIVERED" ? new Date() : undefined,
          notes: (order.notes || "") + (input.notes ? `\n${input.notes}` : ""),
        },
      });

      // ─── Create/Update Proof of Delivery if Status is DELIVERED ─────
      if (input.newStatus === "DELIVERED" && input.podData) {
        await prisma.proofOfDelivery.upsert({
          where: { orderId: input.orderId },
          create: {
            orderId: input.orderId,
            photoUrls: input.podData.photoUrls,
            signatureUrl: input.podData.signatureUrl,
            recipientName: input.podData.recipientName,
            deliveryLocation: input.podData.deliveryLocation,
            notes: input.podData.notes,
          },
          update: {
            photoUrls: input.podData.photoUrls,
            signatureUrl: input.podData.signatureUrl,
            recipientName: input.podData.recipientName,
            deliveryLocation: input.podData.deliveryLocation,
            notes: input.podData.notes,
          },
        });
      }

      // ─── Update Shipment Status if shipmentId provided ───────────────
      if (input.shipmentId) {
        const shipmentStatusMap: Record<string, string> = {
          PENDING: "PENDING",
          ACCEPTED: "PROCESSING",
          ASSIGNED: "READY_FOR_PICKUP",
          PICKED_UP: "PICKED_UP",
          OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
          ARRIVED: "ARRIVED",
          DELIVERED: "DELIVERED",
          FAILED: "FAILED",
          CANCELLED: "CANCELLED",
          RETURNED: "RETURNED",
        };

        const shipmentStatus = shipmentStatusMap[input.newStatus];
        if (shipmentStatus) {
          await prisma.shipment.update({
            where: { id: input.shipmentId },
            data: {
              status: shipmentStatus,
              actualDelivery:
                input.newStatus === "DELIVERED" ? new Date() : undefined,
            },
          });

          logger?.info("Shipment status updated", {
            shipmentId: input.shipmentId,
            status: shipmentStatus,
          });
        }
      }

      logger?.info("Delivery status updated", {
        orderId: input.orderId,
        from: previousStatus,
        to: input.newStatus,
      });

      return {
        success: true,
        data: {
          orderId: input.orderId,
          previousStatus,
          newStatus: input.newStatus,
          updatedAt: updatedOrder.updatedAt,
          shipmentId: input.shipmentId,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Status update failed", { error: errorMsg });
      return {
        success: false,
        error: `Status update error: ${errorMsg}`,
        code: "STATUS_UPDATE_ERROR",
      };
    }
  },

  async compensate(
    input: UpdateDeliveryStatusInput,
    context: WorkflowContext,
  ): Promise<void> {
    const logger = context.logger;
    logger?.info("Compensating status update", {
      orderId: input.orderId,
      newStatus: input.newStatus,
    });

    try {
      const prisma = context.prisma as any;

      // Get previous status (simple approach: revert to one step back)
      const statusReversions: Record<string, string> = {
        ARRIVED: "OUT_FOR_DELIVERY",
        OUT_FOR_DELIVERY: "PICKED_UP",
        PICKED_UP: "ASSIGNED",
        ASSIGNED: "ACCEPTED",
        ACCEPTED: "PENDING",
        DELIVERED: "ARRIVED",
        FAILED: "OUT_FOR_DELIVERY",
      };

      const revertStatus = statusReversions[input.newStatus];
      if (revertStatus) {
        await prisma.order.update({
          where: { id: input.orderId },
          data: { status: revertStatus },
        });

        logger?.info("Status reverted via compensation", {
          orderId: input.orderId,
          to: revertStatus,
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
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
