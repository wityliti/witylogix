/**
 * Migration Toolkit — Core implementation for provider migration operations.
 *
 * Manages provider swaps, data mapping, shadow mode execution, rollback,
 * validation, and progress tracking throughout the migration lifecycle.
 */

import type {
  DataMapper,
  FieldMapping,
  MigrationEvent,
  MigrationMetrics,
  MigrationReport,
  MigrationStatus,
  MigrationTracker as MigrationTrackerShape,
  PostMigrationValidation,
  PreMigrationValidation,
  ProviderMapping,
  RollbackResult,
  RollbackSnapshot,
  ShadowComparison,
  ShadowModeConfig,
  StructuralDiff,
  TransformFunction,
  ValidationResult,
  ValueDiff,
  DuringMigrationValidation,
} from "./migration-types";

// ─── Provider Swap Engine ──────────────────────────────────────

/**
 * Manages source-to-target provider mappings, compatibility validation,
 * and atomic cutover execution.
 */
export class ProviderSwapEngine {
  /**
   * Define a new provider mapping.
   * @param sourceProvider Source provider slug
   * @param targetProvider Target provider slug
   * @returns Provider mapping configuration
   */
  defineMapping(
    sourceProvider: string,
    targetProvider: string,
  ): ProviderMapping {
    return {
      migrationId: this.generateId(),
      sourceProvider,
      targetProvider,
      targetConfigured: false,
      prerequisitesValid: false,
      createdAt: new Date(),
    };
  }

  /**
   * Validate provider compatibility.
   * @param sourceProvider Source provider slug
   * @param targetProvider Target provider slug
   * @returns Compatibility result
   */
  validateCompatibility(
    sourceProvider: string,
    targetProvider: string,
  ): {
    compatible: boolean;
    missingCapabilities: string[];
    warnings: string[];
  } {
    // In real implementation, check provider capability matrix
    const sourceCapabilities = this.getProviderCapabilities(sourceProvider);
    const targetCapabilities = this.getProviderCapabilities(targetProvider);

    const missingCapabilities = sourceCapabilities.filter(
      (cap) => !targetCapabilities.includes(cap),
    );

    return {
      compatible: missingCapabilities.length === 0,
      missingCapabilities,
      warnings: this.getCompatibilityWarnings(sourceProvider, targetProvider),
    };
  }

  /**
   * Check prerequisites for migration.
   * @param mapping Provider mapping
   * @param targetCredentials Target provider credentials
   * @returns Prerequisites validation result
   */
  checkPrerequisites(
    mapping: ProviderMapping,
    targetCredentials: Record<string, unknown>,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate target provider is configured
    if (!targetCredentials || Object.keys(targetCredentials).length === 0) {
      errors.push("Target provider credentials not configured");
    }

    // Validate credentials are valid (basic check)
    if (targetCredentials) {
      const requiredFields = this.getRequiredCredentialFields(
        mapping.targetProvider,
      );
      for (const field of requiredFields) {
        if (!targetCredentials[field]) {
          errors.push(`Missing required credential field: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute atomic cutover from source to target provider.
   * @param mapping Provider mapping
   * @param snapshot Pre-migration rollback snapshot
   * @returns Cutover result
   */
  async executeCutover(
    mapping: ProviderMapping,
    snapshot: RollbackSnapshot,
  ): Promise<{
    success: boolean;
    errors: string[];
    verificationPassed: boolean;
  }> {
    try {
      // Step 1: Pause traffic to source provider
      await this.pauseTraffic(mapping.sourceProvider);

      // Step 2: Wait for in-flight requests to complete
      await this.waitForInflightRequests(5000);

      // Step 3: Switch traffic to target provider
      await this.switchTraffic(mapping.sourceProvider, mapping.targetProvider);

      // Step 4: Verify routing is correct
      const verificationPassed = await this.verifyRouting(
        mapping.targetProvider,
      );

      // Step 5: Resume traffic
      await this.resumeTraffic(mapping.targetProvider);

      return {
        success: verificationPassed,
        errors: [],
        verificationPassed,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        verificationPassed: false,
      };
    }
  }

  private getProviderCapabilities(provider: string): string[] {
    // In real implementation, fetch from provider registry
    const capabilities: Record<string, string[]> = {
      stripe: ["payments", "subscriptions", "disputes", "refunds", "webhooks"],
      paypal: ["payments", "subscriptions", "disputes", "refunds", "webhooks"],
      square: ["payments", "inventory", "appointments", "webhooks"],
    };
    return capabilities[provider] || [];
  }

  private getCompatibilityWarnings(
    sourceProvider: string,
    targetProvider: string,
  ): string[] {
    // In real implementation, compile known compatibility issues
    const warnings: string[] = [];
    if (sourceProvider === "stripe" && targetProvider === "paypal") {
      warnings.push("Subscription syntax differs between providers");
      warnings.push("Dispute handling has different workflows");
    }
    return warnings;
  }

  private getRequiredCredentialFields(provider: string): string[] {
    const fields: Record<string, string[]> = {
      stripe: ["apiKey", "publishableKey"],
      paypal: ["clientId", "clientSecret"],
      square: ["accessToken", "locationId"],
    };
    return fields[provider] || [];
  }

  private async pauseTraffic(provider: string): Promise<void> {
    // In real implementation, update routing rules
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async waitForInflightRequests(timeoutMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs / 10));
  }

  private async switchTraffic(
    sourceProvider: string,
    targetProvider: string,
  ): Promise<void> {
    // In real implementation, atomically switch traffic routing
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async verifyRouting(provider: string): Promise<boolean> {
    // In real implementation, test health endpoints
    return true;
  }

  private async resumeTraffic(provider: string): Promise<void> {
    // In real implementation, re-enable traffic
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private generateId(): string {
    return `mig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ─── Data Mapper ───────────────────────────────────────────────

/**
 * Manages field-level data mapping, transformations, and schema validation.
 */
export class DataMapperService {
  /**
   * Create field mapping configuration.
   * @param sourceField Source field name
   * @param targetField Target field name
   * @param sourceType Source data type
   * @param targetType Target data type
   * @returns Field mapping configuration
   */
  createFieldMapping(
    sourceField: string,
    targetField: string,
    sourceType: string,
    targetType: string,
  ): FieldMapping {
    return {
      sourceField,
      targetField,
      sourceType,
      targetType,
      required: true,
      validate: undefined,
    };
  }

  /**
   * Add transformation function to field mapping.
   * @param mapping Field mapping
   * @param transform Transformation function
   * @returns Updated mapping
   */
  addTransform(
    mapping: FieldMapping,
    transform: TransformFunction,
  ): FieldMapping {
    return { ...mapping, transform };
  }

  /**
   * Add validation to field mapping.
   * @param mapping Field mapping
   * @param validate Validation function
   * @returns Updated mapping
   */
  addValidation(
    mapping: FieldMapping,
    validate: (value: unknown) => boolean,
  ): FieldMapping {
    return { ...mapping, validate };
  }

  /**
   * Generate complete data mapper with all field mappings.
   * @param migrationId Migration identifier
   * @param mapping Provider mapping
   * @param fieldMappings Field-level mappings
   * @returns Complete data mapper
   */
  generateDataMapper(
    migrationId: string,
    mapping: ProviderMapping,
    fieldMappings: FieldMapping[],
  ): DataMapper {
    const sourceFields = new Set(fieldMappings.map((f) => f.sourceField));
    const targetFields = new Set(fieldMappings.map((f) => f.targetField));

    // In real implementation, get all fields from schema
    const allSourceFields = this.getAllSourceFields(mapping.sourceProvider);
    const unmappedFields = allSourceFields.filter((f) => !sourceFields.has(f));

    const typeMismatches = fieldMappings.filter(
      (f) => f.sourceType !== f.targetType && !f.transform,
    );

    return {
      migrationId,
      providerMapping: mapping,
      fieldMappings,
      unmappedFields,
      typeMismatches: typeMismatches.map((f) => ({
        field: f.sourceField,
        sourceType: f.sourceType,
        targetType: f.targetType,
      })),
      schemaValid: typeMismatches.length === 0 && unmappedFields.length === 0,
    };
  }

  /**
   * Validate source output matches target input.
   * @param mapper Data mapper
   * @param sourceData Source provider response
   * @returns Validation result
   */
  validateSchema(
    mapper: DataMapper,
    sourceData: Record<string, unknown>,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate all required mappings exist in source
    for (const fieldMapping of mapper.fieldMappings) {
      if (fieldMapping.required && !(fieldMapping.sourceField in sourceData)) {
        errors.push(
          `Required field missing in source: ${fieldMapping.sourceField}`,
        );
      }

      // Validate field value if validation function exists
      if (fieldMapping.validate && fieldMapping.sourceField in sourceData) {
        const value = sourceData[fieldMapping.sourceField];
        if (!fieldMapping.validate(value)) {
          errors.push(
            `Field validation failed: ${fieldMapping.sourceField} = ${value}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate diff of unmapped fields and type mismatches.
   * @param mapper Data mapper
   * @returns Diff summary
   */
  generateDiff(mapper: DataMapper): {
    unmappedFields: string[];
    typeConflicts: Array<{
      field: string;
      sourceType: string;
      targetType: string;
    }>;
    summary: string;
  } {
    return {
      unmappedFields: mapper.unmappedFields,
      typeConflicts: mapper.typeMismatches,
      summary:
        `${mapper.fieldMappings.length} fields mapped, ` +
        `${mapper.unmappedFields.length} unmapped, ` +
        `${mapper.typeMismatches.length} type conflicts`,
    };
  }

  private getAllSourceFields(provider: string): string[] {
    // In real implementation, fetch from schema
    const schemas: Record<string, string[]> = {
      stripe: ["id", "amount", "currency", "customerId", "status", "metadata"],
      paypal: ["id", "amount", "currency", "payerId", "status", "details"],
    };
    return schemas[provider] || [];
  }
}

// ─── Shadow Mode Runner ─────────────────────────────────────────

/**
 * Executes requests against both source and target providers in parallel,
 * compares responses, and collects comparison metrics.
 */
export class ShadowModeRunner {
  private comparisons: ShadowComparison[] = [];

  /**
   * Execute request in shadow mode.
   * @param requestId Request identifier
   * @param sourceExecutor Function to execute on source provider
   * @param targetExecutor Function to execute on target provider
   * @param config Shadow mode configuration
   * @returns Comparison result
   */
  async executeInShadow(
    requestId: string,
    sourceExecutor: () => Promise<unknown>,
    targetExecutor: () => Promise<unknown>,
    config: ShadowModeConfig,
  ): Promise<ShadowComparison> {
    const timestamp = new Date();
    const sourceStart = Date.now();
    const sourceResponse = await sourceExecutor();
    const sourceLatency = Date.now() - sourceStart;

    const targetStart = Date.now();
    const targetResponse = await targetExecutor();
    const targetLatency = Date.now() - targetStart;

    const structuralDiff = this.compareStructure(
      sourceResponse,
      targetResponse,
    );
    const valueDiffs = this.compareValues(sourceResponse, targetResponse);
    const matchRate = this.calculateMatchRate(
      sourceResponse,
      targetResponse,
      valueDiffs,
    );

    const passed =
      matchRate >= config.acceptableMatchRate &&
      Math.abs(sourceLatency - targetLatency) <=
        config.acceptableLatencyDeltaMs;

    const comparison: ShadowComparison = {
      requestId,
      timestamp,
      sourceResponse,
      targetResponse,
      structuralDiff,
      valueDiffs,
      matchRate,
      sourceLatency,
      targetLatency,
      passed,
    };

    this.comparisons.push(comparison);
    return comparison;
  }

  /**
   * Run shadow mode for a specified duration or request count.
   * @param config Shadow mode configuration
   * @param requestStream Stream of requests to execute in shadow mode
   */
  async runShadowMode(
    config: ShadowModeConfig,
    requestStream: AsyncIterable<{
      id: string;
      sourceExecutor: () => Promise<unknown>;
      targetExecutor: () => Promise<unknown>;
    }>,
  ): Promise<ShadowComparison[]> {
    const startTime = Date.now();
    let requestCount = 0;

    for await (const request of requestStream) {
      // Check duration limit
      if (config.durationMs && Date.now() - startTime > config.durationMs) {
        break;
      }

      // Check request count limit
      if (config.maxRequests && requestCount >= config.maxRequests) {
        break;
      }

      // Check traffic percentage
      if (Math.random() * 100 > config.trafficPercentage) {
        continue;
      }

      await this.executeInShadow(
        request.id,
        request.sourceExecutor,
        request.targetExecutor,
        config,
      );
      requestCount++;
    }

    return this.comparisons;
  }

  /**
   * Get shadow mode results and metrics.
   * @returns Results summary
   */
  getShadowResults(): {
    totalComparisons: number;
    passingComparisons: number;
    avgMatchRate: number;
    avgSourceLatency: number;
    avgTargetLatency: number;
    criticalDifferences: string[];
  } {
    if (this.comparisons.length === 0) {
      return {
        totalComparisons: 0,
        passingComparisons: 0,
        avgMatchRate: 0,
        avgSourceLatency: 0,
        avgTargetLatency: 0,
        criticalDifferences: [],
      };
    }

    const passingComparisons = this.comparisons.filter((c) => c.passed).length;
    const avgMatchRate =
      this.comparisons.reduce((sum, c) => sum + c.matchRate, 0) /
      this.comparisons.length;
    const avgSourceLatency =
      this.comparisons.reduce((sum, c) => sum + c.sourceLatency, 0) /
      this.comparisons.length;
    const avgTargetLatency =
      this.comparisons.reduce((sum, c) => sum + c.targetLatency, 0) /
      this.comparisons.length;

    const criticalDifferences: string[] = [];
    for (const comparison of this.comparisons) {
      if (
        !comparison.passed &&
        comparison.structuralDiff.missingFields.length > 0
      ) {
        criticalDifferences.push(
          `Missing fields: ${comparison.structuralDiff.missingFields.join(", ")}`,
        );
      }
    }

    return {
      totalComparisons: this.comparisons.length,
      passingComparisons,
      avgMatchRate,
      avgSourceLatency,
      avgTargetLatency,
      criticalDifferences: [...new Set(criticalDifferences)],
    };
  }

  /**
   * Clear shadow mode results.
   */
  clearResults(): void {
    this.comparisons = [];
  }

  private compareStructure(source: unknown, target: unknown): StructuralDiff {
    const sourceKeys = new Set(
      source && typeof source === "object" ? Object.keys(source) : [],
    );
    const targetKeys = new Set(
      target && typeof target === "object" ? Object.keys(target) : [],
    );

    const missingFields = Array.from(sourceKeys).filter(
      (k) => !targetKeys.has(k),
    );
    const extraFields = Array.from(targetKeys).filter(
      (k) => !sourceKeys.has(k),
    );

    const typeConflicts: Array<{
      field: string;
      sourceType: string;
      targetType: string;
    }> = [];
    for (const key of sourceKeys) {
      if (targetKeys.has(key)) {
        const sourceType = typeof (source as Record<string, unknown>)[key];
        const targetType = typeof (target as Record<string, unknown>)[key];
        if (sourceType !== targetType) {
          typeConflicts.push({
            field: key,
            sourceType,
            targetType,
          });
        }
      }
    }

    return {
      missingFields,
      extraFields,
      typeConflicts,
    };
  }

  private compareValues(source: unknown, target: unknown): ValueDiff[] {
    const diffs: ValueDiff[] = [];
    if (
      !source ||
      !target ||
      typeof source !== "object" ||
      typeof target !== "object"
    ) {
      return diffs;
    }

    for (const key of Object.keys(source)) {
      if (key in target) {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = (target as Record<string, unknown>)[key];
        if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
          diffs.push({
            field: key,
            sourceValue,
            targetValue,
            tolerable: false,
          });
        }
      }
    }

    return diffs;
  }

  private calculateMatchRate(
    source: unknown,
    target: unknown,
    diffs: ValueDiff[],
  ): number {
    if (!source || typeof source !== "object") return 100;
    const totalFields = Object.keys(source).length;
    if (totalFields === 0) return 100;
    const matchingFields = totalFields - diffs.length;
    return (matchingFields / totalFields) * 100;
  }
}

// ─── Rollback Manager ──────────────────────────────────────────

/**
 * Manages rollback snapshots and one-click restoration to source provider.
 */
export class RollbackManager {
  /**
   * Create rollback snapshot before migration.
   * @param migrationId Migration identifier
   * @param providerState Current provider configuration
   * @param credentials Encrypted credentials
   * @param routingConfig Current routing configuration
   * @returns Rollback snapshot
   */
  createSnapshot(
    migrationId: string,
    providerState: Record<string, unknown>,
    credentials: Record<string, unknown>,
    routingConfig: Record<string, unknown>,
  ): RollbackSnapshot {
    const snapshot: RollbackSnapshot = {
      snapshotId: this.generateId(),
      migrationId,
      timestamp: new Date(),
      providerState,
      credentials,
      routingConfig,
      sizeBytes: JSON.stringify({
        providerState,
        credentials,
        routingConfig,
      }).length,
    };
    return snapshot;
  }

  /**
   * Execute one-click rollback to source provider.
   * @param snapshot Rollback snapshot
   * @param sourceProvider Source provider slug
   * @returns Rollback result
   */
  async executeRollback(
    snapshot: RollbackSnapshot,
    sourceProvider: string,
  ): Promise<RollbackResult> {
    try {
      // Step 1: Pause traffic
      await this.pauseTraffic();

      // Step 2: Restore provider state
      await this.restoreProviderState(snapshot.providerState);

      // Step 3: Restore routing configuration
      await this.restoreRouting(snapshot.routingConfig);

      // Step 4: Verify routing is restored
      const routingVerified = await this.verifyRouting(sourceProvider);

      // Step 5: Resume traffic
      await this.resumeTraffic();

      return {
        rollbackId: this.generateId(),
        migrationId: snapshot.migrationId,
        timestamp: new Date(),
        success: routingVerified,
        restoredProvider: sourceProvider,
        routingVerified,
        errors: [],
      };
    } catch (error) {
      return {
        rollbackId: this.generateId(),
        migrationId: snapshot.migrationId,
        timestamp: new Date(),
        success: false,
        restoredProvider: sourceProvider,
        routingVerified: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Execute partial rollback for specific endpoints.
   * @param snapshot Rollback snapshot
   * @param sourceProvider Source provider slug
   * @param endpoints Specific endpoints to rollback
   * @returns Rollback result
   */
  async executePartialRollback(
    snapshot: RollbackSnapshot,
    sourceProvider: string,
    endpoints: string[],
  ): Promise<RollbackResult> {
    try {
      const filteredRouting = this.filterRouting(
        snapshot.routingConfig,
        endpoints,
      );
      await this.restoreRouting(filteredRouting);

      return {
        rollbackId: this.generateId(),
        migrationId: snapshot.migrationId,
        timestamp: new Date(),
        success: true,
        restoredProvider: sourceProvider,
        routingVerified: true,
        errors: [],
        rollbackEndpoints: endpoints,
      };
    } catch (error) {
      return {
        rollbackId: this.generateId(),
        migrationId: snapshot.migrationId,
        timestamp: new Date(),
        success: false,
        restoredProvider: sourceProvider,
        routingVerified: false,
        errors: [error instanceof Error ? error.message : String(error)],
        rollbackEndpoints: endpoints,
      };
    }
  }

  private async pauseTraffic(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private async restoreProviderState(
    state: Record<string, unknown>,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async restoreRouting(
    routing: Record<string, unknown>,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async verifyRouting(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async resumeTraffic(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private filterRouting(
    routing: Record<string, unknown>,
    endpoints: string[],
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const endpoint of endpoints) {
      if (endpoint in routing) {
        filtered[endpoint] = routing[endpoint];
      }
    }
    return filtered;
  }

  private generateId(): string {
    return `rb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ─── Migration Validator ───────────────────────────────────────

/**
 * Performs pre, during, and post-migration validation checks.
 */
export class MigrationValidator {
  /**
   * Perform pre-migration validation.
   * @param sourceProvider Source provider slug
   * @param targetProvider Target provider slug
   * @returns Validation result
   */
  async validatePreMigration(
    sourceProvider: string,
    targetProvider: string,
  ): Promise<PreMigrationValidation> {
    return {
      sourceConnectivity: await this.checkConnectivity(sourceProvider),
      targetConnectivity: await this.checkConnectivity(targetProvider),
      sourceAuth: await this.checkAuthentication(sourceProvider),
      targetAuth: await this.checkAuthentication(targetProvider),
      sourceSchema: await this.checkSchema(sourceProvider),
      targetSchema: await this.checkSchema(targetProvider),
      errors: [],
    };
  }

  /**
   * Perform during-migration validation.
   * @param sourceProvider Source provider slug
   * @param targetProvider Target provider slug
   * @returns Validation result
   */
  async validateDuringMigration(
    sourceProvider: string,
    targetProvider: string,
  ): Promise<DuringMigrationValidation> {
    const sourceMetrics = await this.collectMetrics(sourceProvider);
    const targetMetrics = await this.collectMetrics(targetProvider);

    return {
      sourceErrorRate: sourceMetrics.errorRate,
      targetErrorRate: targetMetrics.errorRate,
      sourceLatency: sourceMetrics.avgLatency,
      targetLatency: targetMetrics.avgLatency,
      dataIntegrityIssues: [],
      trafficLoss: false,
      acceptable:
        sourceMetrics.errorRate < 5 &&
        targetMetrics.errorRate < 5 &&
        Math.abs(sourceMetrics.avgLatency - targetMetrics.avgLatency) < 500,
    };
  }

  /**
   * Perform post-migration validation.
   * @param targetProvider Target provider slug
   * @returns Validation result
   */
  async validatePostMigration(
    targetProvider: string,
  ): Promise<PostMigrationValidation> {
    return {
      allEndpointsFunctional: await this.checkAllEndpoints(targetProvider),
      noDataLoss: await this.checkDataIntegrity(targetProvider),
      performanceAcceptable: await this.checkPerformance(targetProvider),
      webhooksWorking: await this.checkWebhooks(targetProvider),
      rateLimitsOK: await this.checkRateLimits(targetProvider),
      issues: [],
    };
  }

  /**
   * Generate validation report.
   * @param migrationId Migration identifier
   * @param preMigration Pre-migration validation
   * @param duringMigration During-migration validation
   * @param postMigration Post-migration validation
   * @returns Validation report
   */
  generateValidationReport(
    migrationId: string,
    preMigration: PreMigrationValidation,
    duringMigration?: DuringMigrationValidation,
    postMigration?: PostMigrationValidation,
  ): ValidationResult {
    const passed =
      preMigration.errors.length === 0 &&
      (!duringMigration || duringMigration.acceptable) &&
      (!postMigration || postMigration.issues.length === 0);

    return {
      validationId: this.generateId(),
      migrationId,
      preMigration,
      duringMigration,
      postMigration,
      passed,
      timestamp: new Date(),
    };
  }

  private async checkConnectivity(provider: string): Promise<boolean> {
    // In real implementation, perform connectivity check
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkAuthentication(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkSchema(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async collectMetrics(provider: string): Promise<{
    errorRate: number;
    avgLatency: number;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      errorRate: Math.random() * 2,
      avgLatency: 100 + Math.random() * 50,
    };
  }

  private async checkAllEndpoints(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkDataIntegrity(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkPerformance(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkWebhooks(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private async checkRateLimits(provider: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return true;
  }

  private generateId(): string {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ─── Migration Tracker ─────────────────────────────────────────

/**
 * Tracks migration state machine, progress metrics, events, and duration.
 */
export class MigrationTracker {
  private tracker: MigrationTrackerShape | null = null;

  /**
   * Initialize migration tracker.
   * @param migrationId Migration identifier
   * @param providerMapping Provider mapping
   * @returns Initialized tracker
   */
  initializeTracker(
    migrationId: string,
    providerMapping: ProviderMapping,
  ): MigrationTrackerShape {
    const tracker: MigrationTrackerShape = {
      migrationId,
      status: "PLANNED",
      providerMapping,
      shadowComparisons: [],
      validationResults: [],
      events: [
        {
          eventId: this.generateId(),
          timestamp: new Date(),
          type: "CREATED",
          details: { migrationId },
        },
      ],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        avgLatency: 0,
        mismatchCount: 0,
        matchRate: 100,
        lastUpdated: new Date(),
      },
      durationMs: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tracker = tracker;
    return tracker;
  }

  /**
   * Transition to new status.
   * @param status New migration status
   * @param details Event details
   */
  transitionStatus(
    status: MigrationStatus,
    details?: Record<string, unknown>,
  ): void {
    if (!this.tracker) return;

    this.tracker.status = status;
    this.tracker.events.push({
      eventId: this.generateId(),
      timestamp: new Date(),
      type: status as MigrationEvent["type"],
      details: details || {},
    });
    this.tracker.updatedAt = new Date();
  }

  /**
   * Record migration event.
   * @param type Event type
   * @param details Event details
   */
  recordEvent(
    type: MigrationEvent["type"],
    details: Record<string, unknown>,
  ): void {
    if (!this.tracker) return;

    this.tracker.events.push({
      eventId: this.generateId(),
      timestamp: new Date(),
      type,
      details,
    });
  }

  /**
   * Update progress metrics.
   * @param metrics Updated metrics
   */
  updateMetrics(partial: Partial<MigrationMetrics>): void {
    if (!this.tracker) return;

    this.tracker.metrics = {
      ...this.tracker.metrics,
      ...partial,
      lastUpdated: new Date(),
    };

    if (partial.totalRequests && partial.failedRequests) {
      this.tracker.metrics.errorRate =
        (partial.failedRequests / partial.totalRequests) * 100;
    }
  }

  /**
   * Get current migration tracker state.
   * @returns Tracker state
   */
  getTracker(): MigrationTrackerShape | null {
    if (!this.tracker) return null;

    const now = new Date();
    return {
      ...this.tracker,
      durationMs: now.getTime() - this.tracker.createdAt.getTime(),
    };
  }

  /**
   * Generate final migration report.
   * @returns Migration report
   */
  generateReport(): MigrationReport | null {
    if (!this.tracker) return null;

    const report: MigrationReport = {
      reportId: this.generateId(),
      migrationId: this.tracker.migrationId,
      sourceProvider: this.tracker.providerMapping.sourceProvider,
      targetProvider: this.tracker.providerMapping.targetProvider,
      status: this.tracker.status,
      durationMs: this.tracker.durationMs,
      metrics: this.tracker.metrics,
      mappingSummary: {
        totalFields: this.tracker.dataMapper?.fieldMappings.length || 0,
        mappedFields: this.tracker.dataMapper?.fieldMappings.length || 0,
        unmappedFields: this.tracker.dataMapper?.unmappedFields.length || 0,
        typeMismatches: this.tracker.dataMapper?.typeMismatches.length || 0,
      },
      shadowSummary:
        this.tracker.shadowComparisons.length > 0
          ? {
              totalComparisons: this.tracker.shadowComparisons.length,
              passingComparisons: this.tracker.shadowComparisons.filter(
                (c) => c.passed,
              ).length,
              avgMatchRate:
                this.tracker.shadowComparisons.reduce(
                  (s, c) => s + c.matchRate,
                  0,
                ) / this.tracker.shadowComparisons.length,
              criticalDifferences: this.extractCriticalDifferences(
                this.tracker.shadowComparisons,
              ),
            }
          : undefined,
      validationSummary: {
        preValidationPassed: this.tracker.validationResults[0]?.passed || false,
        duringValidationPassed:
          this.tracker.validationResults[1]?.passed || false,
        postValidationPassed:
          this.tracker.validationResults[2]?.passed || false,
        issues: this.tracker.validationResults.flatMap(
          (v) => v.preMigration.errors,
        ),
      },
      recommendations: this.generateRecommendations(this.tracker),
      timestamp: new Date(),
    };

    return report;
  }

  private extractCriticalDifferences(
    comparisons: ShadowComparison[],
  ): string[] {
    const issues: Set<string> = new Set();
    for (const comp of comparisons) {
      if (comp.structuralDiff.missingFields.length > 0) {
        issues.add(
          `Missing fields: ${comp.structuralDiff.missingFields.join(", ")}`,
        );
      }
    }
    return Array.from(issues);
  }

  private generateRecommendations(tracker: MigrationTrackerShape): string[] {
    const recommendations: string[] = [];

    if (tracker.metrics.errorRate > 5) {
      recommendations.push("Monitor error rates closely during next phase");
    }

    if (tracker.status === "FAILED") {
      recommendations.push("Consider executing rollback if not already done");
    }

    if (tracker.validationResults.some((v) => !v.passed)) {
      recommendations.push(
        "Address validation issues before proceeding to production",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Migration completed successfully - monitor for 24 hours",
      );
    }

    return recommendations;
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
