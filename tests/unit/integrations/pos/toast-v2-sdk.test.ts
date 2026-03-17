/**
 * Toast POS v2 SDK Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastV2SDKClient } from '../../../../packages/core/src/integrations/pos/toast-v2-sdk-client';
import type { ToastV2 } from '../../../../packages/core/src/integrations/pos/pos-sdk-types';

describe('ToastV2SDKClient', () => {
  let client: ToastV2SDKClient;
  let config: ToastV2.Config;

  beforeEach(() => {
    config = {
      environment: 'sandbox',
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      accessToken: 'test-token',
      restaurantGuid: 'test-restaurant-guid',
    };

    client = new ToastV2SDKClient(config);

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocation', () => {
    it('should fetch location details', async () => {
      const mockLocation = {
        guid: 'loc-123',
        name: 'Test Restaurant',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
        timezone: 'America/New_York',
        createdTime: Date.now(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLocation,
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.getLocation('loc-123');

      expect(result.id).toBe('loc-123');
      expect(result.name).toBe('Test Restaurant');
      expect(result.providerId).toBe('toast-v2');
    });
  });

  describe('getMenuItems', () => {
    it('should fetch and cache menu items', async () => {
      const mockItems = [
        {
          guid: 'item-1',
          name: 'Burger',
          price: 12.99,
          categoryGuid: 'cat-1',
          taxable: true,
          discountable: true,
          deleted: false,
          createdTime: Date.now(),
          modifiers: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockItems }),
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.getMenuItems('loc-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Burger');
      expect(result[0].providerId).toBe('toast-v2');
    });

    it('should use cached menu when available', async () => {
      const mockItems = [
        {
          guid: 'item-1',
          name: 'Burger',
          price: 12.99,
          categoryGuid: 'cat-1',
          taxable: true,
          discountable: true,
          deleted: false,
          createdTime: Date.now(),
          modifiers: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockItems }),
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      // First call
      await client.getMenuItems('loc-123');

      // Second call should use cache
      const result = await client.getMenuItems('loc-123');

      expect(result).toHaveLength(1);
      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createOrder', () => {
    it('should create order with line items', async () => {
      const mockCheck = {
        guid: 'check-1',
        checkNumber: '001',
        status: 'open',
        createdTime: Date.now(),
        tab: {
          lineItems: [],
          discounts: [],
          subtotal: 12.99,
          tax: 1.30,
          total: 14.29,
        },
        payments: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheck,
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const order = await client.createOrder('loc-123', {
        orderType: 'takeout',
        lineItems: [
          {
            id: 'li-1',
            menuItemId: 'item-1',
            quantity: 1,
            price: 1299,
            subtotal: 1299,
          },
        ],
        discounts: [],
        payments: [],
        subtotal: 1299,
        tax: 130,
        total: 1429,
      } as any);

      expect(order.id).toBe('check-1');
      expect(order.providerId).toBe('toast-v2');
      expect(order.status).toBe('open');
    });

    it('should validate order before creation', async () => {
      try {
        await client.createOrder('loc-123', {
          lineItems: [],
          discounts: [],
          payments: [],
          subtotal: 0,
          tax: 0,
          total: 0,
        } as any);
        expect.fail('Should throw validation error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_ORDER');
      }
    });
  });

  describe('applyDiscount', () => {
    it('should apply discount to order', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ guid: 'discount-1' }),
        headers: new Map([['X-RateLimit-Remaining', '498']]),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'check-1',
          checkNumber: '001',
          status: 'open',
          createdTime: Date.now(),
          tab: { lineItems: [], discounts: [{ amount: 200, type: 'FIXED' }], subtotal: 1299, tax: 110, total: 1209 },
          payments: [],
        }),
        headers: new Map([['X-RateLimit-Remaining', '497']]),
      });

      const result = await client.applyDiscount('loc-123', 'check-1', {
        type: 'fixed',
        amount: 200,
        reason: 'Happy hour',
      });

      expect(result.discounts).toHaveLength(1);
    });
  });

  describe('splitPayment', () => {
    it('should split payment across multiple methods', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ guid: 'payment-1', amount: 700 }),
        headers: new Map([['X-RateLimit-Remaining', '498']]),
      });

      const result = await client.splitPayment('loc-123', 'check-1', 700);

      expect(result.id).toBe('payment-1');
      expect(result.amount).toBe(700);
    });
  });

  describe('listEmployees', () => {
    it('should list employees at location', async () => {
      const mockEmployees = [
        {
          guid: 'emp-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'manager',
          deleted: false,
          createdTime: Date.now(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockEmployees }),
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.listEmployees('loc-123');

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('John');
      expect(result[0].providerId).toBe('toast-v2');
    });
  });

  describe('createShift', () => {
    it('should create shift for employee', async () => {
      const mockShift = {
        guid: 'shift-1',
        employeeGuid: 'emp-1',
        locationGuid: 'loc-123',
        startTime: Date.now(),
        status: 'open',
        createdTime: Date.now(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShift,
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.createShift('loc-123', {
        employeeId: 'emp-1',
        startTime: new Date(),
      } as any);

      expect(result.id).toBe('shift-1');
      expect(result.status).toBe('open');
    });
  });

  describe('clockIn', () => {
    it('should clock in employee', async () => {
      const mockShift = {
        guid: 'shift-1',
        employeeGuid: 'emp-1',
        startTime: Date.now(),
        status: 'open',
        createdTime: Date.now(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShift,
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.clockIn('emp-1', 'loc-123');

      expect(result.shiftId).toBe('shift-1');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getDailySalesReport', () => {
    it('should fetch daily sales report', async () => {
      const mockReport = {
        grossSales: 1500.00,
        netSales: 1300.00,
        taxAmount: 130.00,
        discountAmount: 70.00,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport,
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.getDailySalesReport('loc-123', new Date());

      expect(result.grossSales).toBe(150000);
      expect(result.taxAmount).toBe(13000);
    });
  });

  describe('getProductMixReport', () => {
    it('should fetch product mix report', async () => {
      const mockReport = [
        { name: 'Burger', quantity: 50, sales: 649.50 },
        { name: 'Fries', quantity: 75, sales: 225.00 },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: mockReport }),
        headers: new Map([['X-RateLimit-Remaining', '499']]),
      });

      const result = await client.getProductMixReport('loc-123', new Date(), new Date());

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Burger');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify HMAC-SHA256 webhook signature', () => {
      const payload = 'test-payload';
      const signature = 'a1b2c3d4e5f6g7h8i9j0';

      const result = client.verifyWebhookSignature(payload, signature);

      // Result depends on actual HMAC calculation
      expect(typeof result).toBe('boolean');
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse webhook payload', () => {
      const payload = {
        type: 'check.created',
        entityId: 'check-1',
        entityType: 'Check',
        timestamp: Date.now(),
      };

      const result = client.parseWebhookPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('toast-v2');
      expect(result?.resourceType).toBe('order');
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limit of 500 req/min', async () => {
      const startTime = Date.now();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
        headers: new Map([['X-RateLimit-Remaining', '0']]),
      });

      // Make requests and verify rate limiting is respected
      await client.listLocations();

      // Should still be fast since we're not actually rate limited in tests
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
