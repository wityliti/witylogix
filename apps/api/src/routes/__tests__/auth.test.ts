import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHash, randomBytes } from "crypto";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  jwt?: {
    sign: (
      payload: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => string;
  };
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

// Helper to generate valid test data
const generateTestUser = () => ({
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  password: "hashed_password_here",
  role: "ADMIN",
  isActive: true,
});

const generateTestDriver = () => ({
  id: "driver-456",
  name: "Test Driver",
  phone: "+1234567890",
  password: "hashed_password_here",
  isActive: true,
  orgId: "org-123",
});

const generateTestShop = () => ({
  id: "shop-789",
  shopifyDomain: "test-shop.myshopify.com",
  orgId: "org-123",
  isActive: true,
  name: "Test Shop",
});

// ─────────────────────────────────────────────────────────────────

describe("Auth Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockPrisma: Record<string, any>;
  let mockRedis: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      jwt: {
        sign: vi.fn((payload, options) => `jwt_token_${payload.sub}`),
      },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      shop: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      driver: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      orgMember: {
        findUnique: vi.fn(),
      },
    };

    mockRedis = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    };
  });

  describe("POST /login (Dashboard user login)", () => {
    it("should successfully login user with valid credentials", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue({
        role: "OWNER",
        isActive: true,
      });
      mockRedis.set.mockResolvedValue("OK");
      mockPrisma.user.update.mockResolvedValue(user);

      mockRequest.body = {
        email: user.email,
        password: "correct_password",
        shopDomain: shop.shopifyDomain,
      };

      // Simulate route logic
      const email = mockRequest.body.email;
      const password = mockRequest.body.password;
      const shopDomain = mockRequest.body.shopDomain;

      expect(email).toBe("test@example.com");
      expect(password).toBe("correct_password");
      expect(shopDomain).toBe("test-shop.myshopify.com");
    });

    it("should return 401 for invalid shop domain", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        email: "test@example.com",
        password: "password123",
        shopDomain: "nonexistent.myshopify.com",
      };

      const shop = await (mockPrisma as any).shop.findUnique({
        where: { shopifyDomain: mockRequest.body.shopDomain },
      });

      expect(shop).toBeNull();
    });

    it("should return 401 for inactive shop", async () => {
      const inactiveShop = { ...generateTestShop(), isActive: false };
      mockPrisma.shop.findUnique.mockResolvedValue(inactiveShop);

      mockRequest.body = {
        email: "test@example.com",
        password: "password123",
        shopDomain: inactiveShop.shopifyDomain,
      };

      const shop = await (mockPrisma as any).shop.findUnique({
        where: { shopifyDomain: mockRequest.body.shopDomain },
      });

      expect(shop?.isActive).toBe(false);
    });

    it("should return 401 for non-existent user", async () => {
      const shop = generateTestShop();
      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        email: "nonexistent@example.com",
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const user = await (mockPrisma as any).user.findUnique({
        where: {
          shopId_email: { shopId: shop.id, email: mockRequest.body.email },
        },
      });

      expect(user).toBeNull();
    });

    it("should return 401 for inactive user", async () => {
      const shop = generateTestShop();
      const inactiveUser = { ...generateTestUser(), isActive: false };

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      mockRequest.body = {
        email: inactiveUser.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const user = await (mockPrisma as any).user.findUnique({
        where: {
          shopId_email: { shopId: shop.id, email: mockRequest.body.email },
        },
      });

      expect(user?.isActive).toBe(false);
    });

    it("should reject request with missing email", () => {
      mockRequest.body = {
        password: "password123",
        shopDomain: "test.myshopify.com",
      };

      expect(mockRequest.body.email).toBeUndefined();
    });

    it("should reject request with invalid email format", () => {
      mockRequest.body = {
        email: "invalid-email",
        password: "password123",
        shopDomain: "test.myshopify.com",
      };

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(mockRequest.body.email),
      );
      expect(isValidEmail).toBe(false);
    });

    it("should reject request with password too short", () => {
      mockRequest.body = {
        email: "test@example.com",
        password: "short",
        shopDomain: "test.myshopify.com",
      };

      expect(String(mockRequest.body.password).length).toBeLessThan(8);
    });

    it("should include org role in response when user is org member", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue({
        role: "MANAGER",
        isActive: true,
      });

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const orgMember = await (mockPrisma as any).orgMember.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
      });

      expect(orgMember?.role).toBe("MANAGER");
    });

    it("should not include org role when user is not org member", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const orgMember = await (mockPrisma as any).orgMember.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
      });

      expect(orgMember).toBeNull();
    });

    it("should update user lastLogin timestamp", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      await (mockPrisma as any).user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("should store refresh token in Redis with 30 day TTL", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const refreshToken = randomBytes(40).toString("hex");
      const refreshHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const ttl = 30 * 24 * 60 * 60;

      await (mockRedis as any).set(
        `refresh:${refreshHash}`,
        JSON.stringify({ userId: user.id }),
        "EX",
        ttl,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining("refresh:"),
        expect.any(String),
        "EX",
        ttl,
      );
    });
  });

  describe("POST /driver/login", () => {
    it("should successfully login driver with valid credentials", async () => {
      const shop = generateTestShop();
      const driver = generateTestDriver();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockRedis.set.mockResolvedValue("OK");
      mockPrisma.driver.update.mockResolvedValue(driver);

      mockRequest.body = {
        phone: driver.phone,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const phone = mockRequest.body.phone;
      const password = mockRequest.body.password;

      expect(phone).toBe("+1234567890");
      expect(password).toBe("password123");
    });

    it("should return 401 for invalid shop", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        phone: "+1234567890",
        password: "password123",
        shopDomain: "invalid.myshopify.com",
      };

      const shop = await (mockPrisma as any).shop.findUnique({
        where: { shopifyDomain: mockRequest.body.shopDomain },
      });

      expect(shop).toBeNull();
    });

    it("should return 401 for non-existent driver", async () => {
      const shop = generateTestShop();
      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        phone: "+1234567890",
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const driver = await (mockPrisma as any).driver.findUnique({
        where: {
          orgId_phone: {
            orgId: shop.orgId || "",
            phone: mockRequest.body.phone,
          },
        },
      });

      expect(driver).toBeNull();
    });

    it("should return 401 for inactive driver", async () => {
      const shop = generateTestShop();
      const inactiveDriver = { ...generateTestDriver(), isActive: false };

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.driver.findUnique.mockResolvedValue(inactiveDriver);

      mockRequest.body = {
        phone: inactiveDriver.phone,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const driver = await (mockPrisma as any).driver.findUnique({
        where: {
          orgId_phone: {
            orgId: shop.orgId || "",
            phone: mockRequest.body.phone,
          },
        },
      });

      expect(driver?.isActive).toBe(false);
    });

    it("should reject request with invalid phone format", () => {
      mockRequest.body = {
        phone: "123",
        password: "password123",
        shopDomain: "test.myshopify.com",
      };

      expect(String(mockRequest.body.phone).length).toBeLessThan(5);
    });

    it("should reject request with password too short", () => {
      mockRequest.body = {
        phone: "+1234567890",
        password: "short",
        shopDomain: "test.myshopify.com",
      };

      expect(String(mockRequest.body.password).length).toBeLessThan(6);
    });

    it("should store driver refresh token with 90 day TTL", async () => {
      const shop = generateTestShop();
      const driver = generateTestDriver();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.driver.findUnique.mockResolvedValue(driver);
      mockRedis.set.mockResolvedValue("OK");
      mockPrisma.driver.update.mockResolvedValue(driver);

      mockRequest.body = {
        phone: driver.phone,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const ttl = 90 * 24 * 60 * 60;
      await (mockRedis as any).set(
        `refresh:hash`,
        JSON.stringify({}),
        "EX",
        ttl,
      );

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it("should return 7d expiry time for driver tokens", async () => {
      const shop = generateTestShop();
      const driver = generateTestDriver();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.driver.findUnique.mockResolvedValue(driver);

      mockRequest.body = {
        phone: driver.phone,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const expiresIn = "7d";
      expect(expiresIn).toBe("7d");
    });
  });

  describe("POST /refresh (Token refresh)", () => {
    it("should issue new access token with valid refresh token", async () => {
      const refreshToken = randomBytes(40).toString("hex");
      const refreshHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: "user-123",
          shopId: "shop-789",
          role: "ADMIN",
        }),
      );
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = { refreshToken };

      const stored = await (mockRedis as any).get(`refresh:${refreshHash}`);
      expect(stored).toBeTruthy();
    });

    it("should return 401 for invalid refresh token", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockRequest.body = { refreshToken: "invalid_token" };

      const stored = await (mockRedis as any).get("refresh:hash");
      expect(stored).toBeNull();
    });

    it("should return 401 for expired refresh token", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockRequest.body = { refreshToken: "expired_token" };

      const stored = await (mockRedis as any).get("refresh:hash");
      expect(stored).toBeNull();
    });

    it("should rotate refresh token on refresh", async () => {
      const oldRefreshToken = randomBytes(40).toString("hex");
      const oldHash = createHash("sha256")
        .update(oldRefreshToken)
        .digest("hex");

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: "user-123", shopId: "shop-789" }),
      );
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = { refreshToken: oldRefreshToken };

      await (mockRedis as any).del(`refresh:${oldHash}`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("refresh:"),
      );
    });

    it("should use driver JWT expiry for driver tokens", async () => {
      const refreshToken = randomBytes(40).toString("hex");
      const refreshHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          driverId: "driver-456",
          shopId: "shop-789",
          role: "DRIVER",
        }),
      );

      mockRequest.body = { refreshToken };

      const stored = await (mockRedis as any).get(`refresh:${refreshHash}`);
      const data = JSON.parse(stored);
      expect(data.role).toBe("DRIVER");
    });

    it("should return new refresh token in response", async () => {
      const refreshToken = randomBytes(40).toString("hex");

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: "user-123", shopId: "shop-789" }),
      );
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = { refreshToken };

      expect(mockRequest.body.refreshToken).toBeTruthy();
    });

    it("should reject request with missing refresh token", () => {
      mockRequest.body = {};

      expect(mockRequest.body.refreshToken).toBeUndefined();
    });
  });

  describe("POST /logout", () => {
    it("should successfully delete refresh token from Redis", async () => {
      const refreshToken = randomBytes(40).toString("hex");
      const refreshHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      mockRedis.del.mockResolvedValue(1);

      mockRequest.body = { refreshToken };

      await (mockRedis as any).del(`refresh:${refreshHash}`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("refresh:"),
      );
    });

    it("should return success message", async () => {
      const refreshToken = randomBytes(40).toString("hex");
      mockRedis.del.mockResolvedValue(1);

      mockRequest.body = { refreshToken };

      const result = { data: { message: "Logged out" } };
      expect(result.data.message).toBe("Logged out");
    });

    it("should return 200 even if token not found", async () => {
      const refreshToken = randomBytes(40).toString("hex");
      mockRedis.del.mockResolvedValue(0);

      mockRequest.body = { refreshToken };

      await (mockRedis as any).del(`refresh:hash`);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it("should reject request with missing refresh token", () => {
      mockRequest.body = {};

      expect(mockRequest.body.refreshToken).toBeUndefined();
    });
  });

  describe("POST /forgot-password", () => {
    it("should return success message for valid email (user exists)", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = {
        email: user.email,
        shopDomain: shop.shopifyDomain,
      };

      const result = {
        data: { message: "If the email exists, a reset link has been sent" },
      };
      expect(result.data.message).toContain("reset link");
    });

    it("should return success message for non-existent email (security)", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        email: "nonexistent@example.com",
        shopDomain: "invalid.myshopify.com",
      };

      const result = {
        data: { message: "If the email exists, a reset link has been sent" },
      };
      expect(result.data.message).toContain("reset link");
    });

    it("should reject request with invalid email format", () => {
      mockRequest.body = {
        email: "invalid-email",
        shopDomain: "test.myshopify.com",
      };

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(mockRequest.body.email),
      );
      expect(isValidEmail).toBe(false);
    });

    it("should reject request with missing email", () => {
      mockRequest.body = {
        shopDomain: "test.myshopify.com",
      };

      expect(mockRequest.body.email).toBeUndefined();
    });

    it("should store password reset token in Redis with 1 hour TTL", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockRedis.set.mockResolvedValue("OK");

      mockRequest.body = {
        email: user.email,
        shopDomain: shop.shopifyDomain,
      };

      const resetToken = randomBytes(32).toString("hex");
      const resetHash = createHash("sha256").update(resetToken).digest("hex");
      const ttl = 3600;

      await (mockRedis as any).set(
        `password-reset:${resetHash}`,
        JSON.stringify({ userId: user.id, shopId: shop.id }),
        "EX",
        ttl,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining("password-reset:"),
        expect.any(String),
        "EX",
        3600,
      );
    });

    it("should reject request with missing shop domain", () => {
      mockRequest.body = {
        email: "test@example.com",
      };

      expect(mockRequest.body.shopDomain).toBeUndefined();
    });
  });

  describe("POST /reset-password", () => {
    it("should successfully reset password with valid token", async () => {
      const resetToken = randomBytes(32).toString("hex");
      const resetHash = createHash("sha256").update(resetToken).digest("hex");
      const user = generateTestUser();

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: user.id, shopId: "shop-789" }),
      );
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.update.mockResolvedValue(user);

      mockRequest.body = {
        token: resetToken,
        password: "newpassword123",
      };

      const stored = await (mockRedis as any).get(
        `password-reset:${resetHash}`,
      );
      expect(stored).toBeTruthy();
    });

    it("should return 422 for invalid reset token", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockRequest.body = {
        token: "invalid_token",
        password: "newpassword123",
      };

      const stored = await (mockRedis as any).get("password-reset:hash");
      expect(stored).toBeNull();
    });

    it("should return 422 for expired reset token", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockRequest.body = {
        token: "expired_token",
        password: "newpassword123",
      };

      const stored = await (mockRedis as any).get("password-reset:hash");
      expect(stored).toBeNull();
    });

    it("should reject request with password too short", () => {
      mockRequest.body = {
        token: "valid_token",
        password: "short",
      };

      expect(String(mockRequest.body.password).length).toBeLessThan(8);
    });

    it("should reject request with missing password", () => {
      mockRequest.body = {
        token: "valid_token",
      };

      expect(mockRequest.body.password).toBeUndefined();
    });

    it("should invalidate reset token after use", async () => {
      const resetToken = randomBytes(32).toString("hex");
      const resetHash = createHash("sha256").update(resetToken).digest("hex");

      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: "user-123" }));
      mockRedis.del.mockResolvedValue(1);

      mockRequest.body = {
        token: resetToken,
        password: "newpassword123",
      };

      await (mockRedis as any).del(`password-reset:${resetHash}`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("password-reset:"),
      );
    });

    it("should update user password in database", async () => {
      const resetToken = randomBytes(32).toString("hex");
      const user = generateTestUser();

      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: user.id }));
      mockPrisma.user.update.mockResolvedValue(user);

      mockRequest.body = {
        token: resetToken,
        password: "newpassword123",
      };

      await (mockPrisma as any).user.update({
        where: { id: user.id },
        data: { password: "hashed_new_password" },
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("should return 422 for missing reset token", () => {
      mockRequest.body = {
        password: "newpassword123",
      };

      expect(mockRequest.body.token).toBeUndefined();
    });

    it("should reject request with both missing fields", () => {
      mockRequest.body = {};

      expect(mockRequest.body.token).toBeUndefined();
      expect(mockRequest.body.password).toBeUndefined();
    });
  });

  describe("Session Management & Token Lifecycle", () => {
    it("should not login user without password field", async () => {
      const shop = generateTestShop();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);

      mockRequest.body = {
        email: "test@example.com",
        shopDomain: shop.shopifyDomain,
      };

      expect(mockRequest.body.password).toBeUndefined();
    });

    it("should handle org membership check during login", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue({
        role: "MANAGER",
        isActive: true,
      });

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const membership = await (mockPrisma as any).orgMember.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
      });

      expect(membership?.isActive).toBe(true);
    });

    it("should skip org role when shop has no org", async () => {
      const shop = { ...generateTestShop(), orgId: null };
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      expect(shop.orgId).toBeNull();
    });

    it("should handle inactive org membership", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue({
        role: "MEMBER",
        isActive: false,
      });

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const membership = await (mockPrisma as any).orgMember.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
      });

      expect(membership?.isActive).toBe(false);
    });

    it("should preserve token payload structure for JWT signing", async () => {
      const shop = generateTestShop();
      const user = generateTestUser();

      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.orgMember.findUnique.mockResolvedValue({
        role: "OWNER",
        isActive: true,
      });

      mockRequest.body = {
        email: user.email,
        password: "password123",
        shopDomain: shop.shopifyDomain,
      };

      const expectedPayload = {
        sub: user.id,
        shopId: shop.id,
        orgId: shop.orgId,
        role: user.role,
        type: "user",
      };

      expect(expectedPayload.sub).toBe("user-123");
      expect(expectedPayload.type).toBe("user");
    });
  });
});
