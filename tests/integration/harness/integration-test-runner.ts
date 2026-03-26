/**
 * Integration Test Runner
 * Wrapper with provider isolation, setup/teardown, context injection, parallel execution
 * ~250 lines
 */

import { MockProviderServer, ProviderConfig } from './mock-provider-server';
import { WebhookSimulator } from './webhook-simulator';

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface ProviderContext {
  server: MockProviderServer;
  webhookSimulator: WebhookSimulator;
  baseUrl: string;
  credentials: {
    apiKey: string;
    clientId: string;
    clientSecret: string;
  };
}

export interface IntegrationTestConfig {
  providers: Record<string, ProviderConfig>;
  timeout?: number;
  parallel?: boolean;
  junitOutputPath?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  provider: string;
}

// ───────────────────────────────────────────────────────────────────────────
// PORT ALLOCATION
// ───────────────────────────────────────────────────────────────────────────

class PortAllocator {
  private basePort: number = 12000;
  private nextPort: number = 12000;
  private maxPort: number = 13000;

  allocate(): number {
    if (this.nextPort >= this.maxPort) {
      throw new Error('Port pool exhausted');
    }
    return this.nextPort++;
  }

  reset(): void {
    this.nextPort = this.basePort;
  }
}

const portAllocator = new PortAllocator();

// ───────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST RUNNER
// ───────────────────────────────────────────────────────────────────────────

export class IntegrationTestRunner {
  private config: Required<IntegrationTestConfig>;
  private providerContexts: Map<string, ProviderContext> = new Map();
  private testResults: TestResult[] = [];
  private globalTimeout: NodeJS.Timeout | null = null;

  constructor(config: IntegrationTestConfig) {
    this.config = {
      timeout: 30000,
      parallel: false,
      junitOutputPath: '',
      ...config,
    };
  }

  /**
   * Initialize all providers and their contexts
   */
  async setupProviders(): Promise<void> {
    const setupPromises = Array.from(Object.entries(this.config.providers)).map(async ([name, config]) => {
      const port = config.port || portAllocator.allocate();
      const serverConfig: ProviderConfig = {
        ...config,
        port,
      };

      const server = new MockProviderServer(serverConfig);
      await server.start();

      const webhookSimulator = new WebhookSimulator();

      const context: ProviderContext = {
        server,
        webhookSimulator,
        baseUrl: server.getBaseUrl(),
        credentials: {
          apiKey: `sk_test_${Math.random().toString(36).substring(2, 18)}`,
          clientId: `client_${Math.random().toString(36).substring(2, 12)}`,
          clientSecret: `secret_${Math.random().toString(36).substring(2, 18)}`,
        },
      };

      this.providerContexts.set(name, context);
    });

    if (this.config.parallel) {
      await Promise.all(setupPromises);
    } else {
      for (const promise of setupPromises) {
        await promise;
      }
    }
  }

  /**
   * Clean up all providers
   */
  async teardownProviders(): Promise<void> {
    const teardownPromises = Array.from(this.providerContexts.values()).map((context) => context.server.stop());

    if (this.config.parallel) {
      await Promise.all(teardownPromises);
    } else {
      for (const promise of teardownPromises) {
        await promise;
      }
    }

    this.providerContexts.clear();
  }

  /**
   * Get context for a provider
   */
  getProviderContext(providerName: string): ProviderContext | undefined {
    return this.providerContexts.get(providerName);
  }

  /**
   * Run a test with timeout and error handling
   */
  async runTest<T>(
    name: string,
    provider: string,
    testFn: (context: ProviderContext) => Promise<T>
  ): Promise<TestResult> {
    const context = this.providerContexts.get(provider);
    if (!context) {
      return {
        name,
        passed: false,
        duration: 0,
        error: `Provider ${provider} not found`,
        provider,
      };
    }

    const startTime = Date.now();

    try {
      await Promise.race([
        testFn(context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Test timeout after ${this.config.timeout}ms`)), this.config.timeout)
        ),
      ]);

      const result: TestResult = {
        name,
        passed: true,
        duration: Date.now() - startTime,
        provider,
      };

      this.testResults.push(result);
      return result;
    } catch (error) {
      const result: TestResult = {
        name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        provider,
      };

      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Run multiple tests for a provider
   */
  async runTests(
    providerName: string,
    tests: Array<{
      name: string;
      fn: (context: ProviderContext) => Promise<void>;
    }>
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (this.config.parallel) {
      const promises = tests.map((test) => this.runTest(test.name, providerName, test.fn));
      results.push(...(await Promise.all(promises)));
    } else {
      for (const test of tests) {
        results.push(await this.runTest(test.name, providerName, test.fn));
      }
    }

    return results;
  }

  /**
   * Get all test results
   */
  getResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Get results by provider
   */
  getResultsByProvider(provider: string): TestResult[] {
    return this.testResults.filter((r) => r.provider === provider);
  }

  /**
   * Get passed tests count
   */
  getPassedCount(): number {
    return this.testResults.filter((r) => r.passed).length;
  }

  /**
   * Get failed tests count
   */
  getFailedCount(): number {
    return this.testResults.filter((r) => !r.passed).length;
  }

  /**
   * Get total duration
   */
  getTotalDuration(): number {
    return this.testResults.reduce((sum, r) => sum + r.duration, 0);
  }

  /**
   * Generate JUnit XML report
   */
  generateJunitReport(): string {
    const suites = new Map<string, TestResult[]>();

    for (const result of this.testResults) {
      const key = result.provider;
      if (!suites.has(key)) {
        suites.set(key, []);
      }
      suites.get(key)!.push(result);
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<testsuites>\n';

    for (const [provider, results] of suites) {
      const passed = results.filter((r) => r.passed).length;
      const failed = results.length - passed;

      xml += `  <testsuite name="${this.escapeXml(provider)}" tests="${results.length}" failures="${failed}" time="${(
        results.reduce((sum, r) => sum + r.duration, 0) / 1000
      ).toFixed(3)}">\n`;

      for (const result of results) {
        xml += `    <testcase name="${this.escapeXml(result.name)}" time="${(result.duration / 1000).toFixed(3)}"`;

        if (result.passed) {
          xml += ' />\n';
        } else {
          xml += `>\n`;
          xml += `      <failure message="${this.escapeXml(result.error || 'Test failed')}" />\n`;
          xml += `    </testcase>\n`;
        }
      }

      xml += `  </testsuite>\n`;
    }

    xml += '</testsuites>\n';
    return xml;
  }

  /**
   * Print test summary
   */
  printSummary(): void {
    console.log('\n=== Integration Test Results ===');
    console.log(`Total: ${this.testResults.length}`);
    console.log(`Passed: ${this.getPassedCount()}`);
    console.log(`Failed: ${this.getFailedCount()}`);
    console.log(`Duration: ${(this.getTotalDuration() / 1000).toFixed(2)}s`);

    if (this.getFailedCount() > 0) {
      console.log('\nFailed tests:');
      for (const result of this.testResults.filter((r) => !r.passed)) {
        console.log(`  - ${result.name} (${result.provider}): ${result.error}`);
      }
    }
  }

  /**
   * Reset results
   */
  resetResults(): void {
    this.testResults = [];
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// HELPER FUNCTION TO CREATE TEST RUNNER
// ───────────────────────────────────────────────────────────────────────────

export async function createIntegrationTestEnvironment(
  config: IntegrationTestConfig
): Promise<{
  runner: IntegrationTestRunner;
  cleanup: () => Promise<void>;
}> {
  const runner = new IntegrationTestRunner(config);
  await runner.setupProviders();

  return {
    runner,
    cleanup: async () => {
      await runner.teardownProviders();
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// VITEST INTEGRATION HELPERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create a test context with automatic setup/teardown
 */
export function createProviderTestContext(config: IntegrationTestConfig) {
  let runner: IntegrationTestRunner;

  return {
    async beforeAll() {
      const env = await createIntegrationTestEnvironment(config);
      runner = env.runner;
    },

    async afterAll() {
      await runner.teardownProviders();
    },

    getRunner(): IntegrationTestRunner {
      return runner;
    },

    getContext(provider: string): ProviderContext | undefined {
      return runner.getProviderContext(provider);
    },
  };
}
