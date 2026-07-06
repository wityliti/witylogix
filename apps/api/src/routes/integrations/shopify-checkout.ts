/**
 * Shopify Checkout Extension API Routes
 * Handles delivery slot selection, rate calculation, and order creation from checkout
 *
 * Routes:
 *   GET    /slots             Get available slots for a date
 *   POST   /reserve           Reserve a delivery slot
 *   GET    /rates             Get delivery rates for zipcode
 *   GET    /geocode           Geocode an address
 *   GET    /availability      Check service availability
 *   POST   /webhook/order     Handle post-checkout order webhook
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";

// Validation schemas
const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shop: z.string(),
});

const RatesQuerySchema = z.object({
  zipcode: z.string().min(3).max(10),
  shop: z.string(),
});

const GeocodeQuerySchema = z.object({
  address: z.string().min(5).max(500),
});

const AvailabilityQuerySchema = z.object({
  zipcode: z.string().min(3).max(10),
});

const ReserveSlotSchema = z.object({
  slotId: z.string(),
  cartId: z.string(),
  shopDomain: z.string(),
  customerEmail: z.string().email().optional(),
  deliveryAddress: z.string().optional(),
});

const OrderWebhookSchema = z.object({
  orderId: z.string(),
  shopId: z.string(),
  cartToken: z.string(),
  selectedDate: z.string().optional(),
  selectedSlot: z.string().optional(),
  deliveryFee: z.number().int().optional(),
  customerEmail: z.string().email(),
  deliveryAddress: z.string().optional(),
  phoneNumber: z.string().optional(),
});

/**
 * Register Shopify checkout routes
 */
export default async function shopifyCheckoutRoutes(
  app: FastifyInstance,
): Promise<void> {
  /**
   * GET /slots
   * Get available delivery slots for a specific date
   */
  app.get<{ Querystring: any }>(
    "/slots",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { date, shop } = SlotsQuerySchema.parse(request.query);

        // Get shop configuration
        const shopConfig = await prisma.shop.findUnique({
          where: { domain: shop },
          select: {
            id: true,
            witylogixApiKey: true,
            witylogixApiUrl: true,
            deliveryZones: true,
          },
        });

        if (!shopConfig?.witylogixApiKey) {
          return reply.status(400).send({
            error: "Shop not configured for Witylogix delivery",
          });
        }

        // Query delivery slots from database
        const slots = await prisma.deliverySlot.findMany({
          where: {
            date: new Date(date),
            shopId: shopConfig.id,
            isAvailable: true,
          },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            capacity: true,
            reserved: true,
            baseFee: true,
            zone: true,
          },
          orderBy: { startTime: "asc" },
        });

        const formattedSlots = slots.map((slot) => {
          const available = slot.reserved < slot.capacity;
          const slotsRemaining = slot.capacity - slot.reserved;

          return {
            id: slot.id,
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`,
            timeGroup: getTimeGroup(slot.startTime),
            capacity: slot.capacity,
            reserved: slot.reserved,
            price: slot.baseFee,
            available,
            slotsRemaining,
          };
        });

        return reply.send({ slots: formattedSlots });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to fetch slots",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * POST /reserve
   * Reserve a delivery slot
   */
  app.post<{ Body: any }>(
    "/reserve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { slotId, cartId, shopDomain, customerEmail, deliveryAddress } =
          ReserveSlotSchema.parse(request.body);

        // Get shop
        const shop = await prisma.shop.findUnique({
          where: { domain: shopDomain },
          select: { id: true },
        });

        if (!shop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        // Get slot
        const slot = await prisma.deliverySlot.findUnique({
          where: { id: slotId },
          select: {
            id: true,
            capacity: true,
            reserved: true,
            baseFee: true,
          },
        });

        if (!slot) {
          return reply.status(404).send({ error: "Slot not found" });
        }

        // Check availability
        if (slot.reserved >= slot.capacity) {
          return reply.status(409).send({ error: "Slot no longer available" });
        }

        // Create reservation
        const reservation = await prisma.slotReservation.create({
          data: {
            slotId,
            cartId,
            shopId: shop.id,
            customerEmail,
            deliveryAddress,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            status: "PENDING",
          },
          select: {
            id: true,
            cartId: true,
            expiresAt: true,
            confirmationCode: true,
          },
        });

        // Increment reserved count
        await prisma.deliverySlot.update({
          where: { id: slotId },
          data: { reserved: { increment: 1 } },
        });

        return reply.send({
          slotId,
          cartId,
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt.toISOString(),
          confirmationCode: reservation.confirmationCode,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to reserve slot",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /rates
   * Get delivery rates for a zipcode
   */
  app.get<{ Querystring: any }>(
    "/rates",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { zipcode, shop } = RatesQuerySchema.parse(request.query);

        // Find zone by zipcode
        const zone = await prisma.deliveryZone.findFirst({
          where: {
            shop: { domain: shop },
            zipcodes: { has: zipcode },
          },
          select: {
            id: true,
            name: true,
            baseFee: true,
            perMileFee: true,
            estimatedDeliveryDays: true,
          },
        });

        if (!zone) {
          return reply.status(404).send({
            error: "Service not available in this area",
          });
        }

        return reply.send({
          zone: zone.name,
          baseFee: zone.baseFee || 0,
          perMile: zone.perMileFee || 0,
          estimatedDelivery: `${zone.estimatedDeliveryDays || 1}-2 business days`,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to fetch rates",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /geocode
   * Geocode an address using Google Maps
   */
  app.get<{ Querystring: any }>(
    "/geocode",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        return reply.status(503).send({
          error: "Geocoding not configured",
          message: "Set GOOGLE_MAPS_API_KEY to enable address geocoding",
        });
      }

      try {
        const { address } = GeocodeQuerySchema.parse(request.query);

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const json = (await res.json()) as any;

        if (json.status !== "OK" || !json.results?.[0]) {
          return reply.status(404).send({ error: "Address not found" });
        }

        const result = json.results[0];
        const { lat, lng } = result.geometry.location;
        const components: any[] = result.address_components ?? [];

        const get = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name ?? "";

        return reply.send({
          address: result.formatted_address,
          latitude: lat,
          longitude: lng,
          zipcode: get("postal_code"),
          city: get("locality") || get("sublocality") || get("postal_town"),
          state: get("administrative_area_level_1"),
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to geocode address",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /availability
   * Check if service is available for a zipcode
   */
  app.get<{ Querystring: any }>(
    "/availability",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { zipcode } = AvailabilityQuerySchema.parse(request.query);

        // Check if zipcode is in any delivery zone
        const zone = await prisma.deliveryZone.findFirst({
          where: {
            zipcodes: { has: zipcode },
          },
        });

        return reply.send({
          available: !!zone,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to check availability",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * POST /webhook/order
   * Handle post-checkout order webhook from Shopify
   */
  app.post<{ Body: any }>(
    "/webhook/order",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orderData = OrderWebhookSchema.parse(request.body);

        // Get shop
        const shop = await prisma.shop.findUnique({
          where: { shopifyId: orderData.shopId },
        });

        if (!shop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        // Find reservation by cart token
        const reservation = await prisma.slotReservation.findFirst({
          where: {
            cartId: orderData.cartToken,
            shopId: shop.id,
            status: "PENDING",
          },
          select: {
            id: true,
            slotId: true,
          },
        });

        if (!reservation) {
          return reply.status(404).send({ error: "Reservation not found" });
        }

        // Create delivery order record
        const deliveryOrder = await prisma.deliveryOrder.create({
          data: {
            externalOrderId: orderData.orderId,
            shopId: shop.id,
            slotId: reservation.slotId,
            customerEmail: orderData.customerEmail,
            deliveryAddress: orderData.deliveryAddress,
            phoneNumber: orderData.phoneNumber,
            deliveryFee: orderData.deliveryFee || 0,
            status: "PENDING",
            reservationId: reservation.id,
          },
        });

        // Update reservation status
        await prisma.slotReservation.update({
          where: { id: reservation.id },
          data: { status: "CONFIRMED" },
        });

        return reply.status(201).send({
          success: true,
          orderId: deliveryOrder.id,
          externalOrderId: orderData.orderId,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to process order",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );
}

/**
 * Helper functions
 */

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getTimeGroup(time: string): "morning" | "afternoon" | "evening" {
  const hour = parseInt(time.split(":")[0], 10);

  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
