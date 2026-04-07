/**
 * Batch Integration Manager
 *
 * Manages enabling/disabling multiple integrations and persisting
 * configurations using Prisma ORM. Supports bulk operations with
 * validation and error handling.
 */

import { prisma } from '@witylogix/db';
import { IntegrationConnection, BatchEnableResult, HealthStatus } from './types';
import { getSetupConfig } from './integration-setup-registry';
import { CredentialValidator } from './credential-validator';

/**
 * Batch Integration Manager
 */
export class BatchIntegrationManager {
  /**
   * Enable multiple integrations for an organization.
   *
   * Validates configurations before enabling and persists to database.
   */
  static async enableIntegrations(
    orgId: string,
    integrations: Array<{
      providerId: string;
      credentials: Record<string, unknown>;
      config?: Record<string, unknown>;
    }>,
    prisma: any
  ): Promise<BatchEnableResult> {
    const results: BatchEnableResult['results'] = [];
    let enabledCount = 0;
    let failedCount = 0;

    for (const integration of integrations) {
      try {
        const config = getSetupConfig(integration.providerId);
        if (!config) {
          results.push({
            providerId: integration.providerId,
            success: false,
            error: `No configuration found for provider: ${integration.providerId}`,
          });
          failedCount++;
          continue;
        }

        // Validate required fields
        const validationErrors = this.validateCredentials(
          integration.credentials,
          config.requiredFields
        );
        if (validationErrors.length > 0) {
          results.push({
            providerId: integration.providerId,
            success: false,
            error: `Validation error: ${validationErrors.join(', ')}`,
          });
          failedCount++;
          continue;
        }

        // Test credentials
        const testResult = await CredentialValidator.validateCredentials(
          integration.providerId,
          integration.credentials
        );

        if (!testResult.valid) {
          results.push({
            providerId: integration.providerId,
            success: false,
            error: `Credential validation failed: ${testResult.errors?.[0] || 'Unknown error'}`,
          });
          failedCount++;
          continue;
        }

        // Persist to database (using Prisma)
        try {
          await prisma.integrationConnection.create({
            data: {
              orgId,
              providerId: integration.providerId,
              isEnabled: true,
              config: integration.config || {},
              credentialsEncrypted: this.encryptCredentials(integration.credentials),
              healthStatus: HealthStatus.HEALTHY,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          results.push({
            providerId: integration.providerId,
            success: true,
          });
          enabledCount++;
        } catch (dbError) {
          // Handle duplicate or other DB errors
          const errorMsg =
            dbError instanceof Error ? dbError.message : 'Database error';
          results.push({
            providerId: integration.providerId,
            success: false,
            error: `Failed to save configuration: ${errorMsg}`,
          });
          failedCount++;
        }
      } catch (error) {
        results.push({
          providerId: integration.providerId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failedCount++;
      }
    }

    return {
      orgId,
      enabledCount,
      failedCount,
      results,
    };
  }

  /**
   * Disable multiple integrations for an organization.
   */
  static async disableIntegrations(
    orgId: string,
    providerIds: string[],
    prisma: any
  ): Promise<BatchEnableResult> {
    const results: BatchEnableResult['results'] = [];
    let enabledCount = 0;
    let failedCount = 0;

    for (const providerId of providerIds) {
      try {
        await prisma.integrationConnection.updateMany({
          where: {
            orgId,
            providerId,
          },
          data: {
            isEnabled: false,
            updatedAt: new Date(),
          },
        });

        results.push({
          providerId,
          success: true,
        });
        enabledCount++;
      } catch (error) {
        results.push({
          providerId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failedCount++;
      }
    }

    return {
      orgId,
      enabledCount,
      failedCount,
      results,
    };
  }

  /**
   * Get all enabled integrations for an organization.
   */
  static async getEnabledIntegrations(
    orgId: string,
    prisma: any
  ): Promise<IntegrationConnection[]> {
    const connections = await prisma.integrationConnection.findMany({
      where: {
        orgId,
        isEnabled: true,
      },
    });

    return connections.map((conn: any) => ({
      orgId: conn.orgId,
      providerId: conn.providerId,
      isEnabled: conn.isEnabled,
      config: conn.config || {},
      credentialsEncrypted: conn.credentialsEncrypted,
      lastTestedAt: conn.lastTestedAt,
      lastHealthCheckAt: conn.lastHealthCheckAt,
      healthStatus: conn.healthStatus,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
  }

  /**
   * Get all integrations for an organization (enabled and disabled).
   */
  static async getAllIntegrations(
    orgId: string,
    prisma: any
  ): Promise<IntegrationConnection[]> {
    const connections = await prisma.integrationConnection.findMany({
      where: { orgId },
    });

    return connections.map((conn: any) => ({
      orgId: conn.orgId,
      providerId: conn.providerId,
      isEnabled: conn.isEnabled,
      config: conn.config || {},
      credentialsEncrypted: conn.credentialsEncrypted,
      lastTestedAt: conn.lastTestedAt,
      lastHealthCheckAt: conn.lastHealthCheckAt,
      healthStatus: conn.healthStatus,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
  }

  /**
   * Configure an integration without enabling it.
   *
   * Updates provider-specific configuration like webhook URLs,
   * data sync settings, etc.
   */
  static async configureIntegration(
    orgId: string,
    providerId: string,
    config: Record<string, unknown>,
    prisma: any
  ): Promise<IntegrationConnection | null> {
    try {
      const updated = await prisma.integrationConnection.updateMany({
        where: {
          orgId,
          providerId,
        },
        data: {
          config,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return null;
      }

      // Fetch updated record
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          orgId,
          providerId,
        },
      });

      return connection || null;
    } catch (error) {
      throw new Error(
        `Failed to configure integration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update integration health status and last check timestamp.
   */
  static async updateHealthStatus(
    orgId: string,
    providerId: string,
    healthStatus: HealthStatus,
    prisma: any
  ): Promise<void> {
    await prisma.integrationConnection.updateMany({
      where: {
        orgId,
        providerId,
      },
      data: {
        healthStatus,
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get integration by org and provider.
   */
  static async getIntegration(
    orgId: string,
    providerId: string,
    prisma: any
  ): Promise<IntegrationConnection | null> {
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        orgId,
        providerId,
      },
    });

    if (!connection) return null;

    return {
      orgId: connection.orgId,
      providerId: connection.providerId,
      isEnabled: connection.isEnabled,
      config: connection.config || {},
      credentialsEncrypted: connection.credentialsEncrypted,
      lastTestedAt: connection.lastTestedAt,
      lastHealthCheckAt: connection.lastHealthCheckAt,
      healthStatus: connection.healthStatus,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  /**
   * Delete integration connection.
   */
  static async deleteIntegration(
    orgId: string,
    providerId: string,
    prisma: any
  ): Promise<boolean> {
    const result = await prisma.integrationConnection.deleteMany({
      where: {
        orgId,
        providerId,
      },
    });

    return result.count > 0;
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Validate credentials against required fields.
   */
  private static validateCredentials(
    credentials: Record<string, unknown>,
    requiredFields: any[]
  ): string[] {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (field.required && !credentials[field.key]) {
        errors.push(`Missing required field: ${field.label}`);
      }
    }

    return errors;
  }

  /**
   * Encrypt credentials before storing (placeholder).
   *
   * In production, use proper encryption (AES-256-GCM or similar).
   */
  private static encryptCredentials(credentials: Record<string, unknown>): string {
    // TODO: Implement proper encryption
    // For now, return base64 encoded JSON
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  /**
   * Decrypt credentials when retrieving (placeholder).
   */
  static decryptCredentials(encrypted: string): Record<string, unknown> {
    // TODO: Implement proper decryption
    // For now, decode base64 JSON
    try {
      return JSON.parse(Buffer.from(encrypted, 'base64').toString('utf-8'));
    } catch {
      return {};
    }
  }

  /**
   * Get integration statistics for an organization.
   */
  static async getIntegrationStats(
    orgId: string,
    prisma: any
  ): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    healthy: number;
    degraded: number;
    down: number;
  }> {
    const connections = await prisma.integrationConnection.findMany({
      where: { orgId },
    });

    return {
      total: connections.length,
      enabled: connections.filter((c: any) => c.isEnabled).length,
      disabled: connections.filter((c: any) => !c.isEnabled).length,
      healthy: connections.filter((c: any) => c.healthStatus === HealthStatus.HEALTHY).length,
      degraded: connections.filter((c: any) => c.healthStatus === HealthStatus.DEGRADED).length,
      down: connections.filter(
        (c: any) => c.healthStatus === HealthStatus.DOWN || c.healthStatus === HealthStatus.UNAUTHORIZED
      ).length,
    };
  }
}
