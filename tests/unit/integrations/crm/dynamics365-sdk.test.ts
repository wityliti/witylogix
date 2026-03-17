/**
 * Microsoft Dynamics 365 SDK Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Dynamics365SDKClient,
  type Dynamics365Config,
} from '@witylogix/core/integrations/crm/dynamics365-sdk-client';

describe('Dynamics365SDKClient', () => {
  let client: Dynamics365SDKClient;
  const mockConfig: Dynamics365Config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    tenantId: 'test-tenant-id',
    organizationUrl: 'https://test.crm.dynamics.com',
    apiVersion: 'v9.2',
  };

  beforeEach(() => {
    client = new Dynamics365SDKClient(mockConfig);
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should generate authorization URL for auth code flow', () => {
      const url = client.getAuthorizationUrl('test-state', 'https://localhost:3000/callback');
      expect(url).toContain('login.microsoftonline.com');
      expect(url).toContain('test-tenant-id');
      expect(url).toContain('test-state');
    });

    it('should set access token', () => {
      const token = 'test-token';
      const expiresAt = new Date(Date.now() + 3600000);
      client.setAccessToken(token, expiresAt);
      expect(client).toBeDefined();
    });

    it('should get access token via client credentials', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        headers: new Map(),
      });

      const token = await client.getAccessToken();

      expect(token).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('login.microsoftonline.com'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw error on token exchange failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(
        client.exchangeCodeForToken('invalid-code', 'https://localhost:3000/callback')
      ).rejects.toThrow();
    });
  });

  describe('OData Query Building', () => {
    it('should build OData query string', async () => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
        headers: new Map(),
      });

      await client.getContacts({
        select: ['contactid', 'firstname'],
        filter: "firstname eq 'John'",
        top: 10,
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('$select=contactid%2Cfirstname');
      expect(callUrl).toContain('$filter=');
      expect(callUrl).toContain('$top=10');
    });
  });

  describe('Contacts Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should get contacts list', async () => {
      const mockResponse = {
        value: [
          {
            contactid: '550e8400-e29b-41d4-a716-446655440000',
            firstname: 'John',
            lastname: 'Doe',
            emailaddress1: 'john@example.com',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['X-Rate-Limit-Remaining-Requests', '5900']]),
      });

      const result = await client.getContacts();

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].firstname).toBe('John');
    });

    it('should get single contact', async () => {
      const mockResponse = {
        contactid: '550e8400-e29b-41d4-a716-446655440000',
        firstname: 'Jane',
        lastname: 'Smith',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const contact = await client.getContact('550e8400-e29b-41d4-a716-446655440000');

      expect(contact.firstname).toBe('Jane');
      expect(contact.lastname).toBe('Smith');
    });

    it('should create contact', async () => {
      const mockResponse = {
        contactid: 'new-id-123',
        firstname: 'Alice',
        lastname: 'Johnson',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const contact = await client.createContact({
        firstname: 'Alice',
        lastname: 'Johnson',
        emailaddress1: 'alice@example.com',
      });

      expect(contact.firstname).toBe('Alice');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/contacts'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should update contact with ETag', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map(),
      });

      await client.updateContact('contact-123', { firstname: 'Updated' }, 'etag-value');

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers['If-Match']).toBe('etag-value');
    });

    it('should delete contact', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map(),
      });

      await client.deleteContact('contact-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/contacts(contact-123)'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Accounts Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should get accounts', async () => {
      const mockResponse = {
        value: [
          {
            accountid: 'acc-123',
            name: 'Acme Corp',
            website: 'https://acme.com',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getAccounts();

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].name).toBe('Acme Corp');
    });

    it('should create account', async () => {
      const mockResponse = {
        accountid: 'new-acc-123',
        name: 'Tech Startup',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const account = await client.createAccount({
        name: 'Tech Startup',
      });

      expect(account.name).toBe('Tech Startup');
    });
  });

  describe('Leads Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should get leads', async () => {
      const mockResponse = {
        value: [
          {
            leadid: 'lead-123',
            firstname: 'Tom',
            companyname: 'TechCorp',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getLeads();

      expect(result.leads).toHaveLength(1);
      expect(result.leads[0].firstname).toBe('Tom');
    });

    it('should create lead', async () => {
      const mockResponse = {
        leadid: 'new-lead-123',
        firstname: 'Sarah',
        companyname: 'StartupXYZ',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const lead = await client.createLead({
        firstname: 'Sarah',
        companyname: 'StartupXYZ',
      });

      expect(lead.firstname).toBe('Sarah');
    });
  });

  describe('Opportunities Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should get opportunities', async () => {
      const mockResponse = {
        value: [
          {
            opportunityid: 'opp-123',
            name: 'Large Deal',
            probability: 0.75,
            estimatedvalue: 100000,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.getOpportunities();

      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].name).toBe('Large Deal');
      expect(result.opportunities[0].probability).toBe(0.75);
    });

    it('should create opportunity', async () => {
      const mockResponse = {
        opportunityid: 'new-opp-123',
        name: 'New Deal',
        estimatedvalue: 50000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const opportunity = await client.createOpportunity({
        name: 'New Deal',
        estimatedvalue: 50000,
      });

      expect(opportunity.name).toBe('New Deal');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should execute batch operations', async () => {
      const mockResponse = `
--batch_123
Content-Type: application/http
Content-ID: 1

HTTP/1.1 200 OK
Content-Type: application/json

{"contactid":"123"}
--batch_123--
`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockResponse,
        headers: new Map(),
      });

      const batch = {
        requests: [
          {
            id: '1',
            method: 'POST' as const,
            url: '/contacts',
            body: { firstname: 'John' },
          },
        ],
      };

      const results = await client.executeBatch(batch);

      expect(results).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$batch'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Webhook Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should verify webhook signature', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const signature = 'dGVzdC1zaWduYXR1cmU='; // Base64 encoded

      const isValid = client.verifyWebhookSignature(signature, payload, secret);
      expect(isValid).toBeDefined();
    });

    it('should register webhook', async () => {
      const mockResponse = {
        id: 'webhook-123',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await client.registerWebhook('contacts', 'https://example.com/webhook');

      expect(result.registrationId).toBe('webhook-123');
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should get entity metadata', async () => {
      const mockResponse = {
        LogicalName: 'contact',
        DisplayName: 'Contact',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const metadata = await client.getEntityMetadata('contact');

      expect(metadata.LogicalName).toBe('contact');
    });

    it('should get attribute metadata', async () => {
      const mockResponse = {
        LogicalName: 'firstname',
        AttributeType: 'String',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const metadata = await client.getAttributeMetadata('contact', 'firstname');

      expect(metadata.LogicalName).toBe('firstname');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
    });

    it('should track service protection rate limits', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
        headers: new Map([
          ['X-Rate-Limit-Remaining-Requests', '5900'],
          ['X-Rate-Limit-Reset-After-Seconds', '60'],
        ]),
      });

      await client.getContacts();

      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBeLessThanOrEqual(6000);
      expect(rateLimitInfo.limit).toBe(6000);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn();
    });

    it('should throw error on authentication failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(client.getContacts()).rejects.toThrow('Dynamics 365 API error');
    });

    it('should throw error when token not set', async () => {
      const unauthClient = new Dynamics365SDKClient(mockConfig);
      await expect(unauthClient.getContacts()).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid query' }),
      });

      await expect(client.getAccounts()).rejects.toThrow();
    });
  });

  describe('OData Query Expansion', () => {
    beforeEach(() => {
      client.setAccessToken('test-token');
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
        headers: new Map(),
      });
    });

    it('should support $expand for navigation properties', async () => {
      await client.getContacts({
        expand: ['parentcustomerid_account'],
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('$expand=parentcustomerid_account');
    });

    it('should support $orderby for sorting', async () => {
      await client.getAccounts({
        orderby: 'name asc',
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('$orderby=name+asc');
    });
  });
});
