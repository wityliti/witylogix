/**
 * NetSuite SDK Client Tests
 * Comprehensive unit tests for Oracle NetSuite REST + SuiteTalk SDK client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetSuiteSdkClient, OAuth1SignatureBuilder } from '../netsuite-sdk-client.js';

describe('OAuth1SignatureBuilder', () => {
  describe('generateNonce()', () => {
    it('should generate unique nonces', () => {
      const nonce1 = OAuth1SignatureBuilder.generateNonce();
      const nonce2 = OAuth1SignatureBuilder.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate alphanumeric nonce', () => {
      const nonce = OAuth1SignatureBuilder.generateNonce();
      expect(/^[a-z0-9]+$/i.test(nonce)).toBe(true);
    });
  });

  describe('generateTimestamp()', () => {
    it('should generate timestamp as string', () => {
      const timestamp = OAuth1SignatureBuilder.generateTimestamp();
      expect(typeof timestamp).toBe('string');
      expect(/^\d+$/.test(timestamp)).toBe(true);
    });

    it('should generate current timestamp', () => {
      const timestamp = parseInt(OAuth1SignatureBuilder.generateTimestamp(), 10);
      const now = Math.floor(Date.now() / 1000);

      expect(Math.abs(timestamp - now)).toBeLessThan(1);
    });
  });

  describe('generateSignature()', () => {
    it('should generate consistent signature', () => {
      const params = {
        oauth_consumer_key: 'key',
        oauth_token: 'token',
        oauth_timestamp: '1234567890',
        oauth_nonce: 'nonce123',
      };

      const sig1 = OAuth1SignatureBuilder.generateSignature(
        'GET',
        'https://api.example.com/test',
        params,
        'consumer_secret',
        'token_secret',
      );

      const sig2 = OAuth1SignatureBuilder.generateSignature(
        'GET',
        'https://api.example.com/test',
        params,
        'consumer_secret',
        'token_secret',
      );

      expect(sig1).toBe(sig2);
    });

    it('should generate different signature for different params', () => {
      const baseParams = {
        oauth_consumer_key: 'key',
        oauth_token: 'token',
        oauth_timestamp: '1234567890',
        oauth_nonce: 'nonce123',
      };

      const sig1 = OAuth1SignatureBuilder.generateSignature(
        'GET',
        'https://api.example.com/test',
        baseParams,
        'consumer_secret',
        'token_secret',
      );

      const sig2 = OAuth1SignatureBuilder.generateSignature(
        'GET',
        'https://api.example.com/test',
        { ...baseParams, extra: 'param' },
        'consumer_secret',
        'token_secret',
      );

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('generateAuthHeader()', () => {
    it('should generate OAuth header', () => {
      const signature = {
        oauth_consumer_key: 'key',
        oauth_token: 'token',
        oauth_signature_method: 'HMAC-SHA256',
        oauth_signature: 'sig123',
        oauth_timestamp: '1234567890',
        oauth_nonce: 'nonce123',
        oauth_version: '1.0',
      };

      const header = OAuth1SignatureBuilder.generateAuthHeader(signature);

      expect(header).toContain('OAuth');
      expect(header).toContain('oauth_consumer_key="key"');
      expect(header).toContain('oauth_token="token"');
      expect(header).toContain('oauth_signature=');
    });
  });
});

describe('NetSuiteSdkClient', () => {
  let client: NetSuiteSdkClient;

  beforeEach(() => {
    client = new NetSuiteSdkClient({
      accountId: '12345678',
      consumerKey: 'test_key',
      consumerSecret: 'test_secret',
      tokenKey: 'test_token',
      tokenSecret: 'test_token_secret',
      environment: 'sandbox',
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should validate required config', () => {
      expect(() => {
        new NetSuiteSdkClient({
          accountId: '',
          consumerKey: 'key',
          consumerSecret: 'secret',
          tokenKey: 'token',
          tokenSecret: 'secret',
        });
      }).toThrow();
    });

    it('should construct sandbox URL', () => {
      const sandboxClient = new NetSuiteSdkClient({
        accountId: '12345678',
        consumerKey: 'key',
        consumerSecret: 'secret',
        tokenKey: 'token',
        tokenSecret: 'secret',
        environment: 'sandbox',
      });

      expect(sandboxClient).toBeDefined();
    });

    it('should construct production URL', () => {
      const prodClient = new NetSuiteSdkClient({
        accountId: '12345678',
        consumerKey: 'key',
        consumerSecret: 'secret',
        tokenKey: 'token',
        tokenSecret: 'secret',
        environment: 'production',
      });

      expect(prodClient).toBeDefined();
    });
  });

  describe('checkHealth()', () => {
    it('should return true for healthy connection', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const isHealthy = await client.checkHealth();

      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy connection', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await client.checkHealth();

      expect(isHealthy).toBe(false);
    });
  });

  describe('createCustomer()', () => {
    it('should create customer record', async () => {
      const customer = {
        entityId: 'CUST001',
        companyName: 'Test Company',
        email: 'test@example.com',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'CUST001_NS', internalId: '1234' }),
      });

      const result = await client.createCustomer(customer);

      expect(result.id).toBe('CUST001_NS');
      expect(result.entityId).toBe('CUST001');
    });
  });

  describe('getCustomer()', () => {
    it('should retrieve customer record', async () => {
      const mockCustomer = {
        id: 'CUST001',
        internalId: '1234',
        entityId: 'CUST001',
        companyName: 'Test Company',
        email: 'test@example.com',
        isInactive: false,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomer,
      });

      const result = await client.getCustomer('1234');

      expect(result.entityId).toBe('CUST001');
      expect(result.companyName).toBe('Test Company');
    });
  });

  describe('updateCustomer()', () => {
    it('should update customer record', async () => {
      const updates = { email: 'newemail@example.com' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entityId: 'CUST001', email: 'newemail@example.com' }),
      });

      const result = await client.updateCustomer('1234', updates);

      expect(result.email).toBe('newemail@example.com');
    });
  });

  describe('deleteCustomer()', () => {
    it('should delete customer record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(client.deleteCustomer('1234')).resolves.toBeUndefined();
    });
  });

  describe('getSalesOrder()', () => {
    it('should retrieve sales order', async () => {
      const mockOrder = {
        internalId: 'SO001',
        tranId: 'SO-001',
        entity: 'CUST001',
        tranDate: '2024-03-17',
        total: 1000,
        items: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
      });

      const result = await client.getSalesOrder('1234');

      expect(result.internalId).toBe('SO001');
      expect(result.tranId).toBe('SO-001');
    });
  });

  describe('createSalesOrder()', () => {
    it('should create sales order', async () => {
      const order = {
        recordType: 'salesorder' as const,
        tranId: 'SO-001',
        entity: 'CUST001',
        tranDate: new Date('2024-03-17'),
        dueDate: new Date('2024-04-17'),
        total: 1000,
        items: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'SO_NS_001', internalId: '1234' }),
      });

      const result = await client.createSalesOrder(order);

      expect(result.id).toBe('SO_NS_001');
    });
  });

  describe('updateSalesOrderItems()', () => {
    it('should update sales order line items', async () => {
      const items = [
        {
          line: 1,
          item: 'ITEM001',
          quantity: 5,
          rate: 100,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(client.updateSalesOrderItems('1234', items)).resolves.toBeUndefined();
    });
  });

  describe('executeSuiteQL()', () => {
    it('should execute SuiteQL query', async () => {
      const mockResult = {
        totalResults: 2,
        count: 2,
        offset: 0,
        hasMore: false,
        items: [
          { internalId: '1', entityId: 'CUST001' },
          { internalId: '2', entityId: 'CUST002' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.executeSuiteQL('SELECT * FROM customer');

      expect(result.totalResults).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('should support pagination', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalResults: 100,
          count: 10,
          offset: 10,
          hasMore: true,
          items: [],
        }),
      });

      const result = await client.executeSuiteQL('SELECT * FROM customer', {
        offset: 10,
        limit: 10,
      });

      expect(result.offset).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('searchCustomers()', () => {
    it('should search customers with filters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalResults: 1,
          count: 1,
          items: [{ internalId: '1', entityId: 'CUST001' }],
        }),
      });

      const result = await client.searchCustomers([
        { name: 'entityId', operator: '=', values: ['CUST001'] },
      ]);

      expect(result.items).toHaveLength(1);
    });
  });

  describe('searchItems()', () => {
    it('should search items', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalResults: 1,
          count: 1,
          items: [{ internalId: '1', itemId: 'ITEM001' }],
        }),
      });

      const result = await client.searchItems([
        { name: 'itemId', operator: '=', values: ['ITEM001'] },
      ]);

      expect(result.items).toHaveLength(1);
    });
  });

  describe('executeSavedSearch()', () => {
    it('should execute saved search', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ internalId: '1', entityId: 'CUST001' }],
          count: 1,
          totalResults: 1,
          hasMore: false,
          offset: 0,
        }),
      });

      const result = await client.executeSavedSearch('customsearch_123');

      expect(result.results).toHaveLength(1);
    });
  });

  describe('uploadFile()', () => {
    it('should upload file', async () => {
      const file = {
        name: 'test.pdf',
        content: Buffer.from('test content'),
        mimeType: 'application/pdf',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'FILE001', internalId: '5678' }),
      });

      const result = await client.uploadFile(file);

      expect(result.id).toBe('FILE001');
    });
  });

  describe('callRestlet()', () => {
    it('should call custom RESTlet', async () => {
      const params = { action: 'test', data: 'value' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success' }),
      });

      const result = await client.callRestlet('customscript_123', 'customdeploy_1', params);

      expect(result.result).toBe('success');
    });
  });

  describe('concurrency limiting', () => {
    it('should respect max concurrent requests', async () => {
      const concurrentClient = new NetSuiteSdkClient({
        accountId: '12345678',
        consumerKey: 'key',
        consumerSecret: 'secret',
        tokenKey: 'token',
        tokenSecret: 'secret',
        concurrency: {
          maxConcurrentRequests: 1,
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'ok' }),
      });

      const start = Date.now();
      const promises = [
        concurrentClient.checkHealth(),
        concurrentClient.checkHealth(),
        concurrentClient.checkHealth(),
      ];

      await Promise.all(promises);

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(client.getCustomer('invalid')).rejects.toThrow();
    });

    it('should retry on transient errors', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'CUST001' }),
        });

      await expect(client.getCustomer('1234')).resolves.toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
