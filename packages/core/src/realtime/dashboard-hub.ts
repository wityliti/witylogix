/**
 * Dashboard Hub — WebSocket server for real-time dashboard updates.
 *
 * Socket.io server with Redis adapter, room management, authentication,
 * rate limiting, and event replay for reconnections.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — socket.io types resolved at runtime via API deps
import { Server, Socket } from "socket.io";
// @ts-ignore — @socket.io/redis-adapter types resolved at runtime via API deps
import { createAdapter } from "@socket.io/redis-adapter";
// @ts-ignore — redis types resolved at runtime via API deps
import { createClient, type RedisClientType } from "redis";
import type { JwtService } from "../auth/jwt-service.js";
import type { TypedEventBus } from "../event-bus/index.js";
import type { WitylogixEvents } from "../event-bus/types.js";
import {
  EVENT_BUFFER_SIZE,
  HEARTBEAT_INTERVAL,
  RATE_LIMIT_PER_CONNECTION,
  type EventEnvelope,
  type DashboardEvent,
  type RoomId,
  type EventFilter,
} from "./types.js";
import { getConnectionManager } from "./connection-manager.js";
import { EventBroadcaster } from "./event-broadcaster.js";

/**
 * Configuration for dashboard hub.
 */
export interface DashboardHubConfig {
  /** HTTP server to attach socket.io to. */
  httpServer: any;
  /** Redis URL for pub/sub adapter. */
  redisUrl?: string;
  /** JWT service for token verification. */
  jwtService: JwtService;
  /** Event bus for subscribing to domain events. */
  eventBus: TypedEventBus<WitylogixEvents>;
  /** Namespace path (default: "/realtime"). */
  namespace?: string;
}

/**
 * Real-time dashboard WebSocket hub.
 */
export class DashboardHub {
  private io: Server;
  private config: DashboardHubConfig;
  private jwtService: JwtService;
  private eventBus: TypedEventBus<WitylogixEvents>;
  private broadcaster: EventBroadcaster;
  private connectionManager = getConnectionManager();

  /** Event buffer per room: roomId -> [ EventEnvelope ] */
  private eventBuffer = new Map<RoomId, EventEnvelope[]>();

  /** Rate limiter: connectionId -> { events: number, resetAt: number } */
  private rateLimiter = new Map<
    string,
    { events: number; resetAt: number }
  >();

  constructor(config: DashboardHubConfig) {
    this.config = config;
    this.jwtService = config.jwtService;
    this.eventBus = config.eventBus;

    const namespace = config.namespace ?? "/realtime";
    this.io = new Server(config.httpServer, {
      namespace,
      transports: ["websocket", "polling"],
      cors: {
        origin: "*",
        credentials: true,
      },
      pingInterval: HEARTBEAT_INTERVAL,
      pingTimeout: HEARTBEAT_INTERVAL * 2,
    });

    this.broadcaster = new EventBroadcaster(
      this.eventBus,
      this.emitToClients.bind(this)
    );

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Initialize the hub (connect Redis, start broadcasting).
   */
  async initialize(): Promise<void> {
    // Setup Redis adapter if URL provided
    if (this.config.redisUrl) {
      const pubClient = createClient({ url: this.config.redisUrl });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.io.adapter(createAdapter(pubClient, subClient));
    }

    // Start broadcasting events
    await this.broadcaster.startBroadcasting();

    console.log("DashboardHub initialized");
  }

  /**
   * Shutdown the hub gracefully.
   */
  async shutdown(): Promise<void> {
    await this.broadcaster.stopBroadcasting();
    this.io.close();
  }

  // ─── MIDDLEWARE ────────────────────────────────────────────────────────

  /**
   * Setup Socket.io middleware for authentication and validation.
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use((socket: unknown, next: (err?: Error) => void) => {
      const typedSocket = socket as { handshake: { auth: { token?: string } }; data: Record<string, unknown> };
      const token = typedSocket.handshake.auth.token;
      if (!token) {
        return next(new Error("Missing authentication token"));
      }

      const result = this.jwtService.verifyAccessToken(token);
      if (!result.valid || !result.payload) {
        return next(new Error("Invalid or expired token"));
      }
      typedSocket.data.user = result.payload;
      next();
    });
  }

  /**
   * Setup Socket.io event handlers.
   */
  private setupEventHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      this.handleConnection(socket);

      socket.on("subscribe", (roomId: RoomId, filter?: EventFilter) =>
        this.handleSubscribe(socket, roomId, filter)
      );

      socket.on("unsubscribe", (roomId: RoomId) =>
        this.handleUnsubscribe(socket, roomId)
      );

      socket.on("heartbeat", () => this.handleHeartbeat(socket));

      socket.on("disconnect", () => this.handleDisconnect(socket));
    });
  }

  // ─── CONNECTION HANDLERS ────────────────────────────────────────────────

  /**
   * Handle new socket connection.
   */
  private async handleConnection(socket: Socket): Promise<void> {
    const userId = socket.data.user?.userId;
    const orgId = socket.data.user?.orgId;
    const planTier = socket.data.user?.planTier ?? "FREE";

    if (!orgId) {
      socket.disconnect(true);
      return;
    }

    try {
      // Create connection object
      const connection = {
        id: socket.id,
        userId,
        orgId,
        connectedAt: new Date(),
        rooms: new Set<RoomId>(),
        lastHeartbeat: new Date(),
        metrics: {
          eventsReceived: 0,
          eventsDropped: 0,
          eventsSent: 0,
          latency: 0,
          lastEventAt: new Date(),
        },
      };

      // Register with connection manager
      this.connectionManager.registerConnection(
        connection,
        orgId,
        planTier as any
      );

      socket.data.connectionId = socket.id;
      socket.data.orgId = orgId;

      // Auto-subscribe to org room
      socket.join(`org:${orgId}`);
      this.connectionManager.subscribeToRoom(socket.id, `org:${orgId}`);

      console.log(
        `[DashboardHub] User ${userId} connected to org:${orgId}`
      );
    } catch (error) {
      console.error("[DashboardHub] Connection failed:", error);
      socket.disconnect(true);
    }
  }

  /**
   * Handle room subscription with optional event replay.
   */
  private async handleSubscribe(
    socket: Socket,
    roomId: RoomId,
    filter?: EventFilter
  ): Promise<void> {
    const connectionId = socket.data.connectionId;
    const orgId = socket.data.orgId;

    // Validate room access (basic check)
    if (roomId.startsWith("org:") && !roomId.includes(orgId)) {
      socket.emit("error", "Unauthorized room access");
      return;
    }

    // Subscribe connection
    this.connectionManager.subscribeToRoom(connectionId, roomId);
    socket.join(roomId);

    // Store filter if provided
    if (filter) {
      socket.data.filters = { ...socket.data.filters, [roomId]: filter };
    }

    // Replay buffered events
    const buffer = this.eventBuffer.get(roomId);
    if (buffer && buffer.length > 0) {
      const filteredEvents = this.applyFilter(buffer, filter);
      const lastEventId = socket.handshake.query.lastEventId as
        | string
        | undefined;

      const replayEvents = lastEventId
        ? buffer.filter((e) => {
            // Find events after lastEventId
            const idx = buffer.findIndex((ev) => ev.id === lastEventId);
            return idx >= 0 && buffer.indexOf(e) > idx;
          })
        : filteredEvents;

      for (const event of replayEvents) {
        socket.emit("event", event);
      }

      socket.emit("replay_complete", {
        roomId,
        eventCount: replayEvents.length,
      });
    }

    socket.emit("subscribed", { roomId });
  }

  /**
   * Handle room unsubscription.
   */
  private handleUnsubscribe(socket: Socket, roomId: RoomId): void {
    const connectionId = socket.data.connectionId;

    this.connectionManager.unsubscribeFromRoom(connectionId, roomId);
    socket.leave(roomId);

    // Clear filter for this room
    if (socket.data.filters) {
      delete socket.data.filters[roomId];
    }

    socket.emit("unsubscribed", { roomId });
  }

  /**
   * Handle heartbeat to keep connection alive.
   */
  private handleHeartbeat(socket: Socket): void {
    const connectionId = socket.data.connectionId;
    this.connectionManager.recordHeartbeat(connectionId);

    // Get connection metrics
    const connection = this.connectionManager.getConnection(connectionId);
    if (connection) {
      socket.emit("heartbeat_ack", {
        latency: connection.metrics.latency,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle disconnection and cleanup.
   */
  private handleDisconnect(socket: Socket): void {
    const connectionId = socket.data.connectionId;
    const orgId = socket.data.orgId;

    this.connectionManager.unregisterConnection(connectionId, orgId);
    console.log(`[DashboardHub] Connection ${connectionId} disconnected`);
  }

  // ─── EVENT EMISSION ────────────────────────────────────────────────────

  /**
   * Emit event to all clients in rooms.
   */
  async emitToClients(
    roomId: string,
    event: EventEnvelope
  ): Promise<void> {
    // Apply rate limiting
    const connections = this.connectionManager.getConnectionsInRoom(
      roomId as RoomId
    );

    const validConnections: string[] = [];
    for (const conn of connections) {
      if (this.checkRateLimit(conn.id)) {
        validConnections.push(conn.id);
        this.connectionManager.recordEventReceived(conn.id, true);
      } else {
        this.connectionManager.recordEventReceived(conn.id, false);
      }
    }

    // Broadcast to valid connections
    if (validConnections.length > 0) {
      this.io.to(roomId).emit("event", event);
    }

    // Store in event buffer
    this.addToEventBuffer(roomId as RoomId, event);
  }

  // ─── RATE LIMITING ────────────────────────────────────────────────────

  /**
   * Check if connection is within rate limit.
   */
  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    let limiter = this.rateLimiter.get(connectionId);

    if (!limiter || now >= limiter.resetAt) {
      // Reset window
      limiter = {
        events: 1,
        resetAt: now + 1000, // 1 second window
      };
    } else {
      limiter.events += 1;
    }

    this.rateLimiter.set(connectionId, limiter);

    return limiter.events <= RATE_LIMIT_PER_CONNECTION;
  }

  // ─── EVENT BUFFERING ───────────────────────────────────────────────────

  /**
   * Add event to buffer for the room.
   */
  private addToEventBuffer(roomId: RoomId, event: EventEnvelope): void {
    let buffer = this.eventBuffer.get(roomId);

    if (!buffer) {
      buffer = [];
      this.eventBuffer.set(roomId, buffer);
    }

    buffer.push(event);

    // Keep buffer size limited
    if (buffer.length > EVENT_BUFFER_SIZE) {
      buffer.shift();
    }
  }

  // ─── FILTERING ─────────────────────────────────────────────────────────

  /**
   * Apply event filter to buffer.
   */
  private applyFilter(
    events: EventEnvelope[],
    filter?: EventFilter
  ): EventEnvelope[] {
    if (!filter) return events;

    return events.filter((e) => {
      const data = e.data;

      // Filter by event types
      if (
        filter.eventTypes &&
        !filter.eventTypes.includes(data.event)
      ) {
        return false;
      }

      // Filter by shop IDs
      if (
        filter.shopIds &&
        "shopId" in data &&
        !filter.shopIds.includes((data as { shopId: string }).shopId)
      ) {
        return false;
      }

      // Filter by driver IDs
      if (
        filter.driverIds &&
        "driverId" in data &&
        !filter.driverIds.includes(data.driverId)
      ) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Singleton instance of dashboard hub.
 */
let hubInstance: DashboardHub | null = null;

/**
 * Get or create the dashboard hub instance.
 */
export function getDashboardHub(
  config?: DashboardHubConfig
): DashboardHub {
  if (!hubInstance && config) {
    hubInstance = new DashboardHub(config);
  }
  return hubInstance!;
}
