/**
 * Migration Runner
 * Orchestrates the migration process with validation and progress tracking
 */

import {
  MigrationConfig,
  MigrationReport,
  MigrationProgress,
  CollectionMapping,
  RecordValidationResult,
  ValidationError,
  ConflictResolutionStrategy,
} from './types.js';
import { DataMapper } from './mapper.js';

/**
 * MigrationRunner: Execute migrations with validation and error handling
 */
export class MigrationRunner {
  private mapper: DataMapper;
  private config: MigrationConfig;
  private startTime: Date = new Date();

  constructor(config: MigrationConfig) {
    this.config = {
      batchSize: 100,
      dryRun: false,
      validateBeforeMigration: true,
      stopOnError: false,
      ...config,
    };
    this.mapper = new DataMapper();
  }

  /**
   * Run the complete migration
   */
  async run(
    source: any,
    target: any
  ): Promise<MigrationReport> {
    const startedAt = new Date();
    const collectionReports: MigrationProgress[] = [];
    const errors: Array<{ collection: string; error: string; fatal?: boolean }> =
      [];
    const warnings: Array<{ collection: string; warning: string }> = [];

    let totalRecords = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    try {
      // Connect to source and target
      await source.connect();
      await target.connect();

      // Process each collection
      for (const collectionMapping of this.config.collections) {
        try {
          const progress = await this.migrateCollection(
            collectionMapping,
            source,
            target,
            this.config.batchSize || 100
          );

          collectionReports.push(progress);

          totalRecords += progress.total;
          totalProcessed += progress.processed;
          totalFailed += progress.failed;
          totalSkipped += progress.skipped;

          // Stop on error if configured
          if (
            progress.failed > 0 &&
            this.config.stopOnError
          ) {
            throw new Error(
              `Migration stopped: ${progress.failed} records failed in ${collectionMapping.mongoCollection}`
            );
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({
            collection: collectionMapping.mongoCollection,
            error: errorMsg,
            fatal: this.config.stopOnError,
          });

          if (this.config.stopOnError) {
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({
        collection: 'MIGRATION',
        error: errorMsg,
        fatal: true,
      });
    } finally {
      // Disconnect from source and target
      try {
        await source.disconnect();
        await target.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    return {
      success: errors.filter((e) => e.fatal).length === 0,
      summary: {
        totalCollections: this.config.collections.length,
        collectionsProcessed: collectionReports.length,
        totalRecords,
        totalProcessed,
        totalFailed,
        totalSkipped,
      },
      collections: collectionReports,
      errors,
      warnings,
      startedAt,
      completedAt,
      durationMs,
      dryRun: this.config.dryRun || false,
    };
  }

  /**
   * Migrate a single collection
   */
  async migrateCollection(
    mapping: CollectionMapping,
    source: any,
    target: any,
    batchSize: number
  ): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      collection: mapping.mongoCollection,
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startedAt: new Date(),
    };

    const sourceCollection = source.getCollection(mapping.mongoCollection);
    let batchCount = 0;
    let processedInBatch = 0;

    try {
      // Query source collection
      for await (const document of source.query(mapping.mongoCollection)) {
        progress.total++;

        try {
          // Pre-process if configured
          let doc = document;
          if (mapping.preProcess) {
            doc = mapping.preProcess(doc);
          }

          // Map document
          const record = this.mapper.mapDocument(doc, mapping);

          // Validate record if configured
          if (this.config.validateBeforeMigration) {
            const validation = this.validateRecord(record, mapping);
            if (!validation.valid) {
              progress.failed++;
              progress.errors.push({
                rowIndex: progress.total,
                error: validation.errors.map((e) => e.error).join('; '),
                document: doc,
              });
              continue;
            }
          }

          // Write record if not in dry-run mode
          if (!this.config.dryRun) {
            try {
              await target.createRecord(mapping.prismaModel, record);
            } catch (error) {
              // Check if conflict exists
              if (
                error instanceof Error &&
                error.message.includes('Unique constraint')
              ) {
                // Handle conflict based on strategy
                const handled = await this.handleConflict(
                  record,
                  mapping,
                  target,
                  ConflictResolutionStrategy.SKIP
                );
                if (!handled) {
                  progress.failed++;
                  progress.errors.push({
                    rowIndex: progress.total,
                    error: `Conflict: ${error.message}`,
                    document: doc,
                  });
                  continue;
                }
              } else {
                progress.failed++;
                progress.errors.push({
                  rowIndex: progress.total,
                  error: error instanceof Error ? error.message : String(error),
                  document: doc,
                });
                continue;
              }
            }
          }

          progress.processed++;
          processedInBatch++;

          // Calculate ETA
          if (processedInBatch % 10 === 0) {
            progress.eta = this.calculateETA(
              progress.startedAt,
              progress.processed,
              progress.total
            );
          }
        } catch (error) {
          progress.failed++;
          progress.errors.push({
            rowIndex: progress.total,
            error: error instanceof Error ? error.message : String(error),
            document,
          });
        }

        // Process in batches
        processedInBatch++;
        if (processedInBatch >= batchSize) {
          batchCount++;
          processedInBatch = 0;
        }
      }

      progress.durationMs =
        new Date().getTime() - progress.startedAt.getTime();
    } catch (error) {
      throw new Error(
        `Failed to migrate collection ${mapping.mongoCollection}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return progress;
  }

  /**
   * Validate a record against the model schema
   */
  validateRecord(
    record: any,
    mapping: CollectionMapping
  ): RecordValidationResult {
    const errors: ValidationError[] = [];

    // Check for required fields based on field map
    for (const fieldTransform of mapping.fieldMap) {
      const value = record[fieldTransform.targetField];

      // Check if required (non-optional)
      if (!fieldTransform.optional) {
        if (value === undefined || value === null) {
          // Allow if there's a default value
          if (!mapping.defaultValues?.[fieldTransform.targetField]) {
            errors.push({
              field: fieldTransform.targetField,
              value,
              error: `Required field is missing`,
            });
          }
        }
      }

      // Basic type validation
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && value.length === 0) {
          // Check if empty string is allowed
          if (fieldTransform.targetField.includes('Date')) {
            errors.push({
              field: fieldTransform.targetField,
              value,
              error: `Date field cannot be empty`,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Handle conflicts when record already exists
   */
  async handleConflict(
    record: any,
    mapping: CollectionMapping,
    target: any,
    strategy: ConflictResolutionStrategy
  ): Promise<boolean> {
    switch (strategy) {
      case ConflictResolutionStrategy.SKIP:
        return true; // Silently skip

      case ConflictResolutionStrategy.OVERWRITE:
        // Update existing record
        try {
          await target.updateRecord(
            mapping.prismaModel,
            record.id,
            record
          );
          return true;
        } catch (e) {
          return false;
        }

      case ConflictResolutionStrategy.MERGE:
        // Fetch existing and merge
        try {
          const existing = await target.getRecord(
            mapping.prismaModel,
            record.id
          );
          const merged = { ...existing, ...record };
          await target.updateRecord(
            mapping.prismaModel,
            record.id,
            merged
          );
          return true;
        } catch (e) {
          return false;
        }

      case ConflictResolutionStrategy.ERROR:
        return false;

      default:
        return false;
    }
  }

  /**
   * Calculate estimated time of arrival
   */
  private calculateETA(
    startTime: Date,
    processed: number,
    total: number
  ): Date {
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const rate = processed / elapsed; // records per millisecond
    const remaining = total - processed;
    const estimatedRemainingMs = remaining / rate;

    return new Date(now.getTime() + estimatedRemainingMs);
  }
}

export default MigrationRunner;
