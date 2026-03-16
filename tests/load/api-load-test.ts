/**
 * API Load Testing Utilities
 * Comprehensive load testing framework for API performance validation
 * - Concurrent request simulator
 * - Ramp-up pattern (gradual increase)
 * - Spike test pattern (sudden burst)
 * - Endurance test pattern (sustained load)
 * - Response time percentiles (p50, p95, p99)
 * - Error rate tracking
 * - Throughput measurement
 * - Report generation
 *
 * Usage:
 *   const loadTest = new APILoadTest(config);
 *   const rampUpLoad = new RampUpPattern(10, 100);
 *   const results = await loadTest.runTest(rampUpLoad, async (id) => {
 *     return fetch('http://api.example.com/endpoint');
 *   });
 *   console.log(results.generateReport());
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LoadTestConfig {
  baseUrl?: string;
  timeout?: number;
  verbose?: boolean;
  warmupRequests?: number;
}

export interface RequestResult {
  id: string;
  duration: number;
  statusCode?: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  meanDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  throughput: number;
  concurrencyLevel: number;
  errors: Map<string, number>;
}

export interface LoadPattern {
  getTotalRequests(): number;
  getConcurrencyAt(timeMs: number): number;
  getDuration(): number;
}

// ============================================================================
// LOAD PATTERNS
// ============================================================================

export class RampUpPattern implements LoadPattern {
  constructor(
    private startConcurrency: number,
    private endConcurrency: number,
    private durationMs: number = 60000
  ) {}

  getTotalRequests(): number {
    return Math.round((this.startConcurrency + this.endConcurrency) / 2) * (this.durationMs / 1000);
  }

  getConcurrencyAt(timeMs: number): number {
    const progress = Math.min(timeMs / this.durationMs, 1);
    return Math.round(this.startConcurrency + (this.endConcurrency - this.startConcurrency) * progress);
  }

  getDuration(): number {
    return this.durationMs;
  }
}

export class SpikePattern implements LoadPattern {
  constructor(
    private baseConcurrency: number,
    private spikeConcurrency: number,
    private spikeDurationMs: number = 10000,
    private totalDurationMs: number = 60000
  ) {}

  getTotalRequests(): number {
    const baseTime = this.totalDurationMs - this.spikeDurationMs;
    const baseRequests = this.baseConcurrency * (baseTime / 1000);
    const spikeRequests = this.spikeConcurrency * (this.spikeDurationMs / 1000);
    return Math.round(baseRequests + spikeRequests);
  }

  getConcurrencyAt(timeMs: number): number {
    const spikeStart = this.totalDurationMs - this.spikeDurationMs;
    if (timeMs >= spikeStart) {
      return this.spikeConcurrency;
    }
    return this.baseConcurrency;
  }

  getDuration(): number {
    return this.totalDurationMs;
  }
}

export class EndurancePattern implements LoadPattern {
  constructor(
    private concurrency: number,
    private durationMs: number = 300000 // 5 minutes
  ) {}

  getTotalRequests(): number {
    return this.concurrency * (this.durationMs / 1000);
  }

  getConcurrencyAt(): number {
    return this.concurrency;
  }

  getDuration(): number {
    return this.durationMs;
  }
}

export class ConstantLoadPattern implements LoadPattern {
  constructor(
    private concurrency: number,
    private durationMs: number = 60000
  ) {}

  getTotalRequests(): number {
    return this.concurrency * (this.durationMs / 1000);
  }

  getConcurrencyAt(): number {
    return this.concurrency;
  }

  getDuration(): number {
    return this.durationMs;
  }
}

// ============================================================================
// METRICS CALCULATOR
// ============================================================================

class MetricsCalculator {
  static calculateMetrics(results: RequestResult[], concurrencyLevel: number, testDurationMs: number): LoadTestMetrics {
    const durations = results.filter((r) => r.success).map((r) => r.duration);
    const errors = new Map<string, number>();

    results.filter((r) => !r.success).forEach((r) => {
      const errorMsg = r.error || 'Unknown error';
      errors.set(errorMsg, (errors.get(errorMsg) || 0) + 1);
    });

    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
      totalRequests: results.length,
      successfulRequests: results.filter((r) => r.success).length,
      failedRequests: results.filter((r) => !r.success).length,
      totalDuration: testDurationMs,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      meanDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      medianDuration: this.percentile(sortedDurations, 0.5),
      p95Duration: this.percentile(sortedDurations, 0.95),
      p99Duration: this.percentile(sortedDurations, 0.99),
      errorRate: results.length > 0 ? results.filter((r) => !r.success).length / results.length : 0,
      throughput: (results.length / testDurationMs) * 1000,
      concurrencyLevel,
      errors,
    };
  }

  private static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ============================================================================
// API LOAD TEST ENGINE
// ============================================================================

export class APILoadTest {
  private config: Required<LoadTestConfig>;
  private results: RequestResult[] = [];

  constructor(config: LoadTestConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      verbose: config.verbose || false,
      warmupRequests: config.warmupRequests || 0,
    };
  }

  async runTest(
    pattern: LoadPattern,
    requestFn: (requestId: string) => Promise<Response>
  ): Promise<LoadTestResults> {
    const startTime = Date.now();
    const results: RequestResult[] = [];
    let activeRequests = 0;
    const maxConcurrency = Math.max(
      pattern.getConcurrencyAt(0),
      pattern.getConcurrencyAt(pattern.getDuration() / 2),
      pattern.getConcurrencyAt(pattern.getDuration())
    );

    if (this.config.verbose) {
      console.log(`[Load Test] Starting test - Pattern: ${pattern.constructor.name}`);
      console.log(`[Load Test] Max Concurrency: ${maxConcurrency}`);
      console.log(`[Load Test] Total Requests: ${pattern.getTotalRequests()}`);
    }

    const requestQueue: Promise<void>[] = [];

    while (Date.now() - startTime < pattern.getDuration()) {
      const elapsedMs = Date.now() - startTime;
      const targetConcurrency = pattern.getConcurrencyAt(elapsedMs);

      while (activeRequests < targetConcurrency && results.length < pattern.getTotalRequests()) {
        activeRequests++;
        const requestId = `req_${results.length + 1}`;
        const requestStartTime = Date.now();

        const requestPromise = (async () => {
          try {
            const response = await Promise.race([
              requestFn(requestId),
              new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
              ),
            ]);

            const duration = Date.now() - requestStartTime;
            results.push({
              id: requestId,
              duration,
              statusCode: response.status,
              success: response.ok,
              timestamp: requestStartTime,
              error: !response.ok ? `HTTP ${response.status}` : undefined,
            });

            if (this.config.verbose && results.length % 100 === 0) {
              console.log(`[Load Test] ${results.length} requests completed`);
            }
          } catch (error) {
            const duration = Date.now() - requestStartTime;
            results.push({
              id: requestId,
              duration,
              success: false,
              timestamp: requestStartTime,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          } finally {
            activeRequests--;
          }
        })();

        requestQueue.push(requestPromise);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await Promise.all(requestQueue);

    const testDurationMs = Date.now() - startTime;
    const metrics = MetricsCalculator.calculateMetrics(
      results,
      maxConcurrency,
      testDurationMs
    );

    this.results = results;
    return new LoadTestResults(metrics, results);
  }

  getResults(): RequestResult[] {
    return [...this.results];
  }
}

// ============================================================================
// RESULTS & REPORTING
// ============================================================================

export class LoadTestResults {
  constructor(
    private metrics: LoadTestMetrics,
    private results: RequestResult[]
  ) {}

  getMetrics(): LoadTestMetrics {
    return { ...this.metrics };
  }

  generateReport(): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      'LOAD TEST RESULTS',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Total Requests:        ${this.metrics.totalRequests}`,
      `Successful:            ${this.metrics.successfulRequests} (${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2)}%)`,
      `Failed:                ${this.metrics.failedRequests} (${(this.metrics.errorRate * 100).toFixed(2)}%)`,
      `Test Duration:         ${(this.metrics.totalDuration / 1000).toFixed(2)}s`,
      `Concurrency Level:     ${this.metrics.concurrencyLevel}`,
      `Throughput:            ${this.metrics.throughput.toFixed(2)} req/s`,
      '',
      'RESPONSE TIME METRICS (milliseconds)',
      '─────────────────────────────────────────────────────────────',
      `Min:                   ${this.metrics.minDuration.toFixed(2)}ms`,
      `Max:                   ${this.metrics.maxDuration.toFixed(2)}ms`,
      `Mean:                  ${this.metrics.meanDuration.toFixed(2)}ms`,
      `Median (p50):          ${this.metrics.medianDuration.toFixed(2)}ms`,
      `p95:                   ${this.metrics.p95Duration.toFixed(2)}ms`,
      `p99:                   ${this.metrics.p99Duration.toFixed(2)}ms`,
      '',
    ];

    if (this.metrics.errors.size > 0) {
      lines.push('ERROR BREAKDOWN');
      lines.push('─────────────────────────────────────────────────────────────');
      this.metrics.errors.forEach((count, error) => {
        lines.push(`${error}: ${count}`);
      });
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  exportJSON(): string {
    return JSON.stringify({
      metrics: this.metrics,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  getSuccessRate(): number {
    return this.metrics.successfulRequests / this.metrics.totalRequests;
  }

  assertPerformance(config: {
    maxP95?: number;
    maxP99?: number;
    minThroughput?: number;
    maxErrorRate?: number;
  }): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    if (config.maxP95 && this.metrics.p95Duration > config.maxP95) {
      violations.push(`p95 (${this.metrics.p95Duration.toFixed(2)}ms) exceeds max (${config.maxP95}ms)`);
    }

    if (config.maxP99 && this.metrics.p99Duration > config.maxP99) {
      violations.push(`p99 (${this.metrics.p99Duration.toFixed(2)}ms) exceeds max (${config.maxP99}ms)`);
    }

    if (config.minThroughput && this.metrics.throughput < config.minThroughput) {
      violations.push(`Throughput (${this.metrics.throughput.toFixed(2)} req/s) below min (${config.minThroughput} req/s)`);
    }

    if (config.maxErrorRate && this.metrics.errorRate > config.maxErrorRate) {
      violations.push(`Error rate (${(this.metrics.errorRate * 100).toFixed(2)}%) exceeds max (${(config.maxErrorRate * 100).toFixed(2)}%)`);
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR TESTING
// ============================================================================

export async function createSimulatedAPIRequest(
  baseUrl: string,
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    responseDelay?: number;
    failureRate?: number;
  } = {}
): Promise<Response> {
  const url = `${baseUrl}${endpoint}`;

  if (options.responseDelay) {
    await new Promise((resolve) => setTimeout(resolve, options.responseDelay));
  }

  if (options.failureRate && Math.random() < options.failureRate) {
    throw new Error('Simulated failure');
  }

  try {
    return await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw error;
  }
}

export function analyzeResponseTimes(durations: number[]): {
  distribution: Record<string, number>;
  percentiles: Record<string, number>;
} {
  const ranges = [
    { name: '0-100ms', min: 0, max: 100 },
    { name: '100-500ms', min: 100, max: 500 },
    { name: '500-1000ms', min: 500, max: 1000 },
    { name: '1000-5000ms', min: 1000, max: 5000 },
    { name: '>5000ms', min: 5000, max: Infinity },
  ];

  const distribution: Record<string, number> = {};
  ranges.forEach((range) => {
    distribution[range.name] = durations.filter((d) => d >= range.min && d < range.max).length;
  });

  const sorted = [...durations].sort((a, b) => a - b);
  const percentiles = {
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
  };

  return { distribution, percentiles };
}
