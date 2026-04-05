/**
 * Carrier Registry — Plugin/marketplace model for shipping adapters.
 *
 * Singleton registry that wraps CarrierRateEngine. Any object implementing
 * IShippingAdapter can self-register. On startup, the API reads env vars and
 * registers the built-in adapters (USPS, OnTrac) automatically.
 *
 * Env vars (all optional — adapter is skipped if credentials missing):
 *   USPS_CONSUMER_KEY, USPS_CONSUMER_SECRET
 *   ONTRAC_ACCOUNT, ONTRAC_PASSWORD
 */

import { CarrierRateEngine } from "./carrier-rate-engine.js";
import type { IShippingAdapter } from "./types.js";

// ─── Carrier Registry Entry ──────────────────────────────────────

export interface CarrierRegistryEntry {
  /** Carrier identifier, e.g. "USPS", "ONTRAC" */
  name: string;
  /** Human-readable label */
  label: string;
  /** Whether the adapter is currently active */
  enabled: boolean;
  /** Configured via env vars (not DB) */
  configSource: "env";
  /** The adapter instance */
  adapter: IShippingAdapter;
}

// ─── Carrier Registry ────────────────────────────────────────────

/**
 * Singleton carrier registry.
 *
 * Usage:
 * ```ts
 * import { carrierRegistry } from "@witylogix/core/integrations/shipping";
 *
 * // Register a custom adapter
 * carrierRegistry.register("MY_CARRIER", "My Carrier", myAdapter);
 *
 * // Get the rate engine (all registered adapters included)
 * const engine = carrierRegistry.getRateEngine();
 * const rates = await engine.compareRates(request);
 *
 * // List registered carriers for a coverage matrix
 * const carriers = carrierRegistry.list();
 * ```
 */
export class CarrierRegistry {
  private readonly engine: CarrierRateEngine = new CarrierRateEngine();
  private readonly entries: Map<string, CarrierRegistryEntry> = new Map();

  /**
   * Register a shipping adapter.
   * Replaces any existing adapter with the same name.
   */
  register(name: string, label: string, adapter: IShippingAdapter): void {
    this.entries.set(name, {
      name,
      label,
      enabled: true,
      configSource: "env",
      adapter,
    });
    this.engine.registerAdapter(name, adapter);
  }

  /**
   * Unregister a carrier adapter.
   */
  unregister(name: string): void {
    this.entries.delete(name);
    this.engine.unregisterAdapter(name);
  }

  /**
   * List all registered carriers with their status.
   */
  list(): CarrierRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Check whether a carrier is registered.
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Get the underlying CarrierRateEngine (all registered adapters).
   */
  getRateEngine(): CarrierRateEngine {
    return this.engine;
  }
}

/** Singleton instance shared across the API process. */
export const carrierRegistry = new CarrierRegistry();

// ─── Env-var Bootstrap ───────────────────────────────────────────

/**
 * Bootstrap built-in carriers from environment variables.
 * Called once at API startup. Silently skips any carrier with missing creds.
 *
 * @example
 * ```ts
 * import { bootstrapCarriersFromEnv } from "@witylogix/core/integrations/shipping";
 * await bootstrapCarriersFromEnv();
 * ```
 */
export async function bootstrapCarriersFromEnv(): Promise<void> {
  // ── USPS ──────────────────────────────────────────────────────
  if (process.env.USPS_CONSUMER_KEY && process.env.USPS_CONSUMER_SECRET) {
    const { USPSAdapter } = await import("./usps-adapter.js");
    const adapter = new USPSAdapter({
      consumerKey: process.env.USPS_CONSUMER_KEY,
      consumerSecret: process.env.USPS_CONSUMER_SECRET,
      isSandbox: process.env.USPS_SANDBOX === "true",
    });
    carrierRegistry.register("USPS", "USPS (Web Tools API v3)", adapter);
  }

  // ── OnTrac ────────────────────────────────────────────────────
  if (process.env.ONTRAC_ACCOUNT && process.env.ONTRAC_PASSWORD) {
    const { OnTracAdapter } = await import("./ontrac-adapter.js");
    const adapter = new OnTracAdapter({
      account: process.env.ONTRAC_ACCOUNT,
      password: process.env.ONTRAC_PASSWORD,
    });
    carrierRegistry.register("ONTRAC", "OnTrac (Western US)", adapter);
  }
}
