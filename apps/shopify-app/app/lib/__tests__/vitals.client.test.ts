/**
 * Unit tests for vitals.client.ts — Core Web Vitals RUM instrumentation.
 *
 * Strategy:
 *  - Mock `web-vitals` to capture the callbacks passed to onLCP/onCLS/onINP.
 *  - Mock `navigator.sendBeacon` to assert payload shape in production mode.
 *  - Simulate DEV mode by patching import.meta.env.DEV to assert console output.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Metric } from "web-vitals";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const capturedCallbacks: {
  lcp: ((m: Metric) => void) | null;
  cls: ((m: Metric) => void) | null;
  inp: ((m: Metric) => void) | null;
} = { lcp: null, cls: null, inp: null };

vi.mock("web-vitals", () => ({
  onLCP: vi.fn((cb: (m: Metric) => void) => { capturedCallbacks.lcp = cb; }),
  onCLS: vi.fn((cb: (m: Metric) => void) => { capturedCallbacks.cls = cb; }),
  onINP: vi.fn((cb: (m: Metric) => void) => { capturedCallbacks.inp = cb; }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMetric(name: string, value: number): Metric {
  return {
    name,
    value,
    rating: "good",
    delta: value,
    id: `v3-${name}-123`,
    navigationType: "navigate",
    entries: [],
    attribution: {},
  } as unknown as Metric;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("initVitals", () => {
  let sendBeaconMock: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    capturedCallbacks.lcp = null;
    capturedCallbacks.cls = null;
    capturedCallbacks.inp = null;

    sendBeaconMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, "navigator", {
      value: { sendBeacon: sendBeaconMock },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { location: { pathname: "/dashboard" } },
      writable: true,
      configurable: true,
    });

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Simulate production mode by default — tests that check console output will override
    vi.stubEnv('DEV', false);

    // Reset module so initVitals is fresh for each test
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("registers callbacks for LCP, CLS, and INP", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    const { onLCP, onCLS, onINP } = await import("web-vitals");
    expect(onLCP).toHaveBeenCalledOnce();
    expect(onCLS).toHaveBeenCalledOnce();
    expect(onINP).toHaveBeenCalledOnce();
  });

  it("sends a beacon to /api/v4/rum/vitals with correct payload shape", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    const metric = makeMetric("LCP", 1200);
    capturedCallbacks.lcp!(metric);

    expect(sendBeaconMock).toHaveBeenCalledOnce();
    const [url, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
    expect(url).toBe("https://api.witylogix.com/api/v4/rum/vitals");

    const text = await blob.text();
    const payload = JSON.parse(text);
    expect(payload).toMatchObject({
      name: "LCP",
      value: 1200,
      rating: "good",
      page: "/dashboard",
    });
    expect(typeof payload.ts).toBe("number");
  });

  it("rates LCP 1200 ms as 'good'", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    capturedCallbacks.lcp!(makeMetric("LCP", 1200));
    const payload = JSON.parse(await (sendBeaconMock.mock.calls[0][1] as Blob).text());
    expect(payload.rating).toBe("good");
  });

  it("rates LCP 3000 ms as 'needs-improvement'", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    capturedCallbacks.lcp!(makeMetric("LCP", 3000));
    const payload = JSON.parse(await (sendBeaconMock.mock.calls[0][1] as Blob).text());
    expect(payload.rating).toBe("needs-improvement");
  });

  it("rates LCP 6000 ms as 'poor'", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    capturedCallbacks.lcp!(makeMetric("LCP", 6000));
    const payload = JSON.parse(await (sendBeaconMock.mock.calls[0][1] as Blob).text());
    expect(payload.rating).toBe("poor");
  });

  it("rates CLS 0.05 as 'good'", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    capturedCallbacks.cls!(makeMetric("CLS", 0.05));
    const payload = JSON.parse(await (sendBeaconMock.mock.calls[0][1] as Blob).text());
    expect(payload.rating).toBe("good");
  });

  it("rates INP 250 ms as 'needs-improvement'", async () => {
    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    capturedCallbacks.inp!(makeMetric("INP", 250));
    const payload = JSON.parse(await (sendBeaconMock.mock.calls[0][1] as Blob).text());
    expect(payload.rating).toBe("needs-improvement");
  });

  it("does not call sendBeacon when apiBaseUrl is null", async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { initVitals } = await import("../vitals.client");
    initVitals(null);

    capturedCallbacks.lcp!(makeMetric("LCP", 1200));
    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("%c[Web Vitals]"),
      expect.any(String),
    );
  });

  it("does not throw when sendBeacon is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    const { initVitals } = await import("../vitals.client");
    initVitals("https://api.witylogix.com");

    expect(() => capturedCallbacks.lcp!(makeMetric("LCP", 1200))).not.toThrow();
  });
});
