/**
 * Sandbox Mode for Webhooks
 * Intercept webhooks for testing without sending to real endpoints
 */

import { v4 as uuidv4 } from "uuid";
import type { WebhookEvent, WebhookEventType } from "./types";

/**
 * Sandboxed webhook event
 */
export interface SandboxEvent extends WebhookEvent {
  sandboxedAt: Date;
  willExpireAt: Date;
}

/**
 * Sandbox mode configuration
 */
export interface SandboxConfig {
  enabled: boolean;
  enabledAt: Date;
  expiresAt: Date;
  eventLimit?: number;
  capturedEvents: number;
}

/**
 * Sandbox Mode Service
 * Manages sandbox mode for webhook testing
 */
export class SandboxMode {
  // Per-integration sandbox configs: integrationId -> SandboxConfig
  private sandboxConfigs: Map<string, SandboxConfig> = new Map();

  // Captured events: integrationId -> array of events
  private capturedEvents: Map<string, SandboxEvent[]> = new Map();

  // Sandbox duration: 1 hour
  private sandboxDurationMs = 60 * 60 * 1000;

  /**
   * Enable sandbox mode for an integration
   * @param integrationId - Integration ID
   * @param durationMs - Duration in milliseconds (default: 1 hour)
   * @returns Sandbox configuration
   */
  enableSandbox(integrationId: string, durationMs?: number): SandboxConfig {
    const duration = durationMs || this.sandboxDurationMs;
    const enabledAt = new Date();
    const expiresAt = new Date(enabledAt.getTime() + duration);

    const config: SandboxConfig = {
      enabled: true,
      enabledAt,
      expiresAt,
      eventLimit: 1000,
      capturedEvents: 0,
    };

    this.sandboxConfigs.set(integrationId, config);
    this.capturedEvents.set(integrationId, []);

    // Schedule auto-disable
    this.scheduleAutoDisable(integrationId, duration);

    return config;
  }

  /**
   * Disable sandbox mode for an integration
   */
  disableSandbox(integrationId: string): void {
    this.sandboxConfigs.delete(integrationId);
    this.capturedEvents.delete(integrationId);
  }

  /**
   * Check if sandbox mode is active for an integration
   */
  isSandboxEnabled(integrationId: string): boolean {
    const config = this.sandboxConfigs.get(integrationId);
    if (!config) return false;

    // Check expiration
    if (new Date() > config.expiresAt) {
      this.disableSandbox(integrationId);
      return false;
    }

    return config.enabled;
  }

  /**
   * Capture an event in sandbox mode
   */
  captureEvent(integrationId: string, event: WebhookEvent): SandboxEvent | null {
    if (!this.isSandboxEnabled(integrationId)) {
      return null;
    }

    const config = this.sandboxConfigs.get(integrationId);
    if (!config || (config.eventLimit && config.capturedEvents >= config.eventLimit)) {
      return null;
    }

    const sandboxEvent: SandboxEvent = {
      ...event,
      id: uuidv4(),
      sandboxedAt: new Date(),
      willExpireAt: config.expiresAt,
    };

    const events = this.capturedEvents.get(integrationId) || [];
    events.unshift(sandboxEvent);
    this.capturedEvents.set(integrationId, events);

    config.capturedEvents++;
    return sandboxEvent;
  }

  /**
   * Get captured events for an integration
   */
  getCapturedEvents(integrationId: string, limit: number = 100): SandboxEvent[] {
    const events = this.capturedEvents.get(integrationId) || [];
    return events.slice(0, limit);
  }

  /**
   * Get a specific captured event
   */
  getEvent(integrationId: string, eventId: string): SandboxEvent | undefined {
    const events = this.capturedEvents.get(integrationId) || [];
    return events.find((e) => e.id === eventId);
  }

  /**
   * Clear captured events for an integration
   */
  clearCapturedEvents(integrationId: string): void {
    this.capturedEvents.delete(integrationId);
    const config = this.sandboxConfigs.get(integrationId);
    if (config) {
      config.capturedEvents = 0;
    }
  }

  /**
   * Get sandbox configuration
   */
  getSandboxConfig(integrationId: string): SandboxConfig | null {
    const config = this.sandboxConfigs.get(integrationId);
    if (!config) return null;

    // Check expiration
    if (new Date() > config.expiresAt) {
      this.disableSandbox(integrationId);
      return null;
    }

    return config;
  }

  /**
   * Get sandbox status summary
   */
  getSandboxStatus(integrationId: string): {
    enabled: boolean;
    enabledAt?: Date;
    expiresAt?: Date;
    timeRemaining?: number;
    eventsCaptured: number;
    eventLimit?: number;
  } {
    const config = this.getSandboxConfig(integrationId);
    if (!config) {
      return {
        enabled: false,
        eventsCaptured: 0,
      };
    }

    const now = new Date();
    const timeRemaining = config.expiresAt.getTime() - now.getTime();

    return {
      enabled: true,
      enabledAt: config.enabledAt,
      expiresAt: config.expiresAt,
      timeRemaining: Math.max(0, timeRemaining),
      eventsCaptured: config.capturedEvents,
      eventLimit: config.eventLimit,
    };
  }

  /**
   * Generate sandbox test headers
   */
  generateSandboxHeaders(integrationId: string): Record<string, string> {
    return {
      "X-Witylogix-Sandbox": "true",
      "X-Witylogix-Integration": integrationId,
      "X-Witylogix-Sandbox-Mode": "capture",
    };
  }

  /**
   * Filter events by type in sandbox
   */
  filterEventsByType(
    integrationId: string,
    eventType: WebhookEventType
  ): SandboxEvent[] {
    const events = this.capturedEvents.get(integrationId) || [];
    return events.filter((e) => e.type === eventType);
  }

  /**
   * Get event statistics for integration
   */
  getSandboxStats(integrationId: string): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    captureRate: string;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const config = this.getSandboxConfig(integrationId);
    if (!config) {
      return {
        totalEvents: 0,
        eventsByType: {},
        captureRate: "0%",
      };
    }

    const events = this.capturedEvents.get(integrationId) || [];
    const eventsByType: Record<string, number> = {};

    events.forEach((event) => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    const captureRate = config.eventLimit
      ? ((config.capturedEvents / config.eventLimit) * 100).toFixed(1)
      : "∞";

    return {
      totalEvents: events.length,
      eventsByType,
      captureRate: `${captureRate}%`,
      oldestEvent: events.length > 0 ? events[events.length - 1].sandboxedAt : undefined,
      newestEvent: events.length > 0 ? events[0].sandboxedAt : undefined,
    };
  }

  /**
   * Schedule auto-disable
   */
  private scheduleAutoDisable(integrationId: string, durationMs: number): void {
    setTimeout(() => {
      if (this.isSandboxEnabled(integrationId)) {
        this.disableSandbox(integrationId);
      }
    }, durationMs);
  }

  /**
   * Clear all sandboxes
   */
  clearAll(): void {
    this.sandboxConfigs.clear();
    this.capturedEvents.clear();
  }
}

// Export singleton instance
export const sandboxMode = new SandboxMode();
