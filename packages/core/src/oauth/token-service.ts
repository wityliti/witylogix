/**
 * OAuth Token Service
 *
 * Implements the authorization-code + PKCE flow described in
 * ADR-029. Access and refresh tokens are opaque random strings,
 * SHA-256 hashed at rest, with a short prefix stored alongside the
 * hash for fast lookup (same pattern as `api-key-service`).
 *
 * Error codes mirror RFC 6749 §5.2 so callers can build OAuth-
 * compliant error responses without mapping strings.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@witylogix/db";
import { isValidScope, subtractScopes } from "./scopes.js";

// Lightweight shapes for models not yet re-exported from @witylogix/db.
// Kept aligned with prisma/schema/68-oauth.prisma.
export type OAuthClientRow = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  homepageUrl: string | null;
  clientType: "CONFIDENTIAL" | "PUBLIC";
  redirectUris: string[];
  allowedScopes: string[];
  clientSecretHash: string | null;
  secretPrefix: string | null;
  ownerUserId: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
};

export type AppInstallationRow = {
  id: string;
  oauthClientId: string;
  orgId: string;
  shopId: string | null;
  scopes: string[];
  installedBy: string;
  installedAt: Date;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  revokedAt: Date | null;
  webhookUrl: string | null;
  metadata: unknown;
};

export type OAuthAccessTokenRow = {
  id: string;
  installationId: string;
  tokenHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

const ACCESS_TOKEN_PREFIX = "wl_at_";
const REFRESH_TOKEN_PREFIX = "wl_rt_";
const CLIENT_SECRET_PREFIX = "wl_cs_";
const CODE_PREFIX = "wl_ac_";
const PREFIX_LOOKUP_LEN = 14;

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

export class OAuthError extends Error {
  constructor(
    public readonly code:
      | "invalid_request"
      | "invalid_client"
      | "invalid_grant"
      | "unauthorized_client"
      | "unsupported_grant_type"
      | "invalid_scope"
      | "server_error",
    public readonly description: string,
    public readonly status: number = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function randomToken(prefix: string): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const random = randomBytes(32).toString("base64url");
  const plaintext = prefix + random;
  return {
    plaintext,
    prefix: plaintext.slice(0, PREFIX_LOOKUP_LEN),
    hash: sha256Hex(plaintext),
  };
}

/** RFC 7636 S256: challenge = base64url(sha256(verifier)) */
function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): boolean {
  if (method !== "S256") return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  if (computed.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

// ─── Client registration ────────────────────────────────────

export interface RegisterClientInput {
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  redirectUris: string[];
  allowedScopes: string[];
  clientType?: "CONFIDENTIAL" | "PUBLIC";
  ownerUserId: string;
}

export interface RegisterClientResult {
  client: OAuthClientRow;
  /** Plaintext secret — returned only once, never persisted. */
  clientSecret: string | null;
}

export async function registerClient(
  input: RegisterClientInput,
): Promise<RegisterClientResult> {
  const invalid = input.allowedScopes.filter((s) => !isValidScope(s));
  if (invalid.length > 0) {
    throw new OAuthError(
      "invalid_scope",
      `Unknown scopes: ${invalid.join(", ")}`,
    );
  }
  if (input.redirectUris.length === 0) {
    throw new OAuthError(
      "invalid_request",
      "At least one redirect URI is required",
    );
  }

  const isConfidential =
    (input.clientType ?? "CONFIDENTIAL") === "CONFIDENTIAL";
  let plaintextSecret: string | null = null;
  let clientSecretHash: string | null = null;
  let secretPrefix: string | null = null;

  if (isConfidential) {
    const token = randomToken(CLIENT_SECRET_PREFIX);
    plaintextSecret = token.plaintext;
    clientSecretHash = token.hash;
    secretPrefix = token.prefix;
  }

  const client = await prisma.oAuthClient.create({
    data: {
      name: input.name,
      description: input.description,
      logoUrl: input.logoUrl,
      homepageUrl: input.homepageUrl,
      redirectUris: input.redirectUris,
      allowedScopes: input.allowedScopes,
      clientType: isConfidential ? "CONFIDENTIAL" : "PUBLIC",
      clientSecretHash,
      secretPrefix,
      ownerUserId: input.ownerUserId,
    },
  });

  return { client, clientSecret: plaintextSecret };
}

export async function rotateClientSecret(clientId: string): Promise<string> {
  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientId },
  });
  if (!client) throw new OAuthError("invalid_client", "Client not found", 404);
  if (client.clientType !== "CONFIDENTIAL") {
    throw new OAuthError(
      "invalid_request",
      "Public clients have no secret to rotate",
    );
  }
  const token = randomToken(CLIENT_SECRET_PREFIX);
  await prisma.oAuthClient.update({
    where: { id: clientId },
    data: { clientSecretHash: token.hash, secretPrefix: token.prefix },
  });
  return token.plaintext;
}

// ─── Installation ───────────────────────────────────────────

export interface InstallAppInput {
  clientId: string;
  orgId: string;
  shopId?: string | null;
  scopes: string[];
  installedBy: string;
  webhookUrl?: string;
}

export async function installApp(
  input: InstallAppInput,
): Promise<AppInstallationRow> {
  const client = await prisma.oAuthClient.findUnique({
    where: { id: input.clientId },
  });
  if (!client || client.status !== "ACTIVE") {
    throw new OAuthError("invalid_client", "Unknown or suspended client", 404);
  }

  const disallowed = subtractScopes(input.scopes, client.allowedScopes);
  if (disallowed.length > 0) {
    throw new OAuthError(
      "invalid_scope",
      `Scopes not allowed for this client: ${disallowed.join(", ")}`,
    );
  }

  // `shopId` is nullable, so the compound unique is not usable through
  // the typed `upsert` helper. Do a find-or-update-or-create dance.
  const existing = await prisma.appInstallation.findFirst({
    where: {
      oauthClientId: client.id,
      orgId: input.orgId,
      shopId: input.shopId ?? null,
    },
  });
  if (existing) {
    return prisma.appInstallation.update({
      where: { id: existing.id },
      data: {
        scopes: input.scopes,
        webhookUrl: input.webhookUrl,
        status: "ACTIVE",
        revokedAt: null,
      },
    });
  }
  return prisma.appInstallation.create({
    data: {
      oauthClientId: client.id,
      orgId: input.orgId,
      shopId: input.shopId ?? undefined,
      scopes: input.scopes,
      installedBy: input.installedBy,
      webhookUrl: input.webhookUrl,
    },
  });
}

export async function revokeInstallation(
  installationId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.appInstallation.update({
      where: { id: installationId },
      data: { status: "REVOKED", revokedAt: new Date() },
    }),
    prisma.oAuthAccessToken.updateMany({
      where: { installationId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.oAuthRefreshToken.updateMany({
      where: { installationId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    // Also deactivate any webhook endpoints this app registered, so
    // delivery skips them entirely rather than relying on the
    // scope-check fallback in WebhookManager.deliverEvent.
    prisma.webhookEndpoint.updateMany({
      where: { installationId, active: true },
      data: { active: false, updatedAt: new Date() },
    }),
  ]);
}

// ─── Authorization code ─────────────────────────────────────

export interface IssueAuthorizationCodeInput {
  installationId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export async function issueAuthorizationCode(
  input: IssueAuthorizationCodeInput,
): Promise<string> {
  const token = randomToken(CODE_PREFIX);
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: token.hash,
      installationId: input.installationId,
      redirectUri: input.redirectUri,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return token.plaintext;
}

// ─── Token exchange ─────────────────────────────────────────

export interface ExchangeCodeInput {
  code: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scope: string;
  installationId: string;
}

export async function exchangeCodeForTokens(
  input: ExchangeCodeInput,
): Promise<TokenResponse> {
  const client = await authenticateClient(input.clientId, input.clientSecret);

  const codeHash = sha256Hex(input.code);
  const codeRow = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
    include: { installation: true },
  });

  if (!codeRow)
    throw new OAuthError("invalid_grant", "Authorization code not found");
  if (codeRow.consumedAt) {
    await revokeInstallation(codeRow.installationId);
    throw new OAuthError(
      "invalid_grant",
      "Authorization code has already been used",
    );
  }
  if (codeRow.expiresAt < new Date()) {
    throw new OAuthError("invalid_grant", "Authorization code has expired");
  }
  if (codeRow.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "Redirect URI mismatch");
  }
  if (codeRow.installation.oauthClientId !== client.id) {
    throw new OAuthError("invalid_grant", "Code was not issued to this client");
  }
  if (
    !verifyPkce(
      input.codeVerifier,
      codeRow.codeChallenge,
      codeRow.codeChallengeMethod,
    )
  ) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }

  return issueTokenPair(codeRow.installationId, codeRow.scopes, {
    consumeCodeId: codeRow.id,
  });
}

export interface RefreshTokenInput {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
}

export async function refreshAccessToken(
  input: RefreshTokenInput,
): Promise<TokenResponse> {
  const client = await authenticateClient(input.clientId, input.clientSecret);

  const tokenHash = sha256Hex(input.refreshToken);
  const refreshRow = await prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash },
    include: { installation: true },
  });

  if (!refreshRow)
    throw new OAuthError("invalid_grant", "Refresh token not found");
  if (refreshRow.revokedAt) {
    await revokeInstallation(refreshRow.installationId);
    throw new OAuthError("invalid_grant", "Refresh token has been revoked");
  }
  if (refreshRow.expiresAt < new Date()) {
    throw new OAuthError("invalid_grant", "Refresh token has expired");
  }
  if (refreshRow.installation.oauthClientId !== client.id) {
    throw new OAuthError(
      "invalid_grant",
      "Refresh token was not issued to this client",
    );
  }

  const downscoped = input.scope?.split(" ").filter(Boolean);
  if (downscoped) {
    const disallowed = subtractScopes(downscoped, refreshRow.scopes);
    if (disallowed.length > 0) {
      throw new OAuthError(
        "invalid_scope",
        `Cannot widen scopes on refresh: ${disallowed.join(", ")}`,
      );
    }
  }

  return issueTokenPair(
    refreshRow.installationId,
    downscoped ?? refreshRow.scopes,
    { rotateRefreshId: refreshRow.id },
  );
}

// ─── Validation (middleware helper) ─────────────────────────

export interface ValidatedAccessToken {
  tokenId: string;
  installation: AppInstallationRow;
  scopes: string[];
}

export async function validateAccessToken(
  plaintext: string,
): Promise<ValidatedAccessToken | null> {
  if (!plaintext.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const tokenHash = sha256Hex(plaintext);
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash },
    include: { installation: true },
  });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt < new Date()) return null;
  if (row.installation.status !== "ACTIVE") return null;

  prisma.oAuthAccessToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    tokenId: row.id,
    installation: row.installation,
    scopes: row.scopes,
  };
}

async function authenticateClient(
  clientId: string,
  clientSecret?: string,
): Promise<OAuthClientRow> {
  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientId },
  });
  if (!client || client.status !== "ACTIVE") {
    throw new OAuthError("invalid_client", "Unknown or suspended client", 401);
  }
  if (client.clientType === "CONFIDENTIAL") {
    if (!clientSecret) {
      throw new OAuthError(
        "invalid_client",
        "Client authentication required",
        401,
      );
    }
    const providedHash = sha256Hex(clientSecret);
    if (
      !client.clientSecretHash ||
      !safeEqualHex(providedHash, client.clientSecretHash)
    ) {
      throw new OAuthError("invalid_client", "Invalid client credentials", 401);
    }
  }
  return client;
}

async function issueTokenPair(
  installationId: string,
  scopes: string[],
  opts: { consumeCodeId?: string; rotateRefreshId?: string } = {},
): Promise<TokenResponse> {
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX);
  const now = new Date();
  const accessExpires = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
  const refreshExpires = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  const ops: any[] = [
    prisma.oAuthAccessToken.create({
      data: {
        tokenHash: accessToken.hash,
        prefix: accessToken.prefix,
        installationId,
        scopes,
        expiresAt: accessExpires,
      },
    }),
    prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: refreshToken.hash,
        prefix: refreshToken.prefix,
        installationId,
        scopes,
        expiresAt: refreshExpires,
        rotatedFromId: opts.rotateRefreshId,
      },
    }),
  ];
  if (opts.consumeCodeId) {
    ops.push(
      prisma.oAuthAuthorizationCode.update({
        where: { id: opts.consumeCodeId },
        data: { consumedAt: now },
      }),
    );
  }
  if (opts.rotateRefreshId) {
    ops.push(
      prisma.oAuthRefreshToken.update({
        where: { id: opts.rotateRefreshId },
        data: { revokedAt: now },
      }),
    );
  }
  await prisma.$transaction(ops);

  return {
    accessToken: accessToken.plaintext,
    refreshToken: refreshToken.plaintext,
    tokenType: "Bearer",
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: scopes.join(" "),
    installationId,
  };
}
