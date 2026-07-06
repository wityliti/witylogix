/**
 * Trigger Registry — Register and match workflow triggers based on events and conditions
 *
 * Provides a priority-ordered, debounced trigger system for automatically firing workflows
 * from API operations. Supports custom predicates and complex event matching.
 */

import { randomUUID } from "crypto";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Event types that can trigger workflows
 */
export type TriggerEventType =
  | "order.created"
  | "order.updated"
  | "shipment.created"
  | "shipment.status_changed"
  | "driver.assigned"
  | "delivery.completed";

/**
 * Context available to trigger conditions and handlers
 */
export interface TriggerContext {
  eventType: TriggerEventType;
  entityId: string;
  entity: Record<string, any>;
  metadata?: Record<string, any>;
  userId?: string;
  shopId?: string;
  orgId?: string;
  timestamp: Date;
}

/**
 * Predicate function for trigger conditions
 */
export type TriggerCondition = (
  context: TriggerContext,
) => boolean | Promise<boolean>;

/**
 * Workflow trigger definition
 */
export interface WorkflowTrigger {
  id: string;
  eventType: TriggerEventType;
  workflowName: string;
  conditions: TriggerCondition[];
  priority: number; // Higher = runs first
  debounceMs?: number;
  throttleMs?: number;
  enabled: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Matched trigger with context
 */
export interface MatchedTrigger {
  trigger: WorkflowTrigger;
  context: TriggerContext;
  execute: (options?: TriggerExecutionOptions) => Promise<void>;
}

/**
 * Options for trigger execution
 */
export interface TriggerExecutionOptions {
  timeout?: number;
  onSuccess?: (result: any) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Debounce state for a trigger
 */
interface DebounceState {
  lastFired: number;
  timeout: NodeJS.Timeout | null;
}

// ───────────────────────────────────────────────────────────────────────────
// TRIGGER REGISTRY CLASS
// ───────────────────────────────────────────────────────────────────────────

/**
 * TriggerRegistry — Central registry for workflow triggers
 *
 * Manages:
 * - Registering/unregistering triggers
 * - Matching triggers to events based on conditions
 * - Priority ordering
 * - Debounce/throttle support
 */
export class TriggerRegistry {
  private triggers: Map<string, WorkflowTrigger> = new Map();
  private debounceStates: Map<string, DebounceState> = new Map();
  private executionHandlers: Map<string, Function> = new Map();

  /**
   * Register a new workflow trigger
   */
  register(options: {
    eventType: TriggerEventType;
    workflowName: string;
    conditions?: TriggerCondition[];
    priority?: number;
    debounceMs?: number;
    throttleMs?: number;
    metadata?: Record<string, any>;
    onExecute?: (context: TriggerContext) => Promise<void>;
  }): string {
    const triggerId = randomUUID();

    const trigger: WorkflowTrigger = {
      id: triggerId,
      eventType: options.eventType,
      workflowName: options.workflowName,
      conditions: options.conditions || [],
      priority: options.priority ?? 0,
      debounceMs: options.debounceMs,
      throttleMs: options.throttleMs,
      enabled: true,
      createdAt: new Date(),
      metadata: options.metadata,
    };

    this.triggers.set(triggerId, trigger);

    if (options.onExecute) {
      this.executionHandlers.set(triggerId, options.onExecute);
    }

    return triggerId;
  }

  /**
   * Unregister a trigger by ID
   */
  unregister(triggerId: string): boolean {
    const deleted = this.triggers.delete(triggerId);
    this.executionHandlers.delete(triggerId);
    this.debounceStates.delete(triggerId);
    return deleted;
  }

  /**
   * Get a trigger by ID
   */
  getTrigger(triggerId: string): WorkflowTrigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers for an event type
   */
  getTriggersByEvent(eventType: TriggerEventType): WorkflowTrigger[] {
    return Array.from(this.triggers.values())
      .filter((t) => t.eventType === eventType && t.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match triggers to a context
   * Returns matching triggers sorted by priority
   */
  async match(
    eventType: TriggerEventType,
    context: Partial<TriggerContext>,
  ): Promise<MatchedTrigger[]> {
    const triggers = this.getTriggersByEvent(eventType);
    const matched: MatchedTrigger[] = [];

    const fullContext: TriggerContext = {
      eventType,
      entityId: context.entityId || randomUUID(),
      entity: context.entity || {},
      metadata: context.metadata,
      userId: context.userId,
      shopId: context.shopId,
      orgId: context.orgId,
      timestamp: new Date(),
    };

    for (const trigger of triggers) {
      // Check all conditions
      let allConditionsMet = true;
      for (const condition of trigger.conditions) {
        try {
          const result = await condition(fullContext);
          if (!result) {
            allConditionsMet = false;
            break;
          }
        } catch (error) {
          console.error(
            `Error evaluating condition for trigger ${trigger.id}:`,
            error,
          );
          allConditionsMet = false;
          break;
        }
      }

      if (allConditionsMet) {
        matched.push({
          trigger,
          context: fullContext,
          execute: (options?: TriggerExecutionOptions) =>
            this.executeTrigger(trigger, fullContext, options),
        });
      }
    }

    return matched;
  }

  /**
   * Execute a trigger with debounce/throttle support
   */
  private async executeTrigger(
    trigger: WorkflowTrigger,
    context: TriggerContext,
    options?: TriggerExecutionOptions,
  ): Promise<void> {
    // Check debounce/throttle
    const debounceKey = `${trigger.id}:${context.entityId}`;
    const debounceState = this.debounceStates.get(debounceKey);
    const now = Date.now();

    // Throttle check
    if (trigger.throttleMs && debounceState) {
      if (now - debounceState.lastFired < trigger.throttleMs) {
        console.debug(
          `Trigger ${trigger.id} throttled for ${context.entityId}`,
        );
        return;
      }
    }

    // Clear existing debounce timeout
    if (debounceState?.timeout) {
      clearTimeout(debounceState.timeout);
    }

    // Setup debounce
    if (trigger.debounceMs) {
      const state: DebounceState = { lastFired: now, timeout: null };

      state.timeout = setTimeout(async () => {
        await this.executeHandler(trigger, context, options);
        state.lastFired = Date.now();
      }, trigger.debounceMs);

      this.debounceStates.set(debounceKey, state);
    } else {
      // Execute immediately
      await this.executeHandler(trigger, context, options);

      if (!debounceState) {
        this.debounceStates.set(debounceKey, { lastFired: now, timeout: null });
      } else {
        debounceState.lastFired = now;
      }
    }
  }

  /**
   * Execute the handler for a trigger
   */
  private async executeHandler(
    trigger: WorkflowTrigger,
    context: TriggerContext,
    options?: TriggerExecutionOptions,
  ): Promise<void> {
    const timeout = options?.timeout || 30000;

    try {
      const handler = this.executionHandlers.get(trigger.id);

      if (handler) {
        const promise = handler(context);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Trigger execution timeout")),
            timeout,
          ),
        );

        await Promise.race([promise, timeoutPromise]);
      }

      if (options?.onSuccess) {
        await options.onSuccess(undefined);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (options?.onError) {
        await options.onError(err);
      } else {
        console.error(`Error executing trigger ${trigger.id}:`, err);
      }
    }
  }

  /**
   * Enable/disable a trigger
   */
  setEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    trigger.enabled = enabled;
    return true;
  }

  /**
   * Clear all debounce states (useful for testing)
   */
  clearDebounceStates(): void {
    for (const state of this.debounceStates.values()) {
      if (state.timeout) {
        clearTimeout(state.timeout);
      }
    }
    this.debounceStates.clear();
  }

  /**
   * Get all registered triggers
   */
  getAll(): WorkflowTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Get trigger statistics
   */
  getStats(): {
    totalTriggers: number;
    enabledTriggers: number;
    triggersByEvent: Record<TriggerEventType, number>;
  } {
    const all = this.getAll();
    const enabled = all.filter((t) => t.enabled);
    const byEvent: Record<TriggerEventType, number> = {} as any;

    for (const trigger of all) {
      byEvent[trigger.eventType] = (byEvent[trigger.eventType] || 0) + 1;
    }

    return {
      totalTriggers: all.length,
      enabledTriggers: enabled.length,
      triggersByEvent: byEvent,
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CONTEXT HELPERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create a trigger context from a request/response pair
 */
export function createTriggerContext(options: {
  eventType: TriggerEventType;
  entity: Record<string, any>;
  entityId: string;
  userId?: string;
  shopId?: string;
  orgId?: string;
  metadata?: Record<string, any>;
}): TriggerContext {
  return {
    eventType: options.eventType,
    entity: options.entity,
    entityId: options.entityId,
    userId: options.userId,
    shopId: options.shopId,
    orgId: options.orgId,
    metadata: options.metadata,
    timestamp: new Date(),
  };
}
