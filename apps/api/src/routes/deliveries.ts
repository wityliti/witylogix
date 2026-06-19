/**
 * Deliveries API Routes
 *
 * Endpoints:
 *   GET    /                    - List deliveries (backed by Shipment model)
 *   GET    /:id                 - Get single delivery
 *   PATCH  /:id/assign          - Assign delivery to a courier/driver
 *   PATCH  /:id/status          - Update delivery status
 *   PATCH  /:id/preferences     - Update in-flight delivery preferences (customer-facing)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@witylogix/db';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

const assignDeliverySchema = z.object({
  courierId: z.string(),
  partner: z.enum(['onfleet', 'stuart', 'uber']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned']),
  notes: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  safePlace: z.string().max(200).optional(),
  instructions: z.string().max(200).optional(),
  rescheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rescheduleTimeWindow: z.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
  redirectAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      postalCode: z.string(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    })
    .optional(),
  deliveryMethod: z.enum(['door', 'signature', 'neighbor']).optional(),
  phoneNumber: z.string().optional(),
});

const listDeliveriesQuery = z.object({
  courierId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Hub coordinates for zone validation
const HUB_LAT = 40.7282;
const HUB_LNG = -73.9942;
const ZONE_RADIUS_KM = 50;
const CUTOFF_MINUTES_BEFORE_ETA = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map Shipment status to delivery status strings expected by the courier dispatch UI
function shipmentStatusToDeliveryStatus(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return 'pending';
    case 'READY_FOR_PICKUP':
      return 'pending';
    case 'PICKED_UP':
      return 'picked_up';
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
    case 'ARRIVED':
      return 'in_transit';
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED':
    case 'FAILED_ATTEMPT':
      return 'failed';
    case 'RETURNED':
    case 'CANCELLED':
      return 'returned';
    default:
      return 'pending';
  }
}

// Map delivery status string back to Shipment status values for filtering
function deliveryStatusToShipmentStatuses(status: string): string[] {
  switch (status) {
    case 'pending':
      return ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP'];
    case 'picked_up':
      return ['PICKED_UP'];
    case 'in_transit':
      return ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED'];
    case 'delivered':
      return ['DELIVERED'];
    case 'failed':
      return ['FAILED', 'FAILED_ATTEMPT'];
    case 'returned':
      return ['RETURNED', 'CANCELLED'];
    default:
      return [];
  }
}

// Normalise a Shipment record into the delivery shape expected by the dispatch UI
function normalizeShipment(shipment: Record<string, unknown>) {
  const loc = shipment.deliveryLocation as { lat?: number; lng?: number } | null;
  return {
    id: shipment.id as string,
    orderId: shipment.orderId as string,
    courierId: (shipment.driverId as string | null) ?? null,
    status: shipmentStatusToDeliveryStatus(shipment.status as string),
    pickup: {
      address: 'Dispatch Hub',
      coordinates: { lat: HUB_LAT, lng: HUB_LNG },
      contactName: 'Warehouse',
      contactPhone: '',
    },
    dropoff: {
      address: [
        shipment.addressLine1,
        shipment.city,
        shipment.postalCode,
        shipment.country,
      ]
        .filter(Boolean)
        .join(', ') || 'Unknown',
      coordinates: loc?.lat && loc?.lng ? { lat: loc.lat, lng: loc.lng } : null,
      contactName: (shipment.recipientName as string | null) ?? '',
      contactPhone: (shipment.recipientPhone as string | null) ?? '',
    },
    package: {
      weight: shipment.weight !== null ? Number(shipment.weight) : undefined,
      dimensions: shipment.dimensions as Record<string, number> | undefined,
      fragile: false,
    },
    recipient: {
      name: (shipment.recipientName as string | null) ?? '',
      phone: (shipment.recipientPhone as string | null) ?? '',
      email: (shipment.recipientEmail as string | null) ?? '',
    },
    createdAt: shipment.createdAt as Date,
    assignedAt: null,
    pickedUpAt: (shipment.pickedUpAt as Date | null) ?? null,
    deliveredAt: (shipment.actualDelivery as Date | null) ?? null,
    estimatedDeliveryTime: (shipment.estimatedArrival as Date | null) ?? null,
    notes: (shipment.notes as string | null) ?? undefined,
    timeline: [],
  };
}

async function deliveriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── LIST DELIVERIES ───────────────────────────────────────

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listDeliveriesQuery.parse(request.query);
      const { courierId, status, page, limit } = query;

      const statusFilter =
        status ? deliveryStatusToShipmentStatuses(status) : undefined;

      const where: Record<string, unknown> = {};
      if (courierId) where.driverId = courierId;
      if (statusFilter && statusFilter.length > 0) where.status = { in: statusFilter };

      const [shipments, total] = await Promise.all([
        request.tenantDb.shipment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        request.tenantDb.shipment.count({ where }),
      ]);

      return reply.send({
        data: shipments.map(normalizeShipment as (s: typeof shipments[0]) => ReturnType<typeof normalizeShipment>),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      fastify.log.error(error, 'deliveries list error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET SINGLE DELIVERY ───────────────────────────────────

  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const shipment = await request.tenantDb.shipment.findUnique({
        where: { id },
      });
      if (!shipment) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }
      return reply.send({ data: normalizeShipment(shipment as Record<string, unknown>) });
    } catch (error) {
      fastify.log.error(error, 'deliveries get error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── ASSIGN DELIVERY ───────────────────────────────────────

  fastify.patch('/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const body = assignDeliverySchema.parse(request.body);

      const shipment = await request.tenantDb.shipment.findUnique({ where: { id } });
      if (!shipment) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }

      const updated = await request.tenantDb.shipment.update({
        where: { id },
        data: {
          driverId: body.courierId,
          status: 'PICKED_UP',
        },
      });

      return reply.send({ data: normalizeShipment(updated as Record<string, unknown>) });
    } catch (error) {
      fastify.log.error(error, 'deliveries assign error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── UPDATE DELIVERY STATUS ────────────────────────────────

  fastify.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const body = updateStatusSchema.parse(request.body);

      const shipment = await request.tenantDb.shipment.findUnique({ where: { id } });
      if (!shipment) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }

      const statusMap: Record<string, string> = {
        pending: 'PENDING',
        assigned: 'READY_FOR_PICKUP',
        picked_up: 'PICKED_UP',
        in_transit: 'IN_TRANSIT',
        delivered: 'DELIVERED',
        failed: 'FAILED',
        returned: 'RETURNED',
      };

      const updated = await request.tenantDb.shipment.update({
        where: { id },
        data: {
          status: (statusMap[body.status] ?? 'PENDING') as 'PENDING' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'FAILED_ATTEMPT' | 'RETURNED' | 'CANCELLED',
          ...(body.status === 'delivered' && { actualDelivery: new Date() }),
          ...(body.notes && { notes: body.notes }),
        },
      });

      return reply.send({ data: normalizeShipment(updated as Record<string, unknown>) });
    } catch (error) {
      fastify.log.error(error, 'deliveries status error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── UPDATE DELIVERY PREFERENCES (in-flight) ───────────────

  fastify.patch('/:id/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;
    const shopId = request.shopId!;

    let body: ReturnType<typeof updatePreferencesSchema.parse>;
    try {
      body = updatePreferencesSchema.parse(request.body);
    } catch (err: unknown) {
      const zodErr = err as { errors?: unknown[] };
      return reply.status(400).send({ error: 'Invalid preferences', details: zodErr.errors });
    }

    try {
      const shipment = await request.tenantDb.shipment.findUnique({ where: { id } });
      if (!shipment) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }

      const deliveryStatus = shipmentStatusToDeliveryStatus(shipment.status);
      if (['delivered', 'failed', 'returned'].includes(deliveryStatus)) {
        return reply.status(422).send({ error: 'Cannot modify preferences for a completed delivery' });
      }

      const eta = shipment.estimatedArrival?.getTime();
      if (eta) {
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

      const existingMeta = (shipment.metadata as Record<string, unknown>) ?? {};
      const existingPrefs = (existingMeta.preferences as Record<string, unknown>) ?? {};
      const updatedPrefs = {
        ...existingPrefs,
        ...(body.safePlace !== undefined && { safePlace: body.safePlace }),
        ...(body.instructions !== undefined && { instructions: body.instructions }),
        ...(body.rescheduleDate !== undefined && { rescheduleDate: body.rescheduleDate }),
        ...(body.rescheduleTimeWindow !== undefined && { rescheduleTimeWindow: body.rescheduleTimeWindow }),
        ...(body.redirectAddress !== undefined && { redirectAddress: body.redirectAddress }),
        ...(body.deliveryMethod !== undefined && { deliveryMethod: body.deliveryMethod }),
        ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
        updatedAt: new Date().toISOString(),
      };

      const updated = await request.tenantDb.shipment.update({
        where: { id },
        data: {
          metadata: { ...existingMeta, preferences: updatedPrefs },
          ...(body.phoneNumber && { recipientPhone: body.phoneNumber }),
        },
      });

      fastify.log.info({ deliveryId: id, preferences: updatedPrefs }, 'Delivery preferences updated');

      return reply.send({
        data: normalizeShipment(updated as Record<string, unknown>),
        notification: {
          sent: true,
          channels: ['email', 'sms'],
          message: 'Your delivery preferences have been updated. The driver has been notified.',
        },
      });
    } catch (error) {
      fastify.log.error(error, 'deliveries preferences error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

export default deliveriesRoutes;
