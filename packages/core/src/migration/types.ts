/**
 * Migration Types
 * MongoDB → PostgreSQL migration toolkit
 */

/**
 * Migration configuration
 */
export interface MigrationConfig {
  mongoUri: string;
  postgresUri: string;
  batchSize?: number;
  dryRun?: boolean;
  collections: CollectionMapping[];
  validateBeforeMigration?: boolean;
  stopOnError?: boolean;
}

/**
 * Field transformation function
 */
export type FieldTransformer = (
  value: any,
  sourceDoc: any,
  context?: any
) => any;

/**
 * Field mapping and transformation
 */
export interface FieldTransform {
  sourceField: string;
  targetField: string;
  transformer?: FieldTransformer;
  optional?: boolean;
}

/**
 * Collection mapping configuration
 */
export interface CollectionMapping {
  mongoCollection: string;
  prismaModel: string;
  fieldMap: FieldTransform[];
  transforms?: FieldTransformer[];
  skipFields?: string[];
  defaultValues?: Record<string, any>;
  relationMap?: Record<string, { field: string; target: string }>;
  preProcess?: (doc: any) => any;
  postProcess?: (record: any) => any;
}

/**
 * Migration progress tracking
 */
export interface MigrationProgress {
  collection: string;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{
    rowIndex: number;
    error: string;
    document?: any;
  }>;
  startedAt: Date;
  eta?: Date;
  durationMs?: number;
}

/**
 * Migration report
 */
export interface MigrationReport {
  success: boolean;
  summary: {
    totalCollections: number;
    collectionsProcessed: number;
    totalRecords: number;
    totalProcessed: number;
    totalFailed: number;
    totalSkipped: number;
  };
  collections: Array<MigrationProgress>;
  errors: Array<{
    collection: string;
    error: string;
    fatal?: boolean;
  }>;
  warnings: Array<{
    collection: string;
    warning: string;
  }>;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  dryRun: boolean;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  value: any;
  error: string;
}

/**
 * Record validation result
 */
export interface RecordValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolutionStrategy {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
  MERGE = 'merge',
  ERROR = 'error',
}

/**
 * Data source interface
 */
export interface DataSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getCollection(name: string): any;
  query(collection: string, filter?: any): AsyncIterableIterator<any>;
}

/**
 * Data target interface
 */
export interface DataTarget {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createRecord(model: string, data: any): Promise<any>;
  updateRecord(model: string, id: any, data: any): Promise<any>;
  getRecord(model: string, id: any): Promise<any>;
  checkExists(model: string, uniqueField: string, value: any): Promise<boolean>;
}
