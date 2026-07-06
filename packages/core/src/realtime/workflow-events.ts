// @ts-nocheck
/**
 * Workflow Real-time Service — Socket.io integration for workflow progress updates
 *
 * Bridges the workflow engine lifecycle hooks to Socket.io for real-time dashboard updates.
 * Handles:
 * - Workflow start/complete/fail events
 * - Step start/complete/fail events
 * - Compensation start/complete events
 * - Rate limiting to prevent event flooding
 * - Tenant-scoped room emission
 * - Graceful fallback if Socket.io is unavailable
 *
 * Usage:
 *   const service = new WorkflowRealtimeService(io, logger);
 *
 *   engine.onWorkflowEvent((event) => {
 *     service.handleWorkflowEvent(event, context);
 *   });
 */

import type { Server as SocketIOServer } from "socket.io";
import type { Logger } from "@witylogix/framework";
import type {
  WorkflowEvent,
  WorkflowEventListener,
} from "@witylogix/framework";
import {
  WORKFLOW_EVENTS,
  type WorkflowEventBase,
  type WorkflowStartedPayload,
  type WorkflowCompletedPayload,
  type WorkflowFailedPayload,
  type StepStartedPayload,
  type StepCompletedPayload,
  type StepFailedPayload,
  type CompensationStartedPayload,
  type CompensationCompletedPayload,
} from "./workflow-events.types.js";

// ─── Rate Limiting ──────────────────────────────────────────

/**
 * Rate limiter for workflow events.
 * Prevents event flooding to Socket.io by limiting emissions per execution.
 */
class EventRateLimiter {
  private executionEventCounts: Map<
    string,
    { count: number; resetAt: number }
  > = new Map();
  private readonly maxEventsPerSecond: number = 10;
  private readonly windowMs: number = 1000; // 1 second

  isAllowed(executionId: string): boolean {
    const now = Date.now();
    const entry = this.executionEventCounts.get(executionId);

    if (!entry || now >= entry.resetAt) {
      // Window expired or first time, reset counter
      this.executionEventCounts.set(executionId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    // Within window, check if under limit
    if (entry.count < this.maxEventsPerSecond) {
      entry.count++;
      return true;
    }

    return false;
  }

  reset(executionId: string): void {
    this.executionEventCounts.delete(executionId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [execId, entry] of this.executionEventCounts.entries()) {
      if (now >= entry.resetAt + this.windowMs) {
        this.executionEventCounts.delete(execId);
      }
    }
  }
}

// ─── Workflow Realtime Service ──────────────────────────────

/**
 * Service to emit workflow lifecycle events to Socket.io clients.
 * Subscribes to WorkflowEngine events and broadcasts them to appropriate rooms.
 */
export class WorkflowRealtimeService {
  private io: SocketIOServer;
  private logger: Logger;
  private rateLimiter: EventRateLimiter;
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(io: SocketIOServer, logger: Logger) {
    this.io = io;
    this.logger = logger;
    this.rateLimiter = new EventRateLimiter();

    // Cleanup rate limiter cache every minute
    this.cleanupInterval = setInterval(() => {
      this.rateLimiter.cleanup();
    }, 60000);
  }

  /**
   * Handle a workflow event from the engine and emit to Socket.io.
   *
   * @param event WorkflowEvent from the engine
   * @param tenantId Tenant ID for room scoping
   * @param transactionId Optional transaction ID for tracing
   */
  async handleWorkflowEvent(
    event: WorkflowEvent,
    tenantId: string,
    transactionId?: string,
  ): Promise<void> {
    try {
      // Rate limit to prevent flooding
      if (!this.rateLimiter.isAllowed(event.executionId)) {
        this.logger.debug("Event rate limited", {
          executionId: event.executionId,
          eventType: event.type,
        });
        return;
      }

      const basePayload: WorkflowEventBase = {
        executionId: event.executionId,
        workflowName: event.workflowName,
        timestamp: new Date().toISOString(),
        transactionId,
        tenantId,
      };

      // Route to appropriate handler
      switch (event.type) {
        case "workflow:started":
          await this.emitWorkflowStarted(basePayload, event);
          break;

        case "workflow:completed":
          await this.emitWorkflowCompleted(basePayload, event);
          this.rateLimiter.reset(event.executionId);
          break;

        case "workflow:failed":
          await this.emitWorkflowFailed(basePayload, event);
          this.rateLimiter.reset(event.executionId);
          break;

        case "step:started":
          await this.emitStepStarted(basePayload, event);
          break;

        case "step:completed":
          await this.emitStepCompleted(basePayload, event);
          break;

        case "step:failed":
          await this.emitStepFailed(basePayload, event);
          break;

        case "compensation:started":
          await this.emitCompensationStarted(basePayload, event);
          break;

        case "compensation:completed":
          await this.emitCompensationCompleted(basePayload, event);
          break;

        default:
          this.logger.warn("Unknown workflow event type", {
            type: (event as any).type,
          });
      }
    } catch (err) {
      this.logger.error("Error handling workflow event", {
        error: err instanceof Error ? err.message : String(err),
        eventType: event.type,
        executionId: event.executionId,
      });
    }
  }

  /**
   * Emit workflow:started event to Socket.io.
   */
  private async emitWorkflowStarted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: WorkflowStartedPayload = {
      ...base,
      totalSteps: (event.data as any)?.stepCount ?? 0,
      input: (event.data as any)?.input,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.WORKFLOW_STARTED, payload);

    this.logger.debug("Workflow started event emitted", {
      executionId: base.executionId,
      workflowName: base.workflowName,
    });
  }

  /**
   * Emit workflow:completed event to Socket.io.
   */
  private async emitWorkflowCompleted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: WorkflowCompletedPayload = {
      ...base,
      totalSteps: (event.data as any)?.stepCount ?? 0,
      output: (event.data as any)?.output,
      durationMs: (event.data as any)?.durationMs ?? 0,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.WORKFLOW_COMPLETED, payload);

    this.logger.info("Workflow completed event emitted", {
      executionId: base.executionId,
      workflowName: base.workflowName,
      durationMs: payload.durationMs,
    });
  }

  /**
   * Emit workflow:failed event to Socket.io.
   */
  private async emitWorkflowFailed(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: WorkflowFailedPayload = {
      ...base,
      totalSteps: (event.data as any)?.stepCount ?? 0,
      error: event.error?.message ?? "Unknown error",
      stack: event.error?.stack,
      durationMs: (event.data as any)?.durationMs ?? 0,
      compensatedSteps: (event.data as any)?.compensatedSteps,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.WORKFLOW_FAILED, payload);

    this.logger.error("Workflow failed event emitted", {
      executionId: base.executionId,
      workflowName: base.workflowName,
      error: payload.error,
    });
  }

  /**
   * Emit step:started event to Socket.io.
   */
  private async emitStepStarted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: StepStartedPayload = {
      ...base,
      stepId: (event as any).stepId ?? "",
      stepName: event.stepName ?? (event as any).stepId,
      stepIndex: (event.data as any)?.stepIndex ?? 0,
      totalSteps: (event.data as any)?.totalSteps ?? 0,
      input: (event.data as any)?.input,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.STEP_STARTED, payload);
  }

  /**
   * Emit step:completed event to Socket.io.
   */
  private async emitStepCompleted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: StepCompletedPayload = {
      ...base,
      stepId: (event as any).stepId ?? "",
      stepName: event.stepName ?? (event as any).stepId,
      stepIndex: (event.data as any)?.stepIndex ?? 0,
      totalSteps: (event.data as any)?.totalSteps ?? 0,
      output: (event.data as any)?.output,
      durationMs: (event.data as any)?.durationMs ?? 0,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.STEP_COMPLETED, payload);

    this.logger.debug("Step completed event emitted", {
      executionId: base.executionId,
      stepName: payload.stepName,
    });
  }

  /**
   * Emit step:failed event to Socket.io.
   */
  private async emitStepFailed(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: StepFailedPayload = {
      ...base,
      stepId: (event as any).stepId ?? "",
      stepName: event.stepName ?? (event as any).stepId,
      stepIndex: (event.data as any)?.stepIndex ?? 0,
      totalSteps: (event.data as any)?.totalSteps ?? 0,
      error: event.error?.message ?? "Step failed",
      stack: event.error?.stack,
      durationMs: (event.data as any)?.durationMs ?? 0,
      retriesRemaining: (event.data as any)?.retriesRemaining,
      willCompensate: (event.data as any)?.willCompensate ?? true,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.STEP_FAILED, payload);

    this.logger.warn("Step failed event emitted", {
      executionId: base.executionId,
      stepName: payload.stepName,
      error: payload.error,
    });
  }

  /**
   * Emit compensation:started event to Socket.io.
   */
  private async emitCompensationStarted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: CompensationStartedPayload = {
      ...base,
      stepsToCompensate: (event.data as any)?.stepsToCompensate ?? 0,
      failedStepName: (event.data as any)?.failedStepName ?? "Unknown",
      error: event.error?.message ?? "Workflow step failed",
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.COMPENSATION_STARTED, payload);

    this.logger.info("Compensation started event emitted", {
      executionId: base.executionId,
      stepsToCompensate: payload.stepsToCompensate,
    });
  }

  /**
   * Emit compensation:completed event to Socket.io.
   */
  private async emitCompensationCompleted(
    base: WorkflowEventBase,
    event: WorkflowEvent,
  ): Promise<void> {
    const payload: CompensationCompletedPayload = {
      ...base,
      compensatedCount: (event.data as any)?.compensated?.length ?? 0,
      failedCount: (event.data as any)?.failed?.length ?? 0,
      durationMs: (event.data as any)?.durationMs ?? 0,
      success: ((event.data as any)?.failed?.length ?? 0) === 0,
      failedSteps: (event.data as any)?.failed,
    };

    this.emitToRooms(base, WORKFLOW_EVENTS.COMPENSATION_COMPLETED, payload);

    this.logger.info("Compensation completed event emitted", {
      executionId: base.executionId,
      compensatedCount: payload.compensatedCount,
      failedCount: payload.failedCount,
      success: payload.success,
    });
  }

  /**
   * Emit to both tenant-scoped and execution-specific rooms.
   *
   * Room patterns:
   * - Tenant room: `tenant:${tenantId}:workflows`
   * - Execution room: `workflow:${executionId}`
   */
  private emitToRooms(
    base: WorkflowEventBase,
    eventName: string,
    payload: any,
  ): void {
    // Non-blocking emit: don't wait for delivery
    setImmediate(() => {
      try {
        // Emit to tenant-scoped room
        if (base.tenantId) {
          const tenantRoom = `tenant:${base.tenantId}:workflows`;
          this.io.to(tenantRoom).emit(eventName, payload);
        }

        // Emit to execution-specific room
        const executionRoom = `workflow:${base.executionId}`;
        this.io.to(executionRoom).emit(eventName, payload);
      } catch (err) {
        this.logger.error("Failed to emit workflow event to rooms", {
          error: err instanceof Error ? err.message : String(err),
          eventName,
          executionId: base.executionId,
        });
      }
    });
  }

  /**
   * Create a workflow event listener for subscribing to engine events.
   * Returns a function that can be passed to engine.onWorkflowEvent().
   *
   * @param tenantId Tenant ID for room scoping
   * @param transactionId Optional transaction ID for tracing
   */
  createEngineListener(
    tenantId: string,
    transactionId?: string,
  ): WorkflowEventListener {
    return (event: WorkflowEvent) => {
      // Fire and forget
      void this.handleWorkflowEvent(event, tenantId, transactionId);
    };
  }

  /**
   * Clean up resources (close cleanup interval, etc.).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ─── Socket.io Event Handlers ────────────────────────────────

/**
 * Socket.io event handlers for client subscription/unsubscription.
 * These are used by the API server plugin to manage client rooms.
 */

export const WORKFLOW_SOCKET_COMMANDS = {
  SUBSCRIBE: "workflow:subscribe",
  UNSUBSCRIBE: "workflow:unsubscribe",
} as const;

/**
 * Request payload for subscribing to workflow events.
 */
export interface WorkflowSubscribeRequest {
  executionId?: string; // Subscribe to specific execution
  // If not provided, client receives all tenant-scoped events
}

/**
 * Request payload for unsubscribing from workflow events.
 */
export interface WorkflowUnsubscribeRequest {
  executionId?: string;
}

/**
 * Response payload for subscription commands.
 */
export interface WorkflowSubscriptionResponse {
  success: boolean;
  message?: string;
  rooms?: string[];
}
