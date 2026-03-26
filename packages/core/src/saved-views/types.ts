/**
 * Saved Views Types
 * Defines all types for the saved views system
 * Allows users to save and share custom table views with filters, sorts, and column visibility
 */

/**
 * Filter operators for comparing values
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Supported table names for views
 */
export type TableName =
  | 'orders'
  | 'shipments'
  | 'drivers'
  | 'routes'
  | 'customers'
  | 'inventory';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * A single filter condition for a view
 */
export interface ViewFilter {
  column: string;
  operator: FilterOperator;
  value: string | string[] | number | boolean | null;
}

/**
 * Sort configuration for a view
 */
export interface SortConfig {
  column: string;
  direction: SortDirection;
}

/**
 * Column visibility settings
 */
export type ColumnVisibility = Record<string, boolean>;

/**
 * Saved view data from database
 */
export interface SavedView {
  id: string;
  shopId: string;
  userId: string;
  name: string;
  tableName: TableName;
  filters: ViewFilter[];
  sortConfig: SortConfig | null;
  columnVisibility: ColumnVisibility | null;
  isDefault: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to create a new saved view
 */
export interface CreateViewRequest {
  name: string;
  tableName: TableName;
  filters?: ViewFilter[];
  sortConfig?: SortConfig | null;
  columnVisibility?: ColumnVisibility | null;
  isShared?: boolean;
}

/**
 * Request to update an existing view
 */
export interface UpdateViewRequest {
  name?: string;
  filters?: ViewFilter[];
  sortConfig?: SortConfig | null;
  columnVisibility?: ColumnVisibility | null;
  isShared?: boolean;
}

/**
 * Available columns per table
 */
export const TABLE_COLUMNS: Record<TableName, string[]> = {
  orders: [
    'id',
    'orderNumber',
    'status',
    'customer',
    'total',
    'items',
    'createdAt',
    'updatedAt',
    'shippingAddress',
    'notes',
  ],
  shipments: [
    'id',
    'shipmentNumber',
    'orderId',
    'status',
    'carrier',
    'trackingNumber',
    'estimatedDelivery',
    'actualDelivery',
    'cost',
    'weight',
  ],
  drivers: [
    'id',
    'name',
    'phone',
    'email',
    'status',
    'vehicle',
    'licensePlate',
    'currentLocation',
    'totalDeliveries',
    'averageRating',
  ],
  routes: [
    'id',
    'routeNumber',
    'driverId',
    'status',
    'stops',
    'distance',
    'duration',
    'startTime',
    'endTime',
    'efficiency',
  ],
  customers: [
    'id',
    'name',
    'email',
    'phone',
    'address',
    'city',
    'country',
    'totalOrders',
    'totalSpent',
    'createdAt',
  ],
  inventory: [
    'id',
    'productId',
    'productName',
    'location',
    'quantity',
    'reserved',
    'available',
    'reorderPoint',
    'lastRestocked',
    'sku',
  ],
};

/**
 * Custom error for view not found
 */
export class ViewNotFoundError extends Error {
  constructor(viewId: string) {
    super(`View not found: ${viewId}`);
    this.name = 'ViewNotFoundError';
  }
}

/**
 * Custom error for view validation
 */
export class ViewValidationError extends Error {
  constructor(message: string) {
    super(`View validation error: ${message}`);
    this.name = 'ViewValidationError';
  }
}
