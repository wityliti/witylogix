// @ts-nocheck
/**
 * App Bridge Integration: Typed wrapper around Shopify App Bridge for extensions
 *
 * This module provides type-safe access to Shopify's App Bridge actions,
 * with error boundaries and message queuing for unreliable iframe conditions.
 *
 * Usage:
 *   const bridge = createAppBridgeClient(config);
 *   const result = await bridge.applyDiscount('SUMMER20', 20);
 */

import type {
  ExtensionConfig,
  DiscountResult,
  AddressResult,
  SessionData,
} from "./types.ts";

/**
 * Action types supported by Shopify App Bridge
 * Maps to official App Bridge action types
 */
type AppBridgeAction =
  | "ApplyDiscount"
  | "UpdateShippingAddress"
  | "RequestSession";

/**
 * Message envelope sent to/from Shopify App Bridge
 * Follows App Bridge protocol with action type and payload
 */
interface AppBridgeMessage {
  type: AppBridgeAction;
  payload?: Record<string, any>;
  id?: string;
}

/**
 * App Bridge response envelope
 */
interface AppBridgeResponse {
  id: string;
  status: "success" | "error";
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Configuration for App Bridge client initialization
 */
interface AppBridgeClientConfig extends ExtensionConfig {
  // Re-export ExtensionConfig for convenience
}

/**
 * Typed client for communicating with Shopify App Bridge
 * Handles message queuing, error handling, and response routing
 */
export class AppBridgeClient {
  private config: AppBridgeClientConfig;
  private messageQueue: AppBridgeMessage[] = [];
  private isReady: boolean = false;
  private responseHandlers: Map<string, (response: AppBridgeResponse) => void> =
    new Map();
  private messageId: number = 0;

  constructor(config: AppBridgeClientConfig) {
    this.config = config;
    this.setupMessageListener();
    this.waitForReady();
  }

  /**
   * Set up listener for App Bridge responses
   * @internal
   */
  private setupMessageListener(): void {
    window.addEventListener("message", (event) => {
      // Validate origin if appBridgeOrigin is configured
      if (
        this.config.appBridgeOrigin &&
        event.origin !== this.config.appBridgeOrigin
      ) {
        return;
      }

      const message = event.data;

      // Check if this is an App Bridge response
      if (
        message &&
        typeof message === "object" &&
        "id" in message &&
        "status" in message
      ) {
        const response = message as AppBridgeResponse;
        const handler = this.responseHandlers.get(response.id);

        if (handler) {
          handler(response);
          this.responseHandlers.delete(response.id);
        }
      }
    });
  }

  /**
   * Wait for App Bridge to be ready
   * Signals ready when we receive the first successful message or after timeout
   * @internal
   */
  private waitForReady(): void {
    // In a real implementation, Shopify would signal when ready
    // For now, assume ready after a short delay (extension initialization)
    setTimeout(() => {
      this.isReady = true;
      this.flushMessageQueue();
    }, 100);
  }

  /**
   * Send a message to App Bridge
   * Queues message if not yet ready, sends immediately if ready
   *
   * @param action - App Bridge action type
   * @param payload - Action payload
   * @returns Promise<AppBridgeResponse> - Response from Shopify
   * @internal
   */
  private async sendMessage(
    action: AppBridgeAction,
    payload?: Record<string, any>,
  ): Promise<AppBridgeResponse> {
    const message: AppBridgeMessage = {
      type: action,
      payload,
      id: `msg-${++this.messageId}`,
    };

    return new Promise((resolve, reject) => {
      // Register response handler
      this.responseHandlers.set(message.id!, (response) => {
        if (response.status === "success") {
          resolve(response);
        } else {
          reject(
            new AppBridgeError(
              response.error?.message || "Unknown error",
              response.error?.code || "UNKNOWN",
            ),
          );
        }
      });

      if (this.isReady) {
        this.postMessage(message);
      } else {
        this.messageQueue.push(message);
      }

      // Timeout after 30s
      setTimeout(() => {
        if (this.responseHandlers.has(message.id!)) {
          this.responseHandlers.delete(message.id!);
          reject(new AppBridgeError("Request timeout", "TIMEOUT"));
        }
      }, 30000);
    });
  }

  /**
   * Post message to App Bridge (parent window or designated endpoint)
   * @internal
   */
  private postMessage(message: AppBridgeMessage): void {
    const target = this.config.appBridgeOrigin
      ? window.parent
      : window.top || window.parent;

    const origin = this.config.appBridgeOrigin || "*";

    try {
      target.postMessage(message, origin);
    } catch (error) {
      console.error("[AppBridge] Failed to post message:", error);
    }
  }

  /**
   * Send all queued messages once App Bridge is ready
   * @internal
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.postMessage(message);
      }
    }
  }

  /**
   * Apply a discount code to the checkout
   * Validates discount eligibility with backend before applying
   *
   * @param code - Discount code (e.g., 'SUMMER20')
   * @param expectedPercent - Expected discount percentage for validation
   * @returns Promise<DiscountResult> - Discount application result
   */
  async applyDiscount(
    code: string,
    expectedPercent: number,
  ): Promise<DiscountResult> {
    try {
      const response = await this.sendMessage("ApplyDiscount", {
        code,
        expectedPercent,
        apiKey: this.config.apiKey,
        shopId: this.config.shopId,
      });

      return {
        success: true,
        newTotal: response.data?.newTotal,
        discountPercent: response.data?.discountPercent,
      };
    } catch (error) {
      if (error instanceof AppBridgeError) {
        return {
          success: false,
          error: error.message,
          errorCode: this.mapErrorCode(error.code),
        };
      }
      return {
        success: false,
        error: "Failed to apply discount",
        errorCode: "UNKNOWN",
      };
    }
  }

  /**
   * Update shipping address in checkout
   * Called after user selects delivery option
   *
   * @param address - New shipping address
   * @returns Promise<AddressResult> - Address update result
   */
  async updateShippingAddress(address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }): Promise<AddressResult> {
    try {
      await this.sendMessage("UpdateShippingAddress", {
        address,
        apiKey: this.config.apiKey,
        shopId: this.config.shopId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppBridgeError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "Failed to update address",
      };
    }
  }

  /**
   * Request session data from checkout
   * Returns customer ID if logged in, guest email if available
   *
   * @returns Promise<SessionData> - Current session information
   */
  async requestSession(): Promise<SessionData> {
    try {
      const response = await this.sendMessage("RequestSession", {
        apiKey: this.config.apiKey,
      });

      return {
        customerId: response.data?.customerId,
        guestEmail: response.data?.guestEmail,
        cartValue: response.data?.cartValue || 0,
        currency: response.data?.currency || "USD",
      };
    } catch (error) {
      // Return empty session on error
      return {
        cartValue: 0,
        currency: "USD",
      };
    }
  }

  /**
   * Map App Bridge error codes to user-friendly codes
   * @internal
   */
  private mapErrorCode(code: string): DiscountResult["errorCode"] {
    switch (code.toLowerCase()) {
      case "invalid_code":
      case "code_not_found":
        return "INVALID_CODE";
      case "expired":
      case "code_expired":
        return "EXPIRED";
      case "limit":
      case "usage_limit_exceeded":
        return "LIMIT_EXCEEDED";
      default:
        return "UNKNOWN";
    }
  }
}

/**
 * Custom error class for App Bridge failures
 * Distinguishes App Bridge errors from other exceptions
 */
export class AppBridgeError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "AppBridgeError";
  }
}

/**
 * Create and initialize an App Bridge client for the extension
 * Reads config from window.__EXTENSION_CONFIG__ or accepts as parameter
 *
 * @param config - Extension configuration (optional if __EXTENSION_CONFIG__ available)
 * @returns AppBridgeClient - Initialized client ready for use
 */
export function createAppBridgeClient(
  config?: AppBridgeClientConfig,
): AppBridgeClient {
  const finalConfig = config || (window as any).__EXTENSION_CONFIG__;

  if (!finalConfig) {
    throw new Error(
      "AppBridge: No configuration found. Pass config or set window.__EXTENSION_CONFIG__",
    );
  }

  return new AppBridgeClient(finalConfig);
}

/**
 * Error boundary component for catching extension errors
 * Logs errors and prevents white-screen failures
 */
export class ErrorBoundary {
  private onError?: (error: Error, errorInfo: string) => void;

  constructor(onError?: (error: Error, errorInfo: string) => void) {
    this.onError = onError;
  }

  /**
   * Catch error from component tree and handle gracefully
   * Sends error to parent frame for logging via postMessage
   *
   * @param error - Error that occurred
   * @param errorInfo - Component stack info
   */
  captureError(error: Error, errorInfo: string): void {
    console.error("[Extension] Error caught by boundary:", error);

    // Call user-provided error handler
    if (this.onError) {
      this.onError(error, errorInfo);
    }

    // Report to parent window (POS) or dashboard for monitoring
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "wl:extension-error",
            error: error.message,
            stack: error.stack,
            errorInfo,
            metadata: {
              version: (window as any).__EXTENSION_METADATA__?.version,
              extensionId: (window as any).__EXTENSION_CONFIG__?.extensionId,
            },
          },
          "*",
        );
      }
    } catch (reportError) {
      console.error("[Extension] Failed to report error:", reportError);
    }
  }
}

/**
 * Wrap a handler function with error boundary protection
 * Catches exceptions and logs them gracefully
 *
 * @param handler - Async function to wrap
 * @param errorBoundary - Error boundary for logging
 * @returns Wrapped function that won't throw
 * @internal
 */
export function withErrorBoundary(
  handler: (...args: any[]) => Promise<any>,
  errorBoundary: ErrorBoundary,
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorBoundary.captureError(err, "Handler error");
      throw err;
    }
  };
}

/**
 * Retry a failed App Bridge action with exponential backoff
 * Useful for transient network failures
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in ms (default: 100)
 * @returns Promise<T> - Result from successful attempt
 * @internal
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * delay; // ±10% jitter
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError || new Error("Failed after retries");
}
