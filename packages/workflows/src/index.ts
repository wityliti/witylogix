/**
 * @witylogix/workflows — Workflow orchestration and step definitions
 *
 * Core exports:
 * - WorkflowStep, WorkflowContext, StepResult: Core interfaces
 * - All reusable workflow steps (validation, geocoding, assignment, etc.)
 * - Workflow definitions (to be populated by team agents)
 *
 * Usage:
 *
 * import {
 *   validateOrderStep,
 *   geocodeAddressStep,
 *   calculateRateStep,
 *   createOrderRecordStep,
 * } from "@witylogix/workflows/steps";
 *
 * import { createDefaultLogger, type WorkflowContext } from "@witylogix/workflows";
 *
 * // Compose custom workflow
 * const steps = [
 *   validateOrderStep,
 *   geocodeAddressStep,
 *   calculateRateStep,
 *   createOrderRecordStep,
 * ];
 */

// Core types
export type {
  WorkflowStep,
  WorkflowContext,
  StepResult,
  WorkflowState,
  StepExecutionRecord,
} from "./types.js";

export { createDefaultLogger } from "./types.js";

// Re-export steps (selective to avoid duplicate names)
export {
  validateOrderStep,
  geocodeAddressStep,
  calculateRateStep,
  assignZoneStep,
  findAvailableDriversStep,
  optimizeAssignmentStep,
  assignDriverRecordStep,
  createOrderRecordStep,
  verifyProofOfDeliveryStep,
  updateDeliveryStatusStep,
  triggerBillingStep,
  sendNotificationStep,
} from "./steps/index.js";

// Re-export all workflow definitions
export * from "./definitions/index.js";
