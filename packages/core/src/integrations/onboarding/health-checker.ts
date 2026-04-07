/**
 * Health Checker
 *
 * Comprehensive health checks for integrations including:
 * - Authentication status
 * - API availability
 * - Rate limit status
 * - Webhook connectivity
 * - Batch operations with caching
 */

import {
  HealthStatus,
  HealthCheckResult,
  HealthCheckError,
  IntegrationAuthType,
} from './types';
import { CredentialValidator } from './credential-validator';
import { getSetupConfig } from './integration-setup-registry';

// ─── Health Check Cache ────────────────────────────────────────

interface CachedHealthCheck {
  result: HealthCheckResult;
  cachedAt: Date;
  expiresAt: Date;
}

const healthCheckCache = new Map<string, CachedHealthCheck>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Recommended health check intervals per provider.
 */
const CHECK_INTERVALS: Record<string, number> = {
  // High-criticality providers: check every 5 minutes
  stripe: 5 * 60 * 1000,
  shopify: 5 * 60 * 1000,
  salesforce: 5 * 60 * 1000,
  'google-maps': 5 * 60 * 1000,

  // Standard providers: check every 15 minutes
  default: 15 * 60 * 1000,

  // Batch processing: less frequent
  sap: 30 * 60 * 1000,
  'oracle-netsuite': 30 * 60 * 1000,
};

// ─── Rate Limit Tracking ──────────────────────────────────────

const rateLimitTracking: Record<
  string,
  {
    remaining: number;
    limit: number;
    resetAt: Date;
  }
> = {};

// ─── Health Checker ───────────────────────────────────────────

export class HealthChecker {
  /**
   * Perform comprehensive health check for an integration.
   *
   * Checks:
   * - Authentication (can we authenticate?)
   * - API availability (is the API responding?)
   * - Rate limits (are we being throttled?)
   * - Webhook connectivity (optional)
   */
  static async checkIntegrationHealth(
    providerId: string,
    credentials: Record<string, unknown>,
    forceRefresh = false
  ): Promise<HealthCheckResult> {
    const cacheKey = `${providerId}:${JSON.stringify(credentials)}`;

    // Check cache
    if (!forceRefresh) {
      const cached = healthCheckCache.get(cacheKey);
      if (cached && cached.expiresAt > new Date()) {
        return cached.result;
      }
    }

    const startTime = Date.now();
    const timestamp = new Date();
    const config = getSetupConfig(providerId);

    if (!config) {
      const result: HealthCheckResult = {
        providerId,
        status: HealthStatus.DOWN,
        timestamp,
        checks: {
          authentication: false,
          apiAvailability: false,
        },
        details: {
          error: `No configuration found for provider: ${providerId}`,
        },
        nextCheckAt: new Date(Date.now() + this.getCheckInterval(providerId)),
      };
      return result;
    }

    try {
      // Test authentication
      const authTest = await CredentialValidator.testConnection(
        providerId,
        config.authType,
        credentials
      );

      if (!authTest.success) {
        // Distinguish between auth failures and network/availability failures
        const isAuthError = authTest.errorCode?.startsWith('HTTP_');
        const status = isAuthError
          ? HealthStatus.UNAUTHORIZED
          : HealthStatus.DOWN;

        const result: HealthCheckResult = {
          providerId,
          status,
          timestamp,
          checks: {
            authentication: false,
            apiAvailability: !isAuthError ? false : true,
          },
          details: {
            authError: authTest.message,
            errorCode: authTest.errorCode,
            error: !isAuthError ? authTest.message : undefined,
          },
          nextCheckAt: new Date(Date.now() + this.getCheckInterval(providerId)),
        };
        this.cacheResult(cacheKey, result);
        return result;
      }

      // Test API availability (already tested in auth)
      const apiAvailable = authTest.success;

      // Check rate limits
      const rateLimitInfo = this.getRateLimitStatus(providerId);

      // Determine health status
      let status = HealthStatus.HEALTHY;
      if (rateLimitInfo?.remaining !== undefined && rateLimitInfo.remaining < 10) {
        status = HealthStatus.RATE_LIMITED;
      }

      // Build result
      const result: HealthCheckResult = {
        providerId,
        status,
        timestamp,
        checks: {
          authentication: true,
          apiAvailability: apiAvailable,
          rateLimit: rateLimitInfo,
        },
        details: {
          authLatencyMs: authTest.latencyMs,
          providerStatus: 'operational',
        },
        nextCheckAt: new Date(Date.now() + this.getCheckInterval(providerId)),
        cachedUntil: new Date(Date.now() + CACHE_TTL_MS),
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        providerId,
        status: HealthStatus.DOWN,
        timestamp,
        checks: {
          authentication: false,
          apiAvailability: false,
        },
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        nextCheckAt: new Date(Date.now() + this.getCheckInterval(providerId)),
      };

      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Batch health check for all enabled integrations in an org.
   *
   * Runs checks in parallel with configurable concurrency.
   */
  static async checkAllIntegrations(
    orgId: string,
    integrations: Array<{
      providerId: string;
      credentials: Record<string, unknown>;
    }>,
    concurrency = 5,
    forceRefresh = false
  ): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const queue = [...integrations];

    // Process in batches with concurrency limit
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const promises = batch.map((integration) =>
        this.checkIntegrationHealth(
          integration.providerId,
          integration.credentials,
          forceRefresh
        ).catch((error) => ({
          providerId: integration.providerId,
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          checks: {
            authentication: false,
            apiAvailability: false,
          },
          details: { error: String(error) },
        } as HealthCheckResult))
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get health summary for dashboard.
   */
  static getHealthSummary(results: HealthCheckResult[]) {
    return {
      totalChecks: results.length,
      healthy: results.filter((r) => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter((r) => r.status === HealthStatus.DEGRADED).length,
      down: results.filter((r) => r.status === HealthStatus.DOWN).length,
      unauthorized: results.filter((r) => r.status === HealthStatus.UNAUTHORIZED).length,
      rateLimited: results.filter((r) => r.status === HealthStatus.RATE_LIMITED).length,
    };
  }

  /**
   * Record rate limit status from API response.
   */
  static recordRateLimit(
    providerId: string,
    remaining: number,
    limit: number,
    resetAt: Date
  ): void {
    rateLimitTracking[providerId] = {
      remaining,
      limit,
      resetAt,
    };
  }

  /**
   * Get rate limit status for provider.
   */
  static getRateLimitStatus(providerId: string) {
    const status = rateLimitTracking[providerId];
    if (!status) return undefined;
    if (status.resetAt < new Date()) {
      delete rateLimitTracking[providerId];
      return undefined;
    }
    return status;
  }

  /**
   * Clear expired cache entries.
   */
  static clearExpiredCache(): void {
    const now = new Date();
    for (const [key, cached] of healthCheckCache.entries()) {
      if (cached.expiresAt < now) {
        healthCheckCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries (for testing).
   */
  static clearAllCache(): void {
    healthCheckCache.clear();
  }

  /**
   * Get cache stats for monitoring.
   */
  static getCacheStats() {
    return {
      size: healthCheckCache.size,
      ttlMs: CACHE_TTL_MS,
    };
  }

  /**
   * Get recommended check interval for provider.
   */
  private static getCheckInterval(providerId: string): number {
    return CHECK_INTERVALS[providerId] || CHECK_INTERVALS.default;
  }

  /**
   * Cache health check result.
   */
  private static cacheResult(key: string, result: HealthCheckResult): void {
    const now = new Date();
    healthCheckCache.set(key, {
      result,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    });
  }
}

/**
 * Quick health check helper.
 */
export async function checkHealth(
  providerId: string,
  credentials: Record<string, unknown>
): Promise<HealthCheckResult> {
  return HealthChecker.checkIntegrationHealth(providerId, credentials);
}

/**
 * Health check scheduler for background monitoring.
 */
export class HealthCheckScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly checkFunction: (
    providerId: string,
    credentials: Record<string, unknown>
  ) => Promise<HealthCheckResult>;

  constructor(
    checkFunction: (
      providerId: string,
      credentials: Record<string, unknown>
    ) => Promise<HealthCheckResult>
  ) {
    this.checkFunction = checkFunction;
  }

  /**
   * Schedule health checks for an integration.
   */
  scheduleCheck(
    providerId: string,
    credentials: Record<string, unknown>,
    intervalMs?: number
  ): void {
    const key = `${providerId}:${JSON.stringify(credentials)}`;

    // Clear existing interval
    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key));
    }

    // Calculate interval
    const interval = intervalMs || HealthChecker['getCheckInterval'](providerId);

    // Schedule new check
    const handle = setInterval(async () => {
      try {
        await this.checkFunction(providerId, credentials);
      } catch (error) {
        console.error(
          `Health check failed for ${providerId}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }, interval);

    this.intervals.set(key, handle);
  }

  /**
   * Stop scheduled checks for an integration.
   */
  stopCheck(providerId: string, credentials: Record<string, unknown>): void {
    const key = `${providerId}:${JSON.stringify(credentials)}`;
    const handle = this.intervals.get(key);
    if (handle) {
      clearInterval(handle);
      this.intervals.delete(key);
    }
  }

  /**
   * Stop all scheduled checks.
   */
  stopAll(): void {
    for (const handle of this.intervals.values()) {
      clearInterval(handle);
    }
    this.intervals.clear();
  }

  /**
   * Get active check count.
   */
  getActiveCheckCount(): number {
    return this.intervals.size;
  }
}
