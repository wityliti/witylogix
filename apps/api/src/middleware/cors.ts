/**
 * CORS configuration for Fastify.
 *
 * Configuration:
 * - Allowed origins from CORS_ORIGINS env (comma-separated)
 * - Default origins: localhost:3000-3010, *.myshopify.com
 * - Expose headers: X-Request-ID, X-RateLimit-*
 * - Credentials: allowed
 * - Max age: 86400 (24 hours)
 *
 * Environment:
 * CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://myapp.example.com
 */

import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import fastifyCors from "@fastify/cors";
import { getConfig } from "../lib/config.js";

/**
 * Parse CORS origins from environment or use defaults
 */
function getCorsOrigins(): string[] {
  const { NODE_ENV } = getConfig();
  const envOrigins = process.env.CORS_ORIGINS;

  if (envOrigins) {
    return envOrigins.split(",").map((origin) => origin.trim());
  }

  // Default origins
  const defaultOrigins = [
    // Local development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3004",
    "http://localhost:3005",
    "http://localhost:3006",
    "http://localhost:3007",
    "http://localhost:3008",
    "http://localhost:3009",
    "http://localhost:3010",

    // Shopify admin
    "*.myshopify.com",
  ];

  // In production, require explicit CORS configuration — do not fall back to localhost origins.
  if (NODE_ENV === "production") {
    throw new Error(
      "CORS_ORIGINS env var must be set in production. Example: CORS_ORIGINS=https://app.example.com,https://admin.example.com",
    );
  }

  return defaultOrigins;
}

/**
 * CORS plugin with sensible defaults
 */
const corsPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    const origins = getCorsOrigins();

    await fastify.register(fastifyCors, {
      origin: origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-API-Key",
        "X-Shopify-Hmac-SHA256",
        "X-Shopify-Shop-Domain",
        "X-Shopify-Topic",
        "Accept",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
        "Content-Type",
      ],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
    });
  },
  {
    name: "cors",
  },
);

export default corsPlugin;
