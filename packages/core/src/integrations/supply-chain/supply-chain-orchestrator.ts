/**
 * Supply Chain Orchestrator
 * Cross-provider orchestration for multi-warehouse fulfillment, inventory visibility, and failover.
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import type { SupplyChainConfig, InventoryItem, OutboundOrder, FulfillmentRequest, WaveDefinition } from './types';
import { SupplyChainAdapter } from './supply-chain-adapter';
import { ManhattanClient } from './manhattan-client';
import { BlueYonderClient } from './blue-yonder-client';
import { KorberClient } from './korber-client';
import { DeposcoClient } from './deposco-client';
import { ExtensivClient } from './extensiv-client';
import { FishbowlClient } from './fishbowl-client';

/**
 * Inventory snapshot with warehouse details
 */
interface UnifiedInventoryView {
  sku: string;
  totalQuantity: number;
  totalAllocated: number;
  totalAvailable: number;
  locations: Array<{
    warehouseId: string;
    quantity: number;
    allocated: number;
    available: number;
  }>;
  lastUpdated: Date;
}

/**
 * Multi-warehouse replenishment trigger
 */
interface ReplenishmentTrigger {
  sku: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  quantity: number;
  priority: 'standard' | 'expedited';
  reason: string;
}

/**
 * Supply Chain Orchestrator for cross-provider operations
 * Manages unified inventory, multi-warehouse routing, and failover
 */
export class SupplyChainOrchestrator extends EventEmitter {
  private providers: Map<string, SupplyChainAdapter> = new Map();
  private inventoryCache: Map<string, UnifiedInventoryView> = new Map();
  private lastSyncTime: number = 0;
  private syncInterval: number = 300000; // 5 minutes

  /**
   * Create orchestrator instance
   * @param configs Array of WMS/TMS provider configurations
   */
  constructor(private configs: SupplyChainConfig[]) {
    super();
  }

  /**
   * Initialize all configured providers
   * @throws Error if no providers successfully initialize
   */
  public async initialize(): Promise<void> {
    const results: Array<{ provider: string; success: boolean; error?: Error }> = [];

    for (const config of this.configs) {
      try {
        const adapter = this.createAdapter(config);
        await adapter.initialize();
        this.providers.set(config.provider, adapter);
        results.push({ provider: config.provider, success: true });
        this.emit('provider-initialized', { provider: config.provider });
      } catch (error) {
        results.push({
          provider: config.provider,
          success: false,
          error: error as Error,
        });
        this.emit('provider-initialization-failed', {
          provider: config.provider,
          error: (error as Error).message,
        });
      }
    }

    if (results.filter((r) => r.success).length === 0) {
      throw new Error('No supply chain providers successfully initialized');
    }
  }

  /**
   * Get unified inventory view across all warehouses
   * Consolidates inventory from all providers
   * @param sku Stock keeping unit
   * @returns Unified inventory snapshot
   */
  public async getUnifiedInventory(sku: string): Promise<UnifiedInventoryView> {
    const cached = this.inventoryCache.get(sku);
    const now = Date.now();

    if (cached && now - cached.lastUpdated.getTime() < this.syncInterval) {
      return cached;
    }

    const locations: UnifiedInventoryView['locations'] = [];
    let totalQuantity = 0;
    let totalAllocated = 0;
    let totalAvailable = 0;

    for (const [, adapter] of this.providers) {
      try {
        const config = adapter instanceof SupplyChainAdapter ? (adapter as any).config : null;
        if (!config?.warehouseId) continue;

        const inventory = await adapter.getInventory(config.warehouseId, sku);
        totalQuantity += inventory.quantityOnHand;
        totalAllocated += inventory.quantityAllocated;
        totalAvailable += inventory.quantityAvailable;

        locations.push({
          warehouseId: config.warehouseId,
          quantity: inventory.quantityOnHand,
          allocated: inventory.quantityAllocated,
          available: inventory.quantityAvailable,
        });
      } catch (error) {
        this.emit('inventory-fetch-error', {
          sku,
          error: (error as Error).message,
        });
      }
    }

    const view: UnifiedInventoryView = {
      sku,
      totalQuantity,
      totalAllocated,
      totalAvailable,
      locations,
      lastUpdated: new Date(),
    };

    this.inventoryCache.set(sku, view);
    return view;
  }

  /**
   * Route order fulfillment across warehouses
   * Intelligently selects warehouses based on inventory and distance
   * @param order Outbound order to fulfill
   * @returns Selected warehouse ID
   */
  public async routeOrderToWarehouse(order: OutboundOrder): Promise<string> {
    // Get inventory availability for all items in order
    const inventoryAvailability: Map<string, UnifiedInventoryView> = new Map();

    for (const item of order.items) {
      const inventory = await this.getUnifiedInventory(item.sku);
      inventoryAvailability.set(item.sku, inventory);
    }

    // Find best warehouse: must have all items available
    let bestWarehouse: string | null = null;
    let bestScore = -1;

    const warehouseScores: Map<string, number> = new Map();

    for (const [, view] of inventoryAvailability) {
      for (const loc of view.locations) {
        let canFulfill = true;
        for (const item of order.items) {
          const invView = inventoryAvailability.get(item.sku);
          if (!invView) {
            canFulfill = false;
            break;
          }
          const locInv = invView.locations.find((l) => l.warehouseId === loc.warehouseId);
          if (!locInv || locInv.available < item.quantity) {
            canFulfill = false;
            break;
          }
        }

        if (canFulfill) {
          const currentScore = warehouseScores.get(loc.warehouseId) || 0;
          warehouseScores.set(loc.warehouseId, currentScore + 1);
        }
      }
    }

    for (const [warehouse, score] of warehouseScores) {
      if (score > bestScore) {
        bestScore = score;
        bestWarehouse = warehouse;
      }
    }

    if (!bestWarehouse) {
      throw new Error(`Unable to route order ${order.orderNumber}: insufficient inventory`);
    }

    this.emit('order-routed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      warehouseId: bestWarehouse,
    });

    return bestWarehouse;
  }

  /**
   * Optimize stock transfers between warehouses
   * Based on demand patterns and inventory imbalances
   * @returns Array of recommended transfer orders
   */
  public async optimizeStockTransfers(): Promise<ReplenishmentTrigger[]> {
    const triggers: ReplenishmentTrigger[] = [];

    // Example logic: transfer from over-stocked to under-stocked warehouses
    // This is a simplified implementation
    const skus = Array.from(this.inventoryCache.keys());

    for (const sku of skus) {
      const inventory = this.inventoryCache.get(sku);
      if (!inventory) continue;

      // Find over-stocked and under-stocked locations
      const sorted = inventory.locations.sort((a, b) => b.available - a.available);

      if (sorted.length >= 2) {
        const overstocked = sorted[0];
        const understocked = sorted[sorted.length - 1];

        const transferQty = Math.min(overstocked.available - 10, 100); // Transfer up to 100 units
        if (transferQty > 0) {
          triggers.push({
            sku,
            sourceWarehouse: overstocked.warehouseId,
            destinationWarehouse: understocked.warehouseId,
            quantity: transferQty,
            priority: 'standard',
            reason: 'Inventory rebalancing',
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Monitor provider health and failover if needed
   * @returns Map of provider health status
   */
  public async monitorProviderHealth(): Promise<Map<string, boolean>> {
    const health: Map<string, boolean> = new Map();

    for (const [provider, adapter] of this.providers) {
      try {
        const isHealthy = await adapter.verifyConnection();
        health.set(provider, isHealthy);

        if (!isHealthy) {
          this.emit('provider-unhealthy', { provider });
        }
      } catch (error) {
        health.set(provider, false);
        this.emit('provider-health-check-failed', {
          provider,
          error: (error as Error).message,
        });
      }
    }

    return health;
  }

  /**
   * Get primary adapter for operations
   * Returns first healthy provider, or primary if all healthy
   * @returns Active supply chain adapter
   * @throws Error if no providers available
   */
  public async getActiveAdapter(): Promise<SupplyChainAdapter> {
    const health = await this.monitorProviderHealth();

    for (const [provider, isHealthy] of health) {
      if (isHealthy) {
        const adapter = this.providers.get(provider);
        if (adapter) return adapter;
      }
    }

    throw new Error('No healthy supply chain providers available');
  }

  /**
   * Sync inventory across all providers
   * Ensures unified view is current
   * @returns Number of SKUs synced
   */
  public async syncAllInventory(): Promise<number> {
    let skuCount = 0;

    for (const [, adapter] of this.providers) {
      try {
        const config = (adapter as any).config;
        if (config?.warehouseId) {
          const inventory = await adapter.listInventory(config.warehouseId);
          skuCount += inventory.length;

          for (const item of inventory) {
            const cached = this.inventoryCache.get(item.sku) || {
              sku: item.sku,
              totalQuantity: 0,
              totalAllocated: 0,
              totalAvailable: 0,
              locations: [],
              lastUpdated: new Date(),
            };

            const locIndex = cached.locations.findIndex((l) => l.warehouseId === config.warehouseId);
            if (locIndex >= 0) {
              cached.locations[locIndex].quantity = item.quantityOnHand;
              cached.locations[locIndex].allocated = item.quantityAllocated;
              cached.locations[locIndex].available = item.quantityAvailable;
            } else {
              cached.locations.push({
                warehouseId: config.warehouseId,
                quantity: item.quantityOnHand,
                allocated: item.quantityAllocated,
                available: item.quantityAvailable,
              });
            }

            cached.lastUpdated = new Date();
            this.inventoryCache.set(item.sku, cached);
          }
        }
      } catch (error) {
        this.emit('inventory-sync-error', {
          error: (error as Error).message,
        });
      }
    }

    this.lastSyncTime = Date.now();
    return skuCount;
  }

  /**
   * Create adapter instance for configuration
   * @param config Provider configuration
   * @returns Configured adapter
   */
  private createAdapter(config: SupplyChainConfig): SupplyChainAdapter {
    switch (config.provider) {
      case 'manhattan':
        return new ManhattanClient(config);
      case 'blue-yonder':
        return new BlueYonderClient(config);
      case 'korber':
        return new KorberClient(config);
      case 'deposco':
        return new DeposcoClient(config);
      case 'extensiv':
        return new ExtensivClient(config);
      case 'fishbowl':
        return new FishbowlClient(config);
      default:
        throw new Error(`Unknown supply chain provider: ${config.provider}`);
    }
  }

  /**
   * Get current inventory cache size
   * @returns Number of cached SKUs
   */
  public getCacheSizeSkus(): number {
    return this.inventoryCache.size;
  }

  /**
   * Clear inventory cache
   */
  public clearCache(): void {
    this.inventoryCache.clear();
    this.lastSyncTime = 0;
  }
}
