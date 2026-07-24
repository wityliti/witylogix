/**
 * CRM Sync Engine v2 Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CRMSyncEngine } from "../crm-sync-engine-v2.js";
import type {
  CRMSyncEngineConfig,
  SyncState,
  SyncConflict,
  SyncErrorRecord,
} from "../crm-sync-engine-v2.js";
import type { CRMConnection, ICRMAdapter, RateLimitInfo } from "../types.js";

// Mock adapter implementation
class MockCRMAdapter implements ICRMAdapter {
  getAuthorizationUrl(state?: string): string {
    return `http://auth.example.com?state=${state}`;
  }

  async authenticate(authCode: string): Promise<CRMConnection> {
    return {
      id: "conn-1",
      tenantId: "tenant-1",
      provider: "zoho",
      accessToken: "token",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async refreshToken(connection: CRMConnection): Promise<string> {
    return "new-token";
  }

  async getContacts() {
    return {
      data: [
        {
          id: "1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          lastModifiedAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
    };
  }

  async getContact(id: string) {
    return {
      id,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      lastModifiedAt: new Date(),
    };
  }

  async createContact() {
    return {
      id: "2",
      firstName: "Jane",
      lastName: "Smith",
      lastModifiedAt: new Date(),
    };
  }

  async updateContact(id: string, updates: any) {
    return {
      id,
      ...updates,
      lastModifiedAt: new Date(),
    };
  }

  async getAccounts() {
    return {
      data: [
        {
          id: "acc-1",
          name: "Acme Corp",
          website: "https://acme.com",
          lastModifiedAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
    };
  }

  async getAccount(id: string) {
    return {
      id,
      name: "Acme Corp",
      lastModifiedAt: new Date(),
    };
  }

  async createAccount() {
    return {
      id: "acc-2",
      name: "New Corp",
      lastModifiedAt: new Date(),
    };
  }

  async updateAccount(id: string, updates: any) {
    return {
      id,
      ...updates,
      lastModifiedAt: new Date(),
    };
  }

  async getOpportunities() {
    return {
      data: [
        {
          id: "opp-1",
          name: "Big Deal",
          amount: 50000,
          lastModifiedAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
    };
  }

  async getOpportunity(id: string) {
    return {
      id,
      name: "Big Deal",
      amount: 50000,
      lastModifiedAt: new Date(),
    };
  }

  async updateDeal(id: string, updates: any) {
    return {
      id,
      ...updates,
      lastModifiedAt: new Date(),
    };
  }

  async getActivities() {
    return {
      data: [
        {
          id: "act-1",
          type: "call" as const,
          subject: "Follow up",
          description: "Call customer",
          recordType: "contact" as const,
          recordId: "1",
          lastModifiedAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
    };
  }

  async createActivity() {
    return {
      id: "act-2",
      type: "email" as const,
      subject: "Send email",
      recordType: "contact" as const,
      recordId: "1",
      lastModifiedAt: new Date(),
    };
  }

  async syncActivities() {
    return [
      {
        id: "sync-1",
        recordType: "activity",
        recordId: "act-1",
        provider: "zoho",
        status: "synced",
        message: "Synced",
        timestamp: new Date(),
      },
    ];
  }

  async search() {
    return {
      data: [],
      total: 0,
      hasMore: false,
    };
  }

  getRateLimitInfo(): RateLimitInfo {
    return {
      remaining: 1000,
      limit: 10000,
      resetAt: new Date(Date.now() + 3600000),
    };
  }
}

describe("CRMSyncEngine", () => {
  let engine: CRMSyncEngine;
  let mockConfig: CRMSyncEngineConfig;
  let mockAdapters: Map<any, ICRMAdapter>;
  let mockConnection: CRMConnection;

  beforeEach(() => {
    mockConnection = {
      id: "conn-1",
      tenantId: "tenant-1",
      provider: "zoho",
      accessToken: "token",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockConfig = {
      tenantId: "tenant-1",
      connections: [mockConnection],
      fieldMappings: [],
      conflictResolution: {
        strategy: "last_write_wins",
      },
      batchSize: 200,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableWebhooks: true,
      syncDirection: "bidirectional",
    };

    mockAdapters = new Map([["zoho", new MockCRMAdapter()]]);

    engine = new CRMSyncEngine(mockConfig, mockAdapters as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Sync Orchestration", () => {
    it("should perform a full sync", async () => {
      const metrics = await engine.performFullSync("contact");

      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(metrics.startedAt).toBeDefined();
      expect(metrics.completedAt).toBeDefined();
      expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should sync contacts", async () => {
      const metrics = await engine.performFullSync("contact");
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
    });

    it("should sync accounts", async () => {
      const metrics = await engine.performFullSync("account");
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
    });

    it("should sync deals", async () => {
      const metrics = await engine.performFullSync("deal");
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
    });

    it("should sync activities", async () => {
      const metrics = await engine.performFullSync("activity");
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Sync State Management", () => {
    it("should retrieve sync state by entity", async () => {
      await engine.performFullSync("contact");
      const state = engine.getSyncState("zoho", "contact", "1");
      expect(state).toBeDefined();
    });

    it("should get all sync states", async () => {
      await engine.performFullSync("contact");
      const states = engine.getAllSyncStates();
      expect(Array.isArray(states)).toBe(true);
    });
  });

  describe("Conflict Detection", () => {
    it("should get sync conflicts", async () => {
      await engine.performFullSync("contact");
      const conflicts = engine.getSyncConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe("Error Queue", () => {
    it("should get error queue", async () => {
      await engine.performFullSync("contact");
      const errorQueue = engine.getErrorQueue();
      expect(Array.isArray(errorQueue)).toBe(true);
    });
  });

  describe("Sync Metrics", () => {
    it("should track metrics properly", async () => {
      const metrics = await engine.performFullSync("contact");

      expect(metrics.totalProcessed).toBeDefined();
      expect(metrics.startedAt).toBeInstanceOf(Date);
      expect(metrics.completedAt).toBeInstanceOf(Date);
      expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Sync Token Management", () => {
    it("should generate sync tokens", () => {
      const token = engine.generateSyncToken("zoho");
      expect(token).toBeDefined();
      expect(token.provider).toBe("zoho");
      expect(token.token).toBeDefined();
    });
  });

  describe("Webhook Handling", () => {
    it("should handle webhook events", async () => {
      await expect(
        engine.handleCRMWebhook("zoho", "contact.created", { id: "1" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("Health Check", () => {
    it("should check adapter health", async () => {
      const health = await engine.healthCheck();
      expect(health).toBeDefined();
    });
  });

  describe("Entity Relationship Sync", () => {
    it("should sync relationships", async () => {
      await expect(engine.syncEntityRelationships()).resolves.toBeUndefined();
    });
  });
});
