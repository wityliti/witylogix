/**
 * Fleet Management Module - Barrel Exports
 */

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
