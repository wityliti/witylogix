/**
 * Abstract E-Signature Adapter Base Class.
 *
 * Provides common functionality for all e-signature providers:
 * - OAuth2 token management
 * - Rate limiting with token bucket algorithm
 * - Circuit breaker pattern
 * - Document preparation pipeline
 * - Signer validation
 * - Template variable resolution
 * - Field positioning calculations
 */

import type {
  Envelope,
  ESignatureConfig,
  ESignatureAdapterInterface,
  ESignatureWebhookEvent,
  EnvelopeResult,
  EnvelopeStatusResult,
  DocumentDownloadResult,
  EmbedSigningResult,
  SigningEvent,
  Template,
  Document,
  Signer,
  SigningField,
} from "./types.js";

/**
 * Rate limiter using token bucket algorithm.
 */
class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefillAt: number = Date.now();

  constructor(capacity: number, refillRatePerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRatePerSecond;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillAt) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillAt = now;
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  getAvailable(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  getResetTime(): Date {
    const tokensNeeded = this.capacity - this.tokens;
    const secondsNeeded = tokensNeeded / this.refillRate;
    return new Date(Date.now() + secondsNeeded * 1000);
  }
}

/**
 * Circuit breaker for handling provider failures gracefully.
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureAt: number = 0;
  private state: "closed" | "open" | "half_open" = "closed";
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const timeSinceLastFailure = Date.now() - this.lastFailureAt;
      if (timeSinceLastFailure > this.resetTimeout) {
        this.state = "half_open";
      } else {
        throw new Error(
          `Circuit breaker is open. Reset in ${this.resetTimeout - timeSinceLastFailure}ms`
        );
      }
    }

    try {
      const result = await fn();
      if (this.state === "half_open") {
        this.state = "closed";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureAt = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = "open";
      }

      throw error;
    }
  }

  getState(): "closed" | "open" | "half_open" {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.lastFailureAt = 0;
  }
}

/**
 * Abstract base class for e-signature adapters.
 */
export abstract class ESignatureAdapter implements ESignatureAdapterInterface {
  protected config: ESignatureConfig | null = null;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected accessToken: string | null = null;
  protected tokenExpiresAt: number | null = null;
  protected readonly providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
    this.rateLimiter = new RateLimiter(100, 10);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  /**
   * Initialize adapter with configuration.
   */
  async initialize(config: ESignatureConfig): Promise<void> {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit || 100, (config.rateLimit || 100) / 10);
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreakerThreshold || 5,
      60000
    );

    if (config.authType === "oauth2" && !config.refreshToken && !config.accessToken) {
      throw new Error(`${this.providerName}: OAuth2 requires clientId, clientSecret, and refreshToken`);
    }

    await this.verifyCredentials();
  }

  /**
   * Get or refresh OAuth2 access token.
   */
  protected async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    if (this.config?.authType === "oauth2" && this.config.refreshToken) {
      await this.refreshToken();
    }

    if (!this.accessToken) {
      throw new Error(`${this.providerName}: No access token available`);
    }

    return this.accessToken;
  }

  /**
   * Refresh OAuth2 token (must be implemented by subclass).
   */
  async refreshToken(): Promise<void> {
    throw new Error(`${this.providerName}: refreshToken must be implemented by subclass`);
  }

  /**
   * Set access token and expiration.
   */
  protected setAccessToken(token: string, expiresInSeconds: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
  }

  /**
   * Make rate-limited API request.
   */
  protected async rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
    await this.rateLimiter.acquire();
    return this.circuitBreaker.execute(fn);
  }

  /**
   * Validate signer data.
   */
  protected validateSigner(signer: Signer): void {
    if (!signer.email || !signer.name) {
      throw new Error("Signer must have email and name");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signer.email)) {
      throw new Error(`Invalid email address: ${signer.email}`);
    }

    if (signer.order < 1) {
      throw new Error("Signer order must be >= 1");
    }
  }

  /**
   * Validate document data.
   */
  protected validateDocument(doc: Document): void {
    if (!doc.name || !doc.fileName || !doc.content) {
      throw new Error("Document must have name, fileName, and content");
    }

    if (doc.order < 1) {
      throw new Error("Document order must be >= 1");
    }

    // Validate Base64 content
    try {
      Buffer.from(doc.content, "base64");
    } catch {
      throw new Error("Document content must be valid Base64");
    }
  }

  /**
   * Validate signing field positioning.
   */
  protected validateSigningField(field: SigningField): void {
    if (!field.signerEmail || field.pageNumber < 1) {
      throw new Error("Field must have signerEmail and valid pageNumber");
    }

    if (
      field.xCoordinate < 0 ||
      field.xCoordinate > 100 ||
      field.yCoordinate < 0 ||
      field.yCoordinate > 100 ||
      field.width <= 0 ||
      field.width > 100 ||
      field.height <= 0 ||
      field.height > 100
    ) {
      throw new Error("Field coordinates and dimensions must be valid percentages");
    }
  }

  /**
   * Prepare envelope for submission.
   */
  protected prepareEnvelope(envelope: Envelope): {
    documents: Document[];
    signers: Signer[];
    fields: SigningField[];
  } {
    // Sort documents and signers by order
    const sortedDocuments = [...envelope.documents].sort((a, b) => a.order - b.order);
    const sortedSigners = [...envelope.signers].sort((a, b) => a.order - b.order);

    // Validate all components
    sortedDocuments.forEach((doc) => this.validateDocument(doc));
    sortedSigners.forEach((signer) => this.validateSigner(signer));
    envelope.fields.forEach((field) => this.validateSigningField(field));

    // Ensure field signers exist in signer list
    const signerEmails = new Set(sortedSigners.map((s) => s.email));
    for (const field of envelope.fields) {
      if (!signerEmails.has(field.signerEmail)) {
        throw new Error(`Field references unknown signer: ${field.signerEmail}`);
      }
    }

    return {
      documents: sortedDocuments,
      signers: sortedSigners,
      fields: envelope.fields,
    };
  }

  /**
   * Resolve template variables in envelope fields.
   */
  protected resolveTemplateVariables(
    envelope: Envelope,
    variables: Record<string, string>
  ): Envelope {
    const updated = JSON.parse(JSON.stringify(envelope));

    // Replace in message and subject
    if (updated.message) {
      Object.entries(variables).forEach(([key, value]) => {
        updated.message = updated.message.replace(new RegExp(`{{${key}}}`, "g"), value);
      });
    }

    // Replace in field values and labels
    updated.fields = updated.fields.map((field: SigningField) => {
      const updated = { ...field };
      if (updated.value) {
        Object.entries(variables).forEach(([key, value]) => {
          updated.value = updated.value?.replace(new RegExp(`{{${key}}}`, "g"), value);
        });
      }
      if (updated.label) {
        Object.entries(variables).forEach(([key, value]) => {
          updated.label = updated.label?.replace(new RegExp(`{{${key}}}`, "g"), value);
        });
      }
      return updated;
    });

    return updated;
  }

  /**
   * Calculate field position in pixels for a PDF page.
   */
  protected calculatePixelPosition(
    percentageX: number,
    percentageY: number,
    pageWidth: number = 612, // Standard letter width
    pageHeight: number = 792 // Standard letter height
  ): { x: number; y: number } {
    return {
      x: (percentageX / 100) * pageWidth,
      y: (percentageY / 100) * pageHeight,
    };
  }

  /**
   * Calculate field size in pixels.
   */
  protected calculatePixelSize(
    percentageWidth: number,
    percentageHeight: number,
    pageWidth: number = 612,
    pageHeight: number = 792
  ): { width: number; height: number } {
    return {
      width: (percentageWidth / 100) * pageWidth,
      height: (percentageHeight / 100) * pageHeight,
    };
  }

  /**
   * Get rate limit status.
   */
  getRateLimitStatus(): Promise<{ remaining: number; resetAt: Date }> {
    return Promise.resolve({
      remaining: this.rateLimiter.getAvailable(),
      resetAt: this.rateLimiter.getResetTime(),
    });
  }

  /**
   * Get circuit breaker status.
   */
  getCircuitBreakerStatus(): Promise<{
    state: "closed" | "open" | "half_open";
    failureCount: number;
  }> {
    return Promise.resolve({
      state: this.circuitBreaker.getState(),
      failureCount: this.circuitBreaker.getFailureCount(),
    });
  }

  /**
   * Abstract methods to be implemented by subclasses.
   */
  abstract verifyCredentials(): Promise<boolean>;
  abstract createEnvelope(envelope: Envelope): Promise<EnvelopeResult>;
  abstract sendEnvelope(envelopeId: string): Promise<EnvelopeResult>;
  abstract voidEnvelope(envelopeId: string, reason?: string): Promise<void>;
  abstract getEnvelope(envelopeId: string): Promise<Envelope>;
  abstract getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult>;
  abstract listEnvelopes(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ envelopes: Envelope[]; total: number }>;
  abstract resendEnvelope(envelopeId: string, signerEmails?: string[]): Promise<void>;
  abstract listTemplates(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ templates: Template[]; total: number }>;
  abstract getTemplate(templateId: string): Promise<Template>;
  abstract createEnvelopeFromTemplate(
    templateId: string,
    envelope: Partial<Envelope>
  ): Promise<EnvelopeResult>;
  abstract downloadDocument(
    envelopeId: string,
    documentId: string
  ): Promise<DocumentDownloadResult>;
  abstract downloadEnvelopeDocuments(
    envelopeId: string
  ): Promise<{ content: string; mimeType: string; fileName: string }>;
  abstract getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    returnUrl: string
  ): Promise<EmbedSigningResult>;
  abstract markDocumentViewed(envelopeId: string, signerEmail: string): Promise<void>;
  abstract getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]>;
  abstract parseWebhookEvent(
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ESignatureWebhookEvent>;
  abstract verifyWebhookSignature(payload: string, signature: string): boolean;
  abstract healthCheck(): Promise<{ healthy: boolean; message: string }>;
}
