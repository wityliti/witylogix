/**
 * Request Validator — Zod-based request validation with XSS protection
 *
 * Provides:
 * - validateBody(schema): Validate and parse request.body
 * - validateQuery(schema): Validate and parse request.query
 * - validateParams(schema): Validate and parse request.params
 * - sanitizeInput(input): Strip XSS vectors
 * - validatePagination(): Enforce pagination limits
 * - Automatic field-level error details on validation failure
 * - Type-safe validation returning T from ZodSchema<T>
 *
 * Usage:
 *   const schema = z.object({ email: z.string().email() });
 *   const data = await validateBody(request, schema);
 */

type FastifyRequest = any;
type ZodSchema = any;

import { ValidationError } from "./error-handler.js";

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Pagination validation options
 */
export interface PaginationValidationOptions {
  maxPageSize?: number; // Default: 100
  defaultPageSize?: number; // Default: 20
  allowedSortFields?: string[]; // Default: [] (all allowed)
}

/**
 * XSS attack vector patterns
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<embed\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

/**
 * Sanitize input string by removing XSS vectors
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }

  let sanitized = input;
  XSS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });

  return sanitized.trim().substring(0, 10000); // Limit length to prevent DoS
}

/**
 * Recursively sanitize object values (strings only)
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Check if error is a Zod validation error
 */
function isZodError(error: any): boolean {
  return (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors)
  );
}

/**
 * Extract field-level error details from ZodError
 */
function extractValidationErrors(error: any): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  error.errors.forEach((err: any) => {
    const path = err.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });

  return fieldErrors;
}

/**
 * Validate request body
 */
export async function validateBody<T>(
  request: FastifyRequest,
  schema: any,
): Promise<T> {
  try {
    // Sanitize body first to prevent XSS
    const sanitized = sanitizeObject(request.body);
    return await schema.parseAsync(sanitized);
  } catch (error) {
    if (isZodError(error)) {
      throw new ValidationError(
        "Request body validation failed",
        extractValidationErrors(error),
      );
    }
    throw error;
  }
}

/**
 * Validate request query parameters
 */
export async function validateQuery<T>(
  request: FastifyRequest,
  schema: any,
): Promise<T> {
  try {
    // Query params are strings, sanitize them
    const sanitized = sanitizeObject(request.query);
    return await schema.parseAsync(sanitized);
  } catch (error) {
    if (isZodError(error)) {
      throw new ValidationError(
        "Query parameters validation failed",
        extractValidationErrors(error),
      );
    }
    throw error;
  }
}

/**
 * Validate route parameters
 */
export async function validateParams<T>(
  request: FastifyRequest,
  schema: any,
): Promise<T> {
  try {
    const sanitized = sanitizeObject(request.params);
    return await schema.parseAsync(sanitized);
  } catch (error) {
    if (isZodError(error)) {
      throw new ValidationError(
        "Route parameters validation failed",
        extractValidationErrors(error),
      );
    }
    throw error;
  }
}

/**
 * Validate pagination parameters from query
 */
export async function validatePagination(
  request: FastifyRequest,
  options: PaginationValidationOptions = {},
): Promise<PaginationParams> {
  const maxPageSize = options.maxPageSize || 100;
  const defaultPageSize = options.defaultPageSize || 20;
  const allowedSortFields = options.allowedSortFields || [];

  const query = request.query as Record<string, any>;

  // Parse page number
  let page = parseInt(query.page as string, 10) || 1;
  if (page < 1) {
    throw new ValidationError("Page must be >= 1", { page });
  }

  // Parse page size with limits
  let pageSize = parseInt(query.pageSize as string, 10) || defaultPageSize;
  if (pageSize < 1) {
    throw new ValidationError("pageSize must be >= 1", { pageSize });
  }
  if (pageSize > maxPageSize) {
    throw new ValidationError(`pageSize must be <= ${maxPageSize}`, {
      pageSize,
      maxPageSize,
    });
  }

  // Parse sort field and order
  const sortBy = query.sortBy ? sanitizeInput(String(query.sortBy)) : undefined;
  const sortOrder = (query.sortOrder || "asc") as "asc" | "desc";

  // Validate sort order
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    throw new ValidationError('sortOrder must be "asc" or "desc"', {
      sortOrder,
    });
  }

  // Validate sort field against allowed list
  if (
    sortBy &&
    allowedSortFields.length > 0 &&
    !allowedSortFields.includes(sortBy)
  ) {
    throw new ValidationError(
      `sortBy must be one of: ${allowedSortFields.join(", ")}`,
      { sortBy, allowedSortFields },
    );
  }

  return {
    page,
    pageSize,
    sortBy,
    sortOrder,
  };
}

/**
 * Validate and return offset/limit for database queries
 */
export function getPaginationOffsetLimit(pagination: PaginationParams): {
  offset: number;
  limit: number;
} {
  return {
    offset: (pagination.page - 1) * pagination.pageSize,
    limit: pagination.pageSize,
  };
}
