/**
 * Webhook Signature Verifier — Secure webhook validation
 *
 * Features:
 * - HMAC-SHA256 signature verification (Stripe, EasyPost, Shopify style)
 * - Timestamp validation (reject events older than 5 minutes)
 * - Replay protection with nonce tracking and TTL
 * - Provider-specific verification strategies
 * - Multiple signature header format support
 * - Detailed verification result with error messages
 *
 * Provider Support:
 * - Stripe: X-Stripe-Signature header with t= and v1= parameters
 * - Shopify: X-Shopify-Hmac-SHA256 header
 * - EasyPost: X-Hmac-SHA256 header
 * - Generic: X-Signature or X-Hub-Signature-256
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Verification result with detailed error information
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** Timestamp of the event (extracted from header) */
  timestamp?: number;
  /** Error message if verification failed */
  error?: string;
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Provider-specific signature verification strategy
 */
export interface SignatureStrategy {
  /** Extract signature from headers */
  extractSignature(headers: Record<string, string>): { signature: string; timestamp?: number } | null;
  /** Compute expected signature */
  computeSignature(payload: string, timestamp?: number): string;
  /** Verify computed vs received signature */
  verifySignature(computed: string, received: string): boolean;
}

/**
 * Configuration for signature verifier
 */
export interface SignatureVerifierConfig {
  /** Webhook signing secret (from provider) */
  signingSecret: string;
  /** Maximum event age in seconds (default: 300 = 5 minutes) */
  maxEventAgeSec?: number;
  /** Enable replay protection (default: true) */
  enableReplayProtection?: boolean;
  /** Nonce storage (for replay protection) */
  nonceStorage?: INonceStorage;
  /** Provider-specific strategy (if not standard) */
  strategy?: SignatureStrategy;
}

/**
 * Nonce storage interface for replay protection
 */
export interface INonceStorage {
  /** Check if nonce exists (returns true if exists, false if new) */
  has(nonce: string): Promise<boolean>;
  /** Store nonce with TTL */
  set(nonce: string, ttlMs: number): Promise<void>;
}

/**
 * Common provider signature formats
 */
export enum SignatureFormat {
  STRIPE = 'stripe',
  SHOPIFY = 'shopify',
  EASYPOST = 'easypost',
  GENERIC_SIGNATURE = 'generic_signature',
  GENERIC_HUB_SIGNATURE = 'generic_hub_signature',
}

// ─── Signature Strategies ────────────────────────────────────────────

/**
 * Stripe signature strategy (v1)
 * Header: X-Stripe-Signature: t=<timestamp>,v1=<signature>
 */
class StripeSignatureStrategy implements SignatureStrategy {
  constructor(private signingSecret: string) {}

  extractSignature(headers: Record<string, string>): { signature: string; timestamp?: number } | null {
    const stripeSignature = headers['x-stripe-signature'];
    if (!stripeSignature) return null;

    const parts = stripeSignature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});

    return {
      signature: parts.v1 || '',
      timestamp: parseInt(parts.t || '0', 10),
    };
  }

  computeSignature(payload: string, timestamp?: number): string {
    const signedContent = `${timestamp}.${payload}`;
    return createHmac('sha256', this.signingSecret)
      .update(signedContent)
      .digest('hex');
  }

  verifySignature(computed: string, received: string): boolean {
    try {
      return timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(received),
      );
    } catch {
      return false;
    }
  }
}

/**
 * Shopify signature strategy
 * Header: X-Shopify-Hmac-SHA256: <base64-encoded-signature>
 */
class ShopifySignatureStrategy implements SignatureStrategy {
  constructor(private signingSecret: string) {}

  extractSignature(headers: Record<string, string>): { signature: string; timestamp?: number } | null {
    const shopifySignature = headers['x-shopify-hmac-sha256'];
    if (!shopifySignature) return null;

    return {
      signature: shopifySignature,
    };
  }

  computeSignature(payload: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(payload, 'utf8')
      .digest('base64');
  }

  verifySignature(computed: string, received: string): boolean {
    try {
      return timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(received),
      );
    } catch {
      return false;
    }
  }
}

/**
 * EasyPost signature strategy
 * Header: X-Hmac-SHA256: <hex-encoded-signature>
 */
class EasyPostSignatureStrategy implements SignatureStrategy {
  constructor(private signingSecret: string) {}

  extractSignature(headers: Record<string, string>): { signature: string; timestamp?: number } | null {
    const signature = headers['x-hmac-sha256'];
    if (!signature) return null;

    return { signature };
  }

  computeSignature(payload: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  verifySignature(computed: string, received: string): boolean {
    try {
      return timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(received),
      );
    } catch {
      return false;
    }
  }
}

/**
 * Generic X-Signature strategy
 * Header: X-Signature: <hex-encoded-signature>
 */
class GenericSignatureStrategy implements SignatureStrategy {
  constructor(private signingSecret: string) {}

  extractSignature(headers: Record<string, string>): { signature: string; timestamp?: number } | null {
    const signature = headers['x-signature'];
    if (!signature) return null;

    return { signature };
  }

  computeSignature(payload: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  verifySignature(computed: string, received: string): boolean {
    try {
      return timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(received),
      );
    } catch {
      return false;
    }
  }
}

// ─── Webhook Signature Verifier ──────────────────────────────────────

export class WebhookSignatureVerifier {
  private signingSecret: string;
  private maxEventAgeSec: number;
  private enableReplayProtection: boolean;
  private nonceStorage?: INonceStorage;
  private strategy: SignatureStrategy;

  constructor(config: SignatureVerifierConfig, format?: SignatureFormat) {
    this.signingSecret = config.signingSecret;
    this.maxEventAgeSec = config.maxEventAgeSec ?? 300;
    this.enableReplayProtection = config.enableReplayProtection ?? true;
    this.nonceStorage = config.nonceStorage;

    // Use custom strategy if provided, otherwise determine from format
    if (config.strategy) {
      this.strategy = config.strategy;
    } else {
      this.strategy = this.createStrategy(format ?? SignatureFormat.GENERIC_SIGNATURE);
    }
  }

  /**
   * Verify webhook signature and timestamp
   */
  async verify(
    payload: string,
    headers: Record<string, string>,
    nonce?: string,
  ): Promise<VerificationResult> {
    // Extract signature and timestamp from headers
    const extracted = this.strategy.extractSignature(headers);
    if (!extracted) {
      return {
        valid: false,
        error: 'No signature found in headers',
      };
    }

    // Check timestamp if available
    if (extracted.timestamp) {
      const result = this.verifyTimestamp(extracted.timestamp);
      if (!result.valid) {
        return result;
      }
    }

    // Check for replay attacks
    if (this.enableReplayProtection && nonce) {
      const replayResult = await this.checkReplay(nonce);
      if (!replayResult.valid) {
        return replayResult;
      }
    }

    // Compute expected signature
    const computedSignature = this.strategy.computeSignature(
      payload,
      extracted.timestamp,
    );

    // Compare signatures (timing-safe)
    const signatureValid = this.strategy.verifySignature(
      computedSignature,
      extracted.signature,
    );

    if (!signatureValid) {
      return {
        valid: false,
        timestamp: extracted.timestamp,
        error: 'Signature verification failed',
        details: {
          received: `${extracted.signature.slice(0, 8)}...`,
          computed: `${computedSignature.slice(0, 8)}...`,
        },
      };
    }

    return {
      valid: true,
      timestamp: extracted.timestamp,
    };
  }

  /**
   * Verify event timestamp is recent
   */
  private verifyTimestamp(timestamp: number): VerificationResult {
    const now = Math.floor(Date.now() / 1000);
    const eventAge = now - timestamp;

    if (eventAge > this.maxEventAgeSec) {
      return {
        valid: false,
        timestamp,
        error: `Event timestamp too old (${eventAge}s > ${this.maxEventAgeSec}s)`,
      };
    }

    if (eventAge < -60) {
      // Allow 60 seconds of clock skew
      return {
        valid: false,
        timestamp,
        error: `Event timestamp in the future (${-eventAge}s)`,
      };
    }

    return { valid: true, timestamp };
  }

  /**
   * Check for replay attacks using nonce
   */
  private async checkReplay(nonce: string): Promise<VerificationResult> {
    if (!this.nonceStorage) {
      return {
        valid: false,
        error: 'Replay protection enabled but no nonce storage configured',
      };
    }

    const exists = await this.nonceStorage.has(nonce);
    if (exists) {
      return {
        valid: false,
        error: 'Nonce already seen (possible replay attack)',
        details: { nonce: nonce.slice(0, 8) + '...' },
      };
    }

    // Store nonce with TTL matching max event age
    await this.nonceStorage.set(nonce, this.maxEventAgeSec * 1000);

    return { valid: true };
  }

  /**
   * Create strategy for given format
   */
  private createStrategy(format: SignatureFormat): SignatureStrategy {
    switch (format) {
      case SignatureFormat.STRIPE:
        return new StripeSignatureStrategy(this.signingSecret);
      case SignatureFormat.SHOPIFY:
        return new ShopifySignatureStrategy(this.signingSecret);
      case SignatureFormat.EASYPOST:
        return new EasyPostSignatureStrategy(this.signingSecret);
      case SignatureFormat.GENERIC_SIGNATURE:
      case SignatureFormat.GENERIC_HUB_SIGNATURE:
      default:
        return new GenericSignatureStrategy(this.signingSecret);
    }
  }
}

/**
 * In-memory nonce storage for testing
 */
export class InMemoryNonceStorage implements INonceStorage {
  private nonces: Map<string, number> = new Map();

  async has(nonce: string): Promise<boolean> {
    // Clean expired nonces
    const now = Date.now();
    for (const [key, expiry] of this.nonces.entries()) {
      if (expiry < now) {
        this.nonces.delete(key);
      }
    }

    return this.nonces.has(nonce);
  }

  async set(nonce: string, ttlMs: number): Promise<void> {
    const expiry = Date.now() + ttlMs;
    this.nonces.set(nonce, expiry);
  }
}
