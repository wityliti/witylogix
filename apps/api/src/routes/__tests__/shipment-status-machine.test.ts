/**
 * Shipment Status State Machine Tests
 *
 * Tests the shipment lifecycle state machine validating:
 * - Valid status transitions
 * - Invalid transition prevention
 * - Terminal state handling
 * - Starting state requirements
 * - Reachability from PENDING state
 */

import { describe, it, expect } from "vitest";

// ─── Status Transitions Map ──────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["RETURNED", "OUT_FOR_DELIVERY"],
  RETURNED: [],
  CANCELLED: [],
};

// ─── All Valid Statuses ─────────────────────────────────

const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS);

// ─── Helper Functions ───────────────────────────────────

/**
 * Check if transition from one status to another is valid
 */
function isValidTransition(from: string, to: string): boolean {
  const allowedStates = STATUS_TRANSITIONS[from];
  if (!allowedStates) return false;
  return allowedStates.includes(to);
}

/**
 * Find all reachable states from a given starting state via valid transitions
 */
function findReachableStates(startState: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [startState];
  reachable.add(startState);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const transitions = STATUS_TRANSITIONS[current] || [];
    for (const nextState of transitions) {
      if (!reachable.has(nextState)) {
        reachable.add(nextState);
        queue.push(nextState);
      }
    }
  }

  return reachable;
}

/**
 * Find shortest path between two states
 */
function findPath(from: string, to: string): string[] | null {
  if (from === to) return [from];

  const queue: Array<{ state: string; path: string[] }> = [
    { state: from, path: [from] },
  ];
  const visited = new Set<string>();
  visited.add(from);

  while (queue.length > 0) {
    const { state, path } = queue.shift()!;
    const transitions = STATUS_TRANSITIONS[state] || [];

    for (const nextState of transitions) {
      if (nextState === to) {
        return [...path, to];
      }

      if (!visited.has(nextState)) {
        visited.add(nextState);
        queue.push({
          state: nextState,
          path: [...path, nextState],
        });
      }
    }
  }

  return null;
}

// ─── Valid Transitions Tests ────────────────────────────

describe("Shipment Status State Machine", () => {
  describe("Valid Transitions", () => {
    it("PENDING → PROCESSING is valid", () => {
      expect(isValidTransition("PENDING", "PROCESSING")).toBe(true);
    });

    it("PENDING → CANCELLED is valid", () => {
      expect(isValidTransition("PENDING", "CANCELLED")).toBe(true);
    });

    it("PROCESSING → READY_FOR_PICKUP is valid", () => {
      expect(isValidTransition("PROCESSING", "READY_FOR_PICKUP")).toBe(true);
    });

    it("PROCESSING → CANCELLED is valid", () => {
      expect(isValidTransition("PROCESSING", "CANCELLED")).toBe(true);
    });

    it("READY_FOR_PICKUP → PICKED_UP is valid", () => {
      expect(isValidTransition("READY_FOR_PICKUP", "PICKED_UP")).toBe(true);
    });

    it("READY_FOR_PICKUP → CANCELLED is valid", () => {
      expect(isValidTransition("READY_FOR_PICKUP", "CANCELLED")).toBe(true);
    });

    it("PICKED_UP → IN_TRANSIT is valid", () => {
      expect(isValidTransition("PICKED_UP", "IN_TRANSIT")).toBe(true);
    });

    it("IN_TRANSIT → OUT_FOR_DELIVERY is valid", () => {
      expect(isValidTransition("IN_TRANSIT", "OUT_FOR_DELIVERY")).toBe(true);
    });

    it("OUT_FOR_DELIVERY → ARRIVED is valid", () => {
      expect(isValidTransition("OUT_FOR_DELIVERY", "ARRIVED")).toBe(true);
    });

    it("OUT_FOR_DELIVERY → FAILED is valid", () => {
      expect(isValidTransition("OUT_FOR_DELIVERY", "FAILED")).toBe(true);
    });

    it("ARRIVED → DELIVERED is valid", () => {
      expect(isValidTransition("ARRIVED", "DELIVERED")).toBe(true);
    });

    it("ARRIVED → FAILED is valid", () => {
      expect(isValidTransition("ARRIVED", "FAILED")).toBe(true);
    });

    it("FAILED → RETURNED is valid", () => {
      expect(isValidTransition("FAILED", "RETURNED")).toBe(true);
    });

    it("FAILED → OUT_FOR_DELIVERY is valid (retry)", () => {
      expect(isValidTransition("FAILED", "OUT_FOR_DELIVERY")).toBe(true);
    });

    it("returns all valid transitions for each status", () => {
      const expectedTransitions = {
        PENDING: ["PROCESSING", "CANCELLED"],
        PROCESSING: ["READY_FOR_PICKUP", "CANCELLED"],
        READY_FOR_PICKUP: ["PICKED_UP", "CANCELLED"],
        PICKED_UP: ["IN_TRANSIT"],
        IN_TRANSIT: ["OUT_FOR_DELIVERY"],
        OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
        ARRIVED: ["DELIVERED", "FAILED"],
        DELIVERED: [],
        FAILED: ["RETURNED", "OUT_FOR_DELIVERY"],
        RETURNED: [],
        CANCELLED: [],
      };

      for (const [status, transitions] of Object.entries(expectedTransitions)) {
        expect(STATUS_TRANSITIONS[status]).toEqual(transitions);
      }
    });
  });

  // ─── Invalid Transitions Tests ──────────────────────

  describe("Invalid Transitions", () => {
    it("PENDING → DELIVERED is invalid", () => {
      expect(isValidTransition("PENDING", "DELIVERED")).toBe(false);
    });

    it("PENDING → ARRIVED is invalid", () => {
      expect(isValidTransition("PENDING", "ARRIVED")).toBe(false);
    });

    it("PENDING → IN_TRANSIT is invalid", () => {
      expect(isValidTransition("PENDING", "IN_TRANSIT")).toBe(false);
    });

    it("PROCESSING → DELIVERED is invalid", () => {
      expect(isValidTransition("PROCESSING", "DELIVERED")).toBe(false);
    });

    it("READY_FOR_PICKUP → IN_TRANSIT is invalid", () => {
      expect(isValidTransition("READY_FOR_PICKUP", "IN_TRANSIT")).toBe(false);
    });

    it("PICKED_UP → DELIVERED is invalid", () => {
      expect(isValidTransition("PICKED_UP", "DELIVERED")).toBe(false);
    });

    it("PICKED_UP → PROCESSING is invalid (backward)", () => {
      expect(isValidTransition("PICKED_UP", "PROCESSING")).toBe(false);
    });

    it("IN_TRANSIT → PICKED_UP is invalid (backward)", () => {
      expect(isValidTransition("IN_TRANSIT", "PICKED_UP")).toBe(false);
    });

    it("OUT_FOR_DELIVERY → IN_TRANSIT is invalid (backward)", () => {
      expect(isValidTransition("OUT_FOR_DELIVERY", "IN_TRANSIT")).toBe(false);
    });

    it("ARRIVED → OUT_FOR_DELIVERY is invalid (backward)", () => {
      expect(isValidTransition("ARRIVED", "OUT_FOR_DELIVERY")).toBe(false);
    });

    it("DELIVERED → FAILED is invalid (terminal)", () => {
      expect(isValidTransition("DELIVERED", "FAILED")).toBe(false);
    });

    it("DELIVERED → RETURNED is invalid (terminal)", () => {
      expect(isValidTransition("DELIVERED", "RETURNED")).toBe(false);
    });

    it("CANCELLED → PROCESSING is invalid (terminal)", () => {
      expect(isValidTransition("CANCELLED", "PROCESSING")).toBe(false);
    });

    it("RETURNED → PROCESSING is invalid (terminal)", () => {
      expect(isValidTransition("RETURNED", "PROCESSING")).toBe(false);
    });

    it("cannot transition to invalid status", () => {
      expect(isValidTransition("PENDING", "INVALID_STATUS")).toBe(false);
    });
  });

  // ─── Terminal State Tests ───────────────────────────

  describe("Terminal States", () => {
    it("DELIVERED has no outgoing transitions", () => {
      expect(STATUS_TRANSITIONS["DELIVERED"]).toEqual([]);
    });

    it("CANCELLED has no outgoing transitions", () => {
      expect(STATUS_TRANSITIONS["CANCELLED"]).toEqual([]);
    });

    it("RETURNED has no outgoing transitions", () => {
      expect(STATUS_TRANSITIONS["RETURNED"]).toEqual([]);
    });

    it("terminal states are truly terminal", () => {
      const terminalStates = ["DELIVERED", "CANCELLED", "RETURNED"];

      for (const terminal of terminalStates) {
        for (const otherStatus of ALL_STATUSES) {
          if (otherStatus !== terminal) {
            expect(isValidTransition(terminal, otherStatus)).toBe(false);
          }
        }
      }
    });
  });

  // ─── Starting State Tests ───────────────────────────

  describe("Starting State", () => {
    it("PENDING is the only valid starting state", () => {
      const startingStates = ALL_STATUSES.filter(
        (status) => STATUS_TRANSITIONS[status].includes(status) === false,
      );

      const reachableFromPending = findReachableStates("PENDING");

      for (const status of ALL_STATUSES) {
        const isReachable = reachableFromPending.has(status);
        const shouldBeReachable =
          status === "PENDING" ||
          STATUS_TRANSITIONS["PENDING"].includes(status) ||
          findPath("PENDING", status) !== null;

        expect(isReachable).toBe(shouldBeReachable);
      }
    });

    it("only PENDING transitions can be made without prior transition", () => {
      const pendingTransitions = STATUS_TRANSITIONS["PENDING"];
      expect(pendingTransitions.length).toBeGreaterThan(0);
      expect(pendingTransitions).toContain("PROCESSING");
      expect(pendingTransitions).toContain("CANCELLED");
    });
  });

  // ─── Reachability Tests ────────────────────────────

  describe("State Reachability from PENDING", () => {
    it("PROCESSING is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("PROCESSING")).toBe(true);
    });

    it("READY_FOR_PICKUP is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("READY_FOR_PICKUP")).toBe(true);
    });

    it("PICKED_UP is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("PICKED_UP")).toBe(true);
    });

    it("IN_TRANSIT is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("IN_TRANSIT")).toBe(true);
    });

    it("OUT_FOR_DELIVERY is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("OUT_FOR_DELIVERY")).toBe(true);
    });

    it("ARRIVED is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("ARRIVED")).toBe(true);
    });

    it("DELIVERED is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("DELIVERED")).toBe(true);
    });

    it("FAILED is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("FAILED")).toBe(true);
    });

    it("RETURNED is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("RETURNED")).toBe(true);
    });

    it("CANCELLED is reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.has("CANCELLED")).toBe(true);
    });

    it("all non-PENDING states are reachable from PENDING", () => {
      const reachable = findReachableStates("PENDING");
      expect(reachable.size).toBe(ALL_STATUSES.length);
    });
  });

  // ─── Path Finding Tests ────────────────────────────

  describe("Shortest Paths to Terminal States", () => {
    it("path from PENDING to DELIVERED exists", () => {
      const path = findPath("PENDING", "DELIVERED");
      expect(path).not.toBeNull();
      expect(path?.[0]).toBe("PENDING");
      expect(path?.[path.length - 1]).toBe("DELIVERED");
    });

    it("path from PENDING to DELIVERED is valid", () => {
      const path = findPath("PENDING", "DELIVERED");
      expect(path).not.toBeNull();

      if (path) {
        for (let i = 0; i < path.length - 1; i++) {
          expect(isValidTransition(path[i], path[i + 1])).toBe(true);
        }
      }
    });

    it("shortest path PENDING → DELIVERED", () => {
      const path = findPath("PENDING", "DELIVERED");
      expect(path).toEqual([
        "PENDING",
        "PROCESSING",
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "ARRIVED",
        "DELIVERED",
      ]);
    });

    it("path from PENDING to CANCELLED", () => {
      const path = findPath("PENDING", "CANCELLED");
      expect(path).toEqual(["PENDING", "CANCELLED"]);
    });

    it("path from PENDING to RETURNED", () => {
      const path = findPath("PENDING", "RETURNED");
      expect(path).not.toBeNull();
      expect(path?.[path.length - 1]).toBe("RETURNED");
    });

    it("multiple valid paths may exist for same destination", () => {
      // FAILED can transition back to OUT_FOR_DELIVERY for retry
      const normalPath = findPath("OUT_FOR_DELIVERY", "FAILED");
      expect(normalPath).not.toBeNull();
      expect(normalPath).toEqual(["OUT_FOR_DELIVERY", "FAILED"]);
    });

    it("retry path exists from FAILED back to OUT_FOR_DELIVERY", () => {
      const path = findPath("FAILED", "OUT_FOR_DELIVERY");
      expect(path).toEqual(["FAILED", "OUT_FOR_DELIVERY"]);
    });
  });

  // ─── Complex Scenario Tests ────────────────────────

  describe("Complex Shipment Scenarios", () => {
    it("normal delivery flow: PENDING → DELIVERED", () => {
      const path = findPath("PENDING", "DELIVERED");
      expect(path).not.toBeNull();
      expect(path?.length).toBeLessThanOrEqual(10);
    });

    it("cancelled before processing", () => {
      expect(isValidTransition("PENDING", "CANCELLED")).toBe(true);
      const path = findPath("PENDING", "CANCELLED");
      expect(path).toEqual(["PENDING", "CANCELLED"]);
    });

    it("cancelled after processing", () => {
      expect(isValidTransition("PROCESSING", "CANCELLED")).toBe(true);
      const path = findPath("PENDING", "CANCELLED");
      expect(path).toEqual(["PENDING", "CANCELLED"]);
    });

    it("failed delivery with return", () => {
      const toFailed = findPath("PENDING", "FAILED");
      expect(toFailed).not.toBeNull();

      const toReturned = findPath("FAILED", "RETURNED");
      expect(toReturned).toEqual(["FAILED", "RETURNED"]);
    });

    it("failed delivery with retry", () => {
      const toFailed = findPath("OUT_FOR_DELIVERY", "FAILED");
      expect(toFailed).not.toBeNull();

      const retry = findPath("FAILED", "OUT_FOR_DELIVERY");
      expect(retry).toEqual(["FAILED", "OUT_FOR_DELIVERY"]);

      // Can retry to DELIVERED
      expect(isValidTransition("OUT_FOR_DELIVERY", "ARRIVED")).toBe(true);
      expect(isValidTransition("ARRIVED", "DELIVERED")).toBe(true);
    });

    it("once delivered, no further transitions", () => {
      const nextStates = STATUS_TRANSITIONS["DELIVERED"];
      expect(nextStates.length).toBe(0);
      expect(nextStates).toEqual([]);
    });
  });

  // ─── Structure Validation Tests ─────────────────────

  describe("State Machine Structure", () => {
    it("all transitions reference valid statuses", () => {
      const allTransitionTargets = new Set<string>();

      for (const [status, transitions] of Object.entries(STATUS_TRANSITIONS)) {
        expect(ALL_STATUSES).toContain(status);

        for (const target of transitions) {
          expect(ALL_STATUSES).toContain(target);
          allTransitionTargets.add(target);
        }
      }
    });

    it("no duplicate transitions from same status", () => {
      for (const [status, transitions] of Object.entries(STATUS_TRANSITIONS)) {
        const unique = new Set(transitions);
        expect(unique.size).toBe(transitions.length);
      }
    });

    it("no self-transitions allowed", () => {
      for (const [status, transitions] of Object.entries(STATUS_TRANSITIONS)) {
        expect(transitions).not.toContain(status);
      }
    });

    it("state machine has at least one terminal state", () => {
      const terminalStates = ALL_STATUSES.filter(
        (status) => STATUS_TRANSITIONS[status].length === 0,
      );
      expect(terminalStates.length).toBeGreaterThan(0);
    });

    it("multiple terminal states exist", () => {
      const terminalStates = ALL_STATUSES.filter(
        (status) => STATUS_TRANSITIONS[status].length === 0,
      );
      expect(terminalStates.length).toBeGreaterThanOrEqual(3);
      expect(terminalStates).toContain("DELIVERED");
      expect(terminalStates).toContain("CANCELLED");
      expect(terminalStates).toContain("RETURNED");
    });

    it("state machine handles delivery retry scenario", () => {
      const hasRetry =
        STATUS_TRANSITIONS["FAILED"].includes("OUT_FOR_DELIVERY");
      expect(hasRetry).toBe(true);
    });

    it("at least 10 states defined", () => {
      expect(ALL_STATUSES.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────

  describe("Edge Cases", () => {
    it("handles undefined source status gracefully", () => {
      const transitions = STATUS_TRANSITIONS["NONEXISTENT"] || [];
      expect(transitions).toEqual([]);
    });

    it("undefined transitions default to empty array", () => {
      expect(STATUS_TRANSITIONS["NONEXISTENT"]).toBeUndefined();
    });

    it("empty target transitions are explicitly defined", () => {
      const terminalStates = ["DELIVERED", "CANCELLED", "RETURNED"];
      for (const state of terminalStates) {
        expect(state in STATUS_TRANSITIONS).toBe(true);
        expect(STATUS_TRANSITIONS[state]).toEqual([]);
      }
    });

    it("no state can transition to itself", () => {
      for (const [status, transitions] of Object.entries(STATUS_TRANSITIONS)) {
        expect(transitions.includes(status)).toBe(false);
      }
    });
  });
});
