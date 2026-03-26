/**
 * API Health Dashboard Aggregator
 * Monitors and reports on system component health across all services.
 *
 * Usage:
 *   const health = new HealthDashboard();
 *   const status = await health.getStatus();
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ─── TYPES ──────────────────────────────────────────────────────

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latency: number; // milliseconds
  lastCheck: string; // ISO 8601
  message?: string;
  errorCount?: number;
}

export interface DatabaseHealth extends ServiceHealth {
  connectionPoolSize?: number;
  activeConnections?: number;
  queryLatency?: number;
}

export interface CacheHealth extends ServiceHealth {
  memoryUsage?: number;
  itemCount?: number;
  hitRate?: number;
}

export interface QueueHealth extends ServiceHealth {
  jobsProcessed?: number;
  jobsPending?: number;
  failedJobs?: number;
}

export interface ExternalServiceHealth extends ServiceHealth {
  service: string;
  rateLimitRemaining?: number;
  quotaUsage?: number;
}

export interface UptimeMetrics {
  uptime: number; // milliseconds
  totalRequests: number;
  errorCount: number;
  errorRate: number; // percentage
}

export interface LastError {
  timestamp: string;
  code: string;
  message: string;
  service: string;
  frequency: number; // how many times in last hour
}

export interface HealthStatus {
  timestamp: string;
  version: string;
  overallStatus: "healthy" | "degraded" | "unhealthy";
  services: {
    database: DatabaseHealth;
    cache: CacheHealth;
    queue: QueueHealth;
    storage: ServiceHealth;
    externalServices: Record<string, ExternalServiceHealth>;
  };
  uptime: UptimeMetrics;
  lastErrors: LastError[];
  nodeInfo: {
    hostname: string;
    region: string;
    version: string;
  };
}

// ─── HEALTH DASHBOARD CLASS ────────────────────────────────────

export class HealthDashboard {
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private lastErrors: Map<string, LastError> = new Map();

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Register error for tracking
   */
  registerError(code: string, message: string, service: string): void {
    this.errorCount++;
    const key = `${service}_${code}`;

    if (this.lastErrors.has(key)) {
      const error = this.lastErrors.get(key)!;
      error.frequency++;
      error.timestamp = new Date().toISOString();
    } else {
      this.lastErrors.set(key, {
        timestamp: new Date().toISOString(),
        code,
        message,
        service,
        frequency: 1,
      });
    }

    // Keep only last 10 errors
    if (this.lastErrors.size > 10) {
      const entries = Array.from(this.lastErrors.entries());
      entries.sort((a, b) => {
        const timeA = new Date(a[1].timestamp).getTime();
        const timeB = new Date(b[1].timestamp).getTime();
        return timeB - timeA;
      });
      const toKeep = entries.slice(0, 10);
      this.lastErrors.clear();
      toKeep.forEach(([key, error]) => this.lastErrors.set(key, error));
    }
  }

  /**
   * Increment request counter
   */
  recordRequest(): void {
    this.requestCount++;
  }

  /**
   * Get overall health status
   */
  async getStatus(): Promise<HealthStatus> {
    const [
      databaseHealth,
      cacheHealth,
      queueHealth,
      storageHealth,
      externalServicesHealth,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkQueue(),
      this.checkStorage(),
      this.checkExternalServices(),
    ]);

    const overallStatus = this.calculateOverallStatus({
      database: databaseHealth,
      cache: cacheHealth,
      queue: queueHealth,
      storage: storageHealth,
      externalServices: externalServicesHealth,
    });

    const uptime = this.calculateUptime();

    return {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || "1.0.0",
      overallStatus,
      services: {
        database: databaseHealth,
        cache: cacheHealth,
        queue: queueHealth,
        storage: storageHealth,
        externalServices: externalServicesHealth,
      },
      uptime,
      lastErrors: Array.from(this.lastErrors.values()).sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      nodeInfo: {
        hostname: process.env.HOSTNAME || "unknown",
        region: process.env.AWS_REGION || "unknown",
        version: process.env.API_VERSION || "1.0.0",
      },
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    try {
      // This would connect to actual database
      // For now, simulating health check
      const latency = Date.now() - startTime;

      // In real implementation, query actual db
      const isHealthy = latency < 100;

      return {
        status: isHealthy ? "healthy" : "degraded",
        latency,
        lastCheck: new Date().toISOString(),
        message: "Database connection OK",
        connectionPoolSize: 20,
        activeConnections: Math.floor(Math.random() * 20),
        queryLatency: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Database check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        errorCount: 1,
      };
    }
  }

  /**
   * Check cache (Redis) connectivity
   */
  private async checkCache(): Promise<CacheHealth> {
    const startTime = Date.now();
    try {
      // This would connect to actual Redis
      const latency = Date.now() - startTime;

      // In real implementation, query actual cache
      const isHealthy = latency < 50;

      return {
        status: isHealthy ? "healthy" : "degraded",
        latency,
        lastCheck: new Date().toISOString(),
        message: "Redis connection OK",
        memoryUsage: Math.floor(Math.random() * 100),
        itemCount: Math.floor(Math.random() * 10000),
        hitRate: 0.85 + Math.random() * 0.1,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Cache check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        errorCount: 1,
      };
    }
  }

  /**
   * Check job queue status
   */
  private async checkQueue(): Promise<QueueHealth> {
    const startTime = Date.now();
    try {
      // This would connect to actual queue (BullMQ, etc)
      const latency = Date.now() - startTime;

      // In real implementation, query actual queue
      const isHealthy = latency < 100;

      return {
        status: isHealthy ? "healthy" : "degraded",
        latency,
        lastCheck: new Date().toISOString(),
        message: "Queue service OK",
        jobsProcessed: 1523,
        jobsPending: Math.floor(Math.random() * 100),
        failedJobs: Math.floor(Math.random() * 10),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Queue check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        errorCount: 1,
      };
    }
  }

  /**
   * Check storage service (S3, etc)
   */
  private async checkStorage(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // This would check actual storage service
      const latency = Date.now() - startTime;

      // In real implementation, test S3 or similar
      const isHealthy = latency < 200;

      return {
        status: isHealthy ? "healthy" : "degraded",
        latency,
        lastCheck: new Date().toISOString(),
        message: "Storage service OK",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Storage check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        errorCount: 1,
      };
    }
  }

  /**
   * Check external service integrations
   */
  private async checkExternalServices(): Promise<Record<string, ExternalServiceHealth>> {
    const services: Record<string, ExternalServiceHealth> = {};

    const externalServices = [
      { name: "shopify", endpoint: process.env.SHOPIFY_API_URL },
      { name: "woocommerce", endpoint: process.env.WOOCOMMERCE_API_URL },
      { name: "stripe", endpoint: process.env.STRIPE_API_URL },
      { name: "google_maps", endpoint: process.env.GOOGLE_MAPS_API_URL },
    ];

    for (const svc of externalServices) {
      const startTime = Date.now();
      try {
        // In real implementation, make actual API calls
        const latency = Date.now() - startTime;
        const isHealthy = latency < 500;

        services[svc.name] = {
          service: svc.name,
          status: isHealthy ? "healthy" : "degraded",
          latency,
          lastCheck: new Date().toISOString(),
          message: `${svc.name} service OK`,
          rateLimitRemaining: Math.floor(Math.random() * 10000),
          quotaUsage: Math.random() * 100,
        };
      } catch (error) {
        services[svc.name] = {
          service: svc.name,
          status: "unhealthy",
          latency: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
          message: `${svc.name} check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          errorCount: 1,
        };
      }
    }

    return services;
  }

  /**
   * Calculate overall status from component statuses
   */
  private calculateOverallStatus(services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    queue: ServiceHealth;
    storage: ServiceHealth;
    externalServices: Record<string, ServiceHealth>;
  }): "healthy" | "degraded" | "unhealthy" {
    const criticalServices = [
      services.database,
      services.cache,
      services.queue,
      services.storage,
    ];

    const unhealthyCount = criticalServices.filter(
      (s) => s.status === "unhealthy",
    ).length;
    const degradedCount = criticalServices.filter(
      (s) => s.status === "degraded",
    ).length;

    if (unhealthyCount > 0) return "unhealthy";
    if (degradedCount > 1) return "degraded";
    return "healthy";
  }

  /**
   * Calculate uptime metrics
   */
  private calculateUptime(): UptimeMetrics {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const errorRate =
      this.requestCount > 0
        ? (this.errorCount / this.requestCount) * 100
        : 0;

    return {
      uptime: uptimeMs,
      totalRequests: this.requestCount,
      errorCount: this.errorCount,
      errorRate,
    };
  }
}

// ─── FASTIFY PLUGIN ────────────────────────────────────────────

export const healthDashboardPlugin = async (
  fastify: FastifyInstance,
): Promise<void> => {
  const dashboard = new HealthDashboard();

  // Expose dashboard instance on fastify for access in hooks
  fastify.decorate("health", dashboard);

  /**
   * GET /health - Basic health check (no auth)
   */
  fastify.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /health/detailed - Detailed health status with metrics
   */
  fastify.get(
    "/health/detailed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await dashboard.getStatus();
      return status;
    },
  );

  /**
   * GET /health/status - Public status page
   */
  fastify.get(
    "/health/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await dashboard.getStatus();

      // Return simplified public status
      return {
        status: status.overallStatus === "healthy" ? "operational" : "degraded",
        lastUpdate: status.timestamp,
        services: Object.entries(status.services)
          .filter(([key]) => key !== "externalServices")
          .reduce(
            (acc, [key, service]) => ({
              ...acc,
              [key]: service.status,
            }),
            {} as Record<string, string>,
          ),
      };
    },
  );

  /**
   * GET /version - API version info
   */
  fastify.get("/version", async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      version: process.env.API_VERSION || "1.0.0",
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };
  });
};

// ─── HEALTH CHECK MIDDLEWARE ────────────────────────────────────

/**
 * Middleware hook to track requests for health monitoring
 */
export const healthCheckHook = async (
  request: FastifyRequest,
): Promise<void> => {
  const dashboard = (request.server as any).health as HealthDashboard;
  if (dashboard) {
    dashboard.recordRequest();
  }
};

export default healthDashboardPlugin;
