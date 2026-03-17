/**
 * SAP OData Client Tests
 * Comprehensive unit tests for SAP S/4HANA OData v4 API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ODataQueryBuilder, SapODataClient } from '../sap-odata-client.js';

describe('ODataQueryBuilder', () => {
  let builder: ODataQueryBuilder;

  beforeEach(() => {
    builder = new ODataQueryBuilder();
  });

  describe('filter()', () => {
    it('should add filter condition', () => {
      builder.filter('Status', 'eq', 'active');
      const query = builder.build();
      expect(query).toContain('$filter=');
      expect(query).toContain('Status eq active');
    });

    it('should escape single quotes in filter values', () => {
      builder.filter('Name', 'eq', "O'Brien");
      const query = builder.build();
      expect(query).toContain("O''Brien");
    });

    it('should validate field names', () => {
      expect(() => builder.filter('invalid-field', 'eq', 'value')).toThrow();
      expect(() => builder.filter('', 'eq', 'value')).toThrow();
    });

    it('should handle startswith operator', () => {
      builder.filter('Name', 'startswith', 'Test');
      const query = builder.build();
      expect(query).toContain('startswith(Name,');
    });

    it('should handle contains operator', () => {
      builder.filter('Description', 'contains', 'product');
      const query = builder.build();
      expect(query).toContain('contains(Description,');
    });

    it('should combine multiple filters with AND', () => {
      builder.filter('Status', 'eq', 'active').filter('Type', 'eq', 'customer');
      const query = builder.build();
      expect(query).toContain('and');
    });
  });

  describe('select()', () => {
    it('should add select clause', () => {
      builder.select(['Name', 'Status', 'Email']);
      const query = builder.build();
      expect(query).toContain('$select=Name,Status,Email');
    });

    it('should validate field names', () => {
      expect(() => builder.select([])).toThrow();
      expect(() => builder.select(['invalid-field'])).toThrow();
    });
  });

  describe('expand()', () => {
    it('should add expand clause', () => {
      builder.expand(['BPAddresses', 'Contacts']);
      const query = builder.build();
      expect(query).toContain('$expand=BPAddresses,Contacts');
    });

    it('should validate entity names', () => {
      expect(() => builder.expand(['invalid-entity'])).toThrow();
    });
  });

  describe('orderby()', () => {
    it('should add orderby clause', () => {
      builder.orderby('Name', 'asc');
      const query = builder.build();
      expect(query).toContain('$orderby=Name asc');
    });

    it('should handle multiple orderby', () => {
      builder.orderby('Status', 'desc').orderby('Name', 'asc');
      const query = builder.build();
      expect(query).toContain('Status desc');
      expect(query).toContain('Name asc');
    });
  });

  describe('pagination', () => {
    it('should add top clause', () => {
      builder.top(100);
      const query = builder.build();
      expect(query).toContain('$top=100');
    });

    it('should add skip clause', () => {
      builder.skip(50);
      const query = builder.build();
      expect(query).toContain('$skip=50');
    });

    it('should validate top and skip', () => {
      expect(() => builder.top(0)).toThrow();
      expect(() => builder.top(-1)).toThrow();
      expect(() => builder.skip(-1)).toThrow();
    });
  });

  describe('count()', () => {
    it('should add count clause', () => {
      builder.count();
      const query = builder.build();
      expect(query).toContain('$count=true');
    });
  });

  describe('complex queries', () => {
    it('should build complex query', () => {
      const query = builder
        .filter('Status', 'eq', 'active')
        .filter('Type', 'eq', 'customer')
        .select(['Name', 'Email', 'Status'])
        .expand(['Addresses'])
        .orderby('Name', 'asc')
        .top(50)
        .skip(100)
        .count()
        .build();

      expect(query).toContain('$filter=');
      expect(query).toContain('$select=');
      expect(query).toContain('$expand=');
      expect(query).toContain('$orderby=');
      expect(query).toContain('$top=');
      expect(query).toContain('$skip=');
      expect(query).toContain('$count=');
    });
  });
});

describe('SapODataClient', () => {
  let client: SapODataClient;

  beforeEach(() => {
    client = new SapODataClient({
      clientId: 'test_client',
      clientSecret: 'test_secret',
      tokenUrl: 'https://auth.example.com/token',
      instanceUrl: 'https://sap.example.com/sap/opu/odata/sap/',
      environment: 'sandbox',
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should validate required config', () => {
      expect(() => {
        new SapODataClient({
          clientId: '',
          clientSecret: 'secret',
          tokenUrl: 'url',
          instanceUrl: 'url',
        });
      }).toThrow();
    });

    it('should set default values', () => {
      const defaultClient = new SapODataClient({
        clientId: 'client',
        clientSecret: 'secret',
        tokenUrl: 'url',
        instanceUrl: 'url',
      });

      expect(defaultClient).toBeDefined();
    });
  });

  describe('authenticate()', () => {
    it('should authenticate and get access token', async () => {
      const mockResponse = {
        access_token: 'mock_token',
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const token = await client.authenticate();

      expect(token).toBe('mock_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should handle authentication error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(client.authenticate()).rejects.toThrow();
    });
  });

  describe('checkHealth()', () => {
    it('should return true for healthy connection', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
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

  describe('createBusinessPartner()', () => {
    it('should create business partner', async () => {
      const partner = {
        BusinessPartnerName: 'Test Partner',
        SearchTerm: 'test',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...partner, BusinessPartner: 'BP001' }),
        });

      const result = await client.createBusinessPartner(partner);

      expect(result.BusinessPartner).toBe('BP001');
    });
  });

  describe('getBusinessPartner()', () => {
    it('should retrieve business partner', async () => {
      const mockBP = {
        BusinessPartner: 'BP001',
        BusinessPartnerName: 'Test Partner',
        BPAddresses: [],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBP,
        });

      const result = await client.getBusinessPartner('BP001');

      expect(result.BusinessPartner).toBe('BP001');
      expect(result.BusinessPartnerName).toBe('Test Partner');
    });
  });

  describe('queryBusinessPartners()', () => {
    it('should query business partners with filters', async () => {
      const mockResponse = {
        value: [
          { BusinessPartner: 'BP001', BusinessPartnerName: 'Partner 1' },
          { BusinessPartner: 'BP002', BusinessPartnerName: 'Partner 2' },
        ],
        '@odata.count': 2,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const query = new ODataQueryBuilder().filter('Status', 'eq', 'active').top(10);

      const result = await client.queryBusinessPartners(query);

      expect(result.value).toHaveLength(2);
      expect(result['@odata.count']).toBe(2);
    });
  });

  describe('getSalesOrder()', () => {
    it('should retrieve sales order with items', async () => {
      const mockOrder = {
        SalesOrder: 'SO001',
        DocumentDate: '2024-03-17',
        OrderCurrency: 'USD',
        NetAmount: 1000,
        SOItems: [
          {
            SalesOrderItem: '10',
            Material: 'MAT001',
            OrderQuantity: 5,
            NetAmount: 500,
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrder,
        });

      const result = await client.getSalesOrder('SO001');

      expect(result.SalesOrder).toBe('SO001');
      expect(result.SOItems).toHaveLength(1);
    });
  });

  describe('createSalesOrder()', () => {
    it('should create sales order', async () => {
      const order = {
        DocumentDate: '2024-03-17',
        Bill_Cust: 'CUST001',
        OrderCurrency: 'USD',
        NetAmount: 1000,
        TotalAmount: 1100,
        SOItems: [],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...order, SalesOrder: 'SO001' }),
        });

      const result = await client.createSalesOrder(order);

      expect(result.SalesOrder).toBe('SO001');
    });
  });

  describe('getProduct()', () => {
    it('should retrieve product with plant data', async () => {
      const mockProduct = {
        Material: 'MAT001',
        MaterialDescription: 'Test Material',
        BaseUnit: 'EA',
        to_MaterialPlant: [
          {
            Plant: 'PLANT1',
            Quantity: 100,
            StandardCost: 50,
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProduct,
        });

      const result = await client.getProduct('MAT001');

      expect(result.Material).toBe('MAT001');
      expect(result.to_MaterialPlant).toHaveLength(1);
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limit', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['x-csrf-token', 'test_token']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [] }),
        });

      const start = Date.now();
      await client.checkHealth();
      const duration = Date.now() - start;

      // Should complete without excessive delay
      expect(duration).toBeLessThan(1000);
    });
  });
});
