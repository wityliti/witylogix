/**
 * API Versioning Tests — Version detection and transformation.
 *
 * Tests cover:
 * - Version detection (path, header, query)
 * - Deprecation warnings
 * - Response transformation
 * - Version negotiation
 * - Sunset headers
 *
 * Run with: npm test -- api-versioning.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ApiVersionManager } from "../api-versioning";

describe("ApiVersionManager", () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    manager = new ApiVersionManager({
      defaultVersion: "v1",
      minSupportedVersion: "v1",
      versions: {
        v1: {
          version: "v1",
          deprecated: false,
        },
        v2: {
          version: "v2",
          deprecated: false,
        },
        v3: {
          version: "v3",
          deprecated: true,
          sunsetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          replacedBy: "v4",
        },
        v4: {
          version: "v4",
          deprecated: false,
        },
      },
      transformers: {
        v2: (data: any) => ({
          ...data,
          _version: "v2",
        }),
      },
    });
  });

  describe("Version detection", () => {
    it("should detect version from URL path", () => {
      const version = manager.detectVersion({
        path: "/v2/users",
      });

      expect(version).toBe("v2");
    });

    it("should detect version from Accept-Version header", () => {
      const version = manager.detectVersion({
        headers: { "accept-version": "v3" },
      });

      expect(version).toBe("v3");
    });

    it("should detect version from X-API-Version header", () => {
      const version = manager.detectVersion({
        headers: { "x-api-version": "v2" },
      });

      expect(version).toBe("v2");
    });

    it("should detect version from query parameter", () => {
      const version = manager.detectVersion({
        query: { apiVersion: "v4" },
      });

      expect(version).toBe("v4");
    });

    it("should prioritize path over headers", () => {
      const version = manager.detectVersion({
        path: "/v2/users",
        headers: { "accept-version": "v4" },
      });

      expect(version).toBe("v2");
    });

    it("should use default version if not specified", () => {
      const version = manager.detectVersion({});

      expect(version).toBe("v1");
    });

    it("should normalize version format (v1, 1, V1)", () => {
      const v1 = manager.detectVersion({ query: { apiVersion: "1" } });
      const v2 = manager.detectVersion({ query: { apiVersion: "v1" } });
      const v3 = manager.detectVersion({ query: { apiVersion: "V1" } });

      expect(v1).toBe("v1");
      expect(v2).toBe("v1");
      expect(v3).toBe("v1");
    });
  });

  describe("Version support", () => {
    it("should recognize supported versions", () => {
      expect(manager.isSupported("v1")).toBe(true);
      expect(manager.isSupported("v2")).toBe(true);
      expect(manager.isSupported("v4")).toBe(true);
    });

    it("should recognize unsupported versions", () => {
      expect(manager.isSupported("v0")).toBe(false);
      expect(manager.isSupported("v99")).toBe(false);
    });

    it("should get supported versions list", () => {
      const supported = manager.getSupportedVersions();

      expect(supported).toContain("v1");
      expect(supported).toContain("v2");
      expect(supported).toContain("v4");
    });
  });

  describe("Deprecation", () => {
    it("should identify deprecated versions", () => {
      expect(manager.isDeprecated("v1")).toBe(false);
      expect(manager.isDeprecated("v3")).toBe(true);
    });

    it("should get deprecation info", () => {
      const info = manager.getDeprecationInfo("v3");

      expect(info.deprecated).toBe(true);
      expect(info.replacedBy).toBe("v4");
      expect(info.sunsetDate).toBeDefined();
    });

    it("should deprecate version at runtime", () => {
      manager.deprecateVersion(
        "v1",
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        "v2"
      );

      expect(manager.isDeprecated("v1")).toBe(true);
    });

    it("should generate deprecation warning header", () => {
      const info = manager.getDeprecationInfo("v3");

      expect(info.warningHeader).toContain("rel=\"sunset\"");
    });
  });

  describe("Response transformation", () => {
    it("should transform response for version", () => {
      const data = { id: 1, name: "Test" };
      const transformed = manager.transformResponse("v2", data);

      expect(transformed._version).toBe("v2");
      expect(transformed.id).toBe(1);
    });

    it("should return data unchanged if no transformer", () => {
      const data = { id: 1, name: "Test" };
      const transformed = manager.transformResponse("v1", data);

      expect(transformed).toEqual(data);
      expect(transformed._version).toBeUndefined();
    });
  });

  describe("Response headers", () => {
    it("should include API-Version header", () => {
      const headers = manager.getVersionHeaders("v2");

      expect(headers["API-Version"]).toBe("v2");
    });

    it("should include deprecation headers for deprecated versions", () => {
      const headers = manager.getVersionHeaders("v3");

      expect(headers["Deprecation"]).toBe("true");
      expect(headers["Sunset"]).toBeDefined();
      expect(headers["Link"]).toContain("v4");
      expect(headers["Warning"]).toContain("Deprecated");
    });

    it("should not include deprecation headers for active versions", () => {
      const headers = manager.getVersionHeaders("v2");

      expect(headers["Deprecation"]).toBeUndefined();
      expect(headers["Sunset"]).toBeUndefined();
    });
  });

  describe("Version registration", () => {
    it("should register new version at runtime", () => {
      manager.registerVersion("v5", {
        version: "v5",
        deprecated: false,
      });

      expect(manager.isSupported("v5")).toBe(true);
    });

    it("should register transformer with version", () => {
      manager.registerVersion(
        "v5",
        { version: "v5", deprecated: false },
        (data: any) => ({ ...data, v5: true })
      );

      const transformed = manager.transformResponse("v5", { id: 1 });
      expect(transformed.v5).toBe(true);
    });
  });

  describe("Configuration validation", () => {
    it("should validate default version exists", () => {
      expect(() => {
        new ApiVersionManager({
          defaultVersion: "nonexistent",
          minSupportedVersion: "v1",
          versions: { v1: { version: "v1" } },
        });
      }).toThrow();
    });

    it("should validate min supported version exists", () => {
      expect(() => {
        new ApiVersionManager({
          defaultVersion: "v1",
          minSupportedVersion: "nonexistent",
          versions: { v1: { version: "v1" } },
        });
      }).toThrow();
    });
  });

  describe("Version info", () => {
    it("should get all versions", () => {
      const versions = manager.getAllVersions();

      expect(versions.length).toBeGreaterThan(0);
    });

    it("should track deprecation dates", () => {
      manager.deprecateVersion(
        "v2",
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      const versions = manager.getAllVersions();
      const v2 = versions.find((v) => v.version === "v2");

      expect(v2?.deprecatedDate).toBeDefined();
    });
  });
});
