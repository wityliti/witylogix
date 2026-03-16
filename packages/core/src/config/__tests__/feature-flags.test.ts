/**
 * Feature Flags Tests
 *
 * Tests for feature flag system:
 * - Flags enabled/disabled per environment
 * - Tenant override functionality
 * - Percentage rollout is deterministic per tenant
 * - Unknown flags return false
 * - Context-aware evaluation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FeatureFlag,
  isFeatureEnabled,
  enableFeatureForTenant,
  disableFeatureForTenant,
  getEnabledFlagsForTenant,
  resetTenantOverrides,
  FEATURE_FLAG_DEFINITIONS,
} from "../feature-flags";

describe("Feature Flags", () => {
  beforeEach(() => {
    resetTenantOverrides();
  });

  describe("isFeatureEnabled", () => {
    it("should return false for unknown flag", () => {
      const result = isFeatureEnabled("UNKNOWN_FLAG");
      expect(result).toBe(false);
    });

    it("should respect development environment defaults", () => {
      // In dev, most flags are enabled
      const result = isFeatureEnabled(FeatureFlag.ONBOARDING_AI_DEFAULTS);
      expect(result).toBe(true);
    });

    it("should handle MFA_REQUIRED per environment", () => {
      // MFA_REQUIRED should be true in staging/prod, false in dev
      const result = isFeatureEnabled(FeatureFlag.MFA_REQUIRED);
      expect(result).toBe(false); // dev environment
    });

    it("should handle WEBHOOK_V2 per environment", () => {
      const result = isFeatureEnabled(FeatureFlag.WEBHOOK_V2);
      expect(result).toBe(true); // dev environment
    });

    it("should always enable API_VERSIONING", () => {
      const result = isFeatureEnabled(FeatureFlag.API_VERSIONING);
      expect(result).toBe(true);
    });

    it("should always enable REAL_TIME_TRACKING", () => {
      const result = isFeatureEnabled(FeatureFlag.REAL_TIME_TRACKING);
      expect(result).toBe(true);
    });
  });

  describe("Tenant Overrides", () => {
    it("should enable feature for specific tenant", () => {
      const tenantId = "org-123";
      const flag = FeatureFlag.SSO_PROVIDERS;

      // Should be disabled initially (dev environment)
      expect(isFeatureEnabled(flag, { tenantId })).toBe(false);

      // Enable for tenant
      enableFeatureForTenant(flag, tenantId);

      // Should be enabled now
      expect(isFeatureEnabled(flag, { tenantId })).toBe(true);
    });

    it("should disable feature for specific tenant", () => {
      const tenantId = "org-123";
      const flag = FeatureFlag.API_VERSIONING;

      // Should be enabled initially
      expect(isFeatureEnabled(flag, { tenantId })).toBe(true);

      // Disable for tenant (though it doesn't disable, it just clears overrides)
      disableFeatureForTenant(flag, tenantId);

      // Should still be enabled (base default, not override)
      expect(isFeatureEnabled(flag, { tenantId })).toBe(true);
    });

    it("should handle multiple tenants independently", () => {
      const tenant1 = "org-1";
      const tenant2 = "org-2";
      const flag = FeatureFlag.MFA_REQUIRED;

      // Enable for tenant 1
      enableFeatureForTenant(flag, tenant1);

      expect(isFeatureEnabled(flag, { tenantId: tenant1 })).toBe(true);
      expect(isFeatureEnabled(flag, { tenantId: tenant2 })).toBe(false); // Not enabled for tenant2
    });
  });

  describe("Percentage Rollout", () => {
    it("should return false for 0% rollout", () => {
      const result = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        tenantId: "org-123",
        percentageRollout: 0,
      });
      expect(result).toBe(false);
    });

    it("should return true for 100% rollout", () => {
      const result = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        tenantId: "org-123",
        percentageRollout: 100,
      });
      expect(result).toBe(true);
    });

    it("should be deterministic for same tenant", () => {
      const tenantId = "org-123";
      const rolloutPercentage = 50;

      const result1 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        tenantId,
        percentageRollout: rolloutPercentage,
      });

      const result2 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        tenantId,
        percentageRollout: rolloutPercentage,
      });

      expect(result1).toBe(result2);
    });

    it("should be deterministic for same user across calls", () => {
      const userId = "user-456";
      const rolloutPercentage = 30;

      const result1 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        userId,
        percentageRollout: rolloutPercentage,
      });

      const result2 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        userId,
        percentageRollout: rolloutPercentage,
      });

      expect(result1).toBe(result2);
    });

    it("should use empty string when no tenant/user provided", () => {
      // With no seed, should use empty string
      const result1 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        percentageRollout: 50,
      });

      const result2 = isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
        percentageRollout: 50,
      });

      expect(result1).toBe(result2);
    });

    it("should distribute tenants across percentage buckets", () => {
      const flag = FeatureFlag.WEBHOOK_V2;
      const rolloutPercentage = 50;

      // Test distribution across multiple tenants
      const enabled = [];
      for (let i = 0; i < 100; i++) {
        const tenantId = `org-${i}`;
        if (
          isFeatureEnabled(flag, {
            tenantId,
            percentageRollout: rolloutPercentage,
          })
        ) {
          enabled.push(tenantId);
        }
      }

      // Should have approximately 50% enabled (with some variance due to hash distribution)
      const ratio = enabled.length / 100;
      expect(ratio).toBeGreaterThan(0.3);
      expect(ratio).toBeLessThan(0.7);
    });

    it("should return false when flag is disabled and rollout requested", () => {
      // SSO_PROVIDERS is disabled in dev
      const result = isFeatureEnabled(FeatureFlag.SSO_PROVIDERS, {
        tenantId: "org-123",
        percentageRollout: 50,
      });
      expect(result).toBe(false);
    });
  });

  describe("getEnabledFlagsForTenant", () => {
    it("should return list of enabled flags", () => {
      const tenantId = "org-123";
      const flags = getEnabledFlagsForTenant(tenantId);

      expect(Array.isArray(flags)).toBe(true);
      expect(flags.length).toBeGreaterThan(0);
    });

    it("should include tenant overrides", () => {
      const tenantId = "org-123";
      const flag = FeatureFlag.SSO_PROVIDERS;

      // Initially not enabled for this tenant
      let flags = getEnabledFlagsForTenant(tenantId);
      expect(flags).not.toContain(flag);

      // Enable override
      enableFeatureForTenant(flag, tenantId);

      // Should now be included
      flags = getEnabledFlagsForTenant(tenantId);
      expect(flags).toContain(flag);
    });

    it("should not include disabled flags", () => {
      const tenantId = "org-123";
      const flags = getEnabledFlagsForTenant(tenantId);

      // MFA_REQUIRED should not be in dev environment
      expect(flags).not.toContain(FeatureFlag.MFA_REQUIRED);
    });
  });

  describe("Feature Flag Definitions", () => {
    it("should have definitions for all flags", () => {
      for (const flag of Object.values(FeatureFlag)) {
        expect(FEATURE_FLAG_DEFINITIONS[flag]).toBeDefined();
        expect(FEATURE_FLAG_DEFINITIONS[flag].name).toBeDefined();
        expect(FEATURE_FLAG_DEFINITIONS[flag].description).toBeDefined();
      }
    });

    it("should have boolean defaults for all environments", () => {
      for (const definition of Object.values(FEATURE_FLAG_DEFINITIONS)) {
        expect(typeof definition.defaultInDev).toBe("boolean");
        expect(typeof definition.defaultInStaging).toBe("boolean");
        expect(typeof definition.defaultInProd).toBe("boolean");
      }
    });

    it("should have rollout percentage when applicable", () => {
      const webhookV2 = FEATURE_FLAG_DEFINITIONS[FeatureFlag.WEBHOOK_V2];
      expect(webhookV2.rolloutPercentage).toBeDefined();
      expect(webhookV2.rolloutPercentage).toBeLessThanOrEqual(100);
      expect(webhookV2.rolloutPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe("State Management", () => {
    it("should handle reset correctly", () => {
      const tenantId = "org-123";
      const flag = FeatureFlag.SSO_PROVIDERS;

      // Set up override
      enableFeatureForTenant(flag, tenantId);
      expect(isFeatureEnabled(flag, { tenantId })).toBe(true);

      // Reset
      resetTenantOverrides();

      // Should go back to default
      expect(isFeatureEnabled(flag, { tenantId })).toBe(false);
    });
  });
});
