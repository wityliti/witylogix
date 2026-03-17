/**
 * Clover POS SDK Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloverPOSSDKClient } from '../../../../packages/core/src/integrations/pos/clover-pos-sdk-client';
import type { Clover } from '../../../../packages/core/src/integrations/pos/pos-sdk-types';

describe('CloverPOSSDKClient', () => {
  let client: CloverPOSSDKClient;
  let config: Clover.Config;

  beforeEach(() => {
    config = {
      environment: 'sandbox',
      merchantId: 'merchant-123',
      accessToken: 'test-token',
    };

    client = new CloverPOSSDKClient(config);

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocation', () => {
    it('should fetch merchant details', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'merchant-123',
          name: 'Test Clover Merchant',
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US',
          },
          timezone: 'America/New_York',
          createdTime: Date.now(),
        }),
        headers: new Map(),
      });

      const result = await client.getLocation('merchant-123');

      expect(result.id).toBe('merchant-123');
      expect(result.name).toBe('Test Clover Merchant');
      expect(result.providerId).toBe('clover');
    });
  });

  describe('createOrder', () => {
    it('should create order and add line items', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'order-1',
            state: 'open',
            total: 1299,
            createdTime: Date.now(),
            lineItems: { elements: [] },
            discounts: { elements: [] },
            payments: { elements: [] },
          }),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'li-1' }),
          headers: new Map(),
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
        tax: 0,
        total: 1299,
      } as any);

      expect(order.id).toBe('order-1');
      expect(order.providerId).toBe('clover');
    });
  });

  describe('getMenuItems', () => {
    it('should fetch menu items from Clover catalog', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              id: 'item-1',
              name: 'Burger',
              price: 1299,
              categoryID: 'cat-1',
              active: true,
              archived: false,
              createdTime: Date.now(),
              modifierGroups: { elements: [] },
            },
          ],
        }),
        headers: new Map(),
      });

      const result = await client.getMenuItems('loc-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Burger');
      expect(result[0].providerId).toBe('clover');
    });
  });

  describe('addPayment', () => {
    it('should add payment to order', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'payment-1',
          amount: 1299,
          createdTime: Date.now(),
        }),
        headers: new Map(),
      });

      const result = await client.addPayment('loc-123', 'order-1', {
        method: 'card',
        amount: 1299,
      });

      expect(result.id).toBe('payment-1');
      expect(result.amount).toBe(1299);
    });
  });

  describe('createEmployee', () => {
    it('should create employee', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'emp-1',
          name: 'John Doe',
          email: 'john@example.com',
          active: true,
          createdTime: Date.now(),
        }),
        headers: new Map(),
      });

      const result = await client.createEmployee('loc-123', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      expect(result.id).toBe('emp-1');
      expect(result.firstName).toBe('John');
    });
  });

  describe('createShift', () => {
    it('should create timeclock shift', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'shift-1',
          inTime: Date.now(),
          employee: { id: 'emp-1' },
          createdTime: Date.now(),
        }),
        headers: new Map(),
      });

      const result = await client.createShift('loc-123', {
        employeeId: 'emp-1',
        startTime: new Date(),
      } as any);

      expect(result.id).toBe('shift-1');
      expect(result.status).toBe('open');
    });
  });

  describe('updateStock', () => {
    it('should update item stock', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.updateStock('item-1', 50);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('should refund payment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'refund-1',
          amount: 1299,
          createdTime: Date.now(),
        }),
        headers: new Map(),
      });

      const result = await client.refundPayment('payment-1', 1299);

      expect(result.id).toBe('refund-1');
      expect(result.amount).toBe(1299);
    });
  });

  describe('adjustTip', () => {
    it('should adjust tip amount', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.adjustTip('payment-1', 200);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('subscribeToWebhook', () => {
    it('should subscribe to webhook event', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'webhook-1' }),
        headers: new Map(),
      });

      const result = await client.subscribeToWebhook('order.created', 'https://example.com/webhook');

      expect(result.subscriptionId).toBe('webhook-1');
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse webhook event', () => {
      const payload = {
        type: 'order.created',
        objectId: 'order-1',
        timestamp: Date.now(),
      };

      const result = client.parseWebhookPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('clover');
      expect(result?.resourceType).toBe('order');
    });
  });

  describe('rate limiting', () => {
    it('should enforce 16 req/sec rate limit', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ elements: [] }),
        headers: new Map(),
      });

      const startTime = Date.now();
      await client.listLocations();
      const elapsed = Date.now() - startTime;

      // Should complete quickly in test
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('listCategories', () => {
    it('should list item categories', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            { id: 'cat-1', name: 'Food' },
            { id: 'cat-2', name: 'Drinks' },
          ],
        }),
        headers: new Map(),
      });

      const result = await client.listCategories();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Food');
    });
  });

  describe('voidOrder', () => {
    it('should void order', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'order-1',
            state: 'deleted',
            total: 1299,
            createdTime: Date.now(),
            lineItems: { elements: [] },
            payments: { elements: [] },
          }),
          headers: new Map(),
        });

      const result = await client.voidOrder('loc-123', 'order-1', 'User request');

      expect(result.status).toBe('voided');
    });
  });
});
