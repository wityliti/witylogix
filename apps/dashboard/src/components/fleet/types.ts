/**
 * Fleet Management & Telematics Types
 * Type definitions for all fleet components
 */

/**
 * Vehicle position and status data
 */
export interface VehiclePosition {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // 0-360 degrees
  status: "moving" | "idle" | "stopped" | "offline" | "maintenance";
  lastUpdate: string; // ISO string
  driver?: string;
  fuelLevel?: number; // 0-100
  temperature?: number;
  odometer?: number; // km
}

/**
 * Fleet Map component props
 */
export interface FleetMapProps {
  vehicles: VehiclePosition[];
  onVehicleClick?: (vehicle: VehiclePosition) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  selectedVehicleId?: string;
  className?: string;
}

/**
 * Fuel gauge component props
 */
export interface FuelGaugeProps {
  fuelLevel: number; // 0-100
  tankCapacity?: number; // liters
  animated?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Diagnostic alert
 */
export interface DiagnosticAlert {
  id: string;
  vehicleId: string;
  vehicleName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string; // ISO string
  dismissed?: boolean;
}

/**
 * Diagnostic alerts panel props
 */
export interface DiagnosticAlertsPanelProps {
  alerts: DiagnosticAlert[];
  onDismiss?: (alertId: string) => void;
  filterBySeverity?: "critical" | "warning" | "info" | "all";
  maxHeight?: number;
  className?: string;
}

/**
 * Driver behavior event
 */
export interface DriverBehaviorEvent {
  date: string; // YYYY-MM-DD
  harshBraking: number;
  rapidAcceleration: number;
  speeding: number;
  sharpTurns: number;
}

/**
 * Driver behavior chart props
 */
export interface DriverBehaviorChartProps {
  data: DriverBehaviorEvent[];
  height?: number;
  showLegend?: boolean;
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  className?: string;
}

/**
 * Idle time entry
 */
export interface IdleTimeEntry {
  vehicleId: string;
  vehicleName: string;
  idleHours: number;
}

/**
 * Idle time chart props
 */
export interface IdleTimeChartProps {
  data: IdleTimeEntry[];
  height?: number;
  fleetAverage?: number;
  sortBy?: "idle" | "name";
  className?: string;
}

/**
 * Fleet statistics
 */
export interface FleetStats {
  totalVehicles: number;
  activeNow: number;
  avgSpeed: number; // km/h
  totalDistance: number; // km
  fuelConsumed: number; // liters
  alertsCount: number;
  totalDistanceTrend?: number; // percentage change
  fuelConsumedTrend?: number; // percentage change
  alertsTrend?: number; // percentage change
}

/**
 * Fleet stats cards props
 */
export interface FleetStatsCardsProps {
  stats: FleetStats;
  className?: string;
}

/**
 * Vehicle status badge props
 */
export interface VehicleStatusBadgeProps {
  status: "moving" | "idle" | "stopped" | "offline" | "maintenance";
  className?: string;
}
