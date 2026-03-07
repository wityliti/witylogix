// @ts-nocheck
/**
 * Workflow Orders Routes — Order creation via workflow engine.
 *
 * Wraps order creation in the createDeliveryOrderWorkflow, enabling:
 * - Validation → Geocoding → Rate Calculation → Inventory Check → etc.
 * - Automatic rollback on failure with compensation
 * - Execution tracking and retry capability
 *
 * Routes:
 *   POST   /api/workflow/orders                Create order via workflow
 *   GET    /api/workflow/orders/:id/execution  Get workflow execution for an order
 *   POST   /api/workflow/orders/:id/retry      Retry a failed order creation workflow
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { WorkflowEngine } from "@witylogix/framework";
import type {
  CreateDeliveryOrderInput,
  CreateDeliveryOrderOutput,
} from "@witylogix/workflows";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const createOrderSchema = z.object({
  shopifyOrderId: z.string().min(1),
  shopifyOrderNumber: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(5),
  pickupLocationId: z.string().uuid(),
  deliveryAddressLine1: z.string().min(1),
  deliveryAddressLine2: z.string().optional(),
  deliveryCity: z.string().min(1),
  deliveryProvince: z.string().optional(),
  deliveryPostalCode: z.string().min(1),
  deliveryCountry: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional(),
        title: z.string().min(1),
        quantity: z.number().int().positive(),
        weight: z.number().positive().optional(),
        price: z.number().positive().optional(),
      })
    )
    .min(1),
  preferredDeliveryDate: z.string().datetime().optional(),
  timeSlotId: z.string().uuid().optional(),
  totalPrice: z.number().positive(),
  totalWeight: z.number().positive(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getExecutionQuerySchema = z.object({
  executionId: z.string().uuid().optional(),
});

const retrySchema = z.object({
  executionId: z.string().uuid(),
});

// ─── Types ──────────────────────────────────────────────────

interface WorkflowExecutionRecord {
  id: string;
  orderId?: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating" | "compensated";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

// ─── Route Plugin ────────────────────────────────────────────

async function workflowOrderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST /api/workflow/orders (Create order via workflow) ──

  fastify.post<{
    Body: z.infer<typeof createOrderSchema>;
  }>(
    "/",
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof createOrderSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const body = createOrderSchema.parse(request.body);

      const tenantId = (request as any).tenantId;
      const userId = (request as any).auth?.userId;
      const tenantDb = (request as any).tenantDb;

      if (!tenantId || !userId) {
        throw new ValidationError("Missing tenant or user context");
      }

      // Verify pickup location exists in tenant
      const pickupLocation = await tenantDb.location.findUnique({
        where: { id: body.pickupLocationId },
        select: { id: true, latitude: true, longitude: true },
      });

      if (!pickupLocation) {
        throw new NotFoundError("Pickup location not found");
      }

      // Check if order with same Shopify ID already exists
      const existingOrder = await tenantDb.order.findFirst({
        where: { shopifyOrderId: body.shopifyOrderId },
      });

      if (existingOrder) {
        throw new ConflictError(
          `Order with Shopify ID ${body.shopifyOrderId} already exists`
        );
      }

      // Build workflow context
      const workflowContext = {
        tenantDb,
        prisma,
        userId,
        tenantId,
        logger: fastify.log,
        metadata: {
          requestId: request.id,
          userAgent: request.headers["user-agent"],
        },
        transactionId: request.id,
      };

      // Build workflow input
      const workflowInput: CreateDeliveryOrderInput = {
        shopId: tenantId,
        userId,
        shopifyOrderId: body.shopifyOrderId,
        shopifyOrderNumber: body.shopifyOrderNumber,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        pickupLocationId: body.pickupLocationId,
        deliveryAddressLine1: body.deliveryAddressLine1,
        deliveryAddressLine2: body.deliveryAddressLine2,
        deliveryCity: body.deliveryCity,
        deliveryProvince: body.deliveryProvince,
        deliveryPostalCode: body.deliveryPostalCode,
        deliveryCountry: body.deliveryCountry,
        items: body.items,
        preferredDeliveryDate: body.preferredDeliveryDate
          ? new Date(body.preferredDeliveryDate)
          : undefined,
        timeSlotId: body.timeSlotId,
        totalPrice: body.totalPrice,
        totalWeight: body.totalWeight,
        notes: body.notes,
        tags: body.tags,
        metadata: body.metadata,
      };

      // Execute workflow
      const engine = new WorkflowEngine();
      let execution;

      try {
        execution = await engine.executeWorkflow(
          "createDeliveryOrder",
          workflowInput,
          workflowContext
        );
      } catch (error) {
        fastify.log.error("Workflow execution failed", error);
        throw new InternalServerError(
          `Order creation workflow failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Store execution record in database for auditing/retry
      const executionRecord = await tenantDb.workflowExecution.create({
        data: {
          id: execution.id,
          workflowName: execution.workflowName,
          status: execution.status,
          input: execution.input,
          output: execution.output,
          error: execution.error?.message,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          metadata: {
            userId,
            orderId: (execution.output as any)?.orderId,
          },
        },
      });

      if (execution.status === "failed") {
        reply.status(500);
        return {
          data: null,
          error: {
            code: "WORKFLOW_FAILED",
            message: "Order creation workflow failed",
            executionId: execution.id,
            details: execution.error?.message,
          },
        };
      }

      if (execution.status !== "completed") {
        reply.status(202); // Accepted
        return {
          data: {
            executionId: execution.id,
            status: execution.status,
            message: "Order creation workflow in progress",
          },
        };
      }

      const output = execution.output as CreateDeliveryOrderOutput;

      reply.status(201);
      return {
        data: {
          orderId: output.orderId,
          trackingToken: output.trackingToken,
          status: output.status,
          shippingRate: output.shippingRate,
          assignedZone: output.assignedZone,
          confirmationSent: output.confirmationSent,
          executionId: execution.id,
          totalDurationMs: output.totalDurationMs,
        },
      };
    }
  );

  // ── GET /api/workflow/orders/:id/execution (Get execution) ──

  fastify.get<{
    Params: { id: string };
    Querystring: z.infer<typeof getExecutionQuerySchema>;
  }>(
    "/:id/execution",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: z.infer<typeof getExecutionQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id: orderId } = request.params;
      const { executionId } = getExecutionQuerySchema.parse(request.query);

      const tenantDb = (request as any).tenantDb;

      // Find execution by orderId or executionId
      const whereClause = executionId
        ? { id: executionId }
        : { metadata: { path: ["orderId"], equals: orderId } };

      const execution = await tenantDb.workflowExecution.findFirst({
        where: whereClause,
      });

      if (!execution) {
        throw new NotFoundError(
          `Workflow execution not found for order ${orderId}`
        );
      }

      return {
        data: {
          executionId: execution.id,
          workflowName: execution.workflowName,
          status: execution.status,
          input: execution.input,
          output: execution.output,
          error: execution.error,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
        },
      };
    }
  );

  // ── POST /api/workflow/orders/:id/retry (Retry failed workflow) ──

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof retrySchema>;
  }>(
    "/:id/retry",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof retrySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id: orderId } = request.params;
      const { executionId } = retrySchema.parse(request.body);

      const tenantId = (request as any).tenantId;
      const userId = (request as any).auth?.userId;
      const tenantDb = (request as any).tenantDb;

      if (!tenantId || !userId) {
        throw new ValidationError("Missing tenant or user context");
      }

      // Fetch previous execution
      const previousExecution = await tenantDb.workflowExecution.findUnique({
        where: { id: executionId },
      });

      if (!previousExecution) {
        throw new NotFoundError(`Execution ${executionId} not found`);
      }

      if (previousExecution.status === "completed") {
        throw new ConflictError(
          "Cannot retry a completed workflow execution"
        );
      }

      // Build workflow context
      const workflowContext = {
        tenantDb,
        prisma,
        userId,
        tenantId,
        logger: fastify.log,
        metadata: {
          requestId: request.id,
          userAgent: request.headers["user-agent"],
          retryOf: executionId,
        },
        transactionId: request.id,
      };

      // Execute workflow again with same input
      const engine = new WorkflowEngine();
      let execution;

      try {
        execution = await engine.executeWorkflow(
          "createDeliveryOrder",
          previousExecution.input,
          workflowContext
        );
      } catch (error) {
        fastify.log.error("Workflow retry failed", error);
        throw new InternalServerError(
          `Order creation workflow retry failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Store new execution record
      await tenantDb.workflowExecution.create({
        data: {
          id: execution.id,
          workflowName: execution.workflowName,
          status: execution.status,
          input: execution.input,
          output: execution.output,
          error: execution.error?.message,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          metadata: {
            userId,
            orderId,
            retryOf: executionId,
          },
        },
      });

      if (execution.status === "failed") {
        reply.status(500);
        return {
          data: null,
          error: {
            code: "WORKFLOW_FAILED",
            message: "Retry workflow execution failed",
            executionId: execution.id,
            previousExecutionId: executionId,
            details: execution.error?.message,
          },
        };
      }

      const output = execution.output as CreateDeliveryOrderOutput;

      reply.status(200);
      return {
        data: {
          orderId: output.orderId,
          trackingToken: output.trackingToken,
          status: output.status,
          shippingRate: output.shippingRate,
          assignedZone: output.assignedZone,
          confirmationSent: output.confirmationSent,
          executionId: execution.id,
          previousExecutionId: executionId,
          totalDurationMs: output.totalDurationMs,
        },
      };
    }
  );
}

export default workflowOrderRoutes;
