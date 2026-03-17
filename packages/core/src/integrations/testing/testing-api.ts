/**
 * Integration Testing & Chaos Engineering — REST API
 * Exposes testing capabilities via HTTP endpoints with Zod validation.
 */

import { z } from "zod";

// ─── Request Schemas ──────────────────────────────────────────

const FaultConfigSchema = z.object({
  type: z.enum([
    "latency",
    "error",
    "timeout",
    "connection_reset",
    "dns_failure",
    "rate_limit",
    "corrupt_response",
    "missing_fields",
    "truncated_response",
  ]),
  affectPercentage: z.number().min(0).max(100),
  fixedLatency: z.number().optional(),
  randomLatencyRange: z.tuple([z.number(), z.number()]).optional(),
  spikeMultiplier: z.number().optional(),
  statusCode: z.number().optional(),
  errorMessage: z.string().optional(),
  timeout: z.number().optional(),
  retryAfter: z.number().optional(),
  affectedFields: z.array(z.string()).optional(),
});

const CreateChaosScenarioRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(0).max(1024),
  provider: z.string().min(1),
  faults: z.array(FaultConfigSchema),
  durationSeconds: z.number().min(1).max(3600),
  blastRadius: z.number().min(0).max(100).optional(),
  autoStopThreshold: z.number().min(0).max(100).optional(),
  schedule: z.enum(["manual", "hourly", "daily", "weekly"]).default("manual"),
} as const);

const ExecuteChaosRequestSchema = z.object({
  scenarioId: z.string(),
  overrideDuration: z.number().optional(),
});

const ContractFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  pattern: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const CreateContractRequestSchema = z.object({
  provider: z.string().min(1),
  apiVersion: z.string(),
  endpoint: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  requestSchema: z.array(ContractFieldSchema),
  responseSchema: z.array(ContractFieldSchema),
  version: z.string().default("1.0.0"),
});

const ValidateContractRequestSchema = z.object({
  contractId: z.string(),
  requestBody: z.unknown(),
  responseBody: z.unknown(),
});

const MockServerConfigSchema = z.object({
  provider: z.string().min(1),
  port: z.number().min(1024).max(65535),
  defaultStatus: z.number().default(200),
  defaultHeaders: z.record(z.string()).optional(),
  logRequests: z.boolean().default(false),
  recordRequests: z.boolean().default(false),
  maxRecordings: z.number().default(1000),
});

const RegressionRunRequestSchema = z.object({
  testPattern: z.string().optional(),
  parallel: z.boolean().default(true),
});

// ─── Response Schemas ──────────────────────────────────────────

const ChaosScenarioResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: z.string(),
  faults: z.array(FaultConfigSchema),
  durationSeconds: z.number(),
  blastRadius: z.number().optional(),
  autoStopThreshold: z.number().optional(),
  enabled: z.boolean(),
  schedule: z.string(),
});

const ChaosExecutionResponseSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(["running", "completed", "failed", "stopped"]),
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  avgResponseTime: z.number(),
  p95ResponseTime: z.number(),
  p99ResponseTime: z.number(),
  errorRate: z.number(),
  stopReason: z.string().optional(),
});

const ChaosResultResponseSchema = z.object({
  execution: ChaosExecutionResponseSchema,
  passed: z.boolean(),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()),
  metrics: z.object({
    before: z.record(z.number()),
    during: z.record(z.number()),
    after: z.record(z.number()),
  }),
});

// ─── Type Exports ─────────────────────────────────────────────

export type CreateChaosScenarioRequest = z.infer<typeof CreateChaosScenarioRequestSchema>;
export type ExecuteChaosRequest = z.infer<typeof ExecuteChaosRequestSchema>;
export type CreateContractRequest = z.infer<typeof CreateContractRequestSchema>;
export type ValidateContractRequest = z.infer<typeof ValidateContractRequestSchema>;
export type MockServerConfig = z.infer<typeof MockServerConfigSchema>;
export type RegressionRunRequest = z.infer<typeof RegressionRunRequestSchema>;

export type ChaosScenarioResponse = z.infer<typeof ChaosScenarioResponseSchema>;
export type ChaosExecutionResponse = z.infer<typeof ChaosExecutionResponseSchema>;
export type ChaosResultResponse = z.infer<typeof ChaosResultResponseSchema>;

// ─── API Route Handlers ────────────────────────────────────────

/**
 * Represents a testing API handler interface.
 * Implement this interface to create a concrete API server.
 */
export interface TestingAPIHandler {
  // Chaos Testing endpoints

  /**
   * POST /testing/chaos/scenarios
   * Create a new chaos scenario.
   */
  createChaosScenario(
    req: CreateChaosScenarioRequest
  ): Promise<{ id: string; message: string }>;

  /**
   * GET /testing/chaos/scenarios
   * List all chaos scenarios.
   */
  getChaosScenarios(provider?: string): Promise<ChaosScenarioResponse[]>;

  /**
   * GET /testing/chaos/scenarios/:id
   * Get a specific chaos scenario.
   */
  getChaosScenario(scenarioId: string): Promise<ChaosScenarioResponse | null>;

  /**
   * POST /testing/chaos/execute/:id
   * Execute a chaos scenario.
   */
  executeChaosScenario(
    scenarioId: string,
    req?: ExecuteChaosRequest
  ): Promise<ChaosExecutionResponse>;

  /**
   * GET /testing/chaos/executions/:id
   * Get a specific chaos execution.
   */
  getChaosExecution(executionId: string): Promise<ChaosExecutionResponse | null>;

  /**
   * POST /testing/chaos/stop/:id
   * Stop an ongoing chaos execution.
   */
  stopChaosExecution(executionId: string): Promise<{ message: string }>;

  /**
   * GET /testing/chaos/results
   * Get chaos test results (with optional filtering).
   */
  getChaosResults(
    scenarioId?: string,
    limit?: number
  ): Promise<ChaosResultResponse[]>;

  // Contract Testing endpoints

  /**
   * GET /testing/contracts
   * List all registered contracts.
   */
  getContracts(provider?: string): Promise<any[]>;

  /**
   * POST /testing/contracts/validate
   * Validate request/response against a contract.
   */
  validateContract(
    req: ValidateContractRequest
  ): Promise<{ passed: boolean; errors: string[]; schemaDrift: any }>;

  // Regression Testing endpoints

  /**
   * GET /testing/regression/status
   * Get regression test status.
   */
  getRegressionStatus(): Promise<{
    passed: number;
    failed: number;
    flaky: number;
  }>;

  /**
   * POST /testing/regression/run
   * Run regression tests.
   */
  runRegressionTests(req: RegressionRunRequest): Promise<{
    executionId: string;
    message: string;
  }>;

  // Mock Server endpoints

  /**
   * GET /testing/mock-servers
   * List all mock servers.
   */
  getMockServers(): Promise<Array<{ id: string; provider: string; port: number }>>;

  /**
   * POST /testing/mock-servers
   * Create a new mock server.
   */
  createMockServer(
    config: MockServerConfig
  ): Promise<{ id: string; baseUrl: string }>;
}

// ─── Validation Helper ────────────────────────────────────────

export class TestingAPIValidator {
  static validateCreateChaosScenario(
    data: unknown
  ): CreateChaosScenarioRequest {
    return CreateChaosScenarioRequestSchema.parse(data);
  }

  static validateExecuteChaos(data: unknown): ExecuteChaosRequest {
    return ExecuteChaosRequestSchema.parse(data);
  }

  static validateCreateContract(data: unknown): CreateContractRequest {
    return CreateContractRequestSchema.parse(data);
  }

  static validateValidateContract(data: unknown): ValidateContractRequest {
    return ValidateContractRequestSchema.parse(data);
  }

  static validateMockServerConfig(data: unknown): MockServerConfig {
    return MockServerConfigSchema.parse(data);
  }

  static validateRegressionRunRequest(data: unknown): RegressionRunRequest {
    return RegressionRunRequestSchema.parse(data);
  }

  static validateFaultConfig(data: unknown) {
    return FaultConfigSchema.parse(data);
  }
}

// ─── Base Implementation ───────────────────────────────────────

/**
 * Base implementation of the Testing API.
 * Extend this class to integrate with your testing infrastructure.
 */
export abstract class TestingAPIBase implements TestingAPIHandler {
  abstract createChaosScenario(
    req: CreateChaosScenarioRequest
  ): Promise<{ id: string; message: string }>;

  abstract getChaosScenarios(provider?: string): Promise<ChaosScenarioResponse[]>;

  abstract getChaosScenario(
    scenarioId: string
  ): Promise<ChaosScenarioResponse | null>;

  abstract executeChaosScenario(
    scenarioId: string,
    req?: ExecuteChaosRequest
  ): Promise<ChaosExecutionResponse>;

  abstract getChaosExecution(
    executionId: string
  ): Promise<ChaosExecutionResponse | null>;

  abstract stopChaosExecution(executionId: string): Promise<{ message: string }>;

  abstract getChaosResults(
    scenarioId?: string,
    limit?: number
  ): Promise<ChaosResultResponse[]>;

  abstract getContracts(provider?: string): Promise<any[]>;

  abstract validateContract(
    req: ValidateContractRequest
  ): Promise<{ passed: boolean; errors: string[]; schemaDrift: any }>;

  abstract getRegressionStatus(): Promise<{
    passed: number;
    failed: number;
    flaky: number;
  }>;

  abstract runRegressionTests(
    req: RegressionRunRequest
  ): Promise<{ executionId: string; message: string }>;

  abstract getMockServers(): Promise<Array<{ id: string; provider: string; port: number }>>;

  abstract createMockServer(
    config: MockServerConfig
  ): Promise<{ id: string; baseUrl: string }>;

  /**
   * Helper to validate request data.
   */
  protected validateRequest<T>(
    data: unknown,
    schema: z.ZodSchema<T>
  ): T {
    return schema.parse(data);
  }

  /**
   * Helper to safely parse JSON.
   */
  protected safeParseJSON(data: string): unknown {
    try {
      return JSON.parse(data);
    } catch {
      throw new Error("Invalid JSON in request body");
    }
  }
}

// ─── Router Interface ─────────────────────────────────────────

export interface TestingRoutes {
  "POST /testing/chaos/scenarios": (
    body: CreateChaosScenarioRequest
  ) => Promise<{ id: string; message: string }>;

  "GET /testing/chaos/scenarios": (query?: {
    provider?: string;
  }) => Promise<ChaosScenarioResponse[]>;

  "GET /testing/chaos/scenarios/:id": (
    params: { id: string }
  ) => Promise<ChaosScenarioResponse | null>;

  "POST /testing/chaos/execute/:id": (
    params: { id: string },
    body?: ExecuteChaosRequest
  ) => Promise<ChaosExecutionResponse>;

  "GET /testing/chaos/executions/:id": (
    params: { id: string }
  ) => Promise<ChaosExecutionResponse | null>;

  "POST /testing/chaos/stop/:id": (params: {
    id: string;
  }) => Promise<{ message: string }>;

  "GET /testing/chaos/results": (query?: {
    scenarioId?: string;
    limit?: number;
  }) => Promise<ChaosResultResponse[]>;

  "GET /testing/contracts": (query?: {
    provider?: string;
  }) => Promise<any[]>;

  "POST /testing/contracts/validate": (
    body: ValidateContractRequest
  ) => Promise<{ passed: boolean; errors: string[]; schemaDrift: any }>;

  "GET /testing/regression/status": () => Promise<{
    passed: number;
    failed: number;
    flaky: number;
  }>;

  "POST /testing/regression/run": (
    body: RegressionRunRequest
  ) => Promise<{ executionId: string; message: string }>;

  "GET /testing/mock-servers": () => Promise<
    Array<{ id: string; provider: string; port: number }>
  >;

  "POST /testing/mock-servers": (
    body: MockServerConfig
  ) => Promise<{ id: string; baseUrl: string }>;
}

// ─── Error Types ──────────────────────────────────────────────

export class TestingAPIError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "TestingAPIError";
  }
}

export class ValidationError extends TestingAPIError {
  constructor(message: string) {
    super("VALIDATION_ERROR", 400, message);
  }
}

export class NotFoundError extends TestingAPIError {
  constructor(resource: string) {
    super("NOT_FOUND", 404, `${resource} not found`);
  }
}

export class ConflictError extends TestingAPIError {
  constructor(message: string) {
    super("CONFLICT", 409, message);
  }
}
