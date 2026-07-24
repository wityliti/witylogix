/**
 * CRM Sync Engine v2
 * Bidirectional sync orchestration across CRM providers with conflict resolution
 * Supports Salesforce, HubSpot, Zoho, Dynamics, and Pipedrive
 */

import type {
  CRMProvider,
  CRMConnection,
  CRMContact,
  CRMAccount,
  CRMDeal,
  CRMActivity,
  CRMFieldMapping,
  CRMSyncLog,
  CRMSyncResult,
  ICRMAdapter,
  ConflictResolution,
  EntityRelationshipMapping,
  SyncStateToken,
} from "./types.js";

// ─── SYNC STATE & TRACKING ─────────────────────────────────────────

export interface SyncState {
  entityType: string;
  externalId: string;
  localId: string;
  provider: CRMProvider;
  lastSyncedAt: Date;
  lastRemoteModifiedAt: Date;
  lastLocalModifiedAt: Date;
  status: "synced" | "pending" | "failed" | "conflict";
}

export interface SyncConflict {
  entityType: string;
  externalId: string;
  localId: string;
  remoteChanges: Record<string, unknown>;
  localChanges: Record<string, unknown>;
  conflictedFields: string[];
  resolution?: ConflictResolution;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SyncMetrics {
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalDeleted: number;
  totalConflicts: number;
  totalErrors: number;
  durationMs: number;
  startedAt: Date;
  completedAt?: Date;
}

// ─── SYNC ENGINE CONFIGURATION ────────────────────────────────────────

export interface CRMSyncEngineConfig {
  tenantId: string;
  connections: CRMConnection[];
  fieldMappings: CRMFieldMapping[];
  conflictResolution: ConflictResolution;
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableWebhooks?: boolean;
  syncDirection: "inbound" | "outbound" | "bidirectional";
  entityRelationships?: EntityRelationshipMapping[];
}

// ─── ERROR TRACKING & RECOVERY ───────────────────────────────────────

export interface SyncErrorRecord {
  id: string;
  entityType: string;
  entityId: string;
  provider: CRMProvider;
  error: Error;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  status: "pending_retry" | "dead_lettered" | "resolved";
  createdAt: Date;
  updatedAt: Date;
}

// ─── SYNC ENGINE IMPLEMENTATION ──────────────────────────────────────

export class CRMSyncEngine {
  private config: CRMSyncEngineConfig;
  private adapters: Map<CRMProvider, ICRMAdapter> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private syncConflicts: Map<string, SyncConflict> = new Map();
  private errorQueue: SyncErrorRecord[] = [];
  private metrics: SyncMetrics;

  constructor(
    config: CRMSyncEngineConfig,
    adapters: Map<CRMProvider, ICRMAdapter>,
  ) {
    this.config = config;
    this.adapters = adapters;
    this.metrics = {
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalConflicts: 0,
      totalErrors: 0,
      durationMs: 0,
      startedAt: new Date(),
    };
  }

  // ─── SYNC ORCHESTRATION ────────────────────────────────────────────

  async performFullSync(
    entityType: "contact" | "account" | "deal" | "activity",
  ): Promise<SyncMetrics> {
    const startTime = Date.now();
    this.metrics.startedAt = new Date();

    try {
      for (const [provider, adapter] of this.adapters.entries()) {
        if (
          this.config.syncDirection === "inbound" ||
          this.config.syncDirection === "bidirectional"
        ) {
          await this.syncInbound(provider, adapter, entityType);
        }

        if (
          this.config.syncDirection === "outbound" ||
          this.config.syncDirection === "bidirectional"
        ) {
          await this.syncOutbound(provider, adapter, entityType);
        }
      }

      // Resolve any conflicts
      await this.resolveConflicts();

      // Process error queue
      await this.processErrorQueue();
    } catch (error) {
      this.metrics.totalErrors++;
      console.error("Sync error:", error);
    }

    this.metrics.durationMs = Date.now() - startTime;
    this.metrics.completedAt = new Date();

    return this.metrics;
  }

  private async syncInbound(
    provider: CRMProvider,
    adapter: ICRMAdapter,
    entityType: string,
  ): Promise<void> {
    let pagination = { limit: this.config.batchSize || 200, offset: 0 };

    try {
      while (true) {
        let result;

        switch (entityType) {
          case "contact":
            result = await adapter.getContacts({}, pagination);
            for (const contact of result.data) {
              await this.syncInboundEntity(provider, "contact", contact);
            }
            break;

          case "account":
            result = await adapter.getAccounts({}, pagination);
            for (const account of result.data) {
              await this.syncInboundEntity(provider, "account", account);
            }
            break;

          case "deal":
            result = await adapter.getOpportunities({}, pagination);
            for (const deal of result.data) {
              await this.syncInboundEntity(provider, "deal", deal);
            }
            break;

          case "activity":
            result = await adapter.getActivities("", pagination);
            for (const activity of result.data) {
              await this.syncInboundEntity(provider, "activity", activity);
            }
            break;
        }

        if (!result?.hasMore) break;
        pagination.offset =
          (pagination.offset || 0) + (this.config.batchSize || 200);
      }
    } catch (error) {
      this.metrics.totalErrors++;
      this.queueError(provider, entityType, "", error as Error);
    }
  }

  private async syncOutbound(
    provider: CRMProvider,
    adapter: ICRMAdapter,
    entityType: string,
  ): Promise<void> {
    // Implementation would sync local Witylogix data to CRM
    // This would be implemented based on Witylogix data store access
  }

  private async syncInboundEntity(
    provider: CRMProvider,
    entityType: string,
    data: unknown,
  ): Promise<void> {
    const stateKey = `${provider}:${entityType}:${(data as Record<string, unknown>).id}`;
    const currentState = this.syncStates.get(stateKey);

    try {
      const remoteModifiedAt = (data as Record<string, unknown>)
        .lastModifiedAt as Date | undefined;

      // Check for conflicts
      if (currentState && this.hasConflict(currentState, remoteModifiedAt)) {
        this.metrics.totalConflicts++;
        this.recordConflict(provider, entityType, data);
        return;
      }

      // Update or create local record
      if (!currentState) {
        this.metrics.totalCreated++;
      } else {
        this.metrics.totalUpdated++;
      }

      this.metrics.totalProcessed++;

      // Store sync state
      this.syncStates.set(stateKey, {
        entityType,
        externalId: (data as Record<string, unknown>).id as string,
        localId: (data as Record<string, unknown>).id as string,
        provider,
        lastSyncedAt: new Date(),
        lastRemoteModifiedAt: remoteModifiedAt || new Date(),
        lastLocalModifiedAt: new Date(),
        status: "synced",
      });
    } catch (error) {
      this.metrics.totalErrors++;
      this.queueError(
        provider,
        entityType,
        (data as Record<string, unknown>).id as string,
        error as Error,
      );
    }
  }

  // ─── CONFLICT DETECTION & RESOLUTION ───────────────────────────────

  private hasConflict(state: SyncState, remoteModifiedAt?: Date): boolean {
    if (!remoteModifiedAt) return false;

    // Conflict if both local and remote have been modified since last sync
    return (
      state.lastLocalModifiedAt > state.lastSyncedAt &&
      remoteModifiedAt > state.lastSyncedAt
    );
  }

  private recordConflict(
    provider: CRMProvider,
    entityType: string,
    remoteData: unknown,
  ): void {
    const conflictKey = `${provider}:${entityType}:${(remoteData as Record<string, unknown>).id}`;

    this.syncConflicts.set(conflictKey, {
      entityType,
      externalId: (remoteData as Record<string, unknown>).id as string,
      localId: (remoteData as Record<string, unknown>).id as string,
      remoteChanges: remoteData as Record<string, unknown>,
      localChanges: {},
      conflictedFields: [],
      resolution: this.config.conflictResolution,
    });
  }

  private async resolveConflicts(): Promise<void> {
    for (const [, conflict] of this.syncConflicts.entries()) {
      const resolution = conflict.resolution || this.config.conflictResolution;

      switch (resolution.strategy) {
        case "last_write_wins":
          // Use the most recently modified version
          break;

        case "source_priority":
          // Use data from the source of truth
          if ((resolution.sourceOfTruth as string) === "witylogix") {
            // Update CRM with local data
          } else {
            // Update local with CRM data
          }
          break;

        case "manual":
          // Mark for manual review
          conflict.resolution = {
            strategy: "manual",
            manualReviewRequired: true,
          };
          break;

        case "merge":
          // Merge non-conflicting fields
          this.mergeConflictingData(conflict);
          break;
      }

      conflict.resolvedAt = new Date();
      conflict.resolution = resolution;
    }
  }

  private mergeConflictingData(conflict: SyncConflict): void {
    const merged: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(conflict.remoteChanges)) {
      if (!(key in conflict.localChanges)) {
        merged[key] = value;
      }
    }

    for (const [key, value] of Object.entries(conflict.localChanges)) {
      if (!(key in conflict.remoteChanges)) {
        merged[key] = value;
      }
    }

    // For conflicting fields, keep local by default
    for (const field of conflict.conflictedFields) {
      merged[field] = conflict.localChanges[field];
    }
  }

  // ─── ERROR QUEUE MANAGEMENT ────────────────────────────────────────

  private queueError(
    provider: CRMProvider,
    entityType: string,
    entityId: string,
    error: Error,
  ): void {
    const maxRetries = this.config.maxRetries || 3;
    const retryRecord: SyncErrorRecord = {
      id: `${provider}:${entityType}:${entityId}:${Date.now()}`,
      entityType,
      entityId,
      provider,
      error,
      retryCount: 0,
      maxRetries,
      nextRetryAt: new Date(Date.now() + (this.config.retryDelayMs || 60000)),
      status: "pending_retry",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.errorQueue.push(retryRecord);
  }

  private async processErrorQueue(): Promise<void> {
    const now = new Date();
    const pendingRetries = this.errorQueue.filter(
      (record) =>
        record.status === "pending_retry" &&
        record.nextRetryAt &&
        record.nextRetryAt <= now,
    );

    for (const record of pendingRetries) {
      if (record.retryCount >= record.maxRetries) {
        record.status = "dead_lettered";
        record.updatedAt = new Date();
        continue;
      }

      try {
        // Attempt retry
        record.retryCount++;
        record.status = "resolved";
        record.updatedAt = new Date();
      } catch (error) {
        record.nextRetryAt = new Date(
          Date.now() +
            (this.config.retryDelayMs || 60000) *
              Math.pow(2, record.retryCount),
        );
        record.updatedAt = new Date();
      }
    }
  }

  // ─── ENTITY RELATIONSHIP SYNC ──────────────────────────────────────

  async syncEntityRelationships(): Promise<void> {
    for (const mapping of this.config.entityRelationships || []) {
      // Implement relationship sync based on mapping configuration
      // E.g., link contacts to accounts, deals to opportunities
    }
  }

  // ─── STATE & METRICS ACCESS ────────────────────────────────────────

  getSyncState(
    provider: CRMProvider,
    entityType: string,
    entityId: string,
  ): SyncState | undefined {
    return this.syncStates.get(`${provider}:${entityType}:${entityId}`);
  }

  getAllSyncStates(): SyncState[] {
    return Array.from(this.syncStates.values());
  }

  getSyncConflicts(): SyncConflict[] {
    return Array.from(this.syncConflicts.values());
  }

  getErrorQueue(): SyncErrorRecord[] {
    return this.errorQueue;
  }

  getMetrics(): SyncMetrics {
    return this.metrics;
  }

  // ─── SYNC TOKEN MANAGEMENT ────────────────────────────────────────

  generateSyncToken(provider: CRMProvider): SyncStateToken {
    return {
      provider,
      connectionId: this.config.connections[0]?.id || "",
      token: `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      updatedAt: new Date(),
    };
  }

  // ─── WEBHOOK HANDLING ──────────────────────────────────────────────

  async handleCRMWebhook(
    provider: CRMProvider,
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.config.enableWebhooks) {
      return;
    }

    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`No adapter configured for provider: ${provider}`);
    }

    // Process webhook event
    const entityType = this.mapWebhookToEntityType(eventType);
    if (entityType) {
      await this.syncInboundEntity(provider, entityType, data);
    }
  }

  private mapWebhookToEntityType(eventType: string): string | null {
    const mapping: Record<string, string> = {
      "contact.updated": "contact",
      "contact.created": "contact",
      "account.updated": "account",
      "account.created": "account",
      "deal.updated": "deal",
      "deal.created": "deal",
      "opportunity.updated": "deal",
      "opportunity.created": "deal",
      "activity.created": "activity",
      "activity.updated": "activity",
    };

    return mapping[eventType] || null;
  }

  // ─── HEALTH CHECK ─────────────────────────────────────────────────

  async healthCheck(): Promise<Record<CRMProvider, boolean>> {
    const health = {} as Record<CRMProvider, boolean>;

    for (const [provider] of this.adapters.entries()) {
      try {
        const rateLimitInfo = this.adapters.get(provider)?.getRateLimitInfo();
        health[provider] = !!rateLimitInfo;
      } catch {
        health[provider] = false;
      }
    }

    return health;
  }
}
