// @ts-nocheck
/**
 * Operations API routes (ADR-030).
 *
 * Tenant-defined activity flows (directed graphs of stages) for shipments and
 * orders, plus the transition endpoints that move entities through them.
 *
 *   GET    /api/v4/operations/flows                     List flows
 *   POST   /api/v4/operations/flows                     Create flow
 *   GET    /api/v4/operations/flows/:id                 Get flow
 *   PATCH  /api/v4/operations/flows/:id                 Update flow
 *   DELETE /api/v4/operations/flows/:id                 Delete flow
 *
 *   POST   /api/v4/operations/shipments/:id/transition  Transition a shipment
 *   POST   /api/v4/operations/orders/:id/transition     Transition an order
 *   GET    /api/v4/operations/shipments/:id/next        Allowed next stages
 *   GET    /api/v4/operations/orders/:id/next           Allowed next stages
 *
 * Human principals (role in { SUPER_ADMIN, ADMIN, DISPATCHER }) may configure
 * flows. Any authenticated principal — including OAuth `APP` callers — may
 * request transitions; scope enforcement (e.g. `shipments:transition`) happens
 * at the route layer for APP tokens and inside the engine when the flow
 * definition sets a per-transition `requiredScope`.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  FlowNotFoundError,
  FlowTransitionError,
  FlowValidationException,
  createFlow,
  deleteFlow,
  getFlow,
  listAllowedNextForEntity,
  listFlows,
  transitionOrder,
  transitionShipment,
  updateFlow,
} from "@witylogix/core/operations";
import { requireAuth, requireScopes } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const flowStageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  transitions: z
    .array(
      z.object({
        to: z.string().min(1),
        label: z.string().optional(),
        requiredScope: z.string().optional(),
      }),
    )
    .default([]),
});

const flowGraphSchema = z.object({
  stages: z.array(flowStageSchema).default([]),
});

const createFlowSchema = z.object({
  entityType: z.enum(["SHIPMENT", "ORDER"]),
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9_-]+$/,
      "key must be lowercase alphanumeric, dash, underscore",
    ),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  graph: flowGraphSchema,
  isDefault: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  graph: flowGraphSchema.optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

const transitionSchema = z.object({
  toStage: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

// ─── Helpers ────────────────────────────────────────────────

const CONFIG_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "DISPATCHER"]);

function assertConfigRole(request: FastifyRequest): void {
  if (!CONFIG_ROLES.has(request.auth.role)) {
    throw new ForbiddenError(
      "Only admins and dispatchers can manage activity flows",
    );
  }
}

function mapEngineError(err: unknown): never {
  if (err instanceof FlowValidationException) {
    throw new BadRequestError(err.message);
  }
  if (err instanceof FlowNotFoundError) {
    throw new NotFoundError("ActivityFlow");
  }
  if (err instanceof FlowTransitionError) {
    throw new BadRequestError(err.message);
  }
  throw err;
}

function actorFromRequest(request: FastifyRequest) {
  if (request.auth.role === "APP") {
    return {
      type: "app" as const,
      id: request.auth.appInstallationId,
    };
  }
  if (request.auth.role === "DRIVER" && request.auth.driverId) {
    return { type: "user" as const, id: request.auth.driverId };
  }
  return {
    type: "user" as const,
    id: request.auth.userId,
  };
}

function scopesFromRequest(request: FastifyRequest): string[] {
  if (request.auth.role === "APP") {
    return request.auth.scopes ?? [];
  }
  return ["*"];
}

// ─── Routes ─────────────────────────────────────────────────

async function operationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── Flow CRUD ────────────────────────────────────────────

  fastify.get<{ Querystring: { entityType?: "SHIPMENT" | "ORDER" } }>(
    "/flows",
    {
      preHandler: [requireScopes("operations:read")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const entityType = request.query?.entityType;
      const flows = await listFlows(request.shopId, entityType);
      return { data: flows };
    },
  );

  fastify.post<{ Body: z.infer<typeof createFlowSchema> }>(
    "/flows",
    {
      preHandler: [requireScopes("operations:write")],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      assertConfigRole(request);
      const body = createFlowSchema.parse(request.body);
      try {
        const flow = await createFlow({ shopId: request.shopId, ...body });
        reply.status(201);
        return { data: flow };
      } catch (err) {
        mapEngineError(err);
      }
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/flows/:id",
    {
      preHandler: [requireScopes("operations:read")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const flow = await getFlow(request.params.id, request.shopId);
      if (!flow) throw new NotFoundError("ActivityFlow", request.params.id);
      return { data: flow };
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateFlowSchema>;
  }>(
    "/flows/:id",
    {
      preHandler: [requireScopes("operations:write")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      assertConfigRole(request);
      const body = updateFlowSchema.parse(request.body);
      try {
        const flow = await updateFlow({
          id: request.params.id,
          shopId: request.shopId,
          ...body,
        });
        return { data: flow };
      } catch (err) {
        mapEngineError(err);
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/flows/:id",
    {
      preHandler: [requireScopes("operations:write")],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      assertConfigRole(request);
      try {
        await deleteFlow(request.params.id, request.shopId);
      } catch (err) {
        mapEngineError(err);
      }
      reply.status(204);
      return null;
    },
  );

  // ── Transitions ──────────────────────────────────────────

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof transitionSchema>;
  }>(
    "/shipments/:id/transition",
    {
      preHandler: [requireScopes("shipments:transition")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = transitionSchema.parse(request.body);
      try {
        const result = await transitionShipment({
          entityId: request.params.id,
          toStage: body.toStage,
          reason: body.reason,
          scopes: scopesFromRequest(request),
          actor: actorFromRequest(request),
        });
        return { data: result };
      } catch (err) {
        mapEngineError(err);
      }
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof transitionSchema>;
  }>(
    "/orders/:id/transition",
    {
      preHandler: [requireScopes("orders:transition")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = transitionSchema.parse(request.body);
      try {
        const result = await transitionOrder({
          entityId: request.params.id,
          toStage: body.toStage,
          reason: body.reason,
          scopes: scopesFromRequest(request),
          actor: actorFromRequest(request),
        });
        return { data: result };
      } catch (err) {
        mapEngineError(err);
      }
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/shipments/:id/next",
    {
      preHandler: [requireScopes("shipments:read")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const result = await listAllowedNextForEntity(
        "SHIPMENT",
        request.params.id,
      );
      if (!result) throw new NotFoundError("Shipment", request.params.id);
      return {
        data: {
          flowId: result.flow.id,
          flowKey: result.flow.key,
          currentStage: result.currentStage,
          next: result.next,
        },
      };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/orders/:id/next",
    {
      preHandler: [requireScopes("orders:read")],
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const result = await listAllowedNextForEntity("ORDER", request.params.id);
      if (!result) throw new NotFoundError("Order", request.params.id);
      return {
        data: {
          flowId: result.flow.id,
          flowKey: result.flow.key,
          currentStage: result.currentStage,
          next: result.next,
        },
      };
    },
  );
}

export default operationsRoutes;
