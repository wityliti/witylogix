/**
 * Provider abstraction layer — unified interfaces across all channels.
 * Each provider (SendGrid, Twilio, Firebase, etc.) implements NotificationProvider.
 */

/**
 * Generic notification provider interface.
 * Each channel-specific provider (Email, SMS, Push, WhatsApp) adapts to this.
 */
export interface NotificationProvider {
  /** Channel this provider serves. */
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";

  /** Human-readable provider name (e.g., "SendGrid", "Twilio"). */
  name: string;

  /**
   * Send a notification through this provider.
   * @param message The message to send with all required metadata.
   * @returns Result including success status, message ID, and any errors.
   */
  send(message: NotificationMessage): Promise<NotificationResult>;

  /**
   * Validate provider configuration before sending.
   * @param config Configuration object (e.g., { apiKey: "...", fromEmail: "..." }).
   * @returns true if valid, false otherwise.
   */
  validateConfig(config: Record<string, string>): Promise<boolean>;

  /**
   * Get provider health status and quota information.
   * @returns Status including health, latency, remaining quota.
   */
  getStatus(): Promise<ProviderStatus>;
}

/**
 * Unified notification message format.
 * Adapters map this to provider-specific formats (SendGrid, Twilio, etc.).
 */
export interface NotificationMessage {
  /** Recipient address (email, phone number with country code, device token, etc.). */
  to: string;

  /** Subject line (email only). */
  subject?: string;

  /** Rendered HTML/rich content (email HTML, plain text for SMS/WhatsApp). */
  body: string;

  /** Plain text fallback for email (if body is HTML). */
  textBody?: string;

  /** Sender override (defaults to provider config if not specified). */
  from?: string;

  /** Reply-to address (email only). */
  replyTo?: string;

  /** Provider's template ID if using pre-built templates. */
  templateId?: string;

  /** Variables to interpolate into template. */
  variables?: Record<string, unknown>;

  /** Additional metadata for tracking/logging. */
  metadata?: Record<string, unknown>;

  /** Email attachments only. */
  attachments?: Attachment[];
}

/**
 * Email or document attachment.
 */
export interface Attachment {
  /** Filename as it appears to the recipient. */
  filename: string;

  /** Base64-encoded file content. */
  content: string;

  /** MIME type (e.g., "application/pdf"). */
  contentType: string;
}

/**
 * Result of a send attempt.
 */
export interface NotificationResult {
  /** Whether send was accepted by the provider. */
  success: boolean;

  /** Provider-specific message ID for webhooks and tracking. */
  messageId?: string;

  /** Raw provider response for debugging. */
  providerResponse?: unknown;

  /** Error message if send failed. */
  error?: string;

  /** Cost of send if metered (in USD). */
  cost?: number;
}

/**
 * Provider health status and quota.
 */
export interface ProviderStatus {
  /** Provider is operational and responding. */
  healthy: boolean;

  /** API response latency in ms. */
  latency?: number;

  /** Remaining quota (e.g., messages, API calls) relative to limit. */
  quotaRemaining?: number;

  /** Most recent error from health check. */
  lastError?: string;
}

/**
 * Error class for provider-specific failures.
 */
export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public provider: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Rate limit error.
 */
export class RateLimitError extends ProviderError {
  constructor(
    provider: string,
    message: string,
    public resetAfter?: number,
  ) {
    super("RATE_LIMIT", message, provider, true);
    this.name = "RateLimitError";
  }
}

/**
 * Invalid recipient error (e.g., malformed email, phone number).
 */
export class InvalidRecipientError extends ProviderError {
  constructor(provider: string, recipient: string, message: string) {
    super(
      "INVALID_RECIPIENT",
      `Invalid recipient "${recipient}": ${message}`,
      provider,
      false,
    );
    this.name = "InvalidRecipientError";
  }
}

/**
 * Authentication failure.
 */
export class AuthenticationError extends ProviderError {
  constructor(provider: string, message: string) {
    super("AUTH_ERROR", message, provider, false);
    this.name = "AuthenticationError";
  }
}
