/**
 * Migration Toolkit — Type definitions for provider migration operations.
 *
 * Defines the core types for managing migrations between integration providers,
 * including state machines, validation, shadow mode, rollback, and progress tracking.
 */

// ─── Migration State Machine ─────────────────────────────────────

/** Migration lifecycle states. */
export type MigrationStatus =
  | "PLANNED"
  | "MAPPING"
  | "SHADOW"
  | "CUTOVER"
  | "COMPLETED"
  | "ROLLED_BACK"
  | "FAILED";

// ─── Provider Swap Configuration ─────────────────────────────────

/** Mapping between a source and target provider for migration. */
export interface ProviderMapping {
  /** Unique migration identifier. */
  migrationId: string;
  /** Source provider slug (e.g., "stripe", "paypal"). */
  sourceProvider: string;
  /** Target provider slug. */
  targetProvider: string;
  /** Whether the target provider is already configured. */
  targetConfigured: boolean;
  /** Prerequisite validation status. */
  prerequisitesValid: boolean;
  /** Timestamp when mapping was created. */
  createdAt: Date;
}

// ─── Field-Level Data Mapping ───────────────────────────────────

/** Function to transform field values from source to target format. */
export type TransformFunction = (
  value: unknown,
  sourceContext?: Record<string, unknown>,
  targetContext?: Record<string, unknown>
) => unknown;

/** Mapping configuration for a single field between schemas. */
export interface FieldMapping {
  /** Source field name/path. */
  sourceField: string;
  /** Target field name/path. */
  targetField: string;
  /** Source field data type. */
  sourceType: string;
  /** Target field data type. */
  targetType: string;
  /** Optional transformation function. */
  transform?: TransformFunction;
  /** Whether this field is required in the target. */
  required: boolean;
  /** Custom validation logic. */
  validate?: (value: unknown) => boolean;
}

/** Complete schema mapping between source and target providers. */
export interface DataMapper {
  /** Unique migration identifier. */
  migrationId: string;
  /** Provider mapping reference. */
  providerMapping: ProviderMapping;
  /** Field-level mappings (array of field configurations). */
  fieldMappings: FieldMapping[];
  /** Unmapped source fields (names of fields with no target mapping). */
  unmappedFields: string[];
  /** Fields with type mismatches. */
  typeMismatches: Array<{
    field: string;
    sourceType: string;
    targetType: string;
  }>;
  /** Schema validation status. */
  schemaValid: boolean;
}

// ─── Shadow Mode Execution ──────────────────────────────────────

/** Structural comparison between source and target responses. */
export interface StructuralDiff {
  /** Missing fields in target response. */
  missingFields: string[];
  /** Extra fields in target response. */
  extraFields: string[];
  /** Fields with different data types. */
  typeConflicts: Array<{
    field: string;
    sourceType: string;
    targetType: string;
  }>;
}

/** Value-level comparison between source and target responses. */
export interface ValueDiff {
  /** Field path that differs. */
  field: string;
  /** Value from source provider. */
  sourceValue: unknown;
  /** Value from target provider. */
  targetValue: unknown;
  /** Whether the difference is tolerable (based on transform logic). */
  tolerable: boolean;
}

/** Results from a single shadow mode comparison. */
export interface ShadowComparison {
  /** Request that was executed in shadow mode. */
  requestId: string;
  /** Timestamp of the comparison. */
  timestamp: Date;
  /** Response from source provider. */
  sourceResponse: unknown;
  /** Response from target provider. */
  targetResponse: unknown;
  /** Structural differences detected. */
  structuralDiff: StructuralDiff;
  /** Value-level differences detected. */
  valueDiffs: ValueDiff[];
  /** Match percentage (0-100). */
  matchRate: number;
  /** Latency of source provider (ms). */
  sourceLatency: number;
  /** Latency of target provider (ms). */
  targetLatency: number;
  /** Whether this comparison passed acceptable thresholds. */
  passed: boolean;
}

/** Configuration for running shadow mode. */
export interface ShadowModeConfig {
  /** Percentage of traffic to run in shadow mode (0-100). */
  trafficPercentage: number;
  /** Total duration to run shadow mode (ms). */
  durationMs?: number;
  /** Maximum number of requests to shadow. */
  maxRequests?: number;
  /** Acceptable match rate threshold (0-100). */
  acceptableMatchRate: number;
  /** Acceptable latency delta (ms) between source and target. */
  acceptableLatencyDeltaMs: number;
}

// ─── Rollback Management ────────────────────────────────────────

/** Snapshot of provider state before migration. */
export interface RollbackSnapshot {
  /** Snapshot identifier. */
  snapshotId: string;
  /** Migration that created this snapshot. */
  migrationId: string;
  /** Timestamp when snapshot was taken. */
  timestamp: Date;
  /** Current provider configuration and state. */
  providerState: Record<string, unknown>;
  /** Current credentials and secrets (encrypted). */
  credentials: Record<string, unknown>;
  /** Currently routed endpoints and their configuration. */
  routingConfig: Record<string, unknown>;
  /** Size of snapshot (bytes). */
  sizeBytes: number;
}

/** Result of a rollback operation. */
export interface RollbackResult {
  /** Rollback identifier. */
  rollbackId: string;
  /** Migration being rolled back. */
  migrationId: string;
  /** Timestamp of rollback. */
  timestamp: Date;
  /** Whether rollback succeeded. */
  success: boolean;
  /** Provider that was restored. */
  restoredProvider: string;
  /** Verification status (routing restored correctly). */
  routingVerified: boolean;
  /** Any errors encountered during rollback. */
  errors: string[];
  /** Endpoints that were rolled back (for partial rollbacks). */
  rollbackEndpoints?: string[];
}

// ─── Migration Validation ───────────────────────────────────────

/** Pre-migration validation checks. */
export interface PreMigrationValidation {
  /** Source provider connectivity verified. */
  sourceConnectivity: boolean;
  /** Target provider connectivity verified. */
  targetConnectivity: boolean;
  /** Source provider authentication valid. */
  sourceAuth: boolean;
  /** Target provider authentication valid. */
  targetAuth: boolean;
  /** Source schema can be read. */
  sourceSchema: boolean;
  /** Target schema matches requirements. */
  targetSchema: boolean;
  /** Any errors found. */
  errors: string[];
}

/** During-migration validation checks. */
export interface DuringMigrationValidation {
  /** Error rate from source provider (%). */
  sourceErrorRate: number;
  /** Error rate from target provider (%). */
  targetErrorRate: number;
  /** Average latency of source provider (ms). */
  sourceLatency: number;
  /** Average latency of target provider (ms). */
  targetLatency: number;
  /** Data integrity issues detected. */
  dataIntegrityIssues: string[];
  /** Traffic loss detected. */
  trafficLoss: boolean;
  /** Acceptable status. */
  acceptable: boolean;
}

/** Post-migration validation checks. */
export interface PostMigrationValidation {
  /** All endpoints functioning correctly. */
  allEndpointsFunctional: boolean;
  /** No data loss detected. */
  noDataLoss: boolean;
  /** Performance meets baseline. */
  performanceAcceptable: boolean;
  /** Webhooks functioning. */
  webhooksWorking: boolean;
  /** Rate limits not exceeded. */
  rateLimitsOK: boolean;
  /** Any issues found. */
  issues: string[];
}

/** Complete validation result for migration. */
export interface ValidationResult {
  /** Validation identifier. */
  validationId: string;
  /** Migration being validated. */
  migrationId: string;
  /** Pre-migration validation. */
  preMigration: PreMigrationValidation;
  /** During-migration validation (if applicable). */
  duringMigration?: DuringMigrationValidation;
  /** Post-migration validation (if applicable). */
  postMigration?: PostMigrationValidation;
  /** Overall validation passed. */
  passed: boolean;
  /** Timestamp of validation. */
  timestamp: Date;
}

// ─── Migration Progress Tracking ────────────────────────────────

/** Event in migration timeline. */
export interface MigrationEvent {
  /** Event identifier. */
  eventId: string;
  /** Event timestamp. */
  timestamp: Date;
  /** Event type. */
  type:
    | "CREATED"
    | "MAPPING_STARTED"
    | "MAPPING_COMPLETED"
    | "SHADOW_STARTED"
    | "SHADOW_STOPPED"
    | "SHADOW_COMPLETED"
    | "VALIDATION_COMPLETED"
    | "CUTOVER_STARTED"
    | "CUTOVER_COMPLETED"
    | "ROLLBACK_INITIATED"
    | "ROLLBACK_COMPLETED"
    | "FAILED";
  /** Event details/metadata. */
  details: Record<string, unknown>;
}

/** Progress metrics during migration. */
export interface MigrationMetrics {
  /** Total requests processed. */
  totalRequests: number;
  /** Successful requests. */
  successfulRequests: number;
  /** Failed requests. */
  failedRequests: number;
  /** Error rate (%). */
  errorRate: number;
  /** Average latency (ms). */
  avgLatency: number;
  /** Data mismatch count (shadow mode). */
  mismatchCount: number;
  /** Match rate (%). */
  matchRate: number;
  /** Timestamp of last update. */
  lastUpdated: Date;
}

/** Migration tracker state and progress. */
export interface MigrationTracker {
  /** Migration identifier. */
  migrationId: string;
  /** Current migration status. */
  status: MigrationStatus;
  /** Provider mapping. */
  providerMapping: ProviderMapping;
  /** Data mapper configuration. */
  dataMapper?: DataMapper;
  /** Shadow mode results. */
  shadowComparisons: ShadowComparison[];
  /** Rollback snapshot. */
  rollbackSnapshot?: RollbackSnapshot;
  /** Validation results. */
  validationResults: ValidationResult[];
  /** Event log. */
  events: MigrationEvent[];
  /** Progress metrics. */
  metrics: MigrationMetrics;
  /** Total duration (ms). */
  durationMs: number;
  /** Created timestamp. */
  createdAt: Date;
  /** Updated timestamp. */
  updatedAt: Date;
  /** Completed timestamp (if applicable). */
  completedAt?: Date;
}

// ─── Migration Report ──────────────────────────────────────────

/** Complete migration report. */
export interface MigrationReport {
  /** Report identifier. */
  reportId: string;
  /** Migration being reported on. */
  migrationId: string;
  /** Source provider. */
  sourceProvider: string;
  /** Target provider. */
  targetProvider: string;
  /** Final migration status. */
  status: MigrationStatus;
  /** Total duration (ms). */
  durationMs: number;
  /** Summary metrics. */
  metrics: MigrationMetrics;
  /** Data mapping summary. */
  mappingSummary: {
    totalFields: number;
    mappedFields: number;
    unmappedFields: number;
    typeMismatches: number;
  };
  /** Shadow mode summary. */
  shadowSummary?: {
    totalComparisons: number;
    passingComparisons: number;
    avgMatchRate: number;
    criticalDifferences: string[];
  };
  /** Validation summary. */
  validationSummary: {
    preValidationPassed: boolean;
    duringValidationPassed: boolean;
    postValidationPassed: boolean;
    issues: string[];
  };
  /** Recommendations for next steps. */
  recommendations: string[];
  /** Generated timestamp. */
  timestamp: Date;
}
