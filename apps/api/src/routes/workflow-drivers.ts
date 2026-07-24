// @ts-nocheck
/**
 * Workflow Drivers Routes — Driver assignment via workflow engine.
 *
 * Wraps driver assignment in the assignDriverWorkflow, enabling:
 * - Driver candidate evaluation and scoring
 * - Route optimization
 * - Automatic assignment with customer notification
 * - Execution tracking and retry capability
 *
 * Routes:
 *   POST   /api/workflow/drivers/assign            Assign driver via workflow
 *   GET    /api/workflow/drivers/assign/:orderId/execution Get assignment execution
 *   POST   /api/workflow/drivers/assign/:orderId/retry Retry failed assignment
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { WorkflowEngine } from "@witylogix/framework";
import type {
  AssignDriverInput,
  AssignDriverOutput,
  GeoLocation,
} from "@witylogix/workflows";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const assignDriverSchema = z.object({
  orderId: z.string().uuid(),
  pickupLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  deliveryLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  vehicleType: z
    .enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"])
    .optional(),
  weight: z.number().positive().optional(),
  value: z.number().positive().optional(),
  specialRequirements: z.array(z.string()).optional(),
  strictDeadline: z.boolean().optional().default(false),
  timeoutMs: z.number().positive().optional().default(30000),
  preferredDriverId: z.string().uuid().optional(),
  excludeDriverIds: z.array(z.string().uuid()).optional(),
});

const getExecutionQuerySchema = z.object({
  executionId: z.string().uuid().optional(),
});

const retrySchema = z.object({
  executionId: z.string().uuid(),
});

// ─── Route Plugin ────────────────────────────────────────────

async function workflowDriverRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST /api/workflow/drivers/assign (Assign driver via workflow) ──

  fastify.post<{
    Body: z.infer<typeof assignDriverSchema>;
  }>(
    "/assign",
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof assignDriverSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const body = assignDriverSchema.parse(request.body);

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
          deliveryCoordinates: true,
          totalWeight: true,
        },
      });

      if (!order) {
        throw new NotFoundError(`Order ${body.orderId} not found`);
      }

      if (
        !["PENDING", "ASSIGNED_WAIT", "READY_FOR_PICKUP"].includes(order.status)
      ) {
        throw new ConflictError(
          `Cannot assign driver to order with status: ${order.status}`,
        );
      }

      // Check if order already has active assignment
      const existingAssignment = await tenantDb.assignment.findFirst({
        where: {
          orderId: body.orderId,
          status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
        },
      });

      if (existingAssignment) {
        throw new ConflictError(`Order already has active assignment`);
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

      // Build workflow input with delivery coordinates from order if not provided
      const workflowInput: AssignDriverInput = {
        orderId: body.orderId,
        shopId: tenantId,
        pickupLocation: body.pickupLocation as GeoLocation | undefined,
        deliveryLocation:
          body.deliveryLocation || (order.deliveryCoordinates as GeoLocation),
        vehicleType: body.vehicleType,
        weight: body.weight || (order.totalWeight as number),
        value: body.value,
        specialRequirements: body.specialRequirements,
        strictDeadline: body.strictDeadline,
        timeoutMs: body.timeoutMs,
        preferredDriverId: body.preferredDriverId,
        excludeDriverIds: body.excludeDriverIds,
      };

      // Execute workflow
      const engine = new WorkflowEngine();
      let execution;

      try {
        execution = await engine.executeWorkflow(
          "assignDriver",
          workflowInput,
          workflowContext,
        );
      } catch (error) {
        fastify.log.error("Driver assignment workflow failed", error);
        throw new InternalServerError(
          `Driver assignment workflow failed: ${error instanceof Error ? error.message : String(error)}`,
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
            driverId: (execution.output as any)?.driverId,
          },
        },
      });

      if (execution.status === "failed") {
        const output = execution.output as AssignDriverOutput;
        reply.status(500);
        return {
          data: null,
          error: {
            code: output.code || "ASSIGNMENT_FAILED",
            message: output.error || "Driver assignment workflow failed",
            reason: output.reason,
            driversEvaluated: output.driversEvaluated,
            executionId: execution.id,
          },
        };
      }

      if (execution.status !== "completed") {
        reply.status(202); // Accepted
        return {
          data: {
            executionId: execution.id,
            status: execution.status,
            message: "Driver assignment workflow in progress",
          },
        };
      }

      const output = execution.output as AssignDriverOutput;

      if (!output.success || !output.driverId) {
        reply.status(500);
        return {
          data: null,
          error: {
            code: output.code || "ASSIGNMENT_FAILED",
            message: output.error || "No drivers available for assignment",
            reason: output.reason,
            driversEvaluated: output.driversEvaluated,
            executionId: execution.id,
          },
        };
      }

      reply.status(201);
      return {
        data: {
          driverId: output.driverId,
          driverName: output.driverName,
          driverPhone: output.driverPhone,
          vehiclePlate: output.vehiclePlate,
          estimatedArrivalAt: output.estimatedArrivalAt,
          estimatedPickupAt: output.estimatedPickupAt,
          routeOptimization: output.routeOptimization,
          executionId: execution.id,
        },
      };
    },
  );

  // ── GET /api/workflow/drivers/assign/:orderId/execution ──

  fastify.get<{
    Params: { orderId: string };
    Querystring: z.infer<typeof getExecutionQuerySchema>;
  }>(
    "/assign/:orderId/execution",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Querystring: z.infer<typeof getExecutionQuerySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = request.params;
      const { executionId } = getExecutionQuerySchema.parse(request.query);

      const tenantDb = (request as any).tenantDb;

      // Find execution by orderId or executionId
      const whereClause = executionId
        ? { id: executionId }
        : {
            AND: [
              { workflowName: "assignDriver" },
              { metadata: { path: ["orderId"], equals: orderId } },
            ],
          };

      const execution = await tenantDb.workflowExecution.findFirst({
        where: whereClause,
        orderBy: { startedAt: "desc" },
      });

      if (!execution) {
        throw new NotFoundError(
          `Workflow execution not found for order ${orderId}`,
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
    },
  );

  // ── POST /api/workflow/drivers/assign/:orderId/retry ──

  fastify.post<{
    Params: { orderId: string };
    Body: z.infer<typeof retrySchema>;
  }>(
    "/assign/:orderId/retry",
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: z.infer<typeof retrySchema>;
      }>,
      reply: FastifyReply,
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
          `Cannot retry execution with status: ${previousExecution.status}`,
        );
      }

      // Verify order still exists and is assignable
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
          "assignDriver",
          previousExecution.input,
          workflowContext,
        );
      } catch (error) {
        fastify.log.error("Driver assignment workflow retry failed", error);
        throw new InternalServerError(
          `Driver assignment retry failed: ${error instanceof Error ? error.message : String(error)}`,
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
        const output = execution.output as AssignDriverOutput;
        reply.status(500);
        return {
          data: null,
          error: {
            code: output.code || "ASSIGNMENT_FAILED",
            message: output.error || "Retry assignment workflow failed",
            reason: output.reason,
            driversEvaluated: output.driversEvaluated,
            executionId: execution.id,
            previousExecutionId: executionId,
          },
        };
      }

      const output = execution.output as AssignDriverOutput;

      if (!output.success || !output.driverId) {
        reply.status(500);
        return {
          data: null,
          error: {
            code: output.code || "ASSIGNMENT_FAILED",
            message: output.error || "No drivers available for assignment",
            reason: output.reason,
            driversEvaluated: output.driversEvaluated,
            executionId: execution.id,
            previousExecutionId: executionId,
          },
        };
      }

      reply.status(200);
      return {
        data: {
          driverId: output.driverId,
          driverName: output.driverName,
          driverPhone: output.driverPhone,
          vehiclePlate: output.vehiclePlate,
          estimatedArrivalAt: output.estimatedArrivalAt,
          estimatedPickupAt: output.estimatedPickupAt,
          routeOptimization: output.routeOptimization,
          executionId: execution.id,
          previousExecutionId: executionId,
        },
      };
    },
  );
}

export default workflowDriverRoutes;
