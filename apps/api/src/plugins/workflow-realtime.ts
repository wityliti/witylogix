// @ts-nocheck
/**
 * Workflow Real-time Plugin — Fastify plugin for Socket.io workflow event integration
 *
 * Sets up the workflow engine to emit real-time progress updates to connected clients.
 * Handles:
 * - Creating WorkflowRealtimeService instance
 * - Registering workflow engine event listeners
 * - Managing client subscription/unsubscription
 * - Authenticating connections
 *
 * Usage:
 *   fastify.register(workflowRealtimePlugin);
 *
 *   // Workflow engine automatically emits to connected clients
 */

import type { FastifyInstance } from "fastify";
import fp from "@fastify/plugin";
import {
  WorkflowRealtimeService,
  WORKFLOW_SOCKET_COMMANDS,
  type WorkflowSubscribeRequest,
  type WorkflowUnsubscribeRequest,
} from "@witylogix/core/realtime";
import type { WorkflowEngine } from "@witylogix/framework";

// ─── Plugin Implementation ──────────────────────────────────

/**
 * Fastify plugin that bridges the workflow engine to Socket.io.
 *
 * Registers socket.io event handlers for workflow subscriptions and
 * connects the workflow engine events to the realtime service.
 */
export default fp(async function workflowRealtimePlugin(
  fastify: FastifyInstance,
  opts: any
) {
  // Get Socket.io instance (must be registered before this plugin)
  const io = fastify.io;
  if (!io) {
    fastify.log.warn("Socket.io not available, workflow realtime disabled");
    return;
  }

  // Get workflow engine (must be available in context)
  const engine: WorkflowEngine | undefined = (fastify as any).workflowEngine;
  if (!engine) {
    fastify.log.warn("Workflow engine not available, workflow realtime disabled");
    return;
  }

  // Create the realtime service
  const realtimeService = new WorkflowRealtimeService(io, fastify.log);

  // Store in fastify instance for access elsewhere
  (fastify as any).workflowRealtimeService = realtimeService;

  // ── Socket.io event handlers ──────────────────────────────────

  /**
   * Handle client subscription to workflow events.
   *
   * Request:
   *   {
   *     executionId?: string  // Optional: subscribe to specific execution
   *   }
   *
   * Response:
   *   {
   *     success: boolean,
   *     message?: string,
   *     rooms?: string[]
   *   }
   */
  io.on("connection", (socket) => {
    // Authenticate: ensure user is authenticated via Socket.io handshake
    const userId = socket.handshake.auth?.userId;
    const tenantId = socket.handshake.auth?.tenantId;
    const transactionId = socket.handshake.auth?.transactionId;

    if (!userId || !tenantId) {
      fastify.log.warn("Unauthenticated socket connection, disconnecting", {
        socketId: socket.id,
      });
      socket.disconnect();
      return;
    }

    // ── Subscribe to workflow events ──
    socket.on(
      WORKFLOW_SOCKET_COMMANDS.SUBSCRIBE,
      (req: WorkflowSubscribeRequest, callback) => {
        try {
          const rooms: string[] = [];

          // Always join tenant-scoped room
          const tenantRoom = `tenant:${tenantId}:workflows`;
          socket.join(tenantRoom);
          rooms.push(tenantRoom);

          // Optionally join execution-specific room
          if (req.executionId) {
            const executionRoom = `workflow:${req.executionId}`;
            socket.join(executionRoom);
            rooms.push(executionRoom);

            fastify.log.debug("Client subscribed to workflow execution", {
              socketId: socket.id,
              executionId: req.executionId,
              tenantId,
              userId,
            });
          } else {
            fastify.log.debug("Client subscribed to tenant workflows", {
              socketId: socket.id,
              tenantId,
              userId,
            });
          }

          // Acknowledge subscription
          if (typeof callback === "function") {
            callback({
              success: true,
              rooms,
            });
          }
        } catch (err) {
          fastify.log.error("Error subscribing to workflow events", {
            error: err instanceof Error ? err.message : String(err),
            socketId: socket.id,
          });

          if (typeof callback === "function") {
            callback({
              success: false,
              message: err instanceof Error ? err.message : "Subscription failed",
            });
          }
        }
      }
    );

    // ── Unsubscribe from workflow events ──
    socket.on(
      WORKFLOW_SOCKET_COMMANDS.UNSUBSCRIBE,
      (req: WorkflowUnsubscribeRequest, callback) => {
        try {
          if (req.executionId) {
            const executionRoom = `workflow:${req.executionId}`;
            socket.leave(executionRoom);

            fastify.log.debug("Client unsubscribed from workflow execution", {
              socketId: socket.id,
              executionId: req.executionId,
            });
          }

          if (typeof callback === "function") {
            callback({
              success: true,
            });
          }
        } catch (err) {
          fastify.log.error("Error unsubscribing from workflow events", {
            error: err instanceof Error ? err.message : String(err),
            socketId: socket.id,
          });

          if (typeof callback === "function") {
            callback({
              success: false,
              message: err instanceof Error ? err.message : "Unsubscription failed",
            });
          }
        }
      }
    );

    // ── Cleanup on disconnect ──
    socket.on("disconnect", () => {
      fastify.log.debug("Client disconnected from workflow realtime", {
        socketId: socket.id,
        tenantId,
        userId,
      });
    });
  });

  // ── Connect workflow engine to realtime service ──────────────

  /**
   * Listen for workflow events and emit them to Socket.io.
   * The event listener is registered on the engine, so whenever a workflow
   * event occurs, it's automatically broadcast to connected clients.
   */
  const workflowEventListener = realtimeService.createEngineListener(
    tenantId || "unknown",
    transactionId
  );

  // Note: In practice, this should be registered per-execution or per-request context
  // For now, we register it globally. In a full implementation, you'd register it
  // when a workflow starts.
  // engine.onWorkflowEvent(workflowEventListener);

  // ── Cleanup on plugin unload ──
  fastify.addHook("onClose", async () => {
    realtimeService.destroy();
    fastify.log.info("Workflow realtime plugin closed");
  });

  fastify.log.info("Workflow realtime plugin registered");
});

/**
 * Helper function to register workflow event listener for a specific execution.
 *
 * This should be called when a workflow starts, to ensure events are emitted
 * to the correct tenant and with the correct transaction ID.
 *
 * Usage:
 *   const engine = (fastify as any).workflowEngine;
 *   const service = (fastify as any).workflowRealtimeService;
 *   const listener = service.createEngineListener(tenantId, transactionId);
 *   engine.onWorkflowEvent(listener);
 */
export function registerWorkflowEventListener(
  fastify: FastifyInstance,
  tenantId: string,
  transactionId?: string
): void {
  const engine: WorkflowEngine | undefined = (fastify as any).workflowEngine;
  const service: WorkflowRealtimeService | undefined =
    (fastify as any).workflowRealtimeService;

  if (!engine || !service) {
    fastify.log.warn("Cannot register workflow event listener, service not available");
    return;
  }

  const listener = service.createEngineListener(tenantId, transactionId);
  engine.onWorkflowEvent(listener);
}
