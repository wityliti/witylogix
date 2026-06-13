/**
 * Campaigns API — Marketing campaign management
 *
 * Routes:
 *   GET    /stats              Aggregate campaign counts by status
 *   GET    /                   List campaigns (paginated, filterable)
 *   GET    /:id                Get campaign detail
 *   GET    /:id/geo            Recipient geographic distribution (for map)
 *   GET    /:id/events         Campaign events (sent, delivered, opened, etc.)
 *   POST   /                   Create campaign
 *   PATCH  /:id                Update campaign (draft/scheduled only)
 *   POST   /:id/send           Trigger campaign send
 *   POST   /:id/pause          Pause sending campaign
 *   POST   /:id/resume         Resume paused campaign
 *   DELETE /:id                Delete campaign (draft only)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../lib/errors.js";

// ─── City lookup for geo/reach map ─────────────────────────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "New York": { lat: 40.7128, lng: -74.006 },
  "New York City": { lat: 40.7128, lng: -74.006 },
  NYC: { lat: 40.7128, lng: -74.006 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  Houston: { lat: 29.7604, lng: -95.3698 },
  Phoenix: { lat: 33.4484, lng: -112.074 },
  Philadelphia: { lat: 39.9526, lng: -75.1652 },
  "San Antonio": { lat: 29.4241, lng: -98.4936 },
  "San Diego": { lat: 32.7157, lng: -117.1611 },
  Dallas: { lat: 32.7767, lng: -96.797 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Austin: { lat: 30.2672, lng: -97.7431 },
  Seattle: { lat: 47.6062, lng: -122.3321 },
  Denver: { lat: 39.7392, lng: -104.9903 },
  Boston: { lat: 42.3601, lng: -71.0589 },
  Nashville: { lat: 36.1627, lng: -86.7816 },
  Miami: { lat: 25.7617, lng: -80.1918 },
  Atlanta: { lat: 33.749, lng: -84.388 },
  Minneapolis: { lat: 44.9778, lng: -93.265 },
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Toronto: { lat: 43.6532, lng: -79.3832 },
  Vancouver: { lat: 49.2827, lng: -123.1207 },
  Montreal: { lat: 45.5017, lng: -73.5673 },
  Calgary: { lat: 51.0447, lng: -114.0719 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Melbourne: { lat: -37.8136, lng: 144.9631 },
  Brisbane: { lat: -27.4698, lng: 153.0251 },
  Perth: { lat: -31.9505, lng: 115.8605 },
  Dublin: { lat: 53.3498, lng: -6.2603 },
  Auckland: { lat: -36.8485, lng: 174.7633 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  Dubai: { lat: 25.2048, lng: 55.2708 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Johannesburg: { lat: -26.2041, lng: 28.0473 },
  "Cape Town": { lat: -33.9249, lng: 18.4241 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Nairobi: { lat: -1.2921, lng: 36.8219 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  Seoul: { lat: 37.5665, lng: 126.978 },
  Shanghai: { lat: 31.2304, lng: 121.4737 },
  Beijing: { lat: 39.9042, lng: 116.4074 },
  "São Paulo": { lat: -23.5505, lng: -46.6333 },
  "Mexico City": { lat: 19.4326, lng: -99.1332 },
  "Buenos Aires": { lat: -34.6037, lng: -58.3816 },
};

function lookupCityCoords(
  city: string,
  _country?: string | null
): { lat: number; lng: number } | null {
  if (!city) return null;
  const exact = CITY_COORDS[city];
  if (exact) return exact;
  const lower = city.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (
      k.toLowerCase() === lower ||
      k.toLowerCase().includes(lower) ||
      lower.includes(k.toLowerCase())
    ) {
      return v;
    }
  }
  return null;
}

// ─── SCHEMAS ────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "MULTI_CHANNEL"]),
  templateId: z.string().uuid().optional(),
  audienceFilter: z
    .object({
      recipientType: z.enum(["CUSTOMERS", "DRIVERS", "BOTH"]).optional(),
      tags: z.array(z.string()).optional(),
      createdAfter: z.string().datetime().optional(),
      createdBefore: z.string().datetime().optional(),
    })
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  templateId: z.string().uuid().optional(),
  audienceFilter: z
    .object({
      recipientType: z.enum(["CUSTOMERS", "DRIVERS", "BOTH"]).optional(),
      tags: z.array(z.string()).optional(),
      createdAfter: z.string().datetime().optional(),
      createdBefore: z.string().datetime().optional(),
    })
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function campaignsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);
  fastify.addHook("preHandler", requireRole("ADMIN", "DISPATCHER"));

  // ── STATS ──────────────────────────────────────────────────────────────────

  fastify.get(
    "/stats",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const groups = await request.tenantDb.campaign.groupBy({
        by: ["status"],
        where: { shopId: request.shopId },
        _count: { id: true },
      });

      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const row of groups) {
        byStatus[row.status] = row._count.id;
        total += row._count.id;
      }

      const totalSent = await request.tenantDb.campaign.aggregate({
        where: { shopId: request.shopId },
        _sum: { sentCount: true, deliveredCount: true, openedCount: true, clickedCount: true },
      });

      return {
        data: {
          total,
          byStatus,
          sentCount: totalSent._sum.sentCount ?? 0,
          deliveredCount: totalSent._sum.deliveredCount ?? 0,
          openedCount: totalSent._sum.openedCount ?? 0,
          clickedCount: totalSent._sum.clickedCount ?? 0,
        },
      };
    }
  );

  // ── LIST CAMPAIGNS ──────────────────────────────────────────────────────────

  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          page = 1,
          limit = 20,
          type,
          status,
          search,
        } = request.query as {
          page?: number;
          limit?: number;
          type?: string;
          status?: string;
          search?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
          shopId: request.shopId,
          ...(type ? { type } : {}),
          ...(status ? { status } : {}),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        };

        const [total, items] = await Promise.all([
          request.tenantDb.campaign.count({ where }),
          request.tenantDb.campaign.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (pageNum - 1) * pageSize,
            take: pageSize,
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              sentCount: true,
              deliveredCount: true,
              openedCount: true,
              clickedCount: true,
              failedCount: true,
              unsubscribedCount: true,
              scheduledAt: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
        ]);

        return {
          data: items,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to list campaigns");
        return reply.code(500).send({ error: "Failed to list campaigns" });
      }
    }
  );

  // ── GET SINGLE CAMPAIGN ─────────────────────────────────────────────────────

  fastify.get(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
        });

        if (!campaign) {
          throw new NotFoundError("Campaign", id);
        }

        return { data: campaign };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get campaign");
        return reply.code(500).send({ error: "Failed to get campaign" });
      }
    }
  );

  // ── CAMPAIGN GEO (recipient/customer city distribution) ────────────────────

  fastify.get(
    "/:id/geo",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { id: true },
        });

        if (!campaign) {
          throw new NotFoundError("Campaign", id);
        }

        const rows = await request.tenantDb.$queryRaw<
          {
            city: string;
            country: string | null;
            customer_count: bigint;
            order_count: bigint;
          }[]
        >`
          SELECT
            city,
            country,
            COUNT(DISTINCT customer_email)::bigint AS customer_count,
            COUNT(*)::bigint                       AS order_count
          FROM orders
          WHERE shop_id = ${request.shopId}::uuid
            AND city IS NOT NULL
            AND city != ''
          GROUP BY city, country
          ORDER BY customer_count DESC
          LIMIT 50
        `;

        const points = rows
          .map((r) => {
            const coords = lookupCityCoords(r.city, r.country);
            if (!coords) return null;
            return {
              city: r.city,
              country: r.country ?? null,
              customerCount: Number(r.customer_count),
              orderCount: Number(r.order_count),
              lat: coords.lat,
              lng: coords.lng,
            };
          })
          .filter(Boolean);

        return { data: points };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get campaign geo");
        return reply.code(500).send({ error: "Failed to get campaign geo" });
      }
    }
  );

  // ── CREATE CAMPAIGN ─────────────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createCampaignSchema.parse(request.body);
      const userId: string = (request.auth as any)?.userId ?? request.shopId;

      const campaign = await request.tenantDb.campaign.create({
        data: {
          shopId: request.shopId,
          tenantId: request.shopId,
          name: body.name,
          type: body.type as any,
          status: body.scheduledAt ? ("SCHEDULED" as any) : ("DRAFT" as any),
          templateId: body.templateId ?? null,
          audienceFilter: (body.audienceFilter as any) ?? {},
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          metadata: (body.metadata as any) ?? {},
          createdBy: userId,
        },
      });

      return reply.code(201).send(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply
          .code(400)
          .send({ error: "Validation failed", details: error.issues });
      }
      if (error instanceof ValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, "Failed to create campaign");
      return reply.code(500).send({ error: "Failed to create campaign" });
    }
  });

  // ── UPDATE CAMPAIGN ─────────────────────────────────────────────────────────

  fastify.patch(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCampaignSchema.parse(request.body);

        const existing = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundError("Campaign", id);

        if (!["DRAFT", "SCHEDULED"].includes(existing.status)) {
          throw new ConflictError(
            `Cannot update campaign in '${existing.status}' status`
          );
        }

        const campaign = await request.tenantDb.campaign.update({
          where: { id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.templateId !== undefined
              ? { templateId: body.templateId }
              : {}),
            ...(body.audienceFilter !== undefined
              ? { audienceFilter: body.audienceFilter as any }
              : {}),
            ...(body.scheduledAt !== undefined
              ? {
                  scheduledAt: body.scheduledAt
                    ? new Date(body.scheduledAt)
                    : null,
                  status: body.scheduledAt ? ("SCHEDULED" as any) : undefined,
                }
              : {}),
            ...(body.metadata !== undefined
              ? { metadata: body.metadata as any }
              : {}),
          },
        });

        return campaign;
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        if (error instanceof ConflictError)
          return reply.code(409).send({ error: error.message });
        if (error instanceof z.ZodError)
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        fastify.log.error({ err: error }, "Failed to update campaign");
        return reply.code(500).send({ error: "Failed to update campaign" });
      }
    }
  );

  // ── SEND CAMPAIGN ───────────────────────────────────────────────────────────

  fastify.post(
    "/:id/send",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const existing = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundError("Campaign", id);

        if (!["DRAFT", "SCHEDULED"].includes(existing.status)) {
          throw new ConflictError(
            `Cannot send campaign in '${existing.status}' status`
          );
        }

        const campaign = await request.tenantDb.campaign.update({
          where: { id },
          data: { status: "SENDING" as any, startedAt: new Date() },
        });

        fastify.log.info({ campaignId: id, shopId: request.shopId }, "Campaign send triggered");
        return campaign;
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        if (error instanceof ConflictError)
          return reply.code(409).send({ error: error.message });
        fastify.log.error({ err: error }, "Failed to send campaign");
        return reply.code(500).send({ error: "Failed to send campaign" });
      }
    }
  );

  // ── PAUSE CAMPAIGN ──────────────────────────────────────────────────────────

  fastify.post(
    "/:id/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const existing = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundError("Campaign", id);

        if (!["SENDING", "SCHEDULED"].includes(existing.status)) {
          throw new ConflictError(
            `Cannot pause campaign in '${existing.status}' status`
          );
        }

        const campaign = await request.tenantDb.campaign.update({
          where: { id },
          data: { status: "PAUSED" as any },
        });

        return campaign;
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        if (error instanceof ConflictError)
          return reply.code(409).send({ error: error.message });
        fastify.log.error({ err: error }, "Failed to pause campaign");
        return reply.code(500).send({ error: "Failed to pause campaign" });
      }
    }
  );

  // ── RESUME CAMPAIGN ─────────────────────────────────────────────────────────

  fastify.post(
    "/:id/resume",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const existing = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundError("Campaign", id);

        if (existing.status !== "PAUSED") {
          throw new ConflictError(
            `Cannot resume campaign in '${existing.status}' status`
          );
        }

        const campaign = await request.tenantDb.campaign.update({
          where: { id },
          data: { status: "SENDING" as any },
        });

        return campaign;
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        if (error instanceof ConflictError)
          return reply.code(409).send({ error: error.message });
        fastify.log.error({ err: error }, "Failed to resume campaign");
        return reply.code(500).send({ error: "Failed to resume campaign" });
      }
    }
  );

  // ── DELETE CAMPAIGN ─────────────────────────────────────────────────────────

  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const existing = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { status: true },
        });

        if (!existing) throw new NotFoundError("Campaign", id);

        if (existing.status !== "DRAFT") {
          throw new ConflictError(
            `Cannot delete campaign in '${existing.status}' status`
          );
        }

        await request.tenantDb.campaign.delete({ where: { id } });

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        if (error instanceof ConflictError)
          return reply.code(409).send({ error: error.message });
        fastify.log.error({ err: error }, "Failed to delete campaign");
        return reply.code(500).send({ error: "Failed to delete campaign" });
      }
    }
  );

  // ── GET CAMPAIGN EVENTS ─────────────────────────────────────────────────────

  fastify.get(
    "/:id/events",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 50, eventType } = request.query as {
          page?: number;
          limit?: number;
          eventType?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));

        const campaign = await request.tenantDb.campaign.findFirst({
          where: { id, shopId: request.shopId },
          select: { id: true },
        });

        if (!campaign) throw new NotFoundError("Campaign", id);

        const where = {
          campaignId: id,
          ...(eventType ? { event: eventType as any } : {}),
        };

        const [total, items] = await Promise.all([
          request.tenantDb.campaignEvent.count({ where }),
          request.tenantDb.campaignEvent.findMany({
            where,
            orderBy: { timestamp: "desc" },
            skip: (pageNum - 1) * pageSize,
            take: pageSize,
          }),
        ]);

        return {
          data: items,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        if (error instanceof NotFoundError)
          return reply.code(404).send({ error: error.message });
        fastify.log.error({ err: error }, "Failed to get campaign events");
        return reply.code(500).send({ error: "Failed to get campaign events" });
      }
    }
  );
}

export default campaignsRoutes;
