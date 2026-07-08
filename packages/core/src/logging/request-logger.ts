/**
 * Fastify Request Logger Plugin
 * Auto-generates request/response logs with tracing, timing, and error handling
 * Redacts sensitive HTTP headers (Authorization, Cookie)
 * Warns about slow requests (>5s)
 */

import { randomUUID } from "crypto";
import { Logger } from "./logger.js";
import { RequestContext, SENSITIVE_HEADERS } from "./types.js";

/**
 * Slow request threshold in milliseconds (5 seconds)
 */
const SLOW_REQUEST_THRESHOLD_MS = 5000;

/**
 * Fastify request object type (minimal interface)
 */
interface FastifyRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: {
    id?: string;
    tenantId?: string;
  };
}

/**
 * Fastify reply object type (minimal interface)
 */
interface FastifyReply {
  statusCode: number;
  header: (name: string, value: string) => FastifyReply;
}

/**
 * Fastify instance type (minimal interface)
 */
interface FastifyInstance {
  addHook(
    hookName: string,
    handler: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void> | void,
  ): void;
}

/**
 * Create a Fastify plugin for request/response logging
 * Hooks into preHandler and onResponse to capture full request lifecycle
 */
export function createRequestLoggerPlugin(logger: Logger) {
  return async function requestLoggerPlugin(fastify: FastifyInstance) {
    // Pre-handler hook: capture request start and generate trace ID
    fastify.addHook(
      "preHandler",
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Generate or extract trace ID from request headers
        const traceId =
          (request.headers["x-request-id"] as string) || randomUUID();

        // Store request context on request object for later retrieval
        (request as any).requestContext = {
          traceId,
          spanId: request.headers["x-span-id"] as string,
          tenantId: request.user?.tenantId,
          userId: request.user?.id,
          method: request.method,
          path: request.url.split("?")[0], // Remove query string
          startTime: Date.now(),
        } as RequestContext;

        // Send trace ID back in response header
        reply.header("x-request-id", traceId);
      },
    );

    // OnResponse hook: log request/response details
    fastify.addHook(
      "onResponse",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const requestContext = (request as any).requestContext as
          | RequestContext
          | undefined;
        if (!requestContext) return;

        const duration = Date.now() - requestContext.startTime;
        const requestLogger = logger.withContext(requestContext);

        // Extract safe headers for logging (redact sensitive ones)
        const safeHeaders = this.extractSafeHeaders(request.headers);

        // Determine log level based on status code
        const statusCode = reply.statusCode;
        const isError = statusCode >= 400;

        const logMetadata = {
          method: request.method,
          path: requestContext.path,
          statusCode,
          duration,
          ip: request.ip,
          ...(Object.keys(safeHeaders).length > 0 && { headers: safeHeaders }),
        };

        if (isError) {
          requestLogger.warn(
            `HTTP ${statusCode} ${request.method} ${requestContext.path}`,
            logMetadata,
          );
        } else {
          requestLogger.info(
            `${request.method} ${requestContext.path}`,
            logMetadata,
          );
        }

        // Warn about slow requests
        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          requestLogger.warn(`Slow request detected: ${duration}ms`, {
            slowRequest: true,
            duration,
            threshold: SLOW_REQUEST_THRESHOLD_MS,
          });
        }
      },
    );
  };
}

/**
 * Extract safe (non-sensitive) headers for logging
 * Redacts Authorization, Cookie, Set-Cookie, and X-API-Key headers
 */
function extractSafeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const safeHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Skip sensitive headers
    if (isSensitiveHeader(key)) {
      continue;
    }

    // Skip noisy headers
    if (shouldSkipHeader(key)) {
      continue;
    }

    if (typeof value === "string") {
      safeHeaders[key] = value;
    } else if (Array.isArray(value)) {
      safeHeaders[key] = value.join("; ");
    }
  }

  return safeHeaders;
}

/**
 * Check if header should be redacted due to sensitivity
 */
function isSensitiveHeader(headerName: string): boolean {
  const lowerName = headerName.toLowerCase();
  return SENSITIVE_HEADERS.some((sensitive) => lowerName.includes(sensitive));
}

/**
 * Check if header should be skipped (too noisy for logs)
 */
function shouldSkipHeader(headerName: string): boolean {
  const lowerName = headerName.toLowerCase();
  const noisyHeaders = [
    "user-agent",
    "accept",
    "accept-encoding",
    "accept-language",
    "cache-control",
    "sec-",
    "content-type",
  ];

  return noisyHeaders.some((noisy) => lowerName.includes(noisy));
}

/**
 * Attach request context to a logger
 * Useful for manually creating contextualized loggers outside of request handlers
 */
export function attachRequestContext(
  logger: Logger,
  requestContext: RequestContext,
): Logger {
  return logger.withContext(requestContext);
}

/**
 * Generate a new trace ID (UUID v4)
 * Can be used to manually create request contexts
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Extract request context from a Fastify request object
 * Returns the context created by the request logger plugin
 */
export function getRequestContext(
  request: FastifyRequest,
): RequestContext | undefined {
  return (request as any).requestContext;
}
