/**
 * Stripe SDK Client
 * Production-ready Stripe Node.js SDK wrapper with full payment lifecycle management
 * Handles payment intents, subscriptions, invoices, checkout sessions, and refunds
 * Implements webhook verification using HMAC-SHA256
 */

import { createHmac, createHash } from "crypto";
import type {
  PaymentIntent,
  Subscription,
  Invoice,
  Refund,
  CheckoutSession,
  StripeConfig,
  WitylogixPaymentEvent,
  PaymentError,
  RateLimitInfo,
  SubscriptionItem,
  InvoiceLineItem,
} from "./payment-sdk-types";
import {
  type PaymentStatus,
  type InvoiceStatus,
  type RefundStatus,
  type RefundReason,
} from "./payment-sdk-types";

/**
 * Stripe-specific error types mapped from SDK
 */
interface StripeErrorResponse {
  type:
    | "invalid_request_error"
    | "api_error"
    | "authentication_error"
    | "card_error"
    | "rate_limit_error";
  code?: string;
  message: string;
  charge?: string;
  decline_code?: string;
  param?: string;
  status?: number;
}

/**
 * Internal error class for Stripe operations
 */
class StripePaymentError extends Error implements PaymentError {
  code: string;
  statusCode?: number;
  provider: "stripe" = "stripe";
  retryable: boolean;
  originalError?: Error;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    retryable: boolean = false,
  ) {
    super(message);
    this.name = "StripePaymentError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Stripe SDK Client
 * Wraps official Stripe Node.js SDK patterns
 */
export class StripeClient {
  private apiKey: string;
  private config: StripeConfig;
  private apiBaseUrl: string;
  private apiVersion: string;
  private maxNetworkRetries: number;
  private timeout: number;
  private rateLimitInfo: RateLimitInfo | null = null;

  // Rate limiting: 25 req/sec per Stripe limits
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestsInWindow: number[] = [];
  private readonly RATE_LIMIT_WINDOW = 1000; // 1 second
  private readonly MAX_REQUESTS_PER_SECOND = 25;

  // Idempotency cache
  private idempotencyCache = new Map<string, any>();
  private cacheTtl = 24 * 60 * 60 * 1000; // 24 hours

  constructor(config: StripeConfig) {
    if (!config.apiKey) {
      throw new StripePaymentError(
        "Stripe API key is required",
        "missing_api_key",
        400,
      );
    }

    this.apiKey = config.apiKey;
    this.config = config;
    this.apiVersion = config.apiVersion || "2023-10-16";
    this.maxNetworkRetries = config.maxNetworkRetries || 3;
    this.timeout = config.timeout || 30000;
    this.apiBaseUrl =
      config.environment === "live"
        ? "https://api.stripe.com/v1"
        : "https://api.stripe.com/v1";
  }

  /**
   * Create a payment intent (charge without immediate capture)
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    options?: {
      customerId?: string;
      paymentMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      idempotencyKey?: string;
      statementDescriptor?: string;
      receiptEmail?: string;
      confirm?: boolean;
      offSession?: boolean;
    },
  ): Promise<PaymentIntent> {
    const idempotencyKey =
      options?.idempotencyKey || this.generateIdempotencyKey();
    const cacheKey = `createPaymentIntent:${idempotencyKey}`;

    // Check cache first
    if (this.idempotencyCache.has(cacheKey)) {
      return this.idempotencyCache.get(cacheKey);
    }

    const payload = {
      amount: Math.round(amount), // Convert to cents if needed
      currency: currency.toLowerCase(),
      confirmation_method: "automatic",
      ...(options?.customerId && { customer: options.customerId }),
      ...(options?.paymentMethodId && {
        payment_method: options.paymentMethodId,
        confirm: true,
      }),
      ...(options?.description && { description: options.description }),
      ...(options?.statementDescriptor && {
        statement_descriptor: options.statementDescriptor,
      }),
      ...(options?.receiptEmail && { receipt_email: options.receiptEmail }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.offSession && { off_session: true }),
    };

    const response = await this.makeRequest(
      "POST",
      "/payment_intents",
      payload,
      {
        idempotencyKey,
      },
    );

    const intent = this.mapStripePaymentIntent(response);

    // Cache result
    this.idempotencyCache.set(cacheKey, intent);

    return intent;
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
    options?: {
      returnUrl?: string;
      idempotencyKey?: string;
    },
  ): Promise<PaymentIntent> {
    const payload: Record<string, any> = {};

    if (paymentMethodId) {
      payload.payment_method = paymentMethodId;
    }

    if (options?.returnUrl) {
      payload.return_url = options.returnUrl;
    }

    const response = await this.makeRequest(
      "POST",
      `/payment_intents/${paymentIntentId}/confirm`,
      payload,
      { idempotencyKey: options?.idempotencyKey },
    );

    return this.mapStripePaymentIntent(response);
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amount?: number,
    options?: {
      idempotencyKey?: string;
    },
  ): Promise<PaymentIntent> {
    const payload: Record<string, any> = {};

    if (amount !== undefined) {
      payload.amount_to_capture = Math.round(amount);
    }

    const response = await this.makeRequest(
      "POST",
      `/payment_intents/${paymentIntentId}/capture`,
      payload,
      { idempotencyKey: options?.idempotencyKey },
    );

    return this.mapStripePaymentIntent(response);
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
    options?: {
      cancellationReason?:
        | "duplicate"
        | "fraudulent"
        | "requested_by_customer"
        | "abandoned";
      idempotencyKey?: string;
    },
  ): Promise<PaymentIntent> {
    const payload: Record<string, any> = {};

    if (options?.cancellationReason) {
      payload.cancellation_reason = options.cancellationReason;
    }

    const response = await this.makeRequest(
      "POST",
      `/payment_intents/${paymentIntentId}/cancel`,
      payload,
      { idempotencyKey: options?.idempotencyKey },
    );

    return this.mapStripePaymentIntent(response);
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const response = await this.makeRequest(
      "GET",
      `/payment_intents/${paymentIntentId}`,
    );
    return this.mapStripePaymentIntent(response);
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceIds: string[],
    options?: {
      description?: string;
      metadata?: Record<string, any>;
      paymentBehavior?:
        | "default_incomplete"
        | "default_incomplete_and_send_email"
        | "allow_incomplete"
        | "error_if_incomplete";
      collectionMethod?: "charge_automatically" | "send_invoice";
      daysUntilDue?: number;
      idempotencyKey?: string;
      trialPeriodDays?: number;
      billingCycleAnchor?: number;
    },
  ): Promise<Subscription> {
    const idempotencyKey =
      options?.idempotencyKey || this.generateIdempotencyKey();

    const payload = {
      customer: customerId,
      items: priceIds.map((priceId) => ({ price: priceId })),
      ...(options?.description && { description: options.description }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.paymentBehavior && {
        payment_behavior: options.paymentBehavior,
      }),
      ...(options?.collectionMethod && {
        collection_method: options.collectionMethod,
      }),
      ...(options?.daysUntilDue && { days_until_due: options.daysUntilDue }),
      ...(options?.trialPeriodDays && {
        trial_period_days: options.trialPeriodDays,
      }),
      ...(options?.billingCycleAnchor && {
        billing_cycle_anchor: options.billingCycleAnchor,
      }),
    };

    const response = await this.makeRequest("POST", "/subscriptions", payload, {
      idempotencyKey,
    });

    return this.mapStripeSubscription(response);
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      priceIds?: string[];
      description?: string;
      metadata?: Record<string, any>;
      cancelAtPeriodEnd?: boolean;
      paymentBehavior?: string;
      defaultPaymentMethod?: string;
      offSession?: boolean;
    },
    idempotencyKey?: string,
  ): Promise<Subscription> {
    const payload: Record<string, any> = {};

    if (updates.priceIds) {
      payload.items = updates.priceIds.map((priceId) => ({ price: priceId }));
    }

    if (updates.description) {
      payload.description = updates.description;
    }

    if (updates.metadata) {
      payload.metadata = updates.metadata;
    }

    if (updates.cancelAtPeriodEnd !== undefined) {
      payload.cancel_at_period_end = updates.cancelAtPeriodEnd;
    }

    if (updates.paymentBehavior) {
      payload.payment_behavior = updates.paymentBehavior;
    }

    if (updates.defaultPaymentMethod) {
      payload.default_payment_method = updates.defaultPaymentMethod;
    }

    const response = await this.makeRequest(
      "POST",
      `/subscriptions/${subscriptionId}`,
      payload,
      { idempotencyKey },
    );

    return this.mapStripeSubscription(response);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    options?: {
      atPeriodEnd?: boolean;
      cancellationDetails?: {
        reason?:
          | "cancellation_requested"
          | "account_closed"
          | "account_unhappy"
          | "other";
        feedback?: string;
        comment?: string;
      };
      idempotencyKey?: string;
    },
  ): Promise<Subscription> {
    const payload: Record<string, any> = {};

    if (options?.atPeriodEnd) {
      payload.cancel_at_period_end = true;
    } else {
      // Immediate cancellation
      const response = await this.makeRequest(
        "DELETE",
        `/subscriptions/${subscriptionId}`,
        {},
        { idempotencyKey: options?.idempotencyKey },
      );
      return this.mapStripeSubscription(response);
    }

    if (options?.cancellationDetails) {
      payload.cancellation_details = options.cancellationDetails;
    }

    const response = await this.makeRequest(
      "POST",
      `/subscriptions/${subscriptionId}`,
      payload,
      { idempotencyKey: options?.idempotencyKey },
    );

    return this.mapStripeSubscription(response);
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(
    subscriptionId: string,
    options?: {
      prorationBehavior?: "create_prorations" | "none" | "always_invoice";
      idempotencyKey?: string;
    },
  ): Promise<Subscription> {
    const payload: Record<string, any> = {
      cancel_at_period_end: false,
    };

    if (options?.prorationBehavior) {
      payload.proration_behavior = options.prorationBehavior;
    }

    const response = await this.makeRequest(
      "POST",
      `/subscriptions/${subscriptionId}`,
      payload,
      { idempotencyKey: options?.idempotencyKey },
    );

    return this.mapStripeSubscription(response);
  }

  /**
   * Create an invoice
   */
  async createInvoice(
    customerId: string,
    options?: {
      description?: string;
      customFields?: Array<{ name: string; value: string }>;
      daysUntilDue?: number;
      metadata?: Record<string, any>;
      collectionMethod?: "charge_automatically" | "send_invoice";
      idempotencyKey?: string;
    },
  ): Promise<Invoice> {
    const payload = {
      customer: customerId,
      ...(options?.description && { description: options.description }),
      ...(options?.customFields && { custom_fields: options.customFields }),
      ...(options?.daysUntilDue && { days_until_due: options.daysUntilDue }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.collectionMethod && {
        collection_method: options.collectionMethod,
      }),
    };

    const response = await this.makeRequest("POST", "/invoices", payload, {
      idempotencyKey: options?.idempotencyKey,
    });

    return this.mapStripeInvoice(response);
  }

  /**
   * Send an invoice
   */
  async sendInvoice(
    invoiceId: string,
    idempotencyKey?: string,
  ): Promise<Invoice> {
    const response = await this.makeRequest(
      "POST",
      `/invoices/${invoiceId}/send`,
      {},
      { idempotencyKey },
    );

    return this.mapStripeInvoice(response);
  }

  /**
   * Void an invoice
   */
  async voidInvoice(
    invoiceId: string,
    idempotencyKey?: string,
  ): Promise<Invoice> {
    const response = await this.makeRequest(
      "POST",
      `/invoices/${invoiceId}/void`,
      {},
      { idempotencyKey },
    );

    return this.mapStripeInvoice(response);
  }

  /**
   * Mark an invoice as paid
   */
  async markInvoicePaid(
    invoiceId: string,
    idempotencyKey?: string,
  ): Promise<Invoice> {
    const response = await this.makeRequest(
      "POST",
      `/invoices/${invoiceId}/mark_paid`,
      {},
      { idempotencyKey },
    );

    return this.mapStripeInvoice(response);
  }

  /**
   * Retrieve an invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    const response = await this.makeRequest("GET", `/invoices/${invoiceId}`);
    return this.mapStripeInvoice(response);
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(options: {
    lineItems: Array<{ price: string; quantity: number }>;
    mode: "payment" | "setup" | "subscription";
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
    billingAddressCollection?: "auto" | "required";
    paymentMethodTypes?: string[];
    locale?: string;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    const payload = {
      line_items: options.lineItems,
      mode: options.mode,
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      ...(options.customerId && { customer: options.customerId }),
      ...(options.customerEmail && { customer_email: options.customerEmail }),
      ...(options.metadata && { metadata: options.metadata }),
      ...(options.billingAddressCollection && {
        billing_address_collection: options.billingAddressCollection,
      }),
      ...(options.paymentMethodTypes && {
        payment_method_types: options.paymentMethodTypes,
      }),
      ...(options.locale && { locale: options.locale }),
    };

    const response = await this.makeRequest(
      "POST",
      "/checkout/sessions",
      payload,
      {
        idempotencyKey: options.idempotencyKey,
      },
    );

    return this.mapStripeCheckoutSession(response);
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    const response = await this.makeRequest(
      "GET",
      `/checkout/sessions/${sessionId}`,
    );
    return this.mapStripeCheckoutSession(response);
  }

  /**
   * Expire a checkout session
   */
  async expireCheckoutSession(
    sessionId: string,
    idempotencyKey?: string,
  ): Promise<CheckoutSession> {
    const response = await this.makeRequest(
      "POST",
      `/checkout/sessions/${sessionId}/expire`,
      {},
      { idempotencyKey },
    );

    return this.mapStripeCheckoutSession(response);
  }

  /**
   * Create a refund
   */
  async createRefund(
    chargeId: string,
    options?: {
      amount?: number;
      reason?:
        | "duplicate"
        | "fraudulent"
        | "requested_by_customer"
        | "expired_uncaptured_charge"
        | "general";
      metadata?: Record<string, any>;
      idempotencyKey?: string;
    },
  ): Promise<Refund> {
    const payload: Record<string, any> = {
      charge: chargeId,
      ...(options?.amount && { amount: Math.round(options.amount) }),
      ...(options?.reason && { reason: options.reason }),
      ...(options?.metadata && { metadata: options.metadata }),
    };

    const response = await this.makeRequest("POST", "/refunds", payload, {
      idempotencyKey: options?.idempotencyKey,
    });

    return this.mapStripeRefund(response);
  }

  /**
   * Retrieve a refund
   */
  async getRefund(refundId: string): Promise<Refund> {
    const response = await this.makeRequest("GET", `/refunds/${refundId}`);
    return this.mapStripeRefund(response);
  }

  /**
   * List refunds
   */
  async listRefunds(options?: {
    chargeId?: string;
    limit?: number;
    startingAfter?: string;
  }): Promise<{ refunds: Refund[]; hasMore: boolean }> {
    const params = new URLSearchParams();

    if (options?.chargeId) {
      params.append("charge", options.chargeId);
    }

    if (options?.limit) {
      params.append("limit", Math.min(options.limit, 100).toString());
    }

    if (options?.startingAfter) {
      params.append("starting_after", options.startingAfter);
    }

    const response = await this.makeRequest(
      "GET",
      `/refunds?${params.toString()}`,
    );

    return {
      refunds: (response.data || []).map((refund: any) =>
        this.mapStripeRefund(refund),
      ),
      hasMore: response.has_more || false,
    };
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * Pattern: stripe.webhooks.constructEvent
   */
  verifyWebhookSignature(
    body: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const bodyStr = typeof body === "string" ? body : body.toString("utf-8");
      const expectedSignature = createHmac("sha256", secret)
        .update(bodyStr, "utf8")
        .digest("hex");

      return expectedSignature === signature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse and normalize webhook event
   */
  parseWebhookEvent(
    event: Record<string, any>,
    signature: string,
    secret: string,
  ): WitylogixPaymentEvent | null {
    try {
      // Verify signature first
      const eventStr = JSON.stringify(event);
      if (!this.verifyWebhookSignature(eventStr, signature, secret)) {
        throw new StripePaymentError(
          "Invalid webhook signature",
          "signature_verification_failed",
          401,
        );
      }

      return this.normalizeStripeWebhookEvent(event);
    } catch (error) {
      console.error("Error parsing webhook event:", error);
      return null;
    }
  }

  /**
   * Make HTTP request with rate limiting and retries
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    payload?: Record<string, any>,
    options?: { idempotencyKey?: string },
  ): Promise<any> {
    // Apply rate limiting
    await this.applyRateLimit();

    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": `Witylogix-Stripe/1.0`,
      "Stripe-Version": this.apiVersion,
    };

    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    let attempt = 0;
    let lastError: any;

    while (attempt < this.maxNetworkRetries) {
      try {
        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), this.timeout);

        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: abortCtrl.signal,
        };

        if (method !== "GET" && payload) {
          const params = new URLSearchParams();
          this.flattenPayload(payload, params);
          fetchOptions.body = params.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }

        let response: Response;
        try {
          response = await fetch(url, fetchOptions);
        } finally {
          clearTimeout(timeoutId);
        }

        // Extract rate limit info from headers
        const rateLimitHeader = response.headers.get("stripe-limit-remaining");
        const rateLimitResetHeader = response.headers.get("stripe-limit-reset");

        if (rateLimitHeader && rateLimitResetHeader) {
          this.rateLimitInfo = {
            limitRequests: 100,
            limitPeriod: 1,
            remainingRequests: parseInt(rateLimitHeader, 10),
            resetAt: new Date(parseInt(rateLimitResetHeader, 10) * 1000),
          };
        }

        if (!response.ok) {
          const errorData = (await response.json()) as {
            error?: StripeErrorResponse;
          };
          const stripeError = errorData.error ?? ({} as StripeErrorResponse);

          const isRetryable =
            response.status >= 500 ||
            response.status === 429 ||
            response.status === 503;

          throw new StripePaymentError(
            stripeError.message || `HTTP ${response.status}`,
            stripeError.code || `http_${response.status}`,
            response.status,
            isRetryable,
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        if (error instanceof StripePaymentError && !error.retryable) {
          throw error;
        }

        attempt++;

        if (attempt < this.maxNetworkRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw (
      lastError ||
      new StripePaymentError(
        "Request failed after retries",
        "network_error",
        undefined,
        false,
      )
    );
  }

  /**
   * Apply rate limiting (25 req/sec)
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();

    // Remove old timestamps outside the window
    this.requestsInWindow = this.requestsInWindow.filter(
      (timestamp) => now - timestamp < this.RATE_LIMIT_WINDOW,
    );

    // If at limit, wait for the oldest request to exit the window
    if (this.requestsInWindow.length >= this.MAX_REQUESTS_PER_SECOND) {
      const oldestRequest = this.requestsInWindow[0];
      const waitTime = this.RATE_LIMIT_WINDOW - (now - oldestRequest) + 1;

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      this.requestsInWindow = this.requestsInWindow.filter(
        (timestamp) => Date.now() - timestamp < this.RATE_LIMIT_WINDOW,
      );
    }

    this.requestsInWindow.push(now);
  }

  /**
   * Flatten nested payload for form-urlencoded
   */
  private flattenPayload(
    obj: Record<string, any>,
    params: URLSearchParams,
    prefix = "",
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object" && item !== null) {
            this.flattenPayload(item, params, `${fullKey}[${index}]`);
          } else {
            params.append(`${fullKey}[${index}]`, String(item));
          }
        });
      } else if (typeof value === "object" && value !== null) {
        this.flattenPayload(value, params, fullKey);
      } else if (value !== null && value !== undefined) {
        params.append(fullKey, String(value));
      }
    }
  }

  /**
   * Map Stripe payment intent to unified format
   */
  private mapStripePaymentIntent(stripeIntent: any): PaymentIntent {
    const statusMap: Record<string, PaymentStatus> = {
      requires_payment_method: "pending",
      requires_confirmation: "pending",
      requires_action: "pending",
      processing: "processing",
      succeeded: "succeeded",
      requires_capture: "pending",
      canceled: "canceled",
    };

    return {
      id: stripeIntent.id,
      externalId: stripeIntent.id,
      provider: "stripe",
      amount: stripeIntent.amount,
      currency: stripeIntent.currency.toUpperCase(),
      status: statusMap[stripeIntent.status] || ("pending" as PaymentStatus),
      customerId: stripeIntent.customer || undefined,
      orderId: stripeIntent.metadata?.orderId,
      description: stripeIntent.description,
      metadata: stripeIntent.metadata || {},
      paymentMethodId: stripeIntent.payment_method,
      clientSecret: stripeIntent.client_secret,
      receiptEmail: stripeIntent.receipt_email,
      statementDescriptor: stripeIntent.statement_descriptor,
      createdAt: new Date(stripeIntent.created * 1000),
      updatedAt: new Date(stripeIntent.updated * 1000),
      capturedAt: stripeIntent.charges?.data?.[0]?.captured_at
        ? new Date(stripeIntent.charges.data[0].captured_at * 1000)
        : undefined,
      errorCode: stripeIntent.last_payment_error?.code,
      errorMessage: stripeIntent.last_payment_error?.message,
      nextAction: stripeIntent.next_action
        ? {
            type: stripeIntent.next_action.type,
            url: stripeIntent.next_action.redirect_to_url?.url,
          }
        : undefined,
    };
  }

  /**
   * Map Stripe subscription to unified format
   */
  private mapStripeSubscription(stripeSub: any): Subscription {
    const statusMap: Record<string, any> = {
      trialing: "active",
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "past_due",
      incomplete: "pending",
      incomplete_expired: "canceled",
      paused: "suspended",
    };

    return {
      id: stripeSub.id,
      externalId: stripeSub.id,
      provider: "stripe",
      customerId: stripeSub.customer,
      status: statusMap[stripeSub.status] || "active",
      items: (stripeSub.items?.data || []).map((item: any) => ({
        id: item.id,
        externalId: item.id,
        priceId: item.price.id,
        quantity: item.quantity,
        metadata: item.metadata || {},
        createdAt: new Date(item.created * 1000),
      })),
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAt: stripeSub.cancel_at
        ? new Date(stripeSub.cancel_at * 1000)
        : undefined,
      canceledAt: stripeSub.canceled_at
        ? new Date(stripeSub.canceled_at * 1000)
        : undefined,
      endedAt: stripeSub.ended_at
        ? new Date(stripeSub.ended_at * 1000)
        : undefined,
      nextBillingDate: stripeSub.next_pending_invoice_item_invoice
        ? new Date(stripeSub.next_pending_invoice_item_invoice * 1000)
        : undefined,
      currency: stripeSub.currency.toUpperCase(),
      metadata: stripeSub.metadata || {},
      description: stripeSub.description,
      createdAt: new Date(stripeSub.created * 1000),
      updatedAt: new Date(stripeSub.updated * 1000),
      latestInvoiceId: stripeSub.latest_invoice,
      pauseCollection: stripeSub.pause_collection
        ? {
            resumesAt: stripeSub.pause_collection.resumes_at
              ? new Date(stripeSub.pause_collection.resumes_at * 1000)
              : undefined,
          }
        : undefined,
    };
  }

  /**
   * Map Stripe invoice to unified format
   */
  private mapStripeInvoice(stripeInvoice: any): Invoice {
    const statusMap: Record<string, InvoiceStatus> = {
      draft: "draft",
      open: "open",
      paid: "paid",
      void: "void",
      uncollectible: "uncollectible",
      scheduled: "scheduled",
    };

    return {
      id: stripeInvoice.id,
      externalId: stripeInvoice.id,
      provider: "stripe",
      customerId: stripeInvoice.customer,
      subscriptionId: stripeInvoice.subscription,
      amount: stripeInvoice.total,
      amountPaid: stripeInvoice.amount_paid,
      amountDue: stripeInvoice.amount_due,
      currency: stripeInvoice.currency.toUpperCase(),
      status: statusMap[stripeInvoice.status] || ("open" as InvoiceStatus),
      dueDate: stripeInvoice.due_date
        ? new Date(stripeInvoice.due_date * 1000)
        : undefined,
      paidAt: stripeInvoice.paid_at
        ? new Date(stripeInvoice.paid_at * 1000)
        : undefined,
      voidedAt: stripeInvoice.voided_at
        ? new Date(stripeInvoice.voided_at * 1000)
        : undefined,
      description: stripeInvoice.description,
      metadata: stripeInvoice.metadata || {},
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
      pdfUrl: stripeInvoice.invoice_pdf,
      number: stripeInvoice.number,
      createdAt: new Date(stripeInvoice.created * 1000),
      updatedAt: new Date(stripeInvoice.updated * 1000),
      lines: (stripeInvoice.lines?.data || []).map((line: any) => ({
        id: line.id,
        externalId: line.id,
        description: line.description || "",
        amount: line.amount,
        quantity: line.quantity,
        unitAmount: line.unit_amount,
        currency: stripeInvoice.currency.toUpperCase(),
        metadata: line.metadata || {},
        period: line.period
          ? {
              start: new Date(line.period.start * 1000),
              end: new Date(line.period.end * 1000),
            }
          : undefined,
      })),
      attemptCount: stripeInvoice.attempt_count,
      nextPaymentAttempt: stripeInvoice.next_payment_attempt
        ? new Date(stripeInvoice.next_payment_attempt * 1000)
        : undefined,
    };
  }

  /**
   * Map Stripe refund to unified format
   */
  private mapStripeRefund(stripeRefund: any): Refund {
    const statusMap: Record<string, RefundStatus> = {
      succeeded: "succeeded",
      failed: "failed",
      canceled: "canceled",
      pending: "pending",
    };

    const reasonMap: Record<string, RefundReason> = {
      duplicate: "duplicate",
      fraudulent: "fraudulent",
      requested_by_customer: "requested_by_customer",
      expired_uncaptured_charge: "expired_uncaptured_charge",
      general: "general",
    };

    return {
      id: stripeRefund.id,
      externalId: stripeRefund.id,
      provider: "stripe",
      chargeId: stripeRefund.charge,
      amount: stripeRefund.amount,
      currency: stripeRefund.currency.toUpperCase(),
      status: statusMap[stripeRefund.status] || ("pending" as RefundStatus),
      reason: reasonMap[stripeRefund.reason] || ("general" as RefundReason),
      metadata: stripeRefund.metadata || {},
      description: stripeRefund.description,
      createdAt: new Date(stripeRefund.created * 1000),
      updatedAt: new Date(stripeRefund.updated * 1000),
      failureReason: stripeRefund.failure_reason,
      receiptNumber: stripeRefund.receipt_number,
    };
  }

  /**
   * Map Stripe checkout session to unified format
   */
  private mapStripeCheckoutSession(stripeSession: any): CheckoutSession {
    const statusMap: Record<string, "open" | "complete" | "expired"> = {
      open: "open",
      complete: "complete",
      expired: "expired",
    };

    return {
      id: stripeSession.id,
      externalId: stripeSession.id,
      provider: "stripe",
      customerId: stripeSession.customer,
      mode: stripeSession.mode,
      paymentStatus: stripeSession.payment_status,
      status: statusMap[stripeSession.status] || "open",
      clientSecret: stripeSession.client_secret,
      url: stripeSession.url,
      successUrl: stripeSession.success_url,
      cancelUrl: stripeSession.cancel_url,
      lineItems: (stripeSession.line_items?.data || []).map((item: any) => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity,
        adjustableQuantity: item.adjustable_quantity,
        metadata: item.metadata || {},
      })),
      currency: stripeSession.currency.toUpperCase(),
      metadata: stripeSession.metadata || {},
      expiresAt: new Date(stripeSession.expires_at * 1000),
      createdAt: new Date(stripeSession.created * 1000),
      completedAt: stripeSession.completed_at
        ? new Date(stripeSession.completed_at * 1000)
        : undefined,
      customerEmail: stripeSession.customer_email,
      billingAddressCollection:
        stripeSession.billing_address_collection === "required",
    };
  }

  /**
   * Normalize Stripe webhook event to unified format
   */
  private normalizeStripeWebhookEvent(
    event: Record<string, any>,
  ): WitylogixPaymentEvent {
    const eventTypeMap: Record<string, any> = {
      "payment_intent.succeeded": {
        type: "payment.completed",
        resourceType: "payment_intent",
      },
      "payment_intent.payment_failed": {
        type: "payment.failed",
        resourceType: "payment_intent",
      },
      "charge.refunded": {
        type: "refund.completed",
        resourceType: "refund",
      },
      "charge.dispute.created": {
        type: "dispute.opened",
        resourceType: "dispute",
      },
      "charge.dispute.closed": {
        type: "dispute.closed",
        resourceType: "dispute",
      },
      "invoice.paid": {
        type: "invoice.paid",
        resourceType: "invoice",
      },
      "invoice.payment_failed": {
        type: "invoice.payment_failed",
        resourceType: "invoice",
      },
      "customer.subscription.created": {
        type: "subscription.created",
        resourceType: "subscription",
      },
      "customer.subscription.updated": {
        type: "subscription.updated",
        resourceType: "subscription",
      },
      "customer.subscription.deleted": {
        type: "subscription.canceled",
        resourceType: "subscription",
      },
      "checkout.session.completed": {
        type: "checkout.completed",
        resourceType: "checkout_session",
      },
    };

    const mapping = eventTypeMap[event.type] || {
      type: event.type,
      resourceType: "payment_intent",
    };

    const data: any = {};
    if (event.data?.object?.object === "payment_intent") {
      data.paymentIntent = this.mapStripePaymentIntent(event.data.object);
    } else if (event.data?.object?.object === "subscription") {
      data.subscription = this.mapStripeSubscription(event.data.object);
    } else if (event.data?.object?.object === "invoice") {
      data.invoice = this.mapStripeInvoice(event.data.object);
    } else if (
      event.data?.object?.object === "charge" &&
      event.type.includes("refund")
    ) {
      data.refund = this.mapStripeRefund(event.data.object);
    }

    return {
      id: `${event.id}-${Date.now()}`,
      timestamp: new Date(),
      provider: "stripe",
      externalEventId: event.id,
      type: mapping.type,
      resourceType: mapping.resourceType,
      resourceId: event.data?.object?.id || "",
      data,
      rawEvent: event,
      verified: true,
      idempotencyKey: event.id,
    };
  }

  /**
   * Generate idempotency key
   */
  private generateIdempotencyKey(): string {
    return `sk_test_${createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 32)}`;
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}

export type { StripeConfig };
