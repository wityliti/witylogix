/**
 * Platform Health Check Service
 *
 * Comprehensive health monitoring with:
 * - Database connectivity and query latency checks
 * - Redis availability and memory usage
 * - External service integration checks
 * - System metrics (CPU, memory, uptime, request count)
 * - Prometheus-compatible metrics output
 * - Configurable health thresholds
 */

import { PrismaClient } from "@witylogix/db";
import type { Redis } from "ioredis";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

// ─── Types ──────────────────────────────────────────────────────

export type HealthStatusType = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatusType;
  latency: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number; // percent
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percentage: number; // percent
  };
  uptime: number; // seconds
  timestamp: string;
}

export interface HealthStatus {
  status: HealthStatusType;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    externalServices: Record<string, HealthCheckResult>;
  };
  metrics: SystemMetrics;
  uptime: number; // seconds
  version: string;
  timestamp: string;
  requestCount?: number;
}

export interface HealthCheckConfig {
  databaseQueryTimeout?: number; // ms
  redisTimeout?: number; // ms
  externalServiceTimeout?: number; // ms
  memoryWarningThreshold?: number; // percent (default: 80)
  memoryErrorThreshold?: number; // percent (default: 95)
}

export interface PrometheusMetrics {
  uptime: number;
  requestCount: number;
  errorCount: number;
  databaseLatency: number;
  redisLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

// ─── Health Check Service ───────────────────────────────────────

export class PlatformHealthService {
  private prisma: PrismaClientInstance;
  private redis: Redis;
  private config: Required<HealthCheckConfig>;
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(
    prisma: PrismaClientInstance,
    redis: Redis,
    config?: HealthCheckConfig,
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.config = {
      databaseQueryTimeout: config?.databaseQueryTimeout ?? 5000,
      redisTimeout: config?.redisTimeout ?? 2000,
      externalServiceTimeout: config?.externalServiceTimeout ?? 5000,
      memoryWarningThreshold: config?.memoryWarningThreshold ?? 80,
      memoryErrorThreshold: config?.memoryErrorThreshold ?? 95,
    };
  }

  /**
   * Get overall health status (for load balancers)
   * Fast check: only critical services
   */
  public async getQuickHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Quick database check
      await Promise.race([
        (this.prisma as any).$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("DB timeout")),
            this.config.databaseQueryTimeout,
          ),
        ),
      ]);

      const latency = performance.now() - startTime;

      return {
        status: "healthy",
        latency,
      };
    } catch (error: unknown) {
      const latency = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      return {
        status: "unhealthy",
        latency,
        error: errorMsg,
      };
    }
  }

  /**
   * Get detailed health status (for monitoring dashboards)
   */
  public async getDetailedHealth(): Promise<HealthStatus> {
    const startTime = performance.now();

    const [database, redis, metrics] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.getSystemMetrics(),
    ]);

    const externalServices: Record<string, HealthCheckResult> = {};

    // Add external service checks if configured
    if (process.env.SHOPIFY_API_URL) {
      externalServices.shopify = await this.checkExternalService(
        "https://admin.shopify.com",
        "Shopify",
      );
    }

    if (process.env.MAILGUN_DOMAIN) {
      externalServices.mailgun = await this.checkExternalService(
        "https://api.mailgun.net",
        "Mailgun",
      );
    }

    // Determine overall status
    const checkResults = [database, redis, ...Object.values(externalServices)];
    const status = this.determineOverallStatus(checkResults);

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status,
      checks: {
        database,
        redis,
        externalServices,
      },
      metrics,
      uptime,
      version: process.env.APP_VERSION ?? "1.0.0",
      timestamp: new Date().toISOString(),
      requestCount: this.requestCount,
    };
  }

  /**
   * Check PostgreSQL connectivity and query latency
   */
  public async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const result = await Promise.race([
        (this.prisma as any).$queryRaw`SELECT NOW() as timestamp, 1 as result`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Database query timeout")),
            this.config.databaseQueryTimeout,
          ),
        ),
      ]);

      const latency = performance.now() - startTime;

      return {
        status: latency > 1000 ? "degraded" : "healthy",
        latency: Math.round(latency),
        details: {
          driver: "postgresql",
          queryTime: `${latency.toFixed(2)}ms`,
        },
      };
    } catch (error: unknown) {
      const latency = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.errorCount++;

      return {
        status: "unhealthy",
        latency: Math.round(latency),
        error: errorMsg,
        details: {
          driver: "postgresql",
        },
      };
    }
  }

  /**
   * Check Redis connectivity and memory usage
   */
  public async checkRedis(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const result: any = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Redis ping timeout")),
            this.config.redisTimeout,
          ),
        ),
      ]);

      const latency = performance.now() - startTime;

      // Get memory info
      let memoryUsage = 0;
      try {
        const infoStr: string = await this.redis.info("memory");
        const match = infoStr.match(/used_memory:(\d+)/);
        if (match) {
          memoryUsage = parseInt(match[1], 10);
        }
      } catch {
        // Silently ignore memory info errors
      }

      return {
        status: latency > 500 ? "degraded" : "healthy",
        latency: Math.round(latency),
        details: {
          driver: "redis",
          memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
          ping: result === "PONG" ? "success" : "failed",
        },
      };
    } catch (error: unknown) {
      const latency = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.errorCount++;

      return {
        status: "unhealthy",
        latency: Math.round(latency),
        error: errorMsg,
        details: {
          driver: "redis",
        },
      };
    }
  }

  /**
   * Check external service availability (via HEAD request)
   */
  public async checkExternalService(
    url: string,
    serviceName: string,
  ): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const response = await Promise.race([
        fetch(url, { method: "HEAD", redirect: "follow" }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timeout")),
            this.config.externalServiceTimeout,
          ),
        ),
      ]);

      const latency = performance.now() - startTime;
      const statusCode = response.status;

      // Consider 2xx and 3xx as healthy, 4xx/5xx as issues
      const isHealthy = statusCode >= 200 && statusCode < 400;
      const status = isHealthy ? "healthy" : "degraded";

      return {
        status,
        latency: Math.round(latency),
        details: {
          service: serviceName,
          statusCode,
          url,
        },
      };
    } catch (error: unknown) {
      const latency = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.errorCount++;

      return {
        status: "unhealthy",
        latency: Math.round(latency),
        error: errorMsg,
        details: {
          service: serviceName,
          url,
        },
      };
    }
  }

  /**
   * Get system metrics (CPU, memory, uptime)
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const totalMemory = 1024 * 1024 * 1024; // Assume 1GB for example

    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const uptime = process.uptime();
    const cpuPercentage = (totalCpuTime / (uptime * 1000000)) * 100;

    const memoryPercentage = (memUsage.heapUsed / totalMemory) * 100;

    return {
      cpu: {
        usage: Math.min(cpuPercentage, 100),
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: memoryPercentage,
      },
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get Prometheus-compatible metrics
   */
  public async getPrometheusMetrics(): Promise<string> {
    const health = await this.getDetailedHealth();
    const metrics = health.metrics;

    const lines: string[] = [
      "# HELP app_uptime_seconds Application uptime in seconds",
      "# TYPE app_uptime_seconds gauge",
      `app_uptime_seconds ${health.uptime}`,
      "",
      "# HELP app_requests_total Total HTTP requests processed",
      "# TYPE app_requests_total counter",
      `app_requests_total ${this.requestCount}`,
      "",
      "# HELP app_errors_total Total errors occurred",
      "# TYPE app_errors_total counter",
      `app_errors_total ${this.errorCount}`,
      "",
      "# HELP db_query_latency_ms Database query latency in milliseconds",
      "# TYPE db_query_latency_ms gauge",
      `db_query_latency_ms ${health.checks.database.latency}`,
      "",
      "# HELP redis_latency_ms Redis operation latency in milliseconds",
      "# TYPE redis_latency_ms gauge",
      `redis_latency_ms ${health.checks.redis.latency}`,
      "",
      "# HELP process_memory_bytes Process memory usage in bytes",
      "# TYPE process_memory_bytes gauge",
      `process_memory_bytes ${metrics.memory.used}`,
      "",
      "# HELP process_cpu_usage_percent CPU usage percentage",
      "# TYPE process_cpu_usage_percent gauge",
      `process_cpu_usage_percent ${metrics.cpu.usage}`,
      "",
      "# HELP health_check_status Overall health status (1=healthy, 0.5=degraded, 0=unhealthy)",
      "# TYPE health_check_status gauge",
      `health_check_status ${this.statusToNumber(health.status)}`,
    ];

    // Add external service metrics
    for (const [serviceName, check] of Object.entries(
      health.checks.externalServices,
    )) {
      lines.push("");
      lines.push(
        `# HELP external_service_${serviceName}_latency_ms ${serviceName} latency`,
      );
      lines.push(`# TYPE external_service_${serviceName}_latency_ms gauge`);
      lines.push(`external_service_${serviceName}_latency_ms ${check.latency}`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Format health status as text for monitoring
   */
  public formatHealthStatusText(health: HealthStatus): string {
    const lines: string[] = [
      `Status: ${health.status.toUpperCase()}`,
      `Version: ${health.version}`,
      `Uptime: ${health.uptime}s`,
      `Timestamp: ${health.timestamp}`,
      "",
      `Database: ${health.checks.database.status} (${health.checks.database.latency}ms)`,
      `Redis: ${health.checks.redis.status} (${health.checks.redis.latency}ms)`,
      "",
      `Memory: ${health.metrics.memory.percentage.toFixed(1)}% (${(health.metrics.memory.used / 1024 / 1024).toFixed(2)}MB)`,
      `CPU: ${health.metrics.cpu.usage.toFixed(1)}%`,
      `Requests: ${health.requestCount ?? 0}`,
    ];

    if (Object.keys(health.checks.externalServices).length > 0) {
      lines.push("");
      lines.push("External Services:");
      for (const [name, check] of Object.entries(
        health.checks.externalServices,
      )) {
        lines.push(`  ${name}: ${check.status} (${check.latency}ms)`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Record HTTP request for metrics
   */
  public recordRequest(): void {
    this.requestCount++;
  }

  /**
   * Record error for metrics
   */
  public recordError(): void {
    this.errorCount++;
  }

  /**
   * Determine overall status from check results
   */
  private determineOverallStatus(
    checks: HealthCheckResult[],
  ): HealthStatusType {
    const statuses = checks.map((c) => c.status);

    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    }

    if (statuses.includes("degraded")) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Convert status to numeric value for Prometheus
   */
  private statusToNumber(status: HealthStatusType): number {
    switch (status) {
      case "healthy":
        return 1;
      case "degraded":
        return 0.5;
      case "unhealthy":
        return 0;
      default:
        return 0;
    }
  }
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(
  signal: string,
  services: {
    prisma?: PrismaClientInstance;
    redis?: Redis;
    httpServer?: any;
  },
): Promise<void> {
  console.log(`[Shutdown] Received ${signal}`);

  const gracePeriod = 30000; // 30 seconds
  let finished = false;

  const timeoutHandle = setTimeout(() => {
    if (!finished) {
      console.error("[Shutdown] Grace period exceeded, forcing shutdown");
      process.exit(1);
    }
  }, gracePeriod);

  try {
    console.log("[Shutdown] Closing HTTP server");
    if (services.httpServer) {
      await new Promise<void>((resolve, reject) => {
        services.httpServer.close((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log("[Shutdown] Closing Redis connection");
    if (services.redis) {
      await services.redis.quit();
    }

    console.log("[Shutdown] Closing Prisma connection");
    if (services.prisma) {
      await services.prisma.$disconnect();
    }

    finished = true;
    clearTimeout(timeoutHandle);

    console.log("[Shutdown] Graceful shutdown complete");
    process.exit(0);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Shutdown] Error during shutdown:", errorMsg);
    process.exit(1);
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupSignalHandlers(services: {
  prisma?: PrismaClientInstance;
  redis?: Redis;
  httpServer?: any;
}): void {
  const signals = ["SIGTERM", "SIGINT"];

  for (const signal of signals) {
    process.on(signal, () => {
      gracefulShutdown(signal, services).catch((error) => {
        console.error("Shutdown error:", error);
        process.exit(1);
      });
    });
  }

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    console.error("[Fatal] Uncaught exception:", error);
    gracefulShutdown("uncaughtException", services).catch(() => {
      process.exit(1);
    });
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("[Fatal] Unhandled rejection:", reason);
    gracefulShutdown("unhandledRejection", services).catch(() => {
      process.exit(1);
    });
  });
}
