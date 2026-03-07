/**
 * @witylogix/framework/workflow — Workflow engine exports
 *
 * Public API for workflow registration and execution.
 */

export { WorkflowEngine } from "./engine.js";
export { WorkflowRegistry } from "./registry.js";
export { runStep, createStepExecution, markStepSuccess, markStepFailure } from "./step-runner.js";
export { runCompensation, isCompensationNeeded } from "./compensation.js";

export type { CompensationResult } from "./compensation.js";
