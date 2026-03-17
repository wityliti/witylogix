/**
 * Fleet Management Module - Barrel Exports
 *
 * Complete fleet management system with:
 * - Vehicle lifecycle management
 * - Maintenance scheduling & tracking
 * - Fuel optimization & analytics
 * - Cost analysis & forecasting
 * - Fleet health scoring
 * - REST API endpoints
 */

// ─── LEGACY EXPORTS (TELEMATICS) ─────────────────────────────────────────

export { FleetService, createFleetService } from './fleet-service.js';

export type {
  Vehicle,
  VehicleStatus,
  VehiclePosition,
  VehicleLocation,
  VehicleFuel,
  FuelConsumption,
  VehicleDiagnostics,
  VehicleDiagnostic,
  DiagnosticCode,
  DriverBehaviorEvent,
  DriverBehaviorEventType,
  DriverBehaviorStats,
  MaintenanceAlert,
  MaintenanceSchedule,
  FleetOverview,
  FleetHealthScore,
  FleetHealthMetric,
  FleetEvent,
  FleetEventType,
  FleetAlert,
  TelematicsProvider,
  ProviderCredential,
  VehicleRegistration,
  RegisterVehicleRequest,
  UpdateVehicleRequest,
  VehicleListQueryParams,
  PaginatedVehicles,
  DateRange,
  VehicleIdentifier,
  ITelematicsAdapter,
  EventCallback,
} from './fleet-types.js';

export {
  FleetError,
  VehicleNotFoundError,
  ProviderIntegrationError,
  RateLimitError,
} from './fleet-types.js';

// ─── NEW FLEET MANAGEMENT TYPES ──────────────────────────────────────────

export type {
  VehicleType,
  FuelType,
  VehicleRegistration as VehicleRegistrationV2,
  InsurancePolicy,
  MaintenanceRecord,
  MaintenanceType,
  MaintenanceCategory,
  MaintenanceStatus,
  FuelTransaction,
  FuelCard,
  FleetCost,
  TCOComponent,
  DepreciationSchedule,
  VehicleAssignment,
  DriverLicense,
  VehicleInspection,
  InspectionChecklistItem,
  CreateVehicleRequest as CreateVehicleRequestV2,
  UpdateVehicleRequest as UpdateVehicleRequestV2,
  CreateMaintenanceRequest,
  CompleteMaintenanceRequest,
  RecordFuelTransactionRequest,
  AssignVehicleRequest,
  UnassignVehicleRequest,
  VehicleUtilization,
  FuelAnalysis,
  MaintenanceCost,
  FleetDashboardMetrics,
  CostForecast,
  FleetNotification,
  FleetNotificationType,
  BulkMaintenanceScheduleRequest,
  BulkFuelTransactionImport,
  FleetReport,
  ComplianceReport,
  FleetConfiguration,
  PaginationParams,
  VehicleFilterParams,
  MaintenanceFilterParams,
  FuelTransactionFilterParams,
  PaginatedResponse,
} from './fleet-types.js';

export {
  FleetManagementError,
  MaintenanceNotFoundError,
  InvalidAssignmentError,
  DeprecationCalculationError,
  MaintenanceScheduleError,
} from './fleet-types.js';

// ─── MANAGERS & ENGINES ──────────────────────────────────────────────────

export { VehicleManager } from './fleet-management-engine.js';
export { VehicleAssigner } from './fleet-management-engine.js';
export { FleetHealthCalculator } from './fleet-management-engine.js';
export { VehicleLifecycleManager } from './fleet-management-engine.js';
export { FleetDashboardAggregator } from './fleet-management-engine.js';

// ─── MAINTENANCE OPERATIONS ──────────────────────────────────────────────

export { PreventiveScheduler } from './maintenance-scheduler.js';
export { ReactiveHandler } from './maintenance-scheduler.js';
export { PredictiveEngine } from './maintenance-scheduler.js';
export { MaintenanceOptimizer } from './maintenance-scheduler.js';
export { RecallManager } from './maintenance-scheduler.js';
export { MaintenanceCostTracker } from './maintenance-scheduler.js';

// ─── FUEL OPTIMIZATION ──────────────────────────────────────────────────

export { FuelAnalyzer } from './fuel-optimizer.js';
export { IdleReductionMonitor } from './fuel-optimizer.js';
export { RouteFuelCorrelator } from './fuel-optimizer.js';
export { FuelCardReconciler } from './fuel-optimizer.js';
export { FuelBudgetForecaster } from './fuel-optimizer.js';
export { FuelPriceTracker } from './fuel-optimizer.js';

// ─── COST ANALYSIS ──────────────────────────────────────────────────────

export { TCOCalculator } from './fleet-cost-analyzer.js';
export { CostPerMileTracker } from './fleet-cost-analyzer.js';
export { BudgetManager } from './fleet-cost-analyzer.js';
export { LeaseVsBuyAnalyzer } from './fleet-cost-analyzer.js';
export { FleetRightSizing } from './fleet-cost-analyzer.js';

// ─── API ────────────────────────────────────────────────────────────────

export { FleetAPI, createFleetAPI } from './fleet-api.js';

export {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AssignVehicleSchema,
  CreateMaintenanceSchema,
  CompleteMaintenanceSchema,
  RecordFuelTransactionSchema,
} from './fleet-api.js';

// ─── FACTORY FUNCTION ──────────────────────────────────────────────────

/**
 * Initialize complete fleet management system
 */
export function initializeFleetManagement(prisma: any) {
  return {
    vehicles: new (require('./fleet-management-engine.js').VehicleManager)(prisma),
    assignments: new (require('./fleet-management-engine.js').VehicleAssigner)(prisma),
    health: new (require('./fleet-management-engine.js').FleetHealthCalculator)(prisma),
    lifecycle: new (require('./fleet-management-engine.js').VehicleLifecycleManager)(prisma),
    dashboard: new (require('./fleet-management-engine.js').FleetDashboardAggregator)(prisma),
    maintenance: {
      preventive: new (require('./maintenance-scheduler.js').PreventiveScheduler)(prisma),
      reactive: new (require('./maintenance-scheduler.js').ReactiveHandler)(prisma),
      predictive: new (require('./maintenance-scheduler.js').PredictiveEngine)(prisma),
      optimizer: new (require('./maintenance-scheduler.js').MaintenanceOptimizer)(prisma),
      recalls: new (require('./maintenance-scheduler.js').RecallManager)(prisma),
      costs: new (require('./maintenance-scheduler.js').MaintenanceCostTracker)(prisma),
    },
    fuel: {
      analyzer: new (require('./fuel-optimizer.js').FuelAnalyzer)(prisma),
      idle: new (require('./fuel-optimizer.js').IdleReductionMonitor)(prisma),
      routes: new (require('./fuel-optimizer.js').RouteFuelCorrelator)(prisma),
      cardReconciler: new (require('./fuel-optimizer.js').FuelCardReconciler)(prisma),
      budgetForecaster: new (require('./fuel-optimizer.js').FuelBudgetForecaster)(prisma),
      priceTracker: new (require('./fuel-optimizer.js').FuelPriceTracker)(prisma),
    },
    costs: {
      tco: new (require('./fleet-cost-analyzer.js').TCOCalculator)(prisma),
      perMile: new (require('./fleet-cost-analyzer.js').CostPerMileTracker)(prisma),
      budget: new (require('./fleet-cost-analyzer.js').BudgetManager)(prisma),
      leaseVsBuy: new (require('./fleet-cost-analyzer.js').LeaseVsBuyAnalyzer)(),
      rightSizing: new (require('./fleet-cost-analyzer.js').FleetRightSizing)(prisma),
    },
    api: new (require('./fleet-api.js').FleetAPI)(prisma),
  };
}

/**
 * Fleet management module version
 */
export const FLEET_MODULE_VERSION = "1.0.0";
