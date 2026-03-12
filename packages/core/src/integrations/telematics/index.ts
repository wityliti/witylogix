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
export { FlespiClient } from "./flespi-client.js";
export { VerizonConnectClient } from "./verizon-connect-client.js";
export { TrimbleClient } from "./trimble-client.js";
export { FleetioClient } from "./fleetio-client.js";

// Aggregator & Stream
export { TelematicsAggregator } from "./telematics-aggregator.js";
export type {
  AggregatedVehicle,
  VehicleDeduplicationRule,
  FleetHealthScore,
  AggregatedAlert,
} from "./telematics-aggregator.js";
export { TelematicsStream } from "./telematics-stream.js";
export type {
  StreamConfig,
  BufferedPosition,
  GeofenceEvent,
  DeviceStreamStatus,
  StreamEvent,
} from "./telematics-stream.js";

// Normalizer
export { TelematicsNormalizer } from "./telematics-normalizer.js";

// Poller
export { TelematicsPoller } from "./telematics-poller.js";
