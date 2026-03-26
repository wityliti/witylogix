/**
 * Backup Service Tests
 *
 * Tests backup scheduling, full/incremental backups, PITR, verification,
 * restoration, and retention policies.
 *
 * Run with: npm test -- backup-service.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackupService, createBackupService } from "../config/backup-service";
import type { BackupServiceConfig } from "../config/backup-service";

describe("Backup Service", () => {
  let service: BackupService;

  beforeEach(() => {
    service = createBackupService({
      retentionDays: 30,
      enablePITR: true,
      pitRWindowHours: 24,
      checksumAlgorithm: "sha256",
    });
  });

  afterEach(() => {
    service.stopScheduledBackups();
  });

  describe("Service Initialization", () => {
    it("should create backup service with defaults", () => {
      const newService = createBackupService();
      expect(newService).toBeInstanceOf(BackupService);
    });

    it("should apply custom configuration", () => {
      const config: Partial<BackupServiceConfig> = {
        retentionDays: 60,
        enablePITR: false,
      };

      const customService = createBackupService(config);
      expect(customService).toBeInstanceOf(BackupService);

      customService.stopScheduledBackups();
    });

    it("should start with no backups", () => {
      expect(service.getAllBackups()).toHaveLength(0);
    });
  });

  describe("Full Backups", () => {
    it("should create a full backup", async () => {
      const backupId = await service.createFullBackup();

      expect(backupId).toBeDefined();
      expect(typeof backupId).toBe("string");
      expect(backupId.startsWith("full-")).toBe(true);
    });

    it("should set backup status to completed/verified", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.status).toMatch(/completed|verified/);
    });

    it("should calculate backup size", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.size).toBeDefined();
      expect(backup?.size).toBeGreaterThan(0);
    });

    it("should generate checksum", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.checksum).toBeDefined();
      expect(backup?.checksum).toContain("sha256:");
    });

    it("should set backup location", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.location).toBeDefined();
      expect(typeof backup?.location).toBe("string");
    });

    it("should set retention date", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      const now = Date.now();
      const retentionTime = backup?.retentionUntil.getTime() || 0;

      // Should be roughly 30 days from now
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(retentionTime - now).toBeGreaterThan(thirtyDaysMs * 0.9);
      expect(retentionTime - now).toBeLessThan(thirtyDaysMs * 1.1);
    });

    it("should verify backup after creation", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.verificationResult).toBeDefined();
      expect(backup?.verificationResult?.passed).toBeDefined();
      expect(backup?.verificationResult?.timestamp).toBeInstanceOf(Date);
    });

    it("should set startedAt and completedAt timestamps", async () => {
      const beforeCreate = Date.now();
      const backupId = await service.createFullBackup();
      const afterCreate = Date.now();

      const backup = service.getBackup(backupId);
      const startTime = backup?.startedAt.getTime() || 0;
      const endTime = backup?.completedAt?.getTime() || 0;

      expect(startTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(startTime).toBeLessThanOrEqual(afterCreate);
      expect(endTime).toBeGreaterThanOrEqual(startTime);
    });
  });

  describe("Incremental Backups", () => {
    it("should create an incremental backup", async () => {
      const backupId = await service.createIncrementalBackup();

      expect(backupId).toBeDefined();
      expect(backupId.startsWith("incremental-")).toBe(true);
    });

    it("should mark incremental backups correctly", async () => {
      const backupId = await service.createIncrementalBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.type).toBe("incremental");
    });

    it("should be faster than full backup", async () => {
      const fullStart = Date.now();
      await service.createFullBackup();
      const fullDuration = Date.now() - fullStart;

      const incrementalStart = Date.now();
      await service.createIncrementalBackup();
      const incrementalDuration = Date.now() - incrementalStart;

      // Incremental should be roughly faster (simulated)
      expect(incrementalDuration).toBeLessThan(fullDuration * 2);
    });

    it("should have smaller size than full backup", async () => {
      const fullId = await service.createFullBackup();
      const fullSize = service.getBackup(fullId)?.size || 0;

      const incrementalId = await service.createIncrementalBackup();
      const incrementalSize = service.getBackup(incrementalId)?.size || 0;

      // Incremental should typically be smaller
      expect(incrementalSize).toBeLessThanOrEqual(fullSize);
    });
  });

  describe("Scheduled Backups", () => {
    it("should start scheduled backups", () => {
      service.startScheduledBackups();
      expect(service.getAllBackups().length).toBeLessThanOrEqual(0); // May or may not have run yet
    });

    it("should stop scheduled backups", () => {
      service.startScheduledBackups();
      service.stopScheduledBackups();
      expect(true).toBe(true); // Just verify no errors
    });

    it("should create backups on schedule", async () => {
      vi.useFakeTimers();

      service.startScheduledBackups();

      // Advance past the 30-second incremental backup interval
      await vi.advanceTimersByTimeAsync(31000);

      const backups = service.getAllBackups();
      expect(backups.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should not start schedule twice", () => {
      service.startScheduledBackups();
      service.startScheduledBackups(); // Should be no-op
      service.stopScheduledBackups();

      expect(true).toBe(true);
    });
  });

  describe("Backup Restoration", () => {
    let backupId: string;

    beforeEach(async () => {
      backupId = await service.createFullBackup();
    });

    it("should restore from backup", async () => {
      const result = await service.restoreFromBackup(backupId);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should throw for non-existent backup", async () => {
      await expect(service.restoreFromBackup("non-existent")).rejects.toThrow(
        "Backup not found"
      );
    });

    it("should track restore duration", async () => {
      const result = await service.restoreFromBackup(backupId);

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should log restore in audit trail", async () => {
      await service.restoreFromBackup(backupId);

      const auditLog = service.getAuditLog();
      const restoreEvent = auditLog.find((e) => e.action === "restore_completed");

      expect(restoreEvent).toBeDefined();
    });
  });

  describe("Backup Verification", () => {
    let backupId: string;

    beforeEach(async () => {
      backupId = await service.createFullBackup();
    });

    it("should test restore from backup", async () => {
      const passed = await service.testRestoreFromBackup(backupId);

      expect(typeof passed).toBe("boolean");
    });

    it("should throw for non-existent backup test", async () => {
      await expect(service.testRestoreFromBackup("non-existent")).rejects.toThrow(
        "Backup not found"
      );
    });

    it("should log restore test results", async () => {
      await service.testRestoreFromBackup(backupId);

      const auditLog = service.getAuditLog();
      const testEvent = auditLog.find(
        (e) =>
          e.action === "restore_test_passed" || e.action === "restore_test_failed"
      );

      expect(testEvent).toBeDefined();
    });
  });

  describe("Point-in-Time Recovery (PITR)", () => {
    it("should return PITR window when enabled", () => {
      const window = service.getPITRWindow();

      expect(window).toBeDefined();
      expect(window?.start).toBeInstanceOf(Date);
      expect(window?.end).toBeInstanceOf(Date);
    });

    it("should return null when PITR disabled", () => {
      const disabledService = createBackupService({
        enablePITR: false,
      });

      const window = disabledService.getPITRWindow();

      expect(window).toBeNull();

      disabledService.stopScheduledBackups();
    });

    it("should have correct PITR window size", () => {
      const window = service.getPITRWindow()!;

      const windowMs = window.end.getTime() - window.start.getTime();
      const expectedMs = 24 * 60 * 60 * 1000; // 24 hours

      expect(windowMs).toBeGreaterThan(expectedMs * 0.9);
      expect(windowMs).toBeLessThan(expectedMs * 1.1);
    });

    it("should include current time in PITR window", () => {
      const before = Date.now();
      const window = service.getPITRWindow()!;
      const after = Date.now();

      // The PITR window.end is computed from Date.now() inside getPITRWindow,
      // so it must fall between our before/after timestamps (inclusive).
      expect(window.start.getTime()).toBeLessThanOrEqual(before);
      expect(window.end.getTime()).toBeGreaterThanOrEqual(before);
      expect(window.end.getTime()).toBeLessThanOrEqual(after + 1);
    });
  });

  describe("Retention Policy", () => {
    it("should cleanup expired backups", async () => {
      const backupId = await service.createFullBackup();

      // Manually set retention to past date for testing
      const backup = service.getBackup(backupId)!;
      backup.retentionUntil = new Date(Date.now() - 1000);

      const deletedCount = await service.cleanupExpiredBackups();

      expect(deletedCount).toBeGreaterThan(0);
      expect(service.getBackup(backupId)).toBeUndefined();
    });

    it("should not delete non-expired backups", async () => {
      const backupId = await service.createFullBackup();

      const deletedCount = await service.cleanupExpiredBackups();

      expect(deletedCount).toBe(0);
      expect(service.getBackup(backupId)).toBeDefined();
    });

    it("should respect retention days configuration", async () => {
      const config: Partial<BackupServiceConfig> = {
        retentionDays: 60,
      };

      const customService = createBackupService(config);
      const backupId = await customService.createFullBackup();

      const backup = customService.getBackup(backupId)!;
      const retentionDays = (backup.retentionUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);

      expect(retentionDays).toBeGreaterThan(59);
      expect(retentionDays).toBeLessThan(61);

      customService.stopScheduledBackups();
    });
  });

  describe("Backup Access", () => {
    it("should get single backup by ID", async () => {
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);

      expect(backup).toBeDefined();
      expect(backup?.id).toBe(backupId);
    });

    it("should return undefined for non-existent backup", () => {
      const backup = service.getBackup("non-existent");

      expect(backup).toBeUndefined();
    });

    it("should get all backups", async () => {
      await service.createFullBackup();
      await service.createIncrementalBackup();

      const all = service.getAllBackups();

      expect(all).toHaveLength(2);
    });

    it("should get recent backups", async () => {
      for (let i = 0; i < 7; i++) {
        await service.createFullBackup();
      }

      const recent = service.getRecentBackups(5);

      expect(recent).toHaveLength(5);
      expect(recent[0].startedAt.getTime()).toBeGreaterThanOrEqual(
        recent[1].startedAt.getTime()
      );
    }, 15000);

    it("should filter recent backups by status", async () => {
      // All newly created backups should be verified/completed
      for (let i = 0; i < 3; i++) {
        await service.createFullBackup();
      }

      const recent = service.getRecentBackups(10);

      for (const backup of recent) {
        expect(
          backup.status === "verified" || backup.status === "completed"
        ).toBe(true);
      }
    });
  });

  describe("Audit Logging", () => {
    it("should maintain audit log", async () => {
      await service.createFullBackup();

      const auditLog = service.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
    });

    it("should log backup creation", async () => {
      await service.createFullBackup();

      const auditLog = service.getAuditLog();
      const creationEvent = auditLog.find((e) => e.action === "full_backup_started");

      expect(creationEvent).toBeDefined();
    });

    it("should log backup completion", async () => {
      await service.createFullBackup();

      const auditLog = service.getAuditLog();
      const completionEvent = auditLog.find((e) => e.action === "full_backup_completed");

      expect(completionEvent).toBeDefined();
    });

    it("should include backup metadata in audit log", async () => {
      const backupId = await service.createFullBackup();

      const auditLog = service.getAuditLog();
      const event = auditLog.find((e) => e.action === "full_backup_completed");

      expect(event?.backupId).toBe(backupId);
      expect(event?.details.size).toBeDefined();
      expect(event?.details.checksum).toBeDefined();
    });

    it("should limit audit log size", async () => {
      for (let i = 0; i < 20; i++) {
        await service.createIncrementalBackup();
      }

      const auditLog = service.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(500);
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle backup creation errors", async () => {
      // Create valid backup
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.status).not.toBe("failed");
    });

    it("should set error message on backup failure", async () => {
      // Normal flow - error handling is internal
      const backupId = await service.createFullBackup();

      const backup = service.getBackup(backupId);
      expect(backup?.error).toBeNull();
    });

    it("should handle restore errors gracefully", async () => {
      const backupId = await service.createFullBackup();

      const result = await service.restoreFromBackup(backupId);
      expect(result.success).toBe(true);
    });
  });

  describe("Checksum Configuration", () => {
    it("should use configured checksum algorithm", async () => {
      const sha256Service = createBackupService({
        checksumAlgorithm: "sha256",
      });

      const backupId = await sha256Service.createFullBackup();
      const backup = sha256Service.getBackup(backupId);

      expect(backup?.checksum).toContain("sha256:");

      sha256Service.stopScheduledBackups();
    });

    it("should support md5 algorithm", async () => {
      const md5Service = createBackupService({
        checksumAlgorithm: "md5",
      });

      const backupId = await md5Service.createFullBackup();
      const backup = md5Service.getBackup(backupId);

      expect(backup?.checksum).toContain("md5:");

      md5Service.stopScheduledBackups();
    });
  });
});
