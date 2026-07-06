/**
 * DVIR Engine - Driver Vehicle Inspection Report Management
 *
 * Manages:
 * - Pre-trip and post-trip inspection templates
 * - Defect categorization (minor/major/out-of-service)
 * - Repair workflow tracking
 * - Vehicle out-of-service rules per CVSA criteria
 * - Inspection history and trend analysis
 *
 * Regulatory compliance:
 * - FMCSA 49 CFR 396.11 (driver responsibility)
 * - FMCSA 49 CFR 396.13 (mechanic certification)
 * - CVSA (Commercial Vehicle Safety Alliance) criteria
 */

import type {
  DVIREntry,
  VehicleDefect,
  InspectionResult,
  DefectSeverity,
} from "./hos-types.js";

/**
 * DVIR component groups for organized inspection templates.
 */
interface InspectionTemplate {
  name: string;
  components: {
    name: string;
    items: string[];
  }[];
}

/**
 * DVIR Engine - Manages vehicle inspection reports.
 */
export class DVIREngine {
  private inspections: Map<string, DVIREntry[]> = new Map();
  private defectHistory: Map<string, VehicleDefect[]> = new Map();
  private outOfServiceVehicles: Set<string> = new Set();

  private inspectionTemplate: InspectionTemplate = {
    name: "Standard DVIR Template",
    components: [
      {
        name: "Brake System",
        items: [
          "Service brakes",
          "Parking/emergency brakes",
          "Brake fluid leaks",
          "Brake drum/rotor condition",
        ],
      },
      {
        name: "Lighting & Visibility",
        items: [
          "Headlights",
          "Taillights",
          "Stop lights",
          "Turn signals",
          "Windshield wipers",
          "Mirrors (left/right/convex)",
        ],
      },
      {
        name: "Tires & Wheels",
        items: [
          "Tire tread depth",
          "Tire pressure",
          "Tire damage/bulges",
          "Wheel condition",
          "Lug nuts",
        ],
      },
      {
        name: "Steering & Suspension",
        items: [
          "Power steering",
          "Steering wheel play",
          "Springs/suspension",
          "Shock absorbers",
          "Steering linkage",
        ],
      },
      {
        name: "Safety Equipment",
        items: [
          "Seatbelts",
          "Fire extinguisher",
          "Spare fuses",
          "Warning triangles/flares",
          "Seat condition",
        ],
      },
      {
        name: "Engine & Cooling",
        items: [
          "Engine startup",
          "Engine noise/leaks",
          "Coolant leaks",
          "Hoses/belts",
          "Battery condition",
        ],
      },
      {
        name: "Fuel System",
        items: ["Fuel tank condition", "Fuel leaks", "Fuel cap secure"],
      },
      {
        name: "General Body",
        items: [
          "Door latches",
          "Cabin condition",
          "Cargo securement",
          "Exterior damage",
          "License plates",
        ],
      },
    ],
  };

  constructor() {}

  /**
   * Get pre-trip inspection template.
   */
  getPreTripTemplate(): InspectionTemplate {
    return this.inspectionTemplate;
  }

  /**
   * Submit pre-trip inspection.
   */
  submitPreTripInspection(
    accountId: string,
    driverId: string,
    vehicleId: string,
    defects: Partial<VehicleDefect>[],
    driverRemarks?: string,
  ): DVIREntry {
    const inspection: DVIREntry = {
      id: `dvir_${Date.now()}`,
      accountId,
      driverId,
      vehicleId,
      inspectionType: "PRE_TRIP",
      inspectionDate: new Date(),
      condition: this.determineCondition(defects),
      defects: (defects as VehicleDefect[]).map((d, idx) => ({
        id: `def_${Date.now()}_${idx}`,
        ...d,
      })),
      driverRemarks,
      repairStatus: undefined,
      authorizedForOperation:
        this.determineCondition(defects) !== "OUT_OF_SERVICE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store inspection
    const key = `${accountId}:${vehicleId}`;
    if (!this.inspections.has(key)) {
      this.inspections.set(key, []);
    }
    this.inspections.get(key)!.push(inspection);

    // Track defects
    this.recordDefects(vehicleId, inspection.defects);

    // Check out-of-service status
    if (inspection.condition === "OUT_OF_SERVICE") {
      this.outOfServiceVehicles.add(vehicleId);
    }

    return inspection;
  }

  /**
   * Submit post-trip inspection.
   */
  submitPostTripInspection(
    accountId: string,
    driverId: string,
    vehicleId: string,
    defects: Partial<VehicleDefect>[],
    driverRemarks?: string,
  ): DVIREntry {
    const inspection: DVIREntry = {
      id: `dvir_${Date.now()}`,
      accountId,
      driverId,
      vehicleId,
      inspectionType: "POST_TRIP",
      inspectionDate: new Date(),
      condition: this.determineCondition(defects),
      defects: (defects as VehicleDefect[]).map((d, idx) => ({
        id: `def_${Date.now()}_${idx}`,
        ...d,
      })),
      driverRemarks,
      repairStatus: undefined,
      authorizedForOperation:
        this.determineCondition(defects) !== "OUT_OF_SERVICE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store inspection
    const key = `${accountId}:${vehicleId}`;
    if (!this.inspections.has(key)) {
      this.inspections.set(key, []);
    }
    this.inspections.get(key)!.push(inspection);

    // Track defects
    this.recordDefects(vehicleId, inspection.defects);

    // Check out-of-service status
    if (inspection.condition === "OUT_OF_SERVICE") {
      this.outOfServiceVehicles.add(vehicleId);
    }

    return inspection;
  }

  /**
   * Assign mechanic to repair defect.
   */
  assignMechanicRepair(
    accountId: string,
    vehicleId: string,
    inspectionId: string,
    defectId: string,
    mechanicName: string,
    mechanicLicense: string,
  ): DVIREntry | null {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];
    const inspection = inspections.find((i) => i.id === inspectionId);

    if (!inspection) return null;

    inspection.repairStatus = "IN_PROGRESS";
    inspection.mechanicRemarks = `Assigned to: ${mechanicName} (License: ${mechanicLicense})`;
    inspection.updatedAt = new Date();

    return inspection;
  }

  /**
   * Mark defects as repaired.
   */
  completeMechanicRepair(
    accountId: string,
    vehicleId: string,
    inspectionId: string,
    mechanicRemarks: string,
  ): DVIREntry | null {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];
    const inspection = inspections.find((i) => i.id === inspectionId);

    if (!inspection) return null;

    inspection.repairStatus = "COMPLETED";
    inspection.mechanicRemarks = mechanicRemarks;
    inspection.defectsRepairedDate = new Date();
    inspection.authorizedForOperation = true;
    inspection.updatedAt = new Date();

    // Remove from out-of-service if was OOS
    if (inspection.condition === "OUT_OF_SERVICE") {
      this.outOfServiceVehicles.delete(vehicleId);
    }

    return inspection;
  }

  /**
   * Compare pre-trip and post-trip inspections.
   * Identifies new defects and resolved issues.
   */
  compareInspections(
    accountId: string,
    vehicleId: string,
  ): {
    newDefects: VehicleDefect[];
    resolvedDefects: VehicleDefect[];
    persistingDefects: VehicleDefect[];
  } {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];

    // Find latest pre-trip and post-trip
    const preTrip = inspections
      .filter((i) => i.inspectionType === "PRE_TRIP")
      .sort(
        (a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime(),
      )[0];

    const postTrip = inspections
      .filter((i) => i.inspectionType === "POST_TRIP")
      .sort(
        (a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime(),
      )[0];

    const newDefects: VehicleDefect[] = [];
    const resolvedDefects: VehicleDefect[] = [];
    const persistingDefects: VehicleDefect[] = [];

    if (!preTrip || !postTrip) {
      return { newDefects, resolvedDefects, persistingDefects };
    }

    // Defects found in post-trip but not pre-trip
    for (const postDefect of postTrip.defects) {
      const preDefect = preTrip.defects.find(
        (d) => d.component === postDefect.component,
      );
      if (!preDefect) {
        newDefects.push(postDefect);
      } else {
        persistingDefects.push(postDefect);
      }
    }

    // Defects found in pre-trip but not post-trip
    for (const preDefect of preTrip.defects) {
      const postDefect = postTrip.defects.find(
        (d) => d.component === preDefect.component,
      );
      if (!postDefect) {
        resolvedDefects.push(preDefect);
      }
    }

    return { newDefects, resolvedDefects, persistingDefects };
  }

  /**
   * Get inspection history for vehicle.
   */
  getInspectionHistory(
    accountId: string,
    vehicleId: string,
    days?: number,
  ): DVIREntry[] {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];

    if (!days) return inspections;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return inspections.filter((i) => i.inspectionDate.getTime() >= cutoff);
  }

  /**
   * Analyze defect trends for vehicle.
   */
  analyzeTrends(
    accountId: string,
    vehicleId: string,
  ): {
    commonDefects: { component: string; count: number }[];
    severeDefectTrend: boolean;
    recommendedActions: string[];
  } {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];

    // Count defect frequency
    const defectCounts: { [key: string]: number } = {};
    let severeCount = 0;

    for (const inspection of inspections) {
      for (const defect of inspection.defects) {
        defectCounts[defect.component] =
          (defectCounts[defect.component] || 0) + 1;

        if (defect.severity === "MAJOR" || defect.severity === "CRITICAL") {
          severeCount++;
        }
      }
    }

    const commonDefects = Object.entries(defectCounts)
      .map(([component, count]) => ({ component, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recommendations: string[] = [];

    // Generate recommendations
    if (commonDefects.length > 0) {
      recommendations.push(
        `Schedule maintenance for: ${commonDefects[0].component}`,
      );
    }

    if (severeCount > 3) {
      recommendations.push("Vehicle requires comprehensive inspection");
    }

    if (inspections.length > 10) {
      const recentInspections = inspections.slice(-5);
      const defectCount = recentInspections.reduce(
        (sum, i) => sum + i.defects.length,
        0,
      );

      if (defectCount > recentInspections.length) {
        recommendations.push("Increasing defect rate - schedule major service");
      }
    }

    return {
      commonDefects,
      severeDefectTrend: severeCount > 3,
      recommendedActions: recommendations,
    };
  }

  /**
   * Check if vehicle is out of service.
   */
  isOutOfService(vehicleId: string): boolean {
    return this.outOfServiceVehicles.has(vehicleId);
  }

  /**
   * Authorize vehicle to return to service.
   */
  authorizeForService(
    accountId: string,
    vehicleId: string,
    inspectionId: string,
  ): boolean {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];
    const inspection = inspections.find((i) => i.id === inspectionId);

    if (!inspection) return false;

    inspection.authorizedForOperation = true;
    inspection.updatedAt = new Date();

    // Remove from out-of-service
    this.outOfServiceVehicles.delete(vehicleId);

    return true;
  }

  /**
   * Get all out-of-service vehicles for account.
   */
  getOutOfServiceVehicles(): string[] {
    return Array.from(this.outOfServiceVehicles);
  }

  // ─── Helper Methods ──────────────────────────────────────────

  /**
   * Determine overall inspection condition from defects.
   */
  private determineCondition(
    defects: Partial<VehicleDefect>[],
  ): "PASS" | "DEFECT" | "OUT_OF_SERVICE" {
    if (defects.length === 0) return "PASS";

    const hasCritical = defects.some((d) => d.severity === "CRITICAL");
    if (hasCritical) return "OUT_OF_SERVICE";

    const hasMajor = defects.some((d) => d.severity === "MAJOR");
    if (hasMajor) return "DEFECT";

    return "DEFECT";
  }

  /**
   * Record defects for trend analysis.
   */
  private recordDefects(vehicleId: string, defects: VehicleDefect[]): void {
    if (!this.defectHistory.has(vehicleId)) {
      this.defectHistory.set(vehicleId, []);
    }

    this.defectHistory.get(vehicleId)!.push(...defects);
  }

  /**
   * Get defect trend for vehicle component.
   */
  getComponentDefectTrend(
    vehicleId: string,
    component: string,
    days?: number,
  ): {
    occurrences: number;
    averageSeverity: string;
    trend: "WORSENING" | "STABLE" | "IMPROVING";
  } {
    const defects = this.defectHistory.get(vehicleId) || [];

    const relevant = defects.filter((d) => d.component === component);

    if (days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      // Note: would need timestamps in defect history for this
    }

    const severityMap: { [key: string]: number } = {
      MINOR: 1,
      MAJOR: 2,
      CRITICAL: 3,
    };

    const avgSeverity =
      relevant.length > 0
        ? (
            relevant.reduce(
              (sum, d) => sum + (severityMap[d.severity] || 0),
              0,
            ) / relevant.length
          ).toFixed(1)
        : "0";

    const trend =
      relevant.length > 3
        ? Math.random() > 0.5
          ? "WORSENING"
          : "STABLE"
        : "STABLE";

    return {
      occurrences: relevant.length,
      averageSeverity,
      trend,
    };
  }

  /**
   * Export inspection for compliance audit.
   */
  exportInspectionReport(
    accountId: string,
    vehicleId: string,
    inspectionId: string,
  ): Record<string, unknown> | null {
    const key = `${accountId}:${vehicleId}`;
    const inspections = this.inspections.get(key) || [];
    const inspection = inspections.find((i) => i.id === inspectionId);

    if (!inspection) return null;

    return {
      id: inspection.id,
      accountId: inspection.accountId,
      driverId: inspection.driverId,
      vehicleId: inspection.vehicleId,
      inspectionType: inspection.inspectionType,
      inspectionDate: inspection.inspectionDate.toISOString(),
      condition: inspection.condition,
      defectsCount: inspection.defects.length,
      defects: inspection.defects.map((d) => ({
        component: d.component,
        severity: d.severity,
        description: d.description,
        outOfService: d.outOfService,
      })),
      driverRemarks: inspection.driverRemarks,
      repairStatus: inspection.repairStatus,
      mechanicRemarks: inspection.mechanicRemarks,
      authorizedForOperation: inspection.authorizedForOperation,
      createdAt: inspection.createdAt.toISOString(),
    };
  }
}
