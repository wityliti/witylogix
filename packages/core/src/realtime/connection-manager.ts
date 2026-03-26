/**
 * Connection Manager — Lifecycle management for real-time connections.
 *
 * Tracks active connections per tenant, enforces connection limits based on
 * plan tier, and provides metrics about connection health and usage.
 */

import {
  CONNECTION_LIMITS,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  type ConnectionMetrics,
  type TenantMetrics,
  type WebSocketConnection,
  type RoomId,
} from "./types.js";

/**
 * Manages connection lifecycle and tenant-level connection limits.
 */
export class ConnectionManager {
  /** Map of tenant orgId -> Set of active connections. */
  private tenantConnections = new Map<string, Set<WebSocketConnection>>();

  /** Map of connection ID -> connection object. */
  private connectionsById = new Map<string, WebSocketConnection>();

  /** Metrics per tenant. */
  private tenantMetrics = new Map<string, TenantMetrics>();

  /** Cleanup interval for expired connections (milliseconds). */
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    // Start cleanup loop
    this.startCleanupLoop();
  }

  /**
   * Register a new connection.
   *
   * @param connection The connection to register.
   * @param orgId Organization ID.
   * @param planTier Plan tier (determines connection limit).
   * @throws Error if connection limit exceeded for plan tier.
   */
  registerConnection(
    connection: WebSocketConnection,
    orgId: string,
    planTier: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE"
  ): void {
    const connections = this.tenantConnections.get(orgId) ?? new Set();
    const limit = CONNECTION_LIMITS[planTier];

    if (connections.size >= limit) {
      throw new Error(
        `Connection limit exceeded for plan ${planTier}: ${connections.size}/${limit}`
      );
    }

    connections.add(connection);
    this.tenantConnections.set(orgId, connections);
    this.connectionsById.set(connection.id, connection);

    // Update metrics
    this.updateTenantMetrics(orgId, { activeConnections: connections.size });
  }

  /**
   * Unregister a connection.
   *
   * @param connectionId Connection ID.
   * @param orgId Organization ID.
   */
  unregisterConnection(connectionId: string, orgId: string): void {
    const connection = this.connectionsById.get(connectionId);
    if (!connection) return;

    const connections = this.tenantConnections.get(orgId);
    if (connections) {
      connections.delete(connection);
      if (connections.size === 0) {
        this.tenantConnections.delete(orgId);
      }
    }

    this.connectionsById.delete(connectionId);

    // Update metrics
    const remaining = this.tenantConnections.get(orgId);
    this.updateTenantMetrics(orgId, {
      activeConnections: remaining?.size ?? 0,
    });
  }

  /**
   * Get a connection by ID.
   *
   * @param connectionId Connection ID.
   * @returns The connection or undefined.
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connectionsById.get(connectionId);
  }

  /**
   * Get all connections for a tenant.
   *
   * @param orgId Organization ID.
   * @returns Array of connections.
   */
  getConnectionsForTenant(orgId: string): WebSocketConnection[] {
    return Array.from(this.tenantConnections.get(orgId) ?? new Set());
  }

  /**
   * Get all connections in a room.
   *
   * @param roomId Room ID.
   * @returns Array of connections subscribed to room.
   */
  getConnectionsInRoom(roomId: RoomId): WebSocketConnection[] {
    const connections: WebSocketConnection[] = [];
    for (const connection of this.connectionsById.values()) {
      if (connection.rooms.has(roomId)) {
        connections.push(connection);
      }
    }
    return connections;
  }

  /**
   * Subscribe connection to a room.
   *
   * @param connectionId Connection ID.
   * @param roomId Room ID.
   */
  subscribeToRoom(connectionId: string, roomId: RoomId): void {
    const connection = this.connectionsById.get(connectionId);
    if (connection) {
      connection.rooms.add(roomId);
    }
  }

  /**
   * Unsubscribe connection from a room.
   *
   * @param connectionId Connection ID.
   * @param roomId Room ID.
   */
  unsubscribeFromRoom(connectionId: string, roomId: RoomId): void {
    const connection = this.connectionsById.get(connectionId);
    if (connection) {
      connection.rooms.delete(roomId);
    }
  }

  /**
   * Record a heartbeat for a connection.
   *
   * @param connectionId Connection ID.
   */
  recordHeartbeat(connectionId: string): void {
    const connection = this.connectionsById.get(connectionId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  /**
   * Check if connection is still healthy (within heartbeat timeout).
   *
   * @param connectionId Connection ID.
   * @returns true if healthy.
   */
  isConnectionHealthy(connectionId: string): boolean {
    const connection = this.connectionsById.get(connectionId);
    if (!connection) return false;

    const timeSinceHeartbeat =
      Date.now() - connection.lastHeartbeat.getTime();
    return timeSinceHeartbeat < HEARTBEAT_TIMEOUT;
  }

  /**
   * Update connection metrics.
   *
   * @param connectionId Connection ID.
   * @param metrics Partial metrics to update.
   */
  updateConnectionMetrics(
    connectionId: string,
    metrics: Partial<ConnectionMetrics>
  ): void {
    const connection = this.connectionsById.get(connectionId);
    if (!connection) return;

    Object.assign(connection.metrics, metrics);
  }

  /**
   * Record event received on connection.
   *
   * @param connectionId Connection ID.
   * @param accepted Whether event was accepted (not rate-limited).
   */
  recordEventReceived(connectionId: string, accepted: boolean): void {
    const connection = this.connectionsById.get(connectionId);
    if (!connection) return;

    if (accepted) {
      connection.metrics.eventsReceived += 1;
      connection.metrics.lastEventAt = new Date();
    } else {
      connection.metrics.eventsDropped += 1;
    }
  }

  /**
   * Get metrics for a tenant.
   *
   * @param orgId Organization ID.
   * @returns Tenant metrics.
   */
  getTenantMetrics(orgId: string): TenantMetrics | undefined {
    return this.tenantMetrics.get(orgId);
  }

  /**
   * Get global metrics across all tenants.
   *
   * @returns Array of tenant metrics.
   */
  getAllMetrics(): TenantMetrics[] {
    return Array.from(this.tenantMetrics.values());
  }

  /**
   * Cleanup and disconnect from instance.
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tenantConnections.clear();
    this.connectionsById.clear();
    this.tenantMetrics.clear();
  }

  // ─── PRIVATE METHODS ────────────────────────────────────────────────────

  /**
   * Update metrics for a tenant, including peak tracking.
   */
  private updateTenantMetrics(
    orgId: string,
    update: Partial<TenantMetrics>
  ): void {
    const current =
      this.tenantMetrics.get(orgId) ?? this.createDefaultMetrics();

    if (update.activeConnections !== undefined) {
      if (update.activeConnections > current.peakConnections) {
        current.peakConnections = update.activeConnections;
      }
      current.activeConnections = update.activeConnections;
    }

    Object.assign(current, update);
    current.timestamp = new Date();

    this.tenantMetrics.set(orgId, current);
  }

  /**
   * Create default metrics object.
   */
  private createDefaultMetrics(): TenantMetrics {
    return {
      activeConnections: 0,
      peakConnections: 0,
      connectionErrors: 0,
      eventCount: 0,
      avgLatency: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Start periodic cleanup of stale connections.
   */
  private startCleanupLoop(): void {
    this.cleanupInterval = setInterval(() => {
      const staleConnections: string[] = [];

      for (const [connectionId, connection] of this.connectionsById) {
        if (!this.isConnectionHealthy(connectionId)) {
          staleConnections.push(connectionId);
        }
      }

      // Cleanup stale connections
      for (const connectionId of staleConnections) {
        const connection = this.connectionsById.get(connectionId);
        if (connection) {
          this.unregisterConnection(connectionId, connection.orgId);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }
}

/**
 * Singleton instance of connection manager.
 */
let connectionManagerInstance: ConnectionManager | null = null;

/**
 * Get or create the global connection manager instance.
 */
export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new ConnectionManager();
  }
  return connectionManagerInstance;
}
