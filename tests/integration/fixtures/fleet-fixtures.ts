/**
 * Fleet Fixtures - Factory Functions for Test Data
 *
 * Provides:
 * - createMockVehicle: Complete vehicle with registration, insurance, assignments
 * - createMockMaintenanceRecord: Maintenance records across all types
 * - createMockMaintenanceSchedule: Preventive maintenance schedules
 * - createMockFuelTransaction: Fuel card transactions with reconciliation
 * - createMockFuelCard: Fuel card management
 * - createMockFleetCost: Cost tracking and analysis
 * - createMockHealthScore: Vehicle health scoring components
 * - Batch operations for realistic fleet scenarios
 */

import { randomUUID } from "crypto";
import type {
  Vehicle,
  VehicleRegistration,
  InsurancePolicy,
  MaintenanceRecord,
  MaintenanceSchedule,
  FuelTransaction,
  FuelCard,
  FleetCost,
} from "../../../packages/core/src/fleet/fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

interface MockVehicleOptions {
  id?: string;
  vin?: string;
  licensePlate?: string;
  status?: "ACTIVE" | "MAINTENANCE" | "RETIRED" | "DISPOSED";
  assignedDriverId?: string;
  mileage?: number;
  fuelType?: "DIESEL" | "GASOLINE" | "ELECTRIC" | "HYBRID" | "CNG";
}

export function createMockVehicle(options: MockVehicleOptions = {}): Vehicle {
  const id = options.id || "vehicle_" + randomUUID().split("-")[0];
  const vin =
    options.vin || "WVWZZZ" + randomUUID().substring(0, 11).toUpperCase();
  const licensePlate =
    options.licensePlate ||
    "WIT" +
      Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");

  const registration: VehicleRegistration = {
    registrationNumber: "REG" + randomUUID().substring(0, 8).toUpperCase(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    state: "CA",
    ownerName: "Witylogix Fleet LLC",
  };

  const insurance: InsurancePolicy = {
    policyNumber: "POL" + randomUUID().substring(0, 8).toUpperCase(),
    provider: "SafeFleet Insurance",
    expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
    coverageType: "COMPREHENSIVE",
    premium: 1200,
  };

  return {
    id,
    vin,
    make: "Volvo",
    model: "VNL",
    year: 2023,
    type: "TRUCK",
    status: options.status || "ACTIVE",
    mileage: options.mileage || 45000,
    fuelType: options.fuelType || "DIESEL",
    licensePlate,
    registration,
    insurance,
    assignedDriverId: options.assignedDriverId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createMockVehicles(
  count: number,
  overrides: Partial<MockVehicleOptions> = {},
): Vehicle[] {
  return Array.from({ length: count }, (_, i) =>
    createMockVehicle({
      id: `vehicle_${i}`,
      ...overrides,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAINTENANCE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

interface MockMaintenanceRecordOptions {
  id?: string;
  vehicleId?: string;
  type?: "PREVENTIVE" | "REACTIVE" | "PREDICTIVE" | "RECALL";
  category?: string;
  status?: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  cost?: number;
  daysIntoSchedule?: number;
}

export function createMockMaintenanceRecord(
  options: MockMaintenanceRecordOptions = {},
): MaintenanceRecord {
  const now = new Date();
  const scheduledDate = new Date(
    now.getTime() + (options.daysIntoSchedule || 7) * 24 * 60 * 60 * 1000,
  );
  const completedDate =
    options.status === "COMPLETED"
      ? new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000)
      : undefined;

  return {
    id: options.id || "maint_" + randomUUID().split("-")[0],
    vehicleId: options.vehicleId || "vehicle_0",
    type: options.type || "PREVENTIVE",
    category: options.category || "OIL_CHANGE",
    status: options.status || "SCHEDULED",
    scheduledDate,
    completedDate,
    vendor: "Premier Fleet Service Center",
    cost: options.cost || 350,
    parts: ["Synthetic Oil 15W40", "Oil Filter", "Cabin Air Filter"],
    laborHours: 1.5,
    notes: "Routine preventive maintenance",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createMockMaintenanceSchedule(
  options: Partial<MaintenanceSchedule & { vehicleId?: string }> = {},
): MaintenanceSchedule {
  const lastServiceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const nextServiceDate = new Date(
    lastServiceDate.getTime() + 12 * 30 * 24 * 60 * 60 * 1000,
  ); // +12 months

  return {
    id: options.id || "sched_" + randomUUID().split("-")[0],
    vehicleId: options.vehicleId || "vehicle_0",
    maintenanceType: "PREVENTIVE",
    intervalMiles: 10000,
    intervalMonths: 12,
    intervalHours: undefined,
    lastServiceDate,
    nextServiceDate,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FUEL FACTORIES
// ─────────────────────────────────────────────────────────────────────────

interface MockFuelTransactionOptions {
  id?: string;
  vehicleId?: string;
  driverId?: string;
  gallons?: number;
  pricePerGallon?: number;
  odometerReading?: number;
  daysAgo?: number;
}

export function createMockFuelTransaction(
  options: MockFuelTransactionOptions = {},
): FuelTransaction {
  const gallons = options.gallons || 50;
  const pricePerGallon = options.pricePerGallon || 3.45;
  const totalCost = gallons * pricePerGallon;
  const daysAgo = options.daysAgo || 1;
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    id: options.id || "fuel_" + randomUUID().split("-")[0],
    vehicleId: options.vehicleId || "vehicle_0",
    driverId: options.driverId || "driver_0",
    date,
    gallons,
    totalCost,
    pricePerGallon,
    station: "Pilot Flying J #1234",
    location: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    fuelCardId: "card_" + randomUUID().split("-")[0],
    odometerReading: options.odometerReading || 125000,
    fuelType: "DIESEL",
    createdAt: date,
  };
}

export function createMockFuelCard(
  overrides: Partial<FuelCard> = {},
): FuelCard {
  return {
    id: "card_" + randomUUID().split("-")[0],
    cardNumber: "4" + Math.random().toString().substring(2, 15),
    cardholderName: "Fleet Driver",
    expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), // 2 years
    dailyLimit: 500,
    monthlyLimit: 10000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// COST FACTORIES
// ─────────────────────────────────────────────────────────────────────────

interface MockFleetCostOptions {
  vehicleId?: string;
  fuel?: number;
  maintenance?: number;
  insurance?: number;
}

export function createMockFleetCost(
  options: MockFleetCostOptions = {},
): FleetCost {
  const fuel = options.fuel || 2500;
  const maintenance = options.maintenance || 1200;
  const insurance = options.insurance || 800;
  const depreciation = 1500;
  const tolls = 300;
  const total = fuel + maintenance + insurance + depreciation + tolls;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    id: "cost_" + randomUUID().split("-")[0],
    vehicleId: options.vehicleId || "vehicle_0",
    period: { start, end },
    fuel,
    maintenance,
    insurance,
    depreciation,
    tolls,
    total,
    costPerMile: 0.75,
    createdAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH SCORE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockHealthScoreComponents {
  maintenanceCompliance: number; // 0-100
  ageScore: number; // 0-100
  mileageScore: number; // 0-100
  fuelEfficiencyScore: number; // 0-100
}

export function createMockHealthScoreComponents(
  overrides: Partial<MockHealthScoreComponents> = {},
): MockHealthScoreComponents {
  return {
    maintenanceCompliance: overrides.maintenanceCompliance ?? 92,
    ageScore: overrides.ageScore ?? 85,
    mileageScore: overrides.mileageScore ?? 78,
    fuelEfficiencyScore: overrides.fuelEfficiencyScore ?? 88,
  };
}

export function calculateHealthScore(
  components: MockHealthScoreComponents,
): number {
  const weights = {
    maintenanceCompliance: 0.4,
    ageScore: 0.2,
    mileageScore: 0.2,
    fuelEfficiencyScore: 0.2,
  };

  return Math.round(
    components.maintenanceCompliance * weights.maintenanceCompliance +
      components.ageScore * weights.ageScore +
      components.mileageScore * weights.mileageScore +
      components.fuelEfficiencyScore * weights.fuelEfficiencyScore,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BATCH FACTORIES FOR REALISTIC SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

export interface FleetScenarioFixtures {
  vehicles: Vehicle[];
  maintenanceRecords: MaintenanceRecord[];
  fuelTransactions: FuelTransaction[];
  healthScores: Map<string, number>;
}

export function createFleetScenario(
  vehicleCount: number = 5,
): FleetScenarioFixtures {
  const vehicles = createMockVehicles(vehicleCount);
  const maintenanceRecords: MaintenanceRecord[] = [];
  const fuelTransactions: FuelTransaction[] = [];
  const healthScores = new Map<string, number>();

  // For each vehicle, create maintenance and fuel data
  vehicles.forEach((vehicle, index) => {
    // Maintenance records
    for (let i = 0; i < 3; i++) {
      maintenanceRecords.push(
        createMockMaintenanceRecord({
          vehicleId: vehicle.id,
          type: i === 0 ? "PREVENTIVE" : i === 1 ? "REACTIVE" : "PREDICTIVE",
          status: i === 0 ? "COMPLETED" : i === 1 ? "IN_PROGRESS" : "SCHEDULED",
          daysIntoSchedule: i * 15,
        }),
      );
    }

    // Fuel transactions
    for (let i = 0; i < 10; i++) {
      fuelTransactions.push(
        createMockFuelTransaction({
          vehicleId: vehicle.id,
          driverId: `driver_${index}`,
          daysAgo: i,
          odometerReading: vehicle.mileage + i * 500,
        }),
      );
    }

    // Health scores
    const components = createMockHealthScoreComponents();
    healthScores.set(vehicle.id, calculateHealthScore(components));
  });

  return {
    vehicles,
    maintenanceRecords,
    fuelTransactions,
    healthScores,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export function generateVIN(): string {
  return "WVWZZZ" + randomUUID().substring(0, 11).toUpperCase();
}

export function generateLicensePlate(): string {
  return (
    "WIT" +
    Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
  );
}

export function generateRegistrationNumber(): string {
  return "REG" + randomUUID().substring(0, 8).toUpperCase();
}

export function generatePolicyNumber(): string {
  return "POL" + randomUUID().substring(0, 8).toUpperCase();
}

export function futureDate(daysFromNow: number = 30): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export function pastDate(daysAgo: number = 30): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}
