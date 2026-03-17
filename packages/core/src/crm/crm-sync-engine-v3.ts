/**
 * CRM Sync Engine v3 - Core synchronization orchestrator with field mapping DSL
 * and bi-directional conflict resolution.
 *
 * Provides:
 * - CrmSyncOrchestrator: manages sync lifecycle across CRM providers
 * - FieldMappingDSL: declarative field mapping with transformations
 * - BidirectionalResolver: conflict resolution with multiple strategies
 * - ChangeDetector: track field-level changes for delta sync
 * - SyncTransaction: atomic sync operations with rollback support
 *
 * @module crm/crm-sync-engine-v3
 */

import type {
  UnifiedContact,
  UnifiedDeal,
  UnifiedCompany,
  UnifiedActivity,
  FieldMapping,
  MappingRule,
  ConflictRecord,
  SyncConfig,
  SyncTransaction,
  SyncOperation,
  SyncMetrics,
  WitylogixCrmEvent,
  CrmProvider,
} from "./crm-types.js";

import {
  SyncDirection,
  SyncStatus,
  ConflictResolutionStrategy,
} from "./crm-types.js";

/**
 * Repository interface for CRM data access (abstraction layer)
 */
export interface CrmRepository {
  // Contact operations
  findContacts(tenantId: string, filters?: Record<string, unknown>): Promise<UnifiedContact[]>;
  findContactById(tenantId: string, contactId: string): Promise<UnifiedContact | null>;
  createContact(tenantId: string, contact: UnifiedContact): Promise<UnifiedContact>;
  updateContact(tenantId: string, contactId: string, updates: Partial<UnifiedContact>): Promise<UnifiedContact>;
  deleteContact(tenantId: string, contactId: string): Promise<void>;

  // Deal operations
  findDeals(tenantId: string, filters?: Record<string, unknown>): Promise<UnifiedDeal[]>;
  findDealById(tenantId: string, dealId: string): Promise<UnifiedDeal | null>;
  createDeal(tenantId: string, deal: UnifiedDeal): Promise<UnifiedDeal>;
  updateDeal(tenantId: string, dealId: string, updates: Partial<UnifiedDeal>): Promise<UnifiedDeal>;
  deleteDeal(tenantId: string, dealId: string): Promise<void>;

  // Company operations
  findCompanies(tenantId: string, filters?: Record<string, unknown>): Promise<UnifiedCompany[]>;
  findCompanyById(tenantId: string, companyId: string): Promise<UnifiedCompany | null>;
  createCompany(tenantId: string, company: UnifiedCompany): Promise<UnifiedCompany>;
  updateCompany(tenantId: string, companyId: string, updates: Partial<UnifiedCompany>): Promise<UnifiedCompany>;
  deleteCompany(tenantId: string, companyId: string): Promise<void>;

  // Activity operations
  findActivities(tenantId: string, filters?: Record<string, unknown>): Promise<UnifiedActivity[]>;
  findActivityById(tenantId: string, activityId: string): Promise<UnifiedActivity | null>;
  createActivity(tenantId: string, activity: UnifiedActivity): Promise<UnifiedActivity>;
  updateActivity(tenantId: string, activityId: string, updates: Partial<UnifiedActivity>): Promise<UnifiedActivity>;
  deleteActivity(tenantId: string, activityId: string): Promise<void>;

  // Conflict management
  recordConflict(conflict: ConflictRecord): Promise<void>;
  findUnresolvedConflicts(tenantId: string): Promise<ConflictRecord[]>;
  resolveConflict(conflictId: string, resolution: "INTERNAL" | "EXTERNAL"): Promise<void>;
}

/**
 * Field Mapping DSL - Declarative field mapping language
 *
 * Example usage:
 * ```typescript
 * const dsl = new FieldMappingDSL();
 * dsl.map('contact.email')
 *    .to('customer.email_address');
 * dsl.map('deal.amount')
 *    .transform(currencyConvert)
 *    .to('order.total');
 * dsl.map('company.name')
 *    .when(notEmpty)
 *    .to('organization.name');
 * ```
 */
export class FieldMappingDSL {
  private sourceField: string = "";
  private transformFn?: (value: unknown, context?: Record<string, unknown>) => unknown;
  private conditionFn?: (value: unknown) => boolean;
  private targetField: string = "";
  private rules: MappingRule[] = [];
  private required: boolean = true;
  private dataType: "string" | "number" | "boolean" | "date" | "object" | "array" | "null" = "string";

  /**
   * Start mapping from a source field
   * @param field - Source field path (supports dot notation)
   */
  map(field: string): this {
    this.sourceField = field;
    this.transformFn = undefined;
    this.conditionFn = undefined;
    this.targetField = "";
    this.required = true;
    this.dataType = "string";
    return this;
  }

  /**
   * Apply a transformation function
   * @param fn - Transform function
   */
  transform(fn: (value: unknown, context?: Record<string, unknown>) => unknown): this {
    this.transformFn = fn;
    return this;
  }

  /**
   * Apply a conditional predicate
   * @param fn - Predicate function
   */
  when(fn: (value: unknown) => boolean): this {
    this.conditionFn = fn;
    return this;
  }

  /**
   * Set data type
   * @param type - Data type
   */
  asType(type: "string" | "number" | "boolean" | "date" | "object" | "array" | "null"): this {
    this.dataType = type;
    return this;
  }

  /**
   * Mark field as optional
   */
  optional(): this {
    this.required = false;
    return this;
  }

  /**
   * Complete the mapping to target field
   * @param field - Target field path
   */
  to(field: string): this {
    this.targetField = field;

    // Validate mapping
    if (!this.sourceField || !this.targetField) {
      throw new Error("Source and target fields are required for mapping");
    }

    // Create and add rule
    const rule: MappingRule = {
      sourceField: this.sourceField,
      targetField: this.targetField,
      transform: this.transformFn,
      condition: this.conditionFn,
      required: this.required,
      dataType: this.dataType,
    };

    this.rules.push(rule);

    // Reset state for next mapping
    this.sourceField = "";
    this.transformFn = undefined;
    this.conditionFn = undefined;
    this.targetField = "";
    this.required = true;
    this.dataType = "string";

    return this;
  }

  /**
   * Get all configured rules
   */
  getRules(): MappingRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules
   */
  clear(): this {
    this.rules = [];
    return this;
  }
}

/**
 * Change Detector - Track field-level changes for delta sync
 */
export class ChangeDetector {
  /**
   * Detect changes between old and new versions of an entity
   * @param oldEntity - Previous state
   * @param newEntity - Current state
   * @returns Map of field names to their changes
   */
  detectChanges(
    oldEntity: Record<string, unknown>,
    newEntity: Record<string, unknown>,
  ): Map<string, { oldValue: unknown; newValue: unknown }> {
    const changes = new Map<string, { oldValue: unknown; newValue: unknown }>();

    // Check all fields in new entity
    for (const [key, newValue] of Object.entries(newEntity)) {
      const oldValue = oldEntity[key];

      // Simple equality check for now; could be enhanced for deep comparison
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.set(key, { oldValue, newValue });
      }
    }

    // Check for deleted fields
    for (const key of Object.keys(oldEntity)) {
      if (!(key in newEntity)) {
        changes.set(key, { oldValue: oldEntity[key], newValue: undefined });
      }
    }

    return changes;
  }

  /**
   * Get only the fields that changed (delta)
   */
  getDelta(
    oldEntity: Record<string, unknown>,
    newEntity: Record<string, unknown>,
  ): Record<string, unknown> {
    const delta: Record<string, unknown> = {};
    const changes = this.detectChanges(oldEntity, newEntity);

    for (const [key, change] of changes) {
      delta[key] = change.newValue;
    }

    return delta;
  }
}

/**
 * Bidirectional Conflict Resolver
 * Resolves conflicts between internal and external CRM data
 */
export class BidirectionalResolver {
  private conflictQueue: ConflictRecord[] = [];
  private fieldPriorities: Map<string, "INTERNAL" | "EXTERNAL"> = new Map();

  /**
   * Initialize with field priorities for specific fields
   * @param priorities - Map of field names to winning side
   */
  setFieldPriorities(priorities: Record<string, "INTERNAL" | "EXTERNAL">): void {
    this.fieldPriorities = new Map(Object.entries(priorities));
  }

  /**
   * Detect and queue conflicts
   * @param internalData - Internal Witylogix data
   * @param externalData - External CRM data
   * @param changeDetector - Change detector instance
   */
  detectConflicts(
    conflictId: string,
    entityId: string,
    entityType: "Contact" | "Deal" | "Company" | "Activity",
    crmProvider: CrmProvider,
    tenantId: string,
    internalData: Record<string, unknown>,
    externalData: Record<string, unknown>,
    strategy: ConflictResolutionStrategy,
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];
    const changeDetector = new ChangeDetector();
    const changes = changeDetector.detectChanges(internalData, externalData);

    for (const [field, change] of changes) {
      if (change.oldValue !== undefined && change.newValue !== undefined) {
        // Both sides have different values - this is a conflict
        const conflict: ConflictRecord = {
          conflictId: `${conflictId}-${field}`,
          entityId,
          entityType,
          crmProvider,
          tenantId,
          conflictField: field,
          internalValue: change.oldValue,
          externalValue: change.newValue,
          internalUpdatedAt: new Date().toISOString(),
          externalUpdatedAt: new Date().toISOString(),
          resolutionStrategy: strategy,
          isResolved: false,
          createdAt: new Date().toISOString(),
        };

        conflicts.push(conflict);
        this.conflictQueue.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflict using configured strategy
   * @param conflict - Conflict record
   * @param strategy - Resolution strategy
   * @returns Winning value
   */
  resolveConflict(conflict: ConflictRecord, strategy: ConflictResolutionStrategy): unknown {
    // Check field-level priority first
    const fieldPriority = this.fieldPriorities.get(conflict.conflictField);
    if (fieldPriority) {
      const resolution = fieldPriority === "INTERNAL"
        ? conflict.internalValue
        : conflict.externalValue;
      return resolution;
    }

    // Apply strategy
    switch (strategy) {
      case ConflictResolutionStrategy.TIMESTAMP_WINS:
        return new Date(conflict.externalUpdatedAt) > new Date(conflict.internalUpdatedAt)
          ? conflict.externalValue
          : conflict.internalValue;

      case ConflictResolutionStrategy.SOURCE_OF_TRUTH:
        // External CRM is source of truth
        return conflict.externalValue;

      case ConflictResolutionStrategy.FIELD_PRIORITY:
        // Use field priorities (already handled above)
        return conflict.internalValue;

      case ConflictResolutionStrategy.MERGE:
        // Attempt merge (concatenate strings, sum numbers, etc.)
        return this.mergeValues(conflict.internalValue, conflict.externalValue);

      case ConflictResolutionStrategy.MANUAL_REVIEW:
        // Queue for manual review - don't auto-resolve
        return undefined;

      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
  }

  /**
   * Merge conflicting values
   */
  private mergeValues(internal: unknown, external: unknown): unknown {
    if (typeof internal === "string" && typeof external === "string") {
      // Concatenate strings
      return `${internal}; ${external}`;
    }

    if (typeof internal === "number" && typeof external === "number") {
      // Sum numbers
      return internal + external;
    }

    if (Array.isArray(internal) && Array.isArray(external)) {
      // Merge arrays
      return [...new Set([...internal, ...external])];
    }

    if (typeof internal === "object" && typeof external === "object") {
      // Merge objects
      return { ...internal, ...external };
    }

    // Default to external
    return external;
  }

  /**
   * Get unresolved conflicts in queue
   */
  getConflictQueue(): ConflictRecord[] {
    return this.conflictQueue.filter((c) => !c.isResolved);
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.conflictQueue = [];
  }
}

/**
 * Sync Transaction - Atomic sync operations with rollback support
 */
export class SyncTransaction {
  private operations: SyncOperation[] = [];
  private transactionId: string;
  private status: "PENDING" | "COMMITTED" | "ROLLED_BACK" = "PENDING";
  private createdAt: string;
  private completedAt?: string;
  private error?: string;

  /**
   * Create new sync transaction
   * @param tenantId - Tenant ID
   */
  constructor(private tenantId: string, transactionId?: string) {
    this.transactionId = transactionId || `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add operation to transaction
   */
  addOperation(operation: SyncOperation): void {
    if (this.status !== "PENDING") {
      throw new Error(`Cannot add operation to ${this.status} transaction`);
    }
    this.operations.push(operation);
  }

  /**
   * Get all operations
   */
  getOperations(): SyncOperation[] {
    return [...this.operations];
  }

  /**
   * Commit transaction (mark as successful)
   */
  commit(): void {
    if (this.status !== "PENDING") {
      throw new Error(`Cannot commit ${this.status} transaction`);
    }

    // Update operation statuses
    for (const op of this.operations) {
      op.status = "COMPLETED";
    }

    this.status = "COMMITTED";
    this.completedAt = new Date().toISOString();
  }

  /**
   * Rollback transaction
   */
  rollback(error?: string): void {
    if (this.status !== "PENDING") {
      throw new Error(`Cannot rollback ${this.status} transaction`);
    }

    for (const op of this.operations) {
      op.status = "FAILED";

      // Restore original data if available
      if (op.originalData) {
        op.data = op.originalData;
      }
    }

    this.status = "ROLLED_BACK";
    this.completedAt = new Date().toISOString();
    this.error = error;
  }

  /**
   * Get transaction state
   */
  getState(): SyncTransaction {
    return {
      transactionId: this.transactionId,
      tenantId: this.tenantId,
      operations: this.operations,
      status: this.status,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      error: this.error,
    };
  }
}

/**
 * CRM Sync Orchestrator - Manages sync lifecycle across CRM providers
 *
 * Responsibilities:
 * - Coordinate sync operations across multiple CRM providers
 * - Apply field mapping transformations
 * - Detect and resolve conflicts
 * - Track sync metrics
 * - Support atomic transactions with rollback
 */
export class CrmSyncOrchestrator {
  private repository: CrmRepository;
  private config: SyncConfig;
  private resolver: BidirectionalResolver;
  private changeDetector: ChangeDetector;
  private syncMetrics: SyncMetrics;
  private transactions: Map<string, SyncTransaction> = new Map();

  /**
   * Initialize orchestrator
   * @param repository - CRM repository for data access
   * @param config - Sync configuration
   */
  constructor(repository: CrmRepository, config: SyncConfig) {
    this.repository = repository;
    this.config = config;
    this.resolver = new BidirectionalResolver();
    this.changeDetector = new ChangeDetector();

    // Initialize metrics
    this.syncMetrics = {
      crmProvider: config.crmProvider,
      tenantId: config.tenantId,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      successRate: 0,
      avgLatencyMs: 0,
      totalConflicts: 0,
      unresolvedConflicts: 0,
      recordsSynced: 0,
    };

    // Set field priorities if provided in config metadata
    if (config.metadata?.fieldPriorities) {
      this.resolver.setFieldPriorities(config.metadata.fieldPriorities as Record<string, "INTERNAL" | "EXTERNAL">);
    }
  }

  /**
   * Execute bidirectional sync
   * @param internalData - Internal data to sync
   * @param externalData - External CRM data
   */
  async executeBiDirectionalSync(
    internalData: Record<string, unknown>,
    externalData: Record<string, unknown>,
  ): Promise<{
    conflicts: ConflictRecord[];
    mergedData: Record<string, unknown>;
  }> {
    // Detect conflicts
    const conflicts = this.resolver.detectConflicts(
      `conflict-${Date.now()}`,
      internalData.id as string,
      "Contact", // Entity type - could be parameterized
      this.config.crmProvider,
      this.config.tenantId,
      internalData,
      externalData,
      this.config.conflictStrategy,
    );

    // Apply conflict resolution
    const mergedData = { ...internalData };

    for (const conflict of conflicts) {
      const resolution = this.resolver.resolveConflict(conflict, this.config.conflictStrategy);
      if (resolution !== undefined) {
        mergedData[conflict.conflictField] = resolution;
      }
    }

    return { conflicts, mergedData };
  }

  /**
   * Create new sync transaction
   */
  createTransaction(): SyncTransaction {
    const transaction = new SyncTransaction(this.config.tenantId);
    this.transactions.set(transaction.getState().transactionId, transaction);
    return transaction;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): SyncTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Apply field mapping to transform data
   * @param mapping - Field mapping configuration
   * @param sourceData - Source data to transform
   */
  applyFieldMapping(mapping: FieldMapping, sourceData: Record<string, unknown>): Record<string, unknown> {
    const targetData: Record<string, unknown> = {};

    for (const rule of mapping.rules) {
      const sourceValue = this.getNestedValue(sourceData, rule.sourceField);

      // Skip if null/undefined and optional
      if ((sourceValue === null || sourceValue === undefined) && !rule.required) {
        continue;
      }

      // Apply condition if present
      if (rule.condition && !rule.condition(sourceValue)) {
        continue;
      }

      // Apply transformation if present
      let transformedValue = sourceValue;
      if (rule.transform) {
        try {
          transformedValue = rule.transform(sourceValue, { sourceData });
        } catch (error) {
          console.error(`Transform failed for field ${rule.sourceField}:`, error);
          throw error;
        }
      }

      // Set in target using nested path
      this.setNestedValue(targetData, rule.targetField, transformedValue);
    }

    return targetData;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: any = obj;

    for (const key of keys) {
      if (current && typeof current === "object") {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    let current: any = obj;

    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Get current sync metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }

  /**
   * Record successful sync
   */
  recordSuccess(recordsCount: number, latencyMs: number): void {
    this.syncMetrics.totalSyncs += 1;
    this.syncMetrics.successfulSyncs += 1;
    this.syncMetrics.recordsSynced += recordsCount;

    // Update average latency
    const totalLatency = this.syncMetrics.avgLatencyMs * (this.syncMetrics.totalSyncs - 1) + latencyMs;
    this.syncMetrics.avgLatencyMs = totalLatency / this.syncMetrics.totalSyncs;

    this.syncMetrics.successRate =
      (this.syncMetrics.successfulSyncs / this.syncMetrics.totalSyncs) * 100;

    this.syncMetrics.lastSyncAt = new Date().toISOString();
  }

  /**
   * Record failed sync
   */
  recordFailure(latencyMs: number): void {
    this.syncMetrics.totalSyncs += 1;
    this.syncMetrics.failedSyncs += 1;

    // Update average latency
    const totalLatency = this.syncMetrics.avgLatencyMs * (this.syncMetrics.totalSyncs - 1) + latencyMs;
    this.syncMetrics.avgLatencyMs = totalLatency / this.syncMetrics.totalSyncs;

    this.syncMetrics.successRate =
      (this.syncMetrics.successfulSyncs / this.syncMetrics.totalSyncs) * 100;
  }

  /**
   * Record detected conflicts
   */
  recordConflicts(count: number, unresolved: number): void {
    this.syncMetrics.totalConflicts += count;
    this.syncMetrics.unresolvedConflicts += unresolved;
  }
}
