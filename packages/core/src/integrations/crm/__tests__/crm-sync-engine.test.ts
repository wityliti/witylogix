/**
 * CRM Sync Engine Tests
 * Bidirectional sync, conflict resolution, and activity syncing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CRMSyncEngine } from '../crm-sync-engine.js';
import type {
  CRMConnection,
  CRMActivity,
  ICRMAdapter,
  CRMContact,
  CRMPagedResult,
  RateLimitInfo,
} from '../types.js';
import type { DeliveryData, WitylogixCustomer } from '../crm-sync-engine.js';

// Mock adapter
class MockCRMAdapter implements ICRMAdapter {
  async getAuthorizationUrl(): Promise<string> {
    return 'http://mock.auth.url';
  }

  async authenticate(): Promise<CRMConnection> {
    return {
      id: 'mock_conn',
      tenantId: 'tenant_1',
      provider: 'salesforce',
      accessToken: 'token',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async refreshToken(): Promise<string> {
    return 'new_token';
  }

  async getContacts(): Promise<CRMPagedResult<CRMContact>> {
    return { data: [], total: 0, hasMore: false };
  }

  async getContact(id: string): Promise<CRMContact> {
    return {
      id,
      firstName: 'Test',
      lastName: 'Contact',
      lastModifiedAt: new Date(),
    };
  }

  async createContact(contact: Omit<CRMContact, 'id' | 'lastModifiedAt'>): Promise<CRMContact> {
    return {
      ...contact,
      id: `contact_${Date.now()}`,
      lastModifiedAt: new Date(),
    };
  }

  async updateContact(id: string, updates: Partial<CRMContact>): Promise<CRMContact> {
    return {
      id,
      firstName: updates.firstName || 'Test',
      lastName: updates.lastName || 'Contact',
      lastModifiedAt: new Date(),
    };
  }

  async getAccounts(): Promise<CRMPagedResult<unknown>> {
    return { data: [], total: 0, hasMore: false };
  }

  async getAccount(): Promise<unknown> {
    return {};
  }

  async createAccount(): Promise<unknown> {
    return {};
  }

  async updateAccount(): Promise<unknown> {
    return {};
  }

  async getOpportunities(): Promise<CRMPagedResult<unknown>> {
    return { data: [], total: 0, hasMore: false };
  }

  async getOpportunity(): Promise<unknown> {
    return {};
  }

  async updateDeal(): Promise<unknown> {
    return {};
  }

  async getActivities(): Promise<CRMPagedResult<CRMActivity>> {
    return { data: [], total: 0, hasMore: false };
  }

  async createActivity(activity: Omit<CRMActivity, 'id' | 'lastModifiedAt'>): Promise<CRMActivity> {
    return {
      ...activity,
      id: `activity_${Date.now()}`,
      lastModifiedAt: new Date(),
    };
  }

  async syncActivities(activities: CRMActivity[]): Promise<Array<{ id: string; status: string; message: string }>> {
    return activities.map((activity: CRMActivity) => ({
      id: activity.id,
      status: 'synced',
      message: 'Activity synced',
    }));
  }

  async search(): Promise<CRMPagedResult<unknown>> {
    return { data: [], total: 0, hasMore: false };
  }

  getRateLimitInfo(): RateLimitInfo {
    return {
      remaining: 100,
      limit: 100,
      resetAt: new Date(),
    };
  }
}

describe('CRMSyncEngine', () => {
  let engine: CRMSyncEngine;
  let mockConnection: CRMConnection;
  let mockAdapter: MockCRMAdapter;

  beforeEach(() => {
    mockConnection = {
      id: 'conn_123',
      tenantId: 'tenant_1',
      provider: 'salesforce',
      accessToken: 'token_xyz',
      isActive: true,
      syncConfig: {
        autoSync: true,
        bidirectional: true,
        webhooksEnabled: true,
        conflictResolution: 'manual',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockAdapter = new MockCRMAdapter();
    engine = new CRMSyncEngine(mockConnection, mockAdapter, []);
  });

  describe('Delivery Sync', () => {
    it('should sync delivery completion to CRM', async () => {
      const delivery: DeliveryData = {
        id: 'delivery_123',
        customerId: 'contact_456',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '555-1234',
        status: 'completed',
        completedAt: new Date(),
        deliveryNotes: 'Delivered on time',
        signature: 'base64encodedimage',
      };

      const result = await engine.syncDeliveryCompletion(delivery);

      expect(result.id).toBe('delivery_123');
      expect(result.status).toBe('synced');
      expect(result.provider).toBe('salesforce');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle delivery sync errors', async () => {
      const mockErrorAdapter: Partial<ICRMAdapter> = {
        syncActivities: async () => {
          throw new Error('Sync failed');
        },
        getRateLimitInfo: () => ({
          remaining: 100,
          limit: 100,
          resetAt: new Date(),
        }),
      };

      const errorEngine = new CRMSyncEngine(
        mockConnection,
        mockErrorAdapter as ICRMAdapter,
        [],
      );

      const delivery: DeliveryData = {
        id: 'delivery_123',
        customerId: 'contact_456',
        customerName: 'John Doe',
        status: 'completed',
        completedAt: new Date(),
      };

      const result = await errorEngine.syncDeliveryCompletion(delivery);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Sync failed');
    });
  });

  describe('Customer Enrichment', () => {
    it('should enrich customer from CRM contact', async () => {
      const customer: WitylogixCustomer = await engine.enrichCustomerFromCRM('contact_123');

      expect(customer.id).toContain('customer_');
      expect(customer.name).toBe('Test Contact');
      expect(customer.source).toBe('crm');
      expect(customer.externalCrmId).toBe('contact_123');
      expect(customer.externalCrmProvider).toBe('salesforce');
      expect(customer.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('should handle enrichment errors', async () => {
      const mockErrorAdapter: Partial<ICRMAdapter> = {
        getContact: async () => {
          throw new Error('Contact not found');
        },
        getRateLimitInfo: () => ({
          remaining: 100,
          limit: 100,
          resetAt: new Date(),
        }),
      };

      const errorEngine = new CRMSyncEngine(
        mockConnection,
        mockErrorAdapter as ICRMAdapter,
        [],
      );

      await expect(errorEngine.enrichCustomerFromCRM('invalid_id')).rejects.toThrow(
        'Failed to enrich customer from CRM',
      );
    });
  });

  describe('Customer Sync to CRM', () => {
    it('should create new contact in CRM', async () => {
      const customer: WitylogixCustomer = {
        id: 'customer_123',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        source: 'manual',
      };

      const crmContact = await engine.syncCustomerToCRM(customer);

      expect(crmContact.id).toBeDefined();
      expect(crmContact.firstName).toBe('Jane');
      expect(crmContact.lastName).toBe('Smith');
      expect(crmContact.email).toBe('jane@example.com');
    });

    it('should update existing contact in CRM', async () => {
      const customer: WitylogixCustomer = {
        id: 'customer_123',
        name: 'Jane Smith Updated',
        email: 'jane.new@example.com',
        externalCrmId: 'contact_456',
        externalCrmProvider: 'salesforce',
        source: 'crm',
      };

      const crmContact = await engine.syncCustomerToCRM(customer);

      expect(crmContact.id).toBe('contact_456');
      expect(crmContact.firstName).toBe('Jane');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with CRM wins strategy', async () => {
      mockConnection.syncConfig = {
        autoSync: true,
        bidirectional: true,
        webhooksEnabled: true,
        conflictResolution: 'crm_wins',
      };

      const engine2 = new CRMSyncEngine(mockConnection, mockAdapter, []);

      const resolution = await engine2.resolveConflict({
        field: 'email',
        witylogixValue: 'old@example.com',
        crmValue: 'new@example.com',
        witylogixModifiedAt: new Date('2024-01-01'),
        crmModifiedAt: new Date('2024-03-01'),
        precedence: 'crm_wins',
      });

      expect(resolution.selectedValue).toBe('new@example.com');
      expect(resolution.selectedSource).toBe('crm');
      expect(resolution.requiresManualReview).toBe(false);
    });

    it('should resolve conflict with Witylogix wins strategy', async () => {
      mockConnection.syncConfig = {
        autoSync: true,
        bidirectional: true,
        webhooksEnabled: true,
        conflictResolution: 'witylogix_wins',
      };

      const engine2 = new CRMSyncEngine(mockConnection, mockAdapter, []);

      const resolution = await engine2.resolveConflict({
        field: 'email',
        witylogixValue: 'old@example.com',
        crmValue: 'new@example.com',
        witylogixModifiedAt: new Date('2024-01-01'),
        crmModifiedAt: new Date('2024-03-01'),
        precedence: 'witylogix_wins',
      });

      expect(resolution.selectedValue).toBe('old@example.com');
      expect(resolution.selectedSource).toBe('witylogix');
      expect(resolution.requiresManualReview).toBe(false);
    });

    it('should resolve conflict with manual strategy using most recent', async () => {
      const resolution = await engine.resolveConflict({
        field: 'email',
        witylogixValue: 'old@example.com',
        crmValue: 'new@example.com',
        witylogixModifiedAt: new Date('2024-01-01'),
        crmModifiedAt: new Date('2024-03-01'),
        precedence: 'manual',
      });

      expect(resolution.selectedValue).toBe('new@example.com');
      expect(resolution.selectedSource).toBe('crm');
      expect(resolution.requiresManualReview).toBe(true);
    });
  });

  describe('Incremental Sync', () => {
    it('should perform incremental sync', async () => {
      const results = await engine.performIncrementalSync('contact');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sync Audit Trail', () => {
    it('should get sync logs with filters', async () => {
      // Perform a sync first
      const delivery: DeliveryData = {
        id: 'delivery_123',
        customerId: 'contact_456',
        customerName: 'John Doe',
        status: 'completed',
        completedAt: new Date(),
      };

      await engine.syncDeliveryCompletion(delivery);

      // Get logs
      const logs = engine.getSyncLogs({ status: 'synced', limit: 10 });

      expect(logs).toBeInstanceOf(Array);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should get sync statistics', async () => {
      const stats = engine.getSyncStats();

      expect(stats).toHaveProperty('totalSyncs');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('lastSyncAt');
    });
  });

  describe('Field Mapping Validation', () => {
    it('should validate valid field mapping', () => {
      const mapping = {
        id: 'mapping_1',
        connectionId: 'conn_123',
        witylogixField: 'email',
        crmField: 'Email',
        recordType: 'contact' as const,
        direction: 'bidirectional' as const,
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateFieldMapping(mapping);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid field mapping', () => {
      const mapping = {
        id: 'mapping_1',
        connectionId: 'conn_123',
        witylogixField: '',
        crmField: '',
        recordType: 'contact' as const,
        direction: 'invalid' as never,
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateFieldMapping(mapping);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Sync State Management', () => {
    it('should reset sync state', () => {
      mockConnection.lastSyncAt = new Date();
      engine.resetSyncState();

      expect(mockConnection.lastSyncAt).toBeUndefined();
    });
  });

  describe('Bidirectional Sync', () => {
    it('should perform bidirectional sync', async () => {
      const customers: Array<{
        id: string;
        type: 'contact';
        data: WitylogixCustomer;
      }> = [
        {
          id: 'customer_1',
          type: 'contact',
          data: {
            id: 'customer_1',
            name: 'Alice Johnson',
            email: 'alice@example.com',
            source: 'manual',
          },
        },
      ];

      const results = await engine.performBidirectionalSync(customers, 'contact');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.status).toBe('synced');
    });
  });
});
