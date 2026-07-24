/**
 * CRM Sync Engine
 * Bidirectional sync between CRM and Witylogix core data
 * Handles delivery data enrichment, activity syncing, and conflict resolution
 */

import type {
  CRMConnection,
  CRMContact,
  CRMActivity,
  CRMSyncResult,
  CRMFieldMapping,
  CRMSyncLog,
  ICRMAdapter,
} from "./types.js";

// ─── SYNC CONFIGURATION ────────────────────────────────────────────

export interface SyncableEntity {
  id: string;
  type: "contact" | "account" | "opportunity" | "delivery" | "customer";
  data: Record<string, unknown>;
  externalId?: string;
  lastModifiedAt?: Date;
}

export interface DeliveryData {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  completedAt?: Date;
  deliveryNotes?: string;
  signature?: string;
}

export interface WitylogixCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  source: "manual" | "api" | "crm";
  externalCrmId?: string;
  externalCrmProvider?: string;
  lastSyncedAt?: Date;
}

// ─── CONFLICT RESOLUTION ────────────────────────────────────────────

interface ConflictResolutionContext {
  field: string;
  witylogixValue: unknown;
  crmValue: unknown;
  witylogixModifiedAt: Date;
  crmModifiedAt: Date;
  precedence: "crm_wins" | "witylogix_wins" | "manual";
}

interface ConflictResolutionResult {
  field: string;
  selectedValue: unknown;
  selectedSource: "witylogix" | "crm";
  requiresManualReview: boolean;
}

// ─── CRM SYNC ENGINE ────────────────────────────────────────────

export class CRMSyncEngine {
  private connection: CRMConnection;
  private adapter: ICRMAdapter;
  private fieldMappings: Map<string, CRMFieldMapping> = new Map();
  private syncLogs: CRMSyncLog[] = [];

  constructor(
    connection: CRMConnection,
    adapter: ICRMAdapter,
    fieldMappings: CRMFieldMapping[] = [],
  ) {
    this.connection = connection;
    this.adapter = adapter;

    fieldMappings.forEach((mapping: CRMFieldMapping) => {
      const key: string = `${mapping.recordType}:${mapping.witylogixField}`;
      this.fieldMappings.set(key, mapping);
    });
  }

  /**
   * Sync delivery completion to CRM as activity/note
   */
  async syncDeliveryCompletion(delivery: DeliveryData): Promise<CRMSyncResult> {
    try {
      // Create activity in CRM
      const activity: CRMActivity = {
        id: `activity_${delivery.id}`,
        type: "note",
        subject: `Delivery Completed: ${delivery.id}`,
        description: `
Customer: ${delivery.customerName}
Status: ${delivery.status}
Completed: ${delivery.completedAt?.toISOString()}
Notes: ${delivery.deliveryNotes || "No additional notes"}
${delivery.signature ? `Signature: Captured` : ""}
        `.trim(),
        recordType: "contact",
        recordId: delivery.customerId,
        completedAt: delivery.completedAt,
        lastModifiedAt: new Date(),
      };

      // Sync to CRM
      const results: Array<{ id: string; status: string; message: string }> =
        await this.adapter.syncActivities([activity]);

      const result:
        | { id: string; status: string; message: string }
        | undefined = results[0];
      if (!result) {
        throw new Error("No result returned from sync");
      }

      await this.logSync({
        id: `sync_${Date.now()}`,
        tenantId: this.connection.tenantId,
        connectionId: this.connection.id,
        provider: this.connection.provider,
        recordType: "activity",
        recordId: delivery.id,
        externalId: result.id,
        syncType: "create",
        direction: "to_crm",
        status: result.status === "synced" ? "synced" : "failed",
        errorMessage: result.status === "synced" ? undefined : result.message,
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        id: delivery.id,
        recordType: "activity",
        recordId: delivery.id,
        externalId: result.id,
        provider: this.connection.provider,
        status: result.status === "synced" ? "synced" : "failed",
        message: result.message,
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error";

      await this.logSync({
        id: `sync_${Date.now()}`,
        tenantId: this.connection.tenantId,
        connectionId: this.connection.id,
        provider: this.connection.provider,
        recordType: "activity",
        recordId: delivery.id,
        syncType: "create",
        direction: "to_crm",
        status: "failed",
        errorMessage,
        errorDetails: { error: String(error) },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        id: delivery.id,
        recordType: "activity",
        recordId: delivery.id,
        provider: this.connection.provider,
        status: "failed",
        message: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Enrich Witylogix customer data from CRM contact
   */
  async enrichCustomerFromCRM(
    crmContactId: string,
  ): Promise<WitylogixCustomer> {
    try {
      const crmContact: CRMContact =
        await this.adapter.getContact(crmContactId);

      return {
        id: `customer_${crmContactId}`,
        name: `${crmContact.firstName} ${crmContact.lastName}`.trim(),
        email: crmContact.email,
        phone: crmContact.phone || crmContact.mobile,
        address: crmContact.address,
        source: "crm",
        externalCrmId: crmContactId,
        externalCrmProvider: this.connection.provider,
        lastSyncedAt: new Date(),
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed to enrich customer from CRM: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Sync Witylogix customer to CRM as contact
   */
  async syncCustomerToCRM(customer: WitylogixCustomer): Promise<CRMContact> {
    try {
      if (customer.externalCrmId) {
        // Update existing contact
        return await this.adapter.updateContact(customer.externalCrmId, {
          firstName: customer.name.split(" ")[0] || "",
          lastName: customer.name.split(" ").slice(1).join(" ") || "",
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        });
      } else {
        // Create new contact
        const newContact: CRMContact = await this.adapter.createContact({
          firstName: customer.name.split(" ")[0] || "",
          lastName: customer.name.split(" ").slice(1).join(" ") || "",
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        });

        await this.logSync({
          id: `sync_${Date.now()}`,
          tenantId: this.connection.tenantId,
          connectionId: this.connection.id,
          provider: this.connection.provider,
          recordType: "contact",
          recordId: customer.id,
          externalId: newContact.id,
          syncType: "create",
          direction: "to_crm",
          status: "synced",
          syncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return newContact;
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to sync customer to CRM: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Resolve field-level conflicts between CRM and Witylogix data
   */
  async resolveConflict(
    context: ConflictResolutionContext,
  ): Promise<ConflictResolutionResult> {
    const precedence: string =
      this.connection.syncConfig?.conflictResolution || "manual";

    if (precedence === "crm_wins") {
      return {
        field: context.field,
        selectedValue: context.crmValue,
        selectedSource: "crm",
        requiresManualReview: false,
      };
    }

    if (precedence === "witylogix_wins") {
      return {
        field: context.field,
        selectedValue: context.witylogixValue,
        selectedSource: "witylogix",
        requiresManualReview: false,
      };
    }

    // Manual resolution: use most recent value
    const useWitylogix: boolean =
      context.witylogixModifiedAt.getTime() > context.crmModifiedAt.getTime();

    return {
      field: context.field,
      selectedValue: useWitylogix ? context.witylogixValue : context.crmValue,
      selectedSource: useWitylogix ? "witylogix" : "crm",
      requiresManualReview: true,
    };
  }

  /**
   * Perform full bidirectional sync between CRM and Witylogix
   */
  async performBidirectionalSync(
    witylogixRecords: SyncableEntity[],
    crmRecordType: "contact" | "account" | "opportunity",
  ): Promise<CRMSyncResult[]> {
    const results: CRMSyncResult[] = [];

    // Fetch from CRM
    let crmRecords: Array<{ id: string; data: Record<string, unknown> }> = [];

    try {
      if (crmRecordType === "contact") {
        const contactsResult = await this.adapter.getContacts({
          modifiedAfter:
            this.connection.lastSyncAt ||
            new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        crmRecords = contactsResult.data.map((contact: CRMContact) => ({
          id: contact.id,
          data: contact as unknown as Record<string, unknown>,
        }));
      } else if (crmRecordType === "account") {
        const accountsResult = await this.adapter.getAccounts({
          modifiedAfter:
            this.connection.lastSyncAt ||
            new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        crmRecords = accountsResult.data.map((account) => ({
          id: account.id,
          data: account as unknown as Record<string, unknown>,
        }));
      }
    } catch (error: unknown) {
      results.push({
        id: `sync_${Date.now()}`,
        recordType: crmRecordType,
        recordId: "bulk",
        provider: this.connection.provider,
        status: "failed",
        message: `Failed to fetch ${crmRecordType}s from CRM: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });
      return results;
    }

    // Sync Witylogix records to CRM
    for (const record of witylogixRecords) {
      try {
        if (record.type === "contact" && crmRecordType === "contact") {
          const customer: WitylogixCustomer =
            record.data as unknown as WitylogixCustomer;
          const crmContact: CRMContact = await this.syncCustomerToCRM(customer);

          results.push({
            id: record.id,
            recordType: "contact",
            recordId: record.id,
            externalId: crmContact.id,
            provider: this.connection.provider,
            status: "synced",
            message: "Contact synced to CRM",
            timestamp: new Date(),
          });
        }
      } catch (error: unknown) {
        results.push({
          id: record.id,
          recordType: (record.type === "delivery" || record.type === "customer"
            ? "contact"
            : record.type) as import("./types.js").CRMRecordType,
          recordId: record.id,
          provider: this.connection.provider,
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        });
      }
    }

    // Update connection lastSyncAt
    this.connection.lastSyncAt = new Date();

    return results;
  }

  /**
   * Incremental sync using change tokens
   */
  async performIncrementalSync(
    recordType: "contact" | "account" | "opportunity",
  ): Promise<CRMSyncResult[]> {
    const results: CRMSyncResult[] = [];
    const lastSyncToken: string | undefined =
      this.connection.syncConfig?.lastSyncToken;

    // Determine modifiedAfter date
    const modifiedAfter: Date =
      this.connection.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      if (recordType === "contact") {
        const contactsResult = await this.adapter.getContacts({
          modifiedAfter,
        });

        for (const contact of contactsResult.data) {
          results.push({
            id: contact.id,
            recordType: "contact",
            recordId: contact.id,
            provider: this.connection.provider,
            status: "synced",
            message: "Contact fetched from CRM",
            timestamp: new Date(),
          });
        }
      }
    } catch (error: unknown) {
      results.push({
        id: `sync_${Date.now()}`,
        recordType,
        recordId: "bulk",
        provider: this.connection.provider,
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });
    }

    return results;
  }

  /**
   * Get sync audit trail
   */
  getSyncLogs(filters?: {
    recordType?: string;
    status?: string;
    limit?: number;
  }): CRMSyncLog[] {
    let logs: CRMSyncLog[] = this.syncLogs;

    if (filters?.recordType) {
      logs = logs.filter(
        (log: CRMSyncLog) => log.recordType === filters.recordType,
      );
    }
    if (filters?.status) {
      logs = logs.filter((log: CRMSyncLog) => log.status === filters.status);
    }

    const limit: number = filters?.limit || 100;
    return logs.slice(0, limit);
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    totalSyncs: number;
    successCount: number;
    failureCount: number;
    lastSyncAt: Date | undefined;
  } {
    const successCount: number = this.syncLogs.filter(
      (log: CRMSyncLog) => log.status === "synced",
    ).length;
    const failureCount: number = this.syncLogs.filter(
      (log: CRMSyncLog) => log.status === "failed",
    ).length;

    return {
      totalSyncs: this.syncLogs.length,
      successCount,
      failureCount,
      lastSyncAt: this.connection.lastSyncAt,
    };
  }

  /**
   * Log sync operation
   */
  private async logSync(log: CRMSyncLog): Promise<void> {
    this.syncLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.syncLogs.length > 1000) {
      this.syncLogs = this.syncLogs.slice(-1000);
    }
  }

  /**
   * Validate field mapping
   */
  validateFieldMapping(mapping: CRMFieldMapping): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!mapping.witylogixField) {
      errors.push("Witylogix field is required");
    }
    if (!mapping.crmField) {
      errors.push("CRM field is required");
    }
    if (!["bidirectional", "to_crm", "from_crm"].includes(mapping.direction)) {
      errors.push("Invalid sync direction");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset sync state
   */
  resetSyncState(): void {
    this.syncLogs = [];
    this.connection.lastSyncAt = undefined;
    if (this.connection.syncConfig) {
      this.connection.syncConfig.lastSyncToken = undefined;
    }
  }
}
