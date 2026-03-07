/**
 * Customer-facing tracking endpoint — public (no auth required).
 *
 * Accessed via tracking token (not order ID) for security.
 * Powers the customer tracking page with delivery status + driver location.
 *
 * Routes:
 *   GET /token/:trackingToken  Get delivery status by tracking token
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@witylogix/db";
import { NotFoundError } from "../lib/errors.js";

// ─── Route Plugin ───────────────────────────────────────────

async function trackingRoutes(fastify: FastifyInstance): Promise<void> {
  // NO auth hooks — tracking is public (secured by token obscurity)

  // ── GET TRACKING INFO ─────────────────────────────────────

  fastify.get("/token/:trackingToken", async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackingToken } = request.params as { trackingToken: string };

    const order = await prisma.order.findUnique({
      where: { trackingToken },
      select: {
        id: true,
        status: true,
        customerName: true,
        addressLine1: true,
        city: true,
        province: true,
        postalCode: true,
        deliveryDate: true,
        estimatedArrival: true,
        actualDelivery: true,
        shopifyOrderNumber: true,
        timeSlot: {
          select: { name: true, startTime: true, endTime: true },
        },
        driver: {
          select: {
            id: true,
            name: true,
            vehicleType: true,
            // Do NOT expose phone, email, or other PII
          },
        },
        proofOfDelivery: {
          select: {
            photoUrls: true,
            recipientName: true,
            deliveredAt: true,
          },
        },
        shop: {
          select: {
            name: true,
            settings: true, // branding info for tracking page
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError("Tracking", trackingToken);
    }

    // Get driver location if delivery is in progress
    let driverLocation = null;
    if (
      order.driver &&
      ["OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status)
    ) {
      const [loc] = await prisma.$queryRaw<
        Array<{ lat: number; lng: number; heading: number | null; last_at: Date | null }>
      >`
        SELECT
          ST_Y(current_location) as lat,
          ST_X(current_location) as lng,
          heading,
          last_location_at as last_at
        FROM drivers
        WHERE id = ${order.driver.id}::uuid
          AND current_location IS NOT NULL
      `;

      if (loc) {
        driverLocation = {
          latitude: loc.lat,
          longitude: loc.lng,
          heading: loc.heading,
          updatedAt: loc.last_at,
        };
      }
    }

    // Build status timeline
    const timeline = buildTimeline(order.status);

    return {
      data: {
        orderNumber: order.shopifyOrderNumber,
        status: order.status,
        customerName: order.customerName,
        deliveryAddress: {
          line1: order.addressLine1,
          city: order.city,
          province: order.province,
          postalCode: order.postalCode,
        },
        deliveryDate: order.deliveryDate,
        estimatedArrival: order.estimatedArrival,
        actualDelivery: order.actualDelivery,
        timeSlot: order.timeSlot,
        driver: order.driver
          ? {
              name: order.driver.name,
              vehicleType: order.driver.vehicleType,
            }
          : null,
        driverLocation,
        proofOfDelivery: order.proofOfDelivery,
        shop: {
          name: order.shop.name,
          branding: (order.shop.settings as any)?.branding || {},
        },
        timeline,
      },
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────

const STATUS_ORDER = [
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Order received",
  ACCEPTED: "Order confirmed",
  ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "On the way",
  ARRIVED: "Driver arrived",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

function buildTimeline(currentStatus: string) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus as any);

  return STATUS_ORDER.map((status, index) => ({
    status,
    label: STATUS_LABELS[status],
    completed: index <= currentIndex,
    current: status === currentStatus,
  }));
}

export default trackingRoutes;
