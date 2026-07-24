/**
 * Core HTTP client for the Witylogix API
 */

import type { ClientConfig, RequestOptions, PaginatedResponse } from "./types";
import { ApiError, NetworkError, ConfigError, RateLimitError } from "./errors";

/**
 * HTTP method type
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Core WitylogixClient - handles all HTTP communication with the API
 */
export class WitylogixClient {
  private baseUrl: string;
  private apiKey?: string;
  private accessToken?: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(config: ClientConfig) {
    if (!config.baseUrl) {
      throw new ConfigError("baseUrl is required in client configuration");
    }

    if (!config.apiKey && !config.accessToken) {
      throw new ConfigError("Either apiKey or accessToken must be provided");
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts ?? 3;
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    options?: {
      data?: any;
      params?: Record<string, any>;
      headers?: Record<string, string>;
      timeout?: number;
      retryAttempts?: number;
    },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options?.headers);
    const timeout = options?.timeout || this.timeout;
    const retryAttempts = options?.retryAttempts ?? this.retryAttempts;

    return this.requestWithRetry<T>(method, url, {
      headers,
      body: options?.data ? JSON.stringify(options.data) : undefined,
      timeout,
      retryAttempts,
    });
  }

  /**
   * Make a request with automatic retry logic for rate limits
   */
  private async requestWithRetry<T>(
    method: HttpMethod,
    url: string,
    options: {
      headers: Record<string, string>;
      body?: string;
      timeout: number;
      retryAttempts: number;
    },
    attempt: number = 0,
  ): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(url, {
        method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(
          response.headers.get("Retry-After"),
        );

        if (attempt < options.retryAttempts) {
          await this.sleep(retryAfter);
          return this.requestWithRetry<T>(method, url, options, attempt + 1);
        }

        const body = await this.parseResponse<any>(response);
        throw RateLimitError.fromResponse(response.status, body);
      }

      // Check for other errors
      if (!response.ok) {
        const body = await this.parseResponse<any>(response);
        throw ApiError.fromResponse(response.status, body);
      }

      return this.parseResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new NetworkError(`Request timeout after ${options.timeout}ms`);
      }

      if (error instanceof TypeError) {
        throw new NetworkError(`Network error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Parse retry-after header (seconds or HTTP-date)
   */
  private parseRetryAfter(retryAfter: string | null): number {
    if (!retryAfter) return 1000;

    // If it's a number, treat as seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Otherwise, treat as HTTP-date
    const retryDate = new Date(retryAfter);
    const now = new Date();
    const delay = Math.max(retryDate.getTime() - now.getTime(), 1000);

    return delay;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build authorization headers
   */
  private buildHeaders(
    customHeaders?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...customHeaders,
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    return headers;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });
    }

    return url.toString();
  }

  /**
   * Parse JSON response
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("Content-Type");

    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    if (!text) {
      return undefined as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // Return raw text if not valid JSON
      return text as unknown as T;
    }
  }

  // =========================================================================
  // Public HTTP Methods
  // =========================================================================

  /**
   * GET request
   */
  public async get<T>(
    path: string,
    params?: Record<string, any>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("GET", path, {
      params,
      headers: options?.headers,
      timeout: options?.timeout,
      retryAttempts: options?.retryAttempts,
    });
  }

  /**
   * POST request
   */
  public async post<T>(
    path: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("POST", path, {
      data,
      headers: options?.headers,
      timeout: options?.timeout,
      retryAttempts: options?.retryAttempts,
    });
  }

  /**
   * PUT request
   */
  public async put<T>(
    path: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("PUT", path, {
      data,
      headers: options?.headers,
      timeout: options?.timeout,
      retryAttempts: options?.retryAttempts,
    });
  }

  /**
   * PATCH request
   */
  public async patch<T>(
    path: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("PATCH", path, {
      data,
      headers: options?.headers,
      timeout: options?.timeout,
      retryAttempts: options?.retryAttempts,
    });
  }

  /**
   * DELETE request
   */
  public async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, {
      headers: options?.headers,
      timeout: options?.timeout,
      retryAttempts: options?.retryAttempts,
    });
  }

  /**
   * Get the base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if client has valid authentication
   */
  public isAuthenticated(): boolean {
    return !!(this.apiKey || this.accessToken);
  }
}
