/**
 * Core Web Vitals RUM instrumentation for the Shopify embedded admin app.
 *
 * Collects LCP, CLS, and INP using the `web-vitals` library and reports
 * them to the Witylogix API (production) or console (development).
 *
 * Targets per BFS/Shopify certification thresholds:
 *   LCP  < 2500 ms  (good: green)
 *   CLS  < 0.1      (good: green)
 *   INP  < 200 ms   (good: green)
 */

import { onLCP, onCLS, onINP } from "web-vitals";
import type { Metric } from "web-vitals";

const THRESHOLDS = {
  LCP: 2500,
  CLS: 0.1,
  INP: 200,
} as const;

type MetricName = keyof typeof THRESHOLDS;

function ratingFor(name: MetricName, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  // BFS: good < threshold; poor = 2× threshold; between = needs-improvement
  if (value <= threshold) return "good";
  if (value <= threshold * 2) return "needs-improvement";
  return "poor";
}

function buildPayload(metric: Metric) {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    ts: Date.now(),
  };
}

async function sendToApi(apiBaseUrl: string, payload: ReturnType<typeof buildPayload>) {
  // Fire-and-forget — never block the page for telemetry
  try {
    navigator.sendBeacon(
      `${apiBaseUrl}/api/v4/rum/vitals`,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } catch {
    // sendBeacon not available (e.g. test env) — no-op
  }
}

function reportMetric(metric: Metric, apiBaseUrl: string | null) {
  const name = metric.name as MetricName;
  const payload = buildPayload(metric);
  const rating = ratingFor(name, metric.value);
  payload.rating = rating;

  if (!apiBaseUrl || import.meta.env.DEV) {
    // Development: log to console with colour hint
    const colours: Record<string, string> = {
      good: "color: green",
      "needs-improvement": "color: orange",
      poor: "color: red",
    };
    console.log(
      `%c[Web Vitals] ${name}: ${metric.value.toFixed(name === "CLS" ? 4 : 0)} — ${rating}`,
      colours[rating] ?? "",
    );
    return;
  }

  sendToApi(apiBaseUrl, payload);
}

/**
 * Initialise Core Web Vitals collection. Call once on the client after mount.
 *
 * @param apiBaseUrl - Backend origin (e.g. "https://api.witylogix.com").
 *   Pass `null` to force console-only mode even in production.
 */
export function initVitals(apiBaseUrl: string | null): void {
  const report = (metric: Metric) => reportMetric(metric, apiBaseUrl);

  // reportAllChanges: emit on every layout shift / interaction, not just on page hide.
  // This gives faster feedback during development and finer attribution in production.
  onLCP(report);
  onCLS(report, { reportAllChanges: false }); // CLS: final value only (avoids duplicates)
  onINP(report, { reportAllChanges: false });  // INP: final value on page hide
}
