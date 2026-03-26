/**
 * Widget System Types
 * Defines all types for customizable dashboard widgets
 */

/**
 * Widget type - different widget components
 */
export type WidgetType =
  | 'stat_card'
  | 'chart_line'
  | 'chart_bar'
  | 'chart_pie'
  | 'table'
  | 'map'
  | 'activity_feed'
  | 'calendar';

/**
 * Widget size in grid units
 */
export type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2';

/**
 * Grid position and dimensions
 */
export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Chart-specific configuration
 */
export interface ChartConfig {
  metric?: string;
  timeRange?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  compareToLastPeriod?: boolean;
  groupBy?: string;
  aggregation?: 'sum' | 'count' | 'average' | 'min' | 'max';
}

/**
 * Table-specific configuration
 */
export interface TableConfig {
  columns?: string[];
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: any[];
}

/**
 * Generic widget configuration
 */
export interface WidgetConfig {
  dataSource?: string;
  refreshInterval?: number; // seconds
  dateRange?: {
    start?: Date | string;
    end?: Date | string;
  };
  chartConfig?: ChartConfig;
  tableConfig?: TableConfig;
  [key: string]: any; // Allow custom config fields
}

/**
 * Widget styling overrides
 */
export interface WidgetStyling {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  customCss?: string;
  [key: string]: any;
}

/**
 * Widget data from database
 */
export interface Widget {
  id: string;
  shopId: string;
  userId: string;
  type: WidgetType;
  name: string;
  config: WidgetConfig;
  position: GridPosition;
  styling: WidgetStyling;
  isActive: boolean;
  targetPages: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to create a new widget
 */
export interface CreateWidgetRequest {
  type: WidgetType;
  name: string;
  position?: GridPosition;
  config?: WidgetConfig;
  styling?: WidgetStyling;
  targetPages?: string[];
}

/**
 * Request to update a widget
 */
export interface UpdateWidgetRequest {
  name?: string;
  type?: WidgetType;
  config?: WidgetConfig;
  position?: GridPosition;
  styling?: WidgetStyling;
  targetPages?: string[];
  isActive?: boolean;
}

/**
 * Widget catalog entry
 */
export interface WidgetCatalogEntry {
  type: WidgetType;
  name: string;
  description: string;
  defaultSize: WidgetSize;
  defaultConfig: WidgetConfig;
  icon: string;
}

/**
 * Widget catalog - predefined widgets
 */
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    type: 'stat_card',
    name: 'Stat Card',
    description: 'Display a single metric with its value and trend',
    defaultSize: '1x1',
    defaultConfig: {
      dataSource: 'orders',
      metric: 'totalRevenue',
      timeRange: 'month',
      compareToLastPeriod: true,
    },
    icon: 'chart-box',
  },
  {
    type: 'chart_line',
    name: 'Line Chart',
    description: 'Display metrics over time as a line chart',
    defaultSize: '2x2',
    defaultConfig: {
      dataSource: 'orders',
      timeRange: 'month',
      groupBy: 'date',
      aggregation: 'sum',
    },
    icon: 'chart-line',
  },
  {
    type: 'chart_bar',
    name: 'Bar Chart',
    description: 'Display categorical data as a bar chart',
    defaultSize: '2x2',
    defaultConfig: {
      dataSource: 'orders',
      timeRange: 'month',
      groupBy: 'status',
      aggregation: 'count',
    },
    icon: 'chart-bar',
  },
  {
    type: 'chart_pie',
    name: 'Pie Chart',
    description: 'Display proportional data as a pie chart',
    defaultSize: '1x2',
    defaultConfig: {
      dataSource: 'orders',
      groupBy: 'status',
    },
    icon: 'chart-pie',
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Display data in tabular format with sorting and filtering',
    defaultSize: '2x2',
    defaultConfig: {
      dataSource: 'orders',
      tableConfig: {
        pageSize: 10,
      },
    },
    icon: 'table',
  },
  {
    type: 'map',
    name: 'Map',
    description: 'Display delivery routes or location-based data on a map',
    defaultSize: '2x2',
    defaultConfig: {
      dataSource: 'routes',
    },
    icon: 'map',
  },
  {
    type: 'activity_feed',
    name: 'Activity Feed',
    description: 'Show recent orders, shipments, and system events',
    defaultSize: '1x2',
    defaultConfig: {
      dataSource: 'orders',
      refreshInterval: 30,
    },
    icon: 'feed',
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'Display scheduled deliveries and events in calendar view',
    defaultSize: '2x2',
    defaultConfig: {
      dataSource: 'routes',
    },
    icon: 'calendar',
  },
];

/**
 * Default grid layout configuration
 */
export const DEFAULT_GRID_COLS = 4;
export const DEFAULT_GRID_ROWS = 3;
export const DEFAULT_GRID_WIDTH = DEFAULT_GRID_COLS;
export const DEFAULT_GRID_HEIGHT = DEFAULT_GRID_ROWS;

/**
 * Custom error for widget not found
 */
export class WidgetNotFoundError extends Error {
  constructor(widgetId: string) {
    super(`Widget not found: ${widgetId}`);
    this.name = 'WidgetNotFoundError';
  }
}

/**
 * Custom error for widget validation
 */
export class WidgetValidationError extends Error {
  constructor(message: string) {
    super(`Widget validation error: ${message}`);
    this.name = 'WidgetValidationError';
  }
}
