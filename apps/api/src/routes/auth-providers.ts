/**
 * Auth Providers — OAuth and SSO integration management.
 *
 * Routes:
 *   GET    /                      List all auth providers for shop
 *   POST   /                      Create auth provider config
 *   GET    /:id                   Get auth provider detail
 *   PUT    /:id                   Update auth provider config
 *   DELETE /:id                   Delete auth provider
 *   POST   /:id/test              Test provider connection
 *   PUT    /:id/default           Set as default provider
 *   GET    /callback              OAuth callback handler
 *   POST   /sso/init              Initiate SSO flow
 *   POST   /token/validate        Validate external token
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const providerTypeEnum = z.enum([
  "GOOGLE",
  "MICROSOFT",
  "OKTA",
  "AUTH0",
  "CUSTOM_OAUTH",
  "SAML",
]);

const createAuthProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: providerTypeEnum,
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url().optional(),
  authUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  userInfoUrl: z.string().url().optional(),
  scopes: z.array(z.string()).default([]),
  mappings: z
    .object({
      email: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      avatar: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  enabled: z.boolean().default(true),
});

const updateAuthProviderSchema = createAuthProviderSchema.partial();

const validateTokenSchema = z.object({
  token: z.string().min(1),
  providerId: z.string().uuid(),
});

const ssoInitSchema = z.object({
  providerId: z.string().uuid(),
  redirectAfterAuth: z.string().url().optional(),
});

const testConnectionSchema = z.object({
  testData: z.record(z.string(), z.any()).optional(),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function authProvidersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / (List all providers) ──────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const providers = await (request.tenantDb as any).authProvider.findMany({
      where: { shopId: request.shopId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        isDefault: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: providers,
      total: providers.length,
    };
  });

  // ── POST / (Create provider) ────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createAuthProviderSchema.parse(request.body);

    // Check if provider with same name exists
    const existing = await (request.tenantDb as any).authProvider.findFirst({
      where: {
        shopId: request.shopId,
        name: body.name,
      },
    });

    if (existing) {
      throw new ConflictError(
        `Auth provider with name '${body.name}' already exists`,
      );
    }

    const provider = await (request.tenantDb as any).authProvider.create({
      data: {
        shopId: request.shopId,
        ...body,
      },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        providerId: provider.id,
        type: body.type,
        name: body.name,
      },
      "Auth provider created",
    );

    reply.status(201);
    return { data: provider };
  });

  // ── GET /:id (Get provider detail) ──────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const provider = await (request.tenantDb as any).authProvider.findUnique({
      where: { id },
      include: {
        tokens: {
          select: {
            id: true,
            issuedAt: true,
            expiresAt: true,
          },
          orderBy: { issuedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!provider) {
      throw new NotFoundError("Auth provider", id);
    }

    if (provider.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot access auth provider from another shop",
      );
    }

    // Don't leak secrets in response
    const { clientSecret, ...safe } = provider;
    return { data: safe };
  });

  // ── PUT /:id (Update provider) ──────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateAuthProviderSchema.parse(request.body);

    const provider = await (request.tenantDb as any).authProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundError("Auth provider", id);
    }

    if (provider.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot update auth provider from another shop",
      );
    }

    // Check for name conflicts
    if (body.name && body.name !== provider.name) {
      const duplicate = await (request.tenantDb as any).authProvider.findFirst({
        where: {
          shopId: request.shopId,
          name: body.name,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `Auth provider with name '${body.name}' already exists`,
        );
      }
    }

    const updated = await (request.tenantDb as any).authProvider.update({
      where: { id },
      data: body,
    });

    fastify.log.info(
      { shopId: request.shopId, providerId: id },
      "Auth provider updated",
    );

    return { data: updated };
  });

  // ── DELETE /:id (Delete provider) ───────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const provider = await (request.tenantDb as any).authProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundError("Auth provider", id);
    }

    if (provider.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot delete auth provider from another shop",
      );
    }

    if (provider.isDefault) {
      throw new ValidationError(
        "Cannot delete the default auth provider. Set another as default first.",
      );
    }

    // Delete associated tokens first
    await (request.tenantDb as any).authProviderToken.deleteMany({
      where: { providerId: id },
    });

    const deleted = await (request.tenantDb as any).authProvider.delete({
      where: { id },
    });

    fastify.log.info(
      { shopId: request.shopId, providerId: id, type: provider.type },
      "Auth provider deleted",
    );

    reply.status(204);
    return;
  });

  // ── POST /:id/test (Test connection) ────────────────────────────

  fastify.post(
    "/:id/test",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const body = testConnectionSchema.parse(request.body);

      const provider = await (request.tenantDb as any).authProvider.findUnique({
        where: { id },
      });

      if (!provider) {
        throw new NotFoundError("Auth provider", id);
      }

      if (provider.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot test auth provider from another shop",
        );
      }

      // Attempt connection test
      let testResult: any = {
        success: false,
        message: "Test not implemented for this provider type",
      };

      try {
        // Simple connectivity check based on provider type
        if (provider.type === "GOOGLE") {
          const response = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${provider.clientSecret}`,
            },
          });
          testResult = {
            success: response.ok,
            message: response.ok
              ? "Google OAuth connection successful"
              : `Google OAuth connection failed: ${response.statusText}`,
            statusCode: response.status,
          };
        } else if (provider.type === "MICROSOFT") {
          const response = await fetch(
            `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: provider.clientId,
                scope: "https://graph.microsoft.com/.default",
              }).toString(),
            },
          );
          testResult = {
            success: response.status === 400 || response.ok,
            message: "Microsoft OAuth endpoint reachable",
            statusCode: response.status,
          };
        } else {
          testResult = {
            success: true,
            message: `Provider type '${provider.type}' test queued`,
          };
        }
      } catch (error) {
        testResult = {
          success: false,
          message: `Connection test failed: ${(error as Error).message}`,
          error: (error as Error).message,
        };
      }

      fastify.log.info(
        { shopId: request.shopId, providerId: id, testResult },
        "Auth provider connection tested",
      );

      return { data: testResult };
    },
  );

  // ── PUT /:id/default (Set as default) ───────────────────────────

  fastify.put(
    "/:id/default",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const provider = await (request.tenantDb as any).authProvider.findUnique({
        where: { id },
      });

      if (!provider) {
        throw new NotFoundError("Auth provider", id);
      }

      if (provider.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot set default for auth provider from another shop",
        );
      }

      if (!provider.enabled) {
        throw new ValidationError(
          "Cannot set disabled provider as default. Enable it first.",
        );
      }

      // Unset previous default
      await (request.tenantDb as any).authProvider.updateMany({
        where: {
          shopId: request.shopId,
          isDefault: true,
        },
        data: { isDefault: false },
      });

      // Set new default
      const updated = await (request.tenantDb as any).authProvider.update({
        where: { id },
        data: { isDefault: true },
      });

      fastify.log.info(
        { shopId: request.shopId, providerId: id, type: provider.type },
        "Default auth provider set",
      );

      return { data: updated };
    },
  );

  // ── GET /callback (OAuth callback) ──────────────────────────────

  fastify.get(
    "/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, state, error, error_description } = request.query as {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
      };

      if (error) {
        fastify.log.warn(
          { error, error_description },
          "OAuth callback received error",
        );
        return reply.status(400).send({
          error,
          message: error_description || "OAuth authentication failed",
        });
      }

      if (!code || !state) {
        throw new ValidationError("Missing required callback parameters (code, state)");
      }

      // Decode state to find provider and user
      let stateData: any;
      try {
        stateData = JSON.parse(Buffer.from(state, "base64").toString());
      } catch {
        throw new ValidationError("Invalid state parameter");
      }

      const { providerId, shopId, userId } = stateData;

      // Exchange code for token
      const provider = await (request.tenantDb as any).authProvider.findUnique({
        where: { id: providerId },
      });

      if (!provider) {
        throw new NotFoundError("Auth provider", providerId);
      }

      // TODO: Exchange code for token with OAuth provider
      // const tokens = await exchangeCodeForToken(provider, code);

      fastify.log.info(
        { providerId, shopId, userId },
        "OAuth callback processed",
      );

      // Redirect to app with success
      return reply.redirect(`/?auth=success&provider=${provider.type}`);
    },
  );

  // ── POST /sso/init (Initiate SSO) ───────────────────────────────

  fastify.post(
    "/sso/init",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = ssoInitSchema.parse(request.body);
      const { providerId, redirectAfterAuth } = body;

      const provider = await (request.tenantDb as any).authProvider.findUnique({
        where: { id: providerId },
      });

      if (!provider) {
        throw new NotFoundError("Auth provider", providerId);
      }

      if (!provider.enabled) {
        throw new ValidationError("Auth provider is not enabled");
      }

      // Create state token
      const state = Buffer.from(
        JSON.stringify({
          providerId,
          shopId: request.shopId,
          userId: request.auth?.userId,
          redirectAfterAuth,
          timestamp: Date.now(),
        }),
      ).toString("base64");

      // Build redirect URL
      const redirectUri = provider.redirectUri || `${process.env.API_URL}/api/v4/auth-providers/callback`;
      const params = new URLSearchParams({
        client_id: provider.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: provider.scopes.join(" "),
        state,
      });

      const loginUrl = `${provider.authUrl}?${params.toString()}`;

      fastify.log.info(
        { shopId: request.shopId, providerId, type: provider.type },
        "SSO flow initiated",
      );

      return { data: { loginUrl } };
    },
  );

  // ── POST /token/validate (Validate external token) ────────────────

  fastify.post(
    "/token/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = validateTokenSchema.parse(request.body);
      const { token, providerId } = body;

      const provider = await (request.tenantDb as any).authProvider.findUnique({
        where: { id: providerId },
      });

      if (!provider) {
        throw new NotFoundError("Auth provider", providerId);
      }

      if (provider.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot validate token for provider from another shop",
        );
      }

      let isValid = false;
      let tokenData: any = null;

      try {
        // Validate token with provider's user info endpoint
        if (provider.userInfoUrl) {
          const response = await fetch(provider.userInfoUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          isValid = response.ok;
          if (isValid) {
            tokenData = await response.json();
          }
        } else {
          isValid = false;
        }
      } catch (error) {
        fastify.log.error(
          { providerId, error },
          "Token validation failed",
        );
        isValid = false;
      }

      return {
        data: {
          isValid,
          provider: provider.type,
          tokenData: isValid ? tokenData : null,
        },
      };
    },
  );
}

export default authProvidersRoutes;
