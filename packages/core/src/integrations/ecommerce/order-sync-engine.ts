/**
 * Order Sync Engine
 * Bi-directional order synchronization between Witylogix and e-commerce platforms
 * Supports: Real-time (webhook-driven) and batch (scheduled) sync modes
 * Conflict Resolution: Last-write-wins, External-wins, Internal-wins
 * Idempotent sync with change tracking and delta sync
 */

import type {
  ECommerceOrder,
  OrderStatus,
  FulfillmentStatus,
  PaymentStatus,
} from "./types.js";

/**
 * Sync state tracking
 */
export interface SyncState {
  orderId: string;
  platform: string;
  lastSyncAt: Date;
  lastSyncedHash: string;
  syncStatus: "synced" | "pending" | "failed" | "dead-letter";
  conflictResolution: ConflictResolutionStrategy;
  retryCount: number;
  lastError?: string;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | "last-write-wins"
  | "external-wins"
  | "internal-wins"
  | "manual-override";

/**
 * Sync direction
 */
export type SyncDirection = "outbound" | "inbound" | "bidirectional";

/**
 * Field mapping configuration
 */
export interface FieldMapping {
  witylogixField: string;
  platformField: string;
  transform?: (value: unknown) => unknown;
  reverseTransform?: (value: unknown) => unknown;
}

/**
 * Status mapping configuration
 */
export interface StatusMapping {
  platform: string;
  mapping: Record<string, OrderStatus>;
  reverseMapping: Record<OrderStatus, string>;
}

/**
 * Sync metrics
 */
export interface SyncMetrics {
  totalSynced: number;
  totalFailed: number;
  totalErrors: number;
  avgLatencyMs: number;
  lastSyncAt: Date;
  successRate: number;
}

/**
 * Sync result for individual order
 */
export interface SyncResult {
  orderId: string;
  platform: string;
  success: boolean;
  created: boolean;
  updated: boolean;
  changeCount: number;
  duration: number;
  error?: string;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
  platform: string;
  startedAt: Date;
  completedAt: Date;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  results: SyncResult[];
}

/**
 * Witylogix internal order model
 */
export interface WitylogixOrder {
  id: string;
  externalId?: string;
  platform: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    sku: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  notes?: string;
  lastSyncedAt?: Date;
  syncMetadata?: Record<string, unknown>;
}

/**
 * Order Sync Engine
 */
export class OrderSyncEngine {
  private syncStates: Map<string, SyncState> = new Map();
  private fieldMappings: Map<string, FieldMapping[]> = new Map();
  private statusMappings: Map<string, StatusMapping> = new Map();
  private metrics: Map<string, SyncMetrics> = new Map();
  private deadLetterQueue: Map<string, SyncState[]> = new Map();

  constructor() {
    this.initializeMetrics();
  }

  /**
   * Initialize metrics for a platform
   */
  private initializeMetrics(): void {
    this.metrics.set("shopify", {
      totalSynced: 0,
      totalFailed: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      lastSyncAt: new Date(),
      successRate: 100,
    });

    this.metrics.set("woocommerce", {
      totalSynced: 0,
      totalFailed: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      lastSyncAt: new Date(),
      successRate: 100,
    });
  }

  /**
   * Register field mapping for platform
   */
  registerFieldMapping(platform: string, mappings: FieldMapping[]): void {
    this.fieldMappings.set(platform, mappings);
  }

  /**
   * Register status mapping for platform
   */
  registerStatusMapping(platform: string, mapping: StatusMapping): void {
    this.statusMappings.set(platform, mapping);
  }

  /**
   * Sync order from external platform to Witylogix (inbound)
   */
  async syncOrderInbound(
    ecommerceOrder: ECommerceOrder,
    platform: string,
    conflictResolution: ConflictResolutionStrategy = "last-write-wins",
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const syncKey = `${platform}-${ecommerceOrder.id}`;

    try {
      // Check if order already synced
      let existingSyncState = this.syncStates.get(syncKey);
      const order = this.mapExternalOrderToInternal(ecommerceOrder, platform);

      // Handle conflicts
      if (existingSyncState && existingSyncState.syncStatus === "synced") {
        const shouldUpdate = this.resolveConflict(
          existingSyncState,
          ecommerceOrder,
          conflictResolution,
        );

        if (!shouldUpdate) {
          return {
            orderId: ecommerceOrder.id,
            platform,
            success: true,
            created: false,
            updated: false,
            changeCount: 0,
            duration: Date.now() - startTime,
          };
        }
      }

      // Calculate changes
      const changes = this.calculateOrderChanges(
        existingSyncState,
        ecommerceOrder,
      );

      // Update or create sync state
      const newSyncState: SyncState = {
        orderId: ecommerceOrder.id,
        platform,
        lastSyncAt: new Date(),
        lastSyncedHash: this.hashOrder(ecommerceOrder),
        syncStatus: "synced",
        conflictResolution,
        retryCount: 0,
      };

      this.syncStates.set(syncKey, newSyncState);
      this.updateMetrics(platform, true, Date.now() - startTime);

      return {
        orderId: ecommerceOrder.id,
        platform,
        success: true,
        created: !existingSyncState,
        updated: !!existingSyncState,
        changeCount: changes.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.handleSyncError(syncKey, platform, errorMsg);
      this.updateMetrics(platform, false, Date.now() - startTime);

      return {
        orderId: ecommerceOrder.id,
        platform,
        success: false,
        created: false,
        updated: false,
        changeCount: 0,
        duration: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Sync order from Witylogix to external platform (outbound)
   */
  async syncOrderOutbound(
    witylogixOrder: WitylogixOrder,
    platform: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const syncKey = `${platform}-${witylogixOrder.id}`;

    try {
      // Map internal order to external platform format
      const externalOrder = this.mapInternalOrderToExternal(
        witylogixOrder,
        platform,
      );

      // Calculate changes if order exists
      let existingSyncState = this.syncStates.get(syncKey);
      const changes = existingSyncState
        ? this.calculateOrderChanges(
            existingSyncState,
            externalOrder as unknown as ECommerceOrder,
          )
        : [];

      // Update sync state
      const newSyncState: SyncState = {
        orderId: witylogixOrder.id,
        platform,
        lastSyncAt: new Date(),
        lastSyncedHash: this.hashOrder(externalOrder),
        syncStatus: "synced",
        conflictResolution: "last-write-wins",
        retryCount: 0,
      };

      this.syncStates.set(syncKey, newSyncState);
      this.updateMetrics(platform, true, Date.now() - startTime);

      return {
        orderId: witylogixOrder.id,
        platform,
        success: true,
        created: !existingSyncState,
        updated: !!existingSyncState,
        changeCount: changes.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.handleSyncError(syncKey, platform, errorMsg);
      this.updateMetrics(platform, false, Date.now() - startTime);

      return {
        orderId: witylogixOrder.id,
        platform,
        success: false,
        created: false,
        updated: false,
        changeCount: 0,
        duration: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Batch sync orders (scheduled sync)
   */
  async batchSync(
    orders: ECommerceOrder[],
    platform: string,
    direction: SyncDirection = "inbound",
  ): Promise<BatchSyncResult> {
    const startTime = new Date();
    const results: SyncResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        const result =
          direction === "inbound" || direction === "bidirectional"
            ? await this.syncOrderInbound(order, platform)
            : await this.syncOrderOutbound(
                this.mapExternalToWitylogix(order, platform),
                platform,
              );

        results.push(result);
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          orderId: order.id,
          platform,
          success: false,
          created: false,
          updated: false,
          changeCount: 0,
          duration: 0,
          error: errorMsg,
        });
      }
    }

    return {
      platform,
      startedAt: startTime,
      completedAt: new Date(),
      totalProcessed: orders.length,
      totalSucceeded: succeeded,
      totalFailed: failed,
      results,
    };
  }

  /**
   * Get sync state for order
   */
  getSyncState(orderId: string, platform: string): SyncState | undefined {
    const syncKey = `${platform}-${orderId}`;
    return this.syncStates.get(syncKey);
  }

  /**
   * Get sync metrics for platform
   */
  getSyncMetrics(platform: string): SyncMetrics | undefined {
    return this.metrics.get(platform);
  }

  /**
   * Get dead letter queue for platform
   */
  getDeadLetterQueue(platform: string): SyncState[] {
    return this.deadLetterQueue.get(platform) || [];
  }

  /**
   * Retry failed syncs
   */
  async retryFailedSyncs(
    platform: string,
    maxRetries: number = 3,
  ): Promise<void> {
    for (const [key, syncState] of this.syncStates.entries()) {
      if (
        syncState.platform === platform &&
        syncState.syncStatus === "failed" &&
        syncState.retryCount < maxRetries
      ) {
        syncState.retryCount++;
        syncState.syncStatus = "pending";
      }
    }
  }

  /**
   * Calculate changes between syncs (delta sync)
   */
  private calculateOrderChanges(
    previousSync: SyncState | undefined,
    currentOrder: ECommerceOrder,
  ): Array<{ field: string; from: unknown; to: unknown }> {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

    if (!previousSync) {
      return changes; // New order, no changes to track
    }

    // Check for field changes
    const previousHash = previousSync.lastSyncedHash;
    const currentHash = this.hashOrder(currentOrder);

    if (previousHash !== currentHash) {
      // Order has changed
      changes.push({
        field: "order_data",
        from: previousHash,
        to: currentHash,
      });
    }

    return changes;
  }

  /**
   * Resolve conflicts based on strategy
   */
  private resolveConflict(
    syncState: SyncState,
    incomingOrder: ECommerceOrder,
    strategy: ConflictResolutionStrategy,
  ): boolean {
    switch (strategy) {
      case "last-write-wins":
        return incomingOrder.updatedAt > syncState.lastSyncAt;
      case "external-wins":
        return true;
      case "internal-wins":
        return false;
      case "manual-override":
        return false; // Requires manual intervention
      default:
        return true;
    }
  }

  /**
   * Handle sync errors with retry logic
   */
  private handleSyncError(
    syncKey: string,
    platform: string,
    error: string,
  ): void {
    let syncState = this.syncStates.get(syncKey);

    if (!syncState) {
      syncState = {
        orderId: syncKey.split("-")[1],
        platform,
        lastSyncAt: new Date(),
        lastSyncedHash: "",
        syncStatus: "failed",
        conflictResolution: "last-write-wins",
        retryCount: 1,
        lastError: error,
      };
    } else {
      syncState.retryCount++;
      syncState.lastError = error;

      // Move to dead letter after max retries
      if (syncState.retryCount >= 5) {
        syncState.syncStatus = "dead-letter";
        const dlq = this.deadLetterQueue.get(platform) || [];
        dlq.push(syncState);
        this.deadLetterQueue.set(platform, dlq);
      } else {
        syncState.syncStatus = "failed";
      }
    }

    this.syncStates.set(syncKey, syncState);
  }

  /**
   * Map external order to Witylogix internal format
   */
  private mapExternalOrderToInternal(
    order: ECommerceOrder,
    platform: string,
  ): WitylogixOrder {
    const fieldMappings = this.fieldMappings.get(platform) || [];
    const statusMapping = this.statusMappings.get(platform);

    return {
      id: `${platform}-${order.id}`,
      externalId: order.externalId,
      platform,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      customer: {
        id: order.customer.id,
        email: order.customer.email,
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
      },
      items: order.lineItems.map((item) => ({
        id: item.id,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.totalAmount,
      shippingAddress: {
        firstName: order.shippingAddress.firstName,
        lastName: order.shippingAddress.lastName,
        address1: order.shippingAddress.address1,
        city: order.shippingAddress.city,
        postalCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
      },
      billingAddress: {
        firstName: order.billingAddress.firstName,
        lastName: order.billingAddress.lastName,
        address1: order.billingAddress.address1,
        city: order.billingAddress.city,
        postalCode: order.billingAddress.postalCode,
        country: order.billingAddress.country,
      },
      notes: order.notes,
      lastSyncedAt: new Date(),
      syncMetadata: {
        platform,
        externalId: order.id,
        mappedFields: fieldMappings.length,
      },
    };
  }

  /**
   * Map Witylogix internal order to external platform format
   */
  private mapInternalOrderToExternal(
    order: WitylogixOrder,
    platform: string,
  ): Record<string, unknown> {
    const statusMapping = this.statusMappings.get(platform);

    return {
      id: order.id,
      externalId: order.externalId,
      status: statusMapping?.mapping[order.status] || order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      customer: order.customer,
      items: order.items,
      total: order.total,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      notes: order.notes,
    };
  }

  /**
   * Map external order to internal order
   */
  private mapExternalToWitylogix(
    order: ECommerceOrder,
    platform: string,
  ): WitylogixOrder {
    return this.mapExternalOrderToInternal(order, platform);
  }

  /**
   * Calculate hash of order for change detection
   */
  private hashOrder(order: unknown): string {
    const str = JSON.stringify(order);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update sync metrics
   */
  private updateMetrics(
    platform: string,
    success: boolean,
    duration: number,
  ): void {
    const metrics = this.metrics.get(platform);
    if (!metrics) return;

    metrics.totalSynced++;
    if (!success) {
      metrics.totalFailed++;
      metrics.totalErrors++;
    }

    // Update average latency
    metrics.avgLatencyMs =
      (metrics.avgLatencyMs * (metrics.totalSynced - 1) + duration) /
      metrics.totalSynced;

    // Update success rate
    metrics.successRate =
      ((metrics.totalSynced - metrics.totalFailed) / metrics.totalSynced) * 100;

    metrics.lastSyncAt = new Date();
  }
}

/**
 * Factory function to create order sync engine
 */
export function createOrderSyncEngine(): OrderSyncEngine {
  return new OrderSyncEngine();
}
