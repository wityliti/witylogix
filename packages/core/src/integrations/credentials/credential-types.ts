/**
 * Credential Lifecycle Manager — Type definitions
 *
 * Comprehensive type system for credential management including:
 * - Credential storage and rotation
 * - Health scoring and compliance
 * - Secret scanning and remediation
 * - Vault configuration and management
 */

/**
 * Credential type enumeration
 */
export type CredentialType =
  | 'api_key'
  | 'oauth_token'
  | 'jwt'
  | 'certificate'
  | 'ssh_key'
  | 'password'
  | 'connection_string'
  | 'webhook_secret'
  | 'custom';

/**
 * Credential severity levels
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Rotation schedule frequency
 */
export type RotationFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'manual';

/**
 * Rotation status enumeration
 */
export type RotationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

/**
 * Rotation trigger type
 */
export type RotationTrigger = 'scheduled' | 'breach_detected' | 'team_change' | 'manual' | 'compliance';

/**
 * Credential entry in vault
 */
export interface Credential {
  id: string;
  tenantId: string;
  providerId: string;
  credentialType: CredentialType;
  displayName: string;
  description?: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyVersion: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Rotation policy for credentials
 */
export interface RotationPolicy {
  credentialId: string;
  providerId: string;
  rotationFrequency: RotationFrequency;
  rotationSchedule?: RotationSchedule;
  eventTriggers?: RotationTrigger[];
  maintenanceWindow?: MaintenanceWindow;
  preRotationValidation?: boolean;
  postRotationVerification?: boolean;
  maxConcurrentRotations?: number;
  enableZeroDowntime?: boolean;
  autoRollbackOnFailure?: boolean;
  notifyOnRotation?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rotation schedule configuration
 */
export interface RotationSchedule {
  frequency: RotationFrequency;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  month?: number; // 1-12
  hour?: number; // 0-23
  minute?: number; // 0-59
  timezone?: string; // IANA timezone
  nextRotationAt?: Date;
  lastRotationAt?: Date;
}

/**
 * Maintenance window for rotations
 */
export interface MaintenanceWindow {
  startHour: number; // 0-23
  endHour: number; // 0-23
  daysOfWeek?: number[]; // 0-6
  timezone: string;
}

/**
 * Result of credential rotation
 */
export interface RotationResult {
  credentialId: string;
  providerId: string;
  rotationId: string;
  status: RotationStatus;
  trigger: RotationTrigger;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  oldCredentialId?: string;
  newCredentialId?: string;
  trafficShiftPercentage?: number; // For zero-downtime rotation
  errorMessage?: string;
  rollbackReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Secret scan finding
 */
export interface SecretScanFinding {
  id: string;
  tenantId: string;
  scanId: string;
  scanType: 'regex' | 'entropy' | 'file_scan';
  severity: Severity;
  pattern: string;
  patternName: string;
  location: {
    filePath: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  matchedText: string;
  entropy?: number; // Shannon entropy score
  context?: string; // surrounding code
  detectedAt: Date;
  remediationStatus: 'pending' | 'remediated' | 'false_positive' | 'ignored';
  remediationDetails?: {
    action: 'rotated' | 'removed' | 'marked_false_positive' | 'ignored';
    executedAt: Date;
    executedBy: string;
    comment?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Scan result summary
 */
export interface ScanResult {
  id: string;
  tenantId: string;
  scanType: 'regex' | 'entropy' | 'file_scan' | 'full';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  filesScanned: number;
  secretsFound: number;
  findings: SecretScanFinding[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Credential health score
 */
export interface CredentialHealth {
  credentialId: string;
  providerId: string;
  overallScore: number; // 0-100
  ageScore: number; // 0-100 (newer = higher)
  exposureScore: number; // 0-100 (no exposures = higher)
  complianceScore: number; // 0-100 (on-schedule = higher)
  usageScore: number; // 0-100 (regularly used = higher)
  lastRotationDays: number;
  scanFindingsCount: number;
  rotationStatus: RotationStatus;
  nextRotationDue?: Date;
  riskAssessment: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  calculatedAt: Date;
}

/**
 * Vault configuration
 */
export interface VaultConfig {
  tenantId: string;
  vaultType: 'local' | 'aws_secrets_manager' | 'hashicorp_vault' | 'azure_keyvault';
  endpoint?: string;
  region?: string;
  authMethod?: 'bearer_token' | 'api_key' | 'msal' | 'local';
  encryptionKeyId?: string;
  enableAutoBackup?: boolean;
  backupFrequency?: 'hourly' | 'daily' | 'weekly';
  failoverVaults?: VaultConfig[];
  consistencyCheckInterval?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Vault health status
 */
export interface VaultStatus {
  vaultType: string;
  healthy: boolean;
  lastHealthCheckAt: Date;
  responseTimeMs: number;
  credentialsCount: number;
  storageUsedBytes?: number;
  nextBackupAt?: Date;
  errors?: string[];
}

/**
 * Scan pattern definition
 */
export interface ScanPattern {
  id: string;
  name: string;
  category: string; // 'api_key', 'token', 'password', etc.
  regex: RegExp;
  severity: Severity;
  entropy?: {
    enabled: boolean;
    minimumScore: number; // Shannon entropy threshold
  };
  falsePositivePatterns?: RegExp[];
}

/**
 * Rotation metric
 */
export interface RotationMetric {
  credentialId: string;
  providerId: string;
  totalRotations: number;
  successfulRotations: number;
  failedRotations: number;
  averageDurationMs: number;
  lastRotationDurationMs: number;
  successRate: number; // percentage
  lastRotationAt: Date;
  nextRotationAt?: Date;
}

/**
 * Traffic shift configuration for zero-downtime rotation
 */
export interface TrafficShiftConfig {
  stages: Array<{
    percentage: number;
    durationMs: number;
  }>;
  rollbackThreshold: number; // error rate % to trigger rollback
  healthCheckIntervalMs: number;
  maxConcurrentShifts: number;
}

/**
 * Provider-specific rotation flow
 */
export interface ProviderRotationFlow {
  providerId: string;
  credentialType: CredentialType;
  rotationType: 'regenerate' | 'refresh' | 'renewal' | 'custom';
  preValidationSteps?: Array<{
    name: string;
    endpoint: string;
    expectedStatusCode: number;
  }>;
  rotationSteps: Array<{
    name: string;
    action: 'call_provider_api' | 'validate_token' | 'update_vault' | 'notify_service';
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    timeout?: number;
  }>;
  postValidationSteps?: Array<{
    name: string;
    endpoint: string;
    expectedStatusCode: number;
  }>;
  rollbackSteps?: Array<{
    name: string;
    action: string;
  }>;
}
