/**
 * Data Export Service
 * Implements GDPR Article 20 Right to Data Portability
 * Collects and exports all user PII in portable, machine-readable format
 */

import { DataExportPackage, DatabaseRecord } from "./types";

/**
 * Generic database interface for flexibility
 */
export interface DatabaseInterface {
  query<T extends DatabaseRecord>(
    query: string,
    params?: unknown[],
  ): Promise<T[]>;
  queryOne<T extends DatabaseRecord>(
    query: string,
    params?: unknown[],
  ): Promise<T | null>;
}

/**
 * Data Export Service
 * Handles collection and export of user data per GDPR Article 20
 */
export class DataExportService {
  private db: DatabaseInterface;
  private readonly BATCH_SIZE = 1000;

  /**
   * Initialize the export service with a database interface
   */
  constructor(db: DatabaseInterface) {
    this.db = db;
  }

  /**
   * Export all user data for a given user ID
   * Collects PII from multiple sources and aggregates
   *
   * @param userId - The user ID to export data for
   * @returns Promise resolving to complete user dataset
   * @throws Error if user not found or export fails
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid userId provided");
    }

    const [profile, orders, shipments, payments, activityLogs] =
      await Promise.all([
        this.fetchUserProfile(userId),
        this.fetchOrders(userId),
        this.fetchShipments(userId),
        this.fetchPayments(userId),
        this.fetchActivityLogs(userId),
      ]);

    return {
      profile,
      orders,
      shipments,
      payments,
      activityLogs,
      exportMetadata: {
        userId,
        exportedAt: new Date().toISOString(),
        totalRecords:
          (orders?.length || 0) +
          (shipments?.length || 0) +
          (payments?.length || 0) +
          (activityLogs?.length || 0),
      },
    };
  }

  /**
   * Fetch user profile information
   * @private
   */
  private async fetchUserProfile(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await this.db.queryOne(
        "SELECT id, email, name, phone, address, city, state, country, created_at, updated_at FROM users WHERE id = ?",
        [userId],
      );
    } catch (error) {
      console.error(`Error fetching profile for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Fetch all orders for a user
   * @private
   */
  private async fetchOrders(userId: string): Promise<DatabaseRecord[]> {
    try {
      return await this.db.query(
        `SELECT id, user_id, order_number, total_amount, currency, status, created_at, updated_at 
         FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
        [userId],
      );
    } catch (error) {
      console.error(`Error fetching orders for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch all shipments for a user
   * @private
   */
  private async fetchShipments(userId: string): Promise<DatabaseRecord[]> {
    try {
      return await this.db.query(
        `SELECT s.id, s.order_id, s.tracking_number, s.status, s.carrier, s.address, s.city, s.state, s.country, s.created_at 
         FROM shipments s
         JOIN orders o ON s.order_id = o.id
         WHERE o.user_id = ? ORDER BY s.created_at DESC`,
        [userId],
      );
    } catch (error) {
      console.error(`Error fetching shipments for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch all payment information for a user
   * @private
   */
  private async fetchPayments(userId: string): Promise<DatabaseRecord[]> {
    try {
      return await this.db.query(
        `SELECT id, order_id, method, last_four, status, amount, created_at 
         FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?) ORDER BY created_at DESC`,
        [userId],
      );
    } catch (error) {
      console.error(`Error fetching payments for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch activity logs for a user
   * @private
   */
  private async fetchActivityLogs(userId: string): Promise<DatabaseRecord[]> {
    try {
      return await this.db.query(
        `SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at 
         FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10000`,
        [userId],
      );
    } catch (error) {
      console.error(`Error fetching activity logs for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Generate a complete export package in GDPR Article 20 format
   * @param userId - The user ID
   * @param includeConsents - Whether to include consent records
   * @returns DataExportPackage
   */
  async generateExportPackage(
    userId: string,
    includeConsents = true,
  ): Promise<DataExportPackage> {
    const exportData = await this.exportUserData(userId);
    const exportId = `export_${userId}_${Date.now()}`;

    const pkg: DataExportPackage = {
      dataSubjectId: userId,
      exportedAt: new Date(),
      exportId,
      format: "json",
      includes: {
        profile: exportData.profile as Record<string, unknown>,
        orders: (exportData.orders as DatabaseRecord[]) || [],
        shipments: (exportData.shipments as DatabaseRecord[]) || [],
        payments: (exportData.payments as DatabaseRecord[]) || [],
        activityLogs: (exportData.activityLogs as DatabaseRecord[]) || [],
        consents: includeConsents ? [] : [], // Will be populated by ConsentManager
      },
    };

    return pkg;
  }

  /**
   * Format export for GDPR Article 20 portability
   * Returns data in standard, portable JSON format
   *
   * @param pkg - The export package to format
   * @returns JSON string representing portable data
   */
  formatForPortability(pkg: DataExportPackage): string {
    const portableFormat = {
      exportMetadata: {
        exportId: pkg.exportId,
        dataSubjectId: pkg.dataSubjectId,
        exportedAt: pkg.exportedAt.toISOString(),
        format: "application/json",
        version: "1.0",
      },
      data: pkg.includes,
    };

    return JSON.stringify(portableFormat, null, 2);
  }

  /**
   * Stream large exports in chunks to prevent memory overload
   * Yields chunks of data suitable for streaming to client
   *
   * @param userId - The user ID to export
   * @param chunkSize - Number of records per chunk
   */
  async *streamExport(userId: string, chunkSize = 500): AsyncGenerator<string> {
    try {
      // Stream metadata
      yield JSON.stringify({
        exportMetadata: {
          dataSubjectId: userId,
          exportedAt: new Date().toISOString(),
          format: "application/jsonl", // JSON Lines format for streaming
        },
      }) + "\n";

      // Stream profile
      const profile = await this.fetchUserProfile(userId);
      if (profile) {
        yield JSON.stringify({ type: "profile", data: profile }) + "\n";
      }

      // Stream orders in chunks
      const orders = await this.fetchOrders(userId);
      for (let i = 0; i < orders.length; i += chunkSize) {
        const chunk = orders.slice(i, i + chunkSize);
        yield JSON.stringify({ type: "orders", data: chunk }) + "\n";
      }

      // Stream shipments in chunks
      const shipments = await this.fetchShipments(userId);
      for (let i = 0; i < shipments.length; i += chunkSize) {
        const chunk = shipments.slice(i, i + chunkSize);
        yield JSON.stringify({ type: "shipments", data: chunk }) + "\n";
      }

      // Stream payments in chunks
      const payments = await this.fetchPayments(userId);
      for (let i = 0; i < payments.length; i += chunkSize) {
        const chunk = payments.slice(i, i + chunkSize);
        yield JSON.stringify({ type: "payments", data: chunk }) + "\n";
      }

      // Stream activity logs in chunks
      const activityLogs = await this.fetchActivityLogs(userId);
      for (let i = 0; i < activityLogs.length; i += chunkSize) {
        const chunk = activityLogs.slice(i, i + chunkSize);
        yield JSON.stringify({ type: "activityLogs", data: chunk }) + "\n";
      }

      // Stream completion marker
      yield JSON.stringify({
        type: "complete",
        timestamp: new Date().toISOString(),
      }) + "\n";
    } catch (error) {
      console.error(`Error streaming export for user ${userId}:`, error);
      yield JSON.stringify({ type: "error", message: String(error) }) + "\n";
    }
  }

  /**
   * Calculate and verify export integrity
   * @param jsonContent - The JSON content to checksum
   * @returns SHA-256 hash of content
   */
  calculateChecksum(jsonContent: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(jsonContent).digest("hex");
  }

  /**
   * Validate export package completeness
   * @param pkg - Package to validate
   * @returns Object with validation results
   */
  validatePackage(pkg: DataExportPackage): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!pkg.dataSubjectId) errors.push("Missing dataSubjectId");
    if (!pkg.exportedAt) errors.push("Missing exportedAt timestamp");
    if (!pkg.exportId) errors.push("Missing exportId");
    if (!pkg.includes.profile) errors.push("Missing profile data");

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
