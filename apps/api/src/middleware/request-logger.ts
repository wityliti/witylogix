/**
 * Request logging middleware — structured JSON logging with redaction.
 *
 * Features:
 * - Structured logging: method, url, status, duration, tenantId, userId
 * - Request ID generation and propagation via X-Request-Id header
 * - Sensitive field redaction (password, token, secret in body/headers)
 * - Slow request warning (>2s)
 * - Fastify onRequest + onResponse hooks
 *
 * Log format:
 * {
 *   "requestId": "uuid",
 *   "method": "POST",
 *   "url": "/api/routes",
 *   "statusCode": 200,
 *   "durationMs": 145,
 *   "tenantId": "shop_123",
 *   "userId": "user_456",
 *   "ip": "192.168.1.1",
 *   "isSlow": false
 * }
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { randomUUID } from "crypto";

// ─── Types ──────────────────────────────────────────────────

interface RequestStartTime {
  startTime: number;
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    startTime?: number;
  }
}

// ─── Sensitive Field Redaction ──────────────────────────────

/**
 * List of field names to redact from logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "creditCard",
  "credit_card",
  "cvv",
  "ssn",
  "otp",
];

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitiveData(obj: any, depth: number = 0): any {
  // Prevent deep recursion
  if (depth > 10) return "[depth exceeded]";

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if this is a sensitive field
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// ─── Request Logger Middleware ──────────────────────────────

/**
 * onRequest hook — initialize request tracking
 */
async function onRequestHook(request: FastifyRequest): Promise<void> {
  // Check for existing X-Request-ID header
  const headerRequestId = request.headers["x-request-id"];

  // Use existing or generate new UUID
  const requestId =
    typeof headerRequestId === "string"
      ? headerRequestId
      : Array.isArray(headerRequestId)
        ? headerRequestId[0]
        : randomUUID();

  request.requestId = requestId;
  request.startTime = Date.now();
}

/**
 * onResponse hook — log request completion
 */
async function onResponseHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const startTime = request.startTime || Date.now();
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const isSlow = durationMs > 2000;

  // Extract context from request
  const tenantId = (request as any).shopId || (request as any).auth?.shopId;
  const userId = (request as any).auth?.userId;
  const orgId = (request as any).orgId || (request as any).auth?.orgId;

  // Build log structure
  const logData: Record<string, any> = {
    requestId: request.requestId,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    durationMs,
    ip: request.ip,
  };

  // Add auth context if available
  if (tenantId) {
    logData.tenantId = tenantId;
  }

  if (userId) {
    logData.userId = userId;
  }

  if (orgId) {
    logData.orgId = orgId;
  }

  // Add slow request indicator
  if (isSlow) {
    logData.isSlow = true;
  }

  // Log based on response status code
  const statusCode = reply.statusCode;

  if (statusCode >= 500) {
    request.log.error(logData, "Server error");
  } else if (statusCode >= 400) {
    request.log.warn(logData, "Client error");
  } else if (isSlow) {
    request.log.warn(logData, "Slow request");
  } else {
    request.log.info(logData, "Request completed");
  }
}

// ─── Plugin ────────────────────────────────────────────────

/**
 * Request logger plugin — automatically logs all requests with proper timing
 */
const requestLoggerPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    // onRequest hook runs first, before authentication
    fastify.addHook("onRequest", onRequestHook);

    // onResponse hook runs last, after all processing
    fastify.addHook("onResponse", onResponseHook);
  },
  {
    name: "request-logger",
  },
);

export default requestLoggerPlugin;

export { redactSensitiveData };
