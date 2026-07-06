/**
 * Compliance Audit Logger
 * Immutable audit trail for compliance and security monitoring
 * Tracks all data access, exports, modifications, and consent changes
 */

import { AuditEntry } from "./types";

/**
 * Compliance Audit Logger
 * Creates immutable audit trail for GDPR compliance
 */
export class ComplianceAuditLogger {
  private auditLog: AuditEntry[] = [];
  private readonly maxLogSize = 1000000; // Max entries before rotation

  /**
   * Log access to PII/sensitive data
   * Records when and who accessed what data
   *
   * @param actor - User/system that performed the action
   * @param resourceType - Type of resource accessed
   * @param resourceId - ID of the resource
   * @param fields - Optional specific fields accessed
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logAccess(
    actor: string,
    resourceType: string,
    resourceId: string,
    fields?: string[],
    metadata?: { ipAddress?: string; userAgent?: string },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("access"),
      action: "access",
      actor,
      timestamp: new Date(),
      details: {
        resourceType,
        resourceId,
        fields,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      status: "success",
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Log data export
   * Records when data is exported for a data subject
   *
   * @param actor - Who requested/performed the export
   * @param dataSubjectId - The user whose data is being exported
   * @param fields - Fields included in export
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logExport(
    actor: string,
    dataSubjectId: string,
    fields: string[],
    metadata?: { ipAddress?: string; userAgent?: string; exportId?: string },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("export"),
      action: "export",
      actor,
      timestamp: new Date(),
      details: {
        resourceType: "user_data",
        resourceId: dataSubjectId,
        fields,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      status: "success",
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Log deletion request
   * Records when data is deleted per data subject request
   *
   * @param actor - Who requested/performed the deletion
   * @param dataSubjectId - The user whose data is being deleted
   * @param scope - Scope of deletion ('all', 'account', or specific entity types)
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logDeletion(
    actor: string,
    dataSubjectId: string,
    scope: string,
    metadata?: { ipAddress?: string; userAgent?: string; reason?: string },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("deletion"),
      action: "deletion",
      actor,
      timestamp: new Date(),
      details: {
        resourceType: "user_account",
        resourceId: dataSubjectId,
        scope: [scope],
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      status: "success",
      reason: metadata?.reason,
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Log modification/rectification of data
   * Records when data is modified per user request
   *
   * @param actor - Who performed the modification
   * @param dataSubjectId - The user whose data is modified
   * @param fields - Fields that were modified
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logModification(
    actor: string,
    dataSubjectId: string,
    fields: string[],
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      oldValues?: Record<string, unknown>;
    },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("modification"),
      action: "modification",
      actor,
      timestamp: new Date(),
      details: {
        resourceType: "user_data",
        resourceId: dataSubjectId,
        fields,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      status: "success",
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Log consent change
   * Records when user grants, revokes, or modifies consent
   *
   * @param dataSubjectId - User ID
   * @param purpose - Consent purpose
   * @param newStatus - New consent status (granted/revoked)
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logConsentChange(
    dataSubjectId: string,
    purpose: string,
    newStatus: "granted" | "revoked",
    metadata?: { ipAddress?: string; userAgent?: string; source?: string },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("consent_change"),
      action: "consent_change",
      actor: dataSubjectId,
      timestamp: new Date(),
      details: {
        resourceType: "consent",
        resourceId: `${dataSubjectId}_${purpose}`,
        scope: [purpose],
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      status: "success",
      reason: `Consent ${newStatus} for ${purpose}`,
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Log anonymization operation
   * Records when data is anonymized
   *
   * @param actor - Who performed anonymization
   * @param entityType - Type of entity anonymized
   * @param recordCount - Number of records anonymized
   * @param metadata - Additional context
   * @returns Created AuditEntry
   */
  logAnonymization(
    actor: string,
    entityType: string,
    recordCount: number,
    metadata?: { ipAddress?: string; strategy?: string },
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId("anonymization"),
      action: "anonymization",
      actor,
      timestamp: new Date(),
      details: {
        resourceType: entityType,
        resourceId: `batch_${Date.now()}`,
        scope: [`${recordCount} records`],
      },
      ipAddress: metadata?.ipAddress,
      status: "success",
      reason: `Anonymized ${recordCount} ${entityType} records using ${metadata?.strategy || "unknown"} strategy`,
    };

    this.auditLog.push(entry);
    this.rotateIfNeeded();
    return entry;
  }

  /**
   * Get audit entries for a specific date range
   *
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param filters - Optional filters (actor, action, resourceType)
   * @returns Filtered audit entries
   */
  getAuditEntries(
    startDate: Date,
    endDate: Date,
    filters?: {
      actor?: string;
      action?: AuditEntry["action"];
      resourceType?: string;
    },
  ): AuditEntry[] {
    return this.auditLog.filter((entry) => {
      const timeMatch =
        entry.timestamp >= startDate && entry.timestamp <= endDate;
      const actorMatch = !filters?.actor || entry.actor === filters.actor;
      const actionMatch = !filters?.action || entry.action === filters.action;
      const resourceMatch =
        !filters?.resourceType ||
        entry.details.resourceType === filters.resourceType;

      return timeMatch && actorMatch && actionMatch && resourceMatch;
    });
  }

  /**
   * Generate compliance audit report
   *
   * @param dateRange - Date range for the report
   * @returns Audit report with statistics and entries
   */
  generateAuditReport(dateRange: { start: Date; end: Date }): {
    period: { start: Date; end: Date };
    totalEntries: number;
    entriesByAction: Record<string, number>;
    entriesByActor: Record<string, number>;
    accessLog: AuditEntry[];
    deletionLog: AuditEntry[];
    consentLog: AuditEntry[];
    exportLog: AuditEntry[];
  } {
    const entries = this.getAuditEntries(dateRange.start, dateRange.end);

    const report = {
      period: dateRange,
      totalEntries: entries.length,
      entriesByAction: {} as Record<string, number>,
      entriesByActor: {} as Record<string, number>,
      accessLog: [] as AuditEntry[],
      deletionLog: [] as AuditEntry[],
      consentLog: [] as AuditEntry[],
      exportLog: [] as AuditEntry[],
    };

    for (const entry of entries) {
      // Count by action
      report.entriesByAction[entry.action] =
        (report.entriesByAction[entry.action] || 0) + 1;

      // Count by actor
      report.entriesByActor[entry.actor] =
        (report.entriesByActor[entry.actor] || 0) + 1;

      // Categorize entries
      if (entry.action === "access") {
        report.accessLog.push(entry);
      } else if (entry.action === "deletion") {
        report.deletionLog.push(entry);
      } else if (entry.action === "consent_change") {
        report.consentLog.push(entry);
      } else if (entry.action === "export") {
        report.exportLog.push(entry);
      }
    }

    return report;
  }

  /**
   * Get all audit entries
   * @returns Complete audit log
   */
  getAllEntries(): AuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get audit entries for a specific data subject
   * @param dataSubjectId - User ID
   * @returns All audit entries related to this user
   */
  getDataSubjectAuditTrail(dataSubjectId: string): AuditEntry[] {
    return this.auditLog.filter(
      (entry) =>
        entry.details.resourceId === dataSubjectId ||
        entry.actor === dataSubjectId ||
        entry.details.scope?.includes(dataSubjectId),
    );
  }

  /**
   * Generate ID for audit entry
   * @private
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Rotate audit log if size exceeds limit
   * @private
   */
  private rotateIfNeeded(): void {
    if (this.auditLog.length > this.maxLogSize) {
      // Keep only last 80% of entries
      const keepCount = Math.floor(this.maxLogSize * 0.8);
      this.auditLog = this.auditLog.slice(-keepCount);
    }
  }

  /**
   * Clear audit log (for testing only)
   * @internal
   */
  clearLog(): void {
    this.auditLog = [];
  }
}
