// @ts-nocheck

/**
 * Workflow Integration Fastify Plugin
 *
 * Registers the workflow engine with Fastify and sets up automatic workflow triggering
 * hooks on relevant API routes. Provides a `fastify.workflows` decorator for manual
 * workflow triggering and includes a health check endpoint.
 *
 * Usage:
 *   await app.register(workflowIntegrationPlugin);
 */

import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { WorkflowEngine } from "@witylogix/framework";
import {
  getWorkflowIntegrationService,
  setWorkflowIntegrationService,
  setIntegrationConfig,
  onWorkflowEvent,
} from "@witylogix/core/workflow-integration";
import { registerWorkflowHooks } from "@witylogix/core/workflow-integration/hooks.js";
import type {
  WorkflowTriggerResult,
  IntegrationContext,
} from "@witylogix/core/workflow-integration";

/**
 * Fastify plugin for workflow integration.
 */
async function workflowIntegrationPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.log.info("[WorkflowIntegration] Initializing workflow integration plugin");

  // ─── Initialize Workflow Engine ───────────────────────────────────────

  let engine: WorkflowEngine;
  try {
    engine = new WorkflowEngine();
    fastify.log.info("[WorkflowIntegration] Workflow engine initialized");
  } catch (err) {
    fastify.log.error(
      err,
      "[WorkflowIntegration] Failed to initialize workflow engine",
    );
    throw err;
  }

  // ─── Initialize Integration Service ──────────────────────────────────

  const integrationService = getWorkflowIntegrationService();
  fastify.log.info(
    "[WorkflowIntegration] Integration service initialized (singleton)",
  );

  // ─── Register Workflow Event Listeners ────────────────────────────────

  // Log workflow events to application logger
  onWorkflowEvent("workflow.triggered", (event) => {
    fastify.log.info(
      {
        workflowName: event.workflowName,
        executionId: event.executionId,
        operationType: event.operationType,
        tenantId: event.tenantId,
        isNonBlocking: event.isNonBlocking,
      },
      "[WorkflowIntegration] Workflow triggered",
    );
  });

  onWorkflowEvent("workflow.completed", (event) => {
    fastify.log.info(
      {
        workflowName: event.workflowName,
        executionId: event.executionId,
        operationType: event.operationType,
        tenantId: event.tenantId,
        durationMs: event.durationMs,
      },
      "[WorkflowIntegration] Workflow completed",
    );
  });

  onWorkflowEvent("workflow.failed", (event) => {
    fastify.log.error(
      {
        workflowName: event.workflowName,
        executionId: event.executionId,
        operationType: event.operationType,
        tenantId: event.tenantId,
        error: event.error,
        durationMs: event.durationMs,
      },
      "[WorkflowIntegration] Workflow failed",
    );
  });

  // ─── Decorate Fastify with Workflows Accessor ────────────────────────

  fastify.decorate("workflows", {
    /**
     * Trigger a workflow manually.
     * Usage:
     *   const result = await fastify.workflows.trigger("createDeliveryOrder", {
     *     shopId: "...",
     *     userId: "...",
     *     ...
     *   }, context);
     */
    async trigger(
      workflowName: string,
      input: Record<string, unknown>,
      context: IntegrationContext,
    ): Promise<WorkflowTriggerResult | null> {
      switch (workflowName) {
        case "createDeliveryOrder":
          return await integrationService.onOrderCreated(input as any, context);
        case "assignDriver":
          return await integrationService.onDriverAssignment(input as any, context);
        case "completeDelivery":
          return await integrationService.onDeliveryCompleted(input as any, context);
        default:
          fastify.log.warn(
            { workflowName },
            "[WorkflowIntegration] Unknown workflow name",
          );
          return null;
      }
    },

    /**
     * Get or set per-tenant integration configuration.
     */
    config: {
      set(tenantId: string, config: any) {
        setIntegrationConfig(tenantId, config);
        fastify.log.info(
          { tenantId, config },
          "[WorkflowIntegration] Config updated for tenant",
        );
      },
    },

    /**
     * Subscribe to workflow events.
     */
    on: onWorkflowEvent,
  });

  // ─── Register Workflow Hooks on Routes ───────────────────────────────

  registerWorkflowHooks(fastify);
  fastify.log.info("[WorkflowIntegration] Workflow hooks registered");

  // ─── Health Check Endpoint ──────────────────────────────────────────

  fastify.get("/api/workflows/health", async (request, reply) => {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "workflow-integration",
      components: {
        engine: "operational",
        integrationService: "operational",
      },
    };
  });

  fastify.log.info(
    "[WorkflowIntegration] Health check endpoint registered at GET /api/workflows/health",
  );

  // ─── Graceful Shutdown ──────────────────────────────────────────────

  fastify.addHook("onClose", async () => {
    fastify.log.info("[WorkflowIntegration] Shutting down workflow integration");
    // Cleanup can be added here if needed
  });

  fastify.log.info(
    "[WorkflowIntegration] Plugin initialized and ready to handle workflows",
  );
}

export default fp(workflowIntegrationPlugin, {
  name: "workflow-integration",
  dependencies: [],
});
