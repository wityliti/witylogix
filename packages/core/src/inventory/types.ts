/**
 * Inventory Management Types
 * Defines all types for inventory operations without external dependencies
 */

/**
 * Types of inventory movements
 */
export type MovementType = 'RECEIVE' | 'SHIP' | 'ADJUST' | 'TRANSFER' | 'RESERVE' | 'RELEASE';

/**
 * Inventory level at a location
 */
export interface InventoryLevel {
  itemId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  quantity: number;           // Physical quantity on hand
  reservedQuantity: number;   // Quantity reserved for orders
  reorderPoint: number;       // Low stock threshold
  reorderQuantity: number;    // Suggested reorder amount
  availableQuantity: number;  // quantity - reservedQuantity
}

/**
 * Stock movement record
 */
export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference?: string;         // PO#, Order#, etc
  createdAt: Date;
}

/**
 * Low stock alert
 */
export interface LowStockAlert {
  itemId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  currentQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  suggestedOrderQuantity: number; // reorderQuantity - currentQuantity
  daysUntilStockout?: number;     // Estimated days until zero
}

/**
 * Request to adjust stock
 */
export interface AdjustStockRequest {
  itemId: string;
  quantity: number;           // Positive or negative
  type: MovementType;
  reference?: string;
}

/**
 * Request to transfer stock between locations
 */
export interface TransferStockRequest {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reference?: string;
}

/**
 * Request to reserve stock for an order
 */
export interface ReserveStockRequest {
  itemId: string;
  quantity: number;
  orderId: string;
}

/**
 * Response from stock operation
 */
export interface StockOperationResult {
  success: boolean;
  message?: string;
  itemId?: string;
  previousQuantity?: number;
  newQuantity?: number;
  movementId?: string;
}

/**
 * Inventory data from database
 */
export interface InventoryItemData {
  id: string;
  shopId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inventory movement data from database
 */
export interface InventoryMovementData {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  reference?: string;
  createdAt: Date;
}

/**
 * Collection data from database
 */
export interface CollectionData {
  id: string;
  shopId: string;
  title: string;
  handle: string;
  shopifyId?: string;
  productIds: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Options for getting low stock alerts
 */
export interface LowStockAlertOptions {
  shopId: string;
  locationId?: string;
  includeZeroStock?: boolean;
  sortBy?: 'daysUntilStockout' | 'percentageOfReorderPoint';
}
