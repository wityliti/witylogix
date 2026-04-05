// @ts-nocheck
/**
 * Workflow Delivery Routes — Delivery completion via workflow engine.
 *
 * Wraps delivery completion in the completeDeliveryWorkflow, enabling:
 * - Proof of delivery (POD) validation
 * - Photo and signature capture
 * - Delivery metrics calculation
 * - Customer notification
 * - Execution tracking and retry capability
 *
 * Routes:
 *   POST   /api/workflow/delivery/complete    Complete delivery via workflow
 *   GET    /api/workflow/delivery/:orderId/execution Get completion execution
 *   POST   /api/workflow/delivery/:orderId/retry Retry failed completion
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { WorkflowEngine } from "@witylogix/framework";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const completeDeliverySchema = z.object({
  orderId: z.string().uuid(),
  deliveryCode: z.string().min(3).max(10),
  podPhotoUrl: z.string().url().optional(),
  signatureBase64: z.string().optional(),
  notes: z.string().optional(),
  temperatureAtDelivery: z.number().optional(),
  photoTimestamp: z.string().datetime().optional(),
  signatureTimestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getExecutionQuerySchema = z.object({
  executionId: z.string().uuid().optional(),
});

const retrySchema = z.object({
  executionId: z.string().uuid(),
});

// ─── Types ──────────────────────────────────────────────────

interface CompleteDeliveryInput {
  orderId: string;
  shopId: string;
  userId: string;
  deliveryCode: string;
  podPhotoUrl?: string;
  signatureBase64?: string;
  notes?: string;
  temperatureAtDelivery?: number;
  photoTimestamp?: Date;
  signatureTimestamp?: Date;
  metadata?: Record<string, unknown>;
}

interface CompleteDeliveryOutput {
  orderId: string;
  status: string;
  completedAt: Date;
  deliveryDurationMinutes: number;
  distance: number;
  feedback?: string;
  rating?: number;
  metrics: {
    actualDeliveryTime: number;
    estimatedDeliveryTime: number;
    onTimeStatus: string;
    customerSatisfaction?: string;
  };
}

// ─── Route Plugin ────────────────────────────────────────────

async function workflowDeliveryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST /api/workflow/delivery/complete (Complete delivery) ──

  fastify.post<{
    Body: z.infer<typeof completeDeliverySchema>;
  }>(
    "/complete",
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof completeDeliverySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const body = completeDeliverySchema.parse(request.body);

      const tenantId = (request as any).tenantId;
      const userId = (request as any).auth?.userId;
      const tenantDb = (request as any).tenantDb;

      if (!tenantId || !userId) {
        throw new ValidationError("Missing tenant or user context");
      }

      // Verify order exists and is in correct state
      const order = await tenantDb.order.findUnique({
        where: { id: body.orderId },
        select: {
          id: true,
          status: true,
          deliveryStartedAt: true,
          estimatedDeliveryDate: true,
          requireOTPConfirmation: true,
        },
      });

      if (!order) {
        throw new NotFoundError(`Order ${body.orderId} not found`);
      }

      if (!["IN_TRANSIT", "OUT_FOR_DELIVERY", "DRIVER_ARRIVING"].includes(order.status)) {
        throw new ConflictError(
          `Cannot complete delivery for order with status: ${order.status}`
        );
      }

      if (!order.deliveryStartedAt) {
        throw new ConflictError("Delivery has not been started");
      }

      // OTP gate — block completion if the order requires OTP confirmation (WIT-92)
      if (order.requireOTPConfirmation) {
        const otp = await tenantDb.deliveryOTP.findFirst({
          where: { orderId: body.orderId },
          orderBy: { createdAt: "desc" },
          select: { verified: true },
        });

        if (!otp || !otp.verified) {
          reply.status(403);
          return {
            data: null,
            error: {
              code: "OTP_REQUIRED",
              message:
                "OTP confirmation is required before completing this delivery. Use POST /otp/verify.",
            },
          };
        }
      }

      // Validate POD data
      if (!body.podPhotoUrl && !body.signatureBase64) {
        throw new ValidationError(
          "At least one of podPhotoUrl or signatureBase64 is required"
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
      const workflowInput: CompleteDeliveryInput = {
        orderId: body.orderId,
        shopId: tenantId,
        userId,
        deliveryCode: body.deliveryCode,
        podPhotoUrl: body.podPhotoUrl,
        signatureBase64: body.signatureBase64,
        notes: body.notes,
        temperatureAtDelivery: body.temperatureAtDelivery,
        photoTimestamp: body.photoTimestamp
          ? new Date(body.photoTimestamp)
          : undefined,
        signatureTimestamp: body.signatureTimestamp
          ? new Date(body.signatureTimestamp)
          : undefined,
        metadata: body.metadata,
      };

      // Execute workflow
      const engine = new WorkflowEngine();
      let execution;

      try {
        execution = await engine.executeWorkflow(
          "completeDelivery",
          workflowInput,
          workflowContext
        );
      } catch (error) {
        fastify.log.error("Delivery completion workflow failed", error);
        throw new InternalServerError(
          `Delivery completion workflow failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Store execution record in database
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
            orderId: body.orderId,
            deliveryCode: body.deliveryCode,
          },
        },
      });

      if (execution.status === "failed") {
        reply.status(500);
        return {
          data: null,
          error: {
            code: "DELIVERY_COMPLETION_FAILED",
            message: "Delivery completion workflow failed",
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
            message: "Delivery completion workflow in progress",
          },
        };
      }

      const output = execution.output as CompleteDeliveryOutput;

      reply.status(200);
      return {
        data: {
          orderId: output.orderId,
          status: output.status,
          completedAt: output.completedAt,
          deliveryDurationMinutes: output.deliveryDurationMinutes,
          distance: output.distance,
          feedback: output.feedback,
          rating: output.rating,
          metrics: output.metrics,
          executionId: execution.id,
        },
      };
    }
  );

  // ── GET /api/workflow/delivery/:orderId/execution ──

  fastify.get<{
    Params: { orderId: string };
    Querystring: z.infer<typeof getExecutionQuerySchema>;
  }>(
    "/:orderId/execution",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Querystring: z.infer<typeof getExecutionQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { orderId } = request.params;
      const { executionId } = getExecutionQuerySchema.parse(request.query);

      const tenantDb = (request as any).tenantDb;

      // Find execution by orderId or executionId
      const whereClause = executionId
        ? { id: executionId }
        : {
            AND: [
              { workflowName: "completeDelivery" },
              { metadata: { path: ["orderId"], equals: orderId } },
            ],
          };

      const execution = await tenantDb.workflowExecution.findFirst({
        where: whereClause,
        orderBy: { startedAt: "desc" },
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

  // ── POST /api/workflow/delivery/:orderId/retry ──

  fastify.post<{
    Params: { orderId: string };
    Body: z.infer<typeof retrySchema>;
  }>(
    "/:orderId/retry",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: z.infer<typeof retrySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { orderId } = request.params;
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

      if (!["failed", "compensated"].includes(previousExecution.status)) {
        throw new ConflictError(
          `Cannot retry execution with status: ${previousExecution.status}`
        );
      }

      // Verify order still exists
      const order = await tenantDb.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new NotFoundError(`Order ${orderId} not found`);
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

      // Execute workflow again
      const engine = new WorkflowEngine();
      let execution;

      try {
        execution = await engine.executeWorkflow(
          "completeDelivery",
          previousExecution.input,
          workflowContext
        );
      } catch (error) {
        fastify.log.error("Delivery completion workflow retry failed", error);
        throw new InternalServerError(
          `Delivery completion retry failed: ${error instanceof Error ? error.message : String(error)}`
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
            code: "DELIVERY_COMPLETION_FAILED",
            message: "Retry delivery completion workflow failed",
            executionId: execution.id,
            previousExecutionId: executionId,
            details: execution.error?.message,
          },
        };
      }

      const output = execution.output as CompleteDeliveryOutput;

      reply.status(200);
      return {
        data: {
          orderId: output.orderId,
          status: output.status,
          completedAt: output.completedAt,
          deliveryDurationMinutes: output.deliveryDurationMinutes,
          distance: output.distance,
          feedback: output.feedback,
          rating: output.rating,
          metrics: output.metrics,
          executionId: execution.id,
          previousExecutionId: executionId,
        },
      };
    }
  );
}

export default workflowDeliveryRoutes;
