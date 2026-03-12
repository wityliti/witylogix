/**
 * Salesforce Adapter Tests
 * OAuth flow, CRUD operations, and data normalization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SalesforceAdapter } from '../salesforce-client.js';
import type { CRMConnection, CRMContact, CRMAccount, CRMOpportunity } from '../types.js';

describe('SalesforceAdapter', () => {
  let adapter: SalesforceAdapter;
  let mockConnection: CRMConnection;

  beforeEach(() => {
    mockConnection = {
      id: 'sf_conn_123',
      tenantId: 'tenant_1',
      provider: 'salesforce',
      accessToken: 'sf_access_token_xyz',
      refreshToken: 'sf_refresh_token_xyz',
      expiresAt: new Date(Date.now() + 3600000),
      instanceUrl: 'https://test-instance.salesforce.com',
      orgId: 'org_123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    adapter = new SalesforceAdapter(mockConnection, {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      redirectUri: 'http://localhost:3000/callback',
      environment: 'sandbox',
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('OAuth Flow', () => {
    it('should generate authorization URL', () => {
      const authUrl: string = adapter.getAuthorizationUrl('test_state');

      expect(authUrl).toContain('https://test.salesforce.com/services/oauth2/authorize');
      expect(authUrl).toContain('client_id=test_client_id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('state=test_state');
      expect(authUrl).toContain('scope=api');
    });

    it('should generate authorization URL without state', () => {
      const authUrl: string = adapter.getAuthorizationUrl();

      expect(authUrl).toContain('state=');
      const stateMatch: RegExpMatchArray | null = authUrl.match(/state=([^&]+)/);
      expect(stateMatch?.[1]).toHaveLength(32);
    });

    it('should authenticate with authorization code', async () => {
      const mockResponse: Record<string, unknown> = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        instance_url: 'https://new-instance.salesforce.com',
        id: 'org_id/user_id',
        token_type: 'Bearer',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const connection: CRMConnection = await adapter.authenticate('auth_code_123');

      expect(connection.provider).toBe('salesforce');
      expect(connection.accessToken).toBe('new_access_token');
      expect(connection.refreshToken).toBe('new_refresh_token');
      expect(connection.instanceUrl).toBe('https://new-instance.salesforce.com');
      expect(connection.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Contact Operations', () => {
    it('should fetch contacts with pagination', async () => {
      const mockResponse = {
        records: [
          {
            Id: 'contact_123',
            FirstName: 'John',
            LastName: 'Doe',
            Email: 'john@example.com',
            Phone: '555-1234',
            SystemModstamp: '2024-03-01T10:00:00Z',
          },
        ],
        totalSize: 1,
        done: true,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getContacts(
        { email: 'john@example.com' },
        { limit: 20, offset: 0 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.data[0]?.firstName).toBe('John');
      expect(result.data[0]?.lastName).toBe('Doe');
    });

    it('should get single contact', async () => {
      const mockResponse = {
        Id: 'contact_123',
        FirstName: 'Jane',
        LastName: 'Smith',
        Email: 'jane@example.com',
        Phone: '555-5678',
        MailingCity: 'San Francisco',
        SystemModstamp: '2024-03-01T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const contact: CRMContact = await adapter.getContact('contact_123');

      expect(contact.id).toBe('contact_123');
      expect(contact.firstName).toBe('Jane');
      expect(contact.lastName).toBe('Smith');
      expect(contact.address?.city).toBe('San Francisco');
    });

    it('should create contact', async () => {
      const mockResponse = {
        id: 'contact_new_456',
        success: true,
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const newContact: CRMContact = await adapter.createContact({
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        phone: '555-9999',
      });

      expect(newContact.id).toBe('contact_new_456');
      expect(newContact.firstName).toBe('Alice');
      expect(newContact.lastModifiedAt).toBeInstanceOf(Date);
    });

    it('should update contact', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Id: 'contact_123',
            FirstName: 'John',
            LastName: 'Doe Updated',
            Email: 'john.new@example.com',
            SystemModstamp: '2024-03-01T12:00:00Z',
          }),
        });

      const updated: CRMContact = await adapter.updateContact('contact_123', {
        lastName: 'Doe Updated',
        email: 'john.new@example.com',
      });

      expect(updated.lastName).toBe('Doe Updated');
      expect(updated.email).toBe('john.new@example.com');
    });

    it('should search contacts', async () => {
      const mockResponse = {
        searchRecords: [
          { attributes: { type: 'Contact', url: '/contact_123' }, Id: 'contact_123', FirstName: 'John', LastName: 'Doe' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.search('John Doe', 'Contact', { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('Account Operations', () => {
    it('should fetch accounts', async () => {
      const mockResponse = {
        records: [
          {
            Id: 'account_123',
            Name: 'Acme Corp',
            Industry: 'Technology',
            Website: 'https://acme.com',
            Phone: '555-0000',
            SystemModstamp: '2024-03-01T10:00:00Z',
          },
        ],
        totalSize: 1,
        done: true,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getAccounts(
        { name: 'Acme' },
        { limit: 20, offset: 0 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe('Acme Corp');
      expect(result.data[0]?.industry).toBe('Technology');
    });

    it('should create account', async () => {
      const mockResponse = {
        id: 'account_new_789',
        success: true,
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const newAccount: CRMAccount = await adapter.createAccount({
        name: 'Tech Innovations LLC',
        industry: 'Software',
        website: 'https://techinnovations.com',
      });

      expect(newAccount.id).toBe('account_new_789');
      expect(newAccount.name).toBe('Tech Innovations LLC');
    });
  });

  describe('Opportunity Operations', () => {
    it('should fetch opportunities', async () => {
      const mockResponse = {
        records: [
          {
            Id: 'opp_123',
            Name: 'Enterprise License Deal',
            AccountId: 'account_123',
            StageName: 'Negotiation/Review',
            Amount: 50000,
            Probability: 75,
            CloseDate: '2024-06-30',
            SystemModstamp: '2024-03-01T10:00:00Z',
          },
        ],
        totalSize: 1,
        done: true,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getOpportunities(
        { stage: 'Negotiation/Review' },
        { limit: 20 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.stage).toBe('Negotiation/Review');
      expect(result.data[0]?.amount).toBe(50000);
      expect(result.data[0]?.probability).toBe(75);
    });

    it('should update opportunity/deal', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Id: 'opp_123',
            Name: 'Enterprise License Deal',
            StageName: 'Closed Won',
            Amount: 60000,
            Probability: 100,
            SystemModstamp: '2024-03-01T12:00:00Z',
          }),
        });

      const updated: CRMOpportunity = await adapter.updateDeal('opp_123', {
        stage: 'Closed Won',
        amount: 60000,
        probability: 100,
      });

      expect(updated.stage).toBe('Closed Won');
      expect(updated.probability).toBe(100);
    });
  });

  describe('Activity Operations', () => {
    it('should create activity', async () => {
      const mockResponse = {
        id: 'activity_new_001',
        success: true,
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const activity = await adapter.createActivity({
        type: 'note',
        subject: 'Delivery completed successfully',
        description: 'Customer received order on time',
        recordType: 'contact',
        recordId: 'contact_123',
      });

      expect(activity.id).toBe('activity_new_001');
      expect(activity.subject).toBe('Delivery completed successfully');
    });

    it('should sync multiple activities', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'activity_1', success: true, errors: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'activity_2', success: true, errors: [] }),
        });

      const results = await adapter.syncActivities([
        {
          id: 'act_1',
          type: 'note',
          subject: 'First activity',
          recordType: 'contact',
          recordId: 'contact_123',
        },
        {
          id: 'act_2',
          type: 'note',
          subject: 'Second activity',
          recordType: 'contact',
          recordId: 'contact_123',
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('synced');
      expect(results[1]?.status).toBe('synced');
    });
  });

  describe('Rate Limiting', () => {
    it('should return rate limit info', () => {
      const rateLimitInfo = adapter.getRateLimitInfo();

      expect(rateLimitInfo).toHaveProperty('remaining');
      expect(rateLimitInfo).toHaveProperty('limit');
      expect(rateLimitInfo).toHaveProperty('resetAt');
      expect(rateLimitInfo.limit).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(adapter.getContact('invalid_id')).rejects.toThrow();
    });

    it('should handle network errors with retry', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Id: 'contact_123',
            FirstName: 'John',
            LastName: 'Doe',
            SystemModstamp: '2024-03-01T10:00:00Z',
          }),
        });

      const contact: CRMContact = await adapter.getContact('contact_123');

      expect(contact.id).toBe('contact_123');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Normalization', () => {
    it('should normalize Salesforce contact to CRMContact', async () => {
      const mockResponse = {
        Id: 'sf_contact_123',
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john@example.com',
        Phone: '555-1234',
        MobilePhone: '555-5678',
        Title: 'VP Sales',
        MailingStreet: '123 Main St',
        MailingCity: 'San Francisco',
        MailingState: 'CA',
        MailingPostalCode: '94102',
        MailingCountry: 'USA',
        SystemModstamp: '2024-03-01T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const contact: CRMContact = await adapter.getContact('sf_contact_123');

      expect(contact.firstName).toBe('John');
      expect(contact.lastName).toBe('Doe');
      expect(contact.email).toBe('john@example.com');
      expect(contact.phone).toBe('555-1234');
      expect(contact.mobile).toBe('555-5678');
      expect(contact.title).toBe('VP Sales');
      expect(contact.address).toEqual({
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'USA',
      });
      expect(contact.lastModifiedAt).toEqual(new Date('2024-03-01T10:00:00Z'));
    });
  });
});
