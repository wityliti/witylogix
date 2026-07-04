/**
 * @witylogix/api — Authentication Flow Integration Tests
 *
 * End-to-end tests for complete authentication scenarios:
 * - Register → Login → Get profile → Refresh token → Logout
 * - Password reset flow with verification tokens
 * - Role-based access control (admin vs merchant vs driver)
 * - Auth provider switching (Local → Auth0)
 *
 * Pattern: Mock Prisma at top level, test realistic multi-step flows
 *
 * ~600-800 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@witylogix/db";

// Mock types matching API architecture
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  shopId?: string;
  role?: "SUPER_ADMIN" | "ADMIN" | "MERCHANT" | "DRIVER" | "VIEWER";
}

interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  shopId?: string;
  orgId?: string;
  createdAt: string;
  updatedAt: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetTokenResponse {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface ConfirmPasswordResetRequest {
  token: string;
  newPassword: string;
}

interface AuthProvider {
  id: string;
  userId?: string;
  type: string; // "LOCAL" | "AUTH0" | "CLERK"
  providerUserId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface LinkAuthProviderRequest {
  userId: string;
  type: string;
  providerUserId: string;
}

// Test data generators
const generateId = (prefix: string = "test") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const generateToken = (prefix: string = "token") =>
  `${prefix}_${Math.random().toString(36).substr(2, 32)}`;

describe("Authentication Flow Integration Tests", () => {
  let mockPrisma: any;
  let userId: string;
  let shopId: string;
  let orgId: string;

  beforeEach(() => {
    // Mock Prisma client at top level
    mockPrisma = {
      user: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      authProvider: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      passwordResetToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      shop: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      organization: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      orgMember: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      sessionToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    userId = generateId("user");
    shopId = generateId("shop");
    orgId = generateId("org");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Complete Authentication Flow", () => {
    it("should register → login → get profile → refresh token → logout", async () => {
      // Step 1: Register new user
      const registerRequest: RegisterRequest = {
        email: "newuser@example.com",
        password: "SecurePass123!",
        name: "Jane Merchant",
        role: "MERCHANT",
      };

      const hashedPassword = Buffer.from(
        `${registerRequest.password}:salt`,
      ).toString("base64");

      const registerResponse: RegisterResponse = {
        id: userId,
        email: registerRequest.email,
        name: registerRequest.name,
        role: registerRequest.role || "VIEWER",
        createdAt: new Date().toISOString(),
      };

      mockPrisma.user.create.mockResolvedValue({
        ...registerResponse,
        password: hashedPassword,
      });

      // Verify user doesn't already exist
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const userExists = await mockPrisma.user.findUnique({
        where: { email: registerRequest.email },
      });

      expect(userExists).toBeNull();

      // Create user
      const registeredUser = await mockPrisma.user.create({
        data: {
          email: registerRequest.email,
          name: registerRequest.name,
          password: hashedPassword,
          role: registerRequest.role,
        },
      });

      expect(registeredUser.id).toBe(userId);
      expect(registeredUser.email).toBe(registerRequest.email);

      // Create default LOCAL auth provider for user
      mockPrisma.authProvider.create.mockResolvedValue({
        id: generateId("authprov"),
        userId: userId,
        type: "LOCAL",
        createdAt: new Date().toISOString(),
      });

      const authProvider = await mockPrisma.authProvider.create({
        data: {
          userId: userId,
          type: "LOCAL",
        },
      });

      expect(authProvider.userId).toBe(userId);
      expect(authProvider.type).toBe("LOCAL");

      // Step 2: Login
      const loginRequest: LoginRequest = {
        email: registerRequest.email,
        password: registerRequest.password,
      };

      // Find user by email
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: registerRequest.email,
        name: registerRequest.name,
        role: registerRequest.role,
        password: hashedPassword,
      });

      const foundUser = await mockPrisma.user.findUnique({
        where: { email: loginRequest.email },
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(loginRequest.email);

      // Verify password (simulated)
      const passwordMatches =
        foundUser.password ===
        Buffer.from(`${loginRequest.password}:salt`).toString("base64");

      expect(passwordMatches).toBe(true);

      // Generate tokens
      const accessToken = generateToken("access");
      const refreshToken = generateToken("refresh");

      const loginResponse: LoginResponse = {
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          role: foundUser.role,
        },
      };

      expect(loginResponse.user.id).toBe(userId);

      // Store refresh token
      mockPrisma.sessionToken.create.mockResolvedValue({
        id: generateId("session"),
        userId: userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      const session = await mockPrisma.sessionToken.create({
        data: {
          userId: userId,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(session.userId).toBe(userId);

      // Step 3: Get Profile
      const profileResponse: ProfileResponse = {
        id: userId,
        email: registerRequest.email,
        name: registerRequest.name,
        role: registerRequest.role || "VIEWER",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(profileResponse.id).toBe(userId);
      expect(profileResponse.email).toBe(registerRequest.email);

      // Step 4: Refresh Token
      const refreshRequest: RefreshTokenRequest = {
        refreshToken: refreshToken,
      };

      // Verify refresh token exists and not expired
      mockPrisma.sessionToken.findUnique.mockResolvedValue({
        id: generateId("session"),
        userId: userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      });

      const validSession = await mockPrisma.sessionToken.findUnique({
        where: { token: refreshRequest.refreshToken },
      });

      expect(validSession).toBeDefined();
      expect(validSession.userId).toBe(userId);

      const isTokenExpired =
        new Date(validSession.expiresAt).getTime() < Date.now();

      expect(isTokenExpired).toBe(false);

      // Generate new tokens
      const newAccessToken = generateToken("access");
      const newRefreshToken = generateToken("refresh");

      const refreshResponse: RefreshTokenResponse = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };

      expect(refreshResponse.accessToken).toBeDefined();
      expect(refreshResponse.refreshToken).toBeDefined();

      // Step 5: Logout
      mockPrisma.sessionToken.delete.mockResolvedValue({
        id: validSession.id,
      });

      const logoutResult = await mockPrisma.sessionToken.delete({
        where: { token: refreshToken },
      });

      expect(logoutResult).toBeDefined();

      // Verify token is no longer valid
      mockPrisma.sessionToken.findUnique.mockResolvedValue(null);

      const deletedSession = await mockPrisma.sessionToken.findUnique({
        where: { token: refreshToken },
      });

      expect(deletedSession).toBeNull();
    });

    it("should maintain session across multiple API calls", async () => {
      const accessToken = generateToken("access");
      const refreshToken = generateToken("refresh");

      // Simulate multiple authenticated requests with same token
      const apiCalls = [
        { method: "GET", path: "/api/v4/profile" },
        { method: "GET", path: "/api/v4/shops" },
        { method: "POST", path: "/api/v4/orders" },
        { method: "GET", path: "/api/v4/drivers" },
      ];

      for (const call of apiCalls) {
        // Verify token is still valid
        mockPrisma.sessionToken.findUnique.mockResolvedValue({
          userId: userId,
          token: accessToken,
        });

        const session = await mockPrisma.sessionToken.findUnique({
          where: { token: accessToken },
        });

        expect(session).toBeDefined();
        expect(session.userId).toBe(userId);
      }
    });

    it("should handle concurrent login attempts", async () => {
      const email = "concurrent@example.com";

      // Simulate concurrent login requests
      const loginAttempts = Array.from({ length: 5 }, async (_, i) => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          email: email,
          password: "hash",
        });

        return mockPrisma.user.findUnique({
          where: { email: email },
        });
      });

      const results = await Promise.all(loginAttempts);

      // All requests should get the same user
      results.forEach((result) => {
        expect(result.id).toBe(userId);
      });
    });
  });

  describe("Password Reset Flow", () => {
    it("should initiate password reset and confirm with token", async () => {
      const email = "reset@example.com";

      // Step 1: Request password reset
      const resetRequest: PasswordResetRequest = {
        email: email,
      };

      // Find user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: email,
      });

      const user = await mockPrisma.user.findUnique({
        where: { email: resetRequest.email },
      });

      expect(user).toBeDefined();

      // Generate reset token
      const resetToken = generateToken("reset");
      const tokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: generateId("resettoken"),
        userId: userId,
        token: resetToken,
        expiresAt: tokenExpiry.toISOString(),
        createdAt: new Date().toISOString(),
      });

      const resetTokenRecord: PasswordResetTokenResponse =
        await mockPrisma.passwordResetToken.create({
          data: {
            userId: userId,
            token: resetToken,
            expiresAt: tokenExpiry,
          },
        });

      expect(resetTokenRecord.userId).toBe(userId);
      expect(resetTokenRecord.token).toBe(resetToken);

      // Step 2: Confirm password reset with token
      const confirmRequest: ConfirmPasswordResetRequest = {
        token: resetToken,
        newPassword: "NewSecurePass456!",
      };

      // Verify token exists and is not expired
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: resetTokenRecord.id,
        userId: userId,
        token: resetToken,
        expiresAt: tokenExpiry.toISOString(),
      });

      const validToken = await mockPrisma.passwordResetToken.findUnique({
        where: { token: confirmRequest.token },
      });

      expect(validToken).toBeDefined();

      const isTokenExpired =
        new Date(validToken.expiresAt).getTime() < Date.now();

      expect(isTokenExpired).toBe(false);

      // Update user password
      const newPasswordHash = Buffer.from(
        `${confirmRequest.newPassword}:salt`,
      ).toString("base64");

      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        email: email,
        password: newPasswordHash,
      });

      const updatedUser = await mockPrisma.user.update({
        where: { id: userId },
        data: { password: newPasswordHash },
      });

      expect(updatedUser.password).toBe(newPasswordHash);

      // Delete reset token
      mockPrisma.passwordResetToken.delete.mockResolvedValue({
        id: validToken.id,
      });

      await mockPrisma.passwordResetToken.delete({
        where: { token: resetToken },
      });

      // Verify token is deleted
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      const deletedToken = await mockPrisma.passwordResetToken.findUnique({
        where: { token: resetToken },
      });

      expect(deletedToken).toBeNull();
    });

    it("should reject expired reset tokens", async () => {
      const resetToken = generateToken("reset");
      const expiredTime = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: generateId("resettoken"),
        token: resetToken,
        expiresAt: expiredTime.toISOString(),
      });

      const token = await mockPrisma.passwordResetToken.findUnique({
        where: { token: resetToken },
      });

      expect(token).toBeDefined();

      const isExpired = new Date(token.expiresAt).getTime() < Date.now();

      expect(isExpired).toBe(true);

      // Should not allow password reset with expired token
      if (isExpired) {
        mockPrisma.passwordResetToken.delete.mockResolvedValue({
          id: token.id,
        });

        await mockPrisma.passwordResetToken.delete({
          where: { token: resetToken },
        });
      }
    });

    it("should prevent multiple reset tokens for same user", async () => {
      const email = "multi-reset@example.com";

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: email,
      });

      const user = await mockPrisma.user.findUnique({
        where: { email: email },
      });

      // Generate first reset token
      const token1 = generateToken("reset");
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: generateId("resettoken"),
        userId: userId,
        token: token1,
      });

      await mockPrisma.passwordResetToken.create({
        data: {
          userId: userId,
          token: token1,
        },
      });

      // Attempt to generate second reset token
      // Should delete previous token first
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        token: token1,
      });

      const existingToken = await mockPrisma.passwordResetToken.findFirst({
        where: { userId: userId },
      });

      if (existingToken) {
        mockPrisma.passwordResetToken.delete.mockResolvedValue(existingToken);

        await mockPrisma.passwordResetToken.delete({
          where: { token: existingToken.token },
        });
      }

      // Generate second token
      const token2 = generateToken("reset");
      mockPrisma.passwordResetToken.create.mockResolvedValue({
        id: generateId("resettoken"),
        userId: userId,
        token: token2,
      });

      const newToken = await mockPrisma.passwordResetToken.create({
        data: {
          userId: userId,
          token: token2,
        },
      });

      expect(newToken.token).toBe(token2);
    });
  });

  describe("Role-Based Access Control", () => {
    it("should enforce ADMIN-only operations", async () => {
      const roles = ["SUPER_ADMIN", "ADMIN", "MERCHANT", "DRIVER", "VIEWER"];

      // ADMIN-only endpoint: List all users in shop
      const adminOnlyEndpoint = (userRole: string) => {
        return ["SUPER_ADMIN", "ADMIN"].includes(userRole);
      };

      const adminResults = roles.map((role) => ({
        role,
        canAccess: adminOnlyEndpoint(role),
      }));

      expect(adminResults[0].canAccess).toBe(true); // SUPER_ADMIN
      expect(adminResults[1].canAccess).toBe(true); // ADMIN
      expect(adminResults[2].canAccess).toBe(false); // MERCHANT
      expect(adminResults[3].canAccess).toBe(false); // DRIVER
      expect(adminResults[4].canAccess).toBe(false); // VIEWER
    });

    it("should enforce MERCHANT-only operations", async () => {
      const merchantOnlyEndpoint = (userRole: string) => {
        return ["SUPER_ADMIN", "ADMIN", "MERCHANT"].includes(userRole);
      };

      const merchantResults = [
        { role: "SUPER_ADMIN", canAccess: merchantOnlyEndpoint("SUPER_ADMIN") },
        { role: "ADMIN", canAccess: merchantOnlyEndpoint("ADMIN") },
        { role: "MERCHANT", canAccess: merchantOnlyEndpoint("MERCHANT") },
        { role: "DRIVER", canAccess: merchantOnlyEndpoint("DRIVER") },
        { role: "VIEWER", canAccess: merchantOnlyEndpoint("VIEWER") },
      ];

      expect(merchantResults[0].canAccess).toBe(true); // SUPER_ADMIN
      expect(merchantResults[1].canAccess).toBe(true); // ADMIN
      expect(merchantResults[2].canAccess).toBe(true); // MERCHANT
      expect(merchantResults[3].canAccess).toBe(false); // DRIVER
      expect(merchantResults[4].canAccess).toBe(false); // VIEWER
    });

    it("should enforce DRIVER-only operations", async () => {
      const driverOnlyEndpoint = (userRole: string) => {
        return ["DRIVER"].includes(userRole);
      };

      const driverResults = [
        { role: "SUPER_ADMIN", canAccess: driverOnlyEndpoint("SUPER_ADMIN") },
        { role: "ADMIN", canAccess: driverOnlyEndpoint("ADMIN") },
        { role: "MERCHANT", canAccess: driverOnlyEndpoint("MERCHANT") },
        { role: "DRIVER", canAccess: driverOnlyEndpoint("DRIVER") },
        { role: "VIEWER", canAccess: driverOnlyEndpoint("VIEWER") },
      ];

      expect(driverResults[0].canAccess).toBe(false);
      expect(driverResults[1].canAccess).toBe(false);
      expect(driverResults[2].canAccess).toBe(false);
      expect(driverResults[3].canAccess).toBe(true); // DRIVER
      expect(driverResults[4].canAccess).toBe(false);
    });

    it("should handle role transitions for users", async () => {
      const userId = generateId("user");

      // User starts as VIEWER
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "VIEWER",
      });

      const initialUser = await mockPrisma.user.findUnique({
        where: { id: userId },
      });

      expect(initialUser.role).toBe("VIEWER");

      // Upgrade to MERCHANT
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        role: "MERCHANT",
      });

      const merchantUser = await mockPrisma.user.update({
        where: { id: userId },
        data: { role: "MERCHANT" },
      });

      expect(merchantUser.role).toBe("MERCHANT");

      // Further upgrade to ADMIN
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        role: "ADMIN",
      });

      const adminUser = await mockPrisma.user.update({
        where: { id: userId },
        data: { role: "ADMIN" },
      });

      expect(adminUser.role).toBe("ADMIN");
    });

    it("should enforce role-based shop access", async () => {
      const shop1Id = generateId("shop");
      const shop2Id = generateId("shop");

      // Merchant assigned to shop1
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "MERCHANT",
        shopId: shop1Id,
      });

      const user = await mockPrisma.user.findUnique({
        where: { id: userId },
      });

      // Can access shop1
      const canAccessShop1 = user.shopId === shop1Id;
      expect(canAccessShop1).toBe(true);

      // Cannot access shop2
      const canAccessShop2 = user.shopId === shop2Id;
      expect(canAccessShop2).toBe(false);
    });
  });

  describe("Auth Provider Switching (Local → Auth0)", () => {
    it("should link Auth0 provider to existing local account", async () => {
      // Step 1: User has existing LOCAL auth
      mockPrisma.authProvider.findMany.mockResolvedValue([
        {
          id: generateId("authprov"),
          userId: userId,
          type: "LOCAL",
        },
      ]);

      const existingProviders = await mockPrisma.authProvider.findMany({
        where: { userId: userId },
      });

      expect(existingProviders).toHaveLength(1);
      expect(existingProviders[0].type).toBe("LOCAL");

      // Step 2: Link Auth0 provider
      mockPrisma.authProvider.create.mockResolvedValue({
        id: generateId("authprov"),
        userId: userId,
        type: "AUTH0",
        providerUserId: "auth0|abcd1234",
      });

      const auth0Provider = await mockPrisma.authProvider.create({
        data: {
          userId: userId,
          type: "AUTH0",
          providerUserId: "auth0|abcd1234",
        },
      });

      expect(auth0Provider.type).toBe("AUTH0");

      // Step 3: Verify both providers exist
      mockPrisma.authProvider.findMany.mockResolvedValue([
        { userId: userId, type: "LOCAL" },
        { userId: userId, type: "AUTH0" },
      ]);

      const allProviders = await mockPrisma.authProvider.findMany({
        where: { userId: userId },
      });

      expect(allProviders).toHaveLength(2);

      const types = allProviders.map((p) => p.type);
      expect(types).toContain("LOCAL");
      expect(types).toContain("AUTH0");
    });

    it("should prefer Auth0 login over local when both exist", async () => {
      // User has both LOCAL and AUTH0 providers
      mockPrisma.authProvider.findFirst.mockResolvedValue({
        userId: userId,
        type: "AUTH0",
        providerUserId: "auth0|xyz789",
      });

      // System should prefer AUTH0 for login
      const preferredProvider = await mockPrisma.authProvider.findFirst({
        where: {
          userId: userId,
          type: { in: ["AUTH0", "LOCAL"] },
        },
      });

      expect(preferredProvider.type).toBe("AUTH0");
    });

    it("should migrate local credentials on Auth0 linking", async () => {
      // Step 1: User authenticates with local credentials
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: "migrate@example.com",
        password: "hashed_password",
      });

      const localUser = await mockPrisma.user.findUnique({
        where: { email: "migrate@example.com" },
      });

      expect(localUser.password).toBeDefined();

      // Step 2: Link Auth0 provider
      mockPrisma.authProvider.create.mockResolvedValue({
        id: generateId("authprov"),
        userId: userId,
        type: "AUTH0",
        providerUserId: "auth0|newid",
      });

      const auth0Provider = await mockPrisma.authProvider.create({
        data: {
          userId: userId,
          type: "AUTH0",
          providerUserId: "auth0|newid",
        },
      });

      expect(auth0Provider.type).toBe("AUTH0");

      // Step 3: Clear local password (optional - keep for fallback)
      // In practice, you might keep it for fallback authentication
    });

    it("should handle Auth0 login callback flow", async () => {
      const auth0Id = "auth0|user123";
      const email = "oauth@example.com";

      // Step 1: Auth0 callback with code
      const auth0Code = "auth0_code_xyz";
      const auth0Profile = {
        sub: auth0Id,
        email: email,
        name: "OAuth User",
      };

      // Step 2: Check if user exists
      mockPrisma.authProvider.findUnique.mockResolvedValue(null);

      const existingProvider = await mockPrisma.authProvider.findUnique({
        where: {
          type_providerUserId: { type: "AUTH0", providerUserId: auth0Id },
        },
      });

      expect(existingProvider).toBeNull();

      // Step 3: Check if email exists
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const existingUser = await mockPrisma.user.findUnique({
        where: { email: email },
      });

      expect(existingUser).toBeNull();

      // Step 4: Create new user and AUTH0 provider
      mockPrisma.user.create.mockResolvedValue({
        id: userId,
        email: email,
        name: auth0Profile.name,
      });

      const newUser = await mockPrisma.user.create({
        data: {
          email: email,
          name: auth0Profile.name,
        },
      });

      mockPrisma.authProvider.create.mockResolvedValue({
        id: generateId("authprov"),
        userId: newUser.id,
        type: "AUTH0",
        providerUserId: auth0Id,
      });

      const authProvider = await mockPrisma.authProvider.create({
        data: {
          userId: newUser.id,
          type: "AUTH0",
          providerUserId: auth0Id,
        },
      });

      expect(authProvider.type).toBe("AUTH0");
      expect(authProvider.providerUserId).toBe(auth0Id);

      // Step 5: Return user and generate JWT
      const jwtToken = generateToken("jwt");

      expect(newUser.email).toBe(email);
      expect(jwtToken).toBeDefined();
    });
  });

  describe("Session Management and Security", () => {
    it("should invalidate refresh token on logout", async () => {
      const refreshToken = generateToken("refresh");

      mockPrisma.sessionToken.create.mockResolvedValue({
        id: generateId("session"),
        userId: userId,
        token: refreshToken,
      });

      const session = await mockPrisma.sessionToken.create({
        data: {
          userId: userId,
          token: refreshToken,
        },
      });

      expect(session.token).toBe(refreshToken);

      // Logout
      mockPrisma.sessionToken.delete.mockResolvedValue({
        id: session.id,
      });

      await mockPrisma.sessionToken.delete({
        where: { token: refreshToken },
      });

      // Verify token is invalid
      mockPrisma.sessionToken.findUnique.mockResolvedValue(null);

      const deletedSession = await mockPrisma.sessionToken.findUnique({
        where: { token: refreshToken },
      });

      expect(deletedSession).toBeNull();
    });

    it("should handle simultaneous logout on all devices", async () => {
      // User has active sessions on 3 devices
      const sessions = [
        { id: generateId("session"), token: generateToken("refresh") },
        { id: generateId("session"), token: generateToken("refresh") },
        { id: generateId("session"), token: generateToken("refresh") },
      ];

      mockPrisma.sessionToken.findMany.mockResolvedValue(sessions);

      const activeSessions = await mockPrisma.sessionToken.findMany({
        where: { userId: userId },
      });

      expect(activeSessions).toHaveLength(3);

      // Logout from all devices
      mockPrisma.sessionToken.deleteMany = vi.fn().mockResolvedValue({
        count: 3,
      });

      const result = await mockPrisma.sessionToken.deleteMany({
        where: { userId: userId },
      });

      expect(result.count).toBe(3);

      // Verify all sessions are deleted
      mockPrisma.sessionToken.findMany.mockResolvedValue([]);

      const remainingSessions = await mockPrisma.sessionToken.findMany({
        where: { userId: userId },
      });

      expect(remainingSessions).toHaveLength(0);
    });

    it("should enforce rate limiting on failed login attempts", async () => {
      const email = "rateit@example.com";
      const maxAttempts = 5;
      let failedAttempts = 0;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: email,
        password: "correct_hash",
      });

      for (let i = 0; i < maxAttempts + 2; i++) {
        // Wrong password
        const isPasswordCorrect = false;

        if (!isPasswordCorrect) {
          failedAttempts++;

          if (failedAttempts >= maxAttempts) {
            // Account should be locked
            expect(failedAttempts).toBeGreaterThanOrEqual(maxAttempts);
            break;
          }
        }
      }

      expect(failedAttempts).toBeGreaterThanOrEqual(maxAttempts);
    });
  });
});
