/**
 * Inventory Manager
 * Handles all inventory operations including stock tracking, movements, and alerts
 * Pure TypeScript implementation without external dependencies
 */

import {
  InventoryLevel,
  StockMovement,
  LowStockAlert,
  AdjustStockRequest,
  TransferStockRequest,
  ReserveStockRequest,
  StockOperationResult,
  InventoryItemData,
  InventoryMovementData,
  LowStockAlertOptions,
  MovementType,
} from "./types";

/**
 * Inventory Manager
 * Provides methods for inventory operations
 * Note: This is a business logic layer - actual persistence is handled by the caller
 */
export class InventoryManager {
  /**
   * Get current inventory level for an item
   * @param items List of inventory items from database
   * @param itemId ID of item to get level for
   * @returns Inventory level or null if not found
   */
  checkStock(
    items: InventoryItemData[],
    itemId: string,
  ): InventoryLevel | null {
    const item = items.find((i) => i.id === itemId);

    if (!item) {
      return null;
    }

    const availableQuantity = item.quantity - item.reservedQuantity;

    return {
      itemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      locationId: item.locationId,
      quantity: item.quantity,
      reservedQuantity: item.reservedQuantity,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      availableQuantity: Math.max(0, availableQuantity),
    };
  }

  /**
   * Check if enough stock is available
   * @param items List of inventory items
   * @param itemId Item to check
   * @param quantity Quantity needed
   * @returns True if stock is available
   */
  hasStock(
    items: InventoryItemData[],
    itemId: string,
    quantity: number,
  ): boolean {
    const level = this.checkStock(items, itemId);
    if (!level) {
      return false;
    }
    return level.availableQuantity >= quantity;
  }

  /**
   * Adjust stock quantity
   * @param item Item to adjust
   * @param quantity Amount to adjust (positive or negative)
   * @param type Movement type
   * @param reference Optional reference ID
   * @returns Operation result
   */
  adjustStock(
    item: InventoryItemData,
    quantity: number,
    type: MovementType,
    reference?: string,
  ): { item: InventoryItemData; movement: InventoryMovementData } {
    const previousQuantity = item.quantity;
    const newQuantity = Math.max(0, previousQuantity + quantity);

    // Create movement record
    const movement: InventoryMovementData = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId: item.id,
      type,
      quantity,
      reference,
      createdAt: new Date(),
    };

    // Update item
    const updatedItem: InventoryItemData = {
      ...item,
      quantity: newQuantity,
      updatedAt: new Date(),
    };

    return { item: updatedItem, movement };
  }

  /**
   * Transfer stock between locations
   * @param fromItem Item at source location
   * @param toItem Item at destination location
   * @param quantity Amount to transfer
   * @param reference Optional reference
   * @returns Updated items and movements
   */
  transferStock(
    fromItem: InventoryItemData,
    toItem: InventoryItemData,
    quantity: number,
    reference?: string,
  ): {
    fromItem: InventoryItemData;
    toItem: InventoryItemData;
    fromMovement: InventoryMovementData;
    toMovement: InventoryMovementData;
  } {
    // Validate transfer
    if (fromItem.quantity < quantity) {
      throw new Error(
        `Insufficient stock at source location. Available: ${fromItem.quantity}, Requested: ${quantity}`,
      );
    }

    // Create movements
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fromMovement: InventoryMovementData = {
      id: movementId,
      itemId: fromItem.id,
      type: "TRANSFER",
      quantity: -quantity,
      toLocationId: toItem.locationId,
      reference,
      createdAt: new Date(),
    };

    const toMovement: InventoryMovementData = {
      id: movementId,
      itemId: toItem.id,
      type: "TRANSFER",
      quantity,
      fromLocationId: fromItem.locationId,
      reference,
      createdAt: new Date(),
    };

    // Update items
    const updatedFromItem: InventoryItemData = {
      ...fromItem,
      quantity: fromItem.quantity - quantity,
      updatedAt: new Date(),
    };

    const updatedToItem: InventoryItemData = {
      ...toItem,
      quantity: toItem.quantity + quantity,
      updatedAt: new Date(),
    };

    return {
      fromItem: updatedFromItem,
      toItem: updatedToItem,
      fromMovement,
      toMovement,
    };
  }

  /**
   * Get low stock alerts
   * @param items List of all inventory items
   * @param options Options for filtering
   * @returns Array of low stock alerts
   */
  getLowStockAlerts(
    items: InventoryItemData[],
    options: LowStockAlertOptions,
  ): LowStockAlert[] {
    const alerts: LowStockAlert[] = [];

    for (const item of items) {
      // Filter by shopId
      if (item.shopId !== options.shopId) {
        continue;
      }

      // Filter by locationId if specified
      if (options.locationId && item.locationId !== options.locationId) {
        continue;
      }

      // Check if below reorder point
      const isLowStock = item.quantity <= item.reorderPoint;

      // Filter zero stock based on option
      if (item.quantity === 0 && !options.includeZeroStock) {
        if (!isLowStock) {
          continue;
        }
      }

      if (isLowStock) {
        alerts.push({
          itemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          locationId: item.locationId,
          currentQuantity: item.quantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          suggestedOrderQuantity: Math.max(
            0,
            item.reorderQuantity - item.quantity,
          ),
        });
      }
    }

    // Sort by option
    if (options.sortBy === "percentageOfReorderPoint") {
      alerts.sort((a, b) => {
        const aPercent = (a.currentQuantity / a.reorderPoint) * 100;
        const bPercent = (b.currentQuantity / b.reorderPoint) * 100;
        return aPercent - bPercent;
      });
    }

    return alerts;
  }

  /**
   * Reserve stock for an order
   * @param item Item to reserve from
   * @param quantity Quantity to reserve
   * @param orderId Order ID for tracking
   * @returns Updated item and success status
   */
  reserveStock(
    item: InventoryItemData,
    quantity: number,
    orderId: string,
  ): StockOperationResult {
    const availableQuantity = item.quantity - item.reservedQuantity;

    if (availableQuantity < quantity) {
      return {
        success: false,
        message: `Cannot reserve ${quantity} units. Available: ${availableQuantity}`,
        itemId: item.id,
      };
    }

    const updatedItem: InventoryItemData = {
      ...item,
      reservedQuantity: item.reservedQuantity + quantity,
      updatedAt: new Date(),
    };

    return {
      success: true,
      itemId: item.id,
      previousQuantity: item.quantity,
      newQuantity: updatedItem.quantity,
    };
  }

  /**
   * Release a stock reservation
   * @param item Item to release from
   * @param quantity Quantity to release
   * @param orderId Order ID that held the reservation
   * @returns Updated item and success status
   */
  releaseReservation(
    item: InventoryItemData,
    quantity: number,
    orderId: string,
  ): StockOperationResult {
    if (item.reservedQuantity < quantity) {
      return {
        success: false,
        message: `Cannot release ${quantity} units. Reserved: ${item.reservedQuantity}`,
        itemId: item.id,
      };
    }

    const updatedItem: InventoryItemData = {
      ...item,
      reservedQuantity: Math.max(0, item.reservedQuantity - quantity),
      updatedAt: new Date(),
    };

    return {
      success: true,
      itemId: item.id,
      previousQuantity: item.reservedQuantity,
      newQuantity: updatedItem.reservedQuantity,
    };
  }

  /**
   * Get inventory summary for shop
   * @param items Items to summarize
   * @param shopId Shop ID
   * @returns Summary statistics
   */
  getShopInventorySummary(
    items: InventoryItemData[],
    shopId: string,
  ): {
    totalItems: number;
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
    lowStockCount: number;
    outOfStockCount: number;
  } {
    const shopItems = items.filter((i) => i.shopId === shopId);

    let totalQuantity = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of shopItems) {
      totalQuantity += item.quantity;
      totalReserved += item.reservedQuantity;

      if (item.quantity === 0) {
        outOfStockCount++;
      } else if (item.quantity <= item.reorderPoint) {
        lowStockCount++;
      }
    }

    return {
      totalItems: shopItems.length,
      totalQuantity,
      totalReserved,
      totalAvailable: totalQuantity - totalReserved,
      lowStockCount,
      outOfStockCount,
    };
  }

  /**
   * Calculate reorder cost estimate
   * @param alerts Low stock alerts
   * @param costPerUnit Cost per unit (optional)
   * @returns Total cost estimate
   */
  calculateReorderCost(
    alerts: LowStockAlert[],
    costPerUnit?: (productId: string, variantId?: string) => number,
  ): number {
    let totalCost = 0;

    for (const alert of alerts) {
      const quantity = alert.suggestedOrderQuantity;
      const unitCost = costPerUnit
        ? costPerUnit(alert.productId, alert.variantId)
        : 0;
      totalCost += quantity * unitCost;
    }

    return totalCost;
  }

  /**
   * Validate stock movement
   * @param movement Movement to validate
   * @param item Item being moved
   * @returns Array of validation errors
   */
  validateMovement(
    movement: Omit<StockMovement, "id" | "createdAt">,
    item: InventoryItemData,
  ): string[] {
    const errors: string[] = [];

    if (!movement.itemId) {
      errors.push("Movement must have itemId");
    }

    if (!movement.type) {
      errors.push("Movement must have a type");
    }

    if (!Number.isInteger(movement.quantity)) {
      errors.push("Quantity must be an integer");
    }

    // For negative adjustments, check available quantity
    if (movement.quantity < 0 && movement.type === "ADJUST") {
      if (item.quantity < Math.abs(movement.quantity)) {
        errors.push(
          `Cannot remove ${Math.abs(movement.quantity)} units. Available: ${item.quantity}`,
        );
      }
    }

    return errors;
  }
}

/**
 * Export singleton instance
 */
export const inventoryManager = new InventoryManager();
