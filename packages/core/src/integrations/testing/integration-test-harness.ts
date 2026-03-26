/**
 * Integration Test Harness
 * Provides mock HTTP servers, VCR recording/playback, contract testing,
 * SDK compatibility tracking, and regression testing capabilities.
 */

import type {
  MockServerConfig,
  VCRFixture,
  VCRInteraction,
  VCRRequest,
  VCRResponse,
  Contract,
  ContractValidation,
  SDKVersion,
  CompatibilityScore,
  RegressionResult,
} from "./testing-types";

// ─── Mock Server Framework ───────────────────────────────────────

export class MockServerFramework {
  private servers: Map<string, MockServerInstance> = new Map();

  /**
   * Create a new mock server instance for a provider.
   */
  createMockServer(config: MockServerConfig): MockServerInstance {
    const instance = new MockServerInstance(config);
    this.servers.set(config.id, instance);
    return instance;
  }

  /**
   * Get an existing mock server by ID.
   */
  getMockServer(id: string): MockServerInstance | undefined {
    return this.servers.get(id);
  }

  /**
   * Destroy a mock server and clean up.
   */
  async destroyMockServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      await server.shutdown();
      this.servers.delete(id);
    }
  }

  /**
   * Destroy all mock servers.
   */
  async destroyAll(): Promise<void> {
    const promises = Array.from(this.servers.values()).map((s) => s.shutdown());
    await Promise.all(promises);
    this.servers.clear();
  }

  /**
   * Get all registered mock servers.
   */
  getAllServers(): MockServerInstance[] {
    return Array.from(this.servers.values());
  }
}

export class MockServerInstance {
  private config: MockServerConfig;
  private routes: Map<string, MockRoute> = new Map();
  private recordings: VCRRequest[] = [];
  private isRunning = false;

  constructor(config: MockServerConfig) {
    this.config = {
      defaultStatus: 200,
      defaultHeaders: { "Content-Type": "application/json" },
      logRequests: false,
      recordRequests: false,
      maxRecordings: 1000,
      ...config,
    };
  }

  /**
   * Register a route handler.
   */
  registerRoute(
    method: string,
    path: string,
    handler: MockRouteHandler
  ): void {
    const key = `${method} ${path}`;
    this.routes.set(key, {
      method,
      path,
      handler,
      callCount: 0,
      lastCalledAt: undefined,
    });
  }

  /**
   * Register a conditional response.
   */
  registerConditionalResponse(
    method: string,
    path: string,
    condition: (req: VCRRequest) => boolean,
    response: MockResponse
  ): void {
    this.registerRoute(method, path, {
      status: response.status,
      headers: response.headers,
      body: response.body,
      latency: response.latency,
      condition,
    } as MockRouteHandler);
  }

  /**
   * Get route call count.
   */
  getRouteCallCount(method: string, path: string): number {
    const key = `${method} ${path}`;
    return this.routes.get(key)?.callCount ?? 0;
  }

  /**
   * Assert route was called N times.
   */
  assertCalledNTimes(method: string, path: string, times: number): boolean {
    return this.getRouteCallCount(method, path) === times;
  }

  /**
   * Assert route was called at least once.
   */
  assertCalled(method: string, path: string): boolean {
    return this.getRouteCallCount(method, path) > 0;
  }

  /**
   * Assert route was never called.
   */
  assertNotCalled(method: string, path: string): boolean {
    return this.getRouteCallCount(method, path) === 0;
  }

  /**
   * Get recorded requests.
   */
  getRecordedRequests(): VCRRequest[] {
    return [...this.recordings];
  }

  /**
   * Clear recordings.
   */
  clearRecordings(): void {
    this.recordings = [];
  }

  /**
   * Assert route was called with matching request body.
   */
  assertCalledWithBody(
    method: string,
    path: string,
    expectedBody: unknown
  ): boolean {
    const requests = this.recordings.filter(
      (r) => r.method === method && r.url.includes(path)
    );
    return requests.some((r) => {
      if (!r.body) return !expectedBody;
      try {
        const actual = JSON.parse(r.body);
        return JSON.stringify(actual) === JSON.stringify(expectedBody);
      } catch {
        return false;
      }
    });
  }

  /**
   * Assert route was called with matching headers.
   */
  assertCalledWithHeaders(
    method: string,
    path: string,
    expectedHeaders: Record<string, string>
  ): boolean {
    const requests = this.recordings.filter(
      (r) => r.method === method && r.url.includes(path)
    );
    return requests.some((r) => {
      return Object.entries(expectedHeaders).every(
        ([key, value]) => r.headers[key.toLowerCase()] === value.toLowerCase()
      );
    });
  }

  /**
   * Start the mock server.
   */
  async start(): Promise<void> {
    this.isRunning = true;
    // Server implementation would be here in real environment
  }

  /**
   * Shutdown the mock server.
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    this.routes.clear();
    this.recordings = [];
  }

  /**
   * Get server base URL.
   */
  getBaseUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  /**
   * Internal: record a request.
   */
  private recordRequest(request: VCRRequest): void {
    if (this.config.recordRequests && this.recordings.length < this.config.maxRecordings!) {
      this.recordings.push(request);
    }
  }
}

interface MockRoute {
  method: string;
  path: string;
  handler: MockRouteHandler;
  callCount: number;
  lastCalledAt?: Date;
}

interface MockRouteHandler {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  condition?: (req: VCRRequest) => boolean;
}

interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  latency: number;
}

// ─── VCR Recorder ───────────────────────────────────────────────

export class VCRRecorder {
  private fixtures: Map<string, VCRFixture> = new Map();
  private basePath: string;

  constructor(basePath: string = "./fixtures") {
    this.basePath = basePath;
  }

  /**
   * Create or load a fixture.
   */
  createFixture(
    id: string,
    provider: string,
    testName: string,
    mode: "record" | "playback" | "record_once" = "record_once"
  ): VCRFixture {
    const fixture: VCRFixture = {
      id,
      provider,
      testName,
      mode,
      interactions: [],
      sealed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.fixtures.set(id, fixture);
    return fixture;
  }

  /**
   * Record an HTTP interaction.
   */
  recordInteraction(
    fixtureId: string,
    request: VCRRequest,
    response: VCRResponse
  ): void {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture || fixture.sealed) return;

    // Redact sensitive data
    if (fixture.redactKeys) {
      this.redactSensitiveData(request, fixture.redactKeys);
      this.redactSensitiveData(response.body, fixture.redactKeys);
    }

    // Compute body hash for request matching
    if (request.body) {
      request.bodyHash = this.hashBody(request.body);
    }

    const interaction: VCRInteraction = {
      request,
      response,
      timestamp: new Date().toISOString(),
      replayCount: 0,
    };

    fixture.interactions.push(interaction);
    fixture.updatedAt = new Date().toISOString();
  }

  /**
   * Find matching interaction by request.
   */
  findMatchingInteraction(
    fixtureId: string,
    request: VCRRequest
  ): VCRInteraction | undefined {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) return undefined;

    const bodyHash = request.body ? this.hashBody(request.body) : undefined;

    return fixture.interactions.find((interaction) => {
      const urlMatch = this.normalizeUrl(interaction.request.url) ===
        this.normalizeUrl(request.url) && interaction.request.method === request.method;
      const bodyMatch = !bodyHash || interaction.request.bodyHash === bodyHash;
      return urlMatch && bodyMatch;
    });
  }

  /**
   * Playback a recorded interaction.
   */
  playbackInteraction(fixtureId: string, interactionIndex: number): VCRResponse | undefined {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture || interactionIndex >= fixture.interactions.length) return undefined;

    const interaction = fixture.interactions[interactionIndex];
    interaction.replayCount += 1;
    fixture.updatedAt = new Date().toISOString();

    return interaction.response;
  }

  /**
   * Get all interactions for a fixture.
   */
  getInteractions(fixtureId: string): VCRInteraction[] {
    const fixture = this.fixtures.get(fixtureId);
    return fixture ? [...fixture.interactions] : [];
  }

  /**
   * Seal a fixture (no new interactions allowed).
   */
  sealFixture(fixtureId: string): void {
    const fixture = this.fixtures.get(fixtureId);
    if (fixture) {
      fixture.sealed = true;
    }
  }

  /**
   * Export fixture to JSON.
   */
  exportFixture(fixtureId: string): string {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) return "";
    return JSON.stringify(fixture, null, 2);
  }

  /**
   * Import fixture from JSON.
   */
  importFixture(json: string): VCRFixture {
    const fixture = JSON.parse(json) as VCRFixture;
    this.fixtures.set(fixture.id, fixture);
    return fixture;
  }

  /**
   * Get fixture by ID.
   */
  getFixture(fixtureId: string): VCRFixture | undefined {
    return this.fixtures.get(fixtureId);
  }

  /**
   * Private: redact sensitive data from request/response.
   */
  private redactSensitiveData(
    data: unknown,
    keys: string[]
  ): void {
    if (typeof data !== "object" || data === null) return;

    const obj = data as Record<string, unknown>;
    keys.forEach((key) => {
      if (key in obj) {
        obj[key] = "[REDACTED]";
      }
    });
  }

  /**
   * Private: hash request body for matching.
   */
  private hashBody(body: string): string {
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Private: normalize URL for comparison.
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return url;
    }
  }
}

// ─── Contract Tester ────────────────────────────────────────────

export class ContractTester {
  private contracts: Map<string, Contract> = new Map();
  private validationHistory: ContractValidation[] = [];

  /**
   * Register a contract.
   */
  registerContract(contract: Contract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Get a contract by ID.
   */
  getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  /**
   * Validate a request/response against a contract.
   */
  validateAgainstContract(
    contractId: string,
    requestBody: unknown,
    responseBody: unknown
  ): ContractValidation {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return {
        contractId,
        requestBody,
        responseBody,
        passed: false,
        errors: ["Contract not found"],
        requestSchemaMatched: false,
        responseSchemaMatched: false,
        schemaDrift: { newFields: [], removedFields: [], changedFields: [] },
        timestamp: new Date().toISOString(),
      };
    }

    const errors: string[] = [];
    let requestSchemaMatched = true;
    let responseSchemaMatched = true;

    // Validate request against schema
    for (const field of contract.requestSchema) {
      if (field.required && !(field.name in (requestBody as Record<string, unknown>))) {
        errors.push(`Missing required request field: ${field.name}`);
        requestSchemaMatched = false;
      }
    }

    // Validate response against schema
    for (const field of contract.responseSchema) {
      if (field.required && !(field.name in (responseBody as Record<string, unknown>))) {
        errors.push(`Missing required response field: ${field.name}`);
        responseSchemaMatched = false;
      }
    }

    // Detect schema drift
    const responseObj = responseBody as Record<string, unknown>;
    const newFields = Object.keys(responseObj).filter(
      (key) => !contract.responseSchema.some((f) => f.name === key)
    );

    const schemaDrift = {
      newFields,
      removedFields: contract.responseSchema
        .filter((f) => !(f.name in responseObj))
        .map((f) => f.name),
      changedFields: [],
    };

    const validation: ContractValidation = {
      contractId,
      requestBody,
      responseBody,
      passed: errors.length === 0,
      errors,
      requestSchemaMatched,
      responseSchemaMatched,
      schemaDrift,
      timestamp: new Date().toISOString(),
    };

    this.validationHistory.push(validation);
    return validation;
  }

  /**
   * Get validation history.
   */
  getValidationHistory(contractId?: string): ContractValidation[] {
    if (contractId) {
      return this.validationHistory.filter((v) => v.contractId === contractId);
    }
    return [...this.validationHistory];
  }

  /**
   * Check for backward compatibility.
   */
  checkBackwardCompatibility(oldContractId: string, newContractId: string): boolean {
    const oldContract = this.contracts.get(oldContractId);
    const newContract = this.contracts.get(newContractId);

    if (!oldContract || !newContract) return false;

    // New contract must have all old response fields
    const oldFields = new Set(oldContract.responseSchema.map((f) => f.name));
    const newFields = new Set(newContract.responseSchema.map((f) => f.name));

    for (const field of oldFields) {
      if (!newFields.has(field)) {
        return false; // Breaking change
      }
    }

    return true;
  }
}

// ─── SDK Compatibility Matrix ──────────────────────────────────

export class SDKCompatMatrix {
  private sdkVersions: Map<string, SDKVersion[]> = new Map();
  private compatibilityCache: Map<string, CompatibilityScore> = new Map();

  /**
   * Register SDK versions.
   */
  registerSDKVersion(sdk: string, version: SDKVersion): void {
    if (!this.sdkVersions.has(sdk)) {
      this.sdkVersions.set(sdk, []);
    }
    this.sdkVersions.get(sdk)!.push(version);
  }

  /**
   * Check compatibility between SDK and API version.
   */
  checkCompatibility(sdkVersion: string, apiVersion: string): CompatibilityScore {
    const cacheKey = `${sdkVersion}-${apiVersion}`;
    const cached = this.compatibilityCache.get(cacheKey);
    if (cached) return cached;

    const allVersions = Array.from(this.sdkVersions.values()).flat();
    const matchingVersion = allVersions.find((v) => v.version === sdkVersion);

    if (!matchingVersion) {
      const score: CompatibilityScore = {
        sdkVersion,
        apiVersion,
        score: 0,
        compatible: false,
        warnings: ["SDK version not found"],
      };
      this.compatibilityCache.set(cacheKey, score);
      return score;
    }

    const compatible =
      apiVersion >= matchingVersion.minApiVersion &&
      apiVersion <= matchingVersion.maxApiVersion;

    const warnings: string[] = [];
    if (matchingVersion.deprecated) {
      warnings.push(`SDK version ${sdkVersion} is deprecated`);
    }

    const score: CompatibilityScore = {
      sdkVersion,
      apiVersion,
      score: compatible ? 100 : 50,
      compatible,
      warnings,
    };

    this.compatibilityCache.set(cacheKey, score);
    return score;
  }

  /**
   * Get upgrade suggestions.
   */
  getUpgradePath(currentSdkVersion: string, targetApiVersion: string): string | undefined {
    const versions = Array.from(this.sdkVersions.values()).flat();
    const compatible = versions
      .filter((v) => !v.deprecated && v.maxApiVersion >= targetApiVersion)
      .sort((a, b) => b.version.localeCompare(a.version))[0];

    return compatible?.version;
  }

  /**
   * Get deprecation warnings.
   */
  getDeprecationWarnings(sdkVersion: string): string[] {
    const allVersions = Array.from(this.sdkVersions.values()).flat();
    const version = allVersions.find((v) => v.version === sdkVersion);
    return version?.deprecated ? [`SDK version ${sdkVersion} is deprecated`] : [];
  }
}

// ─── Regression Test Runner ────────────────────────────────────

export class RegressionRunner {
  private results: Map<string, RegressionResult[]> = new Map();
  private baselines: Map<string, Record<string, number>> = new Map();
  private flakyTests: Set<string> = new Set();

  /**
   * Set baseline metrics for a test.
   */
  setBaseline(testName: string, metrics: Record<string, number>): void {
    this.baselines.set(testName, metrics);
  }

  /**
   * Record test result.
   */
  recordResult(testName: string, metrics: Record<string, number>): RegressionResult {
    const baseline = this.baselines.get(testName) ?? {};
    const changePercent: Record<string, number> = {};

    for (const [key, value] of Object.entries(metrics)) {
      const baselineValue = baseline[key] ?? value;
      changePercent[key] = ((value - baselineValue) / baselineValue) * 100;
    }

    let status: "pass" | "fail" | "flaky" = "pass";
    if (this.flakyTests.has(testName)) {
      status = "flaky";
    } else if (Object.values(changePercent).some((p) => Math.abs(p) > 10)) {
      status = "fail"; // More than 10% regression
    }

    const result: RegressionResult = {
      testName,
      status,
      baseline,
      current: metrics,
      changePercent,
    };

    if (!this.results.has(testName)) {
      this.results.set(testName, []);
    }
    this.results.get(testName)!.push(result);

    return result;
  }

  /**
   * Mark test as flaky.
   */
  markFlaky(testName: string, flakinessScore: number): void {
    this.flakyTests.add(testName);
    const results = this.results.get(testName) ?? [];
    if (results.length > 0) {
      results[results.length - 1].flakinessScore = flakinessScore;
    }
  }

  /**
   * Get results for a test.
   */
  getResults(testName: string): RegressionResult[] {
    return this.results.get(testName) ?? [];
  }

  /**
   * Get all flaky tests.
   */
  getFlakyTests(): string[] {
    return Array.from(this.flakyTests);
  }

  /**
   * Get results summary.
   */
  getSummary(): { passed: number; failed: number; flaky: number } {
    let passed = 0,
      failed = 0,
      flaky = 0;

    for (const results of this.results.values()) {
      if (results.length > 0) {
        const latest = results[results.length - 1];
        if (latest.status === "pass") passed++;
        else if (latest.status === "fail") failed++;
        else if (latest.status === "flaky") flaky++;
      }
    }

    return { passed, failed, flaky };
  }
}
