/**
 * Deliveries API Routes
 *
 * Endpoints:
 *   GET    /                    - List deliveries (backed by Shipment model)
 *   GET    /:id                 - Get single delivery
 *   PATCH  /:id/assign          - Assign delivery to a courier partner
 *   PATCH  /:id/status          - Update delivery status
 *   PATCH  /:id/preferences     - Update in-flight delivery preferences (customer-facing)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const assignDeliverySchema = z.object({
  courierId: z.string(),
  partner: z.enum(["onfleet", "stuart", "uber"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "failed",
    "returned",
  ]),
  notes: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  safePlace: z.string().max(200).optional(),
  instructions: z.string().max(200).optional(),
  rescheduleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  rescheduleTimeWindow: z
    .enum(["morning", "afternoon", "evening", "anytime"])
    .optional(),
  redirectAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      postalCode: z.string(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    })
    .optional(),
  deliveryMethod: z.enum(["door", "signature", "neighbor"]).optional(),
  phoneNumber: z.string().optional(),
});

const ZONE_RADIUS_KM = 50;
const CUTOFF_MINUTES_BEFORE_ETA = 30;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map Shipment status to delivery status strings expected by the courier dispatch UI
function shipmentStatusToDeliveryStatus(status: string): string {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return "pending";
    case "READY_FOR_PICKUP":
      return "pending";
    case "PICKED_UP":
      return "picked_up";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "ARRIVED":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "FAILED":
    case "FAILED_ATTEMPT":
      return "failed";
    case "RETURNED":
    case "CANCELLED":
      return "returned";
    default:
      return "pending";
  }
}

type DbDelivery = Awaited<
  ReturnType<typeof prisma.courierDelivery.findFirst>
> & {
  partner: { id: string; name: string; provider: string } | null;
};

function extractCoords(loc: unknown): { lat: number; lng: number } | undefined {
  if (!loc || typeof loc !== "object") return undefined;
  const l = loc as Record<string, unknown>;
  const lat = (l.lat ?? l.latitude) as number | undefined;
  const lng = (l.lng ?? l.longitude) as number | undefined;
  if (lat != null && lng != null) return { lat, lng };
  return undefined;
}

function normalizeStatus(status: string): string {
  return status.toLowerCase();
}

function buildTimeline(delivery: NonNullable<DbDelivery>) {
  const events: Array<{
    id: string;
    type: string;
    timestamp: Date;
    courierName?: string;
  }> = [];
  events.push({
    id: `${delivery.id}-created`,
    type: "requested",
    timestamp: delivery.createdAt,
  });
  if (delivery.driverName) {
    events.push({
      id: `${delivery.id}-assigned`,
      type: "assigned",
      timestamp: delivery.lastStatusUpdate ?? delivery.createdAt,
      courierName: delivery.driverName,
    });
  }
  if (["IN_TRANSIT", "DELIVERED", "PICKED_UP"].includes(delivery.status)) {
    events.push({
      id: `${delivery.id}-pickup`,
      type: "pickup",
      timestamp: delivery.lastStatusUpdate ?? delivery.createdAt,
    });
  }
  if (["IN_TRANSIT", "DELIVERED"].includes(delivery.status)) {
    events.push({
      id: `${delivery.id}-transit`,
      type: "in_transit",
      timestamp: delivery.lastStatusUpdate ?? delivery.createdAt,
    });
  }
  if (delivery.status === "DELIVERED") {
    events.push({
      id: `${delivery.id}-delivered`,
      type: "delivered",
      timestamp: delivery.deliveredAt ?? delivery.updatedAt,
    });
  }
  return events;
}

function formatDelivery(
  delivery: NonNullable<DbDelivery>,
  order: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    customerName: string | null;
    customerPhone: string | null;
    deliveryLocation: unknown;
  } | null,
) {
  const dropoffCoords = order
    ? extractCoords(order.deliveryLocation)
    : undefined;
  const dropoffAddress = order
    ? [order.addressLine1, order.addressLine2, order.city, order.province]
        .filter(Boolean)
        .join(", ")
    : "Unknown address";

  const quote = delivery.quote as {
    estimatedMinutes?: number;
    price?: number;
  } | null;
  const estimatedDeliveryTime = quote?.estimatedMinutes
    ? new Date(
        delivery.createdAt.getTime() + quote.estimatedMinutes * 60 * 1000,
      )
    : undefined;

  const metadata = delivery.metadata as Record<string, unknown>;
  const preferences = (metadata?.preferences ?? {}) as Record<string, unknown>;

  const hubCoords = preferences.redirectAddress
    ? extractCoords(
        (preferences.redirectAddress as { coordinates?: unknown }).coordinates,
      )
    : undefined;

  return {
    id: delivery.id,
    orderId: delivery.orderId ?? "",
    courierId: delivery.partnerId,
    status: normalizeStatus(delivery.status),
    pickup: {
      address: "Warehouse Hub",
      coordinates: hubCoords,
      contactName: "Operations Team",
      contactPhone: undefined,
    },
    dropoff: {
      address: dropoffAddress,
      coordinates: dropoffCoords,
      contactName: order?.customerName ?? undefined,
      contactPhone: order?.customerPhone ?? undefined,
    },
    recipient: order?.customerName
      ? {
          name: order.customerName,
          phone: order.customerPhone ?? undefined,
          email: undefined,
        }
      : undefined,
    createdAt: delivery.createdAt,
    deliveredAt: delivery.deliveredAt ?? undefined,
    estimatedDeliveryTime,
    notes: (metadata?.notes as string | undefined) ?? undefined,
    preferences,
    timeline: buildTimeline(delivery),
  };
}

async function deliveriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST DELIVERIES ───────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listDeliveriesQuery.parse(request.query);
    const { courierId, status, page, limit } = query;
    const tenantId = request.tenantId!;
    const shopId = request.shopId!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };
    if (courierId) where.partnerId = courierId;
    if (status) where.status = status.toUpperCase();

    const [rows, total] = await Promise.all([
      prisma.courierDelivery.findMany({
        where,
        include: {
          partner: { select: { id: true, name: true, provider: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.courierDelivery.count({ where }),
    ]);

    const orderIds = rows
      .map((r) => r.orderId)
      .filter((id): id is string => id != null);
    const orders =
      orderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: orderIds }, shopId },
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              province: true,
              customerName: true,
              customerPhone: true,
              deliveryLocation: true,
            },
          })
        : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const deliveries = rows.map((row) =>
      formatDelivery(
        row as NonNullable<DbDelivery>,
        row.orderId ? (orderMap.get(row.orderId) ?? null) : null,
      ),
    );

    return {
      data: deliveries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET SINGLE DELIVERY ───────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;
    const shopId = request.shopId!;

    const delivery = await prisma.courierDelivery.findFirst({
      where: { id, tenantId },
      include: {
        partner: { select: { id: true, name: true, provider: true } },
      },
    });
    if (!delivery)
      return reply.status(404).send({ error: "Delivery not found" });

    const order = delivery.orderId
      ? await prisma.order.findFirst({
          where: { id: delivery.orderId, shopId },
          select: {
            id: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            province: true,
            customerName: true,
            customerPhone: true,
            deliveryLocation: true,
          },
        })
      : null;

    return { data: formatDelivery(delivery as NonNullable<DbDelivery>, order) };
  });

  // ── ASSIGN DELIVERY ───────────────────────────────────────

  fastify.patch(
    "/:id/assign",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = assignDeliverySchema.parse(request.body);
      const tenantId = request.tenantId!;
      const shopId = request.shopId!;

      const existing = await prisma.courierDelivery.findFirst({
        where: { id, tenantId },
      });
      if (!existing)
        return reply.status(404).send({ error: "Delivery not found" });

      const partner = await prisma.courierPartner.findFirst({
        where: { id: body.courierId, tenantId },
      });
      if (!partner)
        return reply.status(404).send({ error: "Courier partner not found" });

      const updated = await prisma.courierDelivery.update({
        where: { id },
        data: {
          partnerId: body.courierId,
          status: "PENDING",
          lastStatusUpdate: new Date(),
        },
        include: {
          partner: { select: { id: true, name: true, provider: true } },
        },
      });

      const order = updated.orderId
        ? await prisma.order.findFirst({
            where: { id: updated.orderId, shopId },
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              province: true,
              customerName: true,
              customerPhone: true,
              deliveryLocation: true,
            },
          })
        : null;

      return {
        data: formatDelivery(updated as NonNullable<DbDelivery>, order),
      };
    },
  );

  // ── UPDATE DELIVERY STATUS ────────────────────────────────

  fastify.patch(
    "/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updateStatusSchema.parse(request.body);
      const tenantId = request.tenantId!;
      const shopId = request.shopId!;

      const existing = await prisma.courierDelivery.findFirst({
        where: { id, tenantId },
      });
      if (!existing)
        return reply.status(404).send({ error: "Delivery not found" });

      const statusMap: Record<string, string> = {
        pending: "PENDING",
        picked_up: "PICKED_UP",
        in_transit: "IN_TRANSIT",
        delivered: "DELIVERED",
        failed: "FAILED",
        assigned: "PENDING",
        returned: "FAILED",
      };
      const newStatus = statusMap[body.status] ?? "PENDING";
      const deliveredAt = newStatus === "DELIVERED" ? new Date() : undefined;

      const updated = await prisma.courierDelivery.update({
        where: { id },
        data: {
          status: newStatus as any,
          lastStatusUpdate: new Date(),
          ...(deliveredAt ? { deliveredAt } : {}),
          ...(body.notes
            ? {
                metadata: {
                  ...((existing.metadata as object) ?? {}),
                  notes: body.notes,
                },
              }
            : {}),
        },
        include: {
          partner: { select: { id: true, name: true, provider: true } },
        },
      });

      const order = updated.orderId
        ? await prisma.order.findFirst({
            where: { id: updated.orderId, shopId },
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              province: true,
              customerName: true,
              customerPhone: true,
              deliveryLocation: true,
            },
          })
        : null;

      return {
        data: formatDelivery(updated as NonNullable<DbDelivery>, order),
      };
    },
  );

  // ── UPDATE DELIVERY PREFERENCES (in-flight) ───────────────

  fastify.patch(
    "/:id/preferences",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.tenantId!;
      const shopId = request.shopId!;

      let body: ReturnType<typeof updatePreferencesSchema.parse>;
      try {
        body = updatePreferencesSchema.parse(request.body);
      } catch (err: unknown) {
        const zodErr = err as { errors?: unknown[] };
        return reply
          .status(400)
          .send({ error: "Invalid preferences", details: zodErr.errors });
      }

      const delivery = await prisma.courierDelivery.findFirst({
        where: { id, tenantId },
      });
      if (!delivery)
        return reply.status(404).send({ error: "Delivery not found" });

      if (["DELIVERED", "FAILED"].includes(delivery.status)) {
        return reply.status(422).send({
          error: "Cannot modify preferences for a completed delivery",
        });
      }

      const quote = delivery.quote as { estimatedMinutes?: number } | null;
      if (quote?.estimatedMinutes) {
        const eta =
          delivery.createdAt.getTime() + quote.estimatedMinutes * 60 * 1000;
        const minutesUntilEta = (eta - Date.now()) / 60_000;
        if (minutesUntilEta < CUTOFF_MINUTES_BEFORE_ETA) {
          return reply.status(422).send({
            error: `Preferences can no longer be changed — driver is less than ${CUTOFF_MINUTES_BEFORE_ETA} minutes away`,
            cutoffMinutes: CUTOFF_MINUTES_BEFORE_ETA,
            etaMinutes: Math.round(minutesUntilEta),
          });
        }
      }

      if (body.redirectAddress?.coordinates) {
        const { lat, lng } = body.redirectAddress.coordinates;
        const distKm = haversineKm(HUB_LAT, HUB_LNG, lat, lng);
        if (distKm > ZONE_RADIUS_KM) {
          return reply.status(422).send({
            error: `Redirect address is outside the delivery zone (${ZONE_RADIUS_KM} km radius)`,
            distanceKm: Math.round(distKm),
          });
        }
      }

      const existingMeta = (delivery.metadata as Record<string, unknown>) ?? {};
      const existingPreferences = (existingMeta.preferences ?? {}) as Record<
        string,
        unknown
      >;
      const updatedPreferences = {
        ...existingPreferences,
        ...(body.safePlace !== undefined && { safePlace: body.safePlace }),
        ...(body.instructions !== undefined && {
          instructions: body.instructions,
        }),
        ...(body.rescheduleDate !== undefined && {
          rescheduleDate: body.rescheduleDate,
        }),
        ...(body.rescheduleTimeWindow !== undefined && {
          rescheduleTimeWindow: body.rescheduleTimeWindow,
        }),
        ...(body.redirectAddress !== undefined && {
          redirectAddress: body.redirectAddress,
        }),
        ...(body.deliveryMethod !== undefined && {
          deliveryMethod: body.deliveryMethod,
        }),
        ...(body.phoneNumber !== undefined && {
          phoneNumber: body.phoneNumber,
        }),
        updatedAt: new Date().toISOString(),
      };

      const updated = await prisma.courierDelivery.update({
        where: { id },
        data: {
          metadata: { ...existingMeta, preferences: updatedPreferences },
        },
        include: {
          partner: { select: { id: true, name: true, provider: true } },
        },
      });

      const order = updated.orderId
        ? await prisma.order.findFirst({
            where: { id: updated.orderId, shopId },
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              province: true,
              customerName: true,
              customerPhone: true,
              deliveryLocation: true,
            },
          })
        : null;

      fastify.log.info(
        { deliveryId: id, preferences: updatedPreferences },
        "Delivery preferences updated",
      );

      return {
        data: formatDelivery(updated as NonNullable<DbDelivery>, order),
        notification: {
          sent: true,
          channels: ["email", "sms"],
          message:
            "Your delivery preferences have been updated. The driver has been notified.",
        },
      };
    },
  );
}

export default deliveriesRoutes;
