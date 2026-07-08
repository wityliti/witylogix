/**
 * Demand visualization component types
 */

export interface Zone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface DemandPrediction {
  zoneId: string;
  predictedVolume: number;
  confidence: number;
  timestamp: Date;
}

export interface ZoneHeatmapData {
  zone: Zone;
  predictedDemand: number;
  confidence: number;
  historicalAverage?: number;
}

export interface DemandForecastData {
  timestamp: Date;
  predicted: number;
  actual?: number;
  confidence?: number;
  anomaly?: boolean;
}

export interface CapacityData {
  zoneId: string;
  zoneName: string;
  currentCapacity: number;
  recommendedCapacity: number;
  utilizationRate: number;
}

export interface DriverScheduleSlot {
  driverId: string;
  driverName: string;
  timeSlot: Date;
  zoneId?: string;
  zoneName?: string;
  utilizationRate: number;
}

export interface DemandChartConfig {
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  timeFormat?: "hourly" | "daily";
}

export interface ZoneHeatmapProps {
  data: ZoneHeatmapData[];
  onZoneSelect?: (zoneId: string) => void;
  cellSize?: number;
  showLegend?: boolean;
  className?: string;
}

export interface DemandForecastChartProps {
  data: DemandForecastData[];
  onAnomalyClick?: (index: number, data: DemandForecastData) => void;
  config?: DemandChartConfig;
  className?: string;
}

export interface CapacityBarChartProps {
  data: CapacityData[];
  onBarClick?: (zoneId: string) => void;
  className?: string;
}

export interface ScheduleGridProps {
  slots: DriverScheduleSlot[];
  onSlotClick?: (slot: DriverScheduleSlot) => void;
  className?: string;
}
