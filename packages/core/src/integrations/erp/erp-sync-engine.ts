/**
 * ERP Sync Engine
 * Multi-provider sync orchestrator with bidirectional sync, conflict resolution,
 * delta sync, batch processing, and audit logging
 */

import type {
  ERPProvider,
  ERPConnection,
  ERPCustomer,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPPayment,
  SyncDirection,
  ConflictResolution,
  SyncEntityType,
  ERPSyncStatus,
  ERPBatchResult,
} from './types.js';
import { AbstractERPAdapter } from './erp-adapter.js';

// ─── SYNC ENGINE TYPES ────────────────────────────────────────────────────

export interface SyncOptions {
  direction: SyncDirection;
  conflictResolution: ConflictResolution;
  entityTypes: SyncEntityType[];
  batchSize?: number;
  skipErrors?: boolean;
  fullSync?: boolean;
  auditLog?: boolean;
}

export interface SyncAuditLog {
  id: string;
  connectionId: string;
  syncId: string;
  timestamp: Date;
  entityType: SyncEntityType;
  recordId: string;
  direction: SyncDirection;
  action: 'create' | 'update' | 'delete' | 'conflict';
  localData?: Record<string, any>;
  remoteData?: Record<string, any>;
  resolvedData?: Record<string, any>;
  resolutionMethod?: string;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  duration: number; // ms
}

export interface DeltaChangeSet {
  recordId: string;
  entity: SyncEntityType;
  lastSyncAt: Date;
  changeType: 'create' | 'update' | 'delete';
  data: Record<string, any>;
}

export interface ConflictRecord {
  recordId: string;
  entity: SyncEntityType;
  localVersion: Record<string, any>;
  remoteVersion: Record<string, any>;
  localLastModified: Date;
  remoteLastModified: Date;
  resolutionStrategy: ConflictResolution;
}

export interface SyncSummary {
  syncId: string;
  connectionId: string;
  startTime: Date;
  endTime: Date;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  skippedCount: number;
  auditLogs: SyncAuditLog[];
  errors: Array<{ recordId: string; error: string }>;
}

// ─── ERP SYNC ENGINE ──────────────────────────────────────────────────────

/**
 * ERP Sync Engine
 * Orchestrates bidirectional sync with conflict resolution and audit logging
 */
export class ERPSyncEngine {
  private adapters: Map<string, AbstractERPAdapter> = new Map();
  private connections: Map<string, ERPConnection> = new Map();
  private auditLogs: SyncAuditLog[] = [];
  private lastSyncTime: Map<string, Date> = new Map();

  // Entity dependency order for syncing
  private readonly ENTITY_SYNC_ORDER: SyncEntityType[] = [
    'customer',
    'vendor',
    'product',
    'order',
    'invoice',
    'payment',
    'journal_entry',
    'inventory',
  ];

  /**
   * Register adapter for a connection
   */
  registerAdapter(connectionId: string, connection: ERPConnection, adapter: AbstractERPAdapter): void {
    this.adapters.set(connectionId, adapter);
    this.connections.set(connectionId, connection);
  }

  /**
   * Get adapter for a connection
   */
  getAdapter(connectionId: string): AbstractERPAdapter | undefined {
    return this.adapters.get(connectionId);
  }

  /**
   * Execute sync operation
   */
  async sync(connectionId: string, options: SyncOptions): Promise<SyncSummary> {
    const startTime = new Date();
    const syncId = this.generateSyncId();
    const adapter = this.getAdapter(connectionId);
    const connection = this.connections.get(connectionId);

    if (!adapter || !connection) {
      throw new Error(`Adapter or connection not found for ${connectionId}`);
    }

    const summary: SyncSummary = {
      syncId,
      connectionId,
      startTime,
      endTime: new Date(),
      totalRecords: 0,
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      skippedCount: 0,
      auditLogs: [],
      errors: [],
    };

    try {
      // Sort entities by dependency order
      const sortedEntities = options.entityTypes.sort((a, b) => {
        const aIdx = this.ENTITY_SYNC_ORDER.indexOf(a);
        const bIdx = this.ENTITY_SYNC_ORDER.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

      // Sync each entity type
      for (const entityType of sortedEntities) {
        try {
          const result = await this.syncEntity(
            syncId,
            connectionId,
            adapter,
            entityType,
            options,
          );

          summary.totalRecords += result.totalRecords;
          summary.successCount += result.successCount;
          summary.failureCount += result.failureCount;
          summary.conflictCount += result.conflictCount;
          summary.skippedCount += result.skippedCount;
          summary.auditLogs.push(...result.auditLogs);
          summary.errors.push(...result.errors);
        } catch (error: any) {
          if (!options.skipErrors) {
            throw error;
          }
          summary.errors.push({
            recordId: entityType,
            error: error.message,
          });
        }
      }

      summary.endTime = new Date();
      this.lastSyncTime.set(connectionId, summary.endTime);

      return summary;
    } catch (error: any) {
      summary.endTime = new Date();
      throw error;
    }
  }

  /**
   * Sync single entity type with conflict resolution
   */
  private async syncEntity(
    syncId: string,
    connectionId: string,
    adapter: AbstractERPAdapter,
    entityType: SyncEntityType,
    options: SyncOptions,
  ): Promise<{
    totalRecords: number;
    successCount: number;
    failureCount: number;
    conflictCount: number;
    skippedCount: number;
    auditLogs: SyncAuditLog[];
    errors: Array<{ recordId: string; error: string }>;
  }> {
    const result = {
      totalRecords: 0,
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      skippedCount: 0,
      auditLogs: [] as SyncAuditLog[],
      errors: [] as Array<{ recordId: string; error: string }>,
    };

    // Get changes since last sync
    const changes = await this.getChanges(
      connectionId,
      entityType,
      options.fullSync,
    );

    result.totalRecords = changes.length;

    // Process changes with batching
    const batchSize = options.batchSize || 100;
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);

      for (const change of batch) {
        try {
          const auditLog = await this.processChange(
            syncId,
            connectionId,
            adapter,
            entityType,
            change,
            options,
          );

          result.auditLogs.push(auditLog);

          if (auditLog.status === 'success') {
            result.successCount += 1;
          } else if (auditLog.action === 'conflict') {
            result.conflictCount += 1;
          } else {
            result.failureCount += 1;
          }
        } catch (error: any) {
          result.failureCount += 1;
          result.errors.push({
            recordId: change.recordId,
            error: error.message,
          });

          if (!options.skipErrors) {
            throw error;
          }
        }
      }
    }

    return result;
  }

  /**
   * Process individual change record
   */
  private async processChange(
    syncId: string,
    connectionId: string,
    adapter: AbstractERPAdapter,
    entityType: SyncEntityType,
    change: DeltaChangeSet,
    options: SyncOptions,
  ): Promise<SyncAuditLog> {
    const timestamp = new Date();
    const startTime = Date.now();

    const auditLog: SyncAuditLog = {
      id: this.generateLogId(),
      connectionId,
      syncId,
      timestamp,
      entityType,
      recordId: change.recordId,
      direction: options.direction,
      action: change.changeType,
      status: 'success',
      duration: 0,
    };

    try {
      // Determine sync direction
      if (options.direction === 'push' || options.direction === 'bidirectional') {
        // Push to ERP
        auditLog.localData = change.data;
        await this.pushToERP(adapter, entityType, change);
      }

      if (options.direction === 'pull' || options.direction === 'bidirectional') {
        // Pull from ERP
        const remoteData = await this.pullFromERP(adapter, entityType, change.recordId);
        auditLog.remoteData = remoteData;

        // Check for conflicts
        if (options.direction === 'bidirectional' && change.changeType === 'update') {
          const conflict = this.detectConflict(change.data, remoteData, change.lastSyncAt);
          if (conflict) {
            auditLog.action = 'conflict';
            const resolved = await this.resolveConflict(
              conflict,
              options.conflictResolution,
            );
            auditLog.resolvedData = resolved;
            auditLog.resolutionMethod = options.conflictResolution;
          }
        }
      }

      auditLog.duration = Date.now() - startTime;
      return auditLog;
    } catch (error: any) {
      auditLog.status = 'failed';
      auditLog.error = error.message;
      auditLog.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Push changes to ERP
   */
  private async pushToERP(
    adapter: AbstractERPAdapter,
    entityType: SyncEntityType,
    change: DeltaChangeSet,
  ): Promise<void> {
    // Implementation depends on entity type and adapter
    // This is a framework for the actual push logic
  }

  /**
   * Pull changes from ERP
   */
  private async pullFromERP(
    adapter: AbstractERPAdapter,
    entityType: SyncEntityType,
    recordId: string,
  ): Promise<Record<string, any>> {
    // Implementation depends on entity type and adapter
    return {};
  }

  /**
   * Detect conflicts between local and remote versions
   */
  private detectConflict(
    localData: Record<string, any>,
    remoteData: Record<string, any>,
    lastSyncAt: Date,
  ): ConflictRecord | null {
    // Simple conflict detection: if both have changed since last sync
    const hasLocalChanges = Object.entries(localData).some(([key, value]) => {
      return remoteData[key] !== value;
    });

    if (!hasLocalChanges) {
      return null;
    }

    // More sophisticated detection could track field-level changes
    return {
      recordId: localData.id || '',
      entity: 'customer' as SyncEntityType,
      localVersion: localData,
      remoteVersion: remoteData,
      localLastModified: new Date(),
      remoteLastModified: new Date(),
      resolutionStrategy: 'timestamp',
    };
  }

  /**
   * Resolve conflict using specified strategy
   */
  private async resolveConflict(
    conflict: ConflictRecord,
    strategy: ConflictResolution,
  ): Promise<Record<string, any>> {
    switch (strategy) {
      case 'timestamp':
        // Keep the more recently modified version
        return conflict.remoteLastModified > conflict.localLastModified
          ? conflict.remoteVersion
          : conflict.localVersion;

      case 'priority':
        // Keep local (Witylogix is source of truth)
        return conflict.localVersion;

      case 'manual':
        // Return both versions for manual review
        return {
          localVersion: conflict.localVersion,
          remoteVersion: conflict.remoteVersion,
          requiresManualReview: true,
        };

      case 'custom':
        // Allow custom resolver function
        return conflict.localVersion;

      default:
        return conflict.localVersion;
    }
  }

  /**
   * Get changes since last sync (delta sync)
   */
  private async getChanges(
    connectionId: string,
    entityType: SyncEntityType,
    fullSync: boolean = false,
  ): Promise<DeltaChangeSet[]> {
    const lastSync = this.lastSyncTime.get(connectionId) || new Date(0);
    const changes: DeltaChangeSet[] = [];

    if (fullSync) {
      // Full sync: fetch all records
      // Implementation would vary by adapter
    } else {
      // Delta sync: only fetch changes since last sync
      // Implementation would vary by adapter
    }

    return changes;
  }

  /**
   * Get sync history/audit logs
   */
  getSyncHistory(connectionId: string, limit: number = 100): SyncAuditLog[] {
    return this.auditLogs
      .filter((log) => log.connectionId === connectionId)
      .slice(-limit);
  }

  /**
   * Get last sync time for connection
   */
  getLastSyncTime(connectionId: string): Date | undefined {
    return this.lastSyncTime.get(connectionId);
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(connectionId?: string): void {
    if (connectionId) {
      this.auditLogs = this.auditLogs.filter((log) => log.connectionId !== connectionId);
    } else {
      this.auditLogs = [];
    }
  }

  /**
   * Generate sync ID
   */
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export sync summary as JSON
   */
  exportSyncSummary(summary: SyncSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Export audit logs as CSV
   */
  exportAuditLogsAsCSV(connectionId?: string): string {
    const logs = connectionId
      ? this.auditLogs.filter((log) => log.connectionId === connectionId)
      : this.auditLogs;

    const headers = [
      'ID',
      'Connection ID',
      'Sync ID',
      'Timestamp',
      'Entity Type',
      'Record ID',
      'Direction',
      'Action',
      'Status',
      'Duration (ms)',
      'Error',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.connectionId,
      log.syncId,
      log.timestamp.toISOString(),
      log.entityType,
      log.recordId,
      log.direction,
      log.action,
      log.status,
      log.duration,
      log.error || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }
}

/**
 * Factory function to create sync engine with pre-registered adapters
 */
export function createERPSyncEngine(
  connections: Map<string, { connection: ERPConnection; adapter: AbstractERPAdapter }>,
): ERPSyncEngine {
  const engine = new ERPSyncEngine();

  connections.forEach((item, connectionId) => {
    engine.registerAdapter(connectionId, item.connection, item.adapter);
  });

  return engine;
}
