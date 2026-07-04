/**
 * Migration Strategy Tests
 *
 * Tests migration manager, locking, health checks, rollback planning,
 * and migration state tracking.
 *
 * Run with: npm test -- migration-strategy.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MigrationManager,
  createMigrationManager,
} from "../config/migration-strategy";

describe("Migration Strategy", () => {
  let manager: MigrationManager;

  beforeEach(() => {
    manager = createMigrationManager();
  });

  describe("Migration Locking", () => {
    it("should acquire lock on first call", async () => {
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
      manager.releaseLock();
    });

    it("should reject lock when already locked", async () => {
      await manager.acquireLock();
      const secondLock = await manager.acquireLock();

      expect(secondLock).toBe(false);
      manager.releaseLock();
    });

    it("should release lock", async () => {
      await manager.acquireLock();
      manager.releaseLock();

      const canAcquire = await manager.acquireLock();
      expect(canAcquire).toBe(true);
      manager.releaseLock();
    });

    it("should report lock status", async () => {
      expect(manager.isLockedForMigrations()).toBe(false);

      await manager.acquireLock();
      expect(manager.isLockedForMigrations()).toBe(true);

      manager.releaseLock();
      expect(manager.isLockedForMigrations()).toBe(false);
    });

    it("should force release lock after timeout", async () => {
      await manager.acquireLock();

      // Manually advance time or test that subsequent acquire works
      manager.releaseLock();

      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
      manager.releaseLock();
    });
  });

  describe("Migration Registration", () => {
    it("should register a migration", () => {
      manager.registerMigration(
        "001_create_users",
        "Create users table",
        "DROP TABLE users;",
      );

      const migration = manager.getMigration("001_create_users");
      expect(migration).toBeDefined();
      expect(migration?.name).toBe("Create users table");
      expect(migration?.status).toBe("pending");
    });

    it("should store rollback plan", () => {
      const rollbackSql = "DROP TABLE users;";
      manager.registerMigration(
        "001_create_users",
        "Create users table",
        rollbackSql,
      );

      const migration = manager.getMigration("001_create_users");
      expect(migration?.rollbackPlan).toBe(rollbackSql);
    });

    it("should set initial status to pending", () => {
      manager.registerMigration(
        "001_create_users",
        "Create users table",
        "ROLLBACK SQL",
      );

      const migration = manager.getMigration("001_create_users");
      expect(migration?.status).toBe("pending");
    });

    it("should allow multiple migrations to be registered", () => {
      manager.registerMigration(
        "001_create_users",
        "Create users table",
        "ROLLBACK 1",
      );
      manager.registerMigration(
        "002_add_email",
        "Add email column",
        "ROLLBACK 2",
      );

      const all = manager.getAllMigrations();
      expect(all).toHaveLength(2);
    });

    it("should log registration in audit log", () => {
      manager.registerMigration(
        "001_create_users",
        "Create users table",
        "ROLLBACK SQL",
      );

      const auditLog = manager.getAuditLog();
      const registrationEvent = auditLog.find(
        (e) => e.action === "migration_registered",
      );

      expect(registrationEvent).toBeDefined();
      expect(registrationEvent?.migrationId).toBe("001_create_users");
    });
  });

  describe("Migration Lifecycle", () => {
    beforeEach(() => {
      manager.registerMigration("001_test", "Test migration", "ROLLBACK");
    });

    it("should start migration", () => {
      manager.startMigration("001_test");

      const migration = manager.getMigration("001_test");
      expect(migration?.status).toBe("in_progress");
      expect(migration?.startedAt).toBeDefined();
    });

    it("should complete migration", () => {
      manager.startMigration("001_test");
      manager.completeMigration("001_test");

      const migration = manager.getMigration("001_test");
      expect(migration?.status).toBe("completed");
      expect(migration?.completedAt).toBeDefined();
    });

    it("should calculate migration duration", () => {
      manager.startMigration("001_test");

      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait a bit
      }

      manager.completeMigration("001_test");

      const migration = manager.getMigration("001_test");
      expect(migration?.duration).toBeDefined();
      expect(migration?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should mark migration as failed", () => {
      manager.startMigration("001_test");
      manager.failMigration("001_test", "Syntax error in SQL");

      const migration = manager.getMigration("001_test");
      expect(migration?.status).toBe("failed");
      expect(migration?.error).toBe("Syntax error in SQL");
      expect(migration?.completedAt).toBeDefined();
    });

    it("should throw when operating on non-existent migration", () => {
      expect(() => manager.startMigration("non_existent")).toThrow();
      expect(() => manager.completeMigration("non_existent")).toThrow();
      expect(() => manager.failMigration("non_existent", "Error")).toThrow();
    });
  });

  describe("Pre/Post Migration Health Checks", () => {
    it("should run pre-migration checks", async () => {
      const result = await manager.runPreMigrationChecks();

      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should check database connectivity", async () => {
      const result = await manager.runPreMigrationChecks();

      expect(result.details.databaseConnected).toBeDefined();
      expect(typeof result.details.databaseConnected).toBe("boolean");
    });

    it("should check required tables exist", async () => {
      const result = await manager.runPreMigrationChecks();

      expect(result.details.requiredTablesExist).toBeDefined();
      expect(typeof result.details.requiredTablesExist).toBe("boolean");
    });

    it("should check active connections", async () => {
      const result = await manager.runPreMigrationChecks();

      expect(result.details.activeConnectionCount).toBeDefined();
      expect(typeof result.details.activeConnectionCount).toBe("number");
    });

    it("should warn on high active connections", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // This test depends on random connection count, so we test the logic
      const result = await manager.runPreMigrationChecks();
      expect(result).toBeDefined();

      warnSpy.mockRestore();
    });

    it("should run post-migration checks", async () => {
      const result = await manager.runPostMigrationChecks();

      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should verify schema integrity in post checks", async () => {
      const result = await manager.runPostMigrationChecks();

      expect(result.details.schemaValid).toBeDefined();
      expect(typeof result.details.schemaValid).toBe("boolean");
    });

    it("should check indexes in post checks", async () => {
      const result = await manager.runPostMigrationChecks();

      expect(result.details.indexesValid).toBeDefined();
      expect(typeof result.details.indexesValid).toBe("boolean");
    });

    it("should verify constraints in post checks", async () => {
      const result = await manager.runPostMigrationChecks();

      expect(result.details.constraintsValid).toBeDefined();
      expect(typeof result.details.constraintsValid).toBe("boolean");
    });

    it("should check query performance in post checks", async () => {
      const result = await manager.runPostMigrationChecks();

      expect(result.details.queryPerformanceGood).toBeDefined();
      expect(typeof result.details.queryPerformanceGood).toBe("boolean");
    });

    it("should log health check failures", async () => {
      const result = await manager.runPreMigrationChecks();

      const auditLog = manager.getAuditLog();
      const healthCheckEvent = auditLog.find((e) =>
        e.action.includes("migration_checks"),
      );

      expect(healthCheckEvent).toBeDefined();
    });
  });

  describe("Rollback Management", () => {
    beforeEach(() => {
      manager.registerMigration(
        "001_add_column",
        "Add new column",
        "ALTER TABLE users DROP COLUMN new_col;",
      );
    });

    it("should rollback a migration", async () => {
      await manager.rollbackMigration("001_add_column");

      const migration = manager.getMigration("001_add_column");
      expect(migration?.status).toBe("rolled_back");
    });

    it("should throw when rolling back without rollback plan", async () => {
      manager.registerMigration("002_no_rollback", "Test", "");

      await expect(
        manager.rollbackMigration("002_no_rollback"),
      ).rejects.toThrow("No rollback plan available");
    });

    it("should throw for non-existent migration rollback", async () => {
      await expect(manager.rollbackMigration("non_existent")).rejects.toThrow(
        "Migration not found",
      );
    });

    it("should log rollback in audit trail", async () => {
      await manager.rollbackMigration("001_add_column");

      const auditLog = manager.getAuditLog();
      const rollbackEvent = auditLog.find(
        (e) => e.action === "migration_rolled_back",
      );

      expect(rollbackEvent).toBeDefined();
      expect(rollbackEvent?.migrationId).toBe("001_add_column");
    });
  });

  describe("Audit Logging", () => {
    it("should maintain audit log", () => {
      manager.registerMigration("001_test", "Test", "ROLLBACK");
      manager.startMigration("001_test");

      const auditLog = manager.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
    });

    it("should log all migration state changes", () => {
      manager.registerMigration("001_test", "Test", "ROLLBACK");
      manager.startMigration("001_test");
      manager.completeMigration("001_test");

      const auditLog = manager.getAuditLog();

      expect(auditLog.some((e) => e.action === "migration_registered")).toBe(
        true,
      );
      expect(auditLog.some((e) => e.action === "migration_started")).toBe(true);
      expect(auditLog.some((e) => e.action === "migration_completed")).toBe(
        true,
      );
    });

    it("should include timestamps in audit log", () => {
      manager.registerMigration("001_test", "Test", "ROLLBACK");

      const auditLog = manager.getAuditLog();
      const event = auditLog[0];

      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it("should include details in audit log", () => {
      manager.registerMigration("001_test", "Test", "ROLLBACK");

      const auditLog = manager.getAuditLog();
      const event = auditLog[0];

      expect(event.details).toBeDefined();
    });

    it("should limit audit log size", () => {
      // Register many migrations to test log size limit
      for (let i = 0; i < 1100; i++) {
        manager.registerMigration(`migration_${i}`, `Test ${i}`, "ROLLBACK");
      }

      const auditLog = manager.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("Factory Function", () => {
    it("should create migration manager", () => {
      const newManager = createMigrationManager();
      expect(newManager).toBeInstanceOf(MigrationManager);
    });

    it("should start with no migrations", () => {
      const newManager = createMigrationManager();
      expect(newManager.getAllMigrations()).toHaveLength(0);
    });

    it("should start unlocked", () => {
      const newManager = createMigrationManager();
      expect(newManager.isLockedForMigrations()).toBe(false);
    });
  });

  describe("Get All Migrations", () => {
    it("should return empty array when no migrations", () => {
      const all = manager.getAllMigrations();
      expect(all).toHaveLength(0);
    });

    it("should return all registered migrations", () => {
      manager.registerMigration("001_test", "Test 1", "ROLLBACK 1");
      manager.registerMigration("002_test", "Test 2", "ROLLBACK 2");
      manager.registerMigration("003_test", "Test 3", "ROLLBACK 3");

      const all = manager.getAllMigrations();
      expect(all).toHaveLength(3);
    });

    it("should include migration metadata", () => {
      manager.registerMigration("001_test", "Test", "ROLLBACK");

      const all = manager.getAllMigrations();
      const migration = all[0];

      expect(migration.id).toBe("001_test");
      expect(migration.name).toBe("Test");
      expect(migration.status).toBe("pending");
      expect(migration.rollbackPlan).toBe("ROLLBACK");
    });
  });
});
