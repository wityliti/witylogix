/**
 * Pipedrive Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipedriveAdapter } from '../pipedrive-client.js';
import type { CRMConnection, CRMFieldMapping, PipedriveConfig } from '../types.js';

describe('PipedriveAdapter', () => {
  let adapter: PipedriveAdapter;
  let mockConfig: PipedriveConfig;
  let mockConnection: CRMConnection;
  let mockFieldMappings: CRMFieldMapping[];

  beforeEach(() => {
    mockConfig = {
      apiToken: 'test-api-token',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    };

    mockConnection = {
      id: 'conn-123',
      tenantId: 'tenant-123',
      provider: 'pipedrive',
      accessToken: 'test-access-token',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFieldMappings = [
      {
        id: 'mapping-1',
        connectionId: 'conn-123',
        witylogixField: 'customerName',
        crmField: 'name',
        recordType: 'contact',
        direction: 'bidirectional',
        transformation: 'none',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    adapter = new PipedriveAdapter(mockConfig, mockConnection, mockFieldMappings);

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact (Person) Operations', () => {
    it('should fetch persons successfully', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'John Doe',
            email: [{ value: 'john@example.com', primary: true }],
            phone: [{ value: '555-1234', primary: true }],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContacts({}, { limit: 500, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].firstName).toBe('John');
      expect(result.data[0].email).toBe('john@example.com');
    });

    it('should get a single person by ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          name: 'Jane Smith',
          email: [{ value: 'jane@example.com', primary: true }],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContact('1');

      expect(result.id).toBe('1');
      expect(result.firstName).toBe('Jane');
      expect(result.email).toBe('jane@example.com');
    });

    it('should create a new person', async () => {
      const newPerson = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-5678',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              name: 'Test User',
              email: [{ value: 'test@example.com', primary: true }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              name: 'Test User',
              email: [{ value: 'test@example.com', primary: true }],
            },
          }),
        });

      const result = await adapter.createContact(newPerson);

      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
    });

    it('should update a person', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 1,
              name: 'John Updated',
              email: [{ value: 'john.updated@example.com', primary: true }],
            },
          }),
        });

      const result = await adapter.updateContact('1', {
        firstName: 'John',
        lastName: 'Updated',
        email: 'john.updated@example.com',
      });

      expect(result.email).toBe('john.updated@example.com');
    });
  });

  describe('Account (Organization) Operations', () => {
    it('should fetch organizations successfully', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'Acme Corp',
            address: '123 Main St, Anytown, USA',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getAccounts({}, { limit: 500 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Acme Corp');
    });

    it('should get a single organization by ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          name: 'Acme Corp',
          address: '123 Main St',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getAccount('1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Acme Corp');
    });

    it('should create an organization', async () => {
      const newOrg = {
        name: 'New Corp',
        website: 'https://newcorp.com',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              name: 'New Corp',
              cc_email: 'https://newcorp.com',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              name: 'New Corp',
              cc_email: 'https://newcorp.com',
            },
          }),
        });

      const result = await adapter.createAccount(newOrg);

      expect(result.name).toBe('New Corp');
    });
  });

  describe('Deal Operations', () => {
    it('should fetch deals successfully', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            title: 'Big Deal',
            value: 50000,
            currency: 'USD',
            stage_id: 1,
            update_time: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getDeals({}, { limit: 500 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Big Deal');
      expect(result.data[0].amount).toBe(50000);
    });

    it('should get a single deal by ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          title: 'Big Deal',
          value: 50000,
          currency: 'USD',
          update_time: new Date().toISOString(),
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getDeal('1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Big Deal');
      expect(result.amount).toBe(50000);
    });

    it('should create a deal', async () => {
      const newDeal = {
        name: 'New Deal',
        amount: 25000,
        currency: 'USD',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              title: 'New Deal',
              value: 25000,
              currency: 'USD',
              update_time: new Date().toISOString(),
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              title: 'New Deal',
              value: 25000,
              currency: 'USD',
              update_time: new Date().toISOString(),
            },
          }),
        });

      const result = await adapter.createDeal(newDeal);

      expect(result.name).toBe('New Deal');
      expect(result.amount).toBe(25000);
    });

    it('should update a deal', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 1,
              title: 'Updated Deal',
              value: 75000,
              currency: 'USD',
              update_time: new Date().toISOString(),
            },
          }),
        });

      const result = await adapter.updateDeal('1', {
        name: 'Updated Deal',
        amount: 75000,
      });

      expect(result.name).toBe('Updated Deal');
      expect(result.amount).toBe(75000);
    });
  });

  describe('Deal Flow & Rotting Detection', () => {
    it('should get deals by stage', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            title: 'Deal in Stage',
            value: 30000,
            stage_id: 2,
            update_time: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getDealsByStage(2, { limit: 500 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].stageId).toBe('2');
    });

    it('should detect rotting deals', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 1,
              title: 'Old Deal',
              value: 10000,
              update_time: oldDate.toISOString(),
            },
          ],
        }),
      });

      const result = await adapter.detectRottingDeals(30);

      expect(result).toHaveLength(1);
      expect(result[0].daysInStage).toBeGreaterThan(30);
    });

    it('should move deal to stage', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 1,
              title: 'Moved Deal',
              stage_id: 3,
              update_time: new Date().toISOString(),
            },
          }),
        });

      const result = await adapter.moveDealToStage('1', 3);

      expect(result.stageId).toBe('3');
    });
  });

  describe('Activity Operations', () => {
    it('should fetch activities', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            type: 'call',
            subject: 'Follow up call',
            body: 'Call customer',
            due_date: '2025-03-15',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getActivities('1', { limit: 500 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('call');
      expect(result.data[0].subject).toBe('Follow up call');
    });

    it('should create an activity', async () => {
      const newActivity = {
        type: 'email' as const,
        subject: 'Send Email',
        description: 'Follow up email',
        recordType: 'contact' as const,
        recordId: '1',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 2,
              type: 'email',
              subject: 'Send Email',
              body: 'Follow up email',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 2,
                type: 'email',
                subject: 'Send Email',
                body: 'Follow up email',
              },
            ],
          }),
        });

      const result = await adapter.createActivity(newActivity);

      expect(result.type).toBe('email');
      expect(result.subject).toBe('Send Email');
    });
  });

  describe('Pipeline Operations', () => {
    it('should fetch all pipelines', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'Sales Pipeline',
            url_title: 'sales-pipeline',
            active: true,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getPipelines();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sales Pipeline');
      expect(result[0].isActive).toBe(true);
    });

    it('should get stages for a pipeline', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Leads', order_nr: 1 },
          { id: 2, name: 'Qualified', order_nr: 2 },
          { id: 3, name: 'Won', order_nr: 3 },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getPipelineStages(1);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Leads');
      expect(result[2].name).toBe('Won');
    });
  });

  describe('Custom Fields Operations', () => {
    it('should fetch custom fields for persons', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, key: 'custom_field', name: 'Custom Field', type: 'text' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getCustomFields('person');

      expect(result).toHaveLength(1);
      expect((result[0] as any).name).toBe('Custom Field');
    });

    it('should fetch custom fields for deals', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 2, key: 'deal_custom', name: 'Deal Custom', type: 'number' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getCustomFields('deal');

      expect(result).toHaveLength(1);
      expect((result[0] as any).name).toBe('Deal Custom');
    });
  });

  describe('Search Operations', () => {
    it('should search for records', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 1, name: 'John Doe', type: 'person' },
            { id: 1, name: 'Acme Corp', type: 'organization' },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.search('john', 'contact', { limit: 100 });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Webhook Operations', () => {
    it('should register a webhook', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, subscription_url: 'https://example.com/webhook' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.registerWebhook(
        'https://example.com/webhook',
        ['person.created', 'deal.updated']
      );

      expect((result as any).id).toBe(1);
    });

    it('should unregister a webhook', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await expect(adapter.unregisterWebhook(1)).resolves.toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should return rate limit info', () => {
      const rateLimit = adapter.getRateLimitInfo();

      expect(rateLimit).toHaveProperty('remaining');
      expect(rateLimit).toHaveProperty('limit');
      expect(rateLimit).toHaveProperty('resetAt');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Unauthorized',
        }),
      });

      await expect(adapter.getContacts({}, { limit: 500 })).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.getContacts({}, { limit: 500 })).rejects.toThrow();
    });
  });
});
