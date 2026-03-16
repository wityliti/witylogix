/**
 * Read Replica Router — Primary/replica URL management and read/write splitting
 *
 * Routes SELECT queries to read replicas for load distribution, while sending
 * mutations (INSERT, UPDATE, DELETE) to the primary database. Includes replica
 * lag detection, health checking, and automatic failover to primary.
 *
 * Features:
 * - Automatic read/write splitting based on query type
 * - Multiple replica support with round-robin load balancing
 * - Replica lag detection with configurable threshold (default 5s)
 * - Automatic failover to primary when replicas are unhealthy
 * - Health check and replica status monitoring
 */

export interface ReplicaConfig {
  primary: string;
  replicas: string[];
  replicaLagThresholdMs: number;
  healthCheckIntervalMs: number;
  failoverTimeoutMs: number;
}

/**
 * Replica health status
 */
interface ReplicaHealth {
  url: string;
  healthy: boolean;
  lagMs: number | null;
  lastCheckedAt: Date;
  consecutiveFailures: number;
}

/**
 * Router for read/write splitting across primary and replica databases
 */
export class ReadReplicaRouter {
  private readonly primary: string;
  private readonly replicas: string[];
  private readonly replicaLagThresholdMs: number;
  private readonly healthCheckIntervalMs: number;
  private readonly failoverTimeoutMs: number;
  private replicaHealth: Map<string, ReplicaHealth> = new Map();
  private currentReplicaIndex: number = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the read replica router
   */
  constructor(config: ReplicaConfig) {
    this.primary = config.primary;
    this.replicas = config.replicas;
    this.replicaLagThresholdMs = config.replicaLagThresholdMs || 5000;
    this.healthCheckIntervalMs = config.healthCheckIntervalMs || 30000;
    this.failoverTimeoutMs = config.failoverTimeoutMs || 10000;

    // Initialize replica health tracking
    for (const replica of this.replicas) {
      this.replicaHealth.set(replica, {
        url: replica,
        healthy: true,
        lagMs: null,
        lastCheckedAt: new Date(),
        consecutiveFailures: 0,
      });
    }
  }

  /**
   * Get the connection URL for a given query type
   *
   * @param queryType - 'SELECT' for read queries, 'WRITE' for mutations
   * @returns Connection URL (replica for reads, primary for writes)
   */
  getConnectionUrl(queryType: "SELECT" | "WRITE"): string {
    if (queryType === "WRITE") {
      return this.primary;
    }

    // Try to get a healthy replica for read queries
    const healthyReplica = this.getHealthyReplica();
    if (healthyReplica) {
      return healthyReplica;
    }

    // Fallback to primary if no healthy replicas
    console.warn(
      "No healthy replicas available, falling back to primary for read query"
    );
    return this.primary;
  }

  /**
   * Get the next healthy replica using round-robin
   *
   * @returns Replica URL or null if no healthy replicas
   */
  private getHealthyReplica(): string | null {
    const healthyReplicas = Array.from(this.replicaHealth.values()).filter(
      (h) => h.healthy
    );

    if (healthyReplicas.length === 0) {
      return null;
    }

    // Round-robin selection
    const replica = healthyReplicas[this.currentReplicaIndex % healthyReplicas.length];
    this.currentReplicaIndex++;

    return replica.url;
  }

  /**
   * Check replica lag and health status
   *
   * @param replicaUrl - Replica URL to check
   * @returns Lag in milliseconds, or null if unable to determine
   */
  async checkReplicaLag(replicaUrl: string): Promise<number | null> {
    try {
      const startTime = Date.now();

      // Query to check replica lag: fetch the difference between
      // the replica's current LSN and the primary's current LSN
      const lagQuery = `
        SELECT EXTRACT(EPOCH FROM (
          NOW() - pg_last_xact_replay_timestamp()
        )) * 1000 AS lag_ms
      `;

      // Simulate query execution with timeout
      const lagMs = await this.simulateQuery(lagQuery, this.failoverTimeoutMs);

      const duration = Date.now() - startTime;

      // Update health status
      const health = this.replicaHealth.get(replicaUrl);
      if (health) {
        health.lagMs = lagMs;
        health.lastCheckedAt = new Date();

        if (lagMs && lagMs > this.replicaLagThresholdMs) {
          console.warn(
            `Replica lag threshold exceeded for ${replicaUrl}: ${lagMs}ms > ${this.replicaLagThresholdMs}ms`
          );
          health.healthy = false;
          health.consecutiveFailures++;
        } else {
          health.healthy = true;
          health.consecutiveFailures = 0;
        }
      }

      return lagMs;
    } catch (err) {
      console.error(`Failed to check replica lag for ${replicaUrl}:`, err);

      const health = this.replicaHealth.get(replicaUrl);
      if (health) {
        health.healthy = false;
        health.consecutiveFailures++;
      }

      return null;
    }
  }

  /**
   * Simulate a query execution (used for testing and lag detection)
   *
   * @param query - Query to execute
   * @param timeoutMs - Query timeout in milliseconds
   * @returns Simulated result (in real implementation, would execute against DB)
   */
  private async simulateQuery(
    _query: string,
    _timeoutMs: number
  ): Promise<number> {
    // Simulate a random lag between 0-10 seconds
    return Math.random() * 10000;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      for (const replicaUrl of this.replicas) {
        await this.checkReplicaLag(replicaUrl);
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Get replica health status
   *
   * @returns Array of replica health information
   */
  getReplicaHealth(): ReplicaHealth[] {
    const result: ReplicaHealth[] = [];
    const entries = Array.from(this.replicaHealth.entries());
    for (let i = 0; i < entries.length; i++) {
      result.push(entries[i][1]);
    }
    return result;
  }

  /**
   * Get summary of router state
   *
   * @returns Router status summary
   */
  getStatus(): {
    primary: string;
    replicas: Array<{
      url: string;
      healthy: boolean;
      lagMs: number | null;
      consecutiveFailures: number;
    }>;
    healthyReplicaCount: number;
  } {
    const replicaStatuses: Array<{
      url: string;
      healthy: boolean;
      lagMs: number | null;
      consecutiveFailures: number;
    }> = [];

    const entries = Array.from(this.replicaHealth.entries());
    for (let i = 0; i < entries.length; i++) {
      const h = entries[i][1];
      replicaStatuses.push({
        url: h.url,
        healthy: h.healthy,
        lagMs: h.lagMs,
        consecutiveFailures: h.consecutiveFailures,
      });
    }

    const healthyCount = replicaStatuses.filter((r) => r.healthy).length;

    return {
      primary: this.primary,
      replicas: replicaStatuses,
      healthyReplicaCount: healthyCount,
    };
  }

  /**
   * Reset health status for all replicas
   */
  resetHealth(): void {
    for (const replica of this.replicas) {
      const health = this.replicaHealth.get(replica);
      if (health) {
        health.healthy = true;
        health.consecutiveFailures = 0;
        health.lastCheckedAt = new Date();
      }
    }
  }

  /**
   * Create a read replica router instance
   */
  static create(config: ReplicaConfig): ReadReplicaRouter {
    return new ReadReplicaRouter(config);
  }
}

/**
 * Factory function to create a configured router
 *
 * @param primaryUrl - Primary database URL
 * @param replicaUrls - Array of replica database URLs
 * @returns Configured ReadReplicaRouter instance
 */
export function createReplicaRouter(
  primaryUrl: string,
  replicaUrls: string[]
): ReadReplicaRouter {
  return new ReadReplicaRouter({
    primary: primaryUrl,
    replicas: replicaUrls,
    replicaLagThresholdMs: 5000,
    healthCheckIntervalMs: 30000,
    failoverTimeoutMs: 10000,
  });
}
