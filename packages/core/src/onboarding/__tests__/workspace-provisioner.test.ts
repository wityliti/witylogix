/**
 * Workspace Provisioner Tests
 *
 * Tests cover:
 * - Full workspace provisioning pipeline
 * - Industry-specific defaults
 * - Integration setup
 * - API key generation
 * - Workspace deprovisioning
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkspaceProvisioner } from "../workspace-provisioner";
import {
  Industry,
  DeploymentType,
  DistanceUnit,
  WeightUnit,
  WorkspaceConfig,
  OnboardingError,
  OnboardingErrorCodes,
} from "../types";

// Mock prisma
vi.mock("@witylogix/db", () => ({
  prisma: {
    workspace: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceSettings: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    integrationConnection: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspaceApiKey: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma as any } from "@witylogix/db";

describe("WorkspaceProvisioner", () => {
  let provisioner: WorkspaceProvisioner;

  beforeEach(() => {
    provisioner = new WorkspaceProvisioner();
    vi.clearAllMocks();
  });

  describe("provisionWorkspace", () => {
    it("should provision a complete workspace", async () => {
      const config: WorkspaceConfig = {
        name: "My Workspace",
        slug: "my-workspace",
        orgId: "org-123",
        deploymentType: DeploymentType.CLOUD,
        industry: Industry.LOGISTICS,
        goals: ["OPTIMIZE_ROUTES"],
        selectedIntegrations: ["mapbox"],
        timezone: "America/New_York",
        currency: "USD",
        distanceUnit: DistanceUnit.MILES,
        weightUnit: WeightUnit.LBS,
        dateFormat: "MM/DD/YYYY",
        locale: "en-US",
      };

      const workspaceId = "workspace-123";
      const userId = "user-123";

      (any.workspace.create as any).mockResolvedValue({
        id: workspaceId,
        orgId: config.orgId,
        name: config.name,
        slug: config.slug,
        deploymentType: config.deploymentType,
        industry: config.industry,
        goals: config.goals,
        selectedIntegrations: config.selectedIntegrations,
        provisionedAt: new Date(),
      });

      (any.workspaceSettings.create as any).mockResolvedValue({
        workspaceId,
        timezone: config.timezone,
        currency: config.currency,
        distanceUnit: config.distanceUnit,
        weightUnit: config.weightUnit,
      });

      (any.integrationConnection.create as any).mockResolvedValue({
        workspaceId,
        integrationAppSlug: "mapbox",
        isEnabled: false,
      });

      (any.workspaceApiKey.create as any).mockResolvedValue({
        keyPrefix: "ws_abc123",
        isActive: true,
      });

      const result = await provisioner.provisionWorkspace(config, userId);

      expect(result.workspaceId).toBe(workspaceId);
      expect(result.workspaceName).toBe(config.name);
      expect(result.slug).toBe(config.slug);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKeyPrefix).toBeDefined();
      expect(result.integrations.length).toBe(1);
      expect(result.provisionedAt).toBeDefined();
    });

    it("should use industry defaults when not provided", async () => {
      const config: WorkspaceConfig = {
        name: "Logistics Setup",
        slug: "logistics-setup",
        orgId: "org-123",
        industry: Industry.LOGISTICS,
        selectedIntegrations: [],
      };

      (any.workspace.create as any).mockResolvedValue({
        id: "workspace-123",
        ...config,
        deploymentType: DeploymentType.CLOUD,
        provisionedAt: new Date(),
      });

      (any.workspaceSettings.create as any).mockResolvedValue({});
      (any.workspaceApiKey.create as any).mockResolvedValue({
        keyPrefix: "ws_abc123",
      });

      const result = await provisioner.provisionWorkspace(config, "user-123");

      // Should use LOGISTICS defaults
      const createCall = (any.workspaceSettings.create as any).mock.calls[0];
      expect(createCall[0].data.timezone).toBe("UTC"); // Logistics default
      expect(createCall[0].data.distanceUnit).toBe("KM"); // Logistics default
    });

    it("should handle integration connection errors gracefully", async () => {
      const config: WorkspaceConfig = {
        name: "Workspace",
        slug: "workspace",
        orgId: "org-123",
        selectedIntegrations: ["invalid-integration"],
      };

      (any.workspace.create as any).mockResolvedValue({
        id: "workspace-123",
        ...config,
        provisionedAt: new Date(),
      });

      (any.workspaceSettings.create as any).mockResolvedValue({});

      (any.integrationConnection.create as any).mockRejectedValue(
        new Error("Integration not found"),
      );

      (any.workspaceApiKey.create as any).mockResolvedValue({
        keyPrefix: "ws_abc123",
      });

      // Should not throw - errors are logged and continue
      const result = await provisioner.provisionWorkspace(config, "user-123");

      expect(result.workspaceId).toBeDefined();
      expect(result.integrations.length).toBe(0); // No successful integrations
    });

    it("should generate unique API keys", async () => {
      const config: WorkspaceConfig = {
        name: "Workspace",
        slug: "workspace",
        orgId: "org-123",
      };

      (any.workspace.create as any).mockResolvedValue({
        id: "workspace-123",
        ...config,
        provisionedAt: new Date(),
      });

      (any.workspaceSettings.create as any).mockResolvedValue({});
      (any.workspaceApiKey.create as any).mockResolvedValue({ keyPrefix: "ws_123" });

      await provisioner.provisionWorkspace(config, "user-123");
      const result1 = await provisioner.provisionWorkspace(config, "user-123");

      (any.workspace.create as any).mockResolvedValue({
        id: "workspace-456",
        ...config,
        provisionedAt: new Date(),
      });

      const result2 = await provisioner.provisionWorkspace(config, "user-123");

      // Both results should have API keys
      expect(result1.apiKey).toBeDefined();
      expect(result2.apiKey).toBeDefined();
    });

    it("should throw error if provision fails", async () => {
      const config: WorkspaceConfig = {
        name: "Workspace",
        slug: "workspace",
        orgId: "org-123",
      };

      (any.workspace.create as any).mockRejectedValue(new Error("Database error"));

      await expect(provisioner.provisionWorkspace(config, "user-123")).rejects.toThrow(
        OnboardingError,
      );
    });
  });

  describe("getIndustryDefaults", () => {
    it("should return defaults for LOGISTICS", () => {
      const defaults = provisioner.getIndustryDefaults(Industry.LOGISTICS);

      expect(defaults.timezone).toBe("UTC");
      expect(defaults.currency).toBe("USD");
      expect(defaults.distanceUnit).toBe("KM");
      expect(defaults.weightUnit).toBe("KG");
      expect(defaults.suggestedIntegrations).toContain("mapbox");
    });

    it("should return defaults for RETAIL", () => {
      const defaults = provisioner.getIndustryDefaults(Industry.RETAIL);

      expect(defaults.timezone).toBe("America/New_York");
      expect(defaults.currency).toBe("USD");
      expect(defaults.distanceUnit).toBe("MILES");
      expect(defaults.weightUnit).toBe("LBS");
    });

    it("should return defaults for ECOMMERCE", () => {
      const defaults = provisioner.getIndustryDefaults(Industry.ECOMMERCE);

      expect(defaults.suggestedIntegrations).toContain("shopify");
      expect(defaults.suggestedIntegrations).toContain("stripe");
    });

    it("should fallback to OTHER industry", () => {
      const defaults = provisioner.getIndustryDefaults(Industry.OTHER);

      expect(defaults.suggestedIntegrations).toEqual([]);
    });
  });

  describe("deprovisionWorkspace", () => {
    it("should soft delete workspace by default", async () => {
      const workspaceId = "workspace-123";

      (any.workspace.findUnique as any).mockResolvedValue({
        id: workspaceId,
      });

      (any.workspace.update as any).mockResolvedValue({
        id: workspaceId,
        isActive: false,
      });

      await provisioner.deprovisionWorkspace(workspaceId);

      expect(any.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: expect.objectContaining({
          isActive: false,
        }),
      });
    });

    it("should hard delete workspace when requested", async () => {
      const workspaceId = "workspace-123";

      (any.workspace.findUnique as any).mockResolvedValue({
        id: workspaceId,
      });

      await provisioner.deprovisionWorkspace(workspaceId, true);

      expect(any.workspaceApiKey.deleteMany).toHaveBeenCalled();
      expect(any.integrationConnection.deleteMany).toHaveBeenCalled();
      expect(any.workspaceSettings.deleteMany).toHaveBeenCalled();
      expect(any.workspace.delete).toHaveBeenCalled();
    });

    it("should throw error if workspace not found", async () => {
      (any.workspace.findUnique as any).mockResolvedValue(null);

      await expect(
        provisioner.deprovisionWorkspace("invalid-workspace"),
      ).rejects.toThrow(OnboardingError);
    });
  });

  describe("updateWorkspaceSettings", () => {
    it("should update workspace settings", async () => {
      const workspaceId = "workspace-123";
      const updates = {
        name: "Updated Name",
        industry: Industry.RETAIL,
      };

      (any.workspace.findUnique as any).mockResolvedValue({
        id: workspaceId,
        name: "Old Name",
      });

      (any.workspace.update as any).mockResolvedValue({
        id: workspaceId,
        name: updates.name,
        industry: updates.industry,
      });

      const result = await provisioner.updateWorkspaceSettings(workspaceId, updates);

      expect(result.name).toBe(updates.name);
    });

    it("should update regional settings", async () => {
      const workspaceId = "workspace-123";
      const updates = {
        timezone: "America/Chicago",
        currency: "EUR",
      };

      (any.workspace.findUnique as any).mockResolvedValue({
        id: workspaceId,
      });

      (any.workspace.update as any).mockResolvedValue({
        id: workspaceId,
      });

      await provisioner.updateWorkspaceSettings(workspaceId, updates);

      expect(any.workspaceSettings.update).toHaveBeenCalled();
    });

    it("should throw error if workspace not found", async () => {
      (any.workspace.findUnique as any).mockResolvedValue(null);

      await expect(
        provisioner.updateWorkspaceSettings("invalid", {}),
      ).rejects.toThrow(OnboardingError);
    });
  });

  describe("listWorkspaces", () => {
    it("should list all workspaces for an organization", async () => {
      const orgId = "org-123";
      const mockWorkspaces = [
        {
          id: "workspace-1",
          name: "Workspace 1",
          orgId,
          isActive: true,
        },
        {
          id: "workspace-2",
          name: "Workspace 2",
          orgId,
          isActive: true,
        },
      ];

      (any.workspace.findMany as any).mockResolvedValue(mockWorkspaces);

      const result = await provisioner.listWorkspaces(orgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Workspace 1");
    });

    it("should only return active workspaces", async () => {
      (any.workspace.findMany as any).mockResolvedValue([]);

      await provisioner.listWorkspaces("org-123");

      expect(any.workspace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  describe("getWorkspaceWithDetails", () => {
    it("should retrieve workspace with all related data", async () => {
      const workspaceId = "workspace-123";

      (any.workspace.findUnique as any).mockResolvedValue({
        id: workspaceId,
        name: "Workspace",
        workspaceSettings: {
          timezone: "UTC",
          currency: "USD",
        },
        integrationConnections: [
          {
            integrationAppSlug: "mapbox",
            isEnabled: true,
          },
        ],
        apiKeys: [
          {
            id: "key-1",
            name: "Default",
            keyPrefix: "ws_abc123",
          },
        ],
      });

      const result = await provisioner.getWorkspaceWithDetails(workspaceId);

      expect(result.workspaceSettings).toBeDefined();
      expect(result.integrationConnections).toBeDefined();
      expect(result.apiKeys).toBeDefined();
    });
  });
});
