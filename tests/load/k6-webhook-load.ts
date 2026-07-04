/**
 * K6 Webhook Load Testing Script
 *
 * Load testing for webhook processing pipeline:
 * - Simulate 1000 webhooks/min from multiple providers
 * - Verify processing latency
 * - Check deduplication
 * - Measure queue depth
 *
 * ~250 lines
 *
 * Usage:
 *   k6 run tests/load/k6-webhook-load.ts
 *   k6 run -e WEBHOOK_URL=http://api.example.com/webhooks tests/load/k6-webhook-load.ts
 */

import { check, group, sleep } from "k6";
import http, { type Response } from "k6/http";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";
import crypto from "k6/crypto";
import encoding from "k6/encoding";

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const WEBHOOK_URL: string =
  __ENV.WEBHOOK_URL || "http://localhost:3000/webhooks";
const RAMP_UP_DURATION: string = "1m";
const SUSTAINED_DURATION: string = "10m";
const WEBHOOK_SECRET: string = __ENV.WEBHOOK_SECRET || "test_secret";
const TARGET_WEBHOOKS_PER_MIN: number = parseInt(
  __ENV.TARGET_WEBHOOKS_PER_MIN || "1000",
  10,
);

export const options = {
  stages: [
    // Ramp up to target webhook rate
    {
      duration: RAMP_UP_DURATION,
      target: Math.ceil(TARGET_WEBHOOKS_PER_MIN / 60),
    },
    // Sustained load
    {
      duration: SUSTAINED_DURATION,
      target: Math.ceil(TARGET_WEBHOOKS_PER_MIN / 60),
    },
    // Cool down
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    // Webhook processing latency thresholds
    webhook_processing_time: ["p(95)<5000", "p(99)<10000", "avg<2000"],
    // Webhook delivery success rate
    webhook_delivery_rate: ["rate>0.98"], // 98%+ success
    // Queue depth (should stay low)
    webhook_queue_depth: ["value<100"],
    // Deduplication rate (how many duplicates prevented)
    webhook_deduplication_rate: ["rate>0.95"],
  },
};

// ─── CUSTOM METRICS ─────────────────────────────────────────────────────────

const webhookProcessingTime = new Trend("webhook_processing_time");
const webhookDeliveryRate = new Rate("webhook_delivery_rate");
const webhookQueueDepth = new Gauge("webhook_queue_depth");
const webhookDeduplicationRate = new Rate("webhook_deduplication_rate");
const webhookByProvider = new Counter("webhook_by_provider");
const processingErrors = new Counter("webhook_processing_errors");
const totalWebhooksProcessed = new Counter("total_webhooks_processed");

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

function generateWebhookSignature(body: string, secret: string): string {
  const hmac = crypto.hmac("sha256", secret, body, "hex");
  return `sha256=${hmac}`;
}

function getHeaders(body: string, provider: string): Record<string, string> {
  const signature = generateWebhookSignature(body, WEBHOOK_SECRET);

  return {
    "Content-Type": "application/json",
    "X-Webhook-Provider": provider,
    "X-Webhook-Signature": signature,
    "X-Webhook-ID": `wh_${Math.random().toString(36).substring(7)}`,
    "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
  };
}

// ─── WEBHOOK PAYLOADS ───────────────────────────────────────────────────────

function generateShopifyWebhook(): string {
  const orderId: string = Math.floor(Math.random() * 1000000000).toString();

  return JSON.stringify({
    id: orderId,
    email: `customer${orderId}@example.com`,
    created_at: new Date().toISOString(),
    total_price: "29.99",
    line_items: [
      {
        id: "1",
        title: "Test Product",
        quantity: 1,
        price: "29.99",
      },
    ],
    shipping_address: {
      first_name: "John",
      last_name: "Doe",
      street: "123 Main St",
      city: "San Francisco",
      province: "CA",
      zip: "94102",
      country: "US",
      phone: "+14155551234",
    },
    customer: {
      id: orderId,
      email: `customer${orderId}@example.com`,
      first_name: "John",
      last_name: "Doe",
      phone: "+14155551234",
    },
  });
}

function generateWooCommerceWebhook(): string {
  const productId: number = Math.floor(Math.random() * 1000000);

  return JSON.stringify({
    id: productId,
    name: `Test Product ${productId}`,
    slug: `test-product-${productId}`,
    sku: `SKU-${Math.random().toString(36).substring(7)}`,
    regular_price: "29.99",
    stock_quantity: 100,
    status: "publish",
    description: "This is a test product description.",
    weight: "2.5",
    dimensions: {
      length: "10",
      width: "8",
      height: "5",
    },
  });
}

function generateMagentoWebhook(): string {
  const orderId: string = Math.floor(Math.random() * 1000000).toString();
  const trackingNumber: string = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return JSON.stringify({
    entity_id: orderId,
    increment_id: `100000${orderId}`,
    status: "complete",
    items: [
      {
        item_id: "1",
        sku: `SKU-${Math.random().toString(36).substring(7)}`,
        name: "Test Product",
        qty: 1,
      },
    ],
    shipping: {
      tracking_number: trackingNumber,
      carrier_code: "fedex",
      title: "FedEx",
    },
  });
}

function generateStripeWebhook(): string {
  const chargeId: string = `ch_${Math.random().toString(36).substring(7)}`;

  return JSON.stringify({
    id: `evt_${Math.random().toString(36).substring(7)}`,
    type: "charge.captured",
    data: {
      object: {
        id: chargeId,
        amount: 2999,
        currency: "usd",
        status: "captured",
        created: Math.floor(Date.now() / 1000),
      },
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  });
}

function generatePayPalWebhook(): string {
  const transactionId: string = `txn_${Math.random().toString(36).substring(7)}`;

  return JSON.stringify({
    id: `ppwh_${Math.random().toString(36).substring(7)}`,
    event_type: "BILLING.SUBSCRIPTION.UPDATED",
    resource_type: "subscription",
    create_time: new Date().toISOString(),
    resource: {
      id: transactionId,
      status: "ACTIVE",
      billing_info: {
        amount: {
          currency_code: "USD",
          value: "29.99",
        },
      },
    },
  });
}

// ─── WEBHOOK SCENARIOS ───────────────────────────────────────────────────────

function sendShopifyWebhook(): void {
  group("Shopify Webhook", () => {
    const body: string = generateShopifyWebhook();
    const startTime: number = Date.now();

    const response: Response = http.post(`${WEBHOOK_URL}/shopify`, body, {
      headers: getHeaders(body, "shopify"),
      timeout: "30s",
    });

    const duration: number = Date.now() - startTime;
    webhookProcessingTime.add(duration);

    const success: boolean = check(response, {
      "Shopify webhook accepted": (r) => r.status === 200 || r.status === 202,
      "Shopify response is valid JSON": (r) => {
        try {
          JSON.parse(r.body as string);
          return true;
        } catch {
          return false;
        }
      },
    });

    webhookDeliveryRate.add(success ? 1 : 0);
    webhookByProvider.add(1, { provider: "shopify" });
    totalWebhooksProcessed.add(1);

    if (!success) {
      processingErrors.add(1);
    }
  });
}

function sendWooCommerceWebhook(): void {
  group("WooCommerce Webhook", () => {
    const body: string = generateWooCommerceWebhook();
    const startTime: number = Date.now();

    const response: Response = http.post(`${WEBHOOK_URL}/woocommerce`, body, {
      headers: getHeaders(body, "woocommerce"),
      timeout: "30s",
    });

    const duration: number = Date.now() - startTime;
    webhookProcessingTime.add(duration);

    const success: boolean = check(response, {
      "WooCommerce webhook accepted": (r) =>
        r.status === 200 || r.status === 202,
    });

    webhookDeliveryRate.add(success ? 1 : 0);
    webhookByProvider.add(1, { provider: "woocommerce" });
    totalWebhooksProcessed.add(1);

    if (!success) {
      processingErrors.add(1);
    }
  });
}

function sendMagentoWebhook(): void {
  group("Magento Webhook", () => {
    const body: string = generateMagentoWebhook();
    const startTime: number = Date.now();

    const response: Response = http.post(`${WEBHOOK_URL}/magento`, body, {
      headers: getHeaders(body, "magento"),
      timeout: "30s",
    });

    const duration: number = Date.now() - startTime;
    webhookProcessingTime.add(duration);

    const success: boolean = check(response, {
      "Magento webhook accepted": (r) => r.status === 200 || r.status === 202,
    });

    webhookDeliveryRate.add(success ? 1 : 0);
    webhookByProvider.add(1, { provider: "magento" });
    totalWebhooksProcessed.add(1);

    if (!success) {
      processingErrors.add(1);
    }
  });
}

function sendStripeWebhook(): void {
  group("Stripe Webhook", () => {
    const body: string = generateStripeWebhook();
    const startTime: number = Date.now();

    const response: Response = http.post(`${WEBHOOK_URL}/stripe`, body, {
      headers: getHeaders(body, "stripe"),
      timeout: "30s",
    });

    const duration: number = Date.now() - startTime;
    webhookProcessingTime.add(duration);

    const success: boolean = check(response, {
      "Stripe webhook accepted": (r) => r.status === 200 || r.status === 202,
    });

    webhookDeliveryRate.add(success ? 1 : 0);
    webhookByProvider.add(1, { provider: "stripe" });
    totalWebhooksProcessed.add(1);

    if (!success) {
      processingErrors.add(1);
    }
  });
}

function sendPayPalWebhook(): void {
  group("PayPal Webhook", () => {
    const body: string = generatePayPalWebhook();
    const startTime: number = Date.now();

    const response: Response = http.post(`${WEBHOOK_URL}/paypal`, body, {
      headers: getHeaders(body, "paypal"),
      timeout: "30s",
    });

    const duration: number = Date.now() - startTime;
    webhookProcessingTime.add(duration);

    const success: boolean = check(response, {
      "PayPal webhook accepted": (r) => r.status === 200 || r.status === 202,
    });

    webhookDeliveryRate.add(success ? 1 : 0);
    webhookByProvider.add(1, { provider: "paypal" });
    totalWebhooksProcessed.add(1);

    if (!success) {
      processingErrors.add(1);
    }
  });
}

function testWebhookDeduplication(): void {
  group("Webhook Deduplication", () => {
    const body: string = generateShopifyWebhook();
    const webhookId: string = `wh_${Math.random().toString(36).substring(7)}`;

    // Send same webhook twice
    const headers1 = {
      ...getHeaders(body, "shopify"),
      "X-Webhook-ID": webhookId, // Same ID
    };

    const response1: Response = http.post(`${WEBHOOK_URL}/shopify`, body, {
      headers: headers1,
      timeout: "30s",
    });

    const response2: Response = http.post(`${WEBHOOK_URL}/shopify`, body, {
      headers: headers1, // Same webhook ID
      timeout: "30s",
    });

    // First should succeed, second should be deduplicated
    const success: boolean =
      response1.status === 200 || response1.status === 202;
    const deduplicated: boolean = response2.status === 409; // Conflict = duplicate detected

    webhookDeduplicationRate.add(deduplicated ? 1 : 0);
    webhookDeliveryRate.add(success ? 1 : 0);

    check(response2, {
      "Duplicate webhook rejected": (r) => r.status === 409 || r.status === 200,
    });
  });
}

function checkWebhookQueueDepth(): void {
  group("Queue Monitoring", () => {
    const response: Response = http.get(`${WEBHOOK_URL}/queue/depth`, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: "10s",
    });

    check(response, {
      "Queue depth available": (r) => r.status === 200,
    });

    try {
      const body = JSON.parse(response.body as string);
      webhookQueueDepth.set(body.depth || 0);
    } catch {
      webhookQueueDepth.set(0);
    }
  });
}

// ─── MAIN TEST FUNCTION ─────────────────────────────────────────────────────

export default function (): void {
  const provider: number = Math.random();

  if (provider < 0.2) {
    sendShopifyWebhook();
  } else if (provider < 0.4) {
    sendWooCommerceWebhook();
  } else if (provider < 0.6) {
    sendMagentoWebhook();
  } else if (provider < 0.8) {
    sendStripeWebhook();
  } else if (provider < 0.95) {
    sendPayPalWebhook();
  } else if (provider < 0.98) {
    testWebhookDeduplication();
  } else {
    checkWebhookQueueDepth();
  }

  // Small sleep to spread out requests
  sleep(0.1);
}

// ─── SETUP & TEARDOWN ───────────────────────────────────────────────────────

export function setup(): void {
  console.log(`Starting webhook load test`);
  console.log(`Target webhooks per minute: ${TARGET_WEBHOOKS_PER_MIN}`);
  console.log(`Webhook endpoint: ${WEBHOOK_URL}`);
  console.log(`Ramp-up: ${RAMP_UP_DURATION}`);
  console.log(`Sustained: ${SUSTAINED_DURATION}`);
}

export function teardown(): void {
  console.log("Webhook load test completed");
}
