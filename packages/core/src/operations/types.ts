/**
 * Activity Flow types (ADR-030).
 *
 * A flow is a directed graph of stages. Each stage lists the stages it
 * is allowed to transition to, plus optional metadata used by the UI
 * and (future) scope-gated transitions.
 */

export interface FlowStage {
  /** Tenant-scoped slug — stable identifier used on entities. */
  key: string;
  /** Human-friendly label shown in the dashboard. */
  label: string;
  /** Default entry point when creating a new entity. Exactly one per flow. */
  isInitial?: boolean;
  /** No outgoing transitions allowed once reached. */
  isTerminal?: boolean;
  /** Optional CSS colour used by the dashboard. */
  color?: string;
  /** Stages this one is allowed to advance to. */
  transitions: FlowTransition[];
}

export interface FlowTransition {
  /** Target stage key. */
  to: string;
  /** Optional label for the transition button. */
  label?: string;
  /**
   * If set, the caller must be an OAuth app that holds this scope in
   * addition to the base `*:transition` scope. Lets tenants gate
   * sensitive stage changes (e.g. "cancelled") to specific apps.
   */
  requiredScope?: string;
}

export interface FlowGraph {
  stages: FlowStage[];
}

export interface FlowValidationError {
  code: 'INVALID_STAGE' | 'INVALID_TRANSITION' | 'NO_INITIAL' | 'DUPLICATE_KEY' | 'UNKNOWN_TARGET';
  message: string;
}
