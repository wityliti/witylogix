/**
 * API Module — Barrel export for all API utilities.
 *
 * Exports:
 * - TenantRateLimiter: Per-tenant rate limiting with sliding window
 * - RequestValidator: Zod-based validation middleware factory
 * - CursorPaginator: Opaque cursor-based pagination
 * - ApiVersionManager: API version detection and transformation
 * - RequestLogger: Structured JSON request/response logging
 * - ApiResponse: Standard response formatter with error codes
 *
 * Usage:
 *   import {
 *     TenantRateLimiter,
 *     RequestValidator,
 *     CursorPaginator,
 *     ApiVersionManager,
 *     RequestLogger,
 *     ApiResponse,
 *     ApiErrorCode,
 *   } from "@witylogix/core/api";
 */

// ─── Rate Limiter Exports ───────────────────────────────────────────

export {
  TenantRateLimiter,
} from './rate-limiter-tenant.js';

export type {
  RateLimitConfig,
  RateLimitResult,
} from './rate-limiter-tenant.js';

// ─── Request Validator Exports ──────────────────────────────────────

export {
  RequestValidator,
} from './request-validator.js';

export type {
  ValidationError,
  ValidationResult,
  PaginationParams,
  SortParams,
  FilterParams,
  DateRangeParams,
} from './request-validator.js';

// ─── Cursor Pagination Exports ──────────────────────────────────────

export {
  CursorPaginator,
} from './cursor-pagination.js';

export type {
  PageInfo,
  PaginationConfig,
  PaginatedResponse,
} from './cursor-pagination.js';

// ─── API Versioning Exports ─────────────────────────────────────────

export {
  ApiVersionManager,
} from './api-versioning.js';

export type {
  VersionInfo,
  VersionConfig,
} from './api-versioning.js';

// ─── Request Logger Exports ────────────────────────────────────────

export {
  RequestLogger,
} from './request-logger.js';

export type {
  RequestLogEntry,
  LogLevel,
} from './request-logger.js';

// ─── Response Formatter Exports ────────────────────────────────────

export {
  ApiResponse,
  ApiErrorCode,
} from './response-formatter.js';

export type {
  SuccessResponse,
  ErrorResponse,
  ErrorDetail,
  HateoasLink,
} from './response-formatter.js';
