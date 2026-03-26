/**
 * Security headers middleware for Fastify.
 *
 * Sets production-grade security headers:
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - X-Frame-Options: DENY or SAMEORIGIN (clickjacking protection)
 * - X-XSS-Protection: 1; mode=block (legacy XSS protection)
 * - Strict-Transport-Security: max-age=... (HSTS)
 * - Content-Security-Policy: configurable (optional)
 * - Referrer-Policy: strict-no-referrer (privacy)
 * - Permissions-Policy: restrictive defaults (feature control)
 *
 * Environment:
 * - ENABLE_HSTS: "true" | "false" (default: true)
 * - HSTS_MAX_AGE: seconds (default: 31536000 = 1 year)
 * - ENABLE_CSP: "true" | "false" (default: false for embedded iframes)
 * - ENABLE_FRAMEGUARD: "true" | "false" (default: true)
 */

import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { getConfig, isDev } from "../lib/config.js";

interface SecurityHeadersConfig {
  enableHSTS: boolean;
  hstsMaxAge: number;
  enableCSP: boolean;
  enableFrameguard: boolean;
}

/**
 * Get security headers configuration from environment
 */
function getSecurityConfig(): SecurityHeadersConfig {
  const config = getConfig();

  return {
    enableHSTS: config.ENABLE_HSTS,
    hstsMaxAge: config.HSTS_MAX_AGE,
    enableCSP: config.ENABLE_CSP,
    enableFrameguard: config.ENABLE_FRAMEGUARD,
  };
}

/**
 * Security headers plugin
 */
const securityHeadersPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    const secConfig = getSecurityConfig();

    // Register onSend hook to add security headers to all responses
    fastify.addHook("onSend", (request, reply, payload, done) => {
      // X-Content-Type-Options: Prevent MIME sniffing
      reply.header("X-Content-Type-Options", "nosniff");

      // X-Frame-Options: Prevent clickjacking
      if (secConfig.enableFrameguard) {
        reply.header("X-Frame-Options", "SAMEORIGIN");
      }

      // X-XSS-Protection: Legacy but still useful
      reply.header("X-XSS-Protection", "1; mode=block");

      // Referrer-Policy: Privacy-first
      reply.header("Referrer-Policy", "strict-no-referrer");

      // Permissions-Policy: Restrictive defaults
      // Disable geolocation, microphone, camera, payment request, etc.
      reply.header(
        "Permissions-Policy",
        [
          "geolocation=()",
          "microphone=()",
          "camera=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
        ].join(", "),
      );

      // Strict-Transport-Security: HSTS for HTTPS enforcement
      if (secConfig.enableHSTS && !isDev()) {
        reply.header(
          "Strict-Transport-Security",
          `max-age=${secConfig.hstsMaxAge}; includeSubDomains`,
        );
      }

      // Content-Security-Policy: Optional, stricter in production
      if (secConfig.enableCSP && !isDev()) {
        // Relaxed CSP for Shopify embedded iframe
        reply.header(
          "Content-Security-Policy",
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' *.shopify.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' *.shopify.com",
            "frame-ancestors 'self' *.shopify.com",
          ].join("; "),
        );
      }

      done(null, payload);
    });
  },
  {
    name: "security-headers",
  },
);

export default securityHeadersPlugin;
