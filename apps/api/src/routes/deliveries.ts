/**
 * Deliveries API Routes
 *
 * Endpoints:
 *   GET    /                    - List deliveries (with optional courierId filter)
 *   GET    /:id                 - Get single delivery
 *   PATCH  /:id/assign          - Assign delivery to a courier
 *   PATCH  /:id/status          - Update delivery status
 *   PATCH  /:id/preferences     - Update in-flight delivery preferences (customer-facing)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
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

// Hub coordinates for zone validation (mock — 50 km radius)
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

const listDeliveriesQuery = z.object({
  courierId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Mock delivery data
const MOCK_DELIVERIES = [
  {
    id: 'del-1',
    orderId: 'ord-2841',
    courierId: 'cour-1',
    status: 'in_transit',
    pickup: {
      address: 'Witylogix Hub, 500 Commerce Drive',
      coordinates: { lat: 40.7282, lng: -73.9942 },
      contactName: 'Warehouse Team',
      contactPhone: '+1 555-0010',
    },
    dropoff: {
      address: '142 Maple Street, Downtown Core',
      coordinates: { lat: 40.7128, lng: -74.006 },
      contactName: 'Emma Johnson',
      contactPhone: '+1 555-0201',
    },
    package: { weight: 2.5, dimensions: { length: 30, width: 20, height: 15 }, fragile: false },
    recipient: { name: 'Emma Johnson', phone: '+1 555-0201', email: 'emma@example.com' },
    createdAt: new Date(Date.now() - 90 * 60 * 1000),
    assignedAt: new Date(Date.now() - 60 * 60 * 1000),
    pickedUpAt: new Date(Date.now() - 30 * 60 * 1000),
    estimatedDeliveryTime: new Date(Date.now() + 15 * 60 * 1000),
    timeline: [
      { id: 'ev-1', type: 'requested', timestamp: new Date(Date.now() - 90 * 60 * 1000) },
      { id: 'ev-2', type: 'assigned', timestamp: new Date(Date.now() - 60 * 60 * 1000), courierName: 'Carlos Martinez' },
      { id: 'ev-3', type: 'pickup', timestamp: new Date(Date.now() - 30 * 60 * 1000) },
      { id: 'ev-4', type: 'in_transit', timestamp: new Date(Date.now() - 25 * 60 * 1000) },
    ],
  },
  {
    id: 'del-2',
    orderId: 'ord-2842',
    courierId: null,
    status: 'pending',
    pickup: {
      address: 'Witylogix Hub, 500 Commerce Drive',
      coordinates: { lat: 40.7282, lng: -73.9942 },
      contactName: 'Warehouse Team',
      contactPhone: '+1 555-0010',
    },
    dropoff: {
      address: '87 Oak Avenue, Midtown East',
      coordinates: { lat: 40.7489, lng: -73.968 },
      contactName: 'David Kim',
      contactPhone: '+1 555-0202',
    },
    package: { weight: 1.2, dimensions: { length: 20, width: 15, height: 10 }, fragile: true },
    recipient: { name: 'David Kim', phone: '+1 555-0202', email: 'david@example.com' },
    createdAt: new Date(Date.now() - 20 * 60 * 1000),
    estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000),
    timeline: [
      { id: 'ev-5', type: 'requested', timestamp: new Date(Date.now() - 20 * 60 * 1000) },
    ],
  },
  {
    id: 'del-3',
    orderId: 'ord-2840',
    courierId: 'cour-2',
    status: 'delivered',
    pickup: {
      address: 'Witylogix Hub, 500 Commerce Drive',
      coordinates: { lat: 40.7282, lng: -73.9942 },
      contactName: 'Warehouse Team',
      contactPhone: '+1 555-0010',
    },
    dropoff: {
      address: '305 Pine Road, West Side',
      coordinates: { lat: 40.7614, lng: -73.9776 },
      contactName: 'Sarah Williams',
      contactPhone: '+1 555-0203',
    },
    package: { weight: 5.0, dimensions: { length: 50, width: 40, height: 30 }, fragile: false },
    recipient: { name: 'Sarah Williams', phone: '+1 555-0203', email: 'sarah@example.com' },
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    assignedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    pickedUpAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    deliveredAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    estimatedDeliveryTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    timeline: [
      { id: 'ev-6', type: 'requested', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      { id: 'ev-7', type: 'assigned', timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000), courierName: 'Sofia Lindberg' },
      { id: 'ev-8', type: 'pickup', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      { id: 'ev-9', type: 'in_transit', timestamp: new Date(Date.now() - 2.8 * 60 * 60 * 1000) },
      { id: 'ev-10', type: 'delivered', timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000) },
    ],
  },
];

async function deliveriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── LIST DELIVERIES ───────────────────────────────────────

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listDeliveriesQuery.parse(request.query);
    const { courierId, status } = query;

    let deliveries = [...MOCK_DELIVERIES];
    if (courierId) deliveries = deliveries.filter((d) => d.courierId === courierId);
    if (status) deliveries = deliveries.filter((d) => d.status === status);

    return {
      data: deliveries,
      pagination: { page: 1, limit: 50, total: deliveries.length, totalPages: 1 },
    };
  });

  // ── GET SINGLE DELIVERY ───────────────────────────────────

  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const delivery = MOCK_DELIVERIES.find((d) => d.id === id);
    if (!delivery) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }
    return { data: delivery };
  });

  // ── ASSIGN DELIVERY ───────────────────────────────────────

  fastify.patch('/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = assignDeliverySchema.parse(request.body);

    const delivery = MOCK_DELIVERIES.find((d) => d.id === id);
    if (!delivery) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    const updated = {
      ...delivery,
      courierId: body.courierId,
      status: 'assigned',
      assignedAt: new Date(),
    };

    return { data: updated };
  });

  // ── UPDATE DELIVERY STATUS ────────────────────────────────

  fastify.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateStatusSchema.parse(request.body);

    const delivery = MOCK_DELIVERIES.find((d) => d.id === id);
    if (!delivery) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    return { data: { ...delivery, status: body.status } };
  });

  // ── UPDATE DELIVERY PREFERENCES (in-flight) ───────────────

  fastify.patch('/:id/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    let body: ReturnType<typeof updatePreferencesSchema.parse>;
    try {
      body = updatePreferencesSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'Invalid preferences', details: err.errors });
    }

    const delivery = MOCK_DELIVERIES.find((d) => d.id === id);
    if (!delivery) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    // Business rule: preferences cannot be changed after delivery is complete/failed
    if (['delivered', 'failed', 'returned'].includes(delivery.status)) {
      return reply.status(422).send({ error: 'Cannot modify preferences for a completed delivery' });
    }

    // Business rule: cutoff X minutes before ETA
    const eta = delivery.estimatedDeliveryTime?.getTime();
    if (eta) {
      const msUntilEta = eta - Date.now();
      const minutesUntilEta = msUntilEta / 60_000;
      if (minutesUntilEta < CUTOFF_MINUTES_BEFORE_ETA) {
        return reply.status(422).send({
          error: `Preferences can no longer be changed — driver is less than ${CUTOFF_MINUTES_BEFORE_ETA} minutes away`,
          cutoffMinutes: CUTOFF_MINUTES_BEFORE_ETA,
          etaMinutes: Math.round(minutesUntilEta),
        });
      }
    }

    // Business rule: redirect address must be within delivery zone
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

    // Merge preferences into delivery metadata
    const existingPreferences = (delivery as any).preferences ?? {};
    const updatedPreferences = {
      ...existingPreferences,
      ...(body.safePlace !== undefined && { safePlace: body.safePlace }),
      ...(body.instructions !== undefined && { instructions: body.instructions }),
      ...(body.rescheduleDate !== undefined && { rescheduleDate: body.rescheduleDate }),
      ...(body.rescheduleTimeWindow !== undefined && { rescheduleTimeWindow: body.rescheduleTimeWindow }),
      ...(body.redirectAddress !== undefined && { redirectAddress: body.redirectAddress }),
      ...(body.deliveryMethod !== undefined && { deliveryMethod: body.deliveryMethod }),
      ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
      updatedAt: new Date().toISOString(),
    };

    const updated = { ...delivery, preferences: updatedPreferences };

    // Stub: in production this would trigger an email/SMS notification to the customer
    // and push updated instructions to the driver app via WebSocket
    fastify.log.info({ deliveryId: id, preferences: updatedPreferences }, 'Delivery preferences updated');

    return {
      data: updated,
      notification: {
        sent: true,
        channels: ['email', 'sms'],
        message: 'Your delivery preferences have been updated. The driver has been notified.',
      },
    };
  });
}

export default deliveriesRoutes;
