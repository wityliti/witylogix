"use client";

export function track(
  eventType: string,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  void fetch("/api/v4/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType,
      source: "dashboard",
      properties,
    }),
    keepalive: true,
  }).catch(() => {
    // telemetry is best-effort; never block UI
  });
}
