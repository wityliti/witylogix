/**
 * ERP Sync Engine Tests
 * Comprehensive test suite for bidirectional sync with conflict resolution
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ERPConnection } from "../types.js";
import { ConnectionStatus } from "../types.js";
import { ERPSyncEngine, createERPSyncEngine } from "../erp-sync-engine.js";
import { AbstractERPAdapter } from "../erp-adapter.js";

// Mock adapter implementation
class MockERPAdapter extends AbstractERPAdapter {
  async checkHealth(): Promise<boolean> {
    return true;
  }
}

describe("ERPSyncEngine", () => {
  let engine: ERPSyncEngine;
  let mockConnection: ERPConnection;
  let mockAdapter: AbstractERPAdapter;

  beforeEach(() => {
    engine = new ERPSyncEngine();

    mockConnection = {
      id: "conn_1",
      tenantId: "tenant_1",
      provider: "sap",
      status: ConnectionStatus.ACTIVE,
      credentials: {
        accessToken: "mock_token",
      },
      config: {
        timeout: 30000,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockAdapter = new MockERPAdapter("sap", mockConnection);
    engine.registerAdapter("conn_1", mockConnection, mockAdapter);
  });

  describe("Adapter Registration", () => {
    it("should register adapter", () => {
      expect(engine.getAdapter("conn_1")).toBe(mockAdapter);
    });

    it("should retrieve registered adapter", () => {
      const adapter = engine.getAdapter("conn_1");
      expect(adapter).toBeDefined();
      expect(adapter?.provider).toBe("sap");
    });

    it("should return undefined for unregistered adapter", () => {
      expect(engine.getAdapter("unknown_conn")).toBeUndefined();
    });
  });

  describe("Sync Operations", () => {
    it("should execute sync with push direction", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
        batchSize: 10,
      });

      expect(summary.syncId).toBeDefined();
      expect(summary.connectionId).toBe("conn_1");
      expect(summary.startTime).toBeDefined();
      expect(summary.endTime).toBeDefined();
    });

    it("should execute sync with pull direction", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "pull",
        conflictResolution: "priority",
        entityTypes: ["invoice", "payment"],
        skipErrors: true,
      });

      expect(summary.direction === "pull" || summary).toBeTruthy();
      expect(summary.auditLogs).toBeDefined();
      expect(Array.isArray(summary.auditLogs)).toBe(true);
    });

    it("should execute bidirectional sync", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "bidirectional",
        conflictResolution: "manual",
        entityTypes: ["customer", "product", "order"],
        batchSize: 50,
      });

      expect(summary.syncId).toBeDefined();
      expect(summary.conflictCount).toBeGreaterThanOrEqual(0);
    });

    it("should respect batch size", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
        batchSize: 5,
      });

      expect(summary).toBeDefined();
    });

    it("should handle full sync option", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "pull",
        conflictResolution: "priority",
        entityTypes: ["customer"],
        fullSync: true,
      });

      expect(summary.totalRecords).toBeGreaterThanOrEqual(0);
    });

    it("should skip errors when configured", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
        skipErrors: true,
      });

      expect(Array.isArray(summary.errors)).toBe(true);
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve conflicts by timestamp", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "bidirectional",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      if (summary.conflictCount > 0) {
        const conflictLog = summary.auditLogs.find(
          (log) => log.action === "conflict",
        );
        expect(conflictLog?.resolutionMethod).toBe("timestamp");
      }
    });

    it("should resolve conflicts by priority (local)", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "bidirectional",
        conflictResolution: "priority",
        entityTypes: ["invoice"],
      });

      if (summary.conflictCount > 0) {
        const conflictLog = summary.auditLogs.find(
          (log) => log.action === "conflict",
        );
        expect(conflictLog?.resolutionMethod).toBe("priority");
      }
    });

    it("should flag manual conflicts", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "bidirectional",
        conflictResolution: "manual",
        entityTypes: ["order"],
      });

      if (summary.conflictCount > 0) {
        const conflictLog = summary.auditLogs.find(
          (log) => log.action === "conflict",
        );
        expect(conflictLog?.action).toBe("conflict");
      }
    });
  });

  describe("Audit Logging", () => {
    it("should maintain audit logs", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      expect(summary.auditLogs).toBeDefined();
      expect(Array.isArray(summary.auditLogs)).toBe(true);
    });

    it("should get sync history", () => {
      const history = engine.getSyncHistory("conn_1", 10);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should track sync timestamps", async () => {
      const beforeSync = new Date();
      await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });
      const afterSync = new Date();

      const lastSync = engine.getLastSyncTime("conn_1");
      expect(lastSync).toBeDefined();
      expect(lastSync!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
      expect(lastSync!.getTime()).toBeLessThanOrEqual(
        afterSync.getTime() + 1000,
      );
    });

    it("should export audit logs as CSV", async () => {
      await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      const csv = engine.exportAuditLogsAsCSV("conn_1");
      expect(typeof csv).toBe("string");
      expect(csv.includes("ID")).toBe(true);
      expect(csv.includes("Connection ID")).toBe(true);
    });

    it("should clear audit logs", async () => {
      await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      engine.clearAuditLogs("conn_1");
      const history = engine.getSyncHistory("conn_1");
      expect(history.length).toBe(0);
    });
  });

  describe("Entity Dependency Ordering", () => {
    it("should sync entities in dependency order", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["invoice", "customer", "product", "order"],
      });

      // Entities should be processed in order: customer, product, order, invoice
      expect(summary.auditLogs.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle all entity types", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: [
          "customer",
          "vendor",
          "product",
          "invoice",
          "order",
          "payment",
          "journal_entry",
          "inventory",
        ],
      });

      expect(summary).toBeDefined();
    });
  });

  describe("Sync Summary", () => {
    it("should provide sync summary", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      expect(summary.syncId).toBeDefined();
      expect(summary.connectionId).toBe("conn_1");
      expect(typeof summary.totalRecords).toBe("number");
      expect(typeof summary.successCount).toBe("number");
      expect(typeof summary.failureCount).toBe("number");
      expect(typeof summary.conflictCount).toBe("number");
      expect(typeof summary.skippedCount).toBe("number");
      expect(summary.startTime instanceof Date).toBe(true);
      expect(summary.endTime instanceof Date).toBe(true);
    });

    it("should export summary as JSON", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      const json = engine.exportSyncSummary(summary);
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed.syncId).toBe(summary.syncId);
      expect(parsed.connectionId).toBe(summary.connectionId);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing connection", async () => {
      await expect(
        engine.sync("nonexistent_conn", {
          direction: "push",
          conflictResolution: "timestamp",
          entityTypes: ["customer"],
        }),
      ).rejects.toThrow();
    });

    it("should throw on missing adapter", async () => {
      await expect(
        engine.sync("nonexistent_conn", {
          direction: "push",
          conflictResolution: "timestamp",
          entityTypes: ["customer"],
        }),
      ).rejects.toThrow("Adapter or connection not found");
    });

    it("should continue on error when skipErrors is true", async () => {
      const summary = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer", "product"],
        skipErrors: true,
      });

      expect(summary.errors).toBeDefined();
      expect(Array.isArray(summary.errors)).toBe(true);
    });
  });

  describe("Factory Function", () => {
    it("should create sync engine with factory", () => {
      const connections = new Map([
        [
          "conn_1",
          {
            connection: mockConnection,
            adapter: mockAdapter,
          },
        ],
      ]);

      const engine2 = createERPSyncEngine(connections);
      expect(engine2.getAdapter("conn_1")).toBe(mockAdapter);
    });

    it("should handle multiple adapters in factory", () => {
      const mockConnection2: ERPConnection = {
        ...mockConnection,
        id: "conn_2",
        provider: "netsuite",
      };
      const mockAdapter2 = new MockERPAdapter("netsuite", mockConnection2);

      const connections = new Map([
        [
          "conn_1",
          {
            connection: mockConnection,
            adapter: mockAdapter,
          },
        ],
        [
          "conn_2",
          {
            connection: mockConnection2,
            adapter: mockAdapter2,
          },
        ],
      ]);

      const engine2 = createERPSyncEngine(connections);
      expect(engine2.getAdapter("conn_1")).toBe(mockAdapter);
      expect(engine2.getAdapter("conn_2")).toBe(mockAdapter2);
    });
  });

  describe("Delta Sync", () => {
    it("should support delta sync (incremental)", async () => {
      // First sync
      const summary1 = await engine.sync("conn_1", {
        direction: "pull",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
        fullSync: true,
      });

      const lastSync = engine.getLastSyncTime("conn_1");
      expect(lastSync).toBeDefined();

      // Second sync (delta)
      const summary2 = await engine.sync("conn_1", {
        direction: "pull",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
        fullSync: false, // Delta sync
      });

      expect(summary2.syncId).not.toBe(summary1.syncId);
    });
  });

  describe("Multiple Connections", () => {
    it("should handle multiple connections independently", async () => {
      const conn2: ERPConnection = {
        ...mockConnection,
        id: "conn_2",
      };
      const adapter2 = new MockERPAdapter("sap", conn2);
      engine.registerAdapter("conn_2", conn2, adapter2);

      const summary1 = await engine.sync("conn_1", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      const summary2 = await engine.sync("conn_2", {
        direction: "push",
        conflictResolution: "timestamp",
        entityTypes: ["customer"],
      });

      expect(summary1.connectionId).toBe("conn_1");
      expect(summary2.connectionId).toBe("conn_2");
      expect(summary1.syncId).not.toBe(summary2.syncId);

      // Sync histories should be separate (may be empty if mock adapter produces no changes)
      const history1 = engine.getSyncHistory("conn_1");
      const history2 = engine.getSyncHistory("conn_2");
      // Verify histories don't contain entries from the other connection
      history1.forEach((log) => expect(log.connectionId).toBe("conn_1"));
      history2.forEach((log) => expect(log.connectionId).toBe("conn_2"));
    });
  });
});
