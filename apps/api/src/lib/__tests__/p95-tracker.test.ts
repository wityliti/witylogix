import { describe, it, expect, beforeEach } from "vitest";
import { p95Tracker } from "../p95-tracker.js";

describe("P95Tracker", () => {
  beforeEach(() => {
    p95Tracker.reset("test_endpoint");
    p95Tracker.reset("carrier_rates");
  });

  it("returns null stats when no samples recorded", () => {
    expect(p95Tracker.stats("test_endpoint")).toBeNull();
  });

  it("records a single sample and returns correct stats", () => {
    p95Tracker.record("test_endpoint", 120);
    const stats = p95Tracker.stats("test_endpoint");
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(1);
    expect(stats!.p50).toBe(120);
    expect(stats!.p95).toBe(120);
    expect(stats!.min).toBe(120);
    expect(stats!.max).toBe(120);
  });

  it("calculates p95 correctly with 20 samples", () => {
    // Record latencies 10, 20, 30, ..., 200ms
    for (let i = 1; i <= 20; i++) {
      p95Tracker.record("test_endpoint", i * 10);
    }
    const stats = p95Tracker.stats("test_endpoint");
    expect(stats!.count).toBe(20);
    // p95 of 20 samples: idx = ceil(0.95 * 20) - 1 = 18, value = 190ms
    expect(stats!.p95).toBe(190);
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(200);
  });

  it("p95 for carrier_rates: passes BFS threshold at ≤500ms", () => {
    // Simulate 100 realistic requests all under 500ms
    for (let i = 0; i < 95; i++) p95Tracker.record("carrier_rates", 50 + i); // 50-144ms
    for (let i = 0; i < 5; i++) p95Tracker.record("carrier_rates", 450); // tail: 450ms
    const stats = p95Tracker.stats("carrier_rates");
    expect(stats!.p95).toBeLessThanOrEqual(500);
  });

  it("p95 for carrier_rates: flags breach at >500ms", () => {
    for (let i = 0; i < 90; i++) p95Tracker.record("carrier_rates", 100);
    for (let i = 0; i < 10; i++) p95Tracker.record("carrier_rates", 700); // 10% above threshold
    const stats = p95Tracker.stats("carrier_rates");
    expect(stats!.p95).toBeGreaterThan(500);
  });

  it("allStats returns all tracked endpoints", () => {
    p95Tracker.record("test_endpoint", 100);
    p95Tracker.record("carrier_rates", 200);
    const all = p95Tracker.allStats();
    expect(all).toHaveProperty("test_endpoint");
    expect(all).toHaveProperty("carrier_rates");
  });

  it("circular buffer overwrites old samples after WINDOW_SIZE", () => {
    // Fill past window size (500) with high latency, then overwrite with low
    for (let i = 0; i < 500; i++) p95Tracker.record("test_endpoint", 1000);
    for (let i = 0; i < 500; i++) p95Tracker.record("test_endpoint", 50);
    const stats = p95Tracker.stats("test_endpoint");
    // After 1000 records, only last 500 (all 50ms) are in window
    expect(stats!.p95).toBe(50);
    expect(stats!.count).toBe(500);
  });
});
