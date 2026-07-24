/**
 * Feature Requests — track and vote on feature requests.
 *
 * Routes:
 *   POST   /              Create feature request { title, description, category? }
 *   GET    /              List with filters { status?, category?, sort?, page?, limit? }
 *   GET    /:id           Get feature request
 *   PUT    /:id           Update { title?, description?, status?, category? }
 *   POST   /:id/vote      Vote for feature request
 *   DELETE /:id           Delete (admin only)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const createFeatureRequestSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().optional(),
});

const updateFeatureRequestSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: z
    .enum(["OPEN", "PLANNED", "IN_PROGRESS", "COMPLETED", "REJECTED"])
    .optional(),
  category: z.string().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const listFeatureRequestsQuery = paginationSchema.extend({
  status: z
    .enum(["OPEN", "PLANNED", "IN_PROGRESS", "COMPLETED", "REJECTED"])
    .optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["votes", "createdAt", "updatedAt"]).default("votes"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function featureRequestsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST / ──────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createFeatureRequestSchema.parse(request.body);

    const featureRequest = await (
      request.tenantDb as any
    ).featureRequest.create({
      data: {
        shopId: request.shopId,
        title: body.title,
        description: body.description,
        category: body.category,
        status: "OPEN",
        votes: 0,
        createdBy: request.auth.userId,
      },
      include: {
        creator: { select: { id: true, email: true, name: true } },
      },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        requestId: featureRequest.id,
        title: body.title,
      },
      "Feature request created",
    );

    reply.status(201);
    return { data: featureRequest };
  });

  // ── GET / ────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listFeatureRequestsQuery.parse(request.query);
    const { page, limit, status, category, search, sort, sortOrder } = query;

    const where: any = {
      shopId: request.shopId,
    };

    if (status) {
      where.status = status as any;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Determine sort field
    let orderBy: Record<string, string> = {};
    if (sort === "votes") {
      orderBy = { votes: sortOrder };
    } else {
      orderBy = { [sort]: sortOrder };
    }

    const [requests, total] = await Promise.all([
      (request.tenantDb as any).featureRequest.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, email: true, name: true } },
          votes: { select: { userId: true } },
        },
      }),
      (request.tenantDb as any).featureRequest.count({ where }),
    ]);

    // Transform to include vote count
    const transformed = requests.map((req: any) => ({
      ...req,
      userVoted: req.votes.some((v: any) => v.userId === request.auth.userId),
      voteCount: req.votes.length,
      votes: undefined,
    }));

    return {
      data: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET /:id ─────────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const featureRequest = await (
      request.tenantDb as any
    ).featureRequest.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        votes: { select: { userId: true } },
      },
    });

    if (!featureRequest) {
      throw new NotFoundError("Feature request", id);
    }

    if (featureRequest.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot access feature request from another shop",
      );
    }

    return {
      data: {
        ...featureRequest,
        userVoted: featureRequest.votes.some(
          (v: any) => v.userId === request.auth.userId,
        ),
        voteCount: featureRequest.votes.length,
        votes: undefined,
      },
    };
  });

  // ── PUT /:id ─────────────────────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateFeatureRequestSchema.parse(request.body);

    const featureRequest = await (
      request.tenantDb as any
    ).featureRequest.findUnique({
      where: { id },
    });

    if (!featureRequest) {
      throw new NotFoundError("Feature request", id);
    }

    if (featureRequest.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot update feature request from another shop",
      );
    }

    const updated = await (request.tenantDb as any).featureRequest.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status as any,
        category: body.category,
        updatedAt: new Date(),
      },
      include: {
        creator: { select: { id: true, email: true, name: true } },
      },
    });

    fastify.log.info(
      { shopId: request.shopId, requestId: id, status: body.status },
      "Feature request updated",
    );

    return { data: updated };
  });

  // ── POST /:id/vote ───────────────────────────────────────────

  fastify.post(
    "/:id/vote",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const featureRequest = await (
        request.tenantDb as any
      ).featureRequest.findUnique({
        where: { id },
      });

      if (!featureRequest) {
        throw new NotFoundError("Feature request", id);
      }

      if (featureRequest.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot vote on feature request from another shop",
        );
      }

      // Check if user already voted
      const existingVote = await (
        request.tenantDb as any
      ).featureRequestVote.findFirst({
        where: {
          featureRequestId: id,
          userId: request.auth.userId,
        },
      });

      if (existingVote) {
        // Remove vote (toggle)
        await (request.tenantDb as any).featureRequestVote.delete({
          where: { id: existingVote.id },
        });

        const updated = await (request.tenantDb as any).featureRequest.update({
          where: { id },
          data: {
            votes: { decrement: 1 },
            updatedAt: new Date(),
          },
        });

        fastify.log.info(
          {
            shopId: request.shopId,
            requestId: id,
            userId: request.auth.userId,
          },
          "Feature request vote removed",
        );

        return { data: updated, voted: false };
      } else {
        // Add vote
        await (request.tenantDb as any).featureRequestVote.create({
          data: {
            featureRequestId: id,
            userId: request.auth.userId!,
          },
        });

        const updated = await (request.tenantDb as any).featureRequest.update({
          where: { id },
          data: {
            votes: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        fastify.log.info(
          {
            shopId: request.shopId,
            requestId: id,
            userId: request.auth.userId,
          },
          "Feature request voted",
        );

        reply.status(201);
        return { data: updated, voted: true };
      }
    },
  );

  // ── DELETE /:id ──────────────────────────────────────────────

  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const featureRequest = await (
        request.tenantDb as any
      ).featureRequest.findUnique({
        where: { id },
      });

      if (!featureRequest) {
        throw new NotFoundError("Feature request", id);
      }

      if (featureRequest.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot delete feature request from another shop",
        );
      }

      // Soft delete or hard delete with cascade
      const deleted = await (request.tenantDb as any).featureRequest.delete({
        where: { id },
      });

      fastify.log.info(
        { shopId: request.shopId, requestId: id },
        "Feature request deleted",
      );

      reply.status(204);
      return;
    },
  );
}

export default featureRequestsRoutes;
