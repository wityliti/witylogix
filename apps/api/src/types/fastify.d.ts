/**
 * Comprehensive Fastify type augmentation for Witylogix API.
 *
 * This file consolidates all Fastify interface extensions:
 * - FastifyRequest: auth, session, tenantDb, tenantRedis, shopId, orgId, tenantId, etc.
 * - FastifyInstance: db, decorators, plugins, etc.
 *
 * All middleware and plugins contribute to these extended interfaces.
 */

import type { FastifyInstance } from "fastify";
import type { forTenant, forOrg, prisma } from "@witylogix/db";
import type { TenantRedis } from "../lib/redis.js";
import type { EventWebhookBridge } from "@witylogix/core/webhooks";
import type { TypedEventBus } from "@witylogix/core/event-bus";

// ──────────────────────────────────────────────────────────────────────────
// Authentication & Authorization Context
// ──────────────────────────────────────────────────────────────────────────

/**
 * Authentication context extracted from JWT or session token.
 * Set by requireAuth middleware.
 */
export interface AuthContext {
  shopId: string;
  orgId?: string; // Set when user belongs to an org
  userId?: string;
  driverId?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "VIEWER" | "DRIVER";
  orgRole?: "OWNER" | "ADMIN" | "MEMBER"; // Org-level role (if in org context)
  shopDomain?: string;
}

/**
 * Session context for alternative auth flows (e.g., OAuth, device auth).
 */
export interface SessionContext {
  userId: string;
  shopId: string;
  role: string;
  expiresAt?: Date;
}

// ──────────────────────────────────────────────────────────────────────────
// Fastify Request Augmentation
// ──────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Authentication context (set by requireAuth middleware).
     * Contains user identity, shop/org context, and role information.
     */
    auth: AuthContext;

    /**
     * Optional session context for alternative auth flows.
     */
    session?: SessionContext;

    /**
     * Tenant ID — typically the shop ID.
     * Alias for shopId, set by tenantContext middleware.
     */
    tenantId?: string;

    /**
     * Shop ID — the tenant identifier.
     * Set by tenantContext middleware from auth.shopId.
     */
    shopId: string;

    /**
     * Organization ID — set if user belongs to an organization.
     * Set by requireAuth or tenantContext middleware.
     */
    orgId?: string;

    /**
     * Tenant-scoped Prisma client configured for RLS.
     * Shop-only or dual-scoped (shop + org) depending on context.
     * Set by tenantContext middleware.
     */
    tenantDb: ReturnType<typeof forTenant>;

    /**
     * Organization-scoped Prisma client for cross-shop queries.
     * Only available after orgContext middleware.
     */
    orgDb?: ReturnType<typeof forOrg>;

    /**
     * Tenant-scoped Redis client with shop-prefixed keys.
     * Set by tenantContext middleware.
     */
    tenantRedis: TenantRedis;

    /**
     * Unique request ID for correlation and tracing.
     * Set by requestId middleware.
     */
    requestId: string;

    /**
     * Raw request body buffer for webhook HMAC verification.
     * Set by raw-body plugin for JSON requests.
     */
    rawBody?: Buffer;

    /**
     * Request start time in milliseconds (process.hrtime.bigint()).
     * Set by request-logger middleware.
     */
    startTime?: number;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Fastify Instance Augmentation
// ──────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Primary Prisma client for schema migrations and admin operations.
     * Not RLS-scoped; use request.tenantDb for data queries.
     */
    db: typeof prisma;

    /**
     * Global event bus for pub/sub across the application.
     * Set by event-bus plugin.
     */
    eventBus: TypedEventBus<any>;

    /**
     * Event webhook bridge for managing webhooks and subscriptions.
     * Set by event-webhook-bridge plugin.
     */
    eventWebhookBridge: EventWebhookBridge;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────────────────────────────────

export type { AuthContext, SessionContext };
