/**
 * Witylogix API Server
 *
 * Production-grade Fastify 5 server with:
 * - Plugin-based architecture (cors, helmet, jwt, rate-limit, raw-body, error-handler)
 * - Versioned API routes under /api/v4
 * - Socket.io real-time events
 * - BullMQ background job processing
 * - Graceful shutdown with connection draining
 */
import "dotenv/config";
import { type FastifyInstance } from "fastify";
export declare function buildServer(): Promise<FastifyInstance>;
//# sourceMappingURL=server.d.ts.map
