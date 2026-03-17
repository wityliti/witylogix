/**
 * Integration Testing & Chaos Engineering — Type Definitions
 * Provides types for the Integration Test Harness and Chaos Testing Engine
 */

// ─── Mock Server Configuration ───────────────────────────────────

export interface MockServerConfig {
  /** Unique identifier for the mock server instance. */
  id: string;
  /** Provider name this mock server simulates (e.g., "stripe", "shopify"). */
  provider: string;
  /** Port to listen on. */
  port: number;
  /** Default response status code. */
  defaultStatus?: number;
  /** Default response headers. */
  defaultHeaders?: Record<string, string>;
  /** Enable request logging. */
  logRequests?: boolean;
  /** Request recording enabled. */
  recordRequests?: boolean;
  /** Maximum requests to record. */
  maxRecordings?: number;
}

// ─── VCR Recorder & Fixtures ───────────────────────────────────

export interface VCRRequest {
  /** HTTP method. */
  method: string;
  /** Full URL or path. */
  url: string;
  /** Request headers. */
  headers: Record<string, string>;
  /** Request body as JSON string or Buffer. */
  body?: string;
  /** Hash of request body for matching. */
  bodyHash?: string;
}

export interface VCRResponse {
  /** HTTP status code. */
  status: number;
  /** Response headers. */
  headers: Record<string, string>;
  /** Response body as JSON string or Buffer. */
  body: string;
  /** Response time in milliseconds. */
  latency: number;
}

export interface VCRInteraction {
  /** The request that triggered this interaction. */
  request: VCRRequest;
  /** The corresponding response. */
  response: VCRResponse;
  /** ISO timestamp when this interaction occurred. */
  timestamp: string;
  /** Number of times this interaction was replayed. */
  replayCount: number;
}

export interface VCRFixture {
  /** Unique fixture identifier. */
  id: string;
  /** Provider name. */
  provider: string;
  /** Test name or context. */
  testName: string;
  /** Mode: "record" (save new), "playback" (use existing), "record_once" (save if new). */
  mode: "record" | "playback" | "record_once";
  /** All recorded interactions. */
  interactions: VCRInteraction[];
  /** Sensitive keys to redact (e.g., ["api_key", "auth_token"]). */
  redactKeys?: string[];
  /** Whether fixture is sealed (no new interactions allowed). */
  sealed: boolean;
  /** ISO timestamp when fixture was created. */
  createdAt: string;
  /** ISO timestamp when fixture was last updated. */
  updatedAt: string;
}

// ─── Contract Testing ───────────────────────────────────────────

export interface ContractField {
  /** Field name or JSON path. */
  name: string;
  /** JSON schema or type name. */
  type: string;
  /** Whether field is required. */
  required: boolean;
  /** Field description. */
  description?: string;
  /** Allowed values (enum). */
  enum?: unknown[];
  /** Regex pattern for strings. */
  pattern?: string;
  /** Min/max for numbers or string length. */
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface Contract {
  /** Unique contract identifier. */
  id: string;
  /** Provider name. */
  provider: string;
  /** API version this contract targets. */
  apiVersion: string;
  /** Endpoint path. */
  endpoint: string;
  /** HTTP method. */
  method: string;
  /** Expected request schema fields. */
  requestSchema: ContractField[];
  /** Expected response schema fields. */
  responseSchema: ContractField[];
  /** Contract version (semver). */
  version: string;
  /** Whether this contract is deprecated. */
  deprecated: boolean;
  /** Deprecation message if applicable. */
  deprecationMessage?: string;
  /** ISO timestamp when contract was defined. */
  createdAt: string;
}

export interface ContractValidation {
  /** Contract that was validated. */
  contractId: string;
  /** Request body used in validation. */
  requestBody: unknown;
  /** Response body from actual API call. */
  responseBody: unknown;
  /** True if validation passed. */
  passed: boolean;
  /** List of validation errors if failed. */
  errors: string[];
  /** Request matched contract schema. */
  requestSchemaMatched: boolean;
  /** Response matched contract schema. */
  responseSchemaMatched: boolean;
  /** Detected schema drift (new/removed fields). */
  schemaDrift: {
    newFields: string[];
    removedFields: string[];
    changedFields: string[];
  };
  /** ISO timestamp of validation. */
  timestamp: string;
}

// ─── SDK Compatibility Matrix ───────────────────────────────────

export interface SDKVersion {
  /** SDK version string (semver). */
  version: string;
  /** Min compatible API version. */
  minApiVersion: string;
  /** Max compatible API version. */
  maxApiVersion: string;
  /** Whether this version is deprecated. */
  deprecated: boolean;
  /** Release date. */
  releaseDate: string;
}

export interface CompatibilityScore {
  /** SDK version. */
  sdkVersion: string;
  /** API version. */
  apiVersion: string;
  /** Compatibility score 0-100. */
  score: number;
  /** True if fully compatible. */
  compatible: boolean;
  /** Known issues or warnings. */
  warnings: string[];
  /** Suggested upgrade path if incompatible. */
  upgradePath?: string;
}

// ─── Chaos Testing Types ───────────────────────────────────────

export type FaultType =
  | "latency"
  | "error"
  | "timeout"
  | "connection_reset"
  | "dns_failure"
  | "rate_limit"
  | "corrupt_response"
  | "missing_fields"
  | "truncated_response";

export interface FaultConfig {
  /** Type of fault to inject. */
  type: FaultType;
  /** Percentage of requests affected (0-100). */
  affectPercentage: number;
  /** Fixed latency in milliseconds (for latency type). */
  fixedLatency?: number;
  /** Random latency range [min, max] in milliseconds. */
  randomLatencyRange?: [number, number];
  /** Latency spike multiplier. */
  spikeMultiplier?: number;
  /** HTTP status code (for error type). */
  statusCode?: number;
  /** Error message. */
  errorMessage?: string;
  /** Timeout in milliseconds. */
  timeout?: number;
  /** Retry-After header value (for rate limit). */
  retryAfter?: number;
  /** Response fields to truncate or corrupt. */
  affectedFields?: string[];
}

export interface ChaosScenario {
  /** Unique scenario identifier. */
  id: string;
  /** Human-readable scenario name. */
  name: string;
  /** Description of what this scenario tests. */
  description: string;
  /** Provider being tested. */
  provider: string;
  /** Faults to inject in sequence. */
  faults: FaultConfig[];
  /** Duration to run scenario in seconds. */
  durationSeconds: number;
  /** Optional blast radius (% of total traffic). */
  blastRadius?: number;
  /** Auto-stop if error rate exceeds threshold (0-100). */
  autoStopThreshold?: number;
  /** Whether scenario is active. */
  enabled: boolean;
  /** Schedule: "manual", "hourly", "daily", "weekly". */
  schedule: string;
}

export interface ChaosExecution {
  /** Unique execution identifier. */
  id: string;
  /** Scenario that was executed. */
  scenarioId: string;
  /** Start time (ISO 8601). */
  startedAt: string;
  /** End time (ISO 8601). */
  endedAt?: string;
  /** Execution status: "running", "completed", "failed", "stopped". */
  status: "running" | "completed" | "failed" | "stopped";
  /** Total requests sent. */
  totalRequests: number;
  /** Successful requests. */
  successfulRequests: number;
  /** Failed requests. */
  failedRequests: number;
  /** Average response time in milliseconds. */
  avgResponseTime: number;
  /** P95 response time in milliseconds. */
  p95ResponseTime: number;
  /** P99 response time in milliseconds. */
  p99ResponseTime: number;
  /** Actual error rate percentage. */
  errorRate: number;
  /** Stop reason if stopped early. */
  stopReason?: string;
}

export interface ChaosResult {
  /** Corresponding execution. */
  execution: ChaosExecution;
  /** Pass/fail determination. */
  passed: boolean;
  /** Detailed findings. */
  findings: string[];
  /** Recommendations for improvement. */
  recommendations: string[];
  /** Before/after metric comparison. */
  metrics: {
    before: Record<string, number>;
    during: Record<string, number>;
    after: Record<string, number>;
  };
}

// ─── Failover & Recovery Testing ───────────────────────────────

export interface FailoverResult {
  /** Primary provider name. */
  primaryProvider: string;
  /** Backup provider name. */
  backupProvider: string;
  /** Time to detect failure in milliseconds. */
  detectionTime: number;
  /** Time to failover in milliseconds. */
  failoverTime: number;
  /** Data consistency check passed. */
  dataConsistent: boolean;
  /** Test status: "success", "failure", "partial". */
  status: "success" | "failure" | "partial";
  /** Details about any inconsistencies. */
  inconsistencies: string[];
  /** Recovery time when primary came back. */
  recoveryTime?: number;
}

// ─── Stress Testing Results ────────────────────────────────────

export interface StressTestResult {
  /** Test identifier. */
  id: string;
  /** Provider being stress tested. */
  provider: string;
  /** Requests per second at breaking point. */
  breakingPointRPS: number;
  /** Actual provider rate limit (if discovered). */
  actualRateLimit?: number;
  /** Accuracy of rate limiter. */
  rateLimiterAccuracy: number;
  /** Burst handling capability. */
  burstCapability: number;
  /** Backpressure behavior observed. */
  backpressureBehavior: string;
  /** Total time to complete test in seconds. */
  totalDuration: number;
  /** Errors encountered. */
  errors: string[];
}

// ─── Regression Testing ────────────────────────────────────────

export interface RegressionResult {
  /** Test name. */
  testName: string;
  /** Result status. */
  status: "pass" | "fail" | "flaky";
  /** Baseline value for comparison. */
  baseline?: Record<string, number>;
  /** Current values. */
  current: Record<string, number>;
  /** Percentage change from baseline. */
  changePercent: Record<string, number>;
  /** Flakiness: how often test fails (0-100). */
  flakinessScore?: number;
}
