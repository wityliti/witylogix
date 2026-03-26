/**
 * Global error handler — catches all unhandled errors and returns structured responses.
 *
 * Responsibilities:
 * - Map known error types to HTTP status codes
 * - Log errors with request context
 * - Return structured error responses
 * - Strip sensitive data in production
 * - Handle Prisma-specific errors
 *
 * Error type mappings:
 * - ValidationError → 400
 * - UnauthorizedError → 401
 * - ForbiddenError → 403
 * - NotFoundError → 404
 * - ConflictError → 409
 * - RateLimitError → 429
 *
 * Prisma error mappings:
 * - P2002 (Unique constraint violation) → 409 Conflict
 * - P2025 (Record not found) → 404 Not Found
 */

import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from "../lib/errors.js";
import { isProd } from "../lib/config.js";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    statusCode?: number;
  };
}

/**
 * Map Prisma error codes to app errors
 */
function mapPrismaError(error: any): AppError {
  const code = error.code;

  // P2002 - Unique constraint violation
  if (code === "P2002") {
    const field = error.meta?.target?.[0];
    return new ConflictError(
      field ? `Resource with this ${field} already exists` : "Duplicate resource",
    );
  }

  // P2025 - Record not found in required relation
  if (code === "P2025") {
    return new NotFoundError("Resource not found");
  }

  // P2003 - Foreign key constraint violation
  if (code === "P2003") {
    return new AppError(
      "Cannot delete: related records exist",
      409,
      "FOREIGN_KEY_VIOLATION",
    );
  }

  // P2014 - Required relation violation
  if (code === "P2014") {
    return new AppError(
      "Required relation missing",
      422,
      "RELATION_ERROR",
    );
  }

  // Default Prisma error
  return new AppError(
    "Database operation failed",
    500,
    "DATABASE_ERROR",
  );
}

/**
 * Get HTTP status code from error
 */
function getStatusCode(error: any): number {
  // AppError subclasses have statusCode
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // Prisma errors
  if (error.code?.startsWith("P")) {
    const mapped = mapPrismaError(error);
    return mapped.statusCode;
  }

  // FastifyError has statusCode
  if ((error as FastifyError).statusCode) {
    return (error as FastifyError).statusCode ?? 500;
  }

  // Default to 500
  return 500;
}

/**
 * Build structured error response
 */
function buildErrorResponse(
  error: any,
  requestId?: string,
  includeStack: boolean = false,
): ErrorResponse {
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let statusCode = 500;
  let details: unknown = undefined;

  // Handle known error types
  if (error instanceof AppError) {
    code = error.code;
    message = error.message;
    statusCode = error.statusCode;
    details = error.details;
  } else if (error.code?.startsWith("P")) {
    // Prisma error
    const mapped = mapPrismaError(error);
    code = mapped.code;
    message = mapped.message;
    statusCode = mapped.statusCode;
  } else if ((error as FastifyError).statusCode) {
    // Fastify error (validation, not found, etc)
    statusCode = (error as FastifyError).statusCode ?? 500;
    message = error.message || "Request error";
    code = `HTTP_${statusCode}`;

    // Capture Fastify validation errors
    if ((error as any).validation) {
      code = "VALIDATION_ERROR";
      details = (error as any).validation;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      statusCode,
    },
  };

  if (requestId) {
    response.error.requestId = requestId;
  }

  if (details) {
    response.error.details = details;
  }

  // Include stack trace in development only
  if (includeStack && !isProd() && error instanceof Error && error.stack) {
    (response.error as any).stack = error.stack.split("\n");
  }

  return response;
}

/**
 * Global error handler plugin
 */
const errorHandlerPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    fastify.setErrorHandler(
      async (error: Error, request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const requestId = request.requestId || "unknown";
        const statusCode = getStatusCode(error);

        // Log error with request context
        const logData = {
          requestId,
          statusCode,
          method: request.method,
          url: request.url,
          ip: request.ip,
          error: {
            name: error.name,
            message: error.message,
            code: (error as any).code,
          },
        };

        // Log based on status code
        if (statusCode >= 500) {
          fastify.log.error(logData, "Server error");
        } else if (statusCode >= 400) {
          fastify.log.info(logData, "Client error");
        }

        // Build error response
        const errorResponse = buildErrorResponse(
          error,
          requestId,
          !isProd(), // Include stack trace in dev
        );

        // Handle rate limit error specially
        if (error instanceof RateLimitError) {
          reply.header("Retry-After", "60");
        }

        reply.code(statusCode).send(errorResponse);
      },
    );
  },
  {
    name: "error-handler",
  },
);

export default errorHandlerPlugin;
