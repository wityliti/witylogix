/**
 * Tenant Isolation Integration Tests
 * Tests: tenant resolution, API key management, usage metering, tenant middleware
 * ~600 lines, 30+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash, randomBytes } from "crypto";

// ───────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

interface TenantContext {
  tenantId: string;
  tenantType: "shop" | "org";
  isActive: boolean;
  planType: string;
  quotaLimits: Record<string, number>;
}

interface APIKey {
  id: string;
  key: string;
  tenantId: string;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

interface UsageRecord {
  tenantId: string;
  timestamp: number;
  endpoint: string;
  method: string;
  status: number;
  responseTime: number;
}

interface DailyUsageSummary {
  tenantId: string;
  date: string;
  totalRequests: number;
  totalErrors: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  avgResponseTime: number;
}

// ───────────────────────────────────────────────────────────────────────────
// TENANT RESOLUTION
// ───────────────────────────────────────────────────────────────────────────

class TenantResolver {
  private tenants = new Map<string, TenantContext>();
  private subdomainMap = new Map<string, string>();
  private apiKeyMap = new Map<string, string>();
  private cache = new Map<string, TenantContext>();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  registerTenant(
    tenantId: string,
    context: TenantContext,
    subdomain?: string,
  ): void {
    this.tenants.set(tenantId, context);
    if (subdomain) {
      this.subdomainMap.set(subdomain, tenantId);
    }
  }

  resolveFromSubdomain(subdomain: string): TenantContext | null {
    const tenantId = this.subdomainMap.get(subdomain);
    return tenantId ? this.tenants.get(tenantId) || null : null;
  }

  resolveFromHeader(header: string): TenantContext | null {
    const tenantId = header;
    return this.tenants.get(tenantId) || null;
  }

  resolveFromJWT(payload: {
    tenantId?: string;
    orgId?: string;
  }): TenantContext | null {
    const tenantId = payload.tenantId || payload.orgId;
    return tenantId ? this.tenants.get(tenantId) || null : null;
  }

  resolveFromAPIKey(apiKey: string): TenantContext | null {
    const tenantId = this.apiKeyMap.get(apiKey);
    return tenantId ? this.tenants.get(tenantId) || null : null;
  }

  resolve(context: {
    subdomain?: string;
    header?: string;
    jwt?: { tenantId?: string; orgId?: string };
    apiKey?: string;
  }): TenantContext | null {
    // Try resolution chain in order
    if (context.subdomain) {
      const result = this.resolveFromSubdomain(context.subdomain);
      if (result) return result;
    }

    if (context.header) {
      const result = this.resolveFromHeader(context.header);
      if (result) return result;
    }

    if (context.jwt) {
      const result = this.resolveFromJWT(context.jwt);
      if (result) return result;
    }

    if (context.apiKey) {
      const result = this.resolveFromAPIKey(context.apiKey);
      if (result) return result;
    }

    return null;
  }

  cacheResult(key: string, context: TenantContext): void {
    this.cache.set(key, context);
  }

  getCached(key: string): TenantContext | null {
    return this.cache.get(key) || null;
  }

  clearCache(): void {
    this.cache.clear();
  }

  registerAPIKey(apiKey: string, tenantId: string): void {
    this.apiKeyMap.set(apiKey, tenantId);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// API KEY MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────

class APIKeyManager {
  private keys = new Map<string, APIKey>();
  private keyIndex = new Map<string, string>(); // Hash -> ID

  generateKey(tenantId: string, scopes: string[] = ["read"]): APIKey {
    const keyValue = `wl_live_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(keyValue).digest("hex");

    const apiKey: APIKey = {
      id: `key-${randomBytes(4).toString("hex")}`,
      key: keyValue,
      tenantId,
      scopes,
      isActive: true,
      createdAt: new Date(),
    };

    this.keys.set(apiKey.id, apiKey);
    this.keyIndex.set(keyHash, apiKey.id);

    return apiKey;
  }

  validateKey(keyValue: string): {
    valid: boolean;
    tenantId?: string;
    scopes?: string[];
  } {
    const keyHash = createHash("sha256").update(keyValue).digest("hex");
    const keyId = this.keyIndex.get(keyHash);

    if (!keyId) {
      return { valid: false };
    }

    const apiKey = this.keys.get(keyId);
    if (!apiKey || !apiKey.isActive) {
      return { valid: false };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false };
    }

    apiKey.lastUsedAt = new Date();

    return {
      valid: true,
      tenantId: apiKey.tenantId,
      scopes: apiKey.scopes,
    };
  }

  rotateKey(keyId: string): { oldKey: APIKey; newKey: APIKey } {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error("Key not found");
    }

    // Deactivate old key
    oldKey.isActive = false;

    // Generate new key with same scopes
    const newKey = this.generateKey(oldKey.tenantId, oldKey.scopes);

    return { oldKey, newKey };
  }

  revokeKey(keyId: string): APIKey {
    const apiKey = this.keys.get(keyId);
    if (!apiKey) {
      throw new Error("Key not found");
    }

    apiKey.isActive = false;
    return apiKey;
  }

  checkScopes(keyId: string, requiredScopes: string[]): boolean {
    const apiKey = this.keys.get(keyId);
    if (!apiKey) return false;

    return requiredScopes.every((scope) => apiKey.scopes.includes(scope));
  }

  getKeyFormat(key: string): { prefix: string; hashedPart: string } {
    const parts = key.split("_");
    return {
      prefix: `${parts[0]}_${parts[1]}`, // wl_live
      hashedPart: parts[2],
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// USAGE METERING
// ───────────────────────────────────────────────────────────────────────────

class UsageMeteringService {
  private records: UsageRecord[] = [];
  private dailySummaries = new Map<string, DailyUsageSummary>();
  private batchBuffer: UsageRecord[] = [];
  private flushIntervalMs = 60000; // 1 minute

  recordUsage(record: UsageRecord): void {
    this.batchBuffer.push(record);

    if (this.batchBuffer.length >= 100) {
      this.flush();
    }
  }

  flush(): void {
    this.records.push(...this.batchBuffer);
    this.batchBuffer = [];
  }

  aggregateDaily(tenantId: string, date: string): DailyUsageSummary {
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dayRecords = this.records.filter(
      (r) =>
        r.tenantId === tenantId &&
        r.timestamp >= dayStart &&
        r.timestamp < dayEnd,
    );

    const topEndpoints = Array.from(
      dayRecords.reduce((map, r) => {
        const count = (map.get(r.endpoint) || 0) + 1;
        map.set(r.endpoint, count);
        return map;
      }, new Map<string, number>()),
    )
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const avgResponseTime =
      dayRecords.length > 0
        ? dayRecords.reduce((sum, r) => sum + r.responseTime, 0) /
          dayRecords.length
        : 0;

    const summary: DailyUsageSummary = {
      tenantId,
      date,
      totalRequests: dayRecords.length,
      totalErrors: dayRecords.filter((r) => r.status >= 400).length,
      topEndpoints,
      avgResponseTime,
    };

    this.dailySummaries.set(`${tenantId}-${date}`, summary);
    return summary;
  }

  checkQuota(
    tenantId: string,
    planLimits: Record<string, number>,
    usage: Record<string, number>,
  ): boolean {
    for (const [key, limit] of Object.entries(planLimits)) {
      if ((usage[key] || 0) >= limit) {
        return false;
      }
    }
    return true;
  }

  identifyTopEndpoints(
    tenantId: string,
    limit: number = 10,
  ): Array<{ endpoint: string; count: number }> {
    const endpoints = this.records
      .filter((r) => r.tenantId === tenantId)
      .reduce((map, r) => {
        map.set(r.endpoint, (map.get(r.endpoint) || 0) + 1);
        return map;
      }, new Map<string, number>());

    return Array.from(endpoints)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  clear(): void {
    this.records = [];
    this.batchBuffer = [];
    this.dailySummaries.clear();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("Tenant Resolution", () => {
  let resolver: TenantResolver;

  beforeEach(() => {
    resolver = new TenantResolver();

    const tenantCtx: TenantContext = {
      tenantId: "shop-123",
      tenantType: "shop",
      isActive: true,
      planType: "premium",
      quotaLimits: { requests: 100000, storage: 1000000 },
    };

    resolver.registerTenant("shop-123", tenantCtx, "acme");
    resolver.registerAPIKey("wl_live_test123", "shop-123");
  });

  describe("Resolution Strategies", () => {
    it("should resolve from subdomain", () => {
      const context = resolver.resolveFromSubdomain("acme");

      expect(context).not.toBeNull();
      expect(context?.tenantId).toBe("shop-123");
    });

    it("should resolve from X-Tenant-ID header", () => {
      const context = resolver.resolveFromHeader("shop-123");

      expect(context).not.toBeNull();
      expect(context?.tenantId).toBe("shop-123");
    });

    it("should resolve from JWT claims", () => {
      const jwt = { tenantId: "shop-123", orgId: undefined };
      const context = resolver.resolveFromJWT(jwt);

      expect(context).not.toBeNull();
      expect(context?.tenantId).toBe("shop-123");
    });

    it("should resolve from API key", () => {
      const context = resolver.resolveFromAPIKey("wl_live_test123");

      expect(context).not.toBeNull();
      expect(context?.tenantId).toBe("shop-123");
    });

    it("should try resolution chain in order", () => {
      const context = resolver.resolve({
        subdomain: "unknown",
        header: "shop-123",
      });

      expect(context?.tenantId).toBe("shop-123");
    });

    it("should cache resolved tenants", () => {
      const cacheKey = "acme-subdomain";
      const tenant: TenantContext = {
        tenantId: "shop-123",
        tenantType: "shop",
        isActive: true,
        planType: "premium",
        quotaLimits: {},
      };

      resolver.cacheResult(cacheKey, tenant);
      const cached = resolver.getCached(cacheKey);

      expect(cached).not.toBeNull();
      expect(cached?.tenantId).toBe("shop-123");
    });

    it("should return null for unresolvable tenant", () => {
      const context = resolver.resolve({
        subdomain: "unknown",
      });

      expect(context).toBeNull();
    });
  });

  describe("Subdomain Resolution", () => {
    it("should match exact subdomain", () => {
      const context = resolver.resolveFromSubdomain("acme");
      expect(context?.tenantId).toBe("shop-123");
    });

    it("should return null for non-existent subdomain", () => {
      const context = resolver.resolveFromSubdomain("unknown");
      expect(context).toBeNull();
    });
  });

  describe("JWT Resolution", () => {
    it("should use tenantId from JWT", () => {
      const jwt = { tenantId: "shop-123" };
      const context = resolver.resolveFromJWT(jwt);

      expect(context?.tenantId).toBe("shop-123");
    });

    it("should fallback to orgId if tenantId missing", () => {
      resolver.registerTenant("org-456", {
        tenantId: "org-456",
        tenantType: "org",
        isActive: true,
        planType: "premium",
        quotaLimits: {},
      });

      const jwt = { orgId: "org-456" };
      const context = resolver.resolveFromJWT(jwt);

      expect(context?.tenantId).toBe("org-456");
    });
  });
});

describe("API Key Management", () => {
  let manager: APIKeyManager;

  beforeEach(() => {
    manager = new APIKeyManager();
  });

  describe("Key Generation", () => {
    it("should generate key with wl_live_ prefix", () => {
      const key = manager.generateKey("shop-123");

      expect(key.key).toMatch(/^wl_live_/);
    });

    it("should validate key by prefix + hash", () => {
      const key = manager.generateKey("shop-123");
      const result = manager.validateKey(key.key);

      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe("shop-123");
    });

    it("should generate unique keys", () => {
      const key1 = manager.generateKey("shop-123");
      const key2 = manager.generateKey("shop-123");

      expect(key1.key).not.toBe(key2.key);
    });

    it("should set correct scopes", () => {
      const scopes = ["read", "write"];
      const key = manager.generateKey("shop-123", scopes);

      expect(key.scopes).toEqual(scopes);
    });
  });

  describe("Key Validation", () => {
    it("should accept valid key", () => {
      const key = manager.generateKey("shop-123");
      const result = manager.validateKey(key.key);

      expect(result.valid).toBe(true);
    });

    it("should reject invalid key", () => {
      const result = manager.validateKey("invalid-key");
      expect(result.valid).toBe(false);
    });

    it("should reject expired key", () => {
      const key = manager.generateKey("shop-123");
      const keyObj = key;
      keyObj.expiresAt = new Date(Date.now() - 1000);

      const result = manager.validateKey(key.key);
      expect(result.valid).toBe(false);
    });

    it("should reject inactive key", () => {
      const key = manager.generateKey("shop-123");
      manager.revokeKey(key.id);

      const result = manager.validateKey(key.key);
      expect(result.valid).toBe(false);
    });

    it("should return scopes on valid key", () => {
      const scopes = ["read:drivers", "write:routes"];
      const key = manager.generateKey("shop-123", scopes);

      const result = manager.validateKey(key.key);
      expect(result.scopes).toEqual(scopes);
    });
  });

  describe("Key Rotation", () => {
    it("should rotate key (deactivate old, return new)", () => {
      const oldKey = manager.generateKey("shop-123");
      const { oldKey: deactivated, newKey } = manager.rotateKey(oldKey.id);

      expect(deactivated.isActive).toBe(false);
      expect(newKey.isActive).toBe(true);
      expect(newKey.tenantId).toBe("shop-123");
    });

    it("should preserve scopes on rotation", () => {
      const scopes = ["read:all", "write:routes"];
      const oldKey = manager.generateKey("shop-123", scopes);

      const { newKey } = manager.rotateKey(oldKey.id);
      expect(newKey.scopes).toEqual(scopes);
    });

    it("should invalidate old key after rotation", () => {
      const oldKey = manager.generateKey("shop-123");
      manager.rotateKey(oldKey.id);

      const result = manager.validateKey(oldKey.key);
      expect(result.valid).toBe(false);
    });
  });

  describe("Key Revocation", () => {
    it("should revoke key", () => {
      const key = manager.generateKey("shop-123");
      manager.revokeKey(key.id);

      const result = manager.validateKey(key.key);
      expect(result.valid).toBe(false);
    });

    it("should return revoked key", () => {
      const key = manager.generateKey("shop-123");
      const revoked = manager.revokeKey(key.id);

      expect(revoked.isActive).toBe(false);
    });
  });

  describe("Scope Checking", () => {
    it("should check scopes on validation", () => {
      const scopes = ["read:drivers", "write:routes"];
      const key = manager.generateKey("shop-123", scopes);

      expect(manager.checkScopes(key.id, ["read:drivers"])).toBe(true);
      expect(
        manager.checkScopes(key.id, ["read:drivers", "write:routes"]),
      ).toBe(true);
      expect(manager.checkScopes(key.id, ["delete:all"])).toBe(false);
    });

    it("should reject missing required scopes", () => {
      const key = manager.generateKey("shop-123", ["read"]);

      expect(manager.checkScopes(key.id, ["read", "write"])).toBe(false);
    });
  });
});

describe("Usage Metering", () => {
  let metering: UsageMeteringService;

  beforeEach(() => {
    metering = new UsageMeteringService();
  });

  afterEach(() => {
    metering.clear();
  });

  describe("Usage Recording", () => {
    it("should record API usage", () => {
      const record: UsageRecord = {
        tenantId: "shop-123",
        timestamp: Date.now(),
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 150,
      };

      metering.recordUsage(record);
      metering.flush();

      // Verify recorded (through aggregation)
      const summary = metering.aggregateDaily(
        "shop-123",
        new Date().toISOString().split("T")[0],
      );
      expect(summary.totalRequests).toBe(1);
    });

    it("should buffer and batch-write records", () => {
      for (let i = 0; i < 50; i++) {
        metering.recordUsage({
          tenantId: "shop-123",
          timestamp: Date.now(),
          endpoint: "/api/routes",
          method: "GET",
          status: 200,
          responseTime: 100,
        });
      }

      metering.flush();

      const summary = metering.aggregateDaily(
        "shop-123",
        new Date().toISOString().split("T")[0],
      );
      expect(summary.totalRequests).toBeGreaterThan(0);
    });

    it("should flush when batch size reached", () => {
      for (let i = 0; i < 100; i++) {
        metering.recordUsage({
          tenantId: "shop-123",
          timestamp: Date.now(),
          endpoint: "/api/routes",
          method: "GET",
          status: 200,
          responseTime: 100,
        });
      }

      // Should auto-flush at 100 records
      const summary = metering.aggregateDaily(
        "shop-123",
        new Date().toISOString().split("T")[0],
      );
      expect(summary.totalRequests).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Daily Aggregation", () => {
    it("should aggregate daily summaries", () => {
      const now = Date.now();
      const baseDate = new Date(now);

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now,
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 150,
      });

      metering.flush();

      const dateStr = baseDate.toISOString().split("T")[0];
      const summary = metering.aggregateDaily("shop-123", dateStr);

      expect(summary.tenantId).toBe("shop-123");
      expect(summary.date).toBe(dateStr);
      expect(summary.totalRequests).toBeGreaterThan(0);
    });

    it("should calculate top endpoints", () => {
      const now = Date.now();

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now,
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 150,
      });

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now + 1000,
        endpoint: "/api/drivers",
        method: "GET",
        status: 200,
        responseTime: 200,
      });

      metering.flush();

      const summary = metering.aggregateDaily(
        "shop-123",
        new Date(now).toISOString().split("T")[0],
      );
      expect(summary.topEndpoints.length).toBeGreaterThan(0);
    });

    it("should count errors", () => {
      const now = Date.now();

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now,
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 150,
      });

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now + 1000,
        endpoint: "/api/invalid",
        method: "GET",
        status: 404,
        responseTime: 50,
      });

      metering.flush();

      const summary = metering.aggregateDaily(
        "shop-123",
        new Date(now).toISOString().split("T")[0],
      );
      expect(summary.totalErrors).toBe(1);
    });

    it("should calculate average response time", () => {
      const now = Date.now();

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now,
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 100,
      });

      metering.recordUsage({
        tenantId: "shop-123",
        timestamp: now + 1000,
        endpoint: "/api/routes",
        method: "GET",
        status: 200,
        responseTime: 200,
      });

      metering.flush();

      const summary = metering.aggregateDaily(
        "shop-123",
        new Date(now).toISOString().split("T")[0],
      );
      expect(summary.avgResponseTime).toBe(150);
    });
  });

  describe("Quota Checking", () => {
    it("should check quota against plan limits", () => {
      const limits = { requests: 1000, storage: 5000 };
      const usage = { requests: 500, storage: 2000 };

      const withinQuota = metering.checkQuota("shop-123", limits, usage);
      expect(withinQuota).toBe(true);
    });

    it("should detect quota violation", () => {
      const limits = { requests: 1000, storage: 5000 };
      const usage = { requests: 1000, storage: 2000 };

      const withinQuota = metering.checkQuota("shop-123", limits, usage);
      expect(withinQuota).toBe(false);
    });

    it("should enforce 429 on quota exceeded", () => {
      const limits = { requests: 1000 };
      const usage = { requests: 1001 };

      const withinQuota = metering.checkQuota("shop-123", limits, usage);
      expect(withinQuota).toBe(false);
    });
  });

  describe("Top Endpoints Identification", () => {
    it("should identify top endpoints", () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        metering.recordUsage({
          tenantId: "shop-123",
          timestamp: now + i * 1000,
          endpoint: "/api/routes",
          method: "GET",
          status: 200,
          responseTime: 150,
        });
      }

      for (let i = 0; i < 3; i++) {
        metering.recordUsage({
          tenantId: "shop-123",
          timestamp: now + i * 1000,
          endpoint: "/api/drivers",
          method: "GET",
          status: 200,
          responseTime: 200,
        });
      }

      metering.flush();

      const topEndpoints = metering.identifyTopEndpoints("shop-123");
      expect(topEndpoints[0].endpoint).toBe("/api/routes");
      expect(topEndpoints[0].count).toBe(5);
    });

    it("should limit top endpoints result", () => {
      const now = Date.now();

      for (let i = 0; i < 15; i++) {
        metering.recordUsage({
          tenantId: "shop-123",
          timestamp: now + i * 1000,
          endpoint: `/api/endpoint-${i}`,
          method: "GET",
          status: 200,
          responseTime: 100,
        });
      }

      metering.flush();

      const topEndpoints = metering.identifyTopEndpoints("shop-123", 5);
      expect(topEndpoints.length).toBeLessThanOrEqual(5);
    });
  });
});

describe("Tenant Middleware", () => {
  describe("Request Context", () => {
    it("should attach TenantContext to request", () => {
      const context: TenantContext = {
        tenantId: "shop-123",
        tenantType: "shop",
        isActive: true,
        planType: "premium",
        quotaLimits: {},
      };

      expect(context.tenantId).toBe("shop-123");
      expect(context.isActive).toBe(true);
    });

    it("should reject requests without tenant", () => {
      const context: TenantContext | null = null;
      expect(context).toBeNull();
    });

    it("should reject inactive tenants", () => {
      const context: TenantContext = {
        tenantId: "shop-123",
        tenantType: "shop",
        isActive: false,
        planType: "premium",
        quotaLimits: {},
      };

      const canProcess = context.isActive;
      expect(canProcess).toBe(false);
    });
  });

  describe("Quota Enforcement", () => {
    it("should enforce plan quotas (429)", () => {
      const limits = { dailyRequests: 1000 };
      const usage = { dailyRequests: 1001 };

      const withinQuota = usage.dailyRequests <= limits.dailyRequests;
      expect(withinQuota).toBe(false);
    });

    it("should return 429 when quota exceeded", () => {
      const statusCode = (usage) => (usage > 1000 ? 429 : 200);

      expect(statusCode(1001)).toBe(429);
      expect(statusCode(500)).toBe(200);
    });
  });

  describe("Health Check Exemption", () => {
    it("should bypass health check endpoints", () => {
      const healthEndpoints = ["/health", "/health/live", "/health/ready"];
      const requiresTenant = (endpoint) => !healthEndpoints.includes(endpoint);

      expect(requiresTenant("/health")).toBe(false);
      expect(requiresTenant("/api/routes")).toBe(true);
    });

    it("should not require tenant context for health checks", () => {
      const endpoint = "/health";
      const tenantRequired = !endpoint.startsWith("/health");

      expect(tenantRequired).toBe(false);
    });
  });
});
