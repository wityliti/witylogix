/**
 * Webhook Dispatcher
 * Handles async webhook delivery with configurable timeouts and request building
 */

import { createHmac } from "crypto";

/**
 * Webhook request metadata
 */
export interface WebhookRequestMetadata {
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Webhook dispatch response
 */
export interface DispatchResponse {
  success: boolean;
  statusCode?: number;
  duration: number;
  error?: string;
  metadata: WebhookRequestMetadata;
}

/**
 * Webhook request options
 */
export interface DispatchOptions {
  timeout?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
}

/**
 * WebhookDispatcher
 * Core webhook dispatch engine with timeout, signature generation, and response validation
 */
export class WebhookDispatcher {
  private defaultTimeout: number = 30000; // 30 seconds
  private maxPayloadSize: number = 10 * 1024 * 1024; // 10MB

  /**
   * Initialize webhook dispatcher
   * @param timeout - Default request timeout in milliseconds
   */
  constructor(timeout?: number) {
    if (timeout) {
      this.defaultTimeout = timeout;
    }
  }

  /**
   * Dispatch a webhook to an endpoint
   * @param url - Target webhook URL
   * @param payload - JSON payload to send
   * @param secret - Webhook secret for HMAC signature
   * @param options - Dispatch options
   * @returns Dispatch response with status and metadata
   */
  async dispatch(
    url: string,
    payload: Record<string, unknown>,
    secret: string,
    options: DispatchOptions = {},
  ): Promise<DispatchResponse> {
    const metadata: WebhookRequestMetadata = {
      startTime: Date.now(),
      retryCount: options.retryCount || 0,
    };

    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid webhook URL: only HTTP and HTTPS supported");
      }

      // Validate payload size
      const payloadString = JSON.stringify(payload);
      if (payloadString.length > this.maxPayloadSize) {
        throw new Error(
          `Webhook payload exceeds maximum size of ${this.maxPayloadSize} bytes`,
        );
      }

      // Generate signature
      const signature = this.generateSignature(payloadString, secret);
      const timestamp = new Date().toISOString();

      // Build headers
      const headers = this.buildHeaders(
        signature,
        timestamp,
        options.customHeaders,
      );

      // Dispatch request with timeout
      const timeout = options.timeout || this.defaultTimeout;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        metadata.endTime = Date.now();
        metadata.duration = metadata.endTime - metadata.startTime;
        metadata.statusCode = response.status;

        // Validate response status (2xx = success)
        const success = response.status >= 200 && response.status < 300;

        return {
          success,
          statusCode: response.status,
          duration: metadata.duration,
          metadata,
          error: success ? undefined : `HTTP ${response.status}`,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      metadata.endTime = Date.now();
      metadata.duration = metadata.endTime - metadata.startTime;
      metadata.lastError =
        error instanceof Error ? error.message : String(error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        duration: metadata.duration,
        error: errorMessage,
        metadata,
      };
    }
  }

  /**
   * Dispatch multiple webhooks in parallel
   * @param requests - Array of dispatch requests
   * @returns Array of dispatch responses
   */
  async dispatchBatch(
    requests: Array<{
      url: string;
      payload: Record<string, unknown>;
      secret: string;
      options?: DispatchOptions;
    }>,
  ): Promise<DispatchResponse[]> {
    return Promise.all(
      requests.map((req) =>
        this.dispatch(req.url, req.payload, req.secret, req.options),
      ),
    );
  }

  /**
   * Build HTTP headers for webhook request
   * @param signature - HMAC signature
   * @param timestamp - Request timestamp
   * @param customHeaders - Additional custom headers
   * @returns Headers object
   */
  private buildHeaders(
    signature: string,
    timestamp: string,
    customHeaders?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Witylogix-Webhook-Dispatcher/1.0",
      "X-Witylogix-Signature": signature,
      "X-Witylogix-Timestamp": timestamp,
    };

    // Merge custom headers
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    return headers;
  }

  /**
   * Generate HMAC-SHA256 signature for payload
   * @param payload - Stringified JSON payload
   * @param secret - Webhook secret
   * @returns Hex-encoded signature
   */
  private generateSignature(payload: string, secret: string): string {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    return hmac.digest("hex");
  }

  /**
   * Validate webhook signature
   * @param payload - Original payload string
   * @param signature - Signature to verify
   * @param secret - Webhook secret
   * @returns True if signature is valid
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");

    // Constant-time comparison
    if (signature.length !== expected.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Get dispatcher configuration
   * @returns Current configuration
   */
  getConfig() {
    return {
      defaultTimeout: this.defaultTimeout,
      maxPayloadSize: this.maxPayloadSize,
    };
  }

  /**
   * Update dispatcher configuration
   * @param config - Configuration updates
   */
  updateConfig(config: { defaultTimeout?: number; maxPayloadSize?: number }) {
    if (config.defaultTimeout !== undefined) {
      this.defaultTimeout = config.defaultTimeout;
    }
    if (config.maxPayloadSize !== undefined) {
      this.maxPayloadSize = config.maxPayloadSize;
    }
  }
}
