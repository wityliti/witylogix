/**
 * Retention Manager
 * Manages data retention policies and schedules anonymization/deletion
 * Implements GDPR principle of storage limitation
 */

import { RetentionPolicy } from "./types";

/**
 * Retention record for tracking deletion/anonymization status
 */
interface RetentionRecord {
  recordId: string;
  entityType: string;
  createdAt: Date;
  expiresAt: Date;
  anonymizeAt?: Date;
  deleteAt: Date;
  status:
    | "active"
    | "anonymize_scheduled"
    | "delete_scheduled"
    | "deleted"
    | "exempt";
  exemptionReason?: string;
}

/**
 * Retention Manager
 * Manages data retention policies and schedules for compliance
 */
export class RetentionManager {
  private policies = new Map<string, RetentionPolicy>();
  private retentionRecords = new Map<string, RetentionRecord>();
  private exemptions = new Map<string, string>();

  /**
   * Set retention policy for an entity type
   *
   * @param entityType - Type of entity (e.g., 'order', 'payment', 'log')
   * @param retentionDays - Number of days to retain
   * @param anonymizeAfterDays - Optional days before anonymization
   * @param deleteAfterDays - Days before permanent deletion
   */
  setRetentionPolicy(
    entityType: string,
    retentionDays: number,
    anonymizeAfterDays?: number,
    deleteAfterDays?: number,
  ): RetentionPolicy {
    if (retentionDays < 0) {
      throw new Error("retentionDays must be non-negative");
    }

    const policy: RetentionPolicy = {
      entityType,
      retentionDays,
      anonymizeAfterDays,
      deleteAfterDays: deleteAfterDays || retentionDays,
      exceptions: [],
    };

    this.policies.set(entityType, policy);
    return policy;
  }

  /**
   * Apply retention policy to a record
   * Checks if record should be anonymized or deleted based on creation date
   *
   * @param recordId - ID of the record
   * @param entityType - Type of entity
   * @param createdAt - When the record was created
   * @returns Status object indicating action needed
   */
  applyRetentionPolicy(
    recordId: string,
    entityType: string,
    createdAt: Date,
  ): {
    action: "none" | "anonymize" | "delete";
    daysUntilAction: number;
  } {
    // Check if exempt from retention
    if (this.exemptions.has(recordId)) {
      return { action: "none", daysUntilAction: -1 };
    }

    const policy = this.policies.get(entityType);
    if (!policy) {
      return { action: "none", daysUntilAction: -1 };
    }

    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    // Check delete threshold
    if (ageDays >= policy.deleteAfterDays) {
      this.updateRetentionRecord(recordId, entityType, "delete_scheduled");
      return { action: "delete", daysUntilAction: 0 };
    }

    // Check anonymize threshold
    if (policy.anonymizeAfterDays && ageDays >= policy.anonymizeAfterDays) {
      this.updateRetentionRecord(recordId, entityType, "anonymize_scheduled");
      return {
        action: "anonymize",
        daysUntilAction: 0,
      };
    }

    // Return days until next action
    const nextActionDays = policy.anonymizeAfterDays
      ? Math.max(0, policy.anonymizeAfterDays - ageDays)
      : Math.max(0, policy.deleteAfterDays - ageDays);

    return {
      action: "none",
      daysUntilAction: nextActionDays,
    };
  }

  /**
   * Schedule anonymization for a record after retention period
   *
   * @param recordId - ID of record to anonymize
   * @param entityType - Type of entity
   * @param retentionDays - Days until anonymization
   * @returns Scheduled anonymization details
   */
  scheduleAnonymization(
    recordId: string,
    entityType: string,
    retentionDays: number,
  ): {
    recordId: string;
    scheduledAt: Date;
    anonymizeAt: Date;
  } {
    const now = new Date();
    const anonymizeAt = new Date(
      now.getTime() + retentionDays * 24 * 60 * 60 * 1000,
    );

    const record = this.getOrCreateRetentionRecord(
      recordId,
      entityType,
      now,
      anonymizeAt,
    );
    record.status = "anonymize_scheduled";
    record.anonymizeAt = anonymizeAt;

    this.retentionRecords.set(recordId, record);

    return {
      recordId,
      scheduledAt: now,
      anonymizeAt,
    };
  }

  /**
   * Schedule deletion for a record after retention period
   *
   * @param recordId - ID of record to delete
   * @param entityType - Type of entity
   * @param retentionDays - Days until deletion
   * @returns Scheduled deletion details
   */
  scheduleForDeletion(
    recordId: string,
    entityType: string,
    retentionDays: number,
  ): {
    recordId: string;
    scheduledAt: Date;
    deleteAt: Date;
  } {
    const now = new Date();
    const deleteAt = new Date(
      now.getTime() + retentionDays * 24 * 60 * 60 * 1000,
    );

    const record = this.getOrCreateRetentionRecord(
      recordId,
      entityType,
      now,
      undefined,
    );
    record.status = "delete_scheduled";
    record.deleteAt = deleteAt;

    this.retentionRecords.set(recordId, record);

    return {
      recordId,
      scheduledAt: now,
      deleteAt,
    };
  }

  /**
   * Get retention report showing status of all records
   *
   * @returns Report with statistics on retention status
   */
  getRetentionReport(): {
    active: number;
    anonymizeScheduled: number;
    deleteScheduled: number;
    deleted: number;
    exempt: number;
    byEntityType: Record<
      string,
      { active: number; scheduled: number; deleted: number }
    >;
  } {
    const report = {
      active: 0,
      anonymizeScheduled: 0,
      deleteScheduled: 0,
      deleted: 0,
      exempt: 0,
      byEntityType: {} as Record<
        string,
        { active: number; scheduled: number; deleted: number }
      >,
    };

    for (const record of this.retentionRecords.values()) {
      switch (record.status) {
        case "active":
          report.active++;
          break;
        case "anonymize_scheduled":
          report.anonymizeScheduled++;
          break;
        case "delete_scheduled":
          report.deleteScheduled++;
          break;
        case "deleted":
          report.deleted++;
          break;
        case "exempt":
          report.exempt++;
          break;
      }

      if (!report.byEntityType[record.entityType]) {
        report.byEntityType[record.entityType] = {
          active: 0,
          scheduled: 0,
          deleted: 0,
        };
      }

      if (record.status === "active") {
        report.byEntityType[record.entityType].active++;
      } else if (
        record.status === "anonymize_scheduled" ||
        record.status === "delete_scheduled"
      ) {
        report.byEntityType[record.entityType].scheduled++;
      } else if (record.status === "deleted") {
        report.byEntityType[record.entityType].deleted++;
      }
    }

    return report;
  }

  /**
   * Exempt a record from retention/deletion
   * Used for legal holds or other compliance reasons
   *
   * @param recordId - Record to exempt
   * @param reason - Reason for exemption
   */
  exemptFromRetention(recordId: string, reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Exemption reason is required");
    }

    this.exemptions.set(recordId, reason);

    const record = this.retentionRecords.get(recordId);
    if (record) {
      record.status = "exempt";
      record.exemptionReason = reason;
    }
  }

  /**
   * Remove exemption for a record
   *
   * @param recordId - Record to remove exemption from
   */
  removeExemption(recordId: string): void {
    this.exemptions.delete(recordId);

    const record = this.retentionRecords.get(recordId);
    if (record && record.status === "exempt") {
      record.status = "active";
      record.exemptionReason = undefined;
    }
  }

  /**
   * Check if record is exempt from retention
   * @param recordId - Record ID to check
   * @returns true if exempt, false otherwise
   */
  isExempt(recordId: string): boolean {
    return this.exemptions.has(recordId);
  }

  /**
   * Get records due for anonymization
   *
   * @returns Array of record IDs scheduled for anonymization
   */
  getRecordsDueForAnonymization(): string[] {
    const now = new Date();
    const dueRecords: string[] = [];

    for (const [recordId, record] of this.retentionRecords.entries()) {
      if (
        record.status === "anonymize_scheduled" &&
        record.anonymizeAt &&
        record.anonymizeAt <= now
      ) {
        dueRecords.push(recordId);
      }
    }

    return dueRecords;
  }

  /**
   * Get records due for deletion
   *
   * @returns Array of record IDs scheduled for deletion
   */
  getRecordsDueForDeletion(): string[] {
    const now = new Date();
    const dueRecords: string[] = [];

    for (const [recordId, record] of this.retentionRecords.entries()) {
      if (record.status === "delete_scheduled" && record.deleteAt <= now) {
        dueRecords.push(recordId);
      }
    }

    return dueRecords;
  }

  /**
   * Mark record as deleted
   * @param recordId - Record ID
   */
  markAsDeleted(recordId: string): void {
    const record = this.retentionRecords.get(recordId);
    if (record) {
      record.status = "deleted";
    }
  }

  /**
   * Update retention record status
   * @private
   */
  private updateRetentionRecord(
    recordId: string,
    entityType: string,
    status: RetentionRecord["status"],
  ): void {
    const record = this.retentionRecords.get(recordId);
    if (record) {
      record.status = status;
    }
  }

  /**
   * Get or create retention record
   * @private
   */
  private getOrCreateRetentionRecord(
    recordId: string,
    entityType: string,
    createdAt: Date,
    anonymizeAt?: Date,
  ): RetentionRecord {
    let record = this.retentionRecords.get(recordId);

    if (!record) {
      const policy = this.policies.get(entityType);
      const deleteAt = new Date(
        createdAt.getTime() +
          (policy?.deleteAfterDays || 365) * 24 * 60 * 60 * 1000,
      );

      record = {
        recordId,
        entityType,
        createdAt,
        expiresAt: deleteAt,
        anonymizeAt,
        deleteAt,
        status: "active",
      };
    }

    return record;
  }
}
