/**
 * Webhook Delivery Load Testing - K6
 * Tests: 1000 events/min throughput test, retry storm simulation
 * Scenarios: ~100 lines
 * - Thresholds: delivery p95 < 2s
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Trend, Counter, Rate, Gauge } from "k6/metrics";
import { generateWebhookEvent } from "./helpers/data-generators.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000/api/v4";
const WEBHOOK_URL = __ENV.WEBHOOK_URL || "http://localhost:3001/webhooks";
const AUTH_TOKEN = __ENV.TEST_TOKEN || "test-token";

export const options = {
  stages: [
    // Ramp up to 100 VUs (1000 events/min at ~1s think time)
    { duration: "30s", target: 100 },
    // Sustain for 5 minutes
    { duration: "5m", target: 100 },
    // Ramp down
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    webhook_delivery_duration: ["p(95)<2000", "p(99)<5000", "avg<1000"],
    webhook_retry_duration: ["p(95)<3000", "p(99)<6000", "avg<1500"],
    http_req_failed: ["rate<0.05"],
    webhook_success_rate: ["rate>0.90"],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const webhookDeliveryDuration = new Trend("webhook_delivery_duration");
const webhookRetryDuration = new Trend("webhook_retry_duration");
const webhookSuccessRate = new Rate("webhook_success_rate");
const deliveryAttempts = new Counter("webhook_delivery_attempts");
const failedDeliveries = new Counter("webhook_failed_deliveries");
const activeWebhooks = new Gauge("active_webhooks");

// ─── Test Scenarios ─────────────────────────────────────────────────────────

export default function () {
  activeWebhooks.set(__VU);

  // Scenario: Webhook delivery with retry handling
  group("Webhook Delivery", () => {
    const eventTypes = [
      "order.created",
      "order.updated",
      "order.completed",
      "delivery.started",
      "delivery.completed",
      "driver.location.updated",
    ];

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const webhookEvent = generateWebhookEvent(eventType);

    const startTime = Date.now();
    const response = http.post(
      `${WEBHOOK_URL}/inbound`,
      JSON.stringify(webhookEvent),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "X-Webhook-Signature": `sha256=${Math.random().toString(36).substring(7)}`,
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    webhookDeliveryDuration.add(duration);
    deliveryAttempts.add(1);

    const success = check(response, {
      "webhook status is 200": (r) => r.status === 200,
      "webhook response is JSON": (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });

    webhookSuccessRate.add(success);
    if (!success) {
      failedDeliveries.add(1);
    }
  });

  sleep(0.6); // ~1000 events/min at 100 VUs

  // Scenario: Webhook retry simulation
  if (Math.random() < 0.1) {
    // 10% of requests are retries
    group("Webhook Retry Storm", () => {
      const eventTypes = ["order.updated", "delivery.started"];
      const eventType =
        eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const webhookEvent = generateWebhookEvent(eventType);

      const startTime = Date.now();
      const response = http.post(
        `${WEBHOOK_URL}/inbound`,
        JSON.stringify({
          ...webhookEvent,
          attemptNumber: Math.floor(Math.random() * 3) + 1,
          retryable: true,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "X-Retry-Attempt": "2",
            "X-Webhook-Signature": `sha256=${Math.random().toString(36).substring(7)}`,
          },
          timeout: "10s",
        },
      );

      const duration = Date.now() - startTime;
      webhookRetryDuration.add(duration);
      deliveryAttempts.add(1);

      const success = check(response, {
        "retry status is 200 or 429": (r) =>
          r.status === 200 || r.status === 429,
      });

      webhookSuccessRate.add(success);
      if (!success) {
        failedDeliveries.add(1);
      }
    });
  }
}
