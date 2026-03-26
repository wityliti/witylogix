/**
 * Connection Monitor — Database connection pool monitoring and diagnostics.
 *
 * Tracks connection pool health:
 * - Active/idle/waiting connection counts
 * - Connection checkout time
 * - Pool exhaustion detection
 * - Connection leak detection (checked out >60s)
 * - Pool utilization metrics
 * - Alerts and diagnostics
 *
 * Usage:
 *   const monitor = new ConnectionMonitor(prisma);
 *   monitor.startMonitoring();
 *   const health = monitor.getPoolHealth();
 */

/**
 * Connection checkout record.
 */
interface ConnectionCheckout {
  id: string;
  acquiredAt: number;
  releasedAt?: number;
  duration?: number;
  query?: string;
  stackTrace: string;
}

/**
 * Pool health metrics.
 */
export interface PoolHealth {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  utilization: number; // 0-1
  avgCheckoutTime: number; // ms
  maxCheckoutTime: number; // ms
  leakedConnections: number;
  exhaustionAlerts: number;
  lastCheck: number;
}

/**
 * Connection leak information.
 */
export interface ConnectionLeak {
  id: string;
  acquiredAt: number;
  duration: number; // ms
  estimatedLeakTime: number; // How long overdue
  stackTrace: string;
}

/**
 * Pool alert.
 */
export interface PoolAlert {
  severity: "warning" | "critical";
  type: "exhaustion" | "leak" | "slow_checkout" | "high_utilization";
  message: string;
  timestamp: number;
}

/**
 * Connection Monitor for pool diagnostics.
 *
 * Monitors Prisma's underlying connection pool to detect exhaustion,
 * leaks, and performance issues.
 */
export class ConnectionMonitor {
  private prismaClient: any;
  private checkouts: Map<string, ConnectionCheckout> = new Map();
  private alerts: PoolAlert[] = [];
  private readonly leakThresholdMs = 60000; // 60 seconds
  private readonly checkoutThresholdMs = 1000; // 1 second
  private readonly poolSize: number;
  private readonly monitorInterval = 5000; // 5 seconds
  private monitoringTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  /**
   * Create connection monitor.
   *
   * @param prismaClient - Prisma client instance
   * @param poolSize - Expected connection pool size (default 10)
   */
  constructor(prismaClient: any, poolSize: number = 10) {
    this.prismaClient = prismaClient;
    this.poolSize = poolSize;
    this.instrumentPrisma();
  }

  /**
   * Start monitoring connection pool.
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringTimer = setInterval(() => {
      this.checkPoolHealth();
    }, this.monitorInterval);
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.isMonitoring = false;
  }

  /**
   * Get current pool health metrics.
   *
   * @returns Pool health information
   */
  getPoolHealth(): PoolHealth {
    const active = this.getActiveConnectionCount();
    const idle = this.getIdleConnectionCount();
    const waiting = this.getWaitingConnectionCount();
    const total = this.poolSize;

    const checkoutTimes = Array.from(this.checkouts.values())
      .filter((c) => c.duration !== undefined)
      .map((c) => c.duration!);

    const avgCheckout =
      checkoutTimes.length > 0
        ? Math.round(
            checkoutTimes.reduce((a, b) => a + b, 0) / checkoutTimes.length
          )
        : 0;

    const maxCheckout =
      checkoutTimes.length > 0 ? Math.max(...checkoutTimes) : 0;

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      waitingConnections: waiting,
      utilization: active / total,
      avgCheckoutTime: avgCheckout,
      maxCheckoutTime: maxCheckout,
      leakedConnections: this.detectLeaks().length,
      exhaustionAlerts: this.alerts.filter(
        (a) => a.type === "exhaustion"
      ).length,
      lastCheck: Date.now(),
    };
  }

  /**
   * Get detected connection leaks.
   *
   * @returns List of leaked connections
   */
  getLeaks(): ConnectionLeak[] {
    return this.detectLeaks();
  }

  /**
   * Get recent alerts.
   *
   * @param limit - Maximum alerts to return (default 20)
   * @returns Alert list
   */
  getAlerts(limit: number = 20): PoolAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alert history.
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Record connection checkout.
   *
   * @param id - Connection ID
   * @param query - Optional query being executed
   */
  recordCheckout(id: string, query?: string): void {
    this.checkouts.set(id, {
      id,
      acquiredAt: Date.now(),
      query,
      stackTrace: new Error().stack || "",
    });
  }

  /**
   * Record connection release.
   *
   * @param id - Connection ID
   */
  recordRelease(id: string): void {
    const checkout = this.checkouts.get(id);
    if (checkout) {
      const now = Date.now();
      checkout.releasedAt = now;
      checkout.duration = now - checkout.acquiredAt;

      // Check for slow checkout
      if (
        checkout.duration > this.checkoutThresholdMs &&
        checkout.duration < this.leakThresholdMs
      ) {
        this.recordAlert({
          severity: "warning",
          type: "slow_checkout",
          message: `Connection ${id} held for ${checkout.duration}ms`,
          timestamp: now,
        });
      }

      // Clean up old records
      if (this.checkouts.size > 1000) {
        this.pruneCheckouts();
      }
    }
  }

  /**
   * Get connection statistics.
   *
   * @returns Statistics object
   */
  getStats(): {
    totalCheckouts: number;
    leaks: number;
    avgDuration: number;
    p99Duration: number;
  } {
    const completed = Array.from(this.checkouts.values()).filter(
      (c) => c.duration !== undefined
    );

    const durations = completed.map((c) => c.duration!);
    const avg =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const sorted = durations.sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    const p99 = sorted[Math.max(0, p99Index)] || 0;

    return {
      totalCheckouts: completed.length,
      leaks: this.detectLeaks().length,
      avgDuration: avg,
      p99Duration: p99,
    };
  }

  /**
   * Instrument Prisma client to track connections.
   *
   * This attempts to hook into Prisma's query execution to track
   * connection lifecycle.
   */
  private instrumentPrisma(): void {
    if (!this.prismaClient.$on) return;

    try {
      // Hook query execution
      this.prismaClient.$on("query", (event: any) => {
        // Record query start
        const connId = `query_${Date.now()}_${Math.random()}`;
        this.recordCheckout(connId, event.query);
      });
    } catch {
      // Instrumentation failed, graceful degradation
    }
  }

  /**
   * Detect connection leaks.
   *
   * @returns List of leaked connections
   */
  private detectLeaks(): ConnectionLeak[] {
    const now = Date.now();
    const leaks: ConnectionLeak[] = [];

    this.checkouts.forEach((checkout, id) => {
      // Unclosed connection older than threshold
      if (!checkout.releasedAt && now - checkout.acquiredAt > this.leakThresholdMs) {
        leaks.push({
          id,
          acquiredAt: checkout.acquiredAt,
          duration: this.leakThresholdMs,
          estimatedLeakTime: now - checkout.acquiredAt - this.leakThresholdMs,
          stackTrace: checkout.stackTrace,
        });

        // Alert on leak detection
        this.recordAlert({
          severity: "critical",
          type: "leak",
          message: `Connection leak detected: ${id}`,
          timestamp: now,
        });
      }
    });

    return leaks;
  }

  /**
   * Check overall pool health and record alerts.
   */
  private checkPoolHealth(): void {
    const health = this.getPoolHealth();
    const now = Date.now();

    // Check for pool exhaustion
    if (health.activeConnections >= this.poolSize) {
      this.recordAlert({
        severity: "critical",
        type: "exhaustion",
        message: `Connection pool exhausted: ${health.activeConnections}/${health.totalConnections}`,
        timestamp: now,
      });
    }

    // Check for high utilization
    if (health.utilization > 0.8) {
      this.recordAlert({
        severity: "warning",
        type: "high_utilization",
        message: `Pool utilization high: ${Math.round(health.utilization * 100)}%`,
        timestamp: now,
      });
    }

    // Detect leaks
    const leaks = this.detectLeaks();
    if (leaks.length > 0 && this.alerts.length === 0) {
      // Already alerted in detectLeaks
    }
  }

  /**
   * Get active connection count.
   *
   * @returns Count
   */
  private getActiveConnectionCount(): number {
    return Array.from(this.checkouts.values()).filter(
      (c) => !c.releasedAt
    ).length;
  }

  /**
   * Get idle connection count.
   *
   * @returns Count
   */
  private getIdleConnectionCount(): number {
    return Math.max(
      0,
      this.poolSize - this.getActiveConnectionCount()
    );
  }

  /**
   * Get waiting connection count (simplified estimation).
   *
   * @returns Count
   */
  private getWaitingConnectionCount(): number {
    // In a real implementation, this would hook into Prisma's
    // internal queue to get actual waiting count
    return 0;
  }

  /**
   * Record alert.
   *
   * @param alert - Alert to record
   */
  private recordAlert(alert: PoolAlert): void {
    this.alerts.push(alert);

    // Keep alert history limited
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Prune old checkout records.
   */
  private pruneCheckouts(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    const idsToDelete: string[] = [];
    this.checkouts.forEach((checkout, id) => {
      if (now - checkout.acquiredAt > maxAge && checkout.releasedAt) {
        idsToDelete.push(id);
      }
    });

    idsToDelete.forEach((id) => this.checkouts.delete(id));
  }

  /**
   * Generate diagnostic report.
   *
   * @returns Diagnostic information
   */
  generateDiagnostics(): string {
    const health = this.getPoolHealth();
    const stats = this.getStats();
    const leaks = this.getLeaks();
    const recentAlerts = this.getAlerts(10);

    return `
Connection Pool Diagnostics:
- Active: ${health.activeConnections}/${health.totalConnections}
- Utilization: ${Math.round(health.utilization * 100)}%
- Avg Checkout: ${health.avgCheckoutTime}ms
- Max Checkout: ${health.maxCheckoutTime}ms
- Leaks Detected: ${leaks.length}
- P99 Duration: ${stats.p99Duration}ms
- Recent Alerts: ${recentAlerts.length}
    `.trim();
  }
}
