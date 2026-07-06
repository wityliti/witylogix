/**
 * API Hardening Module — Barrel exports for all API hardening utilities
 *
 * This module provides:
 * - Standardized error handling with Fastify integration
 * - Rate limiting with token bucket algorithm
 * - Request validation and XSS protection
 * - OpenAPI 3.0.3 spec generation and Swagger UI
 *
 * Usage:
 *   import {
 *     errorHandlerPlugin,
 *     rateLimitPlugin,
 *     validateBody,
 *     generateOpenApiSpec
 *   } from "@witylogix/core/api-hardening";
 */

// ─── Error Handler Exports ──────────────────────────────────────────

export {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  RateLimitError,
  ServiceUnavailableError,
  errorHandlerPlugin,
  isAppError,
} from "./error-handler.js";

// ─── Rate Limiter Exports ───────────────────────────────────────────

export {
  createRateLimiter,
  rateLimitPlugin,
  rateLimitStore,
} from "./rate-limiter.js";

export type {
  RateLimitConfig,
  TierBasedLimits,
  RateLimiterPluginOptions,
} from "./rate-limiter.js";

// ─── Request Validator Exports ──────────────────────────────────────

export {
  sanitizeInput,
  sanitizeObject,
  validateBody,
  validateQuery,
  validateParams,
  validatePagination,
  getPaginationOffsetLimit,
} from "./request-validator.js";

export type {
  PaginationParams,
  PaginationValidationOptions,
} from "./request-validator.js";

// ─── OpenAPI Generator Exports ──────────────────────────────────────

export {
  generateOpenApiSpec,
  serveSwaggerUI,
  ROUTE_DEFINITIONS,
} from "./openapi-generator.js";

export type {
  HttpMethod,
  ResponseDefinition,
  ParameterDefinition,
  RequestBodyDefinition,
  RouteDefinition,
  OpenApiSpec,
} from "./openapi-generator.js";
