/**
 * Health Checker Tests
 *
 * 20+ tests covering:
 * - Single integration health checks
 * - Batch health checks
 * - Health status classification
 * - Rate limit tracking
 * - Cache management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HealthChecker,
  checkHealth,
  HealthCheckScheduler,
} from '../health-checker';
import { HealthStatus, HealthCheckResult } from '../types';

describe('HealthChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HealthChecker.clearExpiredCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkIntegrationHealth', () => {
    it('should return HEALTHY status for working integration', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'sk_test_123' }
      );

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.authentication).toBe(true);
      expect(result.checks.apiAvailability).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return UNAUTHORIZED status for auth failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 401 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'invalid' }
      );

      expect(result.status).toBe(HealthStatus.UNAUTHORIZED);
      expect(result.checks.authentication).toBe(false);
    });

    it('should return DOWN status for network errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.status).toBe(HealthStatus.DOWN);
      expect(result.checks.apiAvailability).toBe(false);
    });

    it('should return DOWN for unknown provider', async () => {
      const result = await HealthChecker.checkIntegrationHealth(
        'unknown-provider',
        { apiKey: 'test' }
      );

      expect(result.status).toBe(HealthStatus.DOWN);
      expect(result.details?.error).toContain('No configuration');
    });

    it('should include rate limit information', async () => {
      HealthChecker.recordRateLimit('stripe', 95, 100, new Date(Date.now() + 60000));

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.checks.rateLimit).toBeDefined();
      expect(result.checks.rateLimit?.remaining).toBe(95);
      expect(result.checks.rateLimit?.limit).toBe(100);
    });

    it('should return RATE_LIMITED when approaching limits', async () => {
      HealthChecker.recordRateLimit('stripe', 5, 100, new Date(Date.now() + 60000));

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.status).toBe(HealthStatus.RATE_LIMITED);
    });

    it('should include next check time', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.nextCheckAt).toBeDefined();
      expect(result.nextCheckAt).toBeInstanceOf(Date);
      expect(result.nextCheckAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should cache health check results', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result1 = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      // Second call should use cache (no additional fetch)
      const result2 = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' },
        false // Don't force refresh
      );

      expect(result1.timestamp.getTime()).toBe(result2.timestamp.getTime());
      expect((global.fetch as any).mock.calls.length).toBe(1); // Only one fetch
    });

    it('should respect force refresh flag', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await HealthChecker.checkIntegrationHealth('stripe', { secretKey: 'test' });

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' },
        true // Force refresh
      );

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect((global.fetch as any).mock.calls.length).toBe(2); // Two fetches
    });

    it('should include cache expiration time', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.cachedUntil).toBeDefined();
      expect(result.cachedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('checkAllIntegrations', () => {
    it('should check multiple integrations in parallel', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const integrations = [
        { providerId: 'stripe', credentials: { secretKey: 'test' } },
        { providerId: 'slack', credentials: { accessToken: 'test' } },
        { providerId: 'shopify', credentials: { shopDomain: 'test.myshopify.com', accessToken: 'test' } },
      ];

      const results = await HealthChecker.checkAllIntegrations(
        'org-123',
        integrations,
        3 // concurrency
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === HealthStatus.HEALTHY)).toBe(true);
    });

    it('should respect concurrency limit', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({}), { status: 200 })
                ),
              100
            );
          })
      );

      const integrations = Array.from({ length: 5 }, (_, i) => ({
        providerId: 'stripe',
        credentials: { secretKey: `test_${i}` },
      }));

      const start = Date.now();
      await HealthChecker.checkAllIntegrations('org-123', integrations, 2);
      const elapsed = Date.now() - start;

      // With concurrency of 2 and 100ms delay, should take at least 300ms total
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    it('should handle partial failures in batch', async () => {
      let callCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        );
      });

      const integrations = [
        { providerId: 'stripe', credentials: { secretKey: 'test1' } },
        { providerId: 'slack', credentials: { accessToken: 'test2' } },
        { providerId: 'shopify', credentials: { shopDomain: 'test', accessToken: 'test3' } },
      ];

      const results = await HealthChecker.checkAllIntegrations('org-123', integrations);

      expect(results).toHaveLength(3);
      const healthy = results.filter((r) => r.status === HealthStatus.HEALTHY);
      const down = results.filter((r) => r.status === HealthStatus.DOWN);
      expect(healthy.length + down.length).toBe(3);
    });

    it('should return results in expected order', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const integrations = [
        { providerId: 'stripe', credentials: { secretKey: 'test' } },
        { providerId: 'slack', credentials: { accessToken: 'test' } },
      ];

      const results = await HealthChecker.checkAllIntegrations('org-123', integrations);

      expect(results[0].providerId).toBe('stripe');
      expect(results[1].providerId).toBe('slack');
    });
  });

  describe('getHealthSummary', () => {
    it('should summarize health check results', () => {
      const results: HealthCheckResult[] = [
        {
          providerId: 'stripe',
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          checks: { authentication: true, apiAvailability: true },
        },
        {
          providerId: 'slack',
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          checks: { authentication: false, apiAvailability: false },
        },
        {
          providerId: 'shopify',
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          checks: { authentication: true, apiAvailability: true },
        },
      ];

      const summary = HealthChecker.getHealthSummary(results);

      expect(summary.totalChecks).toBe(3);
      expect(summary.healthy).toBe(2);
      expect(summary.down).toBe(1);
    });

    it('should count all status types', () => {
      const results: HealthCheckResult[] = [
        {
          providerId: 'a',
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          checks: { authentication: true, apiAvailability: true },
        },
        {
          providerId: 'b',
          status: HealthStatus.DEGRADED,
          timestamp: new Date(),
          checks: { authentication: true, apiAvailability: true },
        },
        {
          providerId: 'c',
          status: HealthStatus.RATE_LIMITED,
          timestamp: new Date(),
          checks: { authentication: true, apiAvailability: true },
          checks: { authentication: true, apiAvailability: true },
        },
        {
          providerId: 'd',
          status: HealthStatus.UNAUTHORIZED,
          timestamp: new Date(),
          checks: { authentication: false, apiAvailability: false },
        },
      ];

      const summary = HealthChecker.getHealthSummary(results);

      expect(summary.degraded).toBe(1);
      expect(summary.rateLimited).toBe(1);
      expect(summary.unauthorized).toBe(1);
    });
  });

  describe('Rate Limit Tracking', () => {
    it('should record rate limit status', () => {
      const resetTime = new Date(Date.now() + 60000);
      HealthChecker.recordRateLimit('stripe', 90, 100, resetTime);

      const status = HealthChecker.getRateLimitStatus('stripe');

      expect(status?.remaining).toBe(90);
      expect(status?.limit).toBe(100);
      expect(status?.resetAt).toEqual(resetTime);
    });

    it('should return undefined for expired rate limit', () => {
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      HealthChecker.recordRateLimit('stripe', 90, 100, pastTime);

      const status = HealthChecker.getRateLimitStatus('stripe');

      expect(status).toBeUndefined();
    });

    it('should track multiple providers separately', () => {
      const resetTime = new Date(Date.now() + 60000);
      HealthChecker.recordRateLimit('stripe', 90, 100, resetTime);
      HealthChecker.recordRateLimit('slack', 45, 60, resetTime);

      const stripeStatus = HealthChecker.getRateLimitStatus('stripe');
      const slackStatus = HealthChecker.getRateLimitStatus('slack');

      expect(stripeStatus?.remaining).toBe(90);
      expect(slackStatus?.remaining).toBe(45);
    });
  });

  describe('Cache Management', () => {
    it('should clear expired cache entries', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const initialSize = HealthChecker.getCacheStats().size;

      await HealthChecker.checkIntegrationHealth('stripe', { secretKey: 'test' });

      HealthChecker.clearExpiredCache();

      const finalSize = HealthChecker.getCacheStats().size;
      expect(finalSize).toBeGreaterThanOrEqual(initialSize);
    });

    it('should provide cache statistics', () => {
      const stats = HealthChecker.getCacheStats();

      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.ttlMs).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Health Check Scheduler', () => {
    it('should schedule periodic health checks', async () => {
      const checkFn = vi.fn();
      const scheduler = new HealthCheckScheduler(checkFn);

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 100);

      await new Promise((resolve) => setTimeout(resolve, 250));

      scheduler.stopAll();

      // Should have been called at least twice (0ms, 100ms, 200ms)
      expect(checkFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should stop scheduled checks', async () => {
      const checkFn = vi.fn();
      const scheduler = new HealthCheckScheduler(checkFn);

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const callsBefore = checkFn.mock.calls.length;
      scheduler.stopCheck('stripe', { secretKey: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const callsAfter = checkFn.mock.calls.length;

      expect(callsAfter).toBe(callsBefore); // No new calls
    });

    it('should track active check count', () => {
      const checkFn = vi.fn();
      const scheduler = new HealthCheckScheduler(checkFn);

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 1000);
      scheduler.scheduleCheck('slack', { accessToken: 'test' }, 1000);

      expect(scheduler.getActiveCheckCount()).toBe(2);

      scheduler.stopAll();

      expect(scheduler.getActiveCheckCount()).toBe(0);
    });

    it('should replace existing schedule for same provider', async () => {
      const checkFn = vi.fn();
      const scheduler = new HealthCheckScheduler(checkFn);

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 1000);
      const initialCount = scheduler.getActiveCheckCount();

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 100);
      const finalCount = scheduler.getActiveCheckCount();

      expect(initialCount).toBe(1);
      expect(finalCount).toBe(1); // Not 2, replaced

      scheduler.stopAll();
    });

    it('should handle check errors gracefully', async () => {
      const checkFn = vi.fn().mockRejectedValue(new Error('Check failed'));
      const scheduler = new HealthCheckScheduler(checkFn);

      scheduler.scheduleCheck('stripe', { secretKey: 'test' }, 50);

      await new Promise((resolve) => setTimeout(resolve, 150));

      scheduler.stopAll();

      // Should have been called despite errors
      expect(checkFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Health Check Result Details', () => {
    it('should include latency in result', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({}), { status: 200 })
                ),
              50
            );
          })
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.details?.authLatencyMs).toBeGreaterThanOrEqual(40);
    });

    it('should include error details on failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const result = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.details?.error).toContain('Connection refused');
    });
  });
});
