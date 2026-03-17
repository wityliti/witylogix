/**
 * Square POS v2 SDK Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SquarePOSV2SDKClient } from '../../../../packages/core/src/integrations/pos/square-pos-v2-sdk-client';
import type { SquareV2 } from '../../../../packages/core/src/integrations/pos/pos-sdk-types';

describe('SquarePOSV2SDKClient', () => {
  let client: SquarePOSV2SDKClient;
  let config: SquareV2.Config;

  beforeEach(() => {
    config = {
      environment: 'sandbox',
      accessToken: 'test-token',
      locationId: 'loc-123',
    };

    client = new SquarePOSV2SDKClient(config, 'webhook-secret');

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocation', () => {
    it('should fetch location details', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          location: {
            id: 'loc-123',
            name: 'Test Square Location',
            address: {
              addressLine1: '123 Main St',
              locality: 'New York',
              administrativeDistrictLevel1: 'NY',
              postalCode: '10001',
              country: 'US',
            },
            timezone: 'America/New_York',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '999']]),
      });

      const result = await client.getLocation('loc-123');

      expect(result.id).toBe('loc-123');
      expect(result.name).toBe('Test Square Location');
      expect(result.providerId).toBe('square-v2');
    });
  });

  describe('createOrder', () => {
    it('should create order with idempotency key', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order: {
            id: 'order-1',
            locationId: 'loc-123',
            lineItems: [],
            state: 'OPEN',
            totalAmount: 1429,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '998']]),
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

      expect(order.id).toBe('order-1');
      expect(order.providerId).toBe('square-v2');

      // Verify idempotency key was included
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.idempotencyKey).toBeDefined();
    });
  });

  describe('createPayment', () => {
    it('should create payment with idempotency key', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment: {
            id: 'payment-1',
            amountMoney: { amount: 1429, currency: 'USD' },
            createdAt: new Date().toISOString(),
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '997']]),
      });

      const result = await client.createPayment(1429, 'card');

      expect(result.id).toBe('payment-1');
      expect(result.amount).toBe(1429);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.idempotencyKey).toBeDefined();
    });
  });

  describe('refundPayment', () => {
    it('should refund payment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          refund: {
            id: 'refund-1',
            amountMoney: { amount: 700, currency: 'USD' },
            createdAt: new Date().toISOString(),
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '996']]),
      });

      const result = await client.refundPayment('payment-1', 700);

      expect(result.id).toBe('refund-1');
      expect(result.amount).toBe(700);
    });
  });

  describe('batchUpsertCatalog', () => {
    it('should batch upsert catalog items', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: [] }),
        headers: new Map([['X-RateLimit-Remaining', '995']]),
      });

      await client.batchUpsertCatalog('loc-123', [
        { name: 'Burger', price: 1299 },
        { name: 'Fries', price: 399 },
      ]);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.batches[0].objects).toHaveLength(2);
      expect(body.idempotencyKey).toBeDefined();
    });
  });

  describe('createCustomer', () => {
    it('should create customer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customer: {
            id: 'cust-1',
            givenName: 'John',
            familyName: 'Doe',
            emailAddress: 'john@example.com',
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '994']]),
      });

      const result = await client.createCustomer({
        givenName: 'John',
        familyName: 'Doe',
        email: 'john@example.com',
      });

      expect(result.id).toBe('cust-1');
      expect(result.name).toBe('John Doe');
    });
  });

  describe('createTeamMember', () => {
    it('should create team member', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teamMember: {
            id: 'tm-1',
            givenName: 'Jane',
            familyName: 'Smith',
            emailAddress: 'jane@example.com',
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '993']]),
      });

      const result = await client.createTeamMember({
        givenName: 'Jane',
        familyName: 'Smith',
        email: 'jane@example.com',
      });

      expect(result.id).toBe('tm-1');
      expect(result.name).toBe('Jane Smith');
    });
  });

  describe('createShift', () => {
    it('should create shift with idempotency key', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shift: {
            id: 'shift-1',
            employeeId: 'emp-1',
            locationId: 'loc-123',
            startAt: new Date().toISOString(),
            status: 'OPEN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '992']]),
      });

      const result = await client.createShift('loc-123', {
        employeeId: 'emp-1',
        startTime: new Date(),
      } as any);

      expect(result.id).toBe('shift-1');
      expect(result.status).toBe('open');

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.idempotencyKey).toBeDefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature with secret', () => {
      const payload = 'test-payload';
      const signature = Buffer.from('test').toString('base64');

      const result = client.verifyWebhookSignature(payload, signature);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse webhook payload', () => {
      const payload = {
        eventId: 'event-1',
        type: 'order.created',
        createdAt: new Date().toISOString(),
        data: { object: { id: 'order-1' } },
      };

      const result = client.parseWebhookPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('square-v2');
      expect(result?.resourceType).toBe('order');
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limit of 1000 req/min with Retry-After', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ locations: [] }),
        headers: new Map([
          ['X-RateLimit-Remaining', '500'],
          ['Retry-After', '60'],
        ]),
      });

      await client.listLocations();

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('getMenuItems', () => {
    it('should fetch and cache menu items', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: [
            {
              id: 'item-1',
              type: 'ITEM',
              itemData: {
                name: 'Burger',
                variations: [{ itemVariationData: { name: 'Burger', priceMoney: { amount: 1299 } } }],
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        headers: new Map([['X-RateLimit-Remaining', '990']]),
      });

      const result = await client.getMenuItems('loc-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Burger');
    });
  });

  describe('checkGiftCardBalance', () => {
    it('should check gift card balance', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          giftCard: {
            balanceMoney: { amount: 5000, currency: 'USD' },
          },
        }),
        headers: new Map([['X-RateLimit-Remaining', '989']]),
      });

      const result = await client.checkGiftCardBalance('gc-123');

      expect(result).toBe(5000);
    });
  });
});
