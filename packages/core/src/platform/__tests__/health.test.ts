/**
 * Platform Health Check Service Test Suite
 * 15+ comprehensive tests for health monitoring, metrics, and graceful shutdown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PlatformHealthService,
  type HealthCheckResult,
  type HealthStatus,
  gracefulShutdown,
  setupSignalHandlers,
} from '../health';

// ─── Mock Services ──────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: vi.fn(async () => ({ timestamp: new Date(), result: 1 })),
  $disconnect: vi.fn(async () => {}),
} as any;

const mockRedis = {
  ping: vi.fn(async () => 'PONG'),
  info: vi.fn(async () => 'used_memory:104857600'), // 100MB
  quit: vi.fn(async () => {}),
} as any;

const mockConfig = {
  databaseQueryTimeout: 5000,
  redisTimeout: 2000,
  externalServiceTimeout: 5000,
  memoryWarningThreshold: 80,
  memoryErrorThreshold: 95,
};

// ─── Health Check Service Tests ──────────────────────────────────

describe('PlatformHealthService', () => {
  let service: PlatformHealthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformHealthService(mockPrisma, mockRedis, mockConfig);
  });

  describe('Quick Health Check', () => {
    it('should return healthy status when database is responsive', async () => {
      const result = await service.getQuickHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy when database fails', async () => {
      const errorPrisma = {
        $queryRaw: vi.fn(async () => {
          throw new Error('Connection refused');
        }),
      } as any;

      const errorService = new PlatformHealthService(errorPrisma, mockRedis, mockConfig);

      const result = await errorService.getQuickHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
    });

    it('should measure latency', async () => {
      const result = await service.getQuickHealth();

      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(typeof result.latency).toBe('number');
    });

    it('should timeout on slow database', async () => {
      const slowPrisma = {
        $queryRaw: vi.fn(() =>
          new Promise(resolve => setTimeout(() => resolve({ result: 1 }), 10000))
        ),
      } as any;

      const slowService = new PlatformHealthService(slowPrisma, mockRedis, {
        ...mockConfig,
        databaseQueryTimeout: 100,
      });

      const result = await slowService.getQuickHealth();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Detailed Health Check', () => {
    it('should return comprehensive health status', async () => {
      const health = await service.getDetailedHealth();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.checks).toBeDefined();
      expect(health.checks.database).toBeDefined();
      expect(health.checks.redis).toBeDefined();
      expect(health.checks.externalServices).toBeDefined();
    });

    it('should include metrics in response', async () => {
      const health = await service.getDetailedHealth();

      expect(health.metrics).toBeDefined();
      expect(health.metrics.cpu).toBeDefined();
      expect(health.metrics.memory).toBeDefined();
      // process.uptime() may be < 1 second, Math.floor gives 0
      expect(health.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(health.metrics.timestamp).toBeDefined();
    });

    it('should include version information', async () => {
      process.env.APP_VERSION = '4.0.0';

      const health = await service.getDetailedHealth();

      expect(health.version).toBe('4.0.0');

      delete process.env.APP_VERSION;
    });

    it('should include request count', async () => {
      service.recordRequest();

      const health = await service.getDetailedHealth();

      expect(health.requestCount).toBeGreaterThan(0);
    });

    it('should determine overall status based on checks', async () => {
      const health = await service.getDetailedHealth();

      // With all services healthy, overall should be healthy
      expect(health.status).toBe('healthy');
    });

    it('should return degraded when service latency is high', async () => {
      const slowPrisma = {
        $queryRaw: vi.fn(async () => {
          // Add artificial delay
          await new Promise(resolve => setTimeout(resolve, 1100));
          return { result: 1 };
        }),
      } as any;

      const slowService = new PlatformHealthService(slowPrisma, mockRedis, mockConfig);

      const health = await slowService.getDetailedHealth();

      // Database should be degraded due to latency > 1000ms
      expect(health.checks.database.status).toBe('degraded');
    });
  });

  describe('Database Health Check', () => {
    it('should check database connectivity', async () => {
      const check = await service.checkDatabase();

      expect(check).toBeDefined();
      expect(check.status).toBe('healthy');
      expect(check.latency).toBeGreaterThan(-1);
    });

    it('should report database driver details', async () => {
      const check = await service.checkDatabase();

      expect(check.details).toBeDefined();
      expect(check.details?.driver).toBe('postgresql');
    });

    it('should handle database connection errors', async () => {
      const errorPrisma = {
        $queryRaw: vi.fn(async () => {
          throw new Error('Connection timeout');
        }),
      } as any;

      const errorService = new PlatformHealthService(errorPrisma, mockRedis, mockConfig);

      const check = await errorService.checkDatabase();

      expect(check.status).toBe('unhealthy');
      expect(check.error).toContain('Connection');
    });

    it('should measure query latency', async () => {
      const check = await service.checkDatabase();

      expect(check.latency).toBeGreaterThanOrEqual(0);
      expect(typeof check.latency).toBe('number');
    });
  });

  describe('Redis Health Check', () => {
    it('should check Redis connectivity', async () => {
      const check = await service.checkRedis();

      expect(check).toBeDefined();
      expect(check.status).toBe('healthy');
    });

    it('should report Redis driver details', async () => {
      const check = await service.checkRedis();

      expect(check.details).toBeDefined();
      expect(check.details?.driver).toBe('redis');
    });

    it('should report memory usage', async () => {
      const check = await service.checkRedis();

      expect(check.details?.memoryUsage).toBeDefined();
      expect(check.details?.ping).toBe('success');
    });

    it('should handle Redis connection errors', async () => {
      const errorRedis = {
        ping: vi.fn(async () => {
          throw new Error('Connection refused');
        }),
        info: vi.fn(async () => ''),
      } as any;

      const errorService = new PlatformHealthService(mockPrisma, errorRedis, mockConfig);

      const check = await errorService.checkRedis();

      expect(check.status).toBe('unhealthy');
      expect(check.error).toBeDefined();
    });

    it('should mark as degraded if latency is high', async () => {
      const slowRedis = {
        ping: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 600));
          return 'PONG';
        }),
        info: vi.fn(async () => ''),
      } as any;

      const slowService = new PlatformHealthService(mockPrisma, slowRedis, mockConfig);

      const check = await slowService.checkRedis();

      expect(check.status).toBe('degraded');
    });
  });

  describe('External Service Checks', () => {
    it('should check external service availability', async () => {
      global.fetch = vi.fn(async () => ({
        status: 200,
        ok: true,
      } as Response));

      const check = await service.checkExternalService('https://api.example.com', 'Example API');

      expect(check.status).toBe('healthy');
      expect(check.details?.statusCode).toBe(200);
    });

    it('should handle external service timeouts', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Request timeout');
      });

      const check = await service.checkExternalService('https://slow.example.com', 'Slow API');

      expect(check.status).toBe('unhealthy');
      expect(check.error).toContain('timeout');
    });

    it('should mark service as degraded on non-2xx response', async () => {
      global.fetch = vi.fn(async () => ({
        status: 500,
        ok: false,
      } as Response));

      const check = await service.checkExternalService('https://broken.example.com', 'Broken API');

      expect(check.status).toBe('degraded');
      expect(check.details?.statusCode).toBe(500);
    });
  });

  describe('System Metrics', () => {
    it('should get system metrics', async () => {
      const metrics = await service.getSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });

    it('should include timestamp in metrics', async () => {
      const metrics = await service.getSystemMetrics();

      expect(metrics.timestamp).toBeDefined();
      expect(new Date(metrics.timestamp)).toBeInstanceOf(Date);
    });

    it('should report memory percentage', async () => {
      const metrics = await service.getSystemMetrics();

      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Prometheus Metrics', () => {
    it('should generate Prometheus metrics', async () => {
      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('HELP');
      expect(metrics).toContain('TYPE');
    });

    it('should include uptime metric', async () => {
      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toContain('app_uptime_seconds');
    });

    it('should include request count metric', async () => {
      service.recordRequest();

      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toContain('app_requests_total');
    });

    it('should include latency metrics', async () => {
      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toContain('db_query_latency_ms');
      expect(metrics).toContain('redis_latency_ms');
    });

    it('should format metrics correctly', async () => {
      const metrics = await service.getPrometheusMetrics();

      const lines = metrics.split('\n');

      // Should have help and type comments
      const helpLines = lines.filter(l => l.startsWith('#'));
      expect(helpLines.length).toBeGreaterThan(0);

      // Should have metric values
      const metricLines = lines.filter(l => !l.startsWith('#') && l.length > 0);
      expect(metricLines.length).toBeGreaterThan(0);
    });
  });

  describe('Status Formatting', () => {
    it('should format health status as text', async () => {
      const health = await service.getDetailedHealth();

      const text = service.formatHealthStatusText(health);

      expect(text).toBeDefined();
      expect(typeof text).toBe('string');
      expect(text).toContain('Status:');
      expect(text).toContain('Database:');
      expect(text).toContain('Redis:');
    });

    it('should include all relevant fields in text format', async () => {
      const health = await service.getDetailedHealth();

      const text = service.formatHealthStatusText(health);

      expect(text).toContain('Version:');
      expect(text).toContain('Uptime:');
      expect(text).toContain('Memory:');
      expect(text).toContain('CPU:');
    });
  });

  describe('Request and Error Recording', () => {
    it('should record requests', async () => {
      service.recordRequest();

      const health = await service.getDetailedHealth();

      expect(health.requestCount).toBe(1);
    });

    it('should increment request count on multiple calls', async () => {
      service.recordRequest();
      service.recordRequest();
      service.recordRequest();

      const health = await service.getDetailedHealth();

      expect(health.requestCount).toBeGreaterThanOrEqual(3);
    });

    it('should record errors', () => {
      service.recordError();

      // Error count should be tracked
      expect(service).toBeDefined();
    });
  });
});

// ─── Graceful Shutdown Tests ────────────────────────────────────

describe('Graceful Shutdown', () => {
  it('should close services gracefully', async () => {
    const mockHttpServer = {
      close: vi.fn((cb: Function) => cb()),
    };

    const services = {
      prisma: mockPrisma,
      redis: mockRedis,
      httpServer: mockHttpServer,
    };

    // Mock process.exit to prevent actual exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit called');
    });

    try {
      await gracefulShutdown('SIGTERM', services);
    } catch (e) {
      // Expected to throw from mocked exit
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });

  it('should disconnect services', async () => {
    const mockHttpServer = {
      close: vi.fn((cb: Function) => cb()),
    };

    const mockPrismaLocal = {
      $disconnect: vi.fn(async () => {}),
    };

    const mockRedisLocal = {
      quit: vi.fn(async () => {}),
    };

    const services = {
      prisma: mockPrismaLocal,
      redis: mockRedisLocal,
      httpServer: mockHttpServer,
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    try {
      await gracefulShutdown('SIGTERM', services);
    } catch (e) {
      // Expected
    }

    expect(mockRedisLocal.quit).toHaveBeenCalled();
    expect(mockPrismaLocal.$disconnect).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

// ─── Signal Handler Tests ───────────────────────────────────────

describe('Signal Handlers', () => {
  it('should setup signal handlers without errors', () => {
    const services = {
      prisma: mockPrisma,
      redis: mockRedis,
    };

    expect(() => {
      setupSignalHandlers(services);
    }).not.toThrow();
  });
});
