/**
 * P95 Latency Tracker — Sliding Window Histogram
 *
 * Tracks per-endpoint latency samples in a fixed-size circular buffer
 * and provides p50/p95/p99 percentile calculations on demand.
 *
 * Usage:
 *   import { p95Tracker } from './p95-tracker.js';
 *   p95Tracker.record('carrier_rates', elapsedMs);
 *   const stats = p95Tracker.stats('carrier_rates');
 *   // { p50, p95, p99, count, min, max }
 */

const WINDOW_SIZE = 500; // keep last 500 samples per endpoint

interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  min: number;
  max: number;
  mean: number;
}

class P95Tracker {
  private readonly windows: Map<string, number[]> = new Map();
  private readonly cursors: Map<string, number> = new Map();
  private readonly sizes: Map<string, number> = new Map();

  /**
   * Record a latency sample (ms) for a named endpoint.
   */
  record(endpoint: string, latencyMs: number): void {
    if (!this.windows.has(endpoint)) {
      this.windows.set(endpoint, new Array(WINDOW_SIZE).fill(0));
      this.cursors.set(endpoint, 0);
      this.sizes.set(endpoint, 0);
    }

    const buf = this.windows.get(endpoint)!;
    const cursor = this.cursors.get(endpoint)!;

    buf[cursor] = latencyMs;
    this.cursors.set(endpoint, (cursor + 1) % WINDOW_SIZE);
    this.sizes.set(endpoint, Math.min((this.sizes.get(endpoint) ?? 0) + 1, WINDOW_SIZE));
  }

  /**
   * Get percentile statistics for an endpoint.
   * Returns null if no samples recorded yet.
   */
  stats(endpoint: string): PercentileStats | null {
    const size = this.sizes.get(endpoint) ?? 0;
    if (size === 0) return null;

    const buf = this.windows.get(endpoint)!;
    const sorted = buf.slice(0, size).sort((a, b) => a - b);

    const percentile = (p: number): number => {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };

    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;

    return {
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      count: size,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean * 10) / 10,
    };
  }

  /**
   * Get all tracked endpoints and their stats (for metrics export).
   */
  allStats(): Record<string, PercentileStats> {
    const result: Record<string, PercentileStats> = {};
    for (const endpoint of this.windows.keys()) {
      const s = this.stats(endpoint);
      if (s) result[endpoint] = s;
    }
    return result;
  }

  /**
   * Reset samples for an endpoint (useful in tests).
   */
  reset(endpoint: string): void {
    this.windows.delete(endpoint);
    this.cursors.delete(endpoint);
    this.sizes.delete(endpoint);
  }
}

// Singleton — shared across the process lifetime
export const p95Tracker = new P95Tracker();
