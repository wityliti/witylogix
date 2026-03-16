/**
 * @witylogix/db — Configuration exports
 *
 * Barrel export for all database configuration modules:
 * - Connection pool management (PgBouncer-compatible)
 * - Read replica routing with health checks
 * - Zero-downtime migration strategy
 * - Backup and disaster recovery services
 */

export { createPoolConfig, validatePoolConfig, createHealthCheckFn, createLifecycleHooks } from "./connection-pool";
export type { PoolConfig } from "./connection-pool";

export { ReadReplicaRouter, createReplicaRouter } from "./read-replica";
export type { ReplicaConfig } from "./read-replica";

export { MigrationManager, createMigrationManager } from "./migration-strategy";
export type { MigrationStatus, MigrationRecord } from "./migration-strategy";

export { BackupService, createBackupService } from "./backup-service";
export type { BackupType, BackupStatus, BackupMetadata, BackupServiceConfig } from "./backup-service";
