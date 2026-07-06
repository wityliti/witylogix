/**
 * Return Status State Machine
 *
 * Defines valid transitions between return statuses.
 * Enforces the lifecycle of return requests.
 */

import type { ReturnStatus } from "./types.js";
import { ReturnStatus as RS } from "./types.js";

// ─── VALID TRANSITIONS ──────────────────────────────────────────

/**
 * Map of valid status transitions
 * key: current status → value: array of allowed next statuses
 */
const RETURN_TRANSITIONS: Record<string, ReturnStatus[]> = {
  [RS.REQUESTED]: [RS.APPROVED, RS.REJECTED],
  [RS.APPROVED]: [RS.SHIPPED_BACK, RS.REJECTED],
  [RS.REJECTED]: [RS.CLOSED],
  [RS.SHIPPED_BACK]: [RS.RECEIVED, RS.CLOSED],
  [RS.RECEIVED]: [RS.INSPECTED, RS.CLOSED],
  [RS.INSPECTED]: [RS.REFUNDED, RS.REJECTED],
  [RS.REFUNDED]: [RS.CLOSED],
  [RS.CLOSED]: [],
};

// ─── TRANSITION VALIDATION ──────────────────────────────────────

/**
 * Check if a transition from one status to another is valid
 *
 * @param from - Current return status
 * @param to - Desired return status
 * @returns true if transition is allowed, false otherwise
 */
export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  const allowedTransitions = RETURN_TRANSITIONS[from];
  return allowedTransitions ? allowedTransitions.includes(to) : false;
}

/**
 * Get all valid next statuses from a given status
 *
 * @param current - Current return status
 * @returns array of valid next statuses
 */
export function getNextStatuses(current: ReturnStatus): ReturnStatus[] {
  return RETURN_TRANSITIONS[current] || [];
}

/**
 * Validate a transition and throw error if invalid
 *
 * @param from - Current return status
 * @param to - Desired return status
 * @throws Error if transition is not allowed
 */
export function validateTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (!canTransition(from, to)) {
    const allowedStatuses = getNextStatuses(from);
    throw new Error(
      `Invalid status transition from ${from} to ${to}. ` +
        `Allowed transitions: ${allowedStatuses.join(", ") || "none"}`,
    );
  }
}

/**
 * Check if a status is a terminal (final) status
 *
 * @param status - Return status to check
 * @returns true if status is terminal, false otherwise
 */
export function isTerminalStatus(status: ReturnStatus): boolean {
  return status === RS.CLOSED;
}

/**
 * Check if a return is still in an active (non-terminal) state
 *
 * @param status - Return status to check
 * @returns true if return is still active, false if closed
 */
export function isActive(status: ReturnStatus): boolean {
  return !isTerminalStatus(status);
}
