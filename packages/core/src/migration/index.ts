/**
 * Migration module
 * Export all migration types, mappers, and runners
 */

export type {
  MigrationConfig,
  FieldTransform,
  CollectionMapping,
  MigrationProgress,
  MigrationReport,
  ValidationError,
  RecordValidationResult,
  DataSource,
  DataTarget,
} from "./types.js";

export { ConflictResolutionStrategy } from "./types.js";

export { DataMapper, BuiltInTransformers, DefaultMappings } from "./mapper.js";
export { MigrationRunner } from "./runner.js";
export { MigrationRunnerV2 } from "./migration-runner-v2.js";
export { MongoDBAdapter } from "./mongodb-adapter.js";
export {
  transformOrder,
  transformShipment,
  transformDriver,
  transformCustomer,
  transformProduct,
  transformZone,
  transformRoute,
  transformers,
} from "./transformers.js";

export default {
  DataMapper,
  MigrationRunner,
  MigrationRunnerV2,
  MongoDBAdapter,
  transformers,
};
