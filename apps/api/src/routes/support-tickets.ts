/**
 * Support Tickets — customer support ticket lifecycle management.
 *
 * Routes:
 *   POST   /                 Create ticket { subject, description, priority?, category? }
 *   GET    /                 List tickets with filters { status?, priority?, category?, page?, limit? }
 *   GET    /:id              Get ticket with messages
 *   PUT    /:id              Update ticket { subject?, description?, priority?, category?, status? }
 *   POST   /:id/messages     Add message { content, isInternal? }
 *   PUT    /:id/assign       Assign ticket { assigneeId }
 *   PUT    /:id/resolve      Resolve ticket
 *   PUT    /:id/close        Close ticket
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
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

const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
  category: z.string().optional(),
});

const updateTicketSchema = z.object({
  subject: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPEN"]).optional(),
});

const addMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
});

const assignTicketSchema = z.object({
  assigneeId: z.string().uuid(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const listTicketsQuery = paginationSchema.extend({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "priority", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function supportTicketsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST / ──────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createTicketSchema.parse(request.body);

    const ticket = await (request.tenantDb as any).supportTicket.create({
      data: {
        shopId: request.shopId,
        subject: body.subject,
        description: body.description,
        priority: body.priority as any,
        category: body.category,
        status: "OPEN",
        createdBy: request.auth.userId,
      },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
      },
    });

    fastify.log.info(
      { shopId: request.shopId, ticketId: ticket.id, subject: body.subject },
      "Support ticket created",
    );

    reply.status(201);
    return { data: ticket };
  });

  // ── GET / ────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listTicketsQuery.parse(request.query);
    const { page, limit, status, priority, category, search, sortBy, sortOrder } = query;

    const where: any = {
      shopId: request.shopId,
    };

    if (status) {
      where.status = status as any;
    }
    if (priority) {
      where.priority = priority as any;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tickets, total] = await Promise.all([
      (request.tenantDb as any).supportTicket.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, email: true, name: true } },
          assignee: { select: { id: true, email: true, name: true } },
          messages: { select: { id: true, createdAt: true } },
        },
      }),
      (request.tenantDb as any).supportTicket.count({ where }),
    ]);

    return {
      data: tickets,
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

    const ticket = await (request.tenantDb as any).supportTicket.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError("Support ticket", id);
    }

    if (ticket.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot access ticket from another shop");
    }

    return { data: ticket };
  });

  // ── PUT /:id ─────────────────────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateTicketSchema.parse(request.body);

    const ticket = await (request.tenantDb as any).supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundError("Support ticket", id);
    }

    if (ticket.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot update ticket from another shop");
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        OPEN: ["IN_PROGRESS", "CLOSED", "RESOLVED"],
        IN_PROGRESS: ["RESOLVED", "CLOSED", "REOPEN"],
        RESOLVED: ["CLOSED", "REOPEN"],
        CLOSED: ["REOPEN"],
        REOPEN: ["IN_PROGRESS", "CLOSED"],
      };

      if (!validTransitions[ticket.status]?.includes(body.status)) {
        throw new ValidationError(
          `Cannot transition from ${ticket.status} to ${body.status}`,
        );
      }
    }

    const updated = await (request.tenantDb as any).supportTicket.update({
      where: { id },
      data: {
        subject: body.subject,
        description: body.description,
        priority: body.priority as any,
        category: body.category,
        status: body.status as any,
        updatedAt: new Date(),
      },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
      },
    });

    fastify.log.info(
      { shopId: request.shopId, ticketId: id, status: body.status },
      "Support ticket updated",
    );

    return { data: updated };
  });

  // ── POST /:id/messages ───────────────────────────────────────

  fastify.post(
    "/:id/messages",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = addMessageSchema.parse(request.body);

      const ticket = await (request.tenantDb as any).supportTicket.findUnique({
        where: { id },
      });

      if (!ticket) {
        throw new NotFoundError("Support ticket", id);
      }

      if (ticket.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot add message to ticket from another shop");
      }

      const message = await (request.tenantDb as any).ticketMessage.create({
        data: {
          ticketId: id,
          content: body.content,
          isInternal: body.isInternal,
          authorId: request.auth.userId,
        },
        include: {
          author: { select: { id: true, email: true, name: true } },
        },
      });

      // Update ticket's updatedAt
      await (request.tenantDb as any).supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      fastify.log.info(
        { shopId: request.shopId, ticketId: id, messageId: message.id },
        "Ticket message added",
      );

      reply.status(201);
      return { data: message };
    },
  );

  // ── PUT /:id/assign ──────────────────────────────────────────

  fastify.put(
    "/:id/assign",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const { assigneeId } = assignTicketSchema.parse(request.body);

      const ticket = await (request.tenantDb as any).supportTicket.findUnique({
        where: { id },
      });

      if (!ticket) {
        throw new NotFoundError("Support ticket", id);
      }

      if (ticket.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot assign ticket from another shop");
      }

      // Verify assignee exists and belongs to shop
      const assignee = await request.tenantDb.user.findUnique({
        where: { id: assigneeId },
      });

      if (!assignee || assignee.shopId !== request.shopId) {
        throw new NotFoundError("User", assigneeId);
      }

      const updated = await (request.tenantDb as any).supportTicket.update({
        where: { id },
        data: {
          assigneeId,
          status: "IN_PROGRESS",
        },
        include: {
          assignee: { select: { id: true, email: true, name: true } },
        },
      });

      fastify.log.info(
        { shopId: request.shopId, ticketId: id, assigneeId },
        "Ticket assigned",
      );

      return { data: updated };
    },
  );

  // ── PUT /:id/resolve ─────────────────────────────────────────

  fastify.put(
    "/:id/resolve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const ticket = await (request.tenantDb as any).supportTicket.findUnique({
        where: { id },
      });

      if (!ticket) {
        throw new NotFoundError("Support ticket", id);
      }

      if (ticket.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot resolve ticket from another shop");
      }

      if (ticket.status === "CLOSED") {
        throw new ConflictError("Cannot resolve a closed ticket");
      }

      const updated = await (request.tenantDb as any).supportTicket.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
        include: {
          creator: { select: { id: true, email: true, name: true } },
          assignee: { select: { id: true, email: true, name: true } },
        },
      });

      fastify.log.info(
        { shopId: request.shopId, ticketId: id },
        "Ticket marked resolved",
      );

      return { data: updated };
    },
  );

  // ── PUT /:id/close ───────────────────────────────────────────

  fastify.put(
    "/:id/close",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const ticket = await (request.tenantDb as any).supportTicket.findUnique({
        where: { id },
      });

      if (!ticket) {
        throw new NotFoundError("Support ticket", id);
      }

      if (ticket.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot close ticket from another shop");
      }

      const updated = await (request.tenantDb as any).supportTicket.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
        include: {
          creator: { select: { id: true, email: true, name: true } },
          assignee: { select: { id: true, email: true, name: true } },
        },
      });

      fastify.log.info(
        { shopId: request.shopId, ticketId: id },
        "Ticket closed",
      );

      return { data: updated };
    },
  );
}

export default supportTicketsRoutes;
