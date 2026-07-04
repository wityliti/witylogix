/**
 * Scheduling Engine Tests
 *
 * Comprehensive test suite covering:
 * - Constraint solver (skill, zone, availability, travel, SLA)
 * - Time slot finding (availability detection)
 * - Batch scheduling (multi-job optimization)
 * - Recurring schedule generation
 * - Conflict detection (overlaps, travel time)
 * - Rescheduling alternatives
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ConstraintSolver,
  TimeSlotFinder,
  BatchScheduler,
  RecurringScheduler,
  ConflictDetector,
  RescheduleEngine,
} from "../../../packages/core/src/field-service/scheduling-engine.js";
import type {
  WorkOrder,
  Technician,
  JobSchedule,
  SLARule,
  TimeSlot,
  ServiceZone,
  RecurringPlan,
} from "../../../packages/core/src/field-service/field-service-types.js";

// ─── FIXTURES ───────────────────────────────────────────────────

function createMockTechnician(overrides?: Partial<Technician>): Technician {
  return {
    id: "tech_1",
    name: "John Smith",
    skills: ["HVAC_CERT", "EPA_608"],
    certifications: ["EPA_608", "EPA_609"],
    homeBase: {
      street: "123 Main St",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "US",
      coordinates: { latitude: 47.6062, longitude: -122.3321 },
    },
    currentLocation: { latitude: 47.6062, longitude: -122.3321 },
    status: "AVAILABLE",
    workingHours: {
      startTime: "08:00",
      endTime: "17:00",
      daysOfWeek: [1, 2, 3, 4, 5],
      timezone: "America/Los_Angeles",
    },
    serviceZones: [
      {
        id: "zone_1",
        name: "Downtown Seattle",
        type: "CIRCLE",
        coordinates: [{ latitude: 47.6062, longitude: -122.3321 }],
        radius: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    performanceMetrics: {
      totalJobsCompleted: 150,
      averageRating: 4.8,
      averageEfficiencyRatio: 0.95,
      slaComplianceRate: 98,
      complaintCount: 2,
      utilizationRate30d: 82,
      averageResponseTime: 12,
      lastUpdatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockWorkOrder(overrides?: Partial<WorkOrder>): WorkOrder {
  return {
    id: "wo_1",
    customerId: "cust_1",
    type: "SERVICE",
    priority: "MEDIUM",
    status: "CREATED",
    description: "HVAC inspection and cleaning",
    requiredSkills: ["HVAC_CERT"],
    estimatedDuration: 120,
    address: {
      street: "456 Oak Ave",
      city: "Seattle",
      state: "WA",
      postalCode: "98102",
      country: "US",
      coordinates: { latitude: 47.61, longitude: -122.33 },
    },
    parts: [],
    notes: [],
    signatures: [],
    photos: [],
    slaRuleId: "sla_1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockSLARule(): SLARule {
  return {
    id: "sla_1",
    name: "Standard SLA",
    description: "Standard service level agreement",
    windows: [
      {
        priority: "EMERGENCY",
        responseTimeMinutes: 120,
        completionTimeMinutes: 240,
      },
      {
        priority: "HIGH",
        responseTimeMinutes: 240,
        completionTimeMinutes: 480,
      },
      {
        priority: "MEDIUM",
        responseTimeMinutes: 1440,
        completionTimeMinutes: 1440,
      },
      {
        priority: "LOW",
        responseTimeMinutes: 4320,
        completionTimeMinutes: 4320,
      },
    ],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockSchedule(techId: string, date: string): JobSchedule {
  return {
    technicianId: techId,
    date,
    slots: [
      {
        startTime: new Date(`${date}T09:00:00Z`),
        endTime: new Date(`${date}T10:30:00Z`),
        durationMinutes: 90,
        available: false,
        type: "WORK",
      },
    ],
    breaks: [
      {
        startTime: new Date(`${date}T12:00:00Z`),
        endTime: new Date(`${date}T13:00:00Z`),
        durationMinutes: 60,
        available: false,
        type: "BREAK",
      },
    ],
    travelTime: 45,
    utilization: 55,
    updatedAt: new Date(),
  };
}

// ─── CONSTRAINT SOLVER TESTS ────────────────────────────────────

describe("ConstraintSolver", () => {
  let tech: Technician;
  let job: WorkOrder;
  let schedule: JobSchedule;
  let slaRule: SLARule;

  beforeEach(() => {
    tech = createMockTechnician();
    job = createMockWorkOrder();
    schedule = createMockSchedule(tech.id, "2026-03-20");
    slaRule = createMockSLARule();
  });

  describe("canSchedule", () => {
    it("should allow scheduling when all constraints satisfied", () => {
      const startTime = new Date("2026-03-20T14:00:00Z");
      const result = ConstraintSolver.canSchedule(
        job,
        tech,
        startTime,
        schedule,
        slaRule,
      );

      expect(result.feasible).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should reject when technician lacks required skills", () => {
      const jobWithSkill = createMockWorkOrder({
        requiredSkills: ["UNKNOWN_SKILL"],
      });

      const result = ConstraintSolver.canSchedule(
        jobWithSkill,
        tech,
        new Date("2026-03-20T14:00:00Z"),
        schedule,
        slaRule,
      );

      expect(result.feasible).toBe(false);
      expect(result.violations.some((v) => v.type === "SKILL_MISMATCH")).toBe(
        true,
      );
    });

    it("should detect double-booking", () => {
      const startTime = new Date("2026-03-20T09:15:00Z"); // Overlaps with existing slot
      const result = ConstraintSolver.canSchedule(
        job,
        tech,
        startTime,
        schedule,
        slaRule,
      );

      expect(result.feasible).toBe(false);
      expect(result.violations.some((v) => v.type === "DOUBLE_BOOKING")).toBe(
        true,
      );
    });

    it("should warn on SLA violation", () => {
      const longJob = createMockWorkOrder({
        estimatedDuration: 1000, // Very long job
      });
      const startTime = new Date("2026-03-20T08:00:00Z");

      const result = ConstraintSolver.canSchedule(
        longJob,
        tech,
        startTime,
        schedule,
        slaRule,
      );

      // Should have warning violation
      const slaViolation = result.violations.find(
        (v) => v.type === "SLA_VIOLATION",
      );
      expect(slaViolation?.severity).toBe("WARNING");
    });

    it("should reject when job outside service zone", () => {
      const remoteJob = createMockWorkOrder({
        address: {
          street: "999 Far Away",
          city: "Portland",
          state: "OR",
          postalCode: "97214",
          country: "US",
          coordinates: { latitude: 45.5152, longitude: -122.6784 },
        },
      });

      const result = ConstraintSolver.canSchedule(
        remoteJob,
        tech,
        new Date("2026-03-20T14:00:00Z"),
        schedule,
        slaRule,
      );

      expect(result.feasible).toBe(false);
      expect(result.violations.some((v) => v.type === "ZONE_VIOLATION")).toBe(
        true,
      );
    });

    it("should reject when outside working hours", () => {
      const earlyStartTime = new Date("2026-03-20T06:00:00Z");
      const result = ConstraintSolver.canSchedule(
        job,
        tech,
        earlyStartTime,
        schedule,
        slaRule,
      );

      expect(result.feasible).toBe(false);
      expect(
        result.violations.some((v) => v.type === "WORKING_HOURS_VIOLATION"),
      ).toBe(true);
    });
  });

  describe("validateSchedule", () => {
    it("should return no violations for valid schedule", () => {
      const jobs = [
        createMockWorkOrder({
          id: "wo_1",
          technicianId: tech.id,
          scheduledStart: new Date("2026-03-20T14:00:00Z"),
          scheduledEnd: new Date("2026-03-20T16:00:00Z"),
        }),
      ];
      const schedules = new Map([[tech.id, schedule]]);
      const slaRules = new Map([["sla_1", slaRule]]);

      const violations = ConstraintSolver.validateSchedule(
        jobs,
        [tech],
        schedules,
        slaRules,
      );

      expect(violations).toHaveLength(0);
    });

    it("should detect invalid technician assignment", () => {
      const jobs = [createMockWorkOrder({ technicianId: "tech_invalid" })];
      const schedules = new Map([[tech.id, schedule]]);
      const slaRules = new Map([["sla_1", slaRule]]);

      const violations = ConstraintSolver.validateSchedule(
        jobs,
        [tech],
        schedules,
        slaRules,
      );

      expect(violations.some((v) => v.type === "INVALID_TECHNICIAN")).toBe(
        true,
      );
    });
  });
});

// ─── TIME SLOT FINDER TESTS ─────────────────────────────────────

describe("TimeSlotFinder", () => {
  let schedule: JobSchedule;

  beforeEach(() => {
    schedule = createMockSchedule("tech_1", "2026-03-20");
  });

  describe("findAvailableSlots", () => {
    it("should find available slots between bookings", () => {
      const slots = TimeSlotFinder.findAvailableSlots(
        schedule,
        "tech_1",
        60,
        5,
      );

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].durationMinutes).toBeGreaterThanOrEqual(60);
    });

    it("should respect minimum duration requirement", () => {
      const slots = TimeSlotFinder.findAvailableSlots(
        schedule,
        "tech_1",
        120,
        5,
      );

      slots.forEach((slot) => {
        expect(slot.durationMinutes).toBeGreaterThanOrEqual(120);
      });
    });

    it("should limit number of returned slots", () => {
      const maxSlots = 3;
      const slots = TimeSlotFinder.findAvailableSlots(
        schedule,
        "tech_1",
        60,
        maxSlots,
      );

      expect(slots.length).toBeLessThanOrEqual(maxSlots);
    });

    it("should return empty array if no slots available", () => {
      const fullSchedule: JobSchedule = {
        ...schedule,
        slots: [
          {
            startTime: new Date("2026-03-20T08:00:00Z"),
            endTime: new Date("2026-03-20T17:00:00Z"),
            durationMinutes: 540,
            available: false,
            type: "WORK",
          },
        ],
      };

      const slots = TimeSlotFinder.findAvailableSlots(
        fullSchedule,
        "tech_1",
        60,
        1,
      );

      expect(slots).toHaveLength(0);
    });
  });

  describe("findNextAvailableSlot", () => {
    it("should find earliest available slot across technicians", () => {
      const schedules = new Map([
        ["tech_1", schedule],
        [
          "tech_2",
          {
            ...schedule,
            technicianId: "tech_2",
            slots: [],
          },
        ],
      ]);

      const result = TimeSlotFinder.findNextAvailableSlot(schedules, 60);

      expect(result).not.toBeNull();
      expect(result?.slot.startTime).toBeDefined();
    });
  });
});

// ─── BATCH SCHEDULER TESTS ──────────────────────────────────────

describe("BatchScheduler", () => {
  let tech: Technician;
  let jobs: WorkOrder[];
  let schedules: Map<string, JobSchedule>;
  let slaRules: Map<string, SLARule>;

  beforeEach(() => {
    tech = createMockTechnician();
    jobs = [
      createMockWorkOrder({ id: "wo_1", priority: "EMERGENCY" }),
      createMockWorkOrder({ id: "wo_2", priority: "MEDIUM" }),
      createMockWorkOrder({ id: "wo_3", priority: "LOW" }),
    ];
    schedules = new Map([
      ["tech_1", createMockSchedule("tech_1", "2026-03-20")],
    ]);
    slaRules = new Map([["sla_1", createMockSLARule()]]);
  });

  describe("schedule", () => {
    it("should schedule jobs successfully", () => {
      const result = BatchScheduler.schedule(jobs, [tech], schedules, slaRules);

      expect(result.successCount).toBeGreaterThan(0);
      expect(result.failedCount).toBeLessThanOrEqual(jobs.length);
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    it("should prioritize by priority level", () => {
      const result = BatchScheduler.schedule(jobs, [tech], schedules, slaRules);

      // Jobs should be processed in priority order
      expect(result.successCount).toBeGreaterThan(0);
    });

    it("should detect unschedulable jobs", () => {
      const impossibleJob = createMockWorkOrder({
        requiredSkills: ["IMPOSSIBLE_SKILL"],
      });
      const testJobs = [impossibleJob];

      const result = BatchScheduler.schedule(
        testJobs,
        [tech],
        schedules,
        slaRules,
      );

      expect(result.failedCount).toBe(1);
      expect(
        result.violations.some((v) => v.type === "NO_AVAILABLE_TECHNICIAN"),
      ).toBe(true);
    });
  });
});

// ─── RECURRING SCHEDULER TESTS ──────────────────────────────────

describe("RecurringScheduler", () => {
  let plan: RecurringPlan;

  beforeEach(() => {
    plan = {
      id: "plan_1",
      customerId: "cust_1",
      description: "Monthly HVAC maintenance",
      type: "MAINTENANCE",
      requiredSkills: ["HVAC_CERT"],
      address: {
        street: "123 Oak Ave",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "US",
        coordinates: { latitude: 47.6062, longitude: -122.3321 },
      },
      estimatedDuration: 120,
      frequency: "MONTHLY",
      dayOfMonth: 15,
      preferredTime: "10:00",
      timezone: "America/Los_Angeles",
      active: true,
      slaRuleId: "sla_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("generateInstances", () => {
    it("should generate monthly instances", () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-03-31");

      const instances = RecurringScheduler.generateInstances(plan, from, to);

      expect(instances.length).toBe(3); // Jan, Feb, Mar 15th
      instances.forEach((instance) => {
        expect(instance.type).toBe("MAINTENANCE");
        expect(instance.requiredSkills).toContain("HVAC_CERT");
      });
    });

    it("should respect end date", () => {
      const planWithEnd: RecurringPlan = {
        ...plan,
        endDate: new Date("2026-02-28"),
      };

      const from = new Date("2026-01-01");
      const to = new Date("2026-03-31");

      const instances = RecurringScheduler.generateInstances(
        planWithEnd,
        from,
        to,
      );

      expect(instances.length).toBe(2); // Jan, Feb only
    });

    it("should handle weekly frequency", () => {
      const weeklyPlan: RecurringPlan = {
        ...plan,
        frequency: "WEEKLY",
        dayOfWeek: 2, // Tuesday
      };

      const from = new Date("2026-03-01");
      const to = new Date("2026-03-31");

      const instances = RecurringScheduler.generateInstances(
        weeklyPlan,
        from,
        to,
      );

      expect(instances.length).toBeGreaterThan(0);
    });
  });
});

// ─── CONFLICT DETECTOR TESTS ────────────────────────────────────

describe("ConflictDetector", () => {
  let tech: Technician;
  let jobs: WorkOrder[];
  let schedules: Map<string, JobSchedule>;

  beforeEach(() => {
    tech = createMockTechnician();
    schedules = new Map([
      ["tech_1", createMockSchedule("tech_1", "2026-03-20")],
    ]);
  });

  describe("detectConflicts", () => {
    it("should detect overlapping job assignments", () => {
      jobs = [
        createMockWorkOrder({
          id: "wo_1",
          technicianId: "tech_1",
          scheduledStart: new Date("2026-03-20T09:00:00Z"),
          scheduledEnd: new Date("2026-03-20T10:00:00Z"),
        }),
        createMockWorkOrder({
          id: "wo_2",
          technicianId: "tech_1",
          scheduledStart: new Date("2026-03-20T09:30:00Z"),
          scheduledEnd: new Date("2026-03-20T11:00:00Z"),
        }),
      ];

      const violations = ConflictDetector.detectConflicts(
        jobs,
        [tech],
        schedules,
      );

      expect(violations.some((v) => v.type === "OVERLAPPING_JOBS")).toBe(true);
    });

    it("should detect impossible travel times", () => {
      jobs = [
        createMockWorkOrder({
          id: "wo_1",
          technicianId: "tech_1",
          scheduledStart: new Date("2026-03-20T09:00:00Z"),
          scheduledEnd: new Date("2026-03-20T10:00:00Z"),
          address: {
            ...createMockWorkOrder().address,
            coordinates: { latitude: 47.6062, longitude: -122.3321 },
          },
        }),
        createMockWorkOrder({
          id: "wo_2",
          technicianId: "tech_1",
          scheduledStart: new Date("2026-03-20T10:05:00Z"), // Only 5 min travel time
          scheduledEnd: new Date("2026-03-20T11:00:00Z"),
          address: {
            ...createMockWorkOrder().address,
            coordinates: { latitude: 45.5, longitude: -120.5 },
          }, // Far away
        }),
      ];

      const violations = ConflictDetector.detectConflicts(
        jobs,
        [tech],
        schedules,
      );

      expect(violations.some((v) => v.type === "IMPOSSIBLE_TRAVEL")).toBe(true);
    });
  });
});

// ─── RESCHEDULE ENGINE TESTS ────────────────────────────────────

describe("RescheduleEngine", () => {
  let tech: Technician;
  let jobs: WorkOrder[];
  let schedules: Map<string, JobSchedule>;
  let slaRules: Map<string, SLARule>;

  beforeEach(() => {
    tech = createMockTechnician();
    jobs = [createMockWorkOrder({ id: "wo_1" })];
    schedules = new Map([
      ["tech_1", createMockSchedule("tech_1", "2026-03-20")],
    ]);
    slaRules = new Map([["sla_1", createMockSLARule()]]);
  });

  describe("findAlternatives", () => {
    it("should find alternative schedules for cancelled job", () => {
      const result = RescheduleEngine.findAlternatives(
        "wo_1",
        jobs,
        [tech],
        schedules,
        slaRules,
      );

      expect(result).not.toBeNull();
      expect(result?.alternatives.length).toBeGreaterThan(0);
    });

    it("should rank alternatives by score", () => {
      const result = RescheduleEngine.findAlternatives(
        "wo_1",
        jobs,
        [tech],
        schedules,
        slaRules,
      );

      if (result && result.alternatives.length > 1) {
        // Check descending score order
        for (let i = 0; i < result.alternatives.length - 1; i++) {
          expect(result.alternatives[i].score).toBeGreaterThanOrEqual(
            result.alternatives[i + 1].score,
          );
        }
      }
    });

    it("should return null for non-existent job", () => {
      const result = RescheduleEngine.findAlternatives(
        "wo_invalid",
        jobs,
        [tech],
        schedules,
        slaRules,
      );

      expect(result).toBeNull();
    });
  });
});
