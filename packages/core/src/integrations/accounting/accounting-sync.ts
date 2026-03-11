/**
 * Accounting Sync Service
 * Unified service for syncing invoices and payments across accounting providers
 * Supports QuickBooks and Xero with provider registry pattern
 */

import { PrismaClient } from '@witylogix/db';
import type { Invoice, PaymentRecord } from '../../invoicing/types.js';
import { QuickBooksAdapter } from './quickbooks-adapter.js';
import { XeroAdapter } from './xero-adapter.js';
import type {
  AccountingConnection,
  AccountingProvider,
  SyncRecord,
  AccountingSyncResult,
  AccountingSyncStatus,
} from './types.js';

export interface SyncOptions {
  force?: boolean; // Force sync even if recently synced
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ReconciliationResult {
  totalInvoices: number;
  syncedInvoices: number;
  failedSyncs: number;
  reconciliationDate: Date;
  details: Array<{
    invoiceId: string;
    status: 'synced' | 'failed' | 'pending';
    errorMessage?: string;
  }>;
}

/**
 * Accounting Sync Service
 * Manages sync operations with multiple accounting providers
 */
export class AccountingSyncService {
  private prisma: PrismaClient;
  private adapters: Map<AccountingProvider, QuickBooksAdapter | XeroAdapter> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Register an adapter for a provider
   */
  registerAdapter(provider: AccountingProvider, adapter: QuickBooksAdapter | XeroAdapter): void {
    this.adapters.set(provider, adapter);
  }

  /**
   * Get adapter for provider
   */
  private getAdapter(provider: AccountingProvider): QuickBooksAdapter | XeroAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * Sync invoice with accounting provider
   */
  async syncInvoice(invoice: Invoice, provider: AccountingProvider, options: SyncOptions = {}): Promise<SyncRecord> {
    const { force = false, autoRetry = true, maxRetries = 3 } = options;

    // Get active connection for tenant
    const connection = await this.getActiveConnection(invoice.tenantId, provider);
    if (!connection) {
      throw new Error(`No active accounting connection for tenant ${invoice.tenantId}`);
    }

    // Check if already synced recently
    const existingSync = await this.getSyncRecord(invoice.id, provider);
    if (!force && existingSync && existingSync.syncStatus === 'synced') {
      const oneHourAgo = new Date(Date.now() - 3600000);
      if (existingSync.syncedAt && existingSync.syncedAt > oneHourAgo) {
        console.log(`[Sync] Invoice ${invoice.id} already synced recently, skipping`);
        return existingSync;
      }
    }

    // Create or update sync record
    let syncRecord = await this.getSyncRecord(invoice.id, provider) || (await this.createSyncRecord(
      invoice.tenantId,
      connection.id,
      provider,
      invoice.id,
      'create',
    ));

    try {
      // Get adapter and sync
      const adapter = this.getAdapter(provider);
      const result = await adapter.createInvoice(invoice, connection);

      // Update sync record with success
      syncRecord = await this.updateSyncRecord(syncRecord.id, {
        syncStatus: 'synced',
        externalId: result.externalId,
        errorMessage: undefined,
        errorDetails: undefined,
        syncedAt: new Date(),
        metadata: {
          ...syncRecord.metadata,
          retryCount: 0,
        },
      });

      return syncRecord;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const retryCount = syncRecord.metadata?.retryCount ?? 0;

      // Determine if retryable
      const isRetryable = (error as any)?.retryable !== false && retryCount < maxRetries;

      // Update sync record with failure
      syncRecord = await this.updateSyncRecord(syncRecord.id, {
        syncStatus: isRetryable ? 'pending' : 'failed',
        errorMessage: errorMsg,
        errorDetails: {
          code: (error as any)?.code,
          statusCode: (error as any)?.statusCode,
          stack: (error as any)?.stack,
        },
        metadata: {
          ...syncRecord.metadata,
          retryCount: retryCount + 1,
          lastRetryAt: new Date(),
        },
      });

      // Retry if enabled and retryable
      if (autoRetry && isRetryable && retryCount < maxRetries) {
        const delayMs = (options.retryDelayMs ?? 5000) * Math.pow(2, retryCount); // Exponential backoff
        console.log(`[Sync] Retrying invoice ${invoice.id} in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          this.syncInvoice(invoice, provider, { ...options, autoRetry: false }).catch(err => {
            console.error(`[Sync] Async retry failed for invoice ${invoice.id}:`, err);
          });
        }, delayMs);
      }

      throw error;
    }
  }

  /**
   * Sync payment with accounting provider
   */
  async syncPayment(
    invoice: Invoice,
    payment: PaymentRecord,
    provider: AccountingProvider,
  ): Promise<SyncRecord> {
    const connection = await this.getActiveConnection(invoice.tenantId, provider);
    if (!connection) {
      throw new Error(`No active accounting connection for tenant ${invoice.tenantId}`);
    }

    let syncRecord = await this.getSyncRecord(invoice.id, provider, 'sync_payment') || (await this.createSyncRecord(
      invoice.tenantId,
      connection.id,
      provider,
      invoice.id,
      'sync_payment',
    ));

    try {
      const adapter = this.getAdapter(provider);
      const result = await adapter.syncPayment(invoice, payment, connection);

      syncRecord = await this.updateSyncRecord(syncRecord.id, {
        syncStatus: 'synced',
        externalId: result.externalId,
        syncedAt: new Date(),
      });

      return syncRecord;
    } catch (error) {
      syncRecord = await this.updateSyncRecord(syncRecord.id, {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Reconcile invoices between Witylogix and accounting provider
   */
  async reconcile(
    tenantId: string,
    provider: AccountingProvider,
    dateRange: { from: Date; to: Date },
  ): Promise<ReconciliationResult> {
    const connection = await this.getActiveConnection(tenantId, provider);
    if (!connection) {
      throw new Error(`No active accounting connection for tenant ${tenantId}`);
    }

    // INTEGRATION: Query accounting provider for invoices in date range
    // Compare with local sync records and identify discrepancies

    const syncRecords = await (this.prisma.accountingSyncRecord as any).findMany({
      where: {
        tenantId,
        provider,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
    });

    const result: ReconciliationResult = {
      totalInvoices: syncRecords.length,
      syncedInvoices: syncRecords.filter(r => r.syncStatus === 'synced').length,
      failedSyncs: syncRecords.filter(r => r.syncStatus === 'failed').length,
      reconciliationDate: new Date(),
      details: syncRecords.map(record => ({
        invoiceId: record.invoiceId,
        status: record.syncStatus,
        errorMessage: record.errorMessage,
      })),
    };

    return result;
  }

  /**
   * Get sync status for an invoice
   */
  async getSyncStatus(invoiceId: string, provider?: AccountingProvider): Promise<AccountingSyncStatus[]> {
    const where = { invoiceId } as any;
    if (provider) {
      where.provider = provider;
    }

    const syncRecords = await (this.prisma.accountingSyncRecord as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return syncRecords.map(record => ({
      invoiceId: record.invoiceId,
      externalId: record.externalId,
      provider: record.provider,
      status: record.syncStatus,
      lastSyncAt: record.syncedAt,
      nextRetryAt: record.metadata?.lastRetryAt
        ? new Date(record.metadata.lastRetryAt.getTime() + 5000)
        : undefined,
      retryCount: record.metadata?.retryCount ?? 0,
      errorMessage: record.errorMessage,
    }));
  }

  /**
   * Retry failed sync operations
   */
  async retryFailedSync(invoiceId: string, provider: AccountingProvider): Promise<SyncRecord> {
    const syncRecord = await this.getSyncRecord(invoiceId, provider);
    if (!syncRecord || syncRecord.syncStatus !== 'failed') {
      throw new Error(`No failed sync found for invoice ${invoiceId}`);
    }

    // INTEGRATION: Fetch invoice from database
    const invoice = await (this.prisma.invoice as any).findUnique({
      where: { id: invoiceId },
      include: { lineItems: true, discounts: true, taxes: true },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Reset retry count and retry
    return this.syncInvoice(invoice, provider, {
      force: true,
      autoRetry: true,
      maxRetries: 3,
    });
  }

  /**
   * Get active connection for tenant and provider
   */
  private async getActiveConnection(tenantId: string, provider: AccountingProvider): Promise<AccountingConnection | null> {
    return (this.prisma.accountingConnection as any).findFirst({
      where: {
        tenantId,
        provider,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get sync record for invoice
   */
  private async getSyncRecord(
    invoiceId: string,
    provider: AccountingProvider,
    syncType?: 'create' | 'update' | 'sync_payment',
  ): Promise<SyncRecord | null> {
    const where = { invoiceId, provider } as any;
    if (syncType) {
      where.syncType = syncType;
    }

    return (this.prisma.accountingSyncRecord as any).findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create sync record
   */
  private async createSyncRecord(
    tenantId: string,
    connectionId: string,
    provider: AccountingProvider,
    invoiceId: string,
    syncType: 'create' | 'update' | 'sync_payment',
  ): Promise<SyncRecord> {
    return (this.prisma.accountingSyncRecord as any).create({
      data: {
        tenantId,
        connectionId,
        provider,
        invoiceId,
        syncType,
        syncStatus: 'pending',
        metadata: {
          queuedAt: new Date(),
          retryCount: 0,
        },
      },
    });
  }

  /**
   * Update sync record
   */
  private async updateSyncRecord(id: string, data: Partial<SyncRecord>): Promise<SyncRecord> {
    return (this.prisma.accountingSyncRecord as any).update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}
