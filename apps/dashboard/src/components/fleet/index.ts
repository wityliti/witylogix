/**
 * Fleet Management & Telematics Components
 * Barrel export for all fleet components
 */

export { VehicleTrackerMap } from "./vehicle-tracker-map";
export { FuelGauge } from "./fuel-gauge";
export { DiagnosticAlertsPanel } from "./diagnostic-alerts-panel";
export { DriverBehaviorChart } from "./driver-behavior-chart";
export { IdleTimeChart } from "./idle-time-chart";
export { FleetStatsCards } from "./fleet-stats-cards";
export { VehicleStatusBadge } from "./vehicle-status-badge";
export { VehicleStatusCard } from "./vehicle-status-card";
export { FuelConsumptionChart } from "./fuel-consumption-chart";
export { MaintenanceSchedule } from "./maintenance-schedule";
export { SpeedHistoryChart } from "./speed-history-chart";
export { FleetHealthGauge } from "./fleet-health-gauge";

// Types
export type {
  VehiclePosition,
  FleetMapProps,
  FuelGaugeProps,
  DiagnosticAlert,
  DiagnosticAlertsPanelProps,
  DriverBehaviorEvent,
  DriverBehaviorChartProps,
  IdleTimeEntry,
  IdleTimeChartProps,
  FleetStats,
  FleetStatsCardsProps,
  VehicleStatusBadgeProps,
} from "./types";

export type { VehicleStatusCardProps } from "./vehicle-status-card";
export type { FuelConsumptionChartProps } from "./fuel-consumption-chart";
export type { MaintenanceScheduleProps, MaintenanceItem, MaintenanceStatus } from "./maintenance-schedule";
export type { SpeedHistoryChartProps } from "./speed-history-chart";
export type { FleetHealthGaugeProps } from "./fleet-health-gauge";
