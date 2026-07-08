# Payment System Integration Guide

## Quick Start

### 1. Register Routes in API Server

In `apps/api/src/index.ts` or your Fastify setup:

```typescript
import paymentMethodRoutes from "./routes/payment-methods.js";

export default async function buildApp(fastify: FastifyInstance) {
  // ... existing setup ...

  // Register payment routes
  fastify.register(paymentMethodRoutes, { prefix: "/api" });
}
```

### 2. Run Database Migration

Create and apply the Prisma migration:

```bash
npx prisma migrate dev --name add_payment_system
```

This will:

- Create `payment_methods` table
- Create `payment_transactions` table
- Create `refunds` table
- Create `cod_collections` table
- Create `idempotency_keys` table
- Add relations to existing Order, Shipment, Driver, Shop tables

### 3. Import Payment Types in Your Code

```typescript
import {
  PaymentMethod,
  PaymentIntent,
  Transaction,
  RefundRequest,
  CODCollection,
  PaymentProcessor,
  createPaymentProcessor,
} from "@witylogix/core/payments";
```

---

## Usage Examples

### Initialize Payment Processor

```typescript
import { createPaymentProcessor } from "@witylogix/core/payments";

// In your service initialization
const paymentProcessor = createPaymentProcessor(
  db, // Tenant database connection
  logger, // Optional logger
);

// Register additional gateways (Phase 2)
// paymentProcessor.registerGateway(new StripeGateway(stripeConfig));
// paymentProcessor.registerGateway(new PayPalGateway(paypalConfig));
```

### Create a Payment Intent

```typescript
const intent = await paymentProcessor.createPaymentIntent({
  shopId: "shop-uuid",
  orderId: "order-uuid",
  amount: 10000, // $100.00 in cents
  currency: "USD",
  methodType: "cod",
  description: "Payment for order #12345",
  metadata: { orderNumber: "12345" },
  idempotencyKey: crypto.randomUUID(), // Prevent duplicates
});

console.log(intent.id); // Use this to track payment
```

### Capture a Payment

```typescript
const transaction = await paymentProcessor.capturePayment({
  shopId: "shop-uuid",
  paymentIntentId: intent.id,
  idempotencyKey: crypto.randomUUID(),
});

console.log(transaction.status); // 'completed'
```

### Process Refund

```typescript
const refund = await paymentProcessor.refundPayment({
  shopId: "shop-uuid",
  transactionId: transaction.id,
  amount: 5000, // Partial refund of $50.00 (null = full)
  reason: "customer_request",
  description: "Customer changed mind",
  idempotencyKey: crypto.randomUUID(),
});

console.log(refund.status); // 'processing'
```

### Record COD Collection

```typescript
const codCollection = await paymentProcessor.recordCODCollection({
  shopId: "shop-uuid",
  shipmentId: "ship-uuid",
  driverId: "driver-uuid",
  amount: 5000, // $50.00 in cents
  currency: "USD",
  metadata: { driverNotes: "Collected without issue" },
  idempotencyKey: crypto.randomUUID(),
});

console.log(codCollection.status); // 'collected'
```

### Verify COD Collection

```typescript
const verified = await paymentProcessor.verifyCODCollection({
  shopId: "shop-uuid",
  codCollectionId: codCollection.id,
});

console.log(verified.status); // 'verified'
```

### Reconcile COD Collections

```typescript
const reconciliation = await paymentProcessor.reconcileCODCollections({
  shopId: "shop-uuid",
  driverId: "driver-uuid",
  depositDate: new Date(),
  totalAmount: 50000, // $500.00 in cents (sum of collections)
  codCollectionIds: ["cod-uuid-1", "cod-uuid-2", "cod-uuid-3"],
  depositId: "DEPOSIT-12345",
});

console.log(reconciliation.reconcilationId); // Track reconciliation
```

---

## Webhook Handling

### Setup Webhook Endpoint

The API route `/api/webhooks/payments` handles incoming webhooks from payment providers.

### Webhook Integration (Phase 2)

When implementing Stripe/PayPal gateways:

```typescript
// In gateway implementation
async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
  // Use provider's library to verify
  // e.g., stripe.webhooks.constructEvent(rawBody, signature, secret)
  return isValid;
}

async parseWebhookPayload(payload: any): Promise<PaymentWebhookPayload> {
  return {
    type: 'payment.captured',
    provider: 'stripe',
    providerEventId: payload.id,
    timestamp: new Date(payload.created * 1000),
    data: {
      transactionId: payload.data.object.id,
      amount: payload.data.object.amount,
      currency: payload.data.object.currency,
      status: 'completed',
      providerTransactionId: payload.data.object.id,
    },
  };
}
```

---

## Integrating with Orders & Shipments

### Trigger Payment on Order Creation

```typescript
// In orders service
async function createOrder(orderData: any) {
  const order = await db.order.create({ data: orderData });

  // If order requires payment, create payment intent
  if (orderData.paymentMethod) {
    const intent = await paymentProcessor.createPaymentIntent({
      shopId: order.shopId,
      orderId: order.id,
      amount: Math.round(order.totalPrice * 100), // Convert to cents
      currency: order.currency || "USD",
      methodType: orderData.paymentMethod,
      idempotencyKey: `order-${order.id}`,
    });

    // Store intent ID for later capture
    await db.order.update({
      where: { id: order.id },
      data: { metadata: { paymentIntentId: intent.id } },
    });
  }

  return order;
}
```

### Link Shipment to COD Payment

```typescript
// In shipment service
async function createShipment(shipmentData: any) {
  const shipment = await db.shipment.create({ data: shipmentData });

  // If COD payment expected, create payment intent
  if (shipmentData.codAmount) {
    const intent = await paymentProcessor.createPaymentIntent({
      shopId: shipment.shopId,
      shipmentId: shipment.id,
      amount: shipmentData.codAmount,
      currency: "USD",
      methodType: "cod",
      idempotencyKey: `shipment-cod-${shipment.id}`,
    });

    // Track payment intent
    await db.shipment.update({
      where: { id: shipment.id },
      data: { metadata: { paymentIntentId: intent.id } },
    });
  }

  return shipment;
}
```

### Process COD on Driver Delivery

```typescript
// In driver app / delivery service
async function confirmDeliveryWithCOD(deliveryData: any) {
  const shipment = await db.shipment.findUnique({
    where: { id: deliveryData.shipmentId },
  });

  // Record COD collection
  const codCollection = await paymentProcessor.recordCODCollection({
    shopId: shipment.shopId,
    shipmentId: shipment.id,
    driverId: deliveryData.driverId,
    amount: shipment.metadata.codAmount,
    currency: "USD",
    metadata: {
      proofOfDelivery: deliveryData.podId,
      driverNotes: deliveryData.notes,
    },
    idempotencyKey: `cod-delivery-${shipment.id}-${Date.now()}`,
  });

  // Mark shipment delivered
  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "DELIVERED",
      actualDelivery: new Date(),
      metadata: { codCollectionId: codCollection.id },
    },
  });

  return codCollection;
}
```

---

## Error Handling

### Handle Payment Errors

```typescript
import { PaymentError, IdempotencyError } from "@witylogix/core/payments";

try {
  const intent = await paymentProcessor.createPaymentIntent(request);
  // ...
} catch (error) {
  if (error instanceof IdempotencyError) {
    // Request was already processed; return cached result
    return { success: true, data: error.existingResult };
  }

  if (error instanceof PaymentError) {
    switch (error.code) {
      case "GATEWAY_NOT_FOUND":
        return reply.code(404).send({ error: "Payment method not available" });
      case "CAPTURE_FAILED":
        if (error.retryable) {
          // Implement retry logic
        }
        return reply.code(500).send({ error: error.message });
      default:
        return reply.code(error.statusCode).send({ error: error.message });
    }
  }

  throw error;
}
```

---

## Adding a New Payment Gateway (Phase 2)

### Implement StripeGateway

```typescript
// packages/core/src/payments/gateways/stripe.ts

import Stripe from "stripe";
import { PaymentGateway } from "../gateway.js";

export class StripeGateway extends PaymentGateway {
  name = "Stripe";
  code = "stripe";
  private stripe: Stripe;

  constructor(config: PaymentGatewayConfig) {
    super(config);
    this.stripe = new Stripe(config.secretKey!, {
      apiVersion: "2024-04-10",
    });
  }

  async createPaymentIntent(
    shopId: string,
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: { shopId, ...metadata },
    });

    return {
      id: intent.id,
      shopId,
      amount,
      currency,
      status: "pending",
      methodType: "credit_card",
      idempotencyKey: `stripe-${intent.id}`,
      providerName: "stripe",
      providerIntentId: intent.id,
      metadata: { stripeIntentId: intent.id },
      createdAt: new Date(intent.created * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async capturePayment(paymentIntentId: string): Promise<Transaction> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
      throw new PaymentError(
        "CAPTURE_FAILED",
        `Stripe intent not succeeded: ${intent.status}`,
      );
    }

    return {
      id: intent.id,
      shopId: intent.metadata?.shopId || "",
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: "completed",
      type: "charge",
      methodType: "credit_card",
      providerName: "stripe",
      providerTransactionId: intent.id,
      metadata: { stripeIntentId: intent.id },
      createdAt: new Date(intent.created * 1000),
      updatedAt: new Date(),
      completedAt: new Date(),
    };
  }

  async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRequest> {
    const refund = await this.stripe.refunds.create({
      payment_intent: transactionId,
      amount,
      metadata: { reason },
    });

    return {
      id: refund.id,
      shopId: "",
      transactionId,
      amount,
      reason: (reason as any) || "customer_request",
      status: "completed",
      providerRefundId: refund.id,
      requestedAt: new Date(refund.created * 1000),
      completedAt: new Date(refund.created * 1000),
    };
  }

  async verifyWebhookSignature(
    payload: any,
    signature: string,
  ): Promise<boolean> {
    try {
      const secret = this.config.webhookSecret!;
      Stripe.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch {
      return false;
    }
  }

  async parseWebhookPayload(payload: any): Promise<PaymentWebhookPayload> {
    const event = JSON.parse(payload);

    switch (event.type) {
      case "payment_intent.succeeded":
        return {
          type: "payment.captured",
          provider: "stripe",
          providerEventId: event.id,
          timestamp: new Date(event.created * 1000),
          data: {
            transactionId: event.data.object.id,
            amount: event.data.object.amount,
            currency: event.data.object.currency.toUpperCase(),
            status: "completed",
            providerTransactionId: event.data.object.id,
            metadata: event.data.object.metadata,
          },
        };

      // Handle other event types...
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  async getPaymentStatus(providerTransactionId: string): Promise<Transaction> {
    const intent = await this.stripe.paymentIntents.retrieve(
      providerTransactionId,
    );

    return {
      id: intent.id,
      shopId: intent.metadata?.shopId || "",
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: intent.status === "succeeded" ? "completed" : "pending",
      type: "charge",
      methodType: "credit_card",
      providerTransactionId: intent.id,
      createdAt: new Date(intent.created * 1000),
      updatedAt: new Date(),
    };
  }
}
```

### Register StripeGateway

```typescript
import { StripeGateway } from "@witylogix/core/payments/gateways/stripe";

const stripeConfig: PaymentGatewayConfig = {
  name: "stripe",
  isEnabled: true,
  isProduction: process.env.NODE_ENV === "production",
  secretKey: process.env.STRIPE_SECRET_KEY,
  publicKey: process.env.STRIPE_PUBLIC_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  supportedMethods: ["credit_card", "debit_card"],
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

paymentProcessor.registerGateway(new StripeGateway(stripeConfig));
```

---

## Testing Checklist

### Unit Tests

```typescript
describe("PaymentProcessor", () => {
  it("should create payment intent with idempotency", async () => {
    const key = crypto.randomUUID();
    const intent1 = await processor.createPaymentIntent({
      shopId: "shop-1",
      amount: 10000,
      currency: "USD",
      methodType: "cod",
      idempotencyKey: key,
    });

    // Retry with same key
    const intent2 = await processor.createPaymentIntent({
      shopId: "shop-1",
      amount: 10000,
      currency: "USD",
      methodType: "cod",
      idempotencyKey: key,
    });

    expect(intent1.id).toBe(intent2.id); // Same intent
  });

  it("should reject refund on non-completed transaction", async () => {
    const txn = { status: "pending" };
    expect(() => processor.refundPayment({ transactionId: txn.id })).toThrow(
      "Cannot refund pending transaction",
    );
  });

  it("should record COD collection", async () => {
    const collection = await processor.recordCODCollection({
      shopId: "shop-1",
      shipmentId: "ship-1",
      driverId: "driver-1",
      amount: 5000,
      currency: "USD",
      idempotencyKey: crypto.randomUUID(),
    });

    expect(collection.status).toBe("collected");
  });
});
```

### Integration Tests

```typescript
describe("Payment API Routes", () => {
  it("POST /api/payments/process should create transaction", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/payments/process",
      payload: {
        amount: 10000,
        currency: "USD",
        idempotencyKey: crypto.randomUUID(),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe("pending");
  });

  it("POST /api/cod-collection should record collection", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: "/api/cod-collection",
      payload: {
        shipmentId: "ship-1",
        driverId: "driver-1",
        amount: 5000,
        currency: "USD",
        idempotencyKey: crypto.randomUUID(),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe("collected");
  });
});
```

---

## Monitoring & Observability

### Key Metrics to Track

```typescript
// Payment processing metrics
-payment_intent_created_total -
  payment_intent_failed_total -
  payment_captured_total -
  payment_capture_latency_ms -
  payment_refund_total -
  cod_collection_total -
  cod_verified_total -
  idempotency_cache_hit_rate -
  webhook_received_total -
  webhook_signature_failed_total;
```

### Logging Guidelines

```typescript
// Always log at these points
processor.log("info", "Creating payment intent", {
  shopId,
  amount,
  methodType,
});
processor.log("info", "Payment captured", { transactionId, amount });
processor.log("warn", "Capture retry attempt", { attempt, error });
processor.log("error", "Payment failed", { transactionId, error });
processor.log("info", "COD collection recorded", { collectionId, amount });
```

---

## Environment Variables

Required for production:

```bash
# Payment Providers (Phase 2)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Idempotency
IDEMPOTENCY_KEY_EXPIRY_HOURS=24

# Retry Policy
PAYMENT_RETRY_MAX_ATTEMPTS=3
PAYMENT_RETRY_INITIAL_DELAY_MS=1000
PAYMENT_RETRY_BACKOFF_MULTIPLIER=2
```

---

## Summary

The payment system is now integrated and ready for:

1. **COD flows** — Fully implemented and tested
2. **Online payments** — Ready for Phase 2 (Stripe, PayPal, etc.)
3. **Multi-shop support** — Tenant isolation via RLS
4. **Audit trail** — Complete transaction history
5. **Error handling** — Comprehensive error codes and retries
6. **Webhook processing** — Provider event handling (Phase 2)

Start with COD implementation and expand to online payment gateways as needed.
