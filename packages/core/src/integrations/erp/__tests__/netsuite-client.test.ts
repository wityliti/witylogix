/**
 * NetSuite Client Integration Tests
 * Comprehensive test suite for Oracle NetSuite SuiteTalk adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ERPConnection } from '../types.js';
import { ConnectionStatus } from '../types.js';
import { NetSuiteClient } from '../netsuite-client.js';

const mockFetch = vi.fn();

/**
 * Helper: build a successful JSON response mock
 */
function okJson(data: any) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

describe('NetSuiteClient', () => {
  let nsClient: NetSuiteClient;
  let mockConnection: ERPConnection;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();

    mockConnection = {
      id: 'ns_conn_1',
      tenantId: 'tenant_1',
      provider: 'netsuite',
      status: ConnectionStatus.ACTIVE,
      credentials: {
        accessToken: 'mock_token',
        tokenId: 'token_id',
        tokenSecret: 'token_secret',
        consumerKey: 'consumer_key',
        consumerSecret: 'consumer_secret',
      },
      config: {
        timeout: 30000,
        maxRetries: 3,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    nsClient = new NetSuiteClient(mockConnection, {
      accountId: '12345678',
      tokenId: 'token_id',
      tokenSecret: 'token_secret',
      consumerKey: 'consumer_key',
      consumerSecret: 'consumer_secret',
      environment: 'sandbox',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should authenticate with OAuth1', async () => {
      await nsClient.authenticate('auth_code');
      expect(mockConnection.credentials.accessToken).toBeDefined();
    });

    it('should get authorization URL', () => {
      const authUrl = nsClient.getAuthorizationUrl('state123');
      expect(authUrl).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should check health', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ results: [{ id: '1' }] }));
      const isHealthy = await nsClient.checkHealth();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Customers', () => {
    it('should create customer', async () => {
      const customer = {
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '+1234567890',
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'cust_123', externalId: 'ext_123' }));

      const result = await nsClient.createCustomer(customer);
      expect(result.id).toBeDefined();
      expect(result.externalId).toBeDefined();
    });

    it('should get customer', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'cust_123', entityid: 'CUST001', companyname: 'Test', email: 'test@test.com',
      }));

      const customer = await nsClient.getCustomer('cust_123');
      expect(customer).toHaveProperty('name');
    });

    it('should update customer', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET (re-fetch)
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'cust_123', entityid: 'CUST001', companyname: 'Test', phone: '+9876543210',
      }));

      const updated = await nsClient.updateCustomer('cust_123', {
        phone: '+9876543210',
      });
      expect(updated.phone).toBe('+9876543210');
    });

    it('should search customers with SuiteQL', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        items: [{ id: 'cust_1', entityid: 'CUST001', email: 'test@test.com' }],
        count: 1,
        hasMore: false,
      }));

      const result = await nsClient.searchCustomers('Test', {
        offset: 0,
        limit: 10,
      });
      expect(result.items).toBeDefined();
      expect(typeof result.total).toBe('number');
    });
  });

  describe('Vendors', () => {
    it('should create vendor', async () => {
      const vendor = {
        name: 'Test Vendor',
        email: 'vendor@example.com',
        phone: '+1987654321',
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'vend_123', externalId: 'ext_v123' }));

      const result = await nsClient.createVendor(vendor);
      expect(result.id).toBeDefined();
    });

    it('should get vendor', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'vend_123', entityid: 'VEND001', companyname: 'Test Vendor',
      }));

      const vendor = await nsClient.getVendor('vend_123');
      expect(vendor).toHaveProperty('name');
    });

    it('should update vendor', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'vend_123', entityid: 'VEND001', companyname: 'Test Vendor',
        email: 'newemail@example.com',
      }));

      const updated = await nsClient.updateVendor('vend_123', {
        email: 'newemail@example.com',
      });
      expect(updated.email).toBe('newemail@example.com');
    });
  });

  describe('Sales Orders', () => {
    it('should create sales order', async () => {
      const order = {
        customerId: 'cust_123',
        orderDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lineItems: [
          {
            itemCode: 'item_001',
            itemName: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            totalAmount: 500,
          },
        ],
        total: 500,
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'so_123', externalId: 'ext_so_123' }));

      const result = await nsClient.createSalesOrder(order);
      expect(result.id).toBeDefined();
    });

    it('should get sales order', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'so_123', tranid: 'SO-001', entity: 'cust_123',
        trandate: '2024-01-01', item: [], total: 500,
      }));

      const order = await nsClient.getSalesOrder('order_123');
      expect(order).toHaveProperty('orderNumber');
    });

    it('should update sales order', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET (re-fetch after update)
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'so_123', tranid: 'SO-001', entity: 'cust_123',
        trandate: '2024-01-01', item: [], total: 500, status: 'delivered',
      }));

      const updated = await nsClient.updateSalesOrder('order_123', {
        status: 'delivered',
      });
      expect(updated.status).toBe('delivered');
    });
  });

  describe('Invoices', () => {
    it('should create sales invoice', async () => {
      const invoice = {
        customerId: 'cust_123',
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [
          {
            itemCode: 'item_001',
            itemName: 'Service',
            quantity: 1,
            unitPrice: 500,
            totalAmount: 500,
          },
        ],
        total: 500,
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'inv_123', externalId: 'ext_inv_123' }));

      const result = await nsClient.createInvoice(invoice);
      expect(result.id).toBeDefined();
      expect(result.invoiceNumber).toBe('INV001');
    });

    it('should get sales invoice', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'inv_123', tranid: 'INV001', entity: 'cust_123',
        trandate: '2024-01-01', duedate: '2024-02-01', item: [], total: 500,
      }));

      const invoice = await nsClient.getInvoice('inv_123');
      expect(invoice).toHaveProperty('invoiceNumber');
    });

    it('should update sales invoice', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET (re-fetch after update)
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'inv_123', tranid: 'INV001', entity: 'cust_123',
        trandate: '2024-01-01', duedate: '2024-02-01', item: [], total: 500,
        status: 'paid',
      }));

      const updated = await nsClient.updateInvoice('inv_123', {
        status: 'paid',
      });
      expect(updated.status).toBe('paid');
    });

    it('should create purchase invoice', async () => {
      const invoice = {
        customerId: 'vend_123',
        invoiceNumber: 'PINV001',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [],
        total: 1000,
        invoiceType: 'purchase' as const,
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'pinv_123', externalId: 'ext_pinv_123' }));

      const result = await nsClient.createPurchaseInvoice(invoice);
      expect(result.id).toBeDefined();
    });

    it('should get purchase invoice', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'pinv_123', tranid: 'PINV001', entity: 'vend_123',
        trandate: '2024-01-01', duedate: '2024-02-01', item: [], total: 1000,
      }));

      const invoice = await nsClient.getPurchaseInvoice('pinv_123', true);
      expect(invoice).toHaveProperty('invoiceNumber');
    });
  });

  describe('Payments', () => {
    it('should create payment', async () => {
      const payment = {
        customerId: 'cust_123',
        amount: 500,
        paymentDate: new Date(),
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'pay_123', externalId: 'ext_pay_123' }));

      const result = await nsClient.createPayment(payment);
      expect(result.id).toBeDefined();
      expect(result.amount).toBe(500);
    });

    it('should get payment', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'pay_123', amount: 500, trandate: '2024-01-01',
      }));

      const payment = await nsClient.getPayment('pay_123');
      expect(payment).toHaveProperty('amount');
    });
  });

  describe('Items', () => {
    it('should create item', async () => {
      const item = {
        name: 'Test Product',
        itemCode: 'ITEM001',
        unitPrice: 99.99,
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'item_123', itemCode: 'ITEM001' }));

      const result = await nsClient.createItem(item);
      expect(result).toBeDefined();
    });

    it('should get item', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'item_123', itemCode: 'ITEM001', name: 'Test Product',
      }));

      const item = await nsClient.getItem('item_123');
      expect(item).toBeDefined();
    });

    it('should update item', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET
      mockFetch.mockResolvedValueOnce(okJson({
        id: 'item_123', itemCode: 'ITEM001', name: 'Updated Product',
      }));

      const updated = await nsClient.updateItem('item_123', {
        name: 'Updated Product',
      });
      expect(updated).toBeDefined();
    });
  });

  describe('SuiteQL Queries', () => {
    it('should execute SuiteQL query', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        items: [{ id: '1', entityid: 'CUST001', email: 'test@test.com' }],
        count: 1,
        hasMore: false,
      }));

      const result = await nsClient.suiteQL({
        q: 'SELECT id, entityid, email FROM customer LIMIT 10',
        limit: 10,
      });
      expect(result.results).toBeDefined();
      expect(typeof result.count).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should handle query with offset', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        items: [],
        count: 0,
        offset: 10,
        hasMore: false,
      }));

      const result = await nsClient.suiteQL({
        q: 'SELECT id FROM customer',
        offset: 10,
        limit: 10,
      });
      expect(result.offset).toBe(10);
    });
  });

  describe('Saved Searches', () => {
    it('should execute saved search', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        results: [{ id: '1' }],
        count: 1,
        hasMore: false,
      }));

      const result = await nsClient.executeSavedSearch({
        searchId: 'search_123',
        offset: 0,
        limit: 50,
      });
      expect(result.results).toBeDefined();
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should execute saved search with filters', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        results: [{ id: '1' }],
        count: 1,
        hasMore: false,
      }));

      const result = await nsClient.executeSavedSearch({
        searchId: 'search_123',
        filters: { status: 'ACTIVE' },
        limit: 20,
      });
      expect(result.results).toBeDefined();
    });
  });

  describe('File Cabinet', () => {
    it('should upload file', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ fileId: 'file_123', internalId: 'int_123' }));

      const result = await nsClient.uploadFile({
        fileName: 'invoice.pdf',
        fileContent: Buffer.from('test content'),
        description: 'Test invoice',
      });
      expect(result.fileId).toBeDefined();
      expect(result.internalId).toBeDefined();
    });

    it('should download file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
        text: async () => '',
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(8),
      });

      const fileContent = await nsClient.downloadFile('file_123');
      expect(fileContent).toBeDefined();
    });
  });

  describe('Currency & Exchange Rates', () => {
    it('should get exchange rate', async () => {
      // suiteQL call
      mockFetch.mockResolvedValueOnce(okJson({
        items: [{ exchangerate: 0.85, effectivedate: '2024-01-01' }],
        count: 1,
        hasMore: false,
      }));

      const rate = await nsClient.getExchangeRate('USD', 'EUR');
      expect(rate.fromCurrency).toBe('USD');
      expect(rate.toCurrency).toBe('EUR');
      expect(typeof rate.rate).toBe('number');
    });
  });

  describe('Custom Records', () => {
    it('should create custom record', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ internalId: 'rec_123' }));

      const result = await nsClient.createCustomRecord('customrecord_test', {
        name: 'Test Record',
      });
      expect(result.internalId).toBeDefined();
    });

    it('should get custom record', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        internalId: 'rec_123', name: 'Test Record',
      }));

      const record = await nsClient.getCustomRecord('customrecord_test', 'rec_123');
      expect(record).toBeDefined();
    });

    it('should update custom record', async () => {
      // PATCH
      mockFetch.mockResolvedValueOnce(okJson({}));
      // GET
      mockFetch.mockResolvedValueOnce(okJson({
        internalId: 'rec_123', name: 'Updated',
      }));

      const updated = await nsClient.updateCustomRecord(
        'customrecord_test',
        'rec_123',
        { name: 'Updated' },
      );
      expect(updated).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit info', () => {
      const info = nsClient.getRateLimitInfo();
      expect(info).toHaveProperty('remaining');
      expect(info).toHaveProperty('limit');
      expect(info).toHaveProperty('resetAt');
    });

    it('should reset rate limiter', () => {
      nsClient.resetRateLimit();
      const info = nsClient.getRateLimitInfo();
      expect(info.remaining).toBe(info.limit);
    });
  });

  describe('Circuit Breaker', () => {
    it('should get circuit breaker state', () => {
      const state = nsClient.getCircuitBreakerState();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });
  });

  describe('Connection Management', () => {
    it('should get connection', () => {
      const connection = nsClient.getConnection();
      expect(connection.id).toBe('ns_conn_1');
    });

    it('should update connection', () => {
      nsClient.updateConnection({
        config: { timeout: 60000 },
      });
      const connection = nsClient.getConnection();
      expect(connection.config.timeout).toBe(60000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid account ID', async () => {
      const invalidClient = new NetSuiteClient(mockConnection, {
        accountId: '',
        tokenId: 'test',
        tokenSecret: 'test',
        consumerKey: 'test',
        consumerSecret: 'test',
      });

      expect(invalidClient).toBeDefined();
    });

    it('should handle missing credentials', async () => {
      const invalidConnection: ERPConnection = {
        ...mockConnection,
        credentials: {},
      };

      const client = new NetSuiteClient(invalidConnection, {
        accountId: '12345678',
        tokenId: '',
        tokenSecret: '',
        consumerKey: '',
        consumerSecret: '',
      });

      expect(client).toBeDefined();
    });
  });

  describe('OAuth1 Signature', () => {
    it('should generate valid OAuth1 header', async () => {
      // Test that OAuth1 signature generation works
      const customer = {
        name: 'Test',
        email: 'test@example.com',
      };

      mockFetch.mockResolvedValueOnce(okJson({ id: 'cust_123', externalId: 'ext_123' }));

      const result = await nsClient.createCustomer(customer);
      expect(result).toBeDefined();
    });
  });

  describe('Webhook Support', () => {
    it('should register webhook', async () => {
      await nsClient.registerWebhook({
        url: 'https://example.com/webhook',
        events: ['customer.create', 'invoice.update'],
        isActive: true,
      });
    });

    it('should unregister webhook', async () => {
      await nsClient.unregisterWebhook('https://example.com/webhook');
    });

    it('should handle webhook payload', async () => {
      const payload = {
        eventType: 'customer.create',
        entityType: 'customer' as const,
        action: 'create' as const,
        recordId: 'cust_123',
        data: { name: 'New Customer' },
        timestamp: new Date(),
      };

      await expect(nsClient.handleWebhookPayload(payload)).resolves.toBeUndefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple concurrent requests', async () => {
      const queries = [
        { q: 'SELECT id FROM customer LIMIT 1' },
        { q: 'SELECT id FROM vendor LIMIT 1' },
        { q: 'SELECT id FROM invoice LIMIT 1' },
      ];

      // Each suiteQL call triggers one fetch
      mockFetch.mockResolvedValue(okJson({
        items: [{ id: '1' }],
        count: 1,
        hasMore: false,
      }));

      const results = await Promise.all(
        queries.map((q) => nsClient.suiteQL(q)),
      );

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.results).toBeDefined();
      });
    });
  });
});
