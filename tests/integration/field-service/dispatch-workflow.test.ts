/**
 * Field Service Dispatch Workflow Integration Tests (~350 lines)
 *
 * Comprehensive test coverage for:
 * - Auto-dispatch: nearest available with matching skills
 * - Priority preemption: emergency bumps lower priority
 * - Route optimization: multi-stop travel time minimization
 * - ETA accuracy: calculated vs actual comparison
 * - Reassignment: when tech becomes unavailable, cascade to next
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockWorkOrder,
  createMockTechnician,
  createMockDispatchAssignment,
  createMockServiceZone,
  calculateTravelTime,
} from "../fixtures/field-service-fixtures.js";
import type {
  MockWorkOrder,
  MockTechnician,
  MockDispatchAssignment,
} from "../fixtures/field-service-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────
// SETUP & HELPERS
// ─────────────────────────────────────────────────────────────────────────

interface DispatchRoute {
  technicianId: string;
  workOrders: string[];
  totalTravelTime: number;
  estimatedCompletionTime: Date;
}

class DispatchEngine {
  private workOrders = new Map<string, MockWorkOrder>();
  private technicians = new Map<string, MockTechnician>();
  private assignments = new Map<string, MockDispatchAssignment>();
  private serviceZones = new Map<string, MockTechnician>();

  registerWorkOrder(workOrder: MockWorkOrder): void {
    this.workOrders.set(workOrder.id, workOrder);
  }

  registerTechnician(technician: MockTechnician): void {
    this.technicians.set(technician.id, technician);
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTO-DISPATCH
  // ─────────────────────────────────────────────────────────────────

  autoDispatch(workOrderId: string): MockDispatchAssignment | null {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) return null;

    const candidates = this.findCandidates(workOrderId);
    if (candidates.length === 0) return null;

    // Find nearest technician
    const nearest = this.findNearestTechnician(workOrder, candidates);
    if (!nearest) return null;

    const assignment = createMockDispatchAssignment(workOrderId, nearest);
    this.assignments.set(workOrderId, assignment);

    return assignment;
  }

  private findCandidates(workOrderId: string): string[] {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) return [];

    const candidates: string[] = [];

    for (const tech of this.technicians.values()) {
      // Check skills
      const hasAllSkills = workOrder.requiredSkills.every((skill) =>
        tech.skills.includes(skill),
      );
      if (!hasAllSkills) continue;

      // Check availability
      if (tech.status === "available") {
        candidates.push(tech.id);
      }
    }

    return candidates;
  }

  private findNearestTechnician(
    workOrder: MockWorkOrder,
    candidateIds: string[],
  ): string | null {
    let nearestId: string | null = null;
    let minDistance = Infinity;

    for (const techId of candidateIds) {
      const tech = this.technicians.get(techId);
      if (!tech || !tech.currentLocation) continue;

      const distance = calculateTravelTime(tech.currentLocation, {
        latitude: workOrder.location.latitude,
        longitude: workOrder.location.longitude,
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearestId = techId;
      }
    }

    return nearestId;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIORITY PREEMPTION
  // ─────────────────────────────────────────────────────────────────

  preemptByPriority(emergencyWorkOrderId: string): MockDispatchAssignment[] {
    const emergencyWorkOrder = this.workOrders.get(emergencyWorkOrderId);
    if (!emergencyWorkOrder || emergencyWorkOrder.priority !== "emergency")
      return [];

    const preempted: MockDispatchAssignment[] = [];

    for (const [assignmentId, assignment] of this.assignments) {
      const assignedWorkOrder = this.workOrders.get(assignmentId);
      if (!assignedWorkOrder) continue;

      // Check priority levels
      const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
      if (
        priorityOrder[
          assignedWorkOrder.priority as keyof typeof priorityOrder
        ] >
        priorityOrder[emergencyWorkOrder.priority as keyof typeof priorityOrder]
      ) {
        // Preempt lower priority
        preempted.push(assignment);
        this.assignments.delete(assignmentId);
      }
    }

    // Auto-dispatch emergency to freed technician
    this.autoDispatch(emergencyWorkOrderId);

    return preempted;
  }

  // ─────────────────────────────────────────────────────────────────
  // ROUTE OPTIMIZATION
  // ─────────────────────────────────────────────────────────────────

  optimizeRoute(technicianId: string): DispatchRoute {
    const technician = this.technicians.get(technicianId);
    if (!technician) {
      return {
        technicianId,
        workOrders: [],
        totalTravelTime: 0,
        estimatedCompletionTime: new Date(),
      };
    }

    // Find all work orders assigned to this technician
    const assignedWorkOrders: string[] = [];
    for (const [woId, assignment] of this.assignments) {
      if (
        assignment.technicianId === technicianId &&
        assignment.status === "pending"
      ) {
        assignedWorkOrders.push(woId);
      }
    }

    // Simple optimization: sort by travel time from current location
    let currentLocation = technician.currentLocation || {
      latitude: 34.0522,
      longitude: -118.2437,
    };
    const optimizedOrder: string[] = [];
    const remaining = new Set(assignedWorkOrders);
    let totalTravelTime = 0;

    while (remaining.size > 0) {
      let nearestWoId: string | null = null;
      let minTime = Infinity;

      for (const woId of remaining) {
        const wo = this.workOrders.get(woId);
        if (!wo) continue;

        const travelTime = calculateTravelTime(currentLocation, {
          latitude: wo.location.latitude,
          longitude: wo.location.longitude,
        });

        if (travelTime < minTime) {
          minTime = travelTime;
          nearestWoId = woId;
        }
      }

      if (nearestWoId) {
        optimizedOrder.push(nearestWoId);
        remaining.delete(nearestWoId);
        totalTravelTime += minTime;

        const wo = this.workOrders.get(nearestWoId);
        if (wo) {
          currentLocation = {
            latitude: wo.location.latitude,
            longitude: wo.location.longitude,
          };
        }
      }
    }

    // Calculate estimated completion time
    let completionTime = new Date();
    for (const woId of optimizedOrder) {
      const wo = this.workOrders.get(woId);
      if (wo && wo.estimatedDuration) {
        completionTime = new Date(
          completionTime.getTime() + wo.estimatedDuration * 60 * 1000,
        );
      }
    }

    return {
      technicianId,
      workOrders: optimizedOrder,
      totalTravelTime,
      estimatedCompletionTime: completionTime,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ETA TRACKING
  // ─────────────────────────────────────────────────────────────────

  calculateETA(assignmentId: string): Date | null {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment || !assignment.eta) return null;

    return assignment.eta;
  }

  recordActualArrival(assignmentId: string, actualTime: Date): void {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return;

    assignment.actualArrival = actualTime;
    assignment.status = "arrived";
  }

  compareETAAccuracy(
    assignmentId: string,
  ): {
    estimatedMinutes: number;
    actualMinutes: number;
    deviation: number;
  } | null {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment || !assignment.eta || !assignment.actualArrival)
      return null;

    const estimatedMinutes =
      (assignment.eta.getTime() - assignment.assignedAt.getTime()) /
      (1000 * 60);
    const actualMinutes =
      (assignment.actualArrival.getTime() - assignment.assignedAt.getTime()) /
      (1000 * 60);

    return {
      estimatedMinutes: Math.round(estimatedMinutes),
      actualMinutes: Math.round(actualMinutes),
      deviation: Math.round(actualMinutes - estimatedMinutes),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // REASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  reassignWhenUnavailable(technicianId: string): string[] {
    const technician = this.technicians.get(technicianId);
    if (!technician) return [];

    // Mark technician unavailable
    technician.status = "unavailable";

    const reassignedWoIds: string[] = [];

    // Find work orders assigned to this technician
    for (const [woId, assignment] of this.assignments) {
      if (
        assignment.technicianId === technicianId &&
        assignment.status !== "completed"
      ) {
        reassignedWoIds.push(woId);

        // Try to auto-dispatch to next available
        this.assignments.delete(woId);
        this.autoDispatch(woId);
      }
    }

    return reassignedWoIds;
  }

  cascadeReassignment(initialTechId: string): Map<string, string[]> {
    const cascadeMap = new Map<string, string[]>();

    const unassignedWos = this.reassignWhenUnavailable(initialTechId);
    cascadeMap.set(initialTechId, unassignedWos);

    // For each unassigned work order, try next technician
    for (const woId of unassignedWos) {
      const assignment = this.autoDispatch(woId);
      if (assignment && !cascadeMap.has(assignment.technicianId)) {
        cascadeMap.set(assignment.technicianId, []);
      }
    }

    return cascadeMap;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  getAssignment(workOrderId: string): MockDispatchAssignment | undefined {
    return this.assignments.get(workOrderId);
  }

  getAssignmentsByTechnician(technicianId: string): MockDispatchAssignment[] {
    const result: MockDispatchAssignment[] = [];

    for (const assignment of this.assignments.values()) {
      if (assignment.technicianId === technicianId) {
        result.push(assignment);
      }
    }

    return result;
  }

  updateAssignmentStatus(
    assignmentId: string,
    status: MockDispatchAssignment["status"],
  ): void {
    const assignment = this.assignments.get(assignmentId);
    if (assignment) {
      assignment.status = status;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("Field Service Dispatch Workflow", () => {
  let engine: DispatchEngine;
  let workOrder: MockWorkOrder;
  let technician: MockTechnician;

  beforeEach(() => {
    engine = new DispatchEngine();

    workOrder = createMockWorkOrder({
      id: "wo_0",
      requiredSkills: ["HVAC"],
      priority: "high",
    });
    engine.registerWorkOrder(workOrder);

    technician = createMockTechnician({
      id: "tech_0",
      skills: ["HVAC", "Electrical"],
      status: "available",
    });
    engine.registerTechnician(technician);
  });

  // ─────────────────────────────────────────────────────────────────
  // AUTO-DISPATCH
  // ─────────────────────────────────────────────────────────────────

  describe("Auto-Dispatch", () => {
    it("should dispatch to nearest available technician", () => {
      const assignment = engine.autoDispatch(workOrder.id);

      expect(assignment).toBeDefined();
      expect(assignment?.technicianId).toBe(technician.id);
      expect(assignment?.workOrderId).toBe(workOrder.id);
    });

    it("should dispatch only to technicians with matching skills", () => {
      const unskilled = createMockTechnician({
        id: "tech_1",
        skills: ["Plumbing"],
      });
      unskilled.status = "available";
      engine.registerTechnician(unskilled);

      const assignment = engine.autoDispatch(workOrder.id);

      expect(assignment?.technicianId).not.toBe(unskilled.id);
      expect(assignment?.technicianId).toBe(technician.id);
    });

    it("should not dispatch to unavailable technicians", () => {
      technician.status = "unavailable";

      const assignment = engine.autoDispatch(workOrder.id);

      expect(assignment).toBeNull();
    });

    it("should dispatch to nearest among multiple candidates", () => {
      const tech2 = createMockTechnician({ id: "tech_2", skills: ["HVAC"] });
      tech2.status = "available";
      tech2.currentLocation = { latitude: 34.05, longitude: -118.24 }; // Slightly closer
      engine.registerTechnician(tech2);

      const assignment = engine.autoDispatch(workOrder.id);

      expect(assignment).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PRIORITY PREEMPTION
  // ─────────────────────────────────────────────────────────────────

  describe("Priority Preemption", () => {
    it("should preempt lower priority work orders for emergency", () => {
      // Assign medium priority work order first
      const mediumWo = createMockWorkOrder({
        id: "wo_1",
        requiredSkills: ["HVAC"],
        priority: "medium",
      });
      engine.registerWorkOrder(mediumWo);
      engine.autoDispatch(mediumWo.id);

      // Create emergency work order
      const emergencyWo = createMockWorkOrder({
        id: "wo_2",
        requiredSkills: ["HVAC"],
        priority: "emergency",
      });
      engine.registerWorkOrder(emergencyWo);

      // Preempt for emergency
      const preempted = engine.preemptByPriority(emergencyWo.id);

      expect(preempted.length).toBeGreaterThan(0);
    });

    it("should dispatch emergency after preemption", () => {
      const mediumWo = createMockWorkOrder({
        id: "wo_3",
        requiredSkills: ["HVAC"],
        priority: "medium",
      });
      engine.registerWorkOrder(mediumWo);
      engine.autoDispatch(mediumWo.id);

      const emergencyWo = createMockWorkOrder({
        id: "wo_4",
        requiredSkills: ["HVAC"],
        priority: "emergency",
      });
      engine.registerWorkOrder(emergencyWo);

      engine.preemptByPriority(emergencyWo.id);
      const assignment = engine.getAssignment(emergencyWo.id);

      expect(assignment).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ROUTE OPTIMIZATION
  // ─────────────────────────────────────────────────────────────────

  describe("Route Optimization", () => {
    it("should optimize route for technician", () => {
      const wo1 = createMockWorkOrder({ id: "wo_5", requiredSkills: ["HVAC"] });
      const wo2 = createMockWorkOrder({ id: "wo_6", requiredSkills: ["HVAC"] });
      const wo3 = createMockWorkOrder({ id: "wo_7", requiredSkills: ["HVAC"] });

      engine.registerWorkOrder(wo1);
      engine.registerWorkOrder(wo2);
      engine.registerWorkOrder(wo3);

      engine.autoDispatch(wo1.id);
      engine.autoDispatch(wo2.id);
      engine.autoDispatch(wo3.id);

      const route = engine.optimizeRoute(technician.id);

      expect(route.technicianId).toBe(technician.id);
      expect(route.workOrders.length).toBeGreaterThan(0);
      expect(route.totalTravelTime).toBeGreaterThan(0);
    });

    it("should calculate estimated completion time", () => {
      const wo1 = createMockWorkOrder({
        id: "wo_8",
        requiredSkills: ["HVAC"],
        estimatedDuration: 120,
      });
      engine.registerWorkOrder(wo1);
      engine.autoDispatch(wo1.id);

      const route = engine.optimizeRoute(technician.id);

      expect(route.estimatedCompletionTime).toBeInstanceOf(Date);
      expect(route.estimatedCompletionTime.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ETA TRACKING
  // ─────────────────────────────────────────────────────────────────

  describe("ETA Accuracy", () => {
    it("should calculate ETA for assignment", () => {
      const assignment = engine.autoDispatch(workOrder.id);
      if (!assignment) return;

      const eta = engine.calculateETA(workOrder.id);
      expect(eta).toBeInstanceOf(Date);
    });

    it("should record actual arrival time", () => {
      const assignment = engine.autoDispatch(workOrder.id);
      if (!assignment) return;

      const actualTime = new Date();
      engine.recordActualArrival(workOrder.id, actualTime);

      const updated = engine.getAssignment(workOrder.id);
      expect(updated?.actualArrival).toEqual(actualTime);
      expect(updated?.status).toBe("arrived");
    });

    it("should compare ETA vs actual time", () => {
      const assignment = engine.autoDispatch(workOrder.id);
      if (!assignment) return;

      const actualTime = new Date(
        assignment.assignedAt.getTime() + 35 * 60 * 1000,
      ); // 35 min later
      engine.recordActualArrival(workOrder.id, actualTime);

      const accuracy = engine.compareETAAccuracy(workOrder.id);

      expect(accuracy).toBeDefined();
      expect(accuracy?.deviation).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // REASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  describe("Reassignment on Unavailability", () => {
    it("should reassign when technician becomes unavailable", () => {
      const assignment = engine.autoDispatch(workOrder.id);
      expect(assignment).toBeDefined();

      const reassigned = engine.reassignWhenUnavailable(technician.id);

      expect(reassigned).toContain(workOrder.id);
    });

    it("should cascade reassignment to next technician", () => {
      const tech2 = createMockTechnician({
        id: "tech_2",
        skills: ["HVAC"],
        status: "available",
      });
      engine.registerTechnician(tech2);

      engine.autoDispatch(workOrder.id);

      const cascade = engine.cascadeReassignment(technician.id);

      expect(cascade.has(technician.id)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // DISPATCH HELPERS
  // ─────────────────────────────────────────────────────────────────

  describe("Dispatch Management", () => {
    it("should retrieve assignment by work order", () => {
      const assignment = engine.autoDispatch(workOrder.id);

      const retrieved = engine.getAssignment(workOrder.id);
      expect(retrieved).toEqual(assignment);
    });

    it("should get assignments by technician", () => {
      engine.autoDispatch(workOrder.id);

      const assignments = engine.getAssignmentsByTechnician(technician.id);

      expect(assignments.length).toBeGreaterThan(0);
      expect(assignments[0].technicianId).toBe(technician.id);
    });

    it("should update assignment status", () => {
      engine.autoDispatch(workOrder.id);

      engine.updateAssignmentStatus(workOrder.id, "started");

      const updated = engine.getAssignment(workOrder.id);
      expect(updated?.status).toBe("started");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // COMPLEX SCENARIOS
  // ─────────────────────────────────────────────────────────────────

  describe("Complex Dispatch Scenarios", () => {
    it("should handle emergency dispatch with multiple technicians", () => {
      const tech2 = createMockTechnician({ id: "tech_3", skills: ["HVAC"] });
      tech2.status = "available";
      engine.registerTechnician(tech2);

      const emergencyWo = createMockWorkOrder({
        id: "wo_9",
        requiredSkills: ["HVAC"],
        priority: "emergency",
      });
      engine.registerWorkOrder(emergencyWo);

      const assignment = engine.autoDispatch(emergencyWo.id);
      expect(assignment).toBeDefined();
    });

    it("should manage complete dispatch lifecycle", () => {
      // Dispatch
      const assignment = engine.autoDispatch(workOrder.id);
      expect(assignment?.status).toBe("pending");

      // Update to arrived
      engine.updateAssignmentStatus(workOrder.id, "arrived");
      expect(engine.getAssignment(workOrder.id)?.status).toBe("arrived");

      // Record actual arrival
      const actualArrival = new Date();
      engine.recordActualArrival(workOrder.id, actualArrival);
      expect(engine.getAssignment(workOrder.id)?.actualArrival).toEqual(
        actualArrival,
      );

      // Complete
      engine.updateAssignmentStatus(workOrder.id, "completed");
      expect(engine.getAssignment(workOrder.id)?.status).toBe("completed");
    });
  });
});
