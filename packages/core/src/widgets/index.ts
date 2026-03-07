/**
 * Widgets Module
 * Export public API
 */

export {
  WidgetManager,
} from './widget-manager';

export type {
  Widget,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  GridPosition,
  WidgetConfig,
  WidgetStyling,
  ChartConfig,
  TableConfig,
  WidgetCatalogEntry,
  WidgetType,
  WidgetSize,
} from './types';

export {
  WIDGET_CATALOG,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  WidgetNotFoundError,
  WidgetValidationError,
} from './types';
