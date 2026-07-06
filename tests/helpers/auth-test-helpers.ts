/**
 * Authentication Test Helpers
 * Utility functions for auth and onboarding testing
 * ~200 lines of reusable test fixtures and mocks
 */

import { randomBytes, createHash, createHmac } from "crypto";

// ───────────────────────────────────────────────────────────────────────────
// MOCK DATA BUILDERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create a mock user for testing
 */
export function createMockUser(
  overrides: Partial<{
    id: string;
    email: string;
    passwordHash: string;
    orgId: string;
    role: string;
    isActive: boolean;
  }> = {},
) {
  const defaultPassword = "TestPassword123!";
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(salt + defaultPassword)
    .digest("hex");

  return {
    id: overrides.id || `user-${randomBytes(4).toString("hex")}`,
    email:
      overrides.email || `user-${randomBytes(4).toString("hex")}@example.com`,
    passwordHash:
      overrides.passwordHash ||
      `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${hash}`,
    orgId: overrides.orgId || `org-${randomBytes(4).toString("hex")}`,
    role: overrides.role || "MEMBER",
    isActive: overrides.isActive !== false,
  };
}

/**
 * Create a mock organization for testing
 */
export function createMockOrg(
  overrides: Partial<{
    id: string;
    name: string;
    industry: string;
    planType: string;
    isActive: boolean;
  }> = {},
) {
  return {
    id: overrides.id || `org-${randomBytes(4).toString("hex")}`,
    name: overrides.name || `Test Org ${Date.now()}`,
    industry: overrides.industry || "logistics",
    planType: overrides.planType || "premium",
    isActive: overrides.isActive !== false,
  };
}

/**
 * Create a mock session for testing
 */
export function createMockSession(
  overrides: Partial<{
    id: string;
    userId: string;
    deviceFingerprint: string;
    isActive: boolean;
    expiresAt: Date;
    createdAt: Date;
  }> = {},
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  return {
    id: overrides.id || `session-${randomBytes(8).toString("hex")}`,
    userId: overrides.userId || `user-${randomBytes(4).toString("hex")}`,
    deviceFingerprint:
      overrides.deviceFingerprint || randomBytes(32).toString("hex"),
    isActive: overrides.isActive !== false,
    expiresAt: overrides.expiresAt || expiresAt,
    createdAt: overrides.createdAt || now,
  };
}

/**
 * Create a mock API key for testing
 */
export function createMockApiKey(
  overrides: Partial<{
    id: string;
    key: string;
    tenantId: string;
    scopes: string[];
    isActive: boolean;
    createdAt: Date;
  }> = {},
) {
  const key = `wl_live_${randomBytes(32).toString("hex")}`;

  return {
    id: overrides.id || `key-${randomBytes(4).toString("hex")}`,
    key: overrides.key || key,
    tenantId: overrides.tenantId || `org-${randomBytes(4).toString("hex")}`,
    scopes: overrides.scopes || ["read", "write"],
    isActive: overrides.isActive !== false,
    createdAt: overrides.createdAt || new Date(),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// JWT UTILITIES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Generate a test JWT token
 */
export function generateTestJWT(
  claims: {
    sub: string;
    shopId: string;
    orgId?: string;
    role: string;
    type: "user" | "driver";
    exp?: number;
    iat?: number;
  },
  secret: string = "test-secret",
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: claims.iat || now,
    exp: claims.exp || now + 3600,
  };

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

/**
 * Decode and verify test JWT (for testing purposes)
 */
export function verifyTestJWT(
  token: string,
  secret: string = "test-secret",
): any | null {
  try {
    const [headerB64, bodyB64, signatureB64] = token.split(".");

    // Verify signature
    const expectedSignature = createHmac("sha256", secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest("base64url");

    if (expectedSignature !== signatureB64) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// REQUEST/RESPONSE MOCKING
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create a mock HTTP request object
 */
export function createMockRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    auth?: any;
  } = {},
) {
  return {
    method: options.method || "GET",
    url: options.url || "http://localhost:3000/",
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    body: options.body,
    auth: options.auth,
    ip: "127.0.0.1",
  };
}

/**
 * Create a mock HTTP response object
 */
export function createMockResponse(
  overrides: Partial<{
    status: number;
    headers: Record<string, string>;
    body: any;
  }> = {},
) {
  return {
    status: overrides.status || 200,
    headers: overrides.headers || { "content-type": "application/json" },
    body: overrides.body || {},
    json: () => Promise.resolve(overrides.body || {}),
    text: () => Promise.resolve(JSON.stringify(overrides.body || {})),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// PRISMA MOCKING
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create a mock Prisma client for testing
 */
export function mockPrismaClient() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const apiKeys = new Map<string, any>();
  const organizations = new Map<string, any>();

  return {
    user: {
      create: async (data: any) => {
        const user = { id: `user-${randomBytes(4).toString("hex")}`, ...data };
        users.set(user.id, user);
        return user;
      },
      findUnique: async (query: any) => {
        if (query.where.id) return users.get(query.where.id) || null;
        if (query.where.email) {
          return (
            Array.from(users.values()).find(
              (u) => u.email === query.where.email,
            ) || null
          );
        }
        return null;
      },
      findMany: async () => Array.from(users.values()),
      update: async (query: any) => {
        const user = users.get(query.where.id);
        if (!user) throw new Error("User not found");
        Object.assign(user, query.data);
        return user;
      },
      delete: async (query: any) => {
        const user = users.get(query.where.id);
        users.delete(query.where.id);
        return user;
      },
    },

    session: {
      create: async (data: any) => {
        const session = {
          id: `session-${randomBytes(8).toString("hex")}`,
          ...data,
        };
        sessions.set(session.id, session);
        return session;
      },
      findUnique: async (query: any) => sessions.get(query.where.id) || null,
      findMany: async () => Array.from(sessions.values()),
      update: async (query: any) => {
        const session = sessions.get(query.where.id);
        if (!session) throw new Error("Session not found");
        Object.assign(session, query.data);
        return session;
      },
      deleteMany: async () => ({ count: sessions.size }),
    },

    apiKey: {
      create: async (data: any) => {
        const key = { id: `key-${randomBytes(4).toString("hex")}`, ...data };
        apiKeys.set(key.id, key);
        return key;
      },
      findUnique: async (query: any) => apiKeys.get(query.where.id) || null,
      findMany: async () => Array.from(apiKeys.values()),
    },

    organization: {
      create: async (data: any) => {
        const org = { id: `org-${randomBytes(4).toString("hex")}`, ...data };
        organizations.set(org.id, org);
        return org;
      },
      findUnique: async (query: any) =>
        organizations.get(query.where.id) || null,
      findMany: async () => Array.from(organizations.values()),
    },

    _reset: () => {
      users.clear();
      sessions.clear();
      apiKeys.clear();
      organizations.clear();
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// RATE LIMITER TEST SETUP
// ───────────────────────────────────────────────────────────────────────────

/**
 * Setup for rate limiter testing
 */
export function setupRateLimiterTest() {
  const requests = new Map<string, number[]>();

  return {
    recordRequest: (key: string, timestamp: number = Date.now()) => {
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      requests.get(key)!.push(timestamp);
    },

    isRateLimited: (
      key: string,
      limit: number,
      windowMs: number,
      timestamp: number = Date.now(),
    ): boolean => {
      const times = requests.get(key) || [];
      const windowStart = timestamp - windowMs;
      const recentRequests = times.filter((t) => t > windowStart);
      return recentRequests.length >= limit;
    },

    getRemainingRequests: (
      key: string,
      limit: number,
      windowMs: number,
      timestamp: number = Date.now(),
    ): number => {
      const times = requests.get(key) || [];
      const windowStart = timestamp - windowMs;
      const recentRequests = times.filter((t) => t > windowStart);
      return Math.max(0, limit - recentRequests.length);
    },

    reset: () => requests.clear(),

    getStats: () => ({
      keys: requests.size,
      totalRequests: Array.from(requests.values()).reduce(
        (sum, times) => sum + times.length,
        0,
      ),
    }),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// EMAIL/OTP UTILITIES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Generate a test OTP code
 */
export function generateTestOTP(length: number = 6): string {
  const code = Math.floor(Math.random() * Math.pow(10, length));
  return code.toString().padStart(length, "0");
}

/**
 * Generate a test TOTP secret
 */
export function generateTestTOTPSecret(): string {
  return Buffer.from(randomBytes(32)).toString("base64");
}

/**
 * Generate test backup codes
 */
export function generateTestBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString("hex").toUpperCase(),
  );
}

/**
 * Generate a test magic link token
 */
export function generateTestMagicLinkToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a test password reset token
 */
export function generateTestPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a test CSRF token
 */
export function generateTestCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

// ───────────────────────────────────────────────────────────────────────────
// ASSERTION HELPERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Assert user has required role
 */
export function assertUserRole(user: any, expectedRole: string): boolean {
  return user.role === expectedRole;
}

/**
 * Assert user has specific permission
 */
export function assertUserPermission(user: any, permission: string): boolean {
  const permissions = user.permissions || [];
  return permissions.includes(permission);
}

/**
 * Assert session is valid
 */
export function assertSessionValid(session: any): boolean {
  const now = new Date();
  return (
    session.isActive && session.expiresAt > now && !!session.deviceFingerprint
  );
}

/**
 * Assert API key is valid
 */
export function assertAPIKeyValid(key: any): boolean {
  const now = new Date();
  return (
    key.isActive &&
    (!key.expiresAt || key.expiresAt > now) &&
    key.scopes &&
    key.scopes.length > 0
  );
}

/**
 * Assert token format is correct
 */
export function assertTokenFormat(
  token: string,
  expectedPrefix?: string,
): boolean {
  if (expectedPrefix) {
    return token.startsWith(expectedPrefix);
  }
  return token.length > 0;
}

/**
 * Assert password strength
 */
export function assertPasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain number" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: "Password must contain special character" };
  }
  return { valid: true };
}

// ───────────────────────────────────────────────────────────────────────────
// EXPORT ALL
// ───────────────────────────────────────────────────────────────────────────

export const authTestHelpers = {
  createMockUser,
  createMockOrg,
  createMockSession,
  createMockApiKey,
  generateTestJWT,
  verifyTestJWT,
  createMockRequest,
  createMockResponse,
  mockPrismaClient,
  setupRateLimiterTest,
  generateTestOTP,
  generateTestTOTPSecret,
  generateTestBackupCodes,
  generateTestMagicLinkToken,
  generateTestPasswordResetToken,
  generateTestCSRFToken,
  assertUserRole,
  assertUserPermission,
  assertSessionValid,
  assertAPIKeyValid,
  assertTokenFormat,
  assertPasswordStrength,
};
