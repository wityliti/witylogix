/**
 * Shared types for analytics components
 */

export interface DataPoint {
  label: string;
  value: number;
}

export interface Series extends DataPoint {
  color?: string;
}

export interface ChartDataPoint {
  x: string | number;
  y: number;
  [key: string]: string | number;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartConfig {
  xLabel?: string;
  yLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  colors?: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

export interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  formatter?: (value: any) => string | React.ReactNode;
  sortable?: boolean;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

export interface HeatmapData {
  value: number;
  tooltip?: string;
}

export type TooltipRenderFn = (data: any) => React.ReactNode;
