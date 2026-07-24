/**
 * Webhook Registry
 * Manages webhook endpoint registration, subscriptions, and health tracking
 */

import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";

/**
 * Webhook endpoint in registry
 */
export interface RegisteredEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  healthStatus: "healthy" | "degraded" | "unhealthy";
  successCount: number;
  failureCount: number;
  lastDeliveryAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Secret rotation record
 */
export interface SecretRotation {
  oldSecret: string;
  newSecret: string;
  rotatedAt: Date;
  validUntil: Date; // Grace period for old secret
}

/**
 * WebhookRegistry
 * Central registry for webhook endpoints with subscription management
 */
export class WebhookRegistry {
  private endpoints: Map<string, RegisteredEndpoint> = new Map();
  private tenantEndpoints: Map<string, Set<string>> = new Map(); // tenantId -> endpoint ids
  private secretRotations: Map<string, SecretRotation[]> = new Map(); // endpointId -> rotations
  private subscriptions: Map<string, Set<string>> = new Map(); // eventType -> endpoint ids

  /**
   * Register new webhook endpoint
   * @param tenantId - Tenant ID
   * @param url - Webhook URL
   * @param events - Event types to subscribe to
   * @param metadata - Optional metadata
   * @returns Registered endpoint
   */
  registerEndpoint(
    tenantId: string,
    url: string,
    events: string[],
    metadata?: Record<string, unknown>,
  ): RegisteredEndpoint {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid webhook URL");
    }

    if (!events || events.length === 0) {
      throw new Error("At least one event type required");
    }

    const id = uuidv4();
    const secret = this.generateSecret();
    const now = new Date();

    const endpoint: RegisteredEndpoint = {
      id,
      tenantId,
      url,
      events,
      secret,
      active: true,
      healthStatus: "healthy",
      successCount: 0,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
      metadata,
    };

    // Store endpoint
    this.endpoints.set(id, endpoint);

    // Index by tenant
    if (!this.tenantEndpoints.has(tenantId)) {
      this.tenantEndpoints.set(tenantId, new Set());
    }
    this.tenantEndpoints.get(tenantId)!.add(id);

    // Index by events
    for (const event of events) {
      if (!this.subscriptions.has(event)) {
        this.subscriptions.set(event, new Set());
      }
      this.subscriptions.get(event)!.add(id);
    }

    return endpoint;
  }

  /**
   * Update endpoint subscription
   * @param endpointId - Endpoint ID
   * @param events - New event list
   * @returns Updated endpoint
   */
  updateSubscription(endpointId: string, events: string[]): RegisteredEndpoint {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error("Endpoint not found");
    }

    // Remove old subscriptions
    for (const event of endpoint.events) {
      this.subscriptions.get(event)?.delete(endpointId);
    }

    // Add new subscriptions
    for (const event of events) {
      if (!this.subscriptions.has(event)) {
        this.subscriptions.set(event, new Set());
      }
      this.subscriptions.get(event)!.add(endpointId);
    }

    endpoint.events = events;
    endpoint.updatedAt = new Date();

    return endpoint;
  }

  /**
   * Get endpoint by ID
   * @param endpointId - Endpoint ID
   * @returns Endpoint or undefined
   */
  getEndpoint(endpointId: string): RegisteredEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  /**
   * Get all endpoints for tenant
   * @param tenantId - Tenant ID
   * @returns Array of endpoints
   */
  getTenantEndpoints(tenantId: string): RegisteredEndpoint[] {
    const ids = this.tenantEndpoints.get(tenantId) || new Set();
    return Array.from(ids)
      .map((id) => this.endpoints.get(id))
      .filter((e): e is RegisteredEndpoint => !!e);
  }

  /**
   * Get subscribers for event type
   * @param eventType - Event type (supports wildcards: "order.*")
   * @returns Array of endpoints subscribed to event
   */
  getSubscribers(eventType: string): RegisteredEndpoint[] {
    const exactMatch = this.subscriptions.get(eventType) || new Set();
    const endpoints = new Set(exactMatch);

    // Handle wildcard subscriptions
    const wildcard = eventType.split(".")[0] + ".*";
    const wildcardMatch = this.subscriptions.get(wildcard) || new Set();
    for (const id of wildcardMatch) {
      endpoints.add(id);
    }

    // Also check for wildcard "*"
    const allMatch = this.subscriptions.get("*") || new Set();
    for (const id of allMatch) {
      endpoints.add(id);
    }

    return Array.from(endpoints)
      .map((id) => this.endpoints.get(id))
      .filter(
        (e): e is RegisteredEndpoint => e !== undefined && e.active === true,
      );
  }

  /**
   * Unregister endpoint
   * @param endpointId - Endpoint ID
   * @returns True if removed
   */
  unregisterEndpoint(endpointId: string): boolean {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return false;
    }

    // Remove from subscriptions
    for (const event of endpoint.events) {
      this.subscriptions.get(event)?.delete(endpointId);
    }

    // Remove from tenant index
    this.tenantEndpoints.get(endpoint.tenantId)?.delete(endpointId);

    // Remove endpoint
    this.endpoints.delete(endpointId);
    this.secretRotations.delete(endpointId);

    return true;
  }

  /**
   * Rotate endpoint secret
   * @param endpointId - Endpoint ID
   * @param gracePeriodMs - How long old secret remains valid
   * @returns New secret
   */
  rotateSecret(
    endpointId: string,
    gracePeriodMs: number = 24 * 60 * 60 * 1000, // 24 hours
  ): string {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error("Endpoint not found");
    }

    const oldSecret = endpoint.secret;
    const newSecret = this.generateSecret();
    const now = new Date();

    // Record rotation
    if (!this.secretRotations.has(endpointId)) {
      this.secretRotations.set(endpointId, []);
    }

    this.secretRotations.get(endpointId)!.push({
      oldSecret,
      newSecret,
      rotatedAt: now,
      validUntil: new Date(now.getTime() + gracePeriodMs),
    });

    // Update endpoint
    endpoint.secret = newSecret;
    endpoint.updatedAt = now;

    return newSecret;
  }

  /**
   * Validate secret (check current or recent rotations)
   * @param endpointId - Endpoint ID
   * @param secret - Secret to validate
   * @returns True if valid
   */
  validateSecret(endpointId: string, secret: string): boolean {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return false;
    }

    // Check current secret
    if (endpoint.secret === secret) {
      return true;
    }

    // Check recent rotations
    const rotations = this.secretRotations.get(endpointId) || [];
    const now = new Date();

    for (const rotation of rotations) {
      if (rotation.oldSecret === secret && now <= rotation.validUntil) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update endpoint health status
   * @param endpointId - Endpoint ID
   * @param success - Whether delivery succeeded
   */
  recordDelivery(endpointId: string, success: boolean): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return;
    }

    if (success) {
      endpoint.successCount++;
      endpoint.lastDeliveryAt = new Date();
    } else {
      endpoint.failureCount++;
      endpoint.lastFailureAt = new Date();
    }

    // Update health status based on recent success rate
    const totalAttempts = endpoint.successCount + endpoint.failureCount;
    if (totalAttempts > 0) {
      const successRate = endpoint.successCount / totalAttempts;
      if (successRate >= 0.95) {
        endpoint.healthStatus = "healthy";
      } else if (successRate >= 0.75) {
        endpoint.healthStatus = "degraded";
      } else {
        endpoint.healthStatus = "unhealthy";
      }
    }

    endpoint.updatedAt = new Date();
  }

  /**
   * Toggle endpoint active status
   * @param endpointId - Endpoint ID
   * @param active - Active state
   * @returns Updated endpoint
   */
  setActive(endpointId: string, active: boolean): RegisteredEndpoint {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error("Endpoint not found");
    }

    endpoint.active = active;
    endpoint.updatedAt = new Date();

    return endpoint;
  }

  /**
   * Fan-out webhook to all subscribers
   * @param eventType - Event type
   * @param payload - Event payload
   * @returns Array of endpoint IDs to notify
   */
  fanOutToSubscribers(
    eventType: string,
    payload: Record<string, unknown>,
  ): Array<{ endpointId: string; url: string; secret: string }> {
    const subscribers = this.getSubscribers(eventType);

    return subscribers.map((endpoint) => ({
      endpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
    }));
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const endpoints = Array.from(this.endpoints.values());

    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter((e) => e.active).length,
      healthyEndpoints: endpoints.filter((e) => e.healthStatus === "healthy")
        .length,
      degradedEndpoints: endpoints.filter((e) => e.healthStatus === "degraded")
        .length,
      unhealthyEndpoints: endpoints.filter(
        (e) => e.healthStatus === "unhealthy",
      ).length,
      totalSubscriptions: this.subscriptions.size,
      totalSuccessfulDeliveries: endpoints.reduce(
        (sum, e) => sum + e.successCount,
        0,
      ),
      totalFailedDeliveries: endpoints.reduce(
        (sum, e) => sum + e.failureCount,
        0,
      ),
      totalTenants: this.tenantEndpoints.size,
    };
  }

  /**
   * Generate secure secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Get all endpoints (for admin/testing)
   */
  getAllEndpoints(): RegisteredEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Clear all endpoints (dangerous!)
   */
  clear(): void {
    this.endpoints.clear();
    this.tenantEndpoints.clear();
    this.subscriptions.clear();
    this.secretRotations.clear();
  }
}
