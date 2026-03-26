/**
 * Driver Assignment Steps
 * - assignZoneStep: Assigns delivery zone based on geocoded address
 * - findAvailableDriversStep: Queries for available drivers near pickup
 * - optimizeAssignmentStep: Selects best driver using scoring algorithm
 * - assignDriverRecordStep: Creates driver assignment in DB
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

// ─── ASSIGN ZONE STEP ───────────────────────────────────────────────────

export interface AssignZoneInput {
  deliveryLat: number;
  deliveryLng: number;
  shopId: string;
}

export interface AssignZoneOutput {
  zoneId: string;
  zoneName: string;
  baseRate: number;
  perKmRate: number;
}

export const assignZoneStep: WorkflowStep<AssignZoneInput, AssignZoneOutput> =
  {
    name: "assignZone",
    description: "Assign delivery zone based on geocoded address",

    async invoke(
      input: AssignZoneInput,
      context: WorkflowContext
    ): Promise<StepResult<AssignZoneOutput>> {
      const logger = context.logger;
      logger?.info("Starting zone assignment", {
        lat: input.deliveryLat,
        lng: input.deliveryLng,
        shopId: input.shopId,
      });

      try {
        const prisma = (context.prisma as any);

        // In production: query against PostGIS geometry column
        // For now: find first active zone for shop
        const zones = await prisma.deliveryZone.findMany({
          where: {
            shopId: input.shopId,
            isActive: true,
          },
          orderBy: {
            priority: "desc",
          },
        });

        if (!zones || zones.length === 0) {
          return {
            success: false,
            error: "No active delivery zones found for shop",
            code: "NO_ZONES_AVAILABLE",
          };
        }

        const zone = zones[0];

        logger?.info("Zone assigned", {
          zoneId: zone.id,
          zoneName: zone.name,
          baseRate: zone.baseRate,
        });

        return {
          success: true,
          data: {
            zoneId: zone.id,
            zoneName: zone.name,
            baseRate: parseFloat(zone.baseRate.toString()),
            perKmRate: parseFloat(zone.perKmRate.toString()),
          },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger?.error("Zone assignment failed", { error: errorMsg });
        return {
          success: false,
          error: `Zone assignment error: ${errorMsg}`,
          code: "ZONE_ASSIGNMENT_ERROR",
        };
      }
    },

    async compensate(
      _input: AssignZoneInput,
      context: WorkflowContext
    ): Promise<void> {
      // No-op: unassigning a zone is just clearing the field
      context.logger?.info("Compensating zone assignment (no-op)");
    },
  };

// ─── FIND AVAILABLE DRIVERS STEP ────────────────────────────────────────

export interface FindAvailableDriversInput {
  pickupLat: number;
  pickupLng: number;
  shopId: string;
  maxDistance?: number; // Search radius in km
}

export interface DriverCandidate {
  id: string;
  name: string;
  phone: string;
  currentLat?: number;
  currentLng?: number;
  vehicleType: string;
  maxCapacity: number;
  distanceFromPickup?: number;
}

export interface FindAvailableDriversOutput {
  driverCandidates: DriverCandidate[];
  totalAvailable: number;
}

export const findAvailableDriversStep: WorkflowStep<
  FindAvailableDriversInput,
  FindAvailableDriversOutput
> = {
  name: "findAvailableDrivers",
  description: "Query for available drivers near pickup location",

  async invoke(
    input: FindAvailableDriversInput,
    context: WorkflowContext
  ): Promise<StepResult<FindAvailableDriversOutput>> {
    const logger = context.logger;
    logger?.info("Searching for available drivers", {
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      shopId: input.shopId,
    });

    try {
      const prisma = (context.prisma as any);
      const searchRadius = input.maxDistance || 15; // Default 15 km radius

      // Query: drivers with AVAILABLE or ON_ROUTE status
      const drivers = await prisma.driver.findMany({
        where: {
          shopId: input.shopId,
          status: { in: ["AVAILABLE", "ON_ROUTE"] },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          currentLocation: true,
          vehicleType: true,
          maxCapacity: true,
          vehiclePlate: true,
        },
      });

      logger?.info("Database query returned drivers", {
        count: drivers.length,
      });

      // Filter by distance (simple straight-line distance for now)
      const candidates: DriverCandidate[] = drivers
        .map((d: any) => {
          const distance = d.currentLocation
            ? calculateSimpleDistance(
                input.pickupLat,
                input.pickupLng,
                d.currentLocation.lat || 0,
                d.currentLocation.lng || 0
              )
            : searchRadius + 1; // Out of range if no location

          return {
            id: d.id,
            name: d.name,
            phone: d.phone,
            currentLat: d.currentLocation?.lat,
            currentLng: d.currentLocation?.lng,
            vehicleType: d.vehicleType,
            maxCapacity: d.maxCapacity,
            distanceFromPickup: distance,
          };
        })
        .filter((d: any) => d.distanceFromPickup! <= searchRadius)
        .sort((a: any, b: any) => (a.distanceFromPickup || 0) - (b.distanceFromPickup || 0));

      logger?.info("Driver filtering completed", {
        candidates: candidates.length,
        searchRadius,
      });

      return {
        success: true,
        data: {
          driverCandidates: candidates,
          totalAvailable: candidates.length,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Driver search failed", { error: errorMsg });
      return {
        success: false,
        error: `Driver search error: ${errorMsg}`,
        code: "DRIVER_SEARCH_ERROR",
      };
    }
  },

  // No compensation needed — search is read-only
};

// ─── OPTIMIZE ASSIGNMENT STEP ──────────────────────────────────────────

export interface OptimizeAssignmentInput {
  driverCandidates: DriverCandidate[];
  itemCount: number;
  totalWeight?: number;
  deliveryDate: Date;
}

export interface OptimizeAssignmentOutput {
  selectedDriverId: string;
  selectedDriver: DriverCandidate;
  score: number;
  scoreBreakdown: {
    factor: string;
    weight: number;
    score: number;
  }[];
}

export const optimizeAssignmentStep: WorkflowStep<
  OptimizeAssignmentInput,
  OptimizeAssignmentOutput
> = {
  name: "optimizeAssignment",
  description: "Select best driver using multi-factor scoring algorithm",

  async invoke(
    input: OptimizeAssignmentInput,
    context: WorkflowContext
  ): Promise<StepResult<OptimizeAssignmentOutput>> {
    const logger = context.logger;
    logger?.info("Starting driver optimization", {
      candidates: input.driverCandidates.length,
    });

    try {
      if (!input.driverCandidates || input.driverCandidates.length === 0) {
        return {
          success: false,
          error: "No driver candidates available for optimization",
          code: "NO_CANDIDATES",
        };
      }

      // ─── Scoring Algorithm ────────────────────────────────────────
      // Multi-factor scoring: distance, capacity, vehicle type
      const scoredDrivers = input.driverCandidates.map((driver) => {
        const scoreBreakdown: { factor: string; weight: number; score: number }[] =
          [];

        let totalScore = 0;

        // Factor 1: Distance (closer is better)
        // Normalize to 0-100: 0 km = 100, 10 km = 0
        const maxDistance = 10;
        const distanceScore = Math.max(
          0,
          100 * (1 - (driver.distanceFromPickup || 0) / maxDistance)
        );
        const distanceWeight = 0.4;
        const distanceContribution = distanceScore * distanceWeight;
        scoreBreakdown.push({
          factor: "Distance",
          weight: distanceWeight,
          score: distanceScore,
        });
        totalScore += distanceContribution;

        // Factor 2: Capacity (sufficient capacity is better)
        // Must have >= itemCount + 10% buffer
        const requiredCapacity = input.itemCount * 1.1;
        const hasCapacity = driver.maxCapacity >= requiredCapacity;
        const capacityScore = hasCapacity ? 100 : 0;
        const capacityWeight = 0.3;
        const capacityContribution = capacityScore * capacityWeight;
        scoreBreakdown.push({
          factor: "Capacity",
          weight: capacityWeight,
          score: capacityScore,
        });
        totalScore += capacityContribution;

        // Factor 3: Vehicle type suitability
        // Heavy items prefer larger vehicles (truck, van > car > motorcycle)
        const vehicleScoreMap: Record<string, number> = {
          TRUCK: 100,
          VAN: 95,
          CAR: 70,
          MOTORCYCLE: 30,
          BICYCLE: 10,
        };
        const vehicleScore = vehicleScoreMap[driver.vehicleType] || 50;
        const vehicleWeight = 0.3;
        const vehicleContribution = vehicleScore * vehicleWeight;
        scoreBreakdown.push({
          factor: "Vehicle Type",
          weight: vehicleWeight,
          score: vehicleScore,
        });
        totalScore += vehicleContribution;

        return {
          driver,
          totalScore: Math.round(totalScore * 100) / 100,
          scoreBreakdown,
        };
      });

      // Select top driver
      const best = scoredDrivers.sort((a, b) => b.totalScore - a.totalScore)[0];

      logger?.info("Driver optimization completed", {
        selectedDriverId: best.driver.id,
        score: best.totalScore,
        candidates: input.driverCandidates.length,
      });

      return {
        success: true,
        data: {
          selectedDriverId: best.driver.id,
          selectedDriver: best.driver,
          score: best.totalScore,
          scoreBreakdown: best.scoreBreakdown,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Driver optimization failed", { error: errorMsg });
      return {
        success: false,
        error: `Optimization error: ${errorMsg}`,
        code: "OPTIMIZATION_ERROR",
      };
    }
  },

  // No compensation needed — optimization is analytical only
};

// ─── ASSIGN DRIVER RECORD STEP ──────────────────────────────────────────

export interface AssignDriverRecordInput {
  driverId: string;
  orderId: string;
  shopId: string;
}

export interface AssignDriverRecordOutput {
  assignmentId: string;
  driverId: string;
  orderId: string;
  assignedAt: Date;
}

export const assignDriverRecordStep: WorkflowStep<
  AssignDriverRecordInput,
  AssignDriverRecordOutput
> = {
  name: "assignDriverRecord",
  description: "Create driver assignment record in database",

  async invoke(
    input: AssignDriverRecordInput,
    context: WorkflowContext
  ): Promise<StepResult<AssignDriverRecordOutput>> {
    const logger = context.logger;
    logger?.info("Creating driver assignment record", {
      driverId: input.driverId,
      orderId: input.orderId,
    });

    try {
      const prisma = (context.prisma as any);

      // Update order with driver assignment
      const updatedOrder = await prisma.order.update({
        where: { id: input.orderId },
        data: {
          driverId: input.driverId,
          status: "ASSIGNED",
          updatedAt: new Date(),
        },
      });

      logger?.info("Driver assignment recorded", {
        orderId: input.orderId,
        driverId: input.driverId,
        status: updatedOrder.status,
      });

      return {
        success: true,
        data: {
          assignmentId: `assign_${input.orderId}`,
          driverId: input.driverId,
          orderId: input.orderId,
          assignedAt: new Date(),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Driver assignment failed", { error: errorMsg });
      return {
        success: false,
        error: `Assignment error: ${errorMsg}`,
        code: "ASSIGNMENT_RECORD_ERROR",
      };
    }
  },

  async compensate(
    input: AssignDriverRecordInput,
    context: WorkflowContext
  ): Promise<void> {
    const logger = context.logger;
    logger?.info("Compensating driver assignment", {
      orderId: input.orderId,
    });

    try {
      const prisma = (context.prisma as any);

      // Unassign driver and revert status
      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          driverId: null,
          status: "ACCEPTED",
        },
      });

      logger?.info("Driver assignment compensated");
    } catch (error) {
      logger?.error("Compensation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * Simple distance calculation (not using Haversine for performance)
 */
function calculateSimpleDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  // Rough approximation: 1 degree ≈ 111 km
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
}
