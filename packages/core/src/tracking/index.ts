/**
 * Real-time Tracking Module - GPS streaming and live customer updates.
 *
 * Provides comprehensive driver location tracking, ETA calculation,
 * and geofence-based event detection for delivery operations.
 *
 * @module tracking
 */

export {
  type GPSUpdate,
  type DriverLocation,
  type GeofenceEvent,
  type Geofence,
  type ETAResult,
  GPSTrackingService,
} from "./gps-service";

export {
  type ETAResult as ETACalculatorResult,
  type DeliveryRecord,
  type ETAConfig,
  ETACalculator,
} from "./eta-calculator";

export {
  type Geofence as GeofenceDefinition,
  type GeofenceEvent as GeofenceEventType,
  type ProximityThreshold,
  GeofenceManager,
} from "./geofence";
