/**
 * Integration Testing & Chaos Engineering Module
 * Exports all testing harness, chaos engine, and API components.
 */

// Type definitions
export type {
  MockServerConfig,
  VCRRequest,
  VCRResponse,
  VCRInteraction,
  VCRFixture,
  ContractField,
  Contract,
  ContractValidation,
  SDKVersion,
  CompatibilityScore,
  FaultConfig,
  ChaosScenario,
  ChaosExecution,
  ChaosResult,
  FailoverResult,
  StressTestResult,
  RegressionResult,
} from "./testing-types";

export type {
  FaultType,
} from "./testing-types";

// Mock Server & Test Harness
export {
  MockServerFramework,
  MockServerInstance,
  VCRRecorder,
  ContractTester,
  SDKCompatMatrix,
  RegressionRunner,
} from "./integration-test-harness";

// Chaos Testing
export {
  FaultInjector,
  ProviderFailoverTester,
  CircuitBreakerValidator,
  RateLimitStressTester,
  ChaosScheduler,
  ChaosReporter,
} from "./chaos-engine";

// REST API
export type {
  CreateChaosScenarioRequest,
  ExecuteChaosRequest,
  CreateContractRequest,
  ValidateContractRequest,
  MockServerConfig as MockServerConfigRequest,
  RegressionRunRequest,
  ChaosScenarioResponse,
  ChaosExecutionResponse,
  ChaosResultResponse,
  TestingAPIHandler,
  TestingRoutes,
} from "./testing-api";

export {
  TestingAPIValidator,
  TestingAPIBase,
  TestingAPIError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "./testing-api";
