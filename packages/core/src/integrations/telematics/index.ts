/**
 * Telematics Integration Barrel Export
 */

// Types
export type {
  TelematicsProvider,
  SamsaraCredentials,
  GeotabCredentials,
  TelematicsCredentials,
  TelematicsConfig,
  VehicleStatus,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  TelematicsEvent,
  WebhookSubscription,
  ITelematicsAdapter,
  RateLimitState,
  CacheOptions,
  PollingConfig,
  PollingState,
  SamsaraVehicle,
  SamsaraLocation,
  SamsaraStats,
  SamsaraSafetyEvent,
  SamsaraFuel,
  GeotabDevice,
  GeotabDeviceStatusInfo,
  GeotabFaultData,
  GeotabStatusData,
  GeotabExceptionEvent,
  CircuitBreakerState,
  CircuitBreakerConfig,
  TelematicsErrorResponse,
  EngineFaultCode,
  BehaviorEventType,
  BehaviorEventSeverity,
  FuelUnit,
} from "./types.js";

// Adapter
export {
  TelematicsAdapter,
  RateLimiter,
  CircuitBreaker,
  SimpleCache,
  createTelematicsAdapter,
} from "./telematics-adapter.js";

// Clients
export { SamsaraClient } from "./samsara-client.js";
export { GeotabClient } from "./geotab-client.js";

// Normalizer
export { TelematicsNormalizer } from "./telematics-normalizer.js";

// Poller
export { TelematicsPoller } from "./telematics-poller.js";
