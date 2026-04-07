/**
 * POS Manager Tests
 * Comprehensive test suite for POS configurations, orders, and operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PosManager } from '../pos-manager';
import type {
  PosConfigInput,
  PosOrderInput,
  PosOrderStatus,
  PosDeliveryType,
  PosOrderFilters,
  PosOrderStats,
} from '../types';

// Mock Prisma client
const mockPrisma = {
  posConfig: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  posOrder: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  posOrderForm: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

// Helper to create a valid PosOrderInput matching the actual type
function createValidOrderInput(overrides: Partial<PosOrderInput> = {}): PosOrderInput {
  return {
    shopId: 'shop-1',
    posConfigId: 'config-1',
    externalId: 'ext-123',
    customerName: 'John Doe',
    customerPhone: '555-1234',
    items: [
      { name: 'Widget A', sku: 'WA-1', quantity: 2, price: 10.5, weight: 1 },
      { name: 'Widget B', sku: 'WB-1', quantity: 1, price: 25.0, weight: 2 },
    ],
    total: 46.0,
    deliveryType: 'LOCAL_DELIVERY',
    ...overrides,
  };
}

describe('PosManager', () => {
  let manager: PosManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new PosManager(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Config Management', () => {
    it('should create a new POS configuration', async () => {
      const input: PosConfigInput = {
        shopId: 'shop-1',
        provider: 'SQUARE' as any,
        terminalId: 'terminal-1',
        apiKey: 'key-123',
        enabled: true,
        settings: { timezone: 'UTC' },
      };

      mockPrisma.posConfig.create.mockResolvedValue({
        id: 'config-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.createConfig(input);

      expect(result).toBeDefined();
      expect(result.id).toBe('config-1');
      expect(result.shopId).toBe(input.shopId);
      expect(result.provider).toBe(input.provider);
      expect(mockPrisma.posConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: input.shopId,
          provider: input.provider,
        }),
      });
    });

    it('should reject config creation without shopId', async () => {
      const input = {
        provider: 'SQUARE',
        terminalId: 'terminal-1',
      } as any;

      await expect(manager.createConfig(input)).rejects.toThrow('shopId is required');
    });

    it('should reject config creation without provider', async () => {
      const input = {
        shopId: 'shop-1',
        terminalId: 'terminal-1',
      } as any;

      await expect(manager.createConfig(input)).rejects.toThrow('provider is required');
    });

    it('should update a POS configuration', async () => {
      const configId = 'config-1';
      const updates = {
        enabled: false,
        settings: { timezone: 'EST' },
      };

      mockPrisma.posConfig.update.mockResolvedValue({
        id: configId,
        shopId: 'shop-1',
        provider: 'SQUARE',
        terminalId: 'terminal-1',
        apiKey: 'key-123',
        ...updates,
      });

      const result = await manager.updateConfig(configId, updates);

      expect(result.enabled).toBe(false);
      expect(result.settings.timezone).toBe('EST');
      expect(mockPrisma.posConfig.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: expect.any(Object),
      });
    });

    it('should delete a POS configuration', async () => {
      const configId = 'config-1';

      mockPrisma.posConfig.delete.mockResolvedValue({ id: configId });

      await manager.deleteConfig(configId);

      expect(mockPrisma.posConfig.delete).toHaveBeenCalledWith({
        where: { id: configId },
      });
    });

    it('should list all POS configurations for a shop', async () => {
      const shopId = 'shop-1';
      const configs = [
        {
          id: 'config-1',
          shopId,
          provider: 'SQUARE',
          terminalId: 'terminal-1',
        },
        {
          id: 'config-2',
          shopId,
          provider: 'CUSTOM',
          terminalId: 'terminal-2',
        },
      ];

      mockPrisma.posConfig.findMany.mockResolvedValue(configs);

      const result = await manager.listConfigs(shopId);

      expect(result).toHaveLength(2);
      expect(result).toEqual(configs);
    });

    it('should reject duplicate terminal IDs for same shop', async () => {
      const input: PosConfigInput = {
        shopId: 'shop-1',
        provider: 'SQUARE' as any,
        terminalId: 'terminal-1',
        apiKey: 'key-123',
        enabled: true,
      };

      mockPrisma.posConfig.create.mockRejectedValue(
        new Error('Unique constraint failed on (shopId, terminalId)')
      );

      await expect(manager.createConfig(input)).rejects.toThrow();
    });

    it('should get config by shopId', async () => {
      const shopId = 'shop-1';

      mockPrisma.posConfig.findFirst.mockResolvedValue({
        id: 'config-1',
        shopId,
        provider: 'SQUARE',
        terminalId: 'terminal-1',
        enabled: true,
      });

      const result = await manager.getConfig(shopId);

      expect(result).toBeDefined();
      expect(result.shopId).toBe(shopId);
    });

    it('should return null for non-existent config', async () => {
      mockPrisma.posConfig.findFirst.mockResolvedValue(null);

      const result = await manager.getConfig('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Order Lifecycle', () => {
    it('should create a new POS order', async () => {
      const input = createValidOrderInput();

      mockPrisma.posOrder.create.mockResolvedValue({
        id: 'order-1',
        ...input,
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await manager.createOrder(input);

      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');
      expect(result.status).toBe('PENDING');
      expect(result.total).toBe(46.0);
    });

    it('should transition order from PENDING to CONFIRMED', async () => {
      const orderId = 'order-1';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      });

      const result = await manager.updateOrderStatus(orderId, 'CONFIRMED');

      expect(result.status).toBe('CONFIRMED');
      expect(result.confirmedAt).toBeDefined();
    });

    it('should transition order from CONFIRMED to READY', async () => {
      const orderId = 'order-1';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'READY',
        readyAt: new Date(),
      });

      const result = await manager.updateOrderStatus(orderId, 'READY');

      expect(result.status).toBe('READY');
      expect(result.readyAt).toBeDefined();
    });

    it('should transition order from READY to PICKED_UP', async () => {
      const orderId = 'order-1';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'PICKED_UP',
        pickedUpAt: new Date(),
      });

      const result = await manager.updateOrderStatus(orderId, 'PICKED_UP');

      expect(result.status).toBe('PICKED_UP');
    });

    it('should transition order from PICKED_UP to DELIVERED', async () => {
      const orderId = 'order-1';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      });

      const result = await manager.updateOrderStatus(orderId, 'DELIVERED');

      expect(result.status).toBe('DELIVERED');
    });

    it('should reject invalid status transition', async () => {
      const orderId = 'order-1';

      // Attempting an invalid status value
      await expect(
        manager.updateOrderStatus(orderId, 'INVALID_STATUS' as PosOrderStatus)
      ).rejects.toThrow('Invalid status');
    });

    it('should cancel an order', async () => {
      const orderId = 'order-1';
      const reason = 'Customer requested cancellation';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'CANCELLED',
        notes: reason,
        completedAt: new Date(),
      });

      const result = await manager.cancelOrder(orderId, reason);

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancellation without orderId', async () => {
      await expect(
        manager.cancelOrder('', 'some reason')
      ).rejects.toThrow('orderId is required');
    });
  });

  describe('Order Queries', () => {
    it('should list orders with status filter', async () => {
      const shopId = 'shop-1';
      const filters: PosOrderFilters = {
        status: 'PENDING',
      };

      const orders = [
        {
          id: 'order-1',
          status: 'PENDING',
          total: 50.0,
        },
        {
          id: 'order-2',
          status: 'PENDING',
          total: 75.0,
        },
      ];

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);
      mockPrisma.posOrder.count.mockResolvedValue(2);

      const result = await manager.listOrders(shopId, filters);

      expect(result.orders).toHaveLength(2);
      expect(result.orders.every((o: any) => o.status === 'PENDING')).toBe(true);
    });

    it('should list orders with deliveryType filter', async () => {
      const shopId = 'shop-1';
      const filters: PosOrderFilters = {
        deliveryType: 'LOCAL_DELIVERY',
      };

      const orders = [
        { id: 'order-1', deliveryType: 'LOCAL_DELIVERY' },
        { id: 'order-2', deliveryType: 'LOCAL_DELIVERY' },
      ];

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);
      mockPrisma.posOrder.count.mockResolvedValue(2);

      const result = await manager.listOrders(shopId, filters);

      expect(result.orders.every((o: any) => o.deliveryType === 'LOCAL_DELIVERY')).toBe(true);
    });

    it('should list orders with date range filter', async () => {
      const shopId = 'shop-1';
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      const filters: PosOrderFilters = {
        from,
        to,
      };

      const orders = [{ id: 'order-1', createdAt: new Date('2024-01-15') }];

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);
      mockPrisma.posOrder.count.mockResolvedValue(1);

      const result = await manager.listOrders(shopId, filters);

      expect(result.orders).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const shopId = 'shop-1';
      const page = 2;
      const limit = 10;

      const orders = Array.from({ length: 10 }, (_, i) => ({
        id: `order-${11 + i}`,
      }));

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);
      mockPrisma.posOrder.count.mockResolvedValue(50);

      const result = await manager.listOrders(shopId, { page, limit });

      expect(result.orders).toHaveLength(10);
      expect(result.total).toBe(50);
      expect(mockPrisma.posOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should get order statistics via getStats', async () => {
      const shopId = 'shop-1';
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      mockPrisma.posOrder.findMany.mockResolvedValue([
        { status: 'PENDING', deliveryType: 'LOCAL_DELIVERY', total: 50 },
        { status: 'DELIVERED', deliveryType: 'LOCAL_DELIVERY', total: 100 },
        { status: 'DELIVERED', deliveryType: 'IN_STORE_PICKUP', total: 75 },
      ]);

      const stats = await manager.getStats(shopId, from, to);

      expect(stats).toBeDefined();
      expect(stats.totalOrders).toBe(3);
      expect(stats.revenue).toBe(225);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byType).toBeDefined();
    });

    it('should return empty list for non-existent shop', async () => {
      mockPrisma.posOrder.findMany.mockResolvedValue([]);
      mockPrisma.posOrder.count.mockResolvedValue(0);

      const result = await manager.listOrders('shop-nonexistent');

      expect(result.orders).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle orders with empty items array', async () => {
      const input = createValidOrderInput({ items: [], total: 0 });

      await expect(manager.createOrder(input)).rejects.toThrow('items must contain at least one item');
    });

    it('should handle orders with negative total', async () => {
      const input = createValidOrderInput({ total: -10 });

      await expect(manager.createOrder(input)).rejects.toThrow('total must be non-negative');
    });

    it('should reject order without shopId', async () => {
      const input = createValidOrderInput({ shopId: '' });

      await expect(manager.createOrder(input)).rejects.toThrow('shopId is required');
    });

    it('should reject order without posConfigId', async () => {
      const input = createValidOrderInput({ posConfigId: '' });

      await expect(manager.createOrder(input)).rejects.toThrow('posConfigId is required');
    });

    it('should handle concurrent order creation', async () => {
      const input1 = createValidOrderInput({ externalId: 'ext-1' });
      const input2 = createValidOrderInput({ externalId: 'ext-2' });

      mockPrisma.posOrder.create
        .mockResolvedValueOnce({ id: 'order-1', ...input1, status: 'PENDING' })
        .mockResolvedValueOnce({ id: 'order-2', ...input2, status: 'PENDING' });

      const result1 = manager.createOrder(input1);
      const result2 = manager.createOrder(input2);

      const results = await Promise.all([result1, result2]);

      expect(results).toHaveLength(2);
      expect(results[0].id).not.toBe(results[1].id);
    });

    it('should reject updateOrderStatus without orderId', async () => {
      await expect(
        manager.updateOrderStatus('', 'CONFIRMED')
      ).rejects.toThrow('orderId is required');
    });

    it('should reject updateOrderStatus without status', async () => {
      await expect(
        manager.updateOrderStatus('order-1', '' as PosOrderStatus)
      ).rejects.toThrow('status is required');
    });
  });

  describe('Integration Scenarios', () => {
    it('should create order and retrieve it', async () => {
      const input = createValidOrderInput();

      const createdOrder = {
        id: 'order-1',
        shopId: input.shopId,
        posConfigId: input.posConfigId,
        status: 'PENDING',
        total: input.total,
      };

      mockPrisma.posOrder.create.mockResolvedValue(createdOrder);
      mockPrisma.posOrder.findUnique.mockResolvedValue(createdOrder);

      const created = await manager.createOrder(input);
      expect(created.id).toBe('order-1');

      const retrieved = await manager.getOrder('order-1');
      expect(retrieved.id).toBe('order-1');
      expect(retrieved.status).toBe('PENDING');
    });

    it('should complete full order lifecycle', async () => {
      const orderId = 'order-1';
      const statuses: PosOrderStatus[] = ['CONFIRMED', 'READY', 'PICKED_UP', 'DELIVERED'];

      for (const status of statuses) {
        mockPrisma.posOrder.update.mockResolvedValue({
          id: orderId,
          status,
        });

        const result = await manager.updateOrderStatus(orderId, status);
        expect(result.status).toBe(status);
      }
    });
  });
});
