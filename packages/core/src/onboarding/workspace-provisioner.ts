/**
 * Workspace Provisioner — Creates and configures workspaces during onboarding.
 *
 * This service handles the complete provisioning pipeline:
 * - Creating organizations (if needed)
 * - Creating workspace records
 * - Setting up workspace settings with localization
 * - Enabling selected integrations
 * - Creating API keys
 * - Sending welcome emails
 *
 * Provisioning can be triggered manually or as part of onboarding completion.
 */

import crypto from "crypto";
import { db, prisma } from "@witylogix/db";
import {
  WorkspaceConfig,
  WorkspaceProvisionResult,
  IndustryDefaults,
  OnboardingError,
  OnboardingErrorCodes,
  Industry,
  DeploymentType,
} from "./types";

/**
 * WorkspaceProvisioner handles creation and setup of workspaces.
 */
export class WorkspaceProvisioner {
  /**
   * Industry-specific default settings.
   */
  private readonly industryDefaults: Record<Industry, IndustryDefaults> = {
    [Industry.LOGISTICS]: {
      timezone: "UTC",
      currency: "USD",
      distanceUnit: "KM",
      weightUnit: "KG",
      dateFormat: "YYYY-MM-DD",
      locale: "en-US",
      suggestedIntegrations: ["mapbox", "sendgrid"],
      dashboardLayout: {
        widgets: ["routes", "active-deliveries", "performance-metrics"],
      },
    },
    [Industry.RETAIL]: {
      timezone: "America/New_York",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      dateFormat: "MM/DD/YYYY",
      locale: "en-US",
      suggestedIntegrations: ["shopify"],
    },
    [Industry.ECOMMERCE]: {
      timezone: "UTC",
      currency: "USD",
      distanceUnit: "KM",
      weightUnit: "KG",
      dateFormat: "YYYY-MM-DD",
      locale: "en-US",
      suggestedIntegrations: ["shopify", "stripe", "sendgrid"],
    },
    [Industry.FOOD_DELIVERY]: {
      timezone: "America/Los_Angeles",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      dateFormat: "MM/DD/YYYY",
      locale: "en-US",
      suggestedIntegrations: ["mapbox", "twilio"],
    },
    [Industry.HEALTHCARE]: {
      timezone: "America/Chicago",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      dateFormat: "MM/DD/YYYY",
      locale: "en-US",
      suggestedIntegrations: ["sendgrid"],
    },
    [Industry.MANUFACTURING]: {
      timezone: "UTC",
      currency: "USD",
      distanceUnit: "KM",
      weightUnit: "KG",
      dateFormat: "YYYY-MM-DD",
      locale: "en-US",
      suggestedIntegrations: ["mapbox"],
    },
    [Industry.OTHER]: {
      timezone: "UTC",
      currency: "USD",
      distanceUnit: "KM",
      weightUnit: "KG",
      dateFormat: "YYYY-MM-DD",
      locale: "en-US",
      suggestedIntegrations: [],
    },
  };

  /**
   * Provisions a complete workspace with all required configuration.
   *
   * Pipeline:
   * 1. Create or fetch organization
   * 2. Create workspace record
   * 3. Create workspace settings with localization
   * 4. Enable selected integrations
   * 5. Create initial API key
   * 6. Send welcome email
   *
   * @param config - Complete workspace configuration
   * @param userId - User provisioning the workspace
   * @returns Provision result with workspace details
   * @throws OnboardingError if any step fails
   */
  async provisionWorkspace(
    config: WorkspaceConfig,
    userId: string,
  ): Promise<WorkspaceProvisionResult> {
    try {
      // Get industry defaults if available
      const industry = (config.industry as Industry) || Industry.OTHER;
      const defaults = this.getIndustryDefaults(industry);

      // Use provided settings or fall back to defaults
      const timezone = config.timezone || defaults.timezone;
      const currency = config.currency || defaults.currency;
      const distanceUnit = config.distanceUnit || defaults.distanceUnit;
      const weightUnit = config.weightUnit || defaults.weightUnit;
      const dateFormat = config.dateFormat || defaults.dateFormat;
      const locale = config.locale || defaults.locale;

      // Create workspace
      const workspace = await db.workspace.create({
        data: {
          orgId: config.orgId,
          name: config.name,
          slug: config.slug,
          deploymentType: config.deploymentType || DeploymentType.CLOUD,
          industry: industry,
          goals: config.goals || [],
          selectedIntegrations: config.selectedIntegrations || [],
          dashboardLayout: config.dashboardLayout || defaults.dashboardLayout,
          settings: {
            createdAt: new Date(),
            createdBy: userId,
          },
          provisionedAt: new Date(),
          isActive: true,
        },
      });

      // Create workspace settings
      await db.workspaceSettings.create({
        data: {
          workspaceId: workspace.id,
          timezone,
          currency,
          distanceUnit,
          weightUnit,
          dateFormat,
          locale,
        },
      });

      // Enable selected integrations
      const integrationConnections = [];
      for (const integrationSlug of config.selectedIntegrations || []) {
        try {
          const connection = await db.integrationConnection.create({
            data: {
              workspaceId: workspace.id,
              integrationAppSlug: integrationSlug,
              isEnabled: false, // Disabled until credentials are provided
              config: {},
              credentials: {},
              healthStatus: "UNKNOWN",
            },
          });
          integrationConnections.push(connection);
        } catch (err) {
          // Log and continue if integration creation fails
          console.error(
            `Failed to create integration connection for ${integrationSlug}:`,
            err,
          );
        }
      }

      // Create initial API key
      const apiKey = this.generateApiKey();
      const apiKeyRecord = await db.workspaceApiKey.create({
        data: {
          workspaceId: workspace.id,
          name: "Default",
          keyPrefix: apiKey.prefix,
          keyHash: apiKey.hash,
          isActive: true,
          createdBy: userId,
        },
      });

      // Build integration response
      const integrations = integrationConnections.map((conn) => ({
        slug: conn.integrationAppSlug,
        name: this.getIntegrationName(conn.integrationAppSlug),
        isConfigured: false,
      }));

      // TODO: Send welcome email
      // await emailService.sendWelcomeEmail({
      //   userId,
      //   workspaceName: config.name,
      //   dashboardUrl: this.buildDashboardUrl(workspace.slug),
      // });

      return {
        workspaceId: workspace.id,
        orgId: config.orgId,
        workspaceName: workspace.name,
        slug: workspace.slug,
        apiKey: apiKey.full,
        apiKeyPrefix: apiKey.prefix,
        integrations,
        dashboardUrl: this.buildDashboardUrl(workspace.slug),
        welcomeEmailSent: false, // TODO: Set to true when email is implemented
        provisionedAt: workspace.provisionedAt!,
      };
    } catch (err) {
      if (err instanceof OnboardingError) {
        throw err;
      }

      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `Failed to provision workspace: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  /**
   * Gets default settings for an industry.
   *
   * @param industry - Industry enum value
   * @returns Default settings for the industry
   */
  getIndustryDefaults(industry: Industry): IndustryDefaults {
    return (
      this.industryDefaults[industry] || this.industryDefaults[Industry.OTHER]
    );
  }

  /**
   * Soft-deletes a workspace and optionally cleans up related records.
   *
   * @param workspaceId - Workspace to deprovision
   * @param hardDelete - If true, permanently delete; if false, soft delete
   * @returns Workspace record (for audit purposes)
   * @throws OnboardingError if workspace not found
   */
  async deprovisionWorkspace(
    workspaceId: string,
    hardDelete: boolean = false,
  ): Promise<void> {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `Workspace ${workspaceId} not found`,
        404,
      );
    }

    if (hardDelete) {
      // Hard delete: remove all related records first
      await db.workspaceApiKey.deleteMany({
        where: { workspaceId },
      });

      await db.integrationConnection.deleteMany({
        where: { workspaceId },
      });

      await db.workspaceSettings.deleteMany({
        where: { workspaceId },
      });

      await db.workspace.delete({
        where: { id: workspaceId },
      });
    } else {
      // Soft delete: mark as inactive
      await db.workspace.update({
        where: { id: workspaceId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      // Disable all integrations
      await db.integrationConnection.updateMany({
        where: { workspaceId },
        data: {
          isEnabled: false,
          updatedAt: new Date(),
        },
      });

      // Disable all API keys
      await db.workspaceApiKey.updateMany({
        where: { workspaceId },
        data: {
          isActive: false,
        },
      });
    }
  }

  /**
   * Generates a secure API key with prefix and hash.
   *
   * @returns Object with full key, prefix, and hash
   */
  private generateApiKey(): {
    full: string;
    prefix: string;
    hash: string;
  } {
    // Generate random bytes
    const randomBytes = crypto.randomBytes(32);
    const fullKey = `ws_${randomBytes.toString("base64url")}`;

    // Prefix is first 8 chars of base64 key for rotation UI
    const prefix = fullKey.substring(0, 12);

    // Hash the full key for storage
    const hash = crypto.createHash("sha256").update(fullKey).digest("hex");

    return {
      full: fullKey,
      prefix,
      hash,
    };
  }

  /**
   * Gets human-readable name for an integration slug.
   *
   * @param slug - Integration app slug
   * @returns Display name
   */
  private getIntegrationName(slug: string): string {
    const names: Record<string, string> = {
      mapbox: "Mapbox",
      sendgrid: "SendGrid",
      shopify: "Shopify",
      stripe: "Stripe",
      twilio: "Twilio",
    };
    return names[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  /**
   * Builds the dashboard URL for a workspace.
   *
   * @param slug - Workspace slug
   * @returns Full dashboard URL
   */
  private buildDashboardUrl(slug: string): string {
    const baseUrl = process.env.DASHBOARD_BASE_URL || "https://app.witylogix.com";
    return `${baseUrl}/workspaces/${slug}/dashboard`;
  }

  /**
   * Updates workspace settings after provisioning.
   *
   * @param workspaceId - Workspace to update
   * @param updates - Partial settings to update
   * @returns Updated workspace
   */
  async updateWorkspaceSettings(
    workspaceId: string,
    updates: Partial<WorkspaceConfig>,
  ): Promise<any> {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new OnboardingError(
        OnboardingErrorCodes.WORKSPACE_PROVISIONING_FAILED,
        `Workspace ${workspaceId} not found`,
        404,
      );
    }

    // Update workspace record
    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        name: updates.name || workspace.name,
        industry: updates.industry || workspace.industry,
        goals: updates.goals || workspace.goals,
        selectedIntegrations:
          updates.selectedIntegrations || workspace.selectedIntegrations,
        dashboardLayout: updates.dashboardLayout || workspace.dashboardLayout,
        settings: {
          ...workspace.settings,
          ...updates.additionalSettings,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      },
    });

    // Update workspace settings if locale/regional settings changed
    if (
      updates.timezone ||
      updates.currency ||
      updates.distanceUnit ||
      updates.weightUnit ||
      updates.dateFormat ||
      updates.locale
    ) {
      await db.workspaceSettings.update({
        where: { workspaceId },
        data: {
          timezone: updates.timezone,
          currency: updates.currency,
          distanceUnit: updates.distanceUnit,
          weightUnit: updates.weightUnit,
          dateFormat: updates.dateFormat,
          locale: updates.locale,
          updatedAt: new Date(),
        },
      });
    }

    return updated;
  }

  /**
   * Lists all workspaces for an organization.
   *
   * @param orgId - Organization ID
   * @returns Array of workspace records
   */
  async listWorkspaces(orgId: string): Promise<any[]> {
    return db.workspace.findMany({
      where: { orgId, isActive: true },
      include: { workspaceSettings: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Gets a workspace with all related settings and integrations.
   *
   * @param workspaceId - Workspace ID
   * @returns Workspace with all details
   */
  async getWorkspaceWithDetails(workspaceId: string): Promise<any> {
    return db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        workspaceSettings: true,
        integrationConnections: true,
        apiKeys: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            isActive: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });
  }
}

// Export singleton instance
export const workspaceProvisioner = new WorkspaceProvisioner();
