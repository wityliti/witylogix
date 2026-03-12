/**
 * Abstract Payment Adapter Base Class
 * Provides idempotency, rate limiting, circuit breaker, and PCI compliance helpers
 */

import { type PaymentTransaction, type PaymentWebhookEvent, type PaymentAdapterInterface, type PaymentOptions, type PaymentMethod, type PaymentMethodDetails, type CustomerData, type PaymentRefund, type PaymentDispute, type RefundReason, type DisputeFilters } from './types';
import { createHash, createHmac } from 'crypto';

/**
 * Idempotency key cache entry
 */
interface IdempotencyEntry {
  result: any;
  expiresAt: number;
}

/**
 * Rate limiter state
 */
interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

/**
 * Abstract base class for payment adapters
 */
export abstract class PaymentAdapter implements PaymentAdapterInterface {
  protected providerId: string;
  protected maxRetries: number = 3;
  protected retryDelayMs: number = 1000;
  protected retryBackoffMultiplier: number = 2;

  // Idempotency cache (in-memory; consider Redis for distributed systems)
  private idempotencyCache = new Map<string, IdempotencyEntry>();
  private idempotencyCacheTtl = 24 * 60 * 60 * 1000; // 24 hours

  // Rate limiter
  private rateLimiterState: RateLimiterState = {
    tokens: 100,
    lastRefill: Date.now(),
  };
  private rateLimitPerSecond: number = 100;
  private rateLimitBurst: number = 200;

  // Circuit breaker
  private circuitBreaker: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0,
  };
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerTimeout: number = 60 * 1000; // 1 minute

  constructor(providerId: string) {
    this.providerId = providerId;
  }

  /**
   * Generate idempotency key for request
   */
  protected generateIdempotencyKey(data: Record<string, any>): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Get or execute with idempotency guarantee
   */
  protected async executeWithIdempotency<T>(
    key: string,
    executor: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = this.idempotencyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Execute with retries
    const result = await this.executeWithRetries(executor);

    // Cache result
    this.idempotencyCache.set(key, {
      result,
      expiresAt: Date.now() + this.idempotencyCacheTtl,
    });

    // Cleanup old entries
    this.cleanupIdempotencyCache();

    return result;
  }

  /**
   * Cleanup old idempotency cache entries
   */
  private cleanupIdempotencyCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.idempotencyCache.entries()) {
      if (entry.expiresAt <= now) {
        this.idempotencyCache.delete(key);
      }
    }
  }

  /**
   * Execute with exponential backoff retries
   */
  protected async executeWithRetries<T>(executor: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.circuitBreaker.state === 'open') {
          const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
          if (timeSinceLastFailure >= this.circuitBreakerTimeout) {
            this.circuitBreaker.state = 'half-open';
          } else {
            throw new Error(
              `Circuit breaker is open. Retry after ${this.circuitBreakerTimeout - timeSinceLastFailure}ms`
            );
          }
        }

        // Check rate limiter
        await this.checkRateLimiter();

        // Execute
        const result = await executor();

        // Reset circuit breaker on success
        if (this.circuitBreaker.state === 'half-open') {
          this.circuitBreaker.successCount++;
          if (this.circuitBreaker.successCount >= 2) {
            this.circuitBreaker.state = 'closed';
            this.circuitBreaker.failureCount = 0;
            this.circuitBreaker.successCount = 0;
          }
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Update circuit breaker on failure
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failureCount >= this.circuitBreakerThreshold) {
          this.circuitBreaker.state = 'open';
        }

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4xx')) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delayMs = this.retryDelayMs * Math.pow(this.retryBackoffMultiplier, attempt);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimiter(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.rateLimiterState.lastRefill) / 1000;

    // Refill tokens based on elapsed time
    const tokensToAdd = timeSinceLastRefill * this.rateLimitPerSecond;
    this.rateLimiterState.tokens = Math.min(
      this.rateLimitBurst,
      this.rateLimiterState.tokens + tokensToAdd
    );
    this.rateLimiterState.lastRefill = now;

    // Check if we have tokens
    if (this.rateLimiterState.tokens < 1) {
      const waitTime = (1 - this.rateLimiterState.tokens) / this.rateLimitPerSecond * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimiterState.tokens--;
    } else {
      this.rateLimiterState.tokens--;
    }
  }

  /**
   * Format amount from cents to dollars (or provider-specific format)
   */
  protected formatAmount(amountInCents: number, decimals: number = 2): number {
    return parseFloat((amountInCents / Math.pow(10, decimals)).toFixed(decimals));
  }

  /**
   * Format amount from dollars to cents
   */
  protected formatAmountToCents(amountInDollars: number, decimals: number = 2): number {
    return Math.round(amountInDollars * Math.pow(10, decimals));
  }

  /**
   * Validate currency code
   */
  protected isValidCurrency(currency: string): boolean {
    // ISO 4217 currency codes
    const validCurrencies = new Set([
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'CAD',
      'AUD',
      'CHF',
      'CNY',
      'SEK',
      'NZD',
    ]);
    return validCurrencies.has(currency.toUpperCase());
  }

  /**
   * Hash payment method for tokenization (PCI compliance)
   */
  protected hashPaymentMethod(cardNumber: string, secret: string): string {
    return createHmac('sha256', secret).update(cardNumber).digest('hex');
  }

  /**
   * Mask credit card number for display
   */
  protected maskCardNumber(cardNumber: string): string {
    if (cardNumber.length < 4) return 'XXXX';
    const lastFour = cardNumber.slice(-4);
    return `XXXX-XXXX-XXXX-${lastFour}`;
  }

  /**
   * Validate card expiry date
   */
  protected isValidExpiryDate(expiryMonth: number, expiryYear: number): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (expiryYear < currentYear) return false;
    if (expiryYear === currentYear && expiryMonth < currentMonth) return false;

    return expiryMonth >= 1 && expiryMonth <= 12;
  }

  /**
   * Validate CVV
   */
  protected isValidCvv(cvv: string): boolean {
    return /^\d{3,4}$/.test(cvv);
  }

  /**
   * Validate card number (Luhn algorithm)
   */
  protected isValidCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Generate fingerprint for deduplication (prevents duplicate processing)
   */
  protected generateFingerprint(
    amount: number,
    currency: string,
    cardLastFour: string,
    timestamp: number
  ): string {
    const data = `${amount}-${currency}-${cardLastFour}-${timestamp}`;
    return createHash('sha256').update(data).digest('hex').slice(0, 16);
  }

  /**
   * Sign request for HMAC verification
   */
  protected signRequest(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook HMAC signature
   */
  protected verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
    return signature === expectedSignature;
  }

  /**
   * Log transaction for audit trail (PCI compliance)
   */
  protected async logTransaction(
    transactionId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    // Log without sensitive data
    const safeDetails = { ...details };
    if (safeDetails.cardNumber) {
      safeDetails.cardNumber = this.maskCardNumber(safeDetails.cardNumber);
    }
    if (safeDetails.cvv) {
      delete safeDetails.cvv; // Never log CVV
    }

    console.log(`[${this.providerId}] ${action} - Transaction: ${transactionId}`, safeDetails);
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract charge(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction>;

  abstract authorize(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction>;

  abstract capture(transactionId: string, amount?: number): Promise<PaymentTransaction>;

  abstract void(transactionId: string): Promise<PaymentTransaction>;

  abstract refund(
    transactionId: string,
    amount?: number,
    reason?: RefundReason
  ): Promise<PaymentRefund>;

  abstract createPaymentMethod(
    details: PaymentMethodDetails,
    customerId?: string
  ): Promise<PaymentMethod>;

  abstract deletePaymentMethod(paymentMethodId: string): Promise<void>;

  abstract getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod>;

  abstract listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  abstract getTransaction(transactionId: string): Promise<PaymentTransaction>;

  abstract createCustomer(customerData: CustomerData): Promise<{ id: string; externalId: string }>;

  abstract updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<void>;

  abstract verifyWebhookSignature(payload: string, signature: string): boolean;

  abstract parseWebhookPayload(payload: Record<string, any>): PaymentWebhookEvent | null;

  abstract submitDisputeEvidence(
    disputeId: string,
    evidence: any[]
  ): Promise<void>;

  abstract getDispute(disputeId: string): Promise<PaymentDispute>;

  abstract listDisputes(filters?: DisputeFilters): Promise<PaymentDispute[]>;
}
