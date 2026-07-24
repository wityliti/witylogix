/**
 * Audit Logger Tests — Immutable security audit trail.
 *
 * Tests cover:
 * - Audit event logging
 * - Hash chain integrity verification
 * - Query and filtering
 * - Convenience methods (login, logout, etc.)
 * - Export functionality
 *
 * Run with: npm test -- audit-logger.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogger, AuditEventType } from "../audit-logger";

describe("AuditLogger", () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
  });

  describe("Event Logging", () => {
    it("should log audit event", async () => {
      const entry = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );

      expect(entry.id).toBeDefined();
      expect(entry.eventType).toBe(AuditEventType.LOGIN);
      expect(entry.timestamp).toBeDefined();
      expect(entry.hash).toBeDefined();
    });

    it("should track sequential entry count", async () => {
      await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );
      await auditLogger.log(
        AuditEventType.DATA_ACCESS,
        { userId: "user-123", ip: "192.168.1.1" },
        "drivers",
        "read",
      );

      expect(auditLogger.count()).toBe(2);
    });

    it("should set outcome to SUCCESS by default", async () => {
      const entry = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );

      expect(entry.outcome).toBe("SUCCESS");
    });

    it("should set outcome to FAILURE when specified", async () => {
      const entry = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
        { outcome: "FAILURE" },
      );

      expect(entry.outcome).toBe("FAILURE");
    });
  });

  describe("Hash Chain", () => {
    it("should link entries with previousHash", async () => {
      const entry1 = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );
      const entry2 = await auditLogger.log(
        AuditEventType.DATA_ACCESS,
        { userId: "user-123", ip: "192.168.1.1" },
        "drivers",
        "read",
      );

      expect(entry2.previousHash).toBe(entry1.hash);
    });

    it("should generate unique hash for each entry", async () => {
      const entry1 = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );
      const entry2 = await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-456", ip: "192.168.1.2" },
        "user:user-456",
        "login",
      );

      expect(entry1.hash).not.toBe(entry2.hash);
    });

    it("should verify chain integrity", async () => {
      await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
      );
      await auditLogger.log(
        AuditEventType.DATA_ACCESS,
        { userId: "user-123", ip: "192.168.1.1" },
        "drivers",
        "read",
      );

      const isIntact = auditLogger.verifyChainIntegrity();
      expect(isIntact).toBe(true);
    });
  });

  describe("Convenience Methods", () => {
    it("should log login event", async () => {
      const entry = await auditLogger.logLogin(
        "user-123",
        "192.168.1.1",
        "session-456",
      );

      expect(entry.eventType).toBe(AuditEventType.LOGIN);
      expect(entry.actor.userId).toBe("user-123");
      expect(entry.actor.sessionId).toBe("session-456");
    });

    it("should log logout event", async () => {
      const entry = await auditLogger.logLogout("user-123", "192.168.1.1");

      expect(entry.eventType).toBe(AuditEventType.LOGOUT);
      expect(entry.action).toBe("logout");
    });

    it("should log permission change", async () => {
      const before = { role: "MEMBER" };
      const after = { role: "ADMIN" };

      const entry = await auditLogger.logPermissionChange(
        "user-123",
        "user-456",
        { userId: "user-123", ip: "192.168.1.1" },
        before,
        after,
      );

      expect(entry.eventType).toBe(AuditEventType.PERMISSION_CHANGE);
      expect(entry.stateChange?.before).toEqual(before);
      expect(entry.stateChange?.after).toEqual(after);
    });

    it("should log data access", async () => {
      const entry = await auditLogger.logDataAccess(
        { userId: "user-123", ip: "192.168.1.1" },
        "drivers",
        { status: "active" },
      );

      expect(entry.eventType).toBe(AuditEventType.DATA_ACCESS);
      expect(entry.action).toBe("read");
    });

    it("should log data modification", async () => {
      const before = { name: "John" };
      const after = { name: "Jane" };

      const entry = await auditLogger.logDataModify(
        { userId: "user-123", ip: "192.168.1.1" },
        "users:user-456",
        "update",
        before,
        after,
      );

      expect(entry.eventType).toBe(AuditEventType.DATA_MODIFY);
      expect(entry.stateChange?.before).toEqual(before);
    });
  });

  describe("Querying", () => {
    it("should query by event type", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1");
      await auditLogger.logLogout("user-123", "192.168.1.1");

      const result = await auditLogger.query({
        eventType: AuditEventType.LOGIN,
      });

      expect(result.total).toBe(1);
      expect(result.entries[0].eventType).toBe(AuditEventType.LOGIN);
    });

    it("should query by user ID", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1");
      await auditLogger.logLogin("user-456", "192.168.1.2");

      const result = await auditLogger.query({ userId: "user-123" });

      expect(result.total).toBe(1);
      expect(result.entries[0].actor.userId).toBe("user-123");
    });

    it("should query by outcome", async () => {
      await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-123", ip: "192.168.1.1" },
        "user:user-123",
        "login",
        { outcome: "SUCCESS" },
      );
      await auditLogger.log(
        AuditEventType.LOGIN,
        { userId: "user-456", ip: "192.168.1.2" },
        "user:user-456",
        "login",
        { outcome: "FAILURE" },
      );

      const result = await auditLogger.query({ outcome: "FAILURE" });

      expect(result.total).toBe(1);
      expect(result.entries[0].outcome).toBe("FAILURE");
    });

    it("should paginate results", async () => {
      for (let i = 0; i < 10; i++) {
        await auditLogger.logLogin(`user-${i}`, "192.168.1.1");
      }

      const page1 = await auditLogger.query({ limit: 5 });
      const page2 = await auditLogger.query({
        limit: 5,
        offset: page1.nextOffset,
      });

      expect(page1.entries.length).toBe(5);
      expect(page2.entries.length).toBe(5);
      expect(page1.entries[0].id).not.toBe(page2.entries[0].id);
    });

    it("should apply multiple filters", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1");
      await auditLogger.logLogin("user-456", "192.168.1.2");
      await auditLogger.logLogout("user-123", "192.168.1.1");

      const result = await auditLogger.query({
        eventType: AuditEventType.LOGIN,
        userId: "user-123",
      });

      expect(result.total).toBe(1);
      expect(result.entries[0].eventType).toBe(AuditEventType.LOGIN);
      expect(result.entries[0].actor.userId).toBe("user-123");
    });
  });

  describe("Entry Retrieval", () => {
    it("should get entry by ID", async () => {
      const logged = await auditLogger.logLogin("user-123", "192.168.1.1");
      const retrieved = auditLogger.getEntry(logged.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(logged.id);
      expect(retrieved?.eventType).toBe(AuditEventType.LOGIN);
    });

    it("should return undefined for unknown entry", () => {
      const retrieved = auditLogger.getEntry("unknown-id");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("Recent Entries", () => {
    it("should get recent entries", async () => {
      for (let i = 0; i < 10; i++) {
        await auditLogger.logLogin(`user-${i}`, "192.168.1.1");
      }

      const recent = auditLogger.getRecent(5);

      expect(recent.length).toBe(5);
      // Most recent should be first
      expect(recent[0].id).not.toBe(recent[4].id);
    });

    it("should get recent entries in reverse order", async () => {
      const entry1 = await auditLogger.logLogin("user-1", "192.168.1.1");
      const entry2 = await auditLogger.logLogin("user-2", "192.168.1.1");

      const recent = auditLogger.getRecent(2);

      // entry2 is most recent, should be first in results
      expect(recent[0].id).toBe(entry2.id);
      expect(recent[1].id).toBe(entry1.id);
    });
  });

  describe("Export", () => {
    it("should export audit log", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1");

      const exported = auditLogger.export();

      expect(exported.exportedAt).toBeDefined();
      expect(exported.totalEntries).toBe(1);
      expect(exported.chainIntact).toBe(true);
      expect(exported.entries.length).toBe(1);
    });

    it("should verify chain during export", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1");
      await auditLogger.logLogout("user-123", "192.168.1.1");

      const exported = auditLogger.export();

      expect(exported.chainIntact).toBe(true);
    });
  });

  describe("Count", () => {
    it("should return total count", async () => {
      expect(auditLogger.count()).toBe(0);

      await auditLogger.logLogin("user-123", "192.168.1.1");
      expect(auditLogger.count()).toBe(1);

      await auditLogger.logLogout("user-123", "192.168.1.1");
      expect(auditLogger.count()).toBe(2);
    });
  });

  describe("Immutability", () => {
    it("should freeze logged entries", async () => {
      const entry = await auditLogger.logLogin("user-123", "192.168.1.1");

      expect(() => {
        (entry as any).outcome = "MODIFIED";
      }).toThrow();
    });
  });

  describe("Organization Tracking", () => {
    it("should track organization in logs", async () => {
      const entry = await auditLogger.logLogin(
        "user-123",
        "192.168.1.1",
        undefined,
        { orgId: "org-456" },
      );

      expect(entry.orgId).toBe("org-456");
    });

    it("should filter by organization", async () => {
      await auditLogger.logLogin("user-123", "192.168.1.1", undefined, {
        orgId: "org-1",
      });
      await auditLogger.logLogin("user-456", "192.168.1.2", undefined, {
        orgId: "org-2",
      });

      const result = await auditLogger.query({ orgId: "org-1" });

      expect(result.total).toBe(1);
      expect(result.entries[0].orgId).toBe("org-1");
    });
  });
});
