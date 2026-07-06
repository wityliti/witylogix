/**
 * @witylogix/framework/workflow/registry — Workflow definition registry
 *
 * Central registry for managing WorkflowDefinitions.
 * Singleton pattern: one registry per application instance.
 *
 * Usage:
 *   const registry = WorkflowRegistry.instance();
 *   registry.register(myWorkflowDef);
 *   const def = registry.get("myWorkflow");
 */

import type { WorkflowDefinition } from "../types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton registry for workflow definitions.
 * Prevents duplicate registrations and enables easy lookup by name.
 */
export class WorkflowRegistry {
  private static _instance: WorkflowRegistry | null = null;
  private definitions: Map<string, WorkflowDefinition> = new Map();

  /**
   * Get or create the singleton instance.
   */
  static instance(): WorkflowRegistry {
    if (!this._instance) {
      this._instance = new WorkflowRegistry();
    }
    return this._instance;
  }

  /**
   * Reset the singleton (mainly for testing).
   */
  static reset(): void {
    this._instance = null;
  }

  /**
   * Register a workflow definition.
   * Throws if a workflow with the same name already exists.
   */
  register(definition: WorkflowDefinition): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(
        `Workflow "${definition.name}" is already registered. ` +
          `Did you register it twice, or have a naming conflict?`,
      );
    }

    // Validate definition before registering
    this.validate(definition);

    this.definitions.set(definition.name, {
      ...definition,
      // Ensure steps have unique IDs
      steps: definition.steps.map((step, idx) => ({
        ...step,
        id: step.id || `step_${idx}`,
      })),
    });
  }

  /**
   * Get a workflow definition by name.
   * Returns undefined if not found (caller should handle gracefully).
   */
  get(name: string): WorkflowDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if a workflow is registered.
   */
  has(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * List all registered workflow names.
   */
  list(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get all definitions (for bulk operations or monitoring).
   */
  listAll(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Unregister a workflow (mainly for testing/cleanup).
   */
  unregister(name: string): boolean {
    return this.definitions.delete(name);
  }

  /**
   * Clear all registrations (mainly for testing).
   */
  clear(): void {
    this.definitions.clear();
  }

  /**
   * Get registry statistics (for monitoring).
   */
  stats(): {
    totalWorkflows: number;
    totalSteps: number;
    workflows: Array<{ name: string; stepCount: number }>;
  } {
    const workflows = Array.from(this.definitions.values()).map((def) => ({
      name: def.name,
      stepCount: def.steps.length,
    }));

    const totalSteps = workflows.reduce((sum, w) => sum + w.stepCount, 0);

    return {
      totalWorkflows: workflows.length,
      totalSteps,
      workflows,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Validate a workflow definition before registration.
   * Throws descriptive errors for common issues.
   */
  private validate(definition: WorkflowDefinition): void {
    // Validate name
    if (!definition.name || definition.name.trim() === "") {
      throw new Error("WorkflowDefinition must have a non-empty name");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(definition.name)) {
      throw new Error(
        `WorkflowDefinition name "${definition.name}" must contain only alphanumerics, hyphens, underscores`,
      );
    }

    // Validate steps
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
      throw new Error(
        `WorkflowDefinition "${definition.name}" must have at least one step`,
      );
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      const id = step.id || `step_${stepIds.size}`;
      if (stepIds.has(id)) {
        throw new Error(
          `WorkflowDefinition "${definition.name}" has duplicate step ID: "${id}"`,
        );
      }
      stepIds.add(id);

      // Validate step properties
      if (!step.name || step.name.trim() === "") {
        throw new Error(
          `WorkflowDefinition "${definition.name}" has a step without a name`,
        );
      }

      if (typeof step.invoke !== "function") {
        throw new Error(
          `Step "${step.name}" in workflow "${definition.name}" must have an invoke function`,
        );
      }

      // Validate timeouts
      if (step.timeout !== undefined && step.timeout <= 0) {
        throw new Error(
          `Step "${step.name}" has invalid timeout (must be > 0): ${step.timeout}`,
        );
      }

      // Validate retries
      if (step.retries !== undefined && step.retries < 0) {
        throw new Error(
          `Step "${step.name}" has invalid retries (must be >= 0): ${step.retries}`,
        );
      }
    }

    // Validate options
    if (
      definition.options?.timeout !== undefined &&
      definition.options.timeout <= 0
    ) {
      throw new Error(
        `WorkflowDefinition "${definition.name}" has invalid timeout (must be > 0)`,
      );
    }

    if (
      definition.options?.retries !== undefined &&
      definition.options.retries < 0
    ) {
      throw new Error(
        `WorkflowDefinition "${definition.name}" has invalid retries (must be >= 0)`,
      );
    }
  }
}

// WorkflowRegistry is exported above
