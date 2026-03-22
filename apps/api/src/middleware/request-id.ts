/**
 * Request ID middleware — generates or extracts request ID for correlation.
 *
 * - Checks for X-Request-ID header
 * - Generates UUID4 if missing
 * - Attaches to request object and reply headers
 * - Enables request correlation in logs
 *
 * Usage:
 * All logs for a request will be correlated via the requestId.
 * Trace distributed requests by searching for the requestId in logs.
 */

import { randomUUID } from "crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyPlugin from "fastify-plugin";

// Type augmentation is now centralized in types/fastify.d.ts

/**
 * Attach request ID to request and reply headers
 */
async function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Check for existing X-Request-ID header
  const headerRequestId = request.headers["x-request-id"];

  // Use existing or generate new UUID
  const requestId =
    typeof headerRequestId === "string"
      ? headerRequestId
      : Array.isArray(headerRequestId)
        ? headerRequestId[0]
        : randomUUID();

  // Attach to request
  request.requestId = requestId;

  // Set response header
  reply.header("X-Request-ID", requestId);
}

/**
 * Request ID plugin — automatically adds request ID to all requests
 */
const requestIdPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook("preHandler", requestIdMiddleware);
  },
  {
    name: "request-id",
  },
);

export default requestIdPlugin;
