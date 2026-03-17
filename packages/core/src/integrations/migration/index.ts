/**
 * Migration Toolkit and API — Main entry point for provider migration operations.
 */

export {
  ProviderSwapEngine,
  DataMapperService,
  ShadowModeRunner,
  RollbackManager,
  MigrationValidator,
  MigrationTracker,
} from "./migration-toolkit";

export type {
  DataMapper,
  FieldMapping,
  MigrationEvent,
  MigrationMetrics,
  MigrationReport,
  MigrationStatus,
  MigrationTracker as MigrationTrackerType,
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

export { createMigrationAPI } from "./migration-api";
