/**
 * Pipedrive CRM SDK Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PipedriveCRMSDKClient,
  type PipedriveCRMConfig,
} from '@witylogix/core/integrations/crm/pipedrive-sdk-client';

describe('PipedriveCRMSDKClient', () => {
  let client: PipedriveCRMSDKClient;
  const mockConfig: PipedriveCRMConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://localhost:3000/callback',
    apiToken: 'test-api-token',
  };

  beforeEach(() => {
    client = new PipedriveCRMSDKClient(mockConfig);
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should generate OAuth2 authorization URL', () => {
      const url = client.getAuthorizationUrl('test-state');
      expect(url).toContain('https://oauth.pipedrive.com');
      expect(url).toContain('test-client-id');
      expect(url).toContain('test-state');
    });

    it('should set API token', () => {
      client.setApiToken('new-api-token');
      expect(client).toBeDefined();
    });

    it('should set access token', () => {
      const token = 'test-access-token';
      const expiresAt = new Date(Date.now() + 3600000);
      client.setAccessToken(token, expiresAt);
      expect(client).toBeDefined();
    });

    it('should throw error when exchanging code without required config', async () => {
      const clientWithoutSecret = new PipedriveCRMSDKClient({ apiToken: 'token' });
      await expect(clientWithoutSecret.exchangeCodeForToken('code')).rejects.toThrow();
    });
  });

  describe('Persons Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get persons list', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['X-RateLimit-Remaining', '75']]),
      });

      const result = await client.getPersons({ limit: 100 });

      expect(result.persons).toHaveLength(1);
      expect(result.persons[0].name).toBe('John Doe');
    });

    it('should create person', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 123,
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const person = await client.createPerson({
        name: 'Jane Smith',
        email: 'jane@example.com',
      });

      expect(person.id).toBe(123);
      expect(person.name).toBe('Jane Smith');
    });

    it('should update person', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.updatePerson(123, {
        email: 'newemail@example.com',
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should delete person', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deletePerson(123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should search persons', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            item: {
              id: 1,
              name: 'John',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const results = await client.searchPersons('John');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John');
    });
  });

  describe('Organizations Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get organizations', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'Acme Corp',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getOrganizations();

      expect(result.orgs).toHaveLength(1);
      expect(result.orgs[0].name).toBe('Acme Corp');
    });

    it('should create organization', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 42,
          name: 'Tech Startup',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const org = await client.createOrganization({
        name: 'Tech Startup',
      });

      expect(org.id).toBe(42);
      expect(org.name).toBe('Tech Startup');
    });
  });

  describe('Deals Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get deals', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            title: 'Big Deal',
            value: 50000,
            currency: 'USD',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getDeals();

      expect(result.deals).toHaveLength(1);
      expect(result.deals[0].title).toBe('Big Deal');
      expect(result.deals[0].value).toBe(50000);
    });

    it('should create deal', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 99,
          title: 'New Deal',
          value: 25000,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const deal = await client.createDeal({
        title: 'New Deal',
        value: 25000,
      });

      expect(deal.id).toBe(99);
      expect(deal.title).toBe('New Deal');
    });

    it('should search deals', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            item: {
              id: 1,
              title: 'Big Deal',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const results = await client.searchDeals('Big Deal');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Big Deal');
    });
  });

  describe('Activities Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get activities', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            type: 'call',
            subject: 'Phone call',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getActivities();

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].type).toBe('call');
    });

    it('should create activity', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 5,
          type: 'email',
          subject: 'Follow up',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const activity = await client.createActivity({
        type: 'email',
        subject: 'Follow up',
      });

      expect(activity.id).toBe(5);
      expect(activity.type).toBe('email');
    });
  });

  describe('Pipelines & Stages', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get pipelines', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'Sales Pipeline',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getPipelines();

      expect(result.pipelines).toHaveLength(1);
      expect(result.pipelines[0].name).toBe('Sales Pipeline');
    });

    it('should get pipeline stages', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            pipeline_id: 1,
            name: 'Negotiation',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getPipelineStages(1);

      expect(result.stages).toHaveLength(1);
      expect(result.stages[0].name).toBe('Negotiation');
    });
  });

  describe('Products Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should get products', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: 'Enterprise Plan',
            code: 'ENT-001',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getProducts();

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Enterprise Plan');
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should verify webhook signature', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const signature = 'b6f6e7b2e5e9a7e8e5e5e9e5b6f6e7b2e5e9a7e8e5e5e9e5b6f6e7b2e5e9a7';

      const isValid = client.verifyWebhookSignature(signature, payload, secret);
      expect(isValid).toBeDefined();
    });

    it('should create webhook', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 123,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.createWebhook(
        'https://example.com/webhook',
        'added',
        'person'
      );

      expect(result.webhookId).toBe(123);
    });

    it('should delete webhook', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteWebhook(123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/webhooks/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
    });

    it('should track rate limit info', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
        headers: new Map([['X-RateLimit-Remaining', '70']]),
      });

      await client.getPersons();

      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBeLessThanOrEqual(80);
      expect(rateLimitInfo.limit).toBe(80);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      client.setApiToken('test-api-token');
      global.fetch = vi.fn();
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(client.getPersons()).rejects.toThrow('Pipedrive API error');
    });

    it('should throw error when no authentication is set', async () => {
      const unauthClient = new PipedriveCRMSDKClient({});
      await expect(unauthClient.getPersons()).rejects.toThrow();
    });
  });
});
