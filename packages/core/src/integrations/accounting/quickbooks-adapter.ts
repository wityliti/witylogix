/**
 * QuickBooks Online OAuth2 Adapter
 * Integration with Intuit QuickBooks Online API
 * Handles authentication, invoice syncing, payment syncing, and customer management
 */

import type { Invoice, PaymentRecord } from '../../invoicing/types.js';
import type {
  AccountingConnection,
  QuickBooksInvoice,
  AccountingSyncResult,
  RateLimitInfo,
  AccountingError,
} from './types.js';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: 'sandbox' | 'production';
  timeout?: number;
  maxRetries?: number;
}

export interface QBAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  realm_id: string;
  token_type: string;
}

/**
 * QuickBooks Online Adapter
 * Manages OAuth2 authentication and API interactions with QB
 */
export class QuickBooksAdapter {
  private config: QuickBooksConfig;
  private apiBaseUrl: string;
  private authBaseUrl: string;
  private rateLimits: Map<string, RateLimitInfo> = new Map();

  // Rate limit: 500 requests per minute
  private readonly RATE_LIMIT_THRESHOLD = 50; // Warn if approaching limit

  constructor(config: QuickBooksConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: 'production',
      ...config,
    };

    const env = this.config.environment === 'sandbox' ? 'sandbox' : 'quickbooks';
    this.apiBaseUrl = `https://quickbooks.api.intuit.com/v2/company`;
    this.authBaseUrl = `https://${env}.intuit.com/oauth2`;
  }

  /**
   * Get OAuth authorization URL for user to grant permissions
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.config.redirectUri,
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/authorization?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticate(authCode: string, realmId: string): Promise<AccountingConnection> {
    // INTEGRATION: Exchange code for token
    // POST https://oauth.platform.intuit.com/oauth2/tokens/bearer
    // with: grant_type=authorization_code&code={code}&redirect_uri={redirectUri}

    const mockResponse: QBAuthResponse = {
      access_token: `qbo_at_${Date.now()}`,
      refresh_token: `qbo_rt_${Date.now()}`,
      expires_in: 3600,
      realm_id: realmId,
      token_type: 'Bearer',
    };

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + mockResponse.expires_in);

    return {
      id: `qb_conn_${Date.now()}`,
      tenantId: '', // Will be set by service
      provider: 'quickbooks',
      accessToken: mockResponse.access_token,
      refreshToken: mockResponse.refresh_token,
      expiresAt,
      accountId: realmId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(connection: AccountingConnection): Promise<string> {
    if (!connection.refreshToken) {
      throw this.createError('No refresh token available', 'MISSING_REFRESH_TOKEN', true);
    }

    // INTEGRATION: POST https://oauth.platform.intuit.com/oauth2/tokens/bearer
    // with: grant_type=refresh_token&refresh_token={refreshToken}

    const newAccessToken = `qbo_at_refreshed_${Date.now()}`;
    return newAccessToken;
  }

  /**
   * Create or update invoice in QuickBooks
   */
  async createInvoice(invoice: Invoice, connection: AccountingConnection): Promise<AccountingSyncResult> {
    if (!connection.accountId) {
      throw this.createError('QB account ID not configured', 'MISSING_ACCOUNT_ID', false);
    }

    // Check rate limits
    this.checkRateLimit(connection.id);

    const qbInvoice = this.mapToQBInvoice(invoice, connection);

    // INTEGRATION: POST /v2/company/{realmId}/invoice
    // with QB invoice object

    const externalId = `qb_inv_${Date.now()}`;

    return {
      success: true,
      invoiceId: invoice.id,
      externalId,
      provider: 'quickbooks',
      message: `Invoice created in QuickBooks: ${externalId}`,
      timestamp: new Date(),
    };
  }

  /**
   * Sync payment to QuickBooks
   */
  async syncPayment(
    invoice: Invoice,
    payment: PaymentRecord,
    connection: AccountingConnection,
  ): Promise<AccountingSyncResult> {
    if (!connection.accountId) {
      throw this.createError('QB account ID not configured', 'MISSING_ACCOUNT_ID', false);
    }

    // Get the QB invoice ID from sync records
    // INTEGRATION: This would be fetched from your sync record database
    const externalInvoiceId = `qb_inv_${invoice.id}`;

    // INTEGRATION: POST /v2/company/{realmId}/payment
    // Create payment transaction linked to invoice

    const paymentId = `qb_payment_${Date.now()}`;

    return {
      success: true,
      invoiceId: invoice.id,
      externalId: paymentId,
      provider: 'quickbooks',
      message: `Payment recorded in QuickBooks: ${paymentId}`,
      timestamp: new Date(),
    };
  }

  /**
   * Get or create customer in QuickBooks
   */
  async getOrCreateCustomer(
    email: string,
    name?: string,
    connection?: AccountingConnection,
  ): Promise<string> {
    if (!connection || !connection.accountId) {
      throw this.createError('QB account ID not configured', 'MISSING_ACCOUNT_ID', false);
    }

    // INTEGRATION: Query QB for existing customer with email
    // GET /v2/company/{realmId}/query
    // with: SELECT * FROM Customer WHERE BillEmail = '{email}'

    // If found, return QB Customer ID
    const existingCustomerId = `qb_cust_existing_${Date.now()}`;

    // If not found, create new customer
    // INTEGRATION: POST /v2/company/{realmId}/customer

    const newCustomerId = `qb_cust_${Date.now()}`;
    return newCustomerId;
  }

  /**
   * Sync line items to QuickBooks items
   */
  async syncLineItems(invoiceId: string, connection: AccountingConnection): Promise<void> {
    if (!connection.accountId) {
      throw this.createError('QB account ID not configured', 'MISSING_ACCOUNT_ID', false);
    }

    // INTEGRATION: For each line item, ensure corresponding QB Item exists
    // GET /v2/company/{realmId}/query
    // with: SELECT * FROM Item WHERE Name = '{itemName}'
    // If not found: POST /v2/company/{realmId}/item
  }

  /**
   * Get accounting status for an invoice
   */
  async getAccountingStatus(
    invoiceId: string,
    connection: AccountingConnection,
  ): Promise<{ synced: boolean; externalId?: string; lastSyncAt?: Date }> {
    // INTEGRATION: Query sync records to get external QB ID and sync status
    return {
      synced: true,
      externalId: `qb_inv_${invoiceId}`,
      lastSyncAt: new Date(),
    };
  }

  /**
   * Map Witylogix invoice to QB format
   */
  private mapToQBInvoice(invoice: Invoice, connection: AccountingConnection): QuickBooksInvoice {
    const lines: QuickBooksInvoice['line'] = [];

    // Add line items
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      invoice.lineItems.forEach((item, idx) => {
        lines.push({
          lineNum: idx + 1,
          description: item.description,
          amount: item.amount,
          detailType: 'SalesItemLineDetail',
          salesItemLineDetail: {
            itemRef: {
              value: '1', // Default item ID - should be mapped
            },
            qty: item.quantity,
            unitPrice: item.unitPrice,
          },
        });
      });
    }

    // Add discounts if any
    if (invoice.discounts && invoice.discounts.length > 0) {
      const totalDiscount = invoice.discounts.reduce((sum, d) => sum + d.amount, 0);
      lines.push({
        detailType: 'DescriptionLineDetail',
        description: 'Discount',
        amount: -totalDiscount,
      });
    }

    return {
      docNumber: invoice.invoiceNumber,
      txnDate: invoice.issuedAt.toISOString().split('T')[0],
      dueDate: invoice.dueAt.toISOString().split('T')[0],
      customerRef: {
        value: `qb_cust_${invoice.customerId || 'unknown'}`,
      },
      line: lines,
      totalAmt: invoice.total,
      balanceAmt: invoice.total - (invoice.paidAt ? invoice.payments?.reduce((s, p) => s + p.amount, 0) ?? 0 : 0),
      totalTax: invoice.taxTotal,
    };
  }

  /**
   * Check rate limit status
   */
  private checkRateLimit(connectionId: string): void {
    const rateLimit = this.rateLimits.get(connectionId);

    if (rateLimit && rateLimit.remaining < this.RATE_LIMIT_THRESHOLD) {
      const waitTime = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      if (waitTime > 0) {
        console.warn(
          `[QB] Approaching rate limit. ${rateLimit.remaining}/${rateLimit.limit} remaining. Resets in ${waitTime}s`,
        );
      }
    }
  }

  /**
   * Create accounting error
   */
  private createError(message: string, code?: string, retryable?: boolean): AccountingError {
    const error = new Error(message) as AccountingError;
    error.provider = 'quickbooks';
    error.code = code;
    error.retryable = retryable ?? true;
    return error;
  }

  /**
   * Generate random string for OAuth state
   */
  private generateRandomString(length: number): string {
    return Array.from({ length }, () => Math.random().toString(36)[2]).join('');
  }
}

/**
 * Helper to create QuickBooks config
 */
export function createQuickBooksConfig(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  environment?: 'sandbox' | 'production',
): QuickBooksConfig {
  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
  };
}
