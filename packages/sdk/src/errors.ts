/**
 * Custom error classes for the Witylogix SDK
 */

import type { ApiErrorResponse, ErrorOptions } from './types';

/**
 * Base error class for all API errors
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, options: ErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.details = options.details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Create an ApiError from a response object
   */
  static fromResponse(status: number, body: any): ApiError {
    const message = body?.message || `HTTP ${status}`;
    const code = body?.code || `HTTP_${status}`;
    const details = body?.details;

    if (status === 401 || status === 403) {
      return new AuthError(message, { status, code, details });
    }

    if (status === 404) {
      return new NotFoundError(message, { status, code, details });
    }

    if (status === 429) {
      return new RateLimitError(message, { status, code, details });
    }

    if (status >= 400 && status < 500) {
      return new BadRequestError(message, { status, code, details });
    }

    if (status >= 500) {
      return new ServerError(message, { status, code, details });
    }

    return new ApiError(message, { status, code, details });
  }

  toJSON(): ApiErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Authentication/Authorization errors (4xx)
 */
export class AuthError extends ApiError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends ApiError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Rate limit exceeded errors (429)
 */
export class RateLimitError extends ApiError {
  public readonly retryAfter?: number;

  constructor(message: string, options: ErrorOptions & { retryAfter?: number } = { status: 429 }) {
    super(message, options);
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Bad request errors (400)
 */
export class BadRequestError extends ApiError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * Server errors (5xx)
 */
export class ServerError extends ApiError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Network/client errors
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}
