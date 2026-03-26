/**
 * Fleet Management Types - Comprehensive Type Definitions
 *
 * Core types for:
 * - Vehicle lifecycle management (acquisition, active, maintenance, disposition)
 * - Maintenance scheduling and compliance
 * - Fuel tracking and optimization
 * - Fleet cost analysis and forecasting
 * - Vehicle assignments and utilization
 * - Health scoring and analytics
 */

// ─── VEHICLE TYPES ────────────────────────────────────────────────────────

export type VehicleType = "TRUCK" | "VAN" | "CAR" | "TRAILER";
export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "RETIRED" | "DISPOSED";
export type FuelType = "DIESEL" | "GASOLINE" | "ELECTRIC" | "HYBRID" | "CNG";

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  mileage: number;
  fuelType: FuelType;
  licensePlate: string;
  registration: VehicleRegistration;
  insurance: InsurancePolicy;
  assignedDriverId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleRegistration {
  registrationNumber: string;
  expiryDate: Date;
  state: string;
  ownerName: string;
}

export interface InsurancePolicy {
  policyNumber: string;
  provider: string;
  expiryDate: Date;
  coverageType: "COMPREHENSIVE" | "LIABILITY" | "COLLISION";
  premium: number;
}

// ─── MAINTENANCE TYPES ────────────────────────────────────────────────────

export type MaintenanceType = "PREVENTIVE" | "REACTIVE" | "PREDICTIVE" | "RECALL";
export type MaintenanceCategory =
  | "OIL_CHANGE"
  | "TIRE"
  | "BRAKE"
  | "ENGINE"
  | "TRANSMISSION"
  | "ELECTRICAL"
  | "BODY"
  | "INSPECTION";
export type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  scheduledDate: Date;
  completedDate?: Date;
  vendor?: string;
  cost?: number;
  parts?: string[];
  laborHours?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceSchedule {
  id: string;
  vehicleId: string;
  maintenanceType: MaintenanceType;
  intervalMiles?: number;
  intervalMonths?: number;
  intervalHours?: number;
  lastServiceDate: Date;
  nextServiceDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── FUEL TYPES ──────────────────────────────────────────────────────────

export interface FuelTransaction {
  id: string;
  vehicleId: string;
  driverId?: string;
  date: Date;
  gallons: number;
  totalCost: number;
  pricePerGallon: number;
  station?: string;
  location?: { latitude: number; longitude: number };
  fuelCardId?: string;
  odometerReading: number;
  fuelType: FuelType;
  createdAt: Date;
}

export interface FuelCard {
  id: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: Date;
  dailyLimit: number;
  monthlyLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── COST TYPES ──────────────────────────────────────────────────────────

export interface FleetCost {
  id: string;
  vehicleId: string;
  period: { start: Date; end: Date };
  fuel: number;
  maintenance: number;
  insurance: number;
  depreciation: number;
  tolls: number;
  total: number;
  costPerMile: number;
  createdAt: Date;
}

export interface TCOComponent {
  acquisition: number;
  fuel: number;
  maintenance: number;
  insurance: number;
  depreciation: number;
  disposal: number;
  tolls: number;
  total: number;
}

export interface DepreciationSchedule {
  method: "STRAIGHT_LINE" | "DECLINING_BALANCE";
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  currentValue: number;
  annualDepreciation: number;
}

// ─── ASSIGNMENT TYPES ────────────────────────────────────────────────────

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  driverId: string;
  startDate: Date;
  endDate?: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverLicense {
  licenseNumber: string;
  class: string; // CDL, Commercial, Standard
  expiryDate: Date;
  restrictions?: string[];
}

// ─── HEALTH SCORE TYPES ──────────────────────────────────────────────────

export interface FleetHealthScore {
  id: string;
  vehicleId?: string; // null = fleet-wide
  overallScore: number; // 0-100
  maintenanceCompliance: number;
  ageScore: number;
  mileageScore: number;
  incidentScore: number;
  fuelEfficiencyScore: number;
  utilizationScore: number;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  lastUpdated: Date;
  createdAt: Date;
}

// ─── VEHICLE INSPECTION TYPES ────────────────────────────────────────────

export interface VehicleInspection {
  id: string;
  vehicleId: string;
  inspectionDate: Date;
  inspectionType: "ROUTINE" | "SAFETY" | "PRE_TRIP" | "POST_TRIP";
  status: "PASS" | "FAIL" | "CONDITIONAL";
  checklist: InspectionChecklistItem[];
  notes?: string;
  inspectorName: string;
  nextInspectionDueDate: Date;
  createdAt: Date;
}

export interface InspectionChecklistItem {
  component: string;
  status: "PASS" | "FAIL" | "N/A";
  notes?: string;
}

// ─── REQUEST/RESPONSE TYPES ──────────────────────────────────────────────

export interface CreateVehicleRequest {
  vin: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  licensePlate: string;
  registration: VehicleRegistration;
  insurance: InsurancePolicy;
}

export interface UpdateVehicleRequest {
  mileage?: number;
  status?: VehicleStatus;
  assignedDriverId?: string | null;
  insurance?: InsurancePolicy;
}

export interface CreateMaintenanceRequest {
  vehicleId: string;
  type: MaintenanceType;
  category: MaintenanceCategory;
  scheduledDate: Date;
  vendor?: string;
  estimatedCost?: number;
  notes?: string;
}

export interface CompleteMaintenanceRequest {
  completedDate: Date;
  cost: number;
  parts?: string[];
  laborHours?: number;
  notes?: string;
}

export interface RecordFuelTransactionRequest {
  vehicleId: string;
  driverId?: string;
  gallons: number;
  totalCost: number;
  station?: string;
  location?: { latitude: number; longitude: number };
  odometerReading: number;
}

export interface AssignVehicleRequest {
  vehicleId: string;
  driverId: string;
  reason?: string;
}

export interface UnassignVehicleRequest {
  vehicleId: string;
}

// ─── ANALYTICS TYPES ─────────────────────────────────────────────────────

export interface VehicleUtilization {
  vehicleId: string;
  period: { start: Date; end: Date };
  totalMiles: number;
  idleMiles: number;
  activeMiles: number;
  utilizationPercentage: number;
  averageMilesPerDay: number;
}

export interface FuelAnalysis {
  vehicleId: string;
  period: { start: Date; end: Date };
  totalGallons: number;
  totalCost: number;
  mpg: number;
  avgPricePerGallon: number;
  trendComparison: number; // % change vs previous period
}

export interface MaintenanceCost {
  vehicleId?: string; // null = fleet-wide
  period: { start: Date; end: Date };
  preventiveSpent: number;
  reactiveSpent: number;
  predictiveSpent: number;
  totalSpent: number;
  averageCostPerMile: number;
}

export interface FleetDashboardMetrics {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  retiredVehicles: number;
  disposedVehicles: number;
  utilizationRate: number;
  healthScore: number;
  averageFuelEconomy: number;
  totalMaintenanceCost: number;
  totalFuelCost: number;
  costPerMile: number;
  overdueMaintenance: number;
  averageAge: number;
  averageMileage: number;
  lastUpdated: Date;
}

export interface CostForecast {
  vehicleId?: string;
  period: { start: Date; end: Date };
  projectedFuel: number;
  projectedMaintenance: number;
  projectedInsurance: number;
  projectedTotal: number;
  confidenceLevel: number;
}

// ─── ERROR TYPES ─────────────────────────────────────────────────────────

export class FleetManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "FleetManagementError";
  }
}

export class VehicleNotFoundError extends FleetManagementError {
  constructor(vehicleId: string) {
    super(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
  }
}

export class MaintenanceNotFoundError extends FleetManagementError {
  constructor(maintenanceId: string) {
    super(`Maintenance record not found: ${maintenanceId}`, "MAINTENANCE_NOT_FOUND", 404);
  }
}

export class InvalidAssignmentError extends FleetManagementError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "INVALID_ASSIGNMENT", 400, details);
  }
}

export class DeprecationCalculationError extends FleetManagementError {
  constructor(vehicleId: string) {
    super(`Failed to calculate depreciation for vehicle: ${vehicleId}`, "DEPRECIATION_ERROR", 500);
  }
}

export class MaintenanceScheduleError extends FleetManagementError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "MAINTENANCE_SCHEDULE_ERROR", 400, details);
  }
}

// ─── PAGINATION & FILTERING ──────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface VehicleFilterParams extends PaginationParams {
  status?: VehicleStatus;
  type?: VehicleType;
  fuelType?: FuelType;
  assignedDriverId?: string;
  search?: string; // Search by VIN, plate, make/model
}

export interface MaintenanceFilterParams extends PaginationParams {
  vehicleId?: string;
  type?: MaintenanceType;
  status?: MaintenanceStatus;
  category?: MaintenanceCategory;
  startDate?: Date;
  endDate?: Date;
}

export interface FuelTransactionFilterParams extends PaginationParams {
  vehicleId?: string;
  driverId?: string;
  startDate?: Date;
  endDate?: Date;
  station?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── NOTIFICATION TYPES ──────────────────────────────────────────────────

export type FleetNotificationType =
  | "MAINTENANCE_OVERDUE"
  | "INSURANCE_EXPIRING"
  | "REGISTRATION_EXPIRING"
  | "HEALTH_SCORE_DECLINING"
  | "MAINTENANCE_COMPLETED"
  | "VEHICLE_ASSIGNMENT"
  | "COST_THRESHOLD_EXCEEDED"
  | "FUEL_ANOMALY";

export interface FleetNotification {
  id: string;
  type: FleetNotificationType;
  vehicleId?: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

// ─── BULK OPERATION TYPES ────────────────────────────────────────────────

export interface BulkMaintenanceScheduleRequest {
  vehicleIds: string[];
  maintenanceType: MaintenanceType;
  category: MaintenanceCategory;
  scheduledDate: Date;
  vendor?: string;
}

export interface BulkFuelTransactionImport {
  transactions: FuelTransaction[];
  source: "CSV" | "API" | "MANUAL";
  importDate: Date;
}

// ─── REPORTING TYPES ────────────────────────────────────────────────────

export interface FleetReport {
  id: string;
  reportType:
    | "HEALTH"
    | "MAINTENANCE"
    | "FUEL"
    | "COST"
    | "UTILIZATION"
    | "COMPLIANCE";
  period: { start: Date; end: Date };
  generatedAt: Date;
  data: Record<string, any>;
  createdBy: string;
}

export interface ComplianceReport {
  vehicleId: string;
  period: { start: Date; end: Date };
  maintenanceCompliance: number;
  inspectionCompliance: number;
  insuranceCompliance: boolean;
  registrationCompliance: boolean;
  issues: string[];
}

// ─── CONFIGURATION TYPES ────────────────────────────────────────────────

export interface FleetConfiguration {
  id: string;
  maintenanceThreshold: {
    warningMiles: number;
    criticalMiles: number;
    warningDays: number;
    criticalDays: number;
  };
  costThreshold: {
    monthlyBudget: number;
    alertPercentage: number;
  };
  healthScoreWeights: {
    maintenance: number;
    age: number;
    mileage: number;
    incidents: number;
    fuelEfficiency: number;
    utilization: number;
  };
  replacementCriteria: {
    maxAge: number;
    maxMileage: number;
    minHealthScore: number;
  };
}
