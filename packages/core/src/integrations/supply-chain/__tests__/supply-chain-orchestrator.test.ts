/**
 * Supply Chain Orchestrator Tests
 * Comprehensive test coverage for multi-provider orchestration.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupplyChainOrchestrator } from '../supply-chain-orchestrator';
import type { SupplyChainConfig } from '../types';

describe('SupplyChainOrchestrator', () => {
  let orchestrator: SupplyChainOrchestrator;
  let configs: SupplyChainConfig[];

  beforeEach(() => {
    configs = [
      {
        provider: 'manhattan',
        apiKey: 'key1',
        clientSecret: 'secret1',
        baseUrl: 'https://manhattan.test.com',
        warehouseId: 'WH001',
        timeout: 5000,
      },
      {
        provider: 'blue-yonder',
        apiKey: 'key2',
        clientSecret: 'secret2',
        baseUrl: 'https://blue-yonder.test.com',
        tenantId: 'tenant1',
        warehouseId: 'WH002',
        timeout: 5000,
      },
    ];

    orchestrator = new SupplyChainOrchestrator(configs);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize multiple providers', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await expect(orchestrator.initialize()).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial provider failures', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Auth failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should throw error if all providers fail', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Auth failed'))
        .mockRejectedValueOnce(new Error('Auth failed'));

      await expect(orchestrator.initialize()).rejects.toThrow(
        'No supply chain providers successfully initialized'
      );
    });
  });

  // ============================================================================
  // UNIFIED INVENTORY TESTS
  // ============================================================================

  describe('Unified Inventory', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should get unified inventory view', async () => {
      (global.fetch as any)
        // Manhattan getInventory response (items array, maps QOH/QAL/QAV)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                ITEMID: 'INV001',
                SKU: 'SKU-123',
                QOH: 100,
                QAL: 50,
                QAV: 50,
              },
            ],
          }),
        })
        // Blue Yonder getInventory response (single object with qoh/qal/qav)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV002',
            sku: 'SKU-123',
            qoh: 200,
            qal: 100,
            qav: 100,
          }),
        });

      const inventory = await orchestrator.getUnifiedInventory('SKU-123');

      expect(inventory.sku).toBe('SKU-123');
      expect(inventory.totalQuantity).toBe(300);
      expect(inventory.totalAllocated).toBe(150);
      expect(inventory.totalAvailable).toBe(150);
      expect(inventory.locations).toHaveLength(2);
    });

    it('should cache inventory view', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { ITEMID: 'INV001', SKU: 'SKU-123', QOH: 100, QAL: 50, QAV: 50 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV002', sku: 'SKU-123', qoh: 200, qal: 100, qav: 100,
          }),
        });

      const inv1 = await orchestrator.getUnifiedInventory('SKU-123');
      const inv2 = await orchestrator.getUnifiedInventory('SKU-123');

      expect(inv1).toEqual(inv2);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Only first call fetches
    });

    it('should handle inventory fetch errors gracefully', async () => {
      // Use a non-transient error so RetryHandler does NOT retry (avoids consuming the next mock)
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
          json: async () => ({}),
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV002', sku: 'SKU-123', qoh: 200, qal: 100, qav: 100,
          }),
        });

      const inventory = await orchestrator.getUnifiedInventory('SKU-123');

      expect(inventory.locations).toHaveLength(1); // Only Blue Yonder succeeds
    });
  });

  // ============================================================================
  // ORDER ROUTING TESTS
  // ============================================================================

  describe('Order Routing', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should route order to best warehouse', async () => {
      // Mock inventory responses for SKU-123 and SKU-456
      (global.fetch as any)
        // SKU-123 first warehouse
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { SKU: 'SKU-123', QOH: 100, QAL: 50, QAV: 50 },
            ],
          }),
        })
        // SKU-123 second warehouse (Blue Yonder — direct object)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV-BY-123', sku: 'SKU-123', qoh: 50, qal: 20, qav: 30,
          }),
        })
        // SKU-456 first warehouse (Manhattan — items array)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { SKU: 'SKU-456', QOH: 200, QAL: 100, QAV: 100 },
            ],
          }),
        })
        // SKU-456 second warehouse (Blue Yonder — direct object)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV-BY-456', sku: 'SKU-456', qoh: 80, qal: 40, qav: 40,
          }),
        });

      const warehouseId = await orchestrator.routeOrderToWarehouse({
        id: 'ORD001',
        orderNumber: 'ORD-001',
        type: 'sales',
        sourceWarehouseId: 'WH001',
        orderDate: new Date(),
        status: 'pending',
        priority: 'standard',
        items: [
          { sku: 'SKU-123', quantity: 10 },
          { sku: 'SKU-456', quantity: 20 },
        ],
      });

      expect(warehouseId).toBeDefined();
      expect(['WH001', 'WH002']).toContain(warehouseId);
    });

    it('should throw error for insufficient inventory', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { SKU: 'SKU-999', QOH: 5, QAL: 5, QAV: 0 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            inventoryId: 'INV-BY-999', sku: 'SKU-999', qoh: 3, qal: 3, qav: 0,
          }),
        });

      await expect(
        orchestrator.routeOrderToWarehouse({
          id: 'ORD001',
          orderNumber: 'ORD-001',
          type: 'sales',
          sourceWarehouseId: 'WH001',
          orderDate: new Date(),
          status: 'pending',
          priority: 'standard',
          items: [{ sku: 'SKU-999', quantity: 50 }],
        })
      ).rejects.toThrow('insufficient inventory');
    });
  });

  // ============================================================================
  // STOCK TRANSFER OPTIMIZATION TESTS
  // ============================================================================

  describe('Stock Transfer Optimization', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should optimize stock transfers', async () => {
      // Setup cache with inventory imbalance
      orchestrator['inventoryCache'].set('SKU-123', {
        sku: 'SKU-123',
        totalQuantity: 300,
        totalAllocated: 150,
        totalAvailable: 150,
        locations: [
          { warehouseId: 'WH001', quantity: 200, allocated: 100, available: 100 },
          { warehouseId: 'WH002', quantity: 100, allocated: 50, available: 50 },
        ],
        lastUpdated: new Date(),
      });

      const triggers = await orchestrator.optimizeStockTransfers();

      expect(triggers).toBeDefined();
      expect(Array.isArray(triggers)).toBe(true);
      if (triggers.length > 0) {
        expect(triggers[0].sku).toBeDefined();
        expect(triggers[0].sourceWarehouse).toBeDefined();
        expect(triggers[0].destinationWarehouse).toBeDefined();
      }
    });
  });

  // ============================================================================
  // PROVIDER HEALTH MONITORING TESTS
  // ============================================================================

  describe('Provider Health Monitoring', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should monitor provider health', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });

      const health = await orchestrator.monitorProviderHealth();

      expect(health).toBeInstanceOf(Map);
      expect(health.size).toBeGreaterThan(0);
    });

    it('should detect unhealthy providers', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });

      const health = await orchestrator.monitorProviderHealth();
      const values = Array.from(health.values());

      expect(values).toContain(false);
      expect(values).toContain(true);
    });

    it('should return active adapter for healthy provider', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });

      const adapter = await orchestrator.getActiveAdapter();

      expect(adapter).toBeDefined();
    });
  });

  // ============================================================================
  // INVENTORY SYNC TESTS
  // ============================================================================

  describe('Inventory Synchronization', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should sync all inventory across providers', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { SKU: 'SKU-123', QOH: 100, QAL: 50, QAV: 50, WHID: 'WH001' },
              { SKU: 'SKU-456', QOH: 200, QAL: 100, QAV: 100, WHID: 'WH001' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [
              { sku: 'SKU-789', qoh: 150, qal: 75, qav: 75 },
            ],
          }),
        });

      const skuCount = await orchestrator.syncAllInventory();

      expect(skuCount).toBeGreaterThan(0);
    });

    it('should handle sync errors gracefully', async () => {
      // Use a non-transient error so RetryHandler does NOT retry
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Forbidden',
          json: async () => ({}),
          text: async () => 'Forbidden',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [
              { sku: 'SKU-789', qoh: 150, qal: 75, qav: 75 },
            ],
          }),
        });

      const skuCount = await orchestrator.syncAllInventory();

      expect(skuCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CACHE MANAGEMENT TESTS
  // ============================================================================

  describe('Cache Management', () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();
    });

    it('should track cache size', () => {
      orchestrator['inventoryCache'].set('SKU-001', {
        sku: 'SKU-001',
        totalQuantity: 100,
        totalAllocated: 50,
        totalAvailable: 50,
        locations: [],
        lastUpdated: new Date(),
      });

      expect(orchestrator.getCacheSizeSkus()).toBe(1);
    });

    it('should clear cache', () => {
      orchestrator['inventoryCache'].set('SKU-001', {
        sku: 'SKU-001',
        totalQuantity: 100,
        totalAllocated: 50,
        totalAvailable: 50,
        locations: [],
        lastUpdated: new Date(),
      });

      orchestrator.clearCache();

      expect(orchestrator.getCacheSizeSkus()).toBe(0);
    });
  });

  // ============================================================================
  // EVENT EMITTER TESTS
  // ============================================================================

  describe('Event Emission', () => {
    it('should emit provider-initialized event', async () => {
      const listener = vi.fn();
      orchestrator.on('provider-initialized', listener);

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();

      expect(listener).toHaveBeenCalled();
    });

    it('should emit provider-unhealthy event', async () => {
      const listener = vi.fn();
      orchestrator.on('provider-unhealthy', listener);

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token1',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token2',
            expires_in: 3600,
          }),
        });

      await orchestrator.initialize();
      vi.clearAllMocks();

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await orchestrator.monitorProviderHealth();

      expect(listener).toHaveBeenCalled();
    });
  });
});
