/**
 * Route Analytics Types
 *
 * TypeScript types for route analytics dashboard, API responses,
 * and component props.
 */

import type { TimeRange } from "./types.js";

/**
 * Summary metrics for route performance dashboard
 */
export interface RoutePerformanceSummary {
  onTimePercentage: number;
  avgDeliveryTime: number; // minutes
  co2Savings: number; // kg
  slaCompliance: number;
  totalDeliveries: number;
  period: "24h" | "7d" | "30d";
}

/**
 * Time-series data point for planned vs actual chart
 */
export interface PlannedVsActualDataPoint {
  timestamp: string; // ISO date
  plannedDuration: number; // minutes
  actualDuration: number; // minutes
  variance: number;
  onTimePercentage: number;
  deliveryCount: number;
}

/**
 * Driver leaderboard entry with full scorecard
 */
export interface DriverLeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string;
  driverAvatarUrl?: string;
  deliveriesCompleted: number;
  onTimePercentage: number;
  avgTimePerStop: number;
  customerRatingAvg: number;
  firstAttemptRate: number;
  compositeScore: number;
  trend: "up" | "down" | "neutral";
  trendValue?: number; // percentage change from previous period
}

/**
 * Efficiency heatmap cell
 */
export interface EfficiencyHeatmapCell {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0
  dayName: string;
  hour: number; // 0-23
  efficiency: number; // 0-100
  deliveryCount: number;
  avgTimeVariance: number;
}

/**
 * CO2 tracker data
 */
export interface CO2TrackerData {
  plannedTotal: number; // kg
  actualTotal: number; // kg
  savedTotal: number; // kg
  targetSavings: number; // kg
  trend: Array<{
    date: string;
    value: number;
  }>;
  vehicleBreakdown: Array<{
    type: string;
    plannedCO2: number;
    actualCO2: number;
    savedCO2: number;
  }>;
}

/**
 * SLA compliance breakdown
 */
export interface SLAComplianceData {
  overall: number; // percentage
  byTier: {
    premium: {
      percentage: number;
      count: number;
    };
    standard: {
      percentage: number;
      count: number;
    };
    economy: {
      percentage: number;
      count: number;
    };
  };
  trend: Array<{
    date: string;
    overall: number;
    premium: number;
    standard: number;
    economy: number;
  }>;
}

/**
 * Route performance filter options
 */
export interface RoutePerformanceFilters {
  dateRange: TimeRange;
  driverIds?: string[];
  routeIds?: string[];
  zoneIds?: string[];
  vehicleTypes?: string[];
  slaTiers?: Array<"premium" | "standard" | "economy">;
  minOnTimePercentage?: number;
}

/**
 * API response for route performance summary
 */
export interface RoutePerformanceSummaryResponse {
  data: RoutePerformanceSummary;
  timestamp: string;
  cached: boolean;
}

/**
 * API response for planned vs actual data
 */
export interface PlannedVsActualResponse {
  data: PlannedVsActualDataPoint[];
  dateRange: TimeRange;
  timestamp: string;
}

/**
 * API response for driver leaderboard
 */
export interface DriverLeaderboardResponse {
  data: DriverLeaderboardEntry[];
  totalCount: number;
  period: "24h" | "7d" | "30d";
  timestamp: string;
}

/**
 * API response for efficiency heatmap
 */
export interface EfficiencyHeatmapResponse {
  data: EfficiencyHeatmapCell[];
  dateRange: TimeRange;
  timestamp: string;
}

/**
 * API response for CO2 tracking
 */
export interface CO2TrackerResponse {
  data: CO2TrackerData;
  dateRange: TimeRange;
  timestamp: string;
}

/**
 * API response for SLA compliance
 */
export interface SLAComplianceResponse {
  data: SLAComplianceData;
  dateRange: TimeRange;
  timestamp: string;
}

/**
 * Query parameters for analytics endpoints
 */
export interface AnalyticsQueryParams {
  dateFrom?: string;
  dateTo?: string;
  granularity?: "hourly" | "daily" | "weekly" | "monthly";
  driverId?: string;
  routeId?: string;
  zoneId?: string;
  vehicleType?: string;
  slaTier?: "premium" | "standard" | "economy";
  limit?: number;
  offset?: number;
}

/**
 * Component props for planned vs actual chart
 */
export interface PlannedActualChartProps {
  data: PlannedVsActualDataPoint[];
  dateRange: TimeRange;
  isLoading?: boolean;
  error?: string;
  onDateRangeChange?: (range: TimeRange) => void;
}

/**
 * Component props for driver leaderboard
 */
export interface DriverLeaderboardProps {
  data: DriverLeaderboardEntry[];
  dateRange: TimeRange;
  period: "24h" | "7d" | "30d";
  onPeriodChange?: (period: "24h" | "7d" | "30d") => void;
  onDriverSelect?: (driverId: string) => void;
  isLoading?: boolean;
}

/**
 * Component props for efficiency heatmap
 */
export interface EfficiencyHeatmapProps {
  data: EfficiencyHeatmapCell[];
  dateRange: TimeRange;
  isLoading?: boolean;
  onCellClick?: (cell: EfficiencyHeatmapCell) => void;
}

/**
 * Component props for CO2 tracker
 */
export interface CO2TrackerProps {
  data: CO2TrackerData;
  dateRange: TimeRange;
  isLoading?: boolean;
  onExport?: () => void;
}

/**
 * Component props for SLA compliance
 */
export interface SLAComplianceProps {
  data: SLAComplianceData;
  dateRange: TimeRange;
  isLoading?: boolean;
}

/**
 * Statistics card for dashboard
 */
export interface StatisticsCard {
  label: string;
  value: string | number;
  unit?: string;
  change?: {
    value: number;
    label: string;
  };
  accentColor?: string;
  status?: "up" | "down" | "neutral";
}
