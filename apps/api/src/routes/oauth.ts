// @ts-nocheck
/**
 * OAuth2 App Platform routes (ADR-029).
 *
 * Implements the authorization-code + PKCE grant for third-party apps:
 *   GET  /api/v4/oauth/authorize       Validate + hand off to dashboard consent
 *   POST /api/v4/oauth/consent         Dashboard calls this to issue a code
 *   POST /api/v4/oauth/token           Exchange code / refresh for tokens
 *   POST /api/v4/oauth/revoke          RFC 7009 token revocation
 *
 * Plus developer-facing client management (role-gated to dashboard admins):
 *   GET    /api/v4/oauth/clients
 *   POST   /api/v4/oauth/clients
 *   GET    /api/v4/oauth/clients/:id
 *   PATCH  /api/v4/oauth/clients/:id
 *   DELETE /api/v4/oauth/clients/:id           (soft-delete / suspend)
 *   POST   /api/v4/oauth/clients/:id/rotate-secret
 *
 * Plus tenant-facing install management (role-gated to dashboard admins):
 *   GET    /api/v4/oauth/installations
 *   DELETE /api/v4/oauth/installations/:id
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import {
  OAuthError,
  OAUTH_SCOPES,
  ALL_OAUTH_SCOPES,
  exchangeCodeForTokens,
  installApp,
  isValidScope,
  issueAuthorizationCode,
  refreshAccessToken,
  registerClient,
  revokeInstallation,
  rotateClientSecret,
  subtractScopes,
} from "@witylogix/core/oauth";
import { requireAuth } from "../middleware/auth.js";
import { getConfig } from "../lib/config.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../lib/errors.js";

// ─── Helpers ────────────────────────────────────────────────

function sendOAuthError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof OAuthError) {
    return reply.code(err.status).send({
      error: err.code,
      error_description: err.description,
    });
  }
  throw err;
}

function parseScopeList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\s,]+/).filter(Boolean);
}

// ─── Zod Schemas ────────────────────────────────────────────

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().uuid(),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
});

const consentBodySchema = z.object({
  clientId: z.string().uuid(),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([]),
  state: z.string().optional(),
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal("S256"),
});

const tokenBodySchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string(),
    redirect_uri: z.string().url(),
    client_id: z.string().uuid(),
    client_secret: z.string().optional(),
    code_verifier: z.string().min(43).max(128),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string(),
    client_id: z.string().uuid(),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  }),
]);

const revokeBodySchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});

const registerClientSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).min(1).max(10),
  allowedScopes: z.array(z.string()).min(1),
  clientType: z.enum(["CONFIDENTIAL", "PUBLIC"]).default("CONFIDENTIAL"),
});

const updateClientSchema = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).nullable(),
    logoUrl: z.string().url().nullable(),
    homepageUrl: z.string().url().nullable(),
    redirectUris: z.array(z.string().url()).min(1).max(10),
    allowedScopes: z.array(z.string()).min(1),
  })
  .partial();

// ─── Route Plugin ───────────────────────────────────────────

async function oauthRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  // ─── /authorize ───────────────────────────────────────
  // Unauthenticated — the dashboard UI handles the user session.
  // We validate params, then 302 into the dashboard consent page.
  fastify.get("/authorize", async (request, reply) => {
    const parsed = authorizeQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        error_description:
          parsed.error.issues[0]?.message ?? "Invalid authorize params",
      });
    }
    const q = parsed.data;

    const client = await prisma.oAuthClient.findUnique({
      where: { id: q.client_id },
    });
    if (!client || client.status !== "ACTIVE") {
      return reply.code(404).send({
        error: "invalid_client",
        error_description: "Unknown or suspended client",
      });
    }
    if (!client.redirectUris.includes(q.redirect_uri)) {
      return reply.code(400).send({
        error: "invalid_request",
        error_description: "redirect_uri is not registered for this client",
      });
    }

    const requestedScopes = parseScopeList(q.scope);
    const unknown = requestedScopes.filter((s) => !isValidScope(s));
    if (unknown.length > 0) {
      return reply.code(400).send({
        error: "invalid_scope",
        error_description: `Unknown scopes: ${unknown.join(", ")}`,
      });
    }
    const disallowed = subtractScopes(requestedScopes, client.allowedScopes);
    if (disallowed.length > 0) {
      return reply.code(400).send({
        error: "invalid_scope",
        error_description: `Scopes not allowed for this client: ${disallowed.join(", ")}`,
      });
    }

    const dashParams = new URLSearchParams({
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      scope: requestedScopes.join(" "),
      code_challenge: q.code_challenge,
      code_challenge_method: q.code_challenge_method,
    });
    if (q.state) dashParams.set("state", q.state);

    return reply.redirect(
      `${config.DASHBOARD_URL}/apps/authorize?${dashParams.toString()}`,
    );
  });

  // ─── /consent ─────────────────────────────────────────
  // Called by the dashboard after the operator approves the install.
  // Creates / updates the AppInstallation and issues an authorization
  // code bound to the PKCE challenge. Returns a redirect URL that the
  // dashboard navigates to so the 3P app receives the code.
  fastify.post(
    "/consent",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply) => {
      const auth = request.auth!;
      if (auth.role === "APP") {
        throw new ForbiddenError("Apps cannot grant consent");
      }
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can install apps");
      }
      if (!auth.orgId || !auth.userId) {
        throw new ForbiddenError("Org context required to install apps");
      }

      const parsed = consentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message ?? "Invalid consent body",
        );
      }
      const body = parsed.data;

      const client = await prisma.oAuthClient.findUnique({
        where: { id: body.clientId },
      });
      if (!client || client.status !== "ACTIVE") {
        throw new NotFoundError("Unknown or suspended client");
      }
      if (!client.redirectUris.includes(body.redirectUri)) {
        throw new BadRequestError(
          "redirect_uri is not registered for this client",
        );
      }

      try {
        const installation = await installApp({
          clientId: client.id,
          orgId: auth.orgId,
          shopId: auth.shopId,
          scopes: body.scopes,
          installedBy: auth.userId,
        });
        const code = await issueAuthorizationCode({
          installationId: installation.id,
          redirectUri: body.redirectUri,
          scopes: body.scopes,
          codeChallenge: body.codeChallenge,
          codeChallengeMethod: body.codeChallengeMethod,
        });

        const params = new URLSearchParams({ code });
        if (body.state) params.set("state", body.state);
        const redirectTo = `${body.redirectUri}${body.redirectUri.includes("?") ? "&" : "?"}${params.toString()}`;

        return reply.send({ redirectTo, installationId: installation.id });
      } catch (err) {
        return sendOAuthError(reply, err);
      }
    },
  );

  // ─── /token ───────────────────────────────────────────
  fastify.post("/token", async (request, reply) => {
    const parsed = tokenBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        error_description:
          parsed.error.issues[0]?.message ?? "Invalid token body",
      });
    }
    const body = parsed.data;

    try {
      const tokens =
        body.grant_type === "authorization_code"
          ? await exchangeCodeForTokens({
              code: body.code,
              clientId: body.client_id,
              clientSecret: body.client_secret,
              redirectUri: body.redirect_uri,
              codeVerifier: body.code_verifier,
            })
          : await refreshAccessToken({
              refreshToken: body.refresh_token,
              clientId: body.client_id,
              clientSecret: body.client_secret,
              scope: body.scope,
            });

      return reply.send({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
        installation_id: tokens.installationId,
      });
    } catch (err) {
      return sendOAuthError(reply, err);
    }
  });

  // ─── /revoke ──────────────────────────────────────────
  fastify.post("/revoke", async (request, reply) => {
    const parsed = revokeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        error_description: "token is required",
      });
    }
    const tokenHash = createHash("sha256")
      .update(parsed.data.token)
      .digest("hex");
    const now = new Date();
    await prisma.$transaction([
      prisma.oAuthAccessToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.oAuthRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    return reply.code(200).send({ revoked: true });
  });

  // ─── /scopes (public metadata) ────────────────────────
  fastify.get("/scopes", async (_request, reply) => {
    return reply.send({
      scopes: ALL_OAUTH_SCOPES.map((s) => ({
        name: s,
        description: OAUTH_SCOPES[s],
      })),
    });
  });

  // ─── Developer: /clients ──────────────────────────────
  fastify.get(
    "/clients",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can manage OAuth clients");
      }
      const clients = await prisma.oAuthClient.findMany({
        where: { ownerUserId: auth.userId! },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          homepageUrl: true,
          redirectUris: true,
          allowedScopes: true,
          clientType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.send({ clients });
    },
  );

  fastify.post(
    "/clients",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can register OAuth clients");
      }
      if (!auth.userId) throw new ForbiddenError("User context required");

      const parsed = registerClientSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message ?? "Invalid client body",
        );
      }
      try {
        const result = await registerClient({
          ...parsed.data,
          ownerUserId: auth.userId,
        });
        return reply.code(201).send({
          client: {
            id: result.client.id,
            name: result.client.name,
            description: result.client.description,
            logoUrl: result.client.logoUrl,
            homepageUrl: result.client.homepageUrl,
            redirectUris: result.client.redirectUris,
            allowedScopes: result.client.allowedScopes,
            clientType: result.client.clientType,
            status: result.client.status,
          },
          // Plaintext secret — shown once, never persisted.
          clientSecret: result.clientSecret,
        });
      } catch (err) {
        return sendOAuthError(reply, err);
      }
    },
  );

  fastify.post(
    "/clients/:id/rotate-secret",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can rotate client secrets");
      }
      const { id } = request.params as { id: string };
      const client = await prisma.oAuthClient.findUnique({ where: { id } });
      if (!client) throw new NotFoundError("Client not found");
      if (client.ownerUserId !== auth.userId && auth.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("You do not own this client");
      }
      try {
        const secret = await rotateClientSecret(id);
        return reply.send({ clientSecret: secret });
      } catch (err) {
        return sendOAuthError(reply, err);
      }
    },
  );

  fastify.get(
    "/clients/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can view OAuth clients");
      }
      const { id } = request.params as { id: string };
      const client = await prisma.oAuthClient.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          homepageUrl: true,
          redirectUris: true,
          allowedScopes: true,
          clientType: true,
          status: true,
          secretPrefix: true,
          ownerUserId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!client) throw new NotFoundError("Client not found");
      if (client.ownerUserId !== auth.userId && auth.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("You do not own this client");
      }
      return reply.send({ client });
    },
  );

  fastify.patch(
    "/clients/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can update OAuth clients");
      }
      const { id } = request.params as { id: string };
      const client = await prisma.oAuthClient.findUnique({ where: { id } });
      if (!client) throw new NotFoundError("Client not found");
      if (client.ownerUserId !== auth.userId && auth.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("You do not own this client");
      }

      const parsed = updateClientSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message ?? "Invalid update body",
        );
      }
      const patch = parsed.data;

      if (patch.allowedScopes) {
        const unknown = patch.allowedScopes.filter((s) => !isValidScope(s));
        if (unknown.length > 0) {
          throw new BadRequestError(`Unknown scopes: ${unknown.join(", ")}`);
        }
      }

      const updated = await prisma.oAuthClient.update({
        where: { id },
        data: patch,
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          homepageUrl: true,
          redirectUris: true,
          allowedScopes: true,
          clientType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.send({ client: updated });
    },
  );

  // Soft-delete: marks client SUSPENDED and revokes live installations.
  // We do not hard-delete because access tokens and audit records reference it.
  fastify.delete(
    "/clients/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can suspend OAuth clients");
      }
      const { id } = request.params as { id: string };
      const client = await prisma.oAuthClient.findUnique({
        where: { id },
        include: {
          installations: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      });
      if (!client) throw new NotFoundError("Client not found");
      if (client.ownerUserId !== auth.userId && auth.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("You do not own this client");
      }

      await prisma.oAuthClient.update({
        where: { id },
        data: { status: "SUSPENDED" },
      });
      for (const inst of client.installations) {
        await revokeInstallation(inst.id);
      }
      return reply.code(204).send();
    },
  );

  // ─── Tenant: /installations ───────────────────────────
  fastify.get(
    "/installations",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role === "APP")
        throw new ForbiddenError("Apps cannot list installations");
      if (!auth.orgId) throw new ForbiddenError("Org context required");

      const installations = await prisma.appInstallation.findMany({
        where: { orgId: auth.orgId, status: "ACTIVE" },
        orderBy: { installedAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              description: true,
              logoUrl: true,
              homepageUrl: true,
            },
          },
        },
      });
      return reply.send({ installations });
    },
  );

  fastify.delete(
    "/installations/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (auth.role !== "SUPER_ADMIN" && auth.role !== "ADMIN") {
        throw new ForbiddenError("Only admins can uninstall apps");
      }
      const { id } = request.params as { id: string };
      const installation = await prisma.appInstallation.findUnique({
        where: { id },
      });
      if (!installation) throw new NotFoundError("Installation not found");
      if (installation.orgId !== auth.orgId) {
        throw new ForbiddenError("Installation belongs to another org");
      }
      await revokeInstallation(id);
      return reply.code(204).send();
    },
  );
}

export default oauthRoutes;
