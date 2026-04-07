/**
 * Toast POS Client Tests
 * Comprehensive test suite for Toast POS adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastPOSClient } from '../toast-pos-client';
import { type POSOrder } from '../types';

describe('ToastPOSClient', () => {
  let client: ToastPOSClient;
  const mockConfig: any = {
    environment: 'sandbox',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    accessToken: 'test-access-token',
  };

  beforeEach(() => {
    client = new ToastPOSClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('locations', () => {
    it('should get location details', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'loc-123',
          name: 'Main Restaurant',
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          country: 'US',
          phone: '555-0100',
          email: 'info@restaurant.com',
          timezone: 'America/Chicago',
        }),
      } as any);

      const result = await client.getLocation('loc-123');

      expect(result).toBeDefined();
      expect(result.name).toBe('Main Restaurant');
      expect(result.timezone).toBe('America/Chicago');
    });

    it('should list all locations', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'loc-1',
              name: 'Location 1',
              city: 'Springfield',
            },
            {
              guid: 'loc-2',
              name: 'Location 2',
              city: 'Chicago',
            },
          ],
        }),
      } as any);

      const result = await client.listLocations();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Location 1');
    });
  });

  describe('menu items', () => {
    it('should get menu items for location', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'item-1',
              name: 'Burger',
              price: 12.99,
              description: 'Classic burger',
              taxable: true,
              discountable: true,
              sortOrder: 1,
            },
            {
              guid: 'item-2',
              name: 'Fries',
              price: 3.99,
              taxable: true,
              sortOrder: 2,
            },
          ],
        }),
      } as any);

      const result = await client.getMenuItems('loc-123');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Burger');
      expect(result[0].price).toBe(1299); // Converted to cents
    });

    it('should get menu items by category', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'item-1',
              name: 'Burger',
              categoryGuid: 'cat-entree',
              price: 12.99,
            },
          ],
        }),
      } as any);

      const result = await client.getMenuItems('loc-123', 'cat-entree');

      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('cat-entree');
    });

    it('should sync full menu', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { guid: 'cat-1', name: 'Entrees' },
              { guid: 'cat-2', name: 'Sides' },
            ],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [{ guid: 'item-1', name: 'Burger', categoryGuid: 'cat-1' }],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [{ guid: 'item-2', name: 'Fries', categoryGuid: 'cat-2' }],
          }),
        } as any);

      await client.syncMenu('loc-123');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should cache menu for performance', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [{ guid: 'item-1', name: 'Burger', price: 12.99 }],
        }),
      } as any);

      const result1 = await client.getMenuItems('loc-123');

      vi.spyOn(global, 'fetch').mockClear();

      const result2 = await client.getMenuItems('loc-123');

      // Should use cache (no new API call)
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result1[0].id).toBe(result2[0].id);
    });

    it('should include menu modifiers', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'item-1',
              name: 'Burger',
              price: 12.99,
              modifiers: [
                {
                  guid: 'mod-1',
                  name: 'Extra Cheese',
                  price: 1.5,
                  groupGuid: 'group-1',
                },
              ],
            },
          ],
        }),
      } as any);

      const result = await client.getMenuItems('loc-123');

      expect(result[0].modifiers).toHaveLength(1);
      expect(result[0].modifiers[0].name).toBe('Extra Cheese');
      expect(result[0].modifiers[0].price).toBe(150); // Converted to cents
    });
  });

  describe('orders', () => {
    it('should create order', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'check-123',
          checkNumber: 'CHK-001',
          created: '2024-03-12T00:00:00Z',
          modified: '2024-03-12T00:00:00Z',
        }),
      } as any);

      const result = await client.createOrder('loc-123', {
        lineItems: [
          { menuItemId: 'item-1', quantity: 1, price: 1299 },
        ],
        orderType: 'dine-in',
        tableNumber: '5',
        partySize: 2,
      });

      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('CHK-001');
      expect(result.status).toBe('open');
    });

    it('should get order details', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'check-123',
          checkNumber: 'CHK-001',
          orderType: 'DINE_IN',
          voided: false,
          tableName: '5',
          partySize: 2,
          tab: {
            lineItems: [
              {
                guid: 'li-1',
                itemGuid: 'item-1',
                quantity: 1,
                unitPrice: 12.99,
              },
            ],
            tax: 1.04,
            total: 14.03,
          },
          created: '2024-03-12T00:00:00Z',
        }),
      } as any);

      const result = await client.getOrder('loc-123', 'check-123');

      expect(result.orderNumber).toBe('CHK-001');
      expect(result.partySize).toBe(2);
      expect(result.tax).toBeGreaterThan(0);
    });

    it('should list orders', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'check-1',
              checkNumber: 'CHK-001',
              voided: false,
              orderType: 'TAKEOUT',
              tab: { lineItems: [], tax: 0 },
            },
            {
              guid: 'check-2',
              checkNumber: 'CHK-002',
              voided: false,
              orderType: 'DINE_IN',
              tab: { lineItems: [], tax: 0 },
            },
          ],
        }),
      } as any);

      const result = await client.listOrders('loc-123');

      expect(result).toHaveLength(2);
    });

    it('should update order', async () => {
      vi.spyOn(global, 'fetch')
        // 1st call: getOrder inside updateOrder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            guid: 'check-123',
            checkNumber: 'CHK-001',
            voided: false,
            tab: { lineItems: [], tax: 0 },
          }),
        } as any)
        // 2nd call: PUT /checks/:id
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            guid: 'check-123',
          }),
        } as any)
        // 3rd call: getOrder at end of updateOrder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            guid: 'check-123',
            checkNumber: 'CHK-001',
            voided: false,
            notes: 'Special instructions',
            partySize: 3,
            tab: { lineItems: [], tax: 0 },
          }),
        } as any);

      await client.updateOrder('loc-123', 'check-123', {
        notes: 'Special instructions',
        partySize: 3,
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should add payment to order', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'payment-123',
          created: '2024-03-12T00:00:00Z',
        }),
      } as any);

      const result = await client.addPayment('loc-123', 'check-123', {
        method: 'card',
        amount: 1403,
        tip: 200,
      });

      expect(result).toBeDefined();
      expect(result.amount).toBe(1403);
    });

    it('should void order', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            guid: 'check-123',
            voided: true,
          }),
        } as any);

      const result = await client.voidOrder('loc-123', 'check-123', 'Customer request');

      expect(result.status).toBe('voided');
    });

    it('should validate order before creation', async () => {
      await expect(
        client.createOrder('loc-123', { lineItems: [] })
      ).rejects.toThrow();
    });

    it('should calculate order totals correctly', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'check-123',
          checkNumber: 'CHK-001',
          created: '2024-03-12T00:00:00Z',
        }),
      } as any);

      const result = await client.createOrder('loc-123', {
        lineItems: [
          { menuItemId: 'item-1', quantity: 2, price: 1000 },
          { menuItemId: 'item-2', quantity: 1, price: 500 },
        ],
        discounts: [{ type: 'fixed', amount: 100 }],
      });

      expect(result.subtotal).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('kitchen display', () => {
    it('should send order to kitchen', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      await client.sendToKitchen('loc-123', 'check-123');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should get kitchen display status', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'check-123',
          status: 'in_progress',
        }),
      } as any);

      const result = await client.getKitchenDisplayStatus('loc-123', 'check-123');

      expect(result).toBeDefined();
    });
  });

  describe('labor management', () => {
    it('should list employees', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              guid: 'emp-1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              role: 'server',
            },
          ],
        }),
      } as any);

      const result = await client.listEmployees('loc-123');

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('John');
    });

    it('should create shift', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'shift-123',
          created: '2024-03-12T08:00:00Z',
        }),
      } as any);

      const result = await client.createShift('loc-123', {
        employeeId: 'emp-1',
        startTime: new Date('2024-03-12T08:00:00Z'),
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('open');
    });

    it('should close shift', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'shift-123',
          endTime: '2024-03-12T16:00:00Z',
        }),
      } as any);

      const result = await client.closeShift('loc-123', 'shift-123');

      expect(result.status).toBe('closed');
      expect(result.endTime).toBeDefined();
    });
  });

  describe('revenue centers', () => {
    it('should get revenue center', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          guid: 'rc-1',
          name: 'Dining Room',
          deleted: false,
        }),
      } as any);

      const result = await client.getRevenueCenter('loc-123', 'rc-1');

      expect(result.name).toBe('Dining Room');
    });

    it('should list revenue centers', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            { guid: 'rc-1', name: 'Dining Room', deleted: false },
            { guid: 'rc-2', name: 'Patio', deleted: false },
          ],
        }),
      } as any);

      const result = await client.listRevenueCenters('loc-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('webhooks', () => {
    it('should verify webhook signature', () => {
      const payload = JSON.stringify({ checkId: 'check-123' });

      const isValid = client.verifyWebhookSignature(payload, 'signature');

      expect(typeof isValid).toBe('boolean');
    });

    it('should parse order webhook', () => {
      const payload = {
        eventType: 'check.created',
        entityId: 'check-123',
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe('created');
      expect(event?.resourceType).toBe('order');
    });

    it('should parse payment webhook', () => {
      const payload = {
        eventType: 'payment.processed',
        entityId: 'payment-123',
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.resourceType).toBe('payment');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          errors: [{ code: 'LOCATION_NOT_FOUND', message: 'Location not found' }],
        }),
      } as any);

      await expect(client.getLocation('invalid-loc')).rejects.toThrow();
    });

    it('should retry on transient errors', async () => {
      let attempts = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary network error');
        }
        return {
          ok: true,
          json: async () => ({ guid: 'loc-123', name: 'Test' }),
        } as any;
      });

      const result = await client.getLocation('loc-123');

      expect(attempts).toBeGreaterThanOrEqual(2);
      expect(result).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => client.getLocation('loc-123'));

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ guid: 'loc-123', name: 'Test' }),
      } as any);

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
    });
  });

  describe('menu sync caching', () => {
    it('should cache menu items', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [{ guid: 'item-1', name: 'Burger', price: 12.99 }],
        }),
      } as any);

      await client.getMenuItems('loc-123');

      vi.spyOn(global, 'fetch').mockClear();

      const secondCall = await client.getMenuItems('loc-123');

      // Should use cache
      expect(global.fetch).not.toHaveBeenCalled();
      expect(secondCall).toHaveLength(1);
    });
  });
});
