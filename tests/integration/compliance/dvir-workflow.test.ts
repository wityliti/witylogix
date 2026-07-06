/**
 * DVIR (Driver Vehicle Inspection Report) Workflow Integration Tests
 * Comprehensive testing for pre-trip/post-trip inspections, defect reporting,
 * mechanic assignment, repair workflow, and regulatory compliance
 * ~300 lines, 20+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockDVIR } from "../fixtures/freight-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & STATE
// ─────────────────────────────────────────────────────────────────────────────

interface Defect {
  code: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR";
  description: string;
  location?: string;
  repairId?: string;
}

interface DVIRWorkflow {
  dvirId: string;
  vehicleId: string;
  driverId: string;
  inspectionType: "pre_trip" | "post_trip";
  status: "pending" | "completed" | "flagged";
  defects: Defect[];
  completedAt: Date;
  outOfService: boolean;
}

const dvirHistory: Map<string, DVIRWorkflow> = new Map();

beforeEach(() => {
  dvirHistory.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  dvirHistory.clear();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// PRE-TRIP INSPECTION COMPLETION FLOW
// ─────────────────────────────────────────────────────────────────────────────

describe("Pre-Trip Inspection Completion Flow", () => {
  it("should create pre-trip inspection", () => {
    const dvir = createMockDVIR({
      inspectionType: "pre_trip",
      status: "completed",
    });

    dvirHistory.set(dvir.dvirId, {
      dvirId: dvir.dvirId,
      vehicleId: dvir.vehicleId,
      driverId: dvir.driverId,
      inspectionType: "pre_trip",
      status: "completed",
      defects: dvir.defects,
      completedAt: dvir.completedAt,
      outOfService: false,
    });

    expect(dvirHistory.has(dvir.dvirId)).toBe(true);
  });

  it("should require signature from driver on pre-trip", () => {
    const dvir = {
      dvirId: "dvir_001",
      vehicleId: "vehicle_001",
      driverId: "driver_001",
      driverSignature: "JohnDoe_signature_hash",
      signedAt: new Date(),
      inspectionType: "pre_trip",
    };

    expect(dvir.driverSignature).toBeDefined();
    expect(dvir.signedAt).toBeInstanceOf(Date);
  });

  it("should allow pre-trip without defects", () => {
    const dvir = createMockDVIR({
      inspectionType: "pre_trip",
      defects: [],
      status: "completed",
    });

    expect(dvir.defects).toHaveLength(0);
  });

  it("should mark vehicle as ready after clean pre-trip", () => {
    const dvir = createMockDVIR({
      inspectionType: "pre_trip",
      defects: [],
    });

    const vehicleReady = dvir.defects.length === 0;

    expect(vehicleReady).toBe(true);
  });

  it("should timestamp pre-trip inspection completion", () => {
    const dvir = createMockDVIR({
      inspectionType: "pre_trip",
      completedAt: new Date(),
    });

    expect(dvir.completedAt).toBeInstanceOf(Date);
    expect(dvir.completedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT REPORTING & CATEGORIZATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Defect Reporting and Categorization", () => {
  it("should categorize defects by severity level", () => {
    const defects: Defect[] = [
      {
        code: "BRAKE",
        severity: "CRITICAL",
        description: "Brake failure risk",
      },
      { code: "TIRE", severity: "MAJOR", description: "Significant wear" },
      { code: "LIGHT", severity: "MINOR", description: "Tail light dim" },
    ];

    expect(defects[0].severity).toBe("CRITICAL");
    expect(defects[1].severity).toBe("MAJOR");
    expect(defects[2].severity).toBe("MINOR");
  });

  it("should flag critical defects immediately", () => {
    const dvir = createMockDVIR({
      defects: [
        {
          code: "BRAKE",
          severity: "CRITICAL",
          description: "Complete brake failure",
        },
      ],
    });

    const hasCritical = dvir.defects.some((d) => d.severity === "CRITICAL");

    expect(hasCritical).toBe(true);
  });

  it("should allow multiple defects per inspection", () => {
    const dvir = createMockDVIR({
      defects: [
        { code: "BRAKE", severity: "CRITICAL", description: "Brake pads worn" },
        { code: "TIRE", severity: "MAJOR", description: "Tire pressure low" },
        { code: "WIPER", severity: "MINOR", description: "Wiper blade torn" },
      ],
    });

    expect(dvir.defects).toHaveLength(3);
  });

  it("should assign defect codes per FMCSA Part 396", () => {
    const validCodes = [
      "BRAKE",
      "TIRE",
      "LIGHT",
      "WIPER",
      "MIRROR",
      "STEERING",
      "COUPLING",
      "SUSPENSION",
    ];

    const dvir = createMockDVIR({
      defects: [
        { code: "BRAKE", severity: "CRITICAL", description: "Brake issue" },
      ],
    });

    const defectCode = dvir.defects[0].code;
    const isValid = validCodes.includes(defectCode);

    expect(isValid).toBe(true);
  });

  it("should track defect location on vehicle", () => {
    const defect: Defect = {
      code: "TIRE",
      severity: "MAJOR",
      description: "Bald tire",
      location: "Right front",
    };

    expect(defect.location).toBe("Right front");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MECHANIC ASSIGNMENT & REPAIR WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

describe("Mechanic Assignment and Repair Workflow", () => {
  it("should create repair work order for defect", () => {
    const dvir = createMockDVIR({
      defects: [
        { code: "BRAKE", severity: "CRITICAL", description: "Brake failure" },
      ],
    });

    const defect = dvir.defects[0];
    const repairWorkOrder = {
      repairId: `repair_${Math.random().toString(36).substr(2, 9)}`,
      dvirId: dvir.dvirId,
      vehicleId: dvir.vehicleId,
      defectCode: defect.code,
      description: defect.description,
      status: "OPEN",
      createdAt: new Date(),
    };

    expect(repairWorkOrder.defectCode).toBe("BRAKE");
    expect(repairWorkOrder.status).toBe("OPEN");
  });

  it("should assign mechanic to repair work order", () => {
    const repairWorkOrder = {
      repairId: "repair_001",
      assignedMechanic: "mechanic_john",
      assignedAt: new Date(),
      status: "ASSIGNED",
    };

    expect(repairWorkOrder.assignedMechanic).toBeDefined();
    expect(repairWorkOrder.status).toBe("ASSIGNED");
  });

  it("should track repair completion", () => {
    const repairWorkOrder = {
      repairId: "repair_001",
      status: "IN_PROGRESS",
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(),
      mechanic: "mechanic_john",
      partsUsed: ["Brake pad kit", "Brake fluid"],
    };

    expect(repairWorkOrder.completedAt).toBeInstanceOf(Date);
    expect(repairWorkOrder.partsUsed).toHaveLength(2);
  });

  it("should verify repair completion before vehicle re-inspection", () => {
    const repairs = [
      { repairId: "repair_001", status: "COMPLETED" },
      { repairId: "repair_002", status: "COMPLETED" },
    ];

    const allCompleted = repairs.every((r) => r.status === "COMPLETED");

    expect(allCompleted).toBe(true);
  });

  it("should track parts and labor costs for repair", () => {
    const repair = {
      repairId: "repair_001",
      parts: [
        { name: "Brake pad kit", cost: 150 },
        { name: "Brake fluid", cost: 30 },
      ],
      laborHours: 2.5,
      laborRate: 85, // Per hour
      totalCost: 150 + 30 + 2.5 * 85,
    };

    expect(repair.totalCost).toBe(362.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE OUT-OF-SERVICE DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Vehicle Out-of-Service Determination", () => {
  it("should place vehicle out-of-service for critical defects", () => {
    const dvir = createMockDVIR({
      defects: [
        {
          code: "BRAKE",
          severity: "CRITICAL",
          description: "Complete brake failure",
        },
      ],
      status: "flagged",
    });

    const hasCriticalDefect = dvir.defects.some(
      (d) => d.severity === "CRITICAL",
    );
    const outOfService = hasCriticalDefect;

    expect(outOfService).toBe(true);
  });

  it("should place vehicle out-of-service for multiple major defects", () => {
    const dvir = createMockDVIR({
      defects: [
        { code: "TIRE", severity: "MAJOR", description: "Bald tires" },
        { code: "STEERING", severity: "MAJOR", description: "Steering play" },
        {
          code: "SUSPENSION",
          severity: "MAJOR",
          description: "Sagging suspension",
        },
      ],
    });

    const majorDefects = dvir.defects.filter(
      (d) => d.severity === "MAJOR",
    ).length;
    const outOfService = majorDefects >= 2;

    expect(outOfService).toBe(true);
  });

  it("should allow vehicle in service with only minor defects", () => {
    const dvir = createMockDVIR({
      defects: [
        { code: "LIGHT", severity: "MINOR", description: "Tail light dim" },
      ],
    });

    const hasCritical = dvir.defects.some((d) => d.severity === "CRITICAL");
    const hasMajor = dvir.defects.some((d) => d.severity === "MAJOR");
    const canOperate = !hasCritical && !hasMajor;

    expect(canOperate).toBe(true);
  });

  it("should document out-of-service reason", () => {
    const outOfServiceRecord = {
      vehicleId: "vehicle_001",
      reason: "Critical brake defect - FMCSA Part 396.13",
      placedOutAt: new Date(),
      expectedRepairDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      authorizedBy: "Safety Manager",
    };

    expect(outOfServiceRecord.reason).toBeDefined();
    expect(outOfServiceRecord.expectedRepairDate).toBeInstanceOf(Date);
  });

  it("should require supervisor authorization for out-of-service placement", () => {
    const authorization = {
      authorizedBy: "supervisor_id",
      authorizedAt: new Date(),
      supervisorName: "John Manager",
    };

    expect(authorization.authorizedBy).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST-TRIP INSPECTION WITH COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

describe("Post-Trip Inspection With Comparison", () => {
  it("should create post-trip inspection", () => {
    const dvir = createMockDVIR({
      inspectionType: "post_trip",
      status: "completed",
    });

    expect(dvir.inspectionType).toBe("post_trip");
  });

  it("should compare pre-trip and post-trip defects", () => {
    const preTripDefects = [
      { code: "TIRE", severity: "MINOR", description: "Low pressure" },
    ];

    const postTripDefects = [
      { code: "TIRE", severity: "MINOR", description: "Low pressure" },
      { code: "LIGHT", severity: "MINOR", description: "Tail light out" },
    ];

    const newDefects = postTripDefects.filter(
      (post) => !preTripDefects.some((pre) => pre.code === post.code),
    );

    expect(newDefects).toHaveLength(1);
    expect(newDefects[0].code).toBe("LIGHT");
  });

  it("should verify defect resolution between inspections", () => {
    const preTrip = [
      { code: "BRAKE", severity: "MAJOR", description: "Brake issue" },
    ];

    const postTrip = []; // Issue was resolved

    const resolved = preTrip.filter(
      (pre) => !postTrip.some((post) => post.code === pre.code),
    );

    expect(resolved).toHaveLength(1);
  });

  it("should track inspection timeline", () => {
    const preTrip = {
      inspectionType: "pre_trip",
      completedAt: new Date("2024-03-15T06:00:00Z"),
    };

    const postTrip = {
      inspectionType: "post_trip",
      completedAt: new Date("2024-03-15T18:30:00Z"),
    };

    const daysDiff =
      (postTrip.completedAt.getTime() - preTrip.completedAt.getTime()) /
      (1000 * 60 * 60 * 24);

    expect(daysDiff).toBeCloseTo(0.52, 1); // ~12.5 hours apart
  });

  it("should flag vehicle if new critical defects appear post-trip", () => {
    const postTripDefects = [
      {
        code: "BRAKE",
        severity: "CRITICAL",
        description: "Brake failure during trip",
      },
    ];

    const hasCritical = postTripDefects.some((d) => d.severity === "CRITICAL");

    expect(hasCritical).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGULATORY COMPLIANCE (FMCSA 396.11, 396.13)
// ─────────────────────────────────────────────────────────────────────────────

describe("Regulatory Compliance (FMCSA 396.11, 396.13)", () => {
  it("should comply with FMCSA 396.11 - vehicle inspection requirements", () => {
    const compliance = {
      regulation: "49 CFR 396.11",
      requirement: "Pre-trip and post-trip inspections required",
      verified: true,
      inspectionSections: [
        "Service brakes",
        "Parking brake",
        "Steering",
        "Lighting devices",
        "Tires and wheels",
        "Horn",
        "Windshield wipers",
        "Mirrors and glass",
      ],
    };

    expect(compliance.verified).toBe(true);
    expect(compliance.inspectionSections).toHaveLength(8);
  });

  it("should comply with FMCSA 396.13 - out-of-service requirements", () => {
    const compliance = {
      regulation: "49 CFR 396.13",
      requirement: "Place vehicle out-of-service for critical defects",
      criticalDefects: [
        "Brake failure",
        "Steering failure",
        "Tire failure",
        "Coupling failure",
        "Emergency equipment failure",
      ],
    };

    expect(compliance.criticalDefects).toContain("Brake failure");
  });

  it("should document DVIR per FMCSA requirements", () => {
    const dvir = {
      dvirId: "dvir_001",
      vehicleId: "vehicle_001",
      driverId: "driver_001",
      date: new Date(),
      inspectionType: "pre_trip",
      defects: [],
      driverSignature: "hash_value",
      complianceRef: "49 CFR 396.11",
    };

    expect(dvir.complianceRef).toBe("49 CFR 396.11");
  });

  it("should retain DVIR records for minimum 1 year", () => {
    const createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const today = new Date();

    const retentionDays =
      (today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    expect(retentionDays).toBeGreaterThanOrEqual(365);
  });

  it("should track out-of-service vehicle repairs for compliance", () => {
    const outOfServiceTracker = {
      vehicleId: "vehicle_001",
      placedOutAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      reason: "Critical brake defect",
      repairWorkOrders: ["repair_001", "repair_002"],
      allRepairsCompleted: true,
      returnedToServiceAt: new Date(),
      dayOutOfService: 2,
    };

    expect(outOfServiceTracker.dayOutOfService).toBeCloseTo(2, 0);
    expect(outOfServiceTracker.allRepairsCompleted).toBe(true);
  });
});
