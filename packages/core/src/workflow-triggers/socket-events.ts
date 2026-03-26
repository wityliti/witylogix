/**
 * Socket.io Events — Real-time workflow progress events
 *
 * Emits workflow state changes (started, step completed, completed, failed) to
 * connected clients via Socket.io with room-based scoping.
 *
 * Rooms:
 * - org:{orgId} - All users in organization receive events
 * - user:{userId} - Individual user subscription
 * - entity:{entityId} - Entity-specific updates (order, shipment)
 * - workflow:{executionId} - Execution-specific updates
 *
 * Usage:
 *
 * ```typescript
 * import { Server as IOServer } from "socket.io";
 * import { WorkflowSocketEmitter } from "@witylogix/core/workflow-triggers";
 *
 * const io = new IOServer(server);
 * const emitter = new WorkflowSocketEmitter(io);
 *
 * // Emit workflow started
 * emitter.workflowStarted({
 *   executionId: "exec_123",
 *   workflowName: "createDeliveryOrder",
 *   orgId: "org_456",
 *   userId: "user_789",
 *   entityId: "order_xyz",
 *   input: { ... },
 * });
 *
 * // Emit step completion
 * emitter.stepCompleted({
 *   executionId: "exec_123",
 *   stepName: "validateOrder",
 *   output: { validated: true },
 *   durationMs: 125,
 * });
 * ```
 */

import type { Server as IOServer, Socket } from "socket.io";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Base payload for all workflow events
 */
export interface WorkflowEventBase {
  executionId: string;
  workflowName: string;
  orgId?: string;
  userId?: string;
  entityId?: string;
  timestamp: Date;
}

/**
 * Workflow started event
 */
export interface WorkflowStartedPayload extends WorkflowEventBase {
  input: Record<string, any>;
}

/**
 * Step completed event
 */
export interface StepCompletedPayload extends WorkflowEventBase {
  stepName: string;
  stepIndex: number;
  output: Record<string, any>;
  durationMs: number;
}

/**
 * Workflow completed successfully
 */
export interface WorkflowCompletionPayload extends WorkflowEventBase {
  output: Record<string, any>;
  durationMs: number;
  totalSteps: number;
}

/**
 * Workflow failed
 */
export interface WorkflowFailurePayload extends WorkflowEventBase {
  error: string;
  failedStepName?: string;
  failedStepIndex?: number;
  durationMs: number;
  retriesRemaining?: number;
}

/**
 * Step compensation started
 */
export interface CompensationPayload extends WorkflowEventBase {
  stepName: string;
  reason: string;
}

/**
 * Socket event type map
 */
export interface WorkflowSocketEvent {
  "workflow:started": WorkflowStartedPayload;
  "workflow:step_completed": StepCompletedPayload;
  "workflow:completed": WorkflowCompletionPayload;
  "workflow:failed": WorkflowFailurePayload;
  "workflow:compensation_started": CompensationPayload;
}

// ───────────────────────────────────────────────────────────────────────────
// WORKFLOW SOCKET EMITTER
// ───────────────────────────────────────────────────────────────────────────

/**
 * WorkflowSocketEmitter — Emits workflow events to connected clients
 *
 * Uses Socket.io rooms for selective delivery:
 * - org:{orgId} - Organization-wide events
 * - user:{userId} - User-specific events
 * - entity:{entityId} - Entity-specific events (order, shipment)
 * - workflow:{executionId} - Execution-specific events
 */
export class WorkflowSocketEmitter {
  private io: IOServer;

  constructor(io: IOServer) {
    this.io = io;
  }

  /**
   * Get rooms for an event based on context
   */
  private getRooms(
    payload: WorkflowEventBase,
  ): string[] {
    const rooms: string[] = [];

    if (payload.orgId) {
      rooms.push(`org:${payload.orgId}`);
    }

    if (payload.userId) {
      rooms.push(`user:${payload.userId}`);
    }

    if (payload.entityId) {
      rooms.push(`entity:${payload.entityId}`);
    }

    rooms.push(`workflow:${payload.executionId}`);

    return rooms;
  }

  /**
   * Emit event to rooms with reconnection handling
   */
  private emitToRooms<K extends keyof WorkflowSocketEvent>(
    eventName: K,
    payload: WorkflowSocketEvent[K],
    rooms: string[],
  ): void {
    // Emit to each room
    for (const room of rooms) {
      this.io.to(room).emit(eventName, payload);
    }

    // Also store in memory for client reconnection (simple approach)
    this.storeEventForReconnect(eventName, payload);
  }

  /**
   * Simple in-memory storage for recent events (for reconnection)
   * In production, use Redis or similar persistent store
   */
  private eventStore: Map<string, any[]> = new Map();

  /**
   * Store event for potential reconnection
   */
  private storeEventForReconnect<K extends keyof WorkflowSocketEvent>(
    eventName: K,
    payload: WorkflowSocketEvent[K],
  ): void {
    const key = `events:${(payload as any).executionId}`;
    const events = this.eventStore.get(key) || [];

    // Keep last 100 events per execution
    events.push({ eventName, payload, timestamp: Date.now() });
    if (events.length > 100) {
      events.shift();
    }

    this.eventStore.set(key, events);
  }

  /**
   * Get stored events for reconnection
   */
  getStoredEvents(executionId: string): Array<{ eventName: string; payload: any }> {
    return this.eventStore.get(`events:${executionId}`) || [];
  }

  /**
   * Emit workflow started event
   */
  workflowStarted(payload: WorkflowStartedPayload): void {
    const rooms = this.getRooms(payload);
    this.emitToRooms("workflow:started", payload, rooms);
  }

  /**
   * Emit step completed event
   */
  stepCompleted(payload: StepCompletedPayload): void {
    const rooms = this.getRooms(payload);
    this.emitToRooms("workflow:step_completed", payload, rooms);
  }

  /**
   * Emit workflow completed event
   */
  workflowCompleted(payload: WorkflowCompletionPayload): void {
    const rooms = this.getRooms(payload);
    this.emitToRooms("workflow:completed", payload, rooms);

    // Cleanup event store after completion
    setTimeout(() => {
      this.eventStore.delete(`events:${payload.executionId}`);
    }, 3600000); // 1 hour
  }

  /**
   * Emit workflow failed event
   */
  workflowFailed(payload: WorkflowFailurePayload): void {
    const rooms = this.getRooms(payload);
    this.emitToRooms("workflow:failed", payload, rooms);
  }

  /**
   * Emit compensation started event
   */
  compensationStarted(payload: CompensationPayload): void {
    const rooms = this.getRooms(payload);
    this.emitToRooms("workflow:compensation_started", payload, rooms);
  }

  /**
   * Subscribe a socket to execution-specific room
   */
  subscribeToExecution(socket: Socket, executionId: string): void {
    socket.join(`workflow:${executionId}`);

    // Send recent events on reconnect
    const stored = this.getStoredEvents(executionId);
    for (const event of stored.slice(-10)) {
      // Send last 10 events
      socket.emit(event.eventName, event.payload);
    }
  }

  /**
   * Unsubscribe socket from execution room
   */
  unsubscribeFromExecution(socket: Socket, executionId: string): void {
    socket.leave(`workflow:${executionId}`);
  }

  /**
   * Subscribe socket to organization room
   */
  subscribeToOrg(socket: Socket, orgId: string): void {
    socket.join(`org:${orgId}`);
  }

  /**
   * Subscribe socket to entity room
   */
  subscribeToEntity(socket: Socket, entityId: string): void {
    socket.join(`entity:${entityId}`);
  }

  /**
   * Get connected clients count in a room
   */
  getRoomSize(room: string): number {
    const r = this.io.sockets.adapter.rooms.get(room);
    return r ? r.size : 0;
  }

  /**
   * Get all rooms and their sizes
   */
  getAllRooms(): Record<string, number> {
    const rooms: Record<string, number> = {};
    const allRooms = this.io.sockets.adapter.rooms;

    for (const [roomName, members] of allRooms) {
      // Skip socket ID rooms (they're individual connections)
      if (!roomName.includes(":")) {
        continue;
      }
      rooms[roomName] = members.size;
    }

    return rooms;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast<K extends keyof WorkflowSocketEvent>(
    eventName: K,
    payload: WorkflowSocketEvent[K],
  ): void {
    this.io.emit(eventName, payload);
  }

  /**
   * Setup Socket.io reconnection handler
   * Should be called on socket connection
   */
  setupReconnectionHandler(socket: Socket): void {
    socket.on("workflow:reconnect", (data: { executionId: string }) => {
      this.subscribeToExecution(socket, data.executionId);
    });

    socket.on("workflow:subscribe_execution", (data: { executionId: string }) => {
      this.subscribeToExecution(socket, data.executionId);
    });

    socket.on("workflow:subscribe_org", (data: { orgId: string }) => {
      this.subscribeToOrg(socket, data.orgId);
    });

    socket.on("workflow:subscribe_entity", (data: { entityId: string }) => {
      this.subscribeToEntity(socket, data.entityId);
    });
  }

  /**
   * Clean up old events from store
   */
  cleanupOldEvents(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, events] of this.eventStore) {
      const filtered = (events as any[]).filter((e) => now - e.timestamp < maxAgeMs);

      if (filtered.length === 0) {
        this.eventStore.delete(key);
        cleanedCount++;
      } else if (filtered.length < events.length) {
        this.eventStore.set(key, filtered);
      }
    }

    return cleanedCount;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CLIENT SUBSCRIPTION HELPERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Setup workflow event listeners on client socket
 * Usage: setupClientListeners(socket, { onStarted: (...) => {...} })
 */
export function setupClientListeners(
  socket: Socket,
  handlers: {
    onStarted?: (payload: WorkflowStartedPayload) => void;
    onStepCompleted?: (payload: StepCompletedPayload) => void;
    onCompleted?: (payload: WorkflowCompletionPayload) => void;
    onFailed?: (payload: WorkflowFailurePayload) => void;
    onCompensationStarted?: (payload: CompensationPayload) => void;
  },
): void {
  if (handlers.onStarted) {
    socket.on("workflow:started", handlers.onStarted);
  }

  if (handlers.onStepCompleted) {
    socket.on("workflow:step_completed", handlers.onStepCompleted);
  }

  if (handlers.onCompleted) {
    socket.on("workflow:completed", handlers.onCompleted);
  }

  if (handlers.onFailed) {
    socket.on("workflow:failed", handlers.onFailed);
  }

  if (handlers.onCompensationStarted) {
    socket.on("workflow:compensation_started", handlers.onCompensationStarted);
  }
}
