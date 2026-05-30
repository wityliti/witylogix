/**
 * WooCommerce REST API v3 Client
 * Handles HTTP communication with WooCommerce stores including
 * OAuth 1.0a signature generation, rate limiting, retries, and logging.
 */

import { createHmac } from "node:crypto";
import { randomBytes } from "node:crypto";
import type {
  WCClientConfig,
  WCOrder,
  WCProduct,
  WCCustomer,
  WCWebhook,
  WCPaginationOptions,
  WCListResponse,
  WCAPIError,
  WCProductVariation,
} from "./types.js";

/**
 * OAuth 1.0a Header Builder for WooCommerce
 */
class OAuth1aBuilder {
  private consumerKey: string;
  private consumerSecret: string;

  constructor(consumerKey: string, consumerSecret: string) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  /**
   * Generate OAuth 1.0a Authorization header
   */
  generateHeader(
    method: string,
    url: string,
    body?: Record<string, unknown> | null,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    const params: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    };

    // Build signature base string
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

    // Sign
    const signingKey = `${encodeURIComponent(this.consumerSecret)}&`;
    const signature = createHmac("sha256", signingKey)
      .update(baseString)
      .digest("base64");

    params.oauth_signature = signature;

    // Build header
    const headerParts = Object.entries(params)
      .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
      .join(", ");

    return `OAuth ${headerParts}`;
  }
}

/**
 * Rate Limiter with sliding window
 */
class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(requestsPerSecond: number) {
    this.maxRequests = requestsPerSecond;
    this.windowMs = 1000; // 1 second
  }

  /**
   * Wait if needed to respect rate limit
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => t > now - this.windowMs);

    if (this.requestTimes.length >= this.maxRequests) {
      const oldestTime = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestTime) + 1;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimes.push(now);
  }
}

/**
 * WooCommerce REST API v3 Client
 */
export class WooCommerceClient {
  private config: WCClientConfig;
  private oauth: OAuth1aBuilder;
  private rateLimiter: RateLimiter;
  private baseUrl: string;
  private apiVersion: string;

  constructor(config: WCClientConfig) {
    this.config = {
      version: "wc/v3",
      timeout: 30000,
      rateLimit: 25,
      retries: 3,
      ...config,
    };

    this.baseUrl = this.config.storeUrl.replace(/\/$/, "");
    this.apiVersion = this.config.version || "wc/v3";

    this.oauth = new OAuth1aBuilder(
      this.config.consumerKey,
      this.config.consumerSecret,
    );

    this.rateLimiter = new RateLimiter(this.config.rateLimit || 25);
  }

  /**
   * Build full API URL
   */
  private buildUrl(endpoint: string, params?: WCPaginationOptions): string {
    let url = `${this.baseUrl}/wp-json/${this.apiVersion}/${endpoint.replace(/^\//, "")}`;

    if (params) {
      const queryParams = new URLSearchParams();

      if (params.page !== undefined) {
        queryParams.append("page", params.page.toString());
      }
      if (params.perPage !== undefined) {
        queryParams.append("per_page", params.perPage.toString());
      }
      if (params.offset !== undefined) {
        queryParams.append("offset", params.offset.toString());
      }
      if (params.orderby) {
        queryParams.append("orderby", params.orderby);
      }
      if (params.order) {
        queryParams.append("order", params.order);
      }

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }

    return url;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    method: string,
    url: string,
    body?: Record<string, unknown> | null,
    retryCount = 0,
  ): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    const headers: Record<string, string> = {
      Authorization: this.oauth.generateHeader(method, url, body),
      "Content-Type": "application/json",
      "User-Agent": "Witylogix/1.0",
    };

    const options: RequestInit = {
      method,
      headers,
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as unknown;

        if (response.status === 429) {
          // Rate limited
          if (retryCount < (this.config.retries || 3)) {
            const backoffMs = Math.pow(2, retryCount) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            return this.makeRequest<T>(method, url, body, retryCount + 1);
          }
        }

        if (response.status >= 500 && retryCount < (this.config.retries || 3)) {
          // Server error, retry with exponential backoff
          const backoffMs = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return this.makeRequest<T>(method, url, body, retryCount + 1);
        }

        const error = errorData as WCAPIError;
        throw new Error(
          `WooCommerce API Error [${response.status}]: ${error.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof Error && retryCount < (this.config.retries || 3)) {
        // Network error, retry
        const backoffMs = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.makeRequest<T>(method, url, body, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    params?: WCPaginationOptions,
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    return this.makeRequest<T>("GET", url);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>("POST", url, data);
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>("PUT", url, data);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>("DELETE", url);
  }

  /**
   * Get single order
   */
  async getOrder(orderId: number): Promise<WCOrder> {
    return this.get<WCOrder>(`/orders/${orderId}`);
  }

  /**
   * Get all orders with filtering
   */
  async getOrders(
    params?: WCPaginationOptions & {
      status?: string;
      customer?: number;
      search?: string;
      after?: string;
      before?: string;
    },
  ): Promise<WCListResponse<WCOrder>> {
    const response = await this.get<WCOrder[]>("/orders", params as WCPaginationOptions);
    return {
      data: response,
    };
  }

  /**
   * Create order
   */
  async createOrder(data: Partial<WCOrder>): Promise<WCOrder> {
    return this.post<WCOrder>("/orders", data as Record<string, unknown>);
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: number,
    data: Partial<WCOrder>,
  ): Promise<WCOrder> {
    return this.put<WCOrder>(`/orders/${orderId}`, data as Record<string, unknown>);
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId: number, force = false): Promise<WCOrder> {
    return this.delete<WCOrder>(
      `/orders/${orderId}?force=${force ? "true" : "false"}`,
    );
  }

  /**
   * Get single product
   */
  async getProduct(productId: number): Promise<WCProduct> {
    return this.get<WCProduct>(`/products/${productId}`);
  }

  /**
   * Get all products with filtering
   */
  async getProducts(
    params?: WCPaginationOptions & {
      status?: string;
      category?: number;
      tag?: number;
      search?: string;
      sku?: string;
    },
  ): Promise<WCListResponse<WCProduct>> {
    const response = await this.get<WCProduct[]>("/products", params as WCPaginationOptions);
    return {
      data: response,
    };
  }

  /**
   * Create product
   */
  async createProduct(data: Partial<WCProduct>): Promise<WCProduct> {
    return this.post<WCProduct>("/products", data as Record<string, unknown>);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: number,
    data: Partial<WCProduct>,
  ): Promise<WCProduct> {
    return this.put<WCProduct>(
      `/products/${productId}`,
      data as Record<string, unknown>,
    );
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: number, force = false): Promise<WCProduct> {
    return this.delete<WCProduct>(
      `/products/${productId}?force=${force ? "true" : "false"}`,
    );
  }

  /**
   * Get product variation
   */
  async getProductVariation(
    productId: number,
    variationId: number,
  ): Promise<WCProductVariation> {
    return this.get<WCProductVariation>(
      `/products/${productId}/variations/${variationId}`,
    );
  }

  /**
   * Get product variations
   */
  async getProductVariations(
    productId: number,
    params?: WCPaginationOptions,
  ): Promise<WCListResponse<WCProductVariation>> {
    const response = await this.get<WCProductVariation[]>(
      `/products/${productId}/variations`,
      params,
    );
    return {
      data: response,
    };
  }

  /**
   * Update product variation
   */
  async updateProductVariation(
    productId: number,
    variationId: number,
    data: Partial<WCProductVariation>,
  ): Promise<WCProductVariation> {
    return this.put<WCProductVariation>(
      `/products/${productId}/variations/${variationId}`,
      data as Record<string, unknown>,
    );
  }

  /**
   * Get single customer
   */
  async getCustomer(customerId: number): Promise<WCCustomer> {
    return this.get<WCCustomer>(`/customers/${customerId}`);
  }

  /**
   * Get all customers with filtering
   */
  async getCustomers(
    params?: WCPaginationOptions & {
      email?: string;
      search?: string;
      role?: string;
    },
  ): Promise<WCListResponse<WCCustomer>> {
    const response = await this.get<WCCustomer[]>("/customers", params as WCPaginationOptions);
    return {
      data: response,
    };
  }

  /**
   * Create customer
   */
  async createCustomer(data: Partial<WCCustomer>): Promise<WCCustomer> {
    return this.post<WCCustomer>("/customers", data as Record<string, unknown>);
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: number,
    data: Partial<WCCustomer>,
  ): Promise<WCCustomer> {
    return this.put<WCCustomer>(
      `/customers/${customerId}`,
      data as Record<string, unknown>,
    );
  }

  /**
   * Get all webhooks
   */
  async getWebhooks(
    params?: WCPaginationOptions,
  ): Promise<WCListResponse<WCWebhook>> {
    const response = await this.get<WCWebhook[]>("/webhooks", params);
    return {
      data: response,
    };
  }

  /**
   * Get single webhook
   */
  async getWebhook(webhookId: number): Promise<WCWebhook> {
    return this.get<WCWebhook>(`/webhooks/${webhookId}`);
  }

  /**
   * Create webhook
   */
  async createWebhook(data: Partial<WCWebhook>): Promise<WCWebhook> {
    return this.post<WCWebhook>("/webhooks", data as Record<string, unknown>);
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: number,
    data: Partial<WCWebhook>,
  ): Promise<WCWebhook> {
    return this.put<WCWebhook>(
      `/webhooks/${webhookId}`,
      data as Record<string, unknown>,
    );
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: number, force = false): Promise<WCWebhook> {
    return this.delete<WCWebhook>(
      `/webhooks/${webhookId}?force=${force ? "true" : "false"}`,
    );
  }
}

/**
 * Create WooCommerce client instance
 */
export function createWooCommerceClient(
  config: WCClientConfig,
): WooCommerceClient {
  return new WooCommerceClient(config);
}
