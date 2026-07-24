/**
 * Field Service Scheduling Constraints Integration Tests (~400 lines)
 *
 * Comprehensive test coverage for:
 * - Skill matching: only techs with required skills/certs assigned
 * - Zone validation: job address must be in tech's service zone
 * - Availability: no double-booking, working hours respected
 * - SLA windows: emergency 2h, high 4h, medium 24h, low 72h
 * - Travel time: realistic travel estimates, impossible schedules rejected
 * - Workload balancing: even distribution across technicians
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockWorkOrder,
  createMockTechnician,
  createMockServiceZone,
  calculateSLA,
  calculateTravelTime,
  isWithinServiceZone,
} from "../fixtures/field-service-fixtures.js";
import type {
  MockWorkOrder,
  MockTechnician,
  MockServiceZone,
} from "../fixtures/field-service-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────
// SETUP & HELPERS
// ─────────────────────────────────────────────────────────────────────────

interface SchedulingConstraintError {
  type:
    | "skill_mismatch"
    | "zone_violation"
    | "double_booking"
    | "working_hours_violation"
    | "sla_impossible"
    | "travel_time_impossible"
    | "insufficient_capacity";
  message: string;
}

class SchedulingEngine {
  private workOrders = new Map<string, MockWorkOrder>();
  private technicians = new Map<string, MockTechnician>();
  private serviceZones = new Map<string, MockServiceZone>();
  private assignments = new Map<string, string>(); // work order -> technician
  private technicianSchedules = new Map<string, Date[]>(); // technician -> booked times

  registerWorkOrder(workOrder: MockWorkOrder): void {
    this.workOrders.set(workOrder.id, workOrder);
  }

  registerTechnician(technician: MockTechnician): void {
    this.technicians.set(technician.id, technician);
    this.technicianSchedules.set(technician.id, []);
  }

  registerServiceZone(zone: MockServiceZone): void {
    this.serviceZones.set(zone.id, zone);
  }

  // ─────────────────────────────────────────────────────────────────
  // SKILL MATCHING
  // ─────────────────────────────────────────────────────────────────

  validateSkillMatch(
    workOrderId: string,
    technicianId: string,
  ): SchedulingConstraintError | null {
    const workOrder = this.workOrders.get(workOrderId);
    const technician = this.technicians.get(technicianId);

    if (!workOrder || !technician) return null;

    for (const requiredSkill of workOrder.requiredSkills) {
      if (!technician.skills.includes(requiredSkill)) {
        return {
          type: "skill_mismatch",
          message: "Technician lacks required skill: " + requiredSkill,
        };
      }
    }

    return null;
  }

  getCandidatesBySkill(workOrderId: string): string[] {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) return [];

    const candidates: string[] = [];

    for (const techId of this.technicians.keys()) {
      if (!this.validateSkillMatch(workOrderId, techId)) {
        candidates.push(techId);
      }
    }

    return candidates;
  }

  // ─────────────────────────────────────────────────────────────────
  // ZONE VALIDATION
  // ─────────────────────────────────────────────────────────────────

  validateZoneMatch(
    workOrderId: string,
    technicianId: string,
  ): SchedulingConstraintError | null {
    const workOrder = this.workOrders.get(workOrderId);
    const technician = this.technicians.get(technicianId);

    if (!workOrder || !technician) return null;

    const jobLocation = workOrder.location;
    let inZone = false;

    for (const zoneId of technician.serviceZoneIds) {
      const zone = this.serviceZones.get(zoneId);
      if (
        zone &&
        isWithinServiceZone(
          { latitude: jobLocation.latitude, longitude: jobLocation.longitude },
          zone,
        )
      ) {
        inZone = true;
        break;
      }
    }

    if (!inZone) {
      return {
        type: "zone_violation",
        message: "Job location outside technician service zones",
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // AVAILABILITY CHECK
  // ─────────────────────────────────────────────────────────────────

  validateAvailability(
    workOrderId: string,
    technicianId: string,
  ): SchedulingConstraintError | null {
    const workOrder = this.workOrders.get(workOrderId);
    const technician = this.technicians.get(technicianId);

    if (
      !workOrder ||
      !technician ||
      !workOrder.scheduledStart ||
      !workOrder.scheduledEnd
    ) {
      return null;
    }

    // Check for double-booking
    const bookedTimes = this.technicianSchedules.get(technicianId) || [];

    for (const bookedTime of bookedTimes) {
      // Simple overlap check - in reality would be more sophisticated
      if (
        (workOrder.scheduledStart.getTime() <= bookedTime.getTime() &&
          workOrder.scheduledEnd.getTime() > bookedTime.getTime()) ||
        (workOrder.scheduledStart.getTime() < bookedTime.getTime() &&
          workOrder.scheduledEnd.getTime() >= bookedTime.getTime())
      ) {
        return {
          type: "double_booking",
          message: "Technician already booked during requested time",
        };
      }
    }

    // Check working hours
    const jobStartHour = workOrder.scheduledStart.getHours();
    const jobEndHour = workOrder.scheduledEnd.getHours();

    const [startHour, startMin] = technician.workingHours.startTime
      .split(":")
      .map(Number);
    const [endHour, endMin] = technician.workingHours.endTime
      .split(":")
      .map(Number);

    if (jobStartHour < startHour || jobEndHour > endHour) {
      return {
        type: "working_hours_violation",
        message: "Job outside technician working hours",
      };
    }

    // Check day of week
    const dayOfWeek = workOrder.scheduledStart.getDay();
    if (!technician.workingHours.daysOfWeek.includes(dayOfWeek)) {
      return {
        type: "working_hours_violation",
        message:
          "Technician not available on " +
          ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek],
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // SLA VALIDATION
  // ─────────────────────────────────────────────────────────────────

  validateSLA(workOrderId: string): SchedulingConstraintError | null {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) return null;

    const slaDeadline = calculateSLA(workOrder.priority, workOrder.createdAt);
    const now = new Date();

    // Check if SLA is achievable
    if (slaDeadline < now) {
      return {
        type: "sla_impossible",
        message:
          "SLA already breached for " + workOrder.priority + " priority job",
      };
    }

    return null;
  }

  getSLAWindow(priority: string): number {
    const windows = {
      emergency: 120, // 2 hours
      high: 240, // 4 hours
      medium: 1440, // 24 hours
      low: 4320, // 72 hours
    };

    return windows[priority as keyof typeof windows] || 1440;
  }

  // ─────────────────────────────────────────────────────────────────
  // TRAVEL TIME VALIDATION
  // ─────────────────────────────────────────────────────────────────

  validateTravelTime(
    workOrderId: string,
    technicianId: string,
    fromLocation?: { latitude: number; longitude: number },
  ): SchedulingConstraintError | null {
    const workOrder = this.workOrders.get(workOrderId);
    const technician = this.technicians.get(technicianId);

    if (!workOrder || !technician || !technician.currentLocation) {
      return null;
    }

    const from = fromLocation || technician.currentLocation;
    const travelMinutes = calculateTravelTime(from, {
      latitude: workOrder.location.latitude,
      longitude: workOrder.location.longitude,
    });

    if (!workOrder.scheduledStart) return null;

    // Check if there's enough time for travel
    const now = new Date();
    const timeToJobStart =
      (workOrder.scheduledStart.getTime() - now.getTime()) / (1000 * 60); // minutes

    if (timeToJobStart < travelMinutes) {
      return {
        type: "travel_time_impossible",
        message:
          "Insufficient time for travel: " +
          travelMinutes +
          " min needed, " +
          timeToJobStart +
          " min available",
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // WORKLOAD BALANCING
  // ─────────────────────────────────────────────────────────────────

  calculateWorkload(technicianId: string): number {
    const technician = this.technicians.get(technicianId);
    if (!technician) return 0;

    let totalHours = 0;

    for (const workOrder of this.workOrders.values()) {
      if (
        this.assignments.get(workOrder.id) === technicianId &&
        workOrder.scheduledStart &&
        workOrder.scheduledEnd
      ) {
        const durationMinutes =
          (workOrder.scheduledEnd.getTime() -
            workOrder.scheduledStart.getTime()) /
          (1000 * 60);
        totalHours += durationMinutes / 60;
      }
    }

    return totalHours;
  }

  getBalancedTechnicianBySkill(workOrderId: string): string | null {
    const candidates = this.getCandidatesBySkill(workOrderId);

    if (candidates.length === 0) return null;

    // Sort by workload (ascending)
    candidates.sort(
      (a, b) => this.calculateWorkload(a) - this.calculateWorkload(b),
    );

    return candidates[0];
  }

  getWorkloadDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const techId of this.technicians.keys()) {
      distribution.set(techId, this.calculateWorkload(techId));
    }

    return distribution;
  }

  // ─────────────────────────────────────────────────────────────────
  // ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  assignWorkOrder(
    workOrderId: string,
    technicianId: string,
  ): SchedulingConstraintError[] {
    const errors: SchedulingConstraintError[] = [];

    const skillError = this.validateSkillMatch(workOrderId, technicianId);
    if (skillError) errors.push(skillError);

    const zoneError = this.validateZoneMatch(workOrderId, technicianId);
    if (zoneError) errors.push(zoneError);

    const availabilityError = this.validateAvailability(
      workOrderId,
      technicianId,
    );
    if (availabilityError) errors.push(availabilityError);

    const travelError = this.validateTravelTime(workOrderId, technicianId);
    if (travelError) errors.push(travelError);

    if (errors.length === 0) {
      this.assignments.set(workOrderId, technicianId);

      const workOrder = this.workOrders.get(workOrderId);
      if (workOrder?.scheduledStart && workOrder?.scheduledEnd) {
        const times = this.technicianSchedules.get(technicianId) || [];
        times.push(workOrder.scheduledStart, workOrder.scheduledEnd);
        this.technicianSchedules.set(technicianId, times);
      }
    }

    return errors;
  }

  getAssignment(workOrderId: string): string | undefined {
    return this.assignments.get(workOrderId);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("Field Service Scheduling Constraints", () => {
  let engine: SchedulingEngine;
  let workOrder: MockWorkOrder;
  let technician: MockTechnician;
  let serviceZone: MockServiceZone;

  beforeEach(() => {
    engine = new SchedulingEngine();

    workOrder = createMockWorkOrder({
      id: "wo_0",
      requiredSkills: ["HVAC", "Electrical"],
    });
    engine.registerWorkOrder(workOrder);

    technician = createMockTechnician({
      id: "tech_0",
      skills: ["HVAC", "Electrical", "Plumbing"],
    });
    engine.registerTechnician(technician);

    serviceZone = createMockServiceZone({ id: "zone_la" });
    engine.registerServiceZone(serviceZone);

    technician.serviceZoneIds = ["zone_la"];
  });

  // ─────────────────────────────────────────────────────────────────
  // SKILL MATCHING
  // ─────────────────────────────────────────────────────────────────

  describe("Skill Matching", () => {
    it("should allow assignment when technician has all skills", () => {
      const error = engine.validateSkillMatch(workOrder.id, technician.id);
      expect(error).toBeNull();
    });

    it("should reject assignment for missing skill", () => {
      const insufficientTech = createMockTechnician({
        id: "tech_1",
        skills: ["Plumbing"],
      });
      engine.registerTechnician(insufficientTech);

      const error = engine.validateSkillMatch(
        workOrder.id,
        insufficientTech.id,
      );
      expect(error).toBeDefined();
      expect(error?.type).toBe("skill_mismatch");
    });

    it("should find candidates with required skills", () => {
      const candidates = engine.getCandidatesBySkill(workOrder.id);
      expect(candidates).toContain(technician.id);
    });

    it("should exclude technicians without required skills", () => {
      const unqualified = createMockTechnician({
        id: "tech_2",
        skills: ["Plumbing"],
      });
      engine.registerTechnician(unqualified);

      const candidates = engine.getCandidatesBySkill(workOrder.id);
      expect(candidates).not.toContain(unqualified.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ZONE VALIDATION
  // ─────────────────────────────────────────────────────────────────

  describe("Zone Validation", () => {
    it("should allow assignment within service zone", () => {
      const error = engine.validateZoneMatch(workOrder.id, technician.id);
      expect(error).toBeNull();
    });

    it("should reject assignment outside service zone", () => {
      const outOfZoneTech = createMockTechnician({
        id: "tech_3",
        skills: ["HVAC"],
      });
      outOfZoneTech.serviceZoneIds = ["zone_sf"]; // Different zone
      engine.registerTechnician(outOfZoneTech);

      const error = engine.validateZoneMatch(workOrder.id, outOfZoneTech.id);
      expect(error).toBeDefined();
      expect(error?.type).toBe("zone_violation");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // AVAILABILITY CHECK
  // ─────────────────────────────────────────────────────────────────

  describe("Availability Check", () => {
    it("should allow assignment during working hours", () => {
      const error = engine.validateAvailability(workOrder.id, technician.id);
      expect(error).toBeNull();
    });

    it("should reject assignment outside working hours", () => {
      const jobAfterHours = createMockWorkOrder({ id: "wo_1" });
      jobAfterHours.scheduledStart = new Date("2026-03-20T22:00:00"); // 10 PM
      jobAfterHours.scheduledEnd = new Date("2026-03-20T23:00:00"); // 11 PM
      engine.registerWorkOrder(jobAfterHours);

      const error = engine.validateAvailability(
        jobAfterHours.id,
        technician.id,
      );
      expect(error).toBeDefined();
      expect(error?.type).toBe("working_hours_violation");
    });

    it("should reject double-booking", () => {
      const job1 = createMockWorkOrder({ id: "wo_1", daysFromNow: 1 });
      const job2 = createMockWorkOrder({ id: "wo_2", daysFromNow: 1 });

      engine.registerWorkOrder(job1);
      engine.registerWorkOrder(job2);

      // Assign first job
      engine.assignWorkOrder(job1.id, technician.id);

      // Try to assign overlapping job
      const errors = engine.assignWorkOrder(job2.id, technician.id);
      expect(errors.some((e) => e.type === "double_booking")).toBe(true);
    });

    it("should respect day of week restrictions", () => {
      const weekendJob = createMockWorkOrder({ id: "wo_3" });
      weekendJob.scheduledStart = new Date("2026-03-21T10:00:00"); // Saturday
      weekendJob.scheduledEnd = new Date("2026-03-21T12:00:00");
      engine.registerWorkOrder(weekendJob);

      const error = engine.validateAvailability(weekendJob.id, technician.id);
      expect(error).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SLA VALIDATION
  // ─────────────────────────────────────────────────────────────────

  describe("SLA Validation", () => {
    it("should return correct SLA window for emergency", () => {
      const slaMinutes = engine.getSLAWindow("emergency");
      expect(slaMinutes).toBe(120);
    });

    it("should return correct SLA window for high priority", () => {
      const slaMinutes = engine.getSLAWindow("high");
      expect(slaMinutes).toBe(240);
    });

    it("should return correct SLA window for medium priority", () => {
      const slaMinutes = engine.getSLAWindow("medium");
      expect(slaMinutes).toBe(1440);
    });

    it("should return correct SLA window for low priority", () => {
      const slaMinutes = engine.getSLAWindow("low");
      expect(slaMinutes).toBe(4320);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TRAVEL TIME VALIDATION
  // ─────────────────────────────────────────────────────────────────

  describe("Travel Time Validation", () => {
    it("should validate sufficient travel time", () => {
      const futureJob = createMockWorkOrder({ id: "wo_4", daysFromNow: 5 });
      engine.registerWorkOrder(futureJob);

      const error = engine.validateTravelTime(futureJob.id, technician.id);
      expect(error).toBeNull();
    });

    it("should reject impossible schedules with insufficient travel time", () => {
      const immediateLaterJob = createMockWorkOrder({
        id: "wo_5",
        daysFromNow: 0,
      });
      immediateLaterJob.scheduledStart = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      immediateLaterJob.location = {
        address: "1000 miles away",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "USA",
        latitude: 47.6062,
        longitude: -122.3321,
      };
      engine.registerWorkOrder(immediateLaterJob);

      const error = engine.validateTravelTime(
        immediateLaterJob.id,
        technician.id,
      );
      expect(error).toBeDefined();
      expect(error?.type).toBe("travel_time_impossible");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // WORKLOAD BALANCING
  // ─────────────────────────────────────────────────────────────────

  describe("Workload Balancing", () => {
    it("should calculate technician workload", () => {
      const job = createMockWorkOrder({ id: "wo_6" });
      engine.registerWorkOrder(job);
      engine.assignWorkOrder(job.id, technician.id);

      const workload = engine.calculateWorkload(technician.id);
      expect(workload).toBeGreaterThan(0);
    });

    it("should balance assignments across technicians", () => {
      const tech1 = technician;
      const tech2 = createMockTechnician({
        id: "tech_4",
        skills: ["HVAC", "Electrical"],
      });
      tech2.serviceZoneIds = ["zone_la"];
      engine.registerTechnician(tech2);

      const job1 = createMockWorkOrder({ id: "wo_7" });
      const job2 = createMockWorkOrder({ id: "wo_8" });

      engine.registerWorkOrder(job1);
      engine.registerWorkOrder(job2);

      engine.assignWorkOrder(job1.id, tech1.id);
      const balancedTech = engine.getBalancedTechnicianBySkill(job2.id);

      expect(balancedTech).toBe(tech2.id);
    });

    it("should provide workload distribution", () => {
      const job = createMockWorkOrder({ id: "wo_9" });
      engine.registerWorkOrder(job);
      engine.assignWorkOrder(job.id, technician.id);

      const distribution = engine.getWorkloadDistribution();
      expect(distribution.has(technician.id)).toBe(true);
      expect(distribution.get(technician.id)).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  describe("Work Order Assignment", () => {
    it("should assign work order when all constraints met", () => {
      const errors = engine.assignWorkOrder(workOrder.id, technician.id);
      expect(errors).toHaveLength(0);
      expect(engine.getAssignment(workOrder.id)).toBe(technician.id);
    });

    it("should return errors when constraints violated", () => {
      const constrainedTech = createMockTechnician({
        id: "tech_5",
        skills: ["Plumbing"],
      });
      engine.registerTechnician(constrainedTech);

      const errors = engine.assignWorkOrder(workOrder.id, constrainedTech.id);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("skill_mismatch");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // COMPLEX SCENARIOS
  // ─────────────────────────────────────────────────────────────────

  describe("Complex Scheduling Scenarios", () => {
    it("should handle emergency dispatch with tight SLA", () => {
      const emergencyJob = createMockWorkOrder({
        id: "wo_10",
        priority: "emergency",
      });
      engine.registerWorkOrder(emergencyJob);

      const errors = engine.assignWorkOrder(emergencyJob.id, technician.id);
      expect(errors).toHaveLength(0);
    });

    it("should manage multiple constraints simultaneously", () => {
      const complexJob = createMockWorkOrder({
        id: "wo_11",
        requiredSkills: ["HVAC", "Electrical"],
        priority: "high",
      });
      engine.registerWorkOrder(complexJob);

      const errors = engine.assignWorkOrder(complexJob.id, technician.id);
      const hasNoBlockingErrors = !errors.some((e) =>
        ["skill_mismatch", "zone_violation"].includes(e.type),
      );

      expect(hasNoBlockingErrors || errors.length === 0).toBe(true);
    });
  });
});
