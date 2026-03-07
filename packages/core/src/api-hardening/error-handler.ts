/**
 * API Error Handler — Standardized error handling for Fastify
 *
 * Provides:
 * - AppError base class with statusCode, code, message, details
 * - Specific error classes (NotFound, Validation, Conflict, Forbidden, Unauthorized, RateLimit, ServiceUnavailable)
 * - Fastify error handler plugin
 * - Centralized logging with request correlation IDs
 * - Prisma error mapping (P2002→Conflict, P2025→NotFound)
 * - Zod validation error extraction with field-level details
 * - Consistent JSON error response format
 *
 * Usage:
 *   await fastify.register(errorHandlerPlugin);
 *   throw new ValidationError('Invalid input', { email: 'Invalid email format' });
 */

type FastifyInstance = any;
type FastifyRequest = any;
type FastifyReply = any;

/**
 * Base application error class
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Validation failed
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(404, 'NOT_FOUND', message, details);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(503, 'SERVICE_UNAVAILABLE', message, details);
  }
}

/**
 * Extract field-level error details from Zod validation errors
 */
function extractZodErrors(error: any): Record<string, unknown> {
  const fieldErrors: Record<string, unknown> = {};

  error.errors.forEach((err: any) => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    (fieldErrors[path] as string[]).push(err.message);
  });

  return fieldErrors;
}

/**
 * Map Prisma error codes to AppError subclasses
 */
function handlePrismaError(error: any): AppError {
  // P2002: Unique constraint failed
  if (error.code === 'P2002') {
    const fields = error.meta?.target || ['unknown'];
    return new ConflictError(
      `Resource with these field values already exists: ${fields.join(', ')}`,
      { conflictingFields: fields }
    );
  }

  // P2025: Record not found
  if (error.code === 'P2025') {
    return new NotFoundError(error.meta?.cause || 'Resource not found', {
      prismaCode: 'P2025',
    });
  }

  // P2014: Required relation violated
  if (error.code === 'P2014') {
    return new ConflictError(
      'Cannot perform operation due to related records',
      { prismaCode: 'P2014' }
    );
  }

  // P2011: Null constraint failed
  if (error.code === 'P2011') {
    return new ValidationError(
      'Required field is missing',
      { prismaCode: 'P2011' }
    );
  }

  // Generic Prisma error
  return new AppError(
    500,
    'DATABASE_ERROR',
    'An error occurred while processing your request',
    { prismaCode: error.code }
  );
}

/**
 * Check if error is a Zod validation error
 */
function isZodError(error: any): boolean {
  return error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors);
}

/**
 * Fastify error handler plugin
 *
 * Catches and standardizes all errors, returning consistent JSON responses
 */
export async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error: any, request: any, reply: any) => {
    const requestId = request.id || 'unknown';

    let appError: AppError;

    // Handle Zod validation errors
    if (isZodError(error)) {
      const fieldErrors = extractZodErrors(error);
      appError = new ValidationError(
        'Request validation failed',
        fieldErrors
      );
    }
    // Handle Prisma errors
    else if (error.code && error.code.startsWith('P')) {
      appError = handlePrismaError(error);
    }
    // Handle our custom AppError
    else if (error instanceof AppError) {
      appError = error;
    }
    // Handle native errors with status codes (HTTP errors from other middleware)
    else if ('statusCode' in error && typeof error.statusCode === 'number') {
      appError = new AppError(
        error.statusCode,
        'HTTP_ERROR',
        error.message || 'An error occurred',
        {}
      );
    }
    // Default to 500 Internal Server Error
    else {
      appError = new AppError(
        500,
        'INTERNAL_SERVER_ERROR',
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        {}
      );
    }

    // Log the error with correlation ID
    const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
    fastify.log[logLevel](
      {
        requestId,
        code: appError.code,
        statusCode: appError.statusCode,
        message: appError.message,
        details: appError.details,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        path: request.url,
        method: request.method,
      },
      `${appError.code} - ${appError.message}`
    );

    // Build error response
    const errorResponse: any = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId,
      },
    };

    // Include details in development or when explicitly provided
    if (appError.details && Object.keys(appError.details).length > 0) {
      errorResponse.error.details = appError.details;
    }

    // Send response
    reply.code(appError.statusCode).send(errorResponse);
  });
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
