/**
 * Returns/RMA Module
 *
 * Complete returns and RMA (Return Merchandise Authorization) infrastructure:
 * - Return request creation and lifecycle management
 * - Status state machine with valid transitions
 * - Refund calculation with condition-based adjustments and restocking fees
 * - Return policy management per tenant
 * - Event-driven integration via event bus
 * - Workflow orchestration for returns lifecycle
 *
 * @module returns
 */

// ============================================================================
// Types Exports
// ============================================================================

export {
  ReturnStatus,
  ReturnReason,
  type ReturnRequest,
  type ReturnItem,
  type ReturnPolicy,
  type CreateReturnInput,
  type ApproveReturnInput,
  type ProcessRefundInput,
  type RefundCalculation,
  type ConditionAdjustment,
  type ItemCondition,
} from "./types.js";

// ============================================================================
// Return Service Exports
// ============================================================================

export { ReturnService, returnService } from "./return-service.js";

// ============================================================================
// Status Machine Exports
// ============================================================================

export {
  canTransition,
  getNextStatuses,
  validateTransition,
  isTerminalStatus,
  isActive,
} from "./status-machine.js";

// ============================================================================
// Refund Calculator Exports
// ============================================================================

export {
  calculateRefund,
  calculateRestockingFee,
  adjustForCondition,
  calculateItemRefund,
} from "./refund-calculator.js";

// ============================================================================
// Event & Workflow Exports
// ============================================================================

export {
  emitReturnEvent,
  type ReturnRequestedPayload,
  type ReturnApprovedPayload,
  type ReturnRejectedPayload,
  type ReturnReceivedPayload,
  type ReturnInspectedPayload,
  type ReturnRefundedPayload,
} from "./events.js";

export { registerReturnWorkflows } from "./return-workflow.js";
