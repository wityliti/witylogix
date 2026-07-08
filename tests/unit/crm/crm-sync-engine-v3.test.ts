/**
 * Unit tests for CRM Sync Engine v3
 *
 * @module tests/unit/crm/crm-sync-engine-v3.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CrmSyncOrchestrator,
  ChangeDetector,
  BidirectionalResolver,
  SyncTransaction,
  type CrmRepository,
} from "../../../packages/core/src/crm/crm-sync-engine-v3.js";

import type {
  UnifiedContact,
  SyncConfig,
  ConflictRecord,
} from "../../../packages/core/src/crm/crm-types.js";

import {
  CrmProvider,
  SyncDirection,
  ConflictResolutionStrategy,
} from "../../../packages/core/src/crm/crm-types.js";

/**
 * Mock CRM Repository for testing
 */
class MockCrmRepository implements CrmRepository {
  async findContacts(): Promise<UnifiedContact[]> {
    return [];
  }

  async findContactById(): Promise<UnifiedContact | null> {
    return null;
  }

  async createContact(
    tenantId: string,
    contact: UnifiedContact,
  ): Promise<UnifiedContact> {
    return contact;
  }

  async updateContact(
    tenantId: string,
    contactId: string,
    updates: Partial<UnifiedContact>,
  ): Promise<UnifiedContact> {
    return {} as UnifiedContact;
  }

  async deleteContact(): Promise<void> {}

  async findDeals() {
    return [];
  }

  async findDealById() {
    return null;
  }

  async createDeal(tenantId: string, deal: any) {
    return deal;
  }

  async updateDeal(tenantId: string, dealId: string, updates: any) {
    return {} as any;
  }

  async deleteDeal(): Promise<void> {}

  async findCompanies() {
    return [];
  }

  async findCompanyById() {
    return null;
  }

  async createCompany(tenantId: string, company: any) {
    return company;
  }

  async updateCompany(tenantId: string, companyId: string, updates: any) {
    return {} as any;
  }

  async deleteCompany(): Promise<void> {}

  async findActivities() {
    return [];
  }

  async findActivityById() {
    return null;
  }

  async createActivity(tenantId: string, activity: any) {
    return activity;
  }

  async updateActivity(tenantId: string, activityId: string, updates: any) {
    return {} as any;
  }

  async deleteActivity(): Promise<void> {}

  async recordConflict(): Promise<void> {}

  async findUnresolvedConflicts(): Promise<ConflictRecord[]> {
    return [];
  }

  async resolveConflict(): Promise<void> {}
}

describe("CrmSyncOrchestrator", () => {
  let orchestrator: CrmSyncOrchestrator;
  let repository: MockCrmRepository;
  let config: SyncConfig;

  beforeEach(() => {
    repository = new MockCrmRepository();

    config = {
      configId: "config_1",
      tenantId: "tenant_1",
      crmProvider: CrmProvider.SALESFORCE,
      direction: SyncDirection.BIDIRECTIONAL,
      conflictStrategy: ConflictResolutionStrategy.TIMESTAMP_WINS,
      fieldMappings: [],
      syncInterval: 3600000,
      maxBatchSize: 100,
      autoRetry: true,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orchestrator = new CrmSyncOrchestrator(repository, config);
  });

  describe("Field Mapping", () => {
    it("should apply field mappings correctly", () => {
      const mapping = {
        mappingId: "map_1",
        tenantId: "tenant_1",
        crmProvider: CrmProvider.SALESFORCE,
        entityType: "Contact" as const,
        rules: [
          {
            sourceField: "email",
            targetField: "email",
            required: true,
            dataType: "string" as const,
          },
          {
            sourceField: "firstName",
            targetField: "firstName",
            required: true,
            dataType: "string" as const,
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sourceData = {
        email: "test@example.com",
        firstName: "John",
      };

      const result = orchestrator.applyFieldMapping(mapping, sourceData);

      expect(result).toEqual({
        email: "test@example.com",
        firstName: "John",
      });
    });

    it("should handle nested field paths", () => {
      const mapping = {
        mappingId: "map_1",
        tenantId: "tenant_1",
        crmProvider: CrmProvider.SALESFORCE,
        entityType: "Contact" as const,
        rules: [
          {
            sourceField: "contact.email",
            targetField: "emailAddress",
            required: true,
            dataType: "string" as const,
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sourceData = {
        contact: {
          email: "test@example.com",
        },
      };

      const result = orchestrator.applyFieldMapping(mapping, sourceData);

      expect(result.emailAddress).toBe("test@example.com");
    });

    it("should apply transformations", () => {
      const mapping = {
        mappingId: "map_1",
        tenantId: "tenant_1",
        crmProvider: CrmProvider.SALESFORCE,
        entityType: "Contact" as const,
        rules: [
          {
            sourceField: "amount",
            targetField: "total",
            transform: (value: unknown) => (value as number) * 1.1,
            required: true,
            dataType: "number" as const,
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sourceData = { amount: 100 };
      const result = orchestrator.applyFieldMapping(mapping, sourceData);

      expect(result.total).toBe(110);
    });

    it("should skip optional fields with undefined values", () => {
      const mapping = {
        mappingId: "map_1",
        tenantId: "tenant_1",
        crmProvider: CrmProvider.SALESFORCE,
        entityType: "Contact" as const,
        rules: [
          {
            sourceField: "phone",
            targetField: "phoneNumber",
            required: false,
            dataType: "string" as const,
          },
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sourceData = { email: "test@example.com" };
      const result = orchestrator.applyFieldMapping(mapping, sourceData);

      expect(result.phoneNumber).toBeUndefined();
    });
  });

  describe("Change Detection", () => {
    let changeDetector: ChangeDetector;

    beforeEach(() => {
      changeDetector = new ChangeDetector();
    });

    it("should detect field changes", () => {
      const oldEntity = {
        id: "1",
        email: "old@example.com",
        firstName: "John",
      };

      const newEntity = {
        id: "1",
        email: "new@example.com",
        firstName: "John",
      };

      const changes = changeDetector.detectChanges(oldEntity, newEntity);

      expect(changes.size).toBe(1);
      expect(changes.get("email")).toEqual({
        oldValue: "old@example.com",
        newValue: "new@example.com",
      });
    });

    it("should detect added fields", () => {
      const oldEntity = { id: "1" };
      const newEntity = { id: "1", newField: "value" };

      const changes = changeDetector.detectChanges(oldEntity, newEntity);

      expect(changes.get("newField")).toEqual({
        oldValue: undefined,
        newValue: "value",
      });
    });

    it("should detect deleted fields", () => {
      const oldEntity = { id: "1", deletedField: "value" };
      const newEntity = { id: "1" };

      const changes = changeDetector.detectChanges(oldEntity, newEntity);

      expect(changes.get("deletedField")).toEqual({
        oldValue: "value",
        newValue: undefined,
      });
    });

    it("should get delta of changes", () => {
      const oldEntity = { id: "1", email: "old@example.com" };
      const newEntity = { id: "1", email: "new@example.com" };

      const delta = changeDetector.getDelta(oldEntity, newEntity);

      expect(delta).toEqual({ email: "new@example.com" });
    });
  });

  describe("Bidirectional Conflict Resolution", () => {
    let resolver: BidirectionalResolver;

    beforeEach(() => {
      resolver = new BidirectionalResolver();
    });

    it("should detect conflicts between different values", () => {
      const conflicts = resolver.detectConflicts(
        "conflict_1",
        "entity_1",
        "Contact",
        CrmProvider.SALESFORCE,
        "tenant_1",
        { email: "internal@example.com" },
        { email: "external@example.com" },
        ConflictResolutionStrategy.TIMESTAMP_WINS,
      );

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictField).toBe("email");
    });

    it("should resolve conflict with TIMESTAMP_WINS strategy", () => {
      const conflict: ConflictRecord = {
        conflictId: "conflict_1",
        entityId: "entity_1",
        entityType: "Contact",
        crmProvider: CrmProvider.SALESFORCE,
        tenantId: "tenant_1",
        conflictField: "email",
        internalValue: "internal@example.com",
        externalValue: "external@example.com",
        internalUpdatedAt: new Date(Date.now() - 10000).toISOString(),
        externalUpdatedAt: new Date().toISOString(),
        resolutionStrategy: ConflictResolutionStrategy.TIMESTAMP_WINS,
        isResolved: false,
        createdAt: new Date().toISOString(),
      };

      const resolution = resolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.TIMESTAMP_WINS,
      );

      expect(resolution).toBe("external@example.com");
    });

    it("should resolve conflict with SOURCE_OF_TRUTH strategy", () => {
      const conflict: ConflictRecord = {
        conflictId: "conflict_1",
        entityId: "entity_1",
        entityType: "Contact",
        crmProvider: CrmProvider.SALESFORCE,
        tenantId: "tenant_1",
        conflictField: "email",
        internalValue: "internal@example.com",
        externalValue: "external@example.com",
        internalUpdatedAt: new Date().toISOString(),
        externalUpdatedAt: new Date().toISOString(),
        resolutionStrategy: ConflictResolutionStrategy.SOURCE_OF_TRUTH,
        isResolved: false,
        createdAt: new Date().toISOString(),
      };

      const resolution = resolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.SOURCE_OF_TRUTH,
      );

      expect(resolution).toBe("external@example.com");
    });

    it("should respect field priorities", () => {
      resolver.setFieldPriorities({ email: "INTERNAL" });

      const conflict: ConflictRecord = {
        conflictId: "conflict_1",
        entityId: "entity_1",
        entityType: "Contact",
        crmProvider: CrmProvider.SALESFORCE,
        tenantId: "tenant_1",
        conflictField: "email",
        internalValue: "internal@example.com",
        externalValue: "external@example.com",
        internalUpdatedAt: new Date().toISOString(),
        externalUpdatedAt: new Date().toISOString(),
        resolutionStrategy: ConflictResolutionStrategy.FIELD_PRIORITY,
        isResolved: false,
        createdAt: new Date().toISOString(),
      };

      const resolution = resolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.FIELD_PRIORITY,
      );

      expect(resolution).toBe("internal@example.com");
    });

    it("should get conflict queue", () => {
      resolver.detectConflicts(
        "conflict_1",
        "entity_1",
        "Contact",
        CrmProvider.SALESFORCE,
        "tenant_1",
        { email: "internal@example.com" },
        { email: "external@example.com" },
        ConflictResolutionStrategy.TIMESTAMP_WINS,
      );

      const queue = resolver.getConflictQueue();

      expect(queue.length).toBeGreaterThan(0);
    });
  });

  describe("Sync Transaction", () => {
    it("should create transaction with unique ID", () => {
      const transaction1 = orchestrator.createTransaction();
      const transaction2 = orchestrator.createTransaction();

      expect(transaction1.getState().transactionId).not.toBe(
        transaction2.getState().transactionId,
      );
    });

    it("should add operations to transaction", () => {
      const transaction = orchestrator.createTransaction();

      transaction.addOperation({
        operationId: "op_1",
        operationType: "CREATE",
        entityType: "Contact",
        entityId: "contact_1",
        data: { email: "test@example.com" },
        crmProvider: CrmProvider.SALESFORCE,
        status: "PENDING",
      });

      const state = transaction.getState();
      expect(state.operations.length).toBe(1);
    });

    it("should commit transaction", () => {
      const transaction = orchestrator.createTransaction();

      transaction.addOperation({
        operationId: "op_1",
        operationType: "CREATE",
        entityType: "Contact",
        entityId: "contact_1",
        data: { email: "test@example.com" },
        crmProvider: CrmProvider.SALESFORCE,
        status: "PENDING",
      });

      transaction.commit();

      const state = transaction.getState();
      expect(state.status).toBe("COMMITTED");
      expect(state.operations[0].status).toBe("COMPLETED");
    });

    it("should rollback transaction", () => {
      const transaction = orchestrator.createTransaction();

      transaction.addOperation({
        operationId: "op_1",
        operationType: "CREATE",
        entityType: "Contact",
        entityId: "contact_1",
        data: { email: "test@example.com" },
        originalData: { email: "original@example.com" },
        crmProvider: CrmProvider.SALESFORCE,
        status: "PENDING",
      });

      transaction.rollback("Test error");

      const state = transaction.getState();
      expect(state.status).toBe("ROLLED_BACK");
      expect(state.error).toBe("Test error");
      expect(state.operations[0].status).toBe("FAILED");
    });
  });

  describe("Metrics", () => {
    it("should record successful sync", () => {
      orchestrator.recordSuccess(10, 1000);

      const metrics = orchestrator.getMetrics();

      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.successfulSyncs).toBe(1);
      expect(metrics.recordsSynced).toBe(10);
      expect(metrics.successRate).toBe(100);
    });

    it("should record failed sync", () => {
      orchestrator.recordFailure(1000);

      const metrics = orchestrator.getMetrics();

      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.failedSyncs).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it("should record conflicts", () => {
      orchestrator.recordConflicts(3, 2);

      const metrics = orchestrator.getMetrics();

      expect(metrics.totalConflicts).toBe(3);
      expect(metrics.unresolvedConflicts).toBe(2);
    });

    it("should calculate average latency", () => {
      orchestrator.recordSuccess(5, 1000);
      orchestrator.recordSuccess(5, 2000);
      orchestrator.recordFailure(1500);

      const metrics = orchestrator.getMetrics();

      // Average of 1000, 2000, 1500 = 1500
      expect(metrics.avgLatencyMs).toBeCloseTo(1500, 0);
    });
  });
});
