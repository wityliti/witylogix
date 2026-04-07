/**
 * Health Check Endpoints — Kubernetes-style health and readiness probes.
 *
 * Features:
 * - /health — basic liveness probe (200/503)
 * - /health/ready — readiness probe (checks dependencies)
 * - /health/startup — startup probe
 * - Component health checks (database, cache, queue, storage)
 * - Degraded state support (partial health)
 * - Response: { status, checks: [{ name, status, duration, message }] }
 *
 * Usage:
 * const checker = new HealthChecker();
 * checker.register("database", checkDB);
 * checker.register("cache", checkRedis);
 * const status = await checker.checkAll();
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type HealthStatus = "UP" | "DOWN" | "DEGRADED";

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  duration: number;
  durationMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  checks: ComponentHealth[];
}

export type HealthCheckFn = () => Promise<ComponentHealth>;

// ─── COMPONENT CHECKS ──────────────────────────────────────────────────

/**
 * Standard health check for database connectivity.
 */
export async function checkDatabase(
  query?: () => Promise<boolean>
): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    if (query) {
      const result = await query();
      if (!result) {
        throw new Error("Database query failed");
      }
    }

    return {
      name: "database",
      status: "UP",
      duration: Date.now() - start,
      details: { connected: true },
    };
  } catch (error) {
    return {
      name: "database",
      status: "DOWN",
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Standard health check for Redis/cache connectivity.
 */
export async function checkCache(
  ping?: () => Promise<string>
): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    if (ping) {
      const result = await ping();
      if (result !== "PONG") {
        throw new Error("Cache ping failed");
      }
    }

    return {
      name: "cache",
      status: "UP",
      duration: Date.now() - start,
      details: { connected: true },
    };
  } catch (error) {
    return {
      name: "cache",
      status: "DOWN",
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Standard health check for message queue.
 */
export async function checkQueue(
  checkConnection?: () => Promise<boolean>
): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    if (checkConnection) {
      const connected = await checkConnection();
      if (!connected) {
        throw new Error("Queue not connected");
      }
    }

    return {
      name: "queue",
      status: "UP",
      duration: Date.now() - start,
      details: { connected: true },
    };
  } catch (error) {
    return {
      name: "queue",
      status: "DOWN",
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Standard health check for file storage.
 */
export async function checkStorage(
  testWrite?: () => Promise<boolean>
): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    if (testWrite) {
      const result = await testWrite();
      if (!result) {
        throw new Error("Storage write test failed");
      }
    }

    return {
      name: "storage",
      status: "UP",
      duration: Date.now() - start,
      details: { writable: true },
    };
  } catch (error) {
    return {
      name: "storage",
      status: "DOWN",
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── HEALTH CHECKER ────────────────────────────────────────────────────

/**
 * Manages health checks for service components.
 */
export class HealthChecker {
  private checks = new Map<string, HealthCheckFn>();
  private startTime = Date.now();
  private lastCheckTime = Date.now();
  private lastCheckResult: HealthCheckResponse | null = null;

  /**
   * Register a health check function.
   */
  register(name: string, fn: HealthCheckFn): void {
    this.checks.set(name, fn);
  }

  /**
   * Run a single health check by name.
   */
  async check(name: string): Promise<ComponentHealth | null> {
    const fn = this.checks.get(name);
    if (!fn) {
      return null;
    }

    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      return {
        ...result,
        name,
        duration: duration,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        name,
        status: "DOWN",
        duration: duration,
        durationMs: duration,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unregister a health check.
   */
  unregister(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Perform liveness probe — basic health check.
   */
  async getLiveness(): Promise<HealthCheckResponse> {
    return {
      status: "UP",
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      checks: [],
    };
  }

  /**
   * Perform readiness probe — check all components.
   */
  async getReadiness(): Promise<HealthCheckResponse> {
    return this.checkAll();
  }

  /**
   * Perform startup probe — comprehensive check.
   */
  async getStartup(): Promise<HealthCheckResponse> {
    return this.checkAll();
  }

  /**
   * Check a single component.
   */
  async checkComponent(name: string): Promise<ComponentHealth | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return null;
    }

    const start = Date.now();
    try {
      const result = await checkFn();
      const elapsed = Date.now() - start;
      return { ...result, duration: elapsed };
    } catch (error) {
      const elapsed = Date.now() - start;
      return {
        name,
        status: "DOWN",
        duration: elapsed,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check all registered components.
   */
  async checkAll(): Promise<HealthCheckResponse> {
    const results: ComponentHealth[] = [];
    const checkStart = Date.now();

    // Run all checks in parallel with duration measurement
    const promises = Array.from(this.checks.values()).map(async (checkFn) => {
      const start = Date.now();
      try {
        const result = await checkFn();
        const duration = Date.now() - start;
        return {
          ...result,
          duration: duration,
          durationMs: duration,
        };
      } catch (error) {
        const duration = Date.now() - start;
        return {
          name: "unknown",
          status: "DOWN" as const,
          duration: duration,
          durationMs: duration,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const componentResults = await Promise.all(promises);
    results.push(...componentResults);

    // Determine overall status
    const overallStatus = this.determineStatus(results);

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      checks: results.sort((a, b) => a.name.localeCompare(b.name)),
    };

    // Cache the result
    this.lastCheckTime = Date.now();
    this.lastCheckResult = response;

    return response;
  }

  /**
   * Get the last check result (cached).
   */
  getLastCheck(): HealthCheckResponse | null {
    return this.lastCheckResult;
  }

  /**
   * Get time since last health check.
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastCheckTime;
  }

  /**
   * Determine overall status from component results.
   */
  private determineStatus(checks: ComponentHealth[]): HealthStatus {
    if (checks.length === 0) {
      return "UP";
    }

    // If any check is DOWN, overall status is DOWN
    if (checks.some((c) => c.status === "DOWN")) {
      return "DOWN";
    }

    // If any check is DEGRADED, overall status is DEGRADED
    if (checks.some((c) => c.status === "DEGRADED")) {
      return "DEGRADED";
    }

    return "UP";
  }
}

// ─── HTTP ENDPOINT HANDLERS ────────────────────────────────────────────

/**
 * Express/Fastify middleware for health endpoints.
 * Usage: app.get('/health', healthEndpoint(checker));
 */
export function healthEndpoint(
  checker: HealthChecker
): (req: any, res: any) => Promise<void> {
  return async (_req: any, res: any) => {
    const health = await checker.getLiveness();
    const statusCode = health.status === "UP" ? 200 : 503;
    res.status(statusCode).json(health);
  };
}

/**
 * Express/Fastify middleware for readiness endpoint.
 * Usage: app.get('/health/ready', readinessEndpoint(checker));
 */
export function readinessEndpoint(
  checker: HealthChecker
): (req: any, res: any) => Promise<void> {
  return async (_req: any, res: any) => {
    const health = await checker.getReadiness();
    const statusCode = health.status === "UP" ? 200 : 503;
    res.status(statusCode).json(health);
  };
}

/**
 * Express/Fastify middleware for startup endpoint.
 * Usage: app.get('/health/startup', startupEndpoint(checker));
 */
export function startupEndpoint(
  checker: HealthChecker
): (req: any, res: any) => Promise<void> {
  return async (_req: any, res: any) => {
    const health = await checker.getStartup();
    const statusCode = health.status === "UP" ? 200 : 503;
    res.status(statusCode).json(health);
  };
}

// ─── SINGLETON INSTANCE ────────────────────────────────────────────────

let checkerInstance: HealthChecker | null = null;

/**
 * Get the global health checker instance.
 */
export function getHealthChecker(): HealthChecker {
  if (!checkerInstance) {
    checkerInstance = new HealthChecker();
  }
  return checkerInstance;
}
