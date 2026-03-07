/**
 * @witylogix/framework/container — Lightweight dependency injection container
 *
 * Provides service registration and resolution with singleton/transient lifetimes.
 * Used by WorkflowEngine to manage service instances and dependencies.
 *
 * Example:
 *   const container = createContainer({ env: "production" });
 *   container.register("userService", () => new UserService(), { lifetime: "singleton" });
 *   const service = container.resolve("userService");
 */

import type { Logger } from "../types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceFactory<T = unknown> = () => T | Promise<T>;

export type ServiceLifetime = "singleton" | "transient";

interface ServiceDefinition {
  factory: ServiceFactory;
  lifetime: ServiceLifetime;
  instance?: unknown;
}

export interface ContainerConfig {
  env?: string;
  logger?: Logger;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTAINER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple but powerful DI container for managing service instances.
 * Supports both singleton (one instance per app) and transient (new per resolve) lifetimes.
 */
export class Container {
  private services: Map<string, ServiceDefinition> = new Map();
  private resolving: Set<string> = new Set();
  private config: ContainerConfig;

  constructor(config: ContainerConfig = {}) {
    this.config = config;
    this.setupDefaults();
  }

  /**
   * Register a service factory with optional lifetime.
   * Lifetime: "singleton" = one instance, "transient" = new instance per resolve
   */
  register<T>(
    key: string,
    factory: ServiceFactory<T>,
    options: { lifetime?: ServiceLifetime } = {}
  ): void {
    const lifetime = options.lifetime || "transient";

    this.services.set(key, {
      factory,
      lifetime,
      instance: undefined,
    });
  }

  /**
   * Resolve a service by key.
   * For singletons, returns cached instance; for transient, creates new.
   * Throws if service not found or circular dependency detected.
   */
  async resolve<T = unknown>(key: string): Promise<T> {
    if (!this.has(key)) {
      throw new Error(
        `Service "${key}" not found in container. Did you forget to register it?`
      );
    }

    // Detect circular dependencies
    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected: ${key}`);
    }

    const definition = this.services.get(key)!;

    // Return cached singleton
    if (definition.lifetime === "singleton" && definition.instance !== undefined) {
      return definition.instance as T;
    }

    // Create new instance
    this.resolving.add(key);
    try {
      const instance = await Promise.resolve(definition.factory());

      // Cache singleton
      if (definition.lifetime === "singleton") {
        definition.instance = instance;
      }

      return instance as T;
    } finally {
      this.resolving.delete(key);
    }
  }

  /**
   * Synchronous resolve for singletons (must already be instantiated).
   * Useful for eager initialization of critical services.
   */
  resolveSync<T = unknown>(key: string): T {
    const definition = this.services.get(key);
    if (!definition) {
      throw new Error(`Service "${key}" not found in container`);
    }

    if (definition.instance === undefined) {
      throw new Error(
        `Service "${key}" not yet initialized. Use async resolve() or initialize singletons eagerly.`
      );
    }

    return definition.instance as T;
  }

  /**
   * Check if a service is registered.
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * List all registered service keys.
   */
  keys(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services and singletons.
   * Useful for testing and resets.
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }

  /**
   * Get container configuration (read-only).
   */
  getConfig(): Readonly<ContainerConfig> {
    return Object.freeze({ ...this.config });
  }

  // ───────────────────────────────────────────────────────────────────────
  // DEFAULTS
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Register default services (logger, config).
   * Can be overridden by calling register() with the same key.
   */
  private setupDefaults(): void {
    // Default logger (no-op or console-based)
    if (!this.has("logger")) {
      this.register(
        "logger",
        () => createDefaultLogger(),
        { lifetime: "singleton" }
      );
    }

    // Store config as a service
    if (!this.has("config")) {
      this.register(
        "config",
        () => ({ ...this.config }),
        { lifetime: "singleton" }
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a pre-configured container with standard services.
 */
export function createContainer(config: ContainerConfig = {}): Container {
  return new Container(config);
}

/**
 * Default logger implementation (console-based).
 * Can be replaced by passing a custom logger in config.
 */
function createDefaultLogger(): Logger {
  return {
    debug: (msg: string) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEBUG] ${msg}`);
      }
    },
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string, err?: unknown) => {
      if (err instanceof Error) {
        console.error(`[ERROR] ${msg}:`, err.message);
      } else {
        console.error(`[ERROR] ${msg}`, err);
      }
    },
  };
}

// ContainerConfig, ServiceFactory, ServiceLifetime types are exported above
