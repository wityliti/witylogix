/**
 * Payment Processor
 *
 * Orchestrates the complete payment lifecycle:
 *   - Idempotency checking (prevent duplicate charges)
 *   - Payment intent creation and authorization
 *   - Capture/settlement with retry logic
 *   - Webhook verification and processing
 *   - Transaction logging and audit trail
 *   - COD collection and reconciliation
 */

import type {
  PaymentIntent,
  Transaction,
  RefundRequest,
  CODCollection,
  IdempotencyKey,
  PaymentWebhookPayload,
  PaymentGatewayConfig,
  CreatePaymentIntentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  RecordCODCollectionRequest,
  VerifyCODCollectionRequest,
  ReconcileCODRequest,
} from "./types.js";
import { PaymentError, IdempotencyError } from "./types.js";
import { PaymentGateway, createGateway } from "./gateway.js";

// ─── PAYMENT PROCESSOR CLASS ────────────────────────────────────────────

export class PaymentProcessor {
  private idempotencyCache: Map<string, IdempotencyKey> = new Map();
  private gateways: Map<string, PaymentGateway> = new Map();
  private retryPolicy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  };

  constructor(
    private db: any, // Tenant database connection
    private logger: {
      log: (level: string, msg: string, data?: any) => void;
    } = console,
  ) {}

  /**
   * Register a payment gateway
   */
  registerGateway(gateway: PaymentGateway): void {
    const code = (gateway as any).code || gateway.name.toLowerCase();
    this.gateways.set(code, gateway);
  }

  /**
   * Get gateway by name
   */
  private getGateway(providerName: string): PaymentGateway {
    const gateway = this.gateways.get(providerName.toLowerCase());
    if (!gateway) {
      throw new PaymentError(
        "GATEWAY_NOT_FOUND",
        `Payment gateway not found: ${providerName}`,
        404,
      );
    }
    return gateway;
  }

  /**
   * Check idempotency key and return cached result if exists
   * Prevents duplicate charges if client retries
   */
  async checkIdempotency(
    key: string,
    shopId: string,
  ): Promise<IdempotencyKey | null> {
    // Check in-memory cache first
    const cached = this.idempotencyCache.get(key);
    if (cached && cached.shopId === shopId) {
      return cached;
    }

    // Check database (for distributed systems)
    try {
      const dbEntry = await this.db.idempotencyKey.findUnique({
        where: { key },
      });

      if (
        dbEntry &&
        dbEntry.shopId === shopId &&
        !this.isExpired(dbEntry.expiresAt)
      ) {
        // Cache it
        this.idempotencyCache.set(key, dbEntry);
        return dbEntry;
      }
    } catch (error) {
      // Idempotency table may not exist; skip DB check
      this.logger.log("warn", "Idempotency key check failed", { error });
    }

    return null;
  }

  /**
   * Record idempotency key for future retries
   */
  async recordIdempotency(
    key: string,
    shopId: string,
    resultId: string,
    result?: any,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const idempotencyKey: IdempotencyKey = {
      key,
      shopId,
      resultId,
      status: "completed",
      result,
      expiresAt,
      createdAt: new Date(),
    };

    this.idempotencyCache.set(key, idempotencyKey);

    // Attempt to save to DB
    try {
      await this.db.idempotencyKey.create({
        data: {
          key,
          shopId,
          resultId,
          status: "completed",
          result: JSON.stringify(result || {}),
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.log("warn", "Failed to persist idempotency key", { error });
      // Non-fatal; in-memory cache is sufficient
    }
  }

  /**
   * Create a payment intent (authorize funds)
   */
  async createPaymentIntent(
    req: CreatePaymentIntentRequest,
  ): Promise<PaymentIntent> {
    // Check idempotency
    const existing = await this.checkIdempotency(
      req.idempotencyKey,
      req.shopId,
    );
    if (existing?.resultId) {
      // Return cached result if it exists
      const cached = await this.getPaymentIntent(existing.resultId, req.shopId);
      if (cached) {
        throw new IdempotencyError(
          "Idempotent request already processed",
          cached,
        );
      }
    }

    this.logger.log("info", "Creating payment intent", {
      shopId: req.shopId,
      amount: req.amount,
      methodType: req.methodType,
    });

    const gateway = this.getGateway(req.methodType);

    try {
      const intent = await gateway.createPaymentIntent(
        req.shopId,
        req.amount,
        req.currency,
        undefined,
        req.metadata,
      );

      // Persist intent
      const persisted = await this.persistPaymentIntent(intent);

      // Record idempotency
      await this.recordIdempotency(
        req.idempotencyKey,
        req.shopId,
        intent.id,
        persisted,
      );

      this.logger.log("info", "Payment intent created", {
        intentId: intent.id,
      });
      return persisted;
    } catch (error) {
      this.logger.log("error", "Failed to create payment intent", { error });
      throw error;
    }
  }

  /**
   * Capture a payment (settle funds from authorized intent)
   * Includes retry logic for network failures
   */
  async capturePayment(req: CapturePaymentRequest): Promise<Transaction> {
    // Check idempotency if key provided
    if (req.idempotencyKey) {
      const existing = await this.checkIdempotency(
        req.idempotencyKey,
        req.shopId,
      );
      if (existing?.resultId) {
        const cached = await this.getTransaction(existing.resultId, req.shopId);
        if (cached) {
          throw new IdempotencyError("Capture already processed", cached);
        }
      }
    }

    this.logger.log("info", "Capturing payment", {
      shopId: req.shopId,
      paymentIntentId: req.paymentIntentId,
    });

    // Get the payment intent
    const intent = await this.getPaymentIntent(req.paymentIntentId, req.shopId);
    if (!intent) {
      throw new PaymentError(
        "INTENT_NOT_FOUND",
        "Payment intent not found",
        404,
      );
    }

    if (intent.status !== "authorized") {
      throw new PaymentError(
        "INVALID_STATE",
        `Cannot capture payment in ${intent.status} state`,
        400,
      );
    }

    const gateway = this.getGateway(intent.providerName || "cod");

    // Retry capture with exponential backoff
    let lastError: any;
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt++) {
      try {
        const transaction = await gateway.capturePayment(intent.id);

        // Persist and record idempotency
        const persisted = await this.persistTransaction(transaction);
        if (req.idempotencyKey) {
          await this.recordIdempotency(
            req.idempotencyKey,
            req.shopId,
            transaction.id,
            persisted,
          );
        }

        this.logger.log("info", "Payment captured", {
          transactionId: transaction.id,
        });
        return persisted;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryPolicy.maxAttempts) {
          const delayMs =
            this.retryPolicy.initialDelayMs *
            Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1);
          this.logger.log(
            "warn",
            `Capture attempt ${attempt} failed, retrying in ${delayMs}ms`,
            {
              error,
            },
          );
          await this.delay(delayMs);
        }
      }
    }

    throw (
      lastError ||
      new PaymentError("CAPTURE_FAILED", "Failed to capture payment", 500, true)
    );
  }

  /**
   * Refund a captured payment (full or partial)
   */
  async refundPayment(req: RefundPaymentRequest): Promise<RefundRequest> {
    // Check idempotency
    const existing = await this.checkIdempotency(
      req.idempotencyKey,
      req.shopId,
    );
    if (existing?.resultId) {
      const cached = await this.getRefund(existing.resultId, req.shopId);
      if (cached) {
        throw new IdempotencyError("Refund already processed", cached);
      }
    }

    this.logger.log("info", "Processing refund", {
      shopId: req.shopId,
      transactionId: req.transactionId,
      amount: req.amount,
    });

    // Get original transaction
    const transaction = await this.getTransaction(
      req.transactionId,
      req.shopId,
    );
    if (!transaction) {
      throw new PaymentError(
        "TRANSACTION_NOT_FOUND",
        "Original transaction not found",
        404,
      );
    }

    if (transaction.status !== "completed") {
      throw new PaymentError(
        "INVALID_STATE",
        `Cannot refund ${transaction.status} transaction`,
        400,
      );
    }

    // Create refund request
    const refund: RefundRequest = {
      id: this.generateId("refund"),
      shopId: req.shopId,
      transactionId: req.transactionId,
      amount: req.amount,
      reason: req.reason,
      description: req.description,
      status: "processing",
      metadata: req.metadata || {},
      requestedAt: new Date(),
    };

    const gateway = this.getGateway(transaction.providerName || "cod");

    try {
      const refundResult = await gateway.refundPayment(
        transaction.id,
        req.amount,
        req.reason,
      );

      const persisted = await this.persistRefund({
        ...refund,
        ...refundResult,
      });

      // Record idempotency
      await this.recordIdempotency(
        req.idempotencyKey,
        req.shopId,
        refund.id,
        persisted,
      );

      this.logger.log("info", "Refund created", { refundId: refund.id });
      return persisted;
    } catch (error) {
      this.logger.log("error", "Refund processing failed", { error });
      throw error;
    }
  }

  /**
   * Verify and process webhook from payment provider
   */
  async processWebhook(
    provider: string,
    payload: any,
    signature?: string,
  ): Promise<{ success: boolean; transactionId?: string }> {
    this.logger.log("info", "Processing payment webhook", { provider });

    const gateway = this.getGateway(provider);

    // Verify signature
    if (signature) {
      const isValid = await gateway.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new PaymentError(
          "INVALID_SIGNATURE",
          "Webhook signature verification failed",
          401,
        );
      }
    }

    // Parse webhook
    const webhookPayload = await gateway.parseWebhookPayload(payload);

    // Update transaction based on webhook event
    const transaction = await this.getTransaction(
      webhookPayload.data.transactionId,
      "",
    );
    if (!transaction) {
      this.logger.log("warn", "Transaction not found for webhook", {
        transactionId: webhookPayload.data.transactionId,
      });
      return { success: false };
    }

    // Update transaction status
    const updated = await this.updateTransactionStatus(
      webhookPayload.data.transactionId,
      webhookPayload.data.status,
      webhookPayload.data.metadata,
    );

    this.logger.log("info", "Webhook processed", {
      transactionId: updated.id,
      status: updated.status,
    });

    return { success: true, transactionId: updated.id };
  }

  /**
   * Record COD collection from driver
   */
  async recordCODCollection(
    req: RecordCODCollectionRequest,
  ): Promise<CODCollection> {
    // Check idempotency
    const existing = await this.checkIdempotency(
      req.idempotencyKey,
      req.shopId,
    );
    if (existing?.resultId) {
      const cached = await this.getCODCollection(existing.resultId, req.shopId);
      if (cached) {
        throw new IdempotencyError("COD collection already recorded", cached);
      }
    }

    this.logger.log("info", "Recording COD collection", {
      shopId: req.shopId,
      shipmentId: req.shipmentId,
      amount: req.amount,
    });

    const gateway = this.getGateway("cod");
    const collection = await gateway.recordCODCollection(
      req.shopId,
      req.shipmentId,
      req.driverId,
      req.amount,
      req.currency,
    );

    const persisted = await this.persistCODCollection(collection);

    // Record idempotency
    await this.recordIdempotency(
      req.idempotencyKey,
      req.shopId,
      collection.id,
      persisted,
    );

    this.logger.log("info", "COD collection recorded", {
      collectionId: collection.id,
    });
    return persisted;
  }

  /**
   * Verify a COD collection (reconcile driver report)
   */
  async verifyCODCollection(
    req: VerifyCODCollectionRequest,
  ): Promise<CODCollection> {
    this.logger.log("info", "Verifying COD collection", {
      shopId: req.shopId,
      codCollectionId: req.codCollectionId,
    });

    const gateway = this.getGateway("cod");
    const verified = await gateway.verifyCODCollection(
      req.shopId,
      req.codCollectionId,
    );

    const persisted = await this.persistCODCollection(verified);

    this.logger.log("info", "COD collection verified", {
      collectionId: req.codCollectionId,
    });
    return persisted;
  }

  /**
   * Reconcile COD collections (batch deposit to bank)
   */
  async reconcileCODCollections(req: ReconcileCODRequest): Promise<any> {
    this.logger.log("info", "Reconciling COD collections", {
      shopId: req.shopId,
      driverId: req.driverId,
      count: req.codCollectionIds.length,
      totalAmount: req.totalAmount,
    });

    const gateway = this.getGateway("cod");
    const result = await gateway.reconcileCODCollections(
      req.shopId,
      req.driverId,
      req.depositDate,
      req.totalAmount,
      req.codCollectionIds,
    );

    this.logger.log("info", "COD collections reconciled", {
      reconcilationId: result.reconcilationId,
      count: result.collectionCount,
    });

    return result;
  }

  /**
   * INTERNAL: Persist payment intent to database
   */
  private async persistPaymentIntent(
    intent: PaymentIntent,
  ): Promise<PaymentIntent> {
    // Implementation depends on database schema
    // Placeholder for actual persistence logic
    return intent;
  }

  /**
   * INTERNAL: Get payment intent from database
   */
  private async getPaymentIntent(
    id: string,
    shopId: string,
  ): Promise<PaymentIntent | null> {
    // Placeholder
    return null;
  }

  /**
   * INTERNAL: Persist transaction to database
   */
  private async persistTransaction(
    transaction: Transaction,
  ): Promise<Transaction> {
    // Placeholder
    return transaction;
  }

  /**
   * INTERNAL: Get transaction from database
   */
  private async getTransaction(
    id: string,
    shopId: string,
  ): Promise<Transaction | null> {
    // Placeholder
    return null;
  }

  /**
   * INTERNAL: Update transaction status
   */
  private async updateTransactionStatus(
    id: string,
    status: any,
    metadata?: any,
  ): Promise<Transaction> {
    // Placeholder
    return {
      id,
      shopId: "",
      amount: 0,
      currency: "USD",
      status: "pending",
      type: "charge",
      methodType: "cod",
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * INTERNAL: Get refund from database
   */
  private async getRefund(
    id: string,
    shopId: string,
  ): Promise<RefundRequest | null> {
    // Placeholder
    return null;
  }

  /**
   * INTERNAL: Persist refund to database
   */
  private async persistRefund(refund: RefundRequest): Promise<RefundRequest> {
    // Placeholder
    return refund;
  }

  /**
   * INTERNAL: Get COD collection from database
   */
  private async getCODCollection(
    id: string,
    shopId: string,
  ): Promise<CODCollection | null> {
    // Placeholder
    return null;
  }

  /**
   * INTERNAL: Persist COD collection to database
   */
  private async persistCODCollection(
    collection: CODCollection,
  ): Promise<CODCollection> {
    // Placeholder
    return collection;
  }

  /**
   * INTERNAL: Check if date is expired
   */
  private isExpired(date: Date): boolean {
    return new Date() > date;
  }

  /**
   * INTERNAL: Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * INTERNAL: Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ─── PROCESSOR FACTORY ──────────────────────────────────────────────────

export function createPaymentProcessor(
  db: any,
  logger?: any,
): PaymentProcessor {
  const processor = new PaymentProcessor(db, logger);

  // Register default gateways
  // In production, load config from database or environment
  const codConfig: PaymentGatewayConfig = {
    name: "cod",
    isEnabled: true,
    isProduction: process.env.NODE_ENV === "production",
    supportedMethods: ["cod"],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  processor.registerGateway(createGateway(codConfig));

  return processor;
}
