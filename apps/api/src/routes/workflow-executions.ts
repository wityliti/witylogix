// @ts-nocheck
/**
 * Workflow Executions Routes — Admin routes for monitoring and managing workflow executions.
 *
 * Provides visibility into all workflow executions across orders, drivers, and deliveries.
 * Includes pagination, filtering, cancellation, and retry capabilities.
 *
 * Routes:
 *   GET    /api/workflow/executions               List all workflow executions (paginated)
 *   GET    /api/workflow/executions/:id           Get execution details
 *   POST   /api/workflow/executions/:id/cancel    Cancel running workflow
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const listExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  workflowName: z.string().optional(),
  status: z
    .enum(["running", "completed", "failed", "compensating", "compensated"])
    .optional(),
  orderId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z
    .enum(["createdAt", "completedAt", "duration", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const cancelExecutionSchema = z.object({
  reason: z.string().optional(),
});

// ─── Route Plugin ────────────────────────────────────────────

async function workflowExecutionsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /api/workflow/executions (List executions) ──

  fastify.get<{
    Querystring: z.infer<typeof listExecutionsQuerySchema>;
  }>(
    "/",
    async (
      request: FastifyRequest<{
        Querystring: z.infer<typeof listExecutionsQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const query = listExecutionsQuerySchema.parse(request.query);
      const {
        page,
        limit,
        workflowName,
        status,
        orderId,
        driverId,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      } = query;

      const tenantDb = (request as any).tenantDb;

      // Build filter conditions
      const whereConditions: any = {};

      if (workflowName) {
        whereConditions.workflowName = { contains: workflowName };
      }

      if (status) {
        whereConditions.status = status;
      }

      if (orderId) {
        whereConditions.metadata = {
          path: ["orderId"],
          equals: orderId,
        };
      }

      if (driverId) {
        whereConditions.metadata = {
          path: ["driverId"],
          equals: driverId,
        };
      }

      if (dateFrom || dateTo) {
        whereConditions.startedAt = {};
        if (dateFrom) {
          whereConditions.startedAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
          whereConditions.startedAt.lte = new Date(dateTo);
        }
      }

      // Determine sort field
      const sortField =
        sortBy === "duration"
          ? "durationMs"
          : sortBy === "completedAt"
            ? "completedAt"
            : "startedAt";

      // Fetch paginated results
      const [executions, total] = await Promise.all([
        tenantDb.workflowExecution.findMany({
          where: whereConditions,
          orderBy: { [sortField]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            workflowName: true,
            status: true,
            startedAt: true,
            completedAt: true,
            durationMs: true,
            error: true,
            metadata: true,
          },
        }),
        tenantDb.workflowExecution.count({ where: whereConditions }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          executions: executions.map((exec) => ({
            executionId: exec.id,
            workflowName: exec.workflowName,
            status: exec.status,
            startedAt: exec.startedAt,
            completedAt: exec.completedAt,
            durationMs: exec.durationMs,
            error: exec.error,
            orderId: (exec.metadata as any)?.orderId,
            driverId: (exec.metadata as any)?.driverId,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
          },
        },
      };
    }
  );

  // ── GET /api/workflow/executions/:id (Get execution details) ──

  fastify.get<{
    Params: { id: string };
  }>(
    "/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const tenantDb = (request as any).tenantDb;

      const execution = await tenantDb.workflowExecution.findUnique({
        where: { id },
        select: {
          id: true,
          workflowName: true,
          status: true,
          input: true,
          output: true,
          error: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          metadata: true,
          createdAt: true,
        },
      });

      if (!execution) {
        throw new NotFoundError(`Workflow execution ${id} not found`);
      }

      // Parse step details if available
      let stepExecutions = [];
      if (execution.output && typeof execution.output === "object") {
        const outputObj = execution.output as any;
        if (outputObj.steps && Array.isArray(outputObj.steps)) {
          stepExecutions = outputObj.steps;
        }
      }

      return {
        data: {
          executionId: execution.id,
          workflowName: execution.workflowName,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          input: execution.input,
          output: execution.output,
          error: execution.error,
          steps: stepExecutions,
          metadata: execution.metadata,
          createdAt: execution.createdAt,
        },
      };
    }
  );

  // ── POST /api/workflow/executions/:id/cancel (Cancel execution) ──

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof cancelExecutionSchema>;
  }>(
    "/:id/cancel",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof cancelExecutionSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { reason } = cancelExecutionSchema.parse(request.body);

      const tenantDb = (request as any).tenantDb;
      const userId = (request as any).auth?.userId;

      // Fetch execution
      const execution = await tenantDb.workflowExecution.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          workflowName: true,
          metadata: true,
        },
      });

      if (!execution) {
        throw new NotFoundError(`Workflow execution ${id} not found`);
      }

      // Only allow canceling running workflows
      if (!["running", "compensating"].includes(execution.status)) {
        throw new ConflictError(
          `Cannot cancel execution with status: ${execution.status}`
        );
      }

      // Update execution status to compensated (simulating cancellation)
      // In a real implementation, this would signal the engine to stop
      const updatedExecution = await tenantDb.workflowExecution.update({
        where: { id },
        data: {
          status: "compensated",
          error: `Cancelled by ${userId}: ${reason || "No reason provided"}`,
          completedAt: new Date(),
          metadata: {
            ...(execution.metadata || {}),
            cancelledBy: userId,
            cancelReason: reason,
            cancelledAt: new Date().toISOString(),
          },
        },
      });

      reply.status(200);
      return {
        data: {
          executionId: updatedExecution.id,
          status: updatedExecution.status,
          message: `Workflow execution ${id} has been cancelled`,
          cancelledBy: userId,
          cancelReason: reason,
        },
      };
    }
  );

  // ── GET /api/workflow/executions/:id/stream (SSE stream fallback) ──
  /**
   * Server-Sent Events (SSE) stream for workflow progress updates.
   *
   * Provides real-time workflow progress when WebSocket is blocked.
   * Falls back to polling if SSE not supported.
   *
   * Usage (client):
   *   const eventSource = new EventSource('/api/workflow/executions/:id/stream');
   *   eventSource.addEventListener('workflow:step:completed', (e) => {
   *     const payload = JSON.parse(e.data);
   *     // Update UI with step completion
   *   });
   *
   * Emits events every 30s (heartbeat) even if no progress, to detect disconnections.
   */

  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/stream",
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const tenantDb = (request as any).tenantDb;
      const logger = fastify.log;

      // Validate execution exists and user has access
      const execution = await tenantDb.workflowExecution.findUnique({
        where: { id },
        select: { id: true, status: true, workflowName: true },
      });

      if (!execution) {
        throw new NotFoundError(`Workflow execution ${id} not found`);
      }

      // Set SSE headers
      reply.header("Content-Type", "text/event-stream");
      reply.header("Cache-Control", "no-cache");
      reply.header("Connection", "keep-alive");
      reply.header("X-Accel-Buffering", "no"); // Disable buffering in proxies

      // Track sent events to avoid duplicates
      let lastEventId = 0;
      let isClosed = false;

      // Cleanup on connection close
      request.socket.once("close", () => {
        isClosed = true;
        logger.debug("SSE client disconnected", {
          executionId: id,
        });
      });

      // Helper to send SSE event
      const sendEvent = (eventType: string, data: any) => {
        if (isClosed) return;

        const eventId = ++lastEventId;
        const eventData = JSON.stringify(data);
        const eventString = `id: ${eventId}\nevent: ${eventType}\ndata: ${eventData}\n\n`;

        try {
          reply.raw.write(eventString);
        } catch (err) {
          isClosed = true;
          logger.error("Error writing to SSE stream", {
            executionId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };

      // Send initial message
      sendEvent("connection:established", {
        executionId: id,
        timestamp: new Date().toISOString(),
        message: `Connected to workflow execution stream`,
      });

      // Heartbeat interval to keep connection alive
      // (SSE clients need data every 30s to detect disconnections)
      const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          sendEvent("heartbeat", {
            timestamp: new Date().toISOString(),
          });
        }
      }, 30000);

      // Poll for execution status changes every 2 seconds
      // In a production system, this would be replaced with proper event streaming
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const updated = await tenantDb.workflowExecution.findUnique({
            where: { id },
            select: {
              status: true,
              completedAt: true,
              durationMs: true,
              error: true,
              metadata: true,
            },
          });

          if (!updated) return;

          // Detect status changes and emit events
          if (updated.status === "completed" && execution.status !== "completed") {
            sendEvent("workflow:completed", {
              executionId: id,
              status: updated.status,
              completedAt: updated.completedAt,
              durationMs: updated.durationMs,
              timestamp: new Date().toISOString(),
            });
          } else if (
            updated.status === "failed" &&
            !["failed", "compensated"].includes(execution.status)
          ) {
            sendEvent("workflow:failed", {
              executionId: id,
              status: updated.status,
              error: updated.error,
              completedAt: updated.completedAt,
              durationMs: updated.durationMs,
              timestamp: new Date().toISOString(),
            });
          }

          // Update tracked execution state
          (execution as any).status = updated.status;
        } catch (err) {
          logger.error("Error polling execution status", {
            executionId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, 2000);

      // Cleanup on client disconnect
      request.socket.once("close", () => {
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
        logger.debug("SSE stream cleaned up", {
          executionId: id,
        });
      });

      // Return without closing the response
      // This keeps the connection open for SSE
      return;
    }
  );
}

export default workflowExecutionsRoutes;
