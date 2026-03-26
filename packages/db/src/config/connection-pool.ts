/**
 * Connection Pool Configuration — PgBouncer-compatible pool management
 *
 * Provides environment-specific pool tuning for development, staging, and production.
 * Includes health checks, SSL configuration, and connection lifecycle hooks.
 *
 * Features:
 * - Min/max connection pooling per environment
 * - Connection timeouts and idle timeouts
 * - SSL/TLS for production
 * - Health check queries with configurable intervals
 * - Connection lifecycle logging (connect/disconnect)
 * - Statement timeout to prevent long-running queries
 */

/**
 * Pool configuration parameters
 */
export interface PoolConfig {
  min: number;
  max: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  healthCheckIntervalMs: number;
  healthCheckQuery: string;
  ssl: boolean;
  sslRejectUnauthorized?: boolean;
  application_name: string;
  onConnect?: (conn: any) => Promise<void>;
  onDisconnect?: (conn: any) => Promise<void>;
}

/**
 * Creates a pool configuration for the specified environment
 *
 * @param env - Environment: 'development' | 'staging' | 'production'
 * @returns PoolConfig object suitable for PgBouncer or pg driver
 */
export function createPoolConfig(
  env: "development" | "staging" | "production"
): PoolConfig {
  const envConfig = env === "development"
    ? { min: 1, max: 5, connectionTimeoutMs: 30000, idleTimeoutMs: 600000 }
    : env === "staging"
    ? { min: 5, max: 20, connectionTimeoutMs: 20000, idleTimeoutMs: 300000 }
    : { min: 10, max: 100, connectionTimeoutMs: 10000, idleTimeoutMs: 60000 };

  const baseConfig: PoolConfig = {
    ...envConfig,
    // Common settings
    statementTimeoutMs: env === "production" ? 30000 : 60000,
    healthCheckIntervalMs: env === "production" ? 10000 : 30000,
    healthCheckQuery: "SELECT 1",
    ssl: env === "production",
    sslRejectUnauthorized: env === "production",
    application_name: `witylogix-${env}`,
  };

  return baseConfig;
}

/**
 * Validates pool configuration against constraints
 *
 * @param config - Pool configuration to validate
 * @throws Error if configuration is invalid
 */
export function validatePoolConfig(config: PoolConfig): void {
  if (config.min < 1) {
    throw new Error("Pool min connections must be at least 1");
  }

  if (config.max < config.min) {
    throw new Error("Pool max connections must be >= min connections");
  }

  if (config.connectionTimeoutMs < 1000) {
    throw new Error("Connection timeout must be >= 1000ms");
  }

  if (config.idleTimeoutMs < 5000) {
    throw new Error("Idle timeout must be >= 5000ms");
  }

  if (config.statementTimeoutMs < 1000) {
    throw new Error("Statement timeout must be >= 1000ms");
  }

  if (config.healthCheckIntervalMs < 1000) {
    throw new Error("Health check interval must be >= 1000ms");
  }
}

/**
 * Logs connection lifecycle events
 *
 * @param event - Event type: 'connect' | 'disconnect'
 * @param connectionId - Connection identifier
 * @param metadata - Additional metadata
 */
function logConnectionEvent(
  event: "connect" | "disconnect",
  connectionId: string,
  metadata: Record<string, any> = {}
): void {
  const timestamp = new Date().toISOString();
  const logLevel = event === "connect" ? "info" : "debug";

  console.log(
    JSON.stringify(
      {
        timestamp,
        level: logLevel,
        event: `db:connection:${event}`,
        connectionId,
        ...metadata,
      },
      null,
      2
    )
  );
}

/**
 * Creates a health check function for monitoring pool state
 *
 * @param config - Pool configuration
 * @returns Health check function
 */
export function createHealthCheckFn(config: PoolConfig) {
  return async (client: any): Promise<boolean> => {
    try {
      const startTime = Date.now();
      await client.query(config.healthCheckQuery);
      const duration = Date.now() - startTime;

      if (duration > config.connectionTimeoutMs / 2) {
        console.warn(
          `Health check slow: ${duration}ms (threshold: ${config.connectionTimeoutMs / 2}ms)`
        );
      }

      return true;
    } catch (err) {
      console.error("Pool health check failed:", err);
      return false;
    }
  };
}

/**
 * Lifecycle hooks for connection management
 *
 * @param config - Pool configuration
 * @returns Object with onConnect and onDisconnect handlers
 */
export function createLifecycleHooks(config: PoolConfig) {
  return {
    onConnect: async (client: any) => {
      const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logConnectionEvent("connect", connectionId, {
        poolSize: "unknown", // Would be provided by actual pool
        timestamp: new Date().toISOString(),
      });

      // Set connection timeouts
      await client.query(
        `SET statement_timeout TO ${config.statementTimeoutMs}`
      );
      await client.query(`SET idle_in_transaction_session_timeout TO ${config.idleTimeoutMs}`);

      if (config.onConnect) {
        await config.onConnect(client);
      }
    },

    onDisconnect: async (client: any) => {
      const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logConnectionEvent("disconnect", connectionId, {
        reason: "idle timeout or error",
      });

      if (config.onDisconnect) {
        await config.onDisconnect(client);
      }
    },
  };
}
