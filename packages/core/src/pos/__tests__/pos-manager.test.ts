/**
 * POS Manager Tests
 * Comprehensive test suite for POS configurations, orders, and form builder
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

describe('PosManager', () => {
  let manager: PosManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new PosManager(mockPrisma);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Config Management', () => {
    it('should create a new POS configuration', async () => {
      const input: PosConfigInput = {
        shopId: 'shop-1',
        provider: 'square',
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
        provider: 'square',
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
        provider: 'square',
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
          provider: 'square',
          terminalId: 'terminal-1',
        },
        {
          id: 'config-2',
          shopId,
          provider: 'clover',
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
        provider: 'square',
        terminalId: 'terminal-1',
        apiKey: 'key-123',
        enabled: true,
      };

      mockPrisma.posConfig.create.mockRejectedValue(
        new Error('Unique constraint failed on (shopId, terminalId)')
      );

      await expect(manager.createConfig(input)).rejects.toThrow();
    });

    it('should get config by ID', async () => {
      const configId = 'config-1';

      mockPrisma.posConfig.findUnique.mockResolvedValue({
        id: configId,
        shopId: 'shop-1',
        provider: 'square',
        terminalId: 'terminal-1',
        enabled: true,
      });

      const result = await manager.getConfig(configId);

      expect(result).toBeDefined();
      expect(result.id).toBe(configId);
    });

    it('should return null for non-existent config', async () => {
      mockPrisma.posConfig.findUnique.mockResolvedValue(null);

      const result = await manager.getConfig('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Order Lifecycle', () => {
    it('should create a new POS order', async () => {
      const input: PosOrderInput = {
        shopId: 'shop-1',
        configId: 'config-1',
        externalOrderId: 'ext-123',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [
          { productId: 'prod-1', quantity: 2, price: 10.5 },
          { productId: 'prod-2', quantity: 1, price: 25.0 },
        ],
        total: 46.0,
        type: 'delivery',
        status: 'PENDING',
        scheduledTime: new Date(Date.now() + 3600000),
      };

      mockPrisma.posOrder.create.mockResolvedValue({
        id: 'order-1',
        ...input,
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

      // Attempting to transition from DELIVERED to PENDING
      mockPrisma.posOrder.findUnique.mockResolvedValue({
        id: orderId,
        status: 'DELIVERED',
      });

      await expect(
        manager.updateOrderStatus(orderId, 'PENDING')
      ).rejects.toThrow();
    });

    it('should cancel an order', async () => {
      const orderId = 'order-1';
      const reason = 'Customer requested cancellation';

      mockPrisma.posOrder.update.mockResolvedValue({
        id: orderId,
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      });

      const result = await manager.cancelOrder(orderId, reason);

      expect(result.status).toBe('CANCELLED');
      expect(result.cancellationReason).toBe(reason);
    });

    it('should reject cancellation of completed order', async () => {
      const orderId = 'order-1';

      mockPrisma.posOrder.findUnique.mockResolvedValue({
        id: orderId,
        status: 'DELIVERED',
      });

      await expect(
        manager.cancelOrder(orderId, 'Too late')
      ).rejects.toThrow();
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

      const result = await manager.listOrders(shopId, filters);

      expect(result).toHaveLength(2);
      expect(result.every(o => o.status === 'PENDING')).toBe(true);
    });

    it('should list orders with type filter', async () => {
      const shopId = 'shop-1';
      const filters: PosOrderFilters = {
        type: 'delivery',
      };

      const orders = [
        { id: 'order-1', type: 'delivery' },
        { id: 'order-2', type: 'delivery' },
      ];

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);

      const result = await manager.listOrders(shopId, filters);

      expect(result.every(o => o.type === 'delivery')).toBe(true);
    });

    it('should list orders with date range filter', async () => {
      const shopId = 'shop-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const filters: PosOrderFilters = {
        startDate,
        endDate,
      };

      const orders = [{ id: 'order-1', createdAt: new Date('2024-01-15') }];

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);

      const result = await manager.listOrders(shopId, filters);

      expect(result).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const shopId = 'shop-1';
      const page = 2;
      const pageSize = 10;

      const orders = Array.from({ length: 10 }, (_, i) => ({
        id: `order-${11 + i}`,
      }));

      mockPrisma.posOrder.findMany.mockResolvedValue(orders);
      mockPrisma.posOrder.count.mockResolvedValue(50);

      const result = await manager.listOrders(shopId, { page, pageSize });

      expect(result).toHaveLength(10);
      expect(mockPrisma.posOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should calculate order statistics', async () => {
      const shopId = 'shop-1';

      mockPrisma.posOrder.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { id: 5 }, _sum: { total: 250 } },
        { status: 'DELIVERED', _count: { id: 20 }, _sum: { total: 1500 } },
        { status: 'CANCELLED', _count: { id: 2 }, _sum: { total: 80 } },
      ]);

      const stats = await manager.getOrderStats(shopId);

      expect(stats).toBeDefined();
      expect(stats.total).toBe(27);
      expect(stats.totalRevenue).toBeGreaterThan(0);
      expect(stats.byStatus).toBeDefined();
    });

    it('should return empty list for non-existent shop', async () => {
      mockPrisma.posOrder.findMany.mockResolvedValue([]);

      const result = await manager.listOrders('shop-nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('Form Builder', () => {
    it('should create a custom order form', async () => {
      const formInput = {
        shopId: 'shop-1',
        name: 'Custom Order Form',
        fields: [
          {
            name: 'customerName',
            type: 'text',
            required: true,
            label: 'Customer Name',
          },
          {
            name: 'phone',
            type: 'phone',
            required: true,
            label: 'Phone Number',
          },
          {
            name: 'notes',
            type: 'textarea',
            required: false,
            label: 'Special Instructions',
          },
        ],
      };

      mockPrisma.posOrderForm.create.mockResolvedValue({
        id: 'form-1',
        ...formInput,
        createdAt: new Date(),
      });

      const result = await manager.createForm(formInput);

      expect(result).toBeDefined();
      expect(result.id).toBe('form-1');
      expect(result.fields).toHaveLength(3);
    });

    it('should validate form submission with required fields', async () => {
      const formId = 'form-1';
      const submission = {
        customerName: 'John Doe',
        phone: '555-1234',
      };

      mockPrisma.posOrderForm.findUnique.mockResolvedValue({
        id: formId,
        fields: [
          { name: 'customerName', required: true },
          { name: 'phone', required: true },
          { name: 'notes', required: false },
        ],
      });

      const result = await manager.validateFormSubmission(formId, submission);

      expect(result.valid).toBe(true);
    });

    it('should reject form submission missing required fields', async () => {
      const formId = 'form-1';
      const submission = {
        customerName: 'John Doe',
        // phone is missing but required
      };

      mockPrisma.posOrderForm.findUnique.mockResolvedValue({
        id: formId,
        fields: [
          { name: 'customerName', required: true },
          { name: 'phone', required: true },
        ],
      });

      const result = await manager.validateFormSubmission(formId, submission);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'phone' })
      );
    });

    it('should validate field types in form submission', async () => {
      const formId = 'form-1';
      const submission = {
        email: 'invalid-email',
      };

      mockPrisma.posOrderForm.findUnique.mockResolvedValue({
        id: formId,
        fields: [{ name: 'email', type: 'email', required: true }],
      });

      const result = await manager.validateFormSubmission(formId, submission);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'email', message: expect.stringContaining('email') })
      );
    });

    it('should validate email format', async () => {
      const formId = 'form-1';
      const submission = {
        email: 'not-an-email',
      };

      mockPrisma.posOrderForm.findUnique.mockResolvedValue({
        id: formId,
        fields: [{ name: 'email', type: 'email', required: true }],
      });

      const result = await manager.validateFormSubmission(formId, submission);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid email');
    });

    it('should get default order form for shop', async () => {
      const shopId = 'shop-1';

      mockPrisma.posOrderForm.findFirst.mockResolvedValue({
        id: 'form-default',
        shopId,
        name: 'Default Form',
        fields: [
          { name: 'customerName', type: 'text', required: true },
          { name: 'phone', type: 'phone', required: true },
          { name: 'email', type: 'email', required: false },
          { name: 'address', type: 'text', required: true },
        ],
      });

      const result = await manager.getDefaultForm(shopId);

      expect(result).toBeDefined();
      expect(result.id).toBe('form-default');
      expect(result.fields).toHaveLength(4);
    });

    it('should support custom field types', async () => {
      const formInput = {
        shopId: 'shop-1',
        fields: [
          { name: 'itemCount', type: 'number', required: true },
          { name: 'pickupDate', type: 'date', required: true },
          { name: 'preferredTimeSlot', type: 'select', required: true, options: ['morning', 'afternoon', 'evening'] },
        ],
      };

      mockPrisma.posOrderForm.create.mockResolvedValue({
        id: 'form-1',
        ...formInput,
      });

      const result = await manager.createForm(formInput);

      expect(result.fields).toHaveLength(3);
      expect(result.fields[2].type).toBe('select');
    });
  });

  describe('Edge Cases', () => {
    it('should handle orders with empty items array', async () => {
      const input: PosOrderInput = {
        shopId: 'shop-1',
        configId: 'config-1',
        externalOrderId: 'ext-123',
        customerName: 'John Doe',
        items: [],
        total: 0,
        type: 'delivery',
        status: 'PENDING',
      };

      await expect(manager.createOrder(input)).rejects.toThrow('Order must have at least one item');
    });

    it('should handle orders with zero total', async () => {
      const input: PosOrderInput = {
        shopId: 'shop-1',
        configId: 'config-1',
        externalOrderId: 'ext-123',
        customerName: 'John Doe',
        items: [{ productId: 'prod-1', quantity: 1, price: 0 }],
        total: 0,
        type: 'delivery',
        status: 'PENDING',
      };

      await expect(manager.createOrder(input)).rejects.toThrow('Order total must be greater than 0');
    });

    it('should reject delivery order without address', async () => {
      const input = {
        shopId: 'shop-1',
        posConfigId: 'config-1',
        externalOrderId: 'ext-123',
        customerName: 'John Doe',
        items: [{ productId: 'prod-1', quantity: 1, price: 10 }],
        total: 10,
        deliveryType: 'LOCAL_DELIVERY',
        status: 'PENDING',
        // address is missing
      };

      await expect(manager.createOrder(input)).rejects.toThrow('Delivery orders require an address');
    });

    it('should reject order with past scheduled time', async () => {
      const pastTime = new Date(Date.now() - 3600000); // 1 hour ago

      const input: PosOrderInput = {
        shopId: 'shop-1',
        configId: 'config-1',
        externalOrderId: 'ext-123',
        customerName: 'John Doe',
        items: [{ productId: 'prod-1', quantity: 1, price: 10 }],
        total: 10,
        type: 'delivery',
        status: 'PENDING',
        scheduledTime: pastTime,
      };

      await expect(manager.createOrder(input)).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should handle concurrent order creation', async () => {
      const input1: PosOrderInput = {
        shopId: 'shop-1',
        configId: 'config-1',
        externalOrderId: 'ext-1',
        customerName: 'John Doe',
        items: [{ productId: 'prod-1', quantity: 1, price: 10 }],
        total: 10,
        type: 'delivery',
        status: 'PENDING',
      };

      const input2: PosOrderInput = {
        ...input1,
        externalOrderId: 'ext-2',
      };

      mockPrisma.posOrder.create
        .mockResolvedValueOnce({ id: 'order-1', ...input1 })
        .mockResolvedValueOnce({ id: 'order-2', ...input2 });

      const result1 = manager.createOrder(input1);
      const result2 = manager.createOrder(input2);

      const results = await Promise.all([result1, result2]);

      expect(results).toHaveLength(2);
      expect(results[0].id).not.toBe(results[1].id);
    });

    it('should handle form with no fields', async () => {
      const formInput = {
        shopId: 'shop-1',
        fields: [],
      };

      await expect(manager.createForm(formInput as any)).rejects.toThrow('Form must have at least one field');
    });
  });

  describe('Integration Scenarios', () => {
    it('should create order from form submission', async () => {
      const formId = 'form-1';
      const submission = {
        customerName: 'John Doe',
        phone: '555-1234',
        email: 'john@example.com',
        address: '123 Main St',
      };

      mockPrisma.posOrderForm.findUnique.mockResolvedValue({
        id: formId,
        shopId: 'shop-1',
        fields: [
          { name: 'customerName', required: true },
          { name: 'phone', required: true },
          { name: 'email', required: false },
          { name: 'address', required: true },
        ],
      });

      mockPrisma.posOrder.create.mockResolvedValue({
        id: 'order-1',
        shopId: 'shop-1',
        status: 'PENDING',
      });

      const validation = await manager.validateFormSubmission(formId, submission);
      expect(validation.valid).toBe(true);

      const order = await manager.createOrderFromForm(formId, submission);
      expect(order).toBeDefined();
    });

    it('should complete full order lifecycle', async () => {
      const orderId = 'order-1';
      const statuses: PosOrderStatus[] = ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP', 'DELIVERED'];

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
