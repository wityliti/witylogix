/**
 * Google Integration API Routes
 * Handles Google Maps and Calendar integrations
 *
 * Routes:
 *   GET    /geocode              Geocode an address using Google Maps
 *   GET    /distance             Calculate distance between two points
 *   GET    /directions           Get directions with waypoints
 *   POST   /calendar/auth        Initiate OAuth2 flow
 *   GET    /calendar/callback    OAuth2 callback handler
 *   POST   /calendar/sync        Sync pickup orders to calendar
 *   POST   /zone/validate        Validate if address is in service zone
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import {
  createGoogleMapsService,
  createGoogleCalendarService,
  createZoneVisualizerService,
} from "@witylogix/core/integrations/google";
import type { OAuth2Token } from "@witylogix/core/integrations/google";

// Validation schemas
const GeocodeQuerySchema = z.object({
  address: z.string().min(5).max(500),
  shop: z.string().optional(),
});

const DistanceQuerySchema = z.object({
  origin: z.string().min(5),
  destination: z.string().min(5),
});

const DirectionsQuerySchema = z.object({
  origin: z.string().min(5),
  destination: z.string().min(5),
  waypoints: z.string().optional(),
});

const CalendarAuthSchema = z.object({
  shopId: z.string(),
  calendarId: z.string().optional(),
});

const CalendarCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

const CalendarSyncSchema = z.object({
  locationId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ZoneValidateSchema = z.object({
  address: z.string().min(5).max(500),
  shop: z.string(),
});

/**
 * Register Google integration routes
 */
export default async function googleIntegrationRoutes(
  app: FastifyInstance,
): Promise<void> {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    app.log.warn(
      "GOOGLE_MAPS_API_KEY not configured. Google Maps features disabled.",
    );
  }

  /**
   * GET /geocode
   * Geocode an address to coordinates
   */
  app.get<{ Querystring: any }>(
    "/geocode",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!googleMapsApiKey) {
          return reply
            .status(503)
            .send({ error: "Google Maps not configured" });
        }

        const { address, shop } = GeocodeQuerySchema.parse(request.query);
        const mapsService = createGoogleMapsService(googleMapsApiKey);

        const result = await mapsService.geocodeAddress(address);

        return reply.send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Geocoding failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /distance
   * Calculate distance between two points
   */
  app.get<{ Querystring: any }>(
    "/distance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!googleMapsApiKey) {
          return reply
            .status(503)
            .send({ error: "Google Maps not configured" });
        }

        const { origin, destination } = DistanceQuerySchema.parse(
          request.query,
        );
        const mapsService = createGoogleMapsService(googleMapsApiKey);

        const result = await mapsService.calculateDistance(origin, destination);

        return reply.send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Distance calculation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /directions
   * Get directions with optional waypoints
   */
  app.get<{ Querystring: any }>(
    "/directions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!googleMapsApiKey) {
          return reply
            .status(503)
            .send({ error: "Google Maps not configured" });
        }

        const { origin, destination, waypoints } = DirectionsQuerySchema.parse(
          request.query,
        );
        const mapsService = createGoogleMapsService(googleMapsApiKey);

        const waypointArray = waypoints ? waypoints.split("|") : undefined;
        const result = await mapsService.getDirections(
          origin,
          destination,
          waypointArray,
        );

        return reply.send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Directions calculation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * POST /calendar/auth
   * Initiate Google Calendar OAuth2 flow
   */
  app.post<{ Body: any }>(
    "/calendar/auth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { shopId, calendarId } = CalendarAuthSchema.parse(request.body);

        // Get shop
        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
        });

        if (!shop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        // Create calendar service with OAuth2 config
        const calendarService = createGoogleCalendarService({
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
          redirectUri: `${process.env.API_URL || "http://localhost:3000"}/api/integrations/google/calendar/callback`,
          scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
          ],
        });

        // Generate state for CSRF protection
        const state = crypto.getRandomValues(new Uint8Array(32)).toString();

        // Store state in session/cache temporarily
        await prisma.integrationSession.create({
          data: {
            shopId,
            provider: "google_calendar",
            state,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            metadata: { calendarId: calendarId || "primary" },
          },
        });

        // Get authorization URL
        const authUrl = calendarService.getAuthorizationUrl(state);

        return reply.send({
          authUrl,
          state,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to initiate authentication",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /calendar/callback
   * OAuth2 callback handler
   */
  app.get<{ Querystring: any }>(
    "/calendar/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, state } = CalendarCallbackSchema.parse(request.query);

        // Verify state
        const session = await prisma.integrationSession.findFirst({
          where: {
            provider: "google_calendar",
            state,
            expiresAt: { gt: new Date() },
          },
        });

        if (!session) {
          return reply.status(401).send({ error: "Invalid or expired state" });
        }

        // Get shop
        const shop = await prisma.shop.findUnique({
          where: { id: session.shopId },
        });

        if (!shop) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        // Create calendar service and exchange code for token
        const calendarService = createGoogleCalendarService({
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
          redirectUri: `${process.env.API_URL || "http://localhost:3000"}/api/integrations/google/calendar/callback`,
          scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
          ],
        });

        const token = await calendarService.exchangeCodeForToken(code);

        // Store credentials
        await prisma.integration.upsert({
          where: {
            shopId_provider: {
              shopId: shop.id,
              provider: "google_calendar",
            },
          },
          create: {
            shopId: shop.id,
            provider: "google_calendar",
            credentials: {
              accessToken: token.accessToken,
              refreshToken: token.refreshToken,
              expiresAt: token.expiresAt,
            },
            config: {
              calendarId: (session.metadata as any).calendarId || "primary",
            },
            isEnabled: true,
          },
          update: {
            credentials: {
              accessToken: token.accessToken,
              refreshToken: token.refreshToken,
              expiresAt: token.expiresAt,
            },
            isEnabled: true,
          },
        });

        // Clean up session
        await prisma.integrationSession.delete({ where: { id: session.id } });

        return reply.redirect(
          `${process.env.DASHBOARD_URL || "http://localhost:3001"}/integrations/google-calendar/success`,
        );
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Authentication failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * POST /calendar/sync
   * Sync pickup orders to Google Calendar
   */
  app.post<{ Body: any }>(
    "/calendar/sync",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { locationId, startDate, endDate } = CalendarSyncSchema.parse(
          request.body,
        );

        // Get shop from auth context (would be set by middleware)
        const shopId = request.shopId;
        if (!shopId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Get Google Calendar integration
        const integration = await prisma.integration.findFirst({
          where: {
            shopId,
            provider: "google_calendar",
            isEnabled: true,
          },
        });

        if (!integration) {
          return reply
            .status(404)
            .send({ error: "Google Calendar not configured" });
        }

        // Get pickup orders
        const orders = await prisma.pickupOrder.findMany({
          where: {
            locationId,
            scheduledDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          select: {
            id: true,
            customerName: true,
            address: true,
            pickupTime: true,
            phoneNumber: true,
            notes: true,
          },
        });

        // Create calendar service with stored credentials
        const credentials = integration.credentials as any;
        const calendarService = createGoogleCalendarService({
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
          redirectUri: `${process.env.API_URL || "http://localhost:3000"}/api/integrations/google/calendar/callback`,
          scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
          ],
        });

        // Set token
        const token: OAuth2Token = {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
          tokenType: "Bearer",
        };
        calendarService.setToken(token);

        // Set calendar ID
        const config = integration.config as any;
        calendarService.setCalendarId(config.calendarId || "primary");

        // Sync orders
        const result = await calendarService.syncPickupOrders(
          locationId,
          { startDate, endDate },
          orders.map((o) => ({
            id: o.id,
            customerName: o.customerName,
            address: o.address,
            pickupTime: o.pickupTime,
            phoneNumber: o.phoneNumber,
            notes: o.notes,
          })),
        );

        return reply.send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Calendar sync failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * POST /zone/validate
   * Check if address is in service zone
   */
  app.post<{ Body: any }>(
    "/zone/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!googleMapsApiKey) {
          return reply
            .status(503)
            .send({ error: "Google Maps not configured" });
        }

        const { address, shop } = ZoneValidateSchema.parse(request.body);

        // Get shop with zones
        const shopData = await prisma.shop.findUnique({
          where: { domain: shop },
          include: {
            deliveryZones: {
              select: {
                id: true,
                name: true,
                boundaries: true,
              },
            },
          },
        });

        if (!shopData) {
          return reply.status(404).send({ error: "Shop not found" });
        }

        // Geocode address
        const mapsService = createGoogleMapsService(googleMapsApiKey);
        const geocodeResult = await mapsService.geocodeAddress(address);

        // Check if in zone
        const visualizer = createZoneVisualizerService();
        const inZone = shopData.deliveryZones.some((zone) => {
          const boundaries = (zone.boundaries as any[]).map((b) => ({
            latitude: b.latitude,
            longitude: b.longitude,
          }));
          return visualizer.isPointInZone(
            geocodeResult.latitude,
            geocodeResult.longitude,
            { id: zone.id, name: zone.name, boundaries },
          );
        });

        return reply.send({
          address: geocodeResult.address,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
          zipcode: geocodeResult.components?.postalCode,
          inZone,
          zone: inZone ? shopData.deliveryZones[0]?.name : null,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Zone validation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );
}
