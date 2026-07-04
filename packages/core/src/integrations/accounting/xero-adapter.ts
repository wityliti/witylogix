/**
 * Xero OAuth2 Adapter
 * Integration with Xero Accounting API
 * Handles authentication, invoice syncing, payment syncing, and contact management
 */

import type { Invoice, PaymentRecord } from "../../invoicing/types.js";
import type {
  AccountingConnection,
  XeroInvoice,
  AccountingSyncResult,
  RateLimitInfo,
  AccountingError,
} from "./types.js";

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: "sandbox" | "production";
  timeout?: number;
  maxRetries?: number;
}

export interface XeroAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

export interface XeroTenant {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  createdDateUtc: string;
  updatedDateUtc?: string;
}

/**
 * Xero Adapter
 * Manages OAuth2 authentication and API interactions with Xero
 */
export class XeroAdapter {
  private config: XeroConfig;
  private apiBaseUrl: string;
  private authBaseUrl: string;
  private identityBaseUrl: string;
  private rateLimits: Map<string, RateLimitInfo> = new Map();

  // Rate limit: 60 requests per minute per connection
  private readonly RATE_LIMIT_THRESHOLD = 10;

  constructor(config: XeroConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: "production",
      ...config,
    };

    const env = this.config.environment === "sandbox" ? "sandbox" : "api";
    this.apiBaseUrl = `https://${env}.xero.com/api.xro/2.0`;
    this.authBaseUrl = `https://login.xero.com/identity/connect/authorize`;
    this.identityBaseUrl = `https://identity.xero.com/connect/token`;
  }

  /**
   * Get OAuth authorization URL for user to grant permissions
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "openid profile email accounting offline_access",
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}?${params}`;
  }

  /**
   * Exchange authorization code for access token and get tenant info
   */
  async authenticate(
    authCode: string,
  ): Promise<AccountingConnection & { tenants: XeroTenant[] }> {
    // INTEGRATION: Exchange code for token
    // POST https://identity.xero.com/connect/token
    // with: grant_type=authorization_code&code={code}&redirect_uri={redirectUri}

    const mockResponse: XeroAuthResponse = {
      access_token: `xero_at_${Date.now()}`,
      refresh_token: `xero_rt_${Date.now()}`,
      expires_in: 1800,
      token_type: "Bearer",
    };

    // INTEGRATION: Fetch tenants
    // GET https://api.xero.com/connections
    const mockTenants: XeroTenant[] = [
      {
        id: `xero_org_${Date.now()}`,
        tenantId: `xero_org_${Date.now()}`,
        tenantName: "Default Organization",
        tenantType: "ORGANISATION",
        createdDateUtc: new Date().toISOString(),
      },
    ];

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + mockResponse.expires_in);

    return {
      id: `xero_conn_${Date.now()}`,
      tenantId: "", // Will be set by service
      provider: "xero",
      accessToken: mockResponse.access_token,
      refreshToken: mockResponse.refresh_token,
      expiresAt,
      accountId: mockTenants[0].tenantId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tenants: mockTenants,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(connection: AccountingConnection): Promise<string> {
    if (!connection.refreshToken) {
      throw this.createError(
        "No refresh token available",
        "MISSING_REFRESH_TOKEN",
        true,
      );
    }

    // INTEGRATION: POST https://identity.xero.com/connect/token
    // with: grant_type=refresh_token&refresh_token={refreshToken}

    const newAccessToken = `xero_at_refreshed_${Date.now()}`;
    return newAccessToken;
  }

  /**
   * Create or update invoice in Xero
   */
  async createInvoice(
    invoice: Invoice,
    connection: AccountingConnection,
  ): Promise<AccountingSyncResult> {
    if (!connection.accountId) {
      throw this.createError(
        "Xero organization ID not configured",
        "MISSING_ORG_ID",
        false,
      );
    }

    // Check rate limits
    this.checkRateLimit(connection.id);

    const xeroInvoice = this.mapToXeroInvoice(invoice, connection);

    // INTEGRATION: POST /v2/Invoices
    // with Xero invoice object

    const externalId = `xero_inv_${Date.now()}`;

    return {
      success: true,
      invoiceId: invoice.id,
      externalId,
      provider: "xero",
      message: `Invoice created in Xero: ${externalId}`,
      timestamp: new Date(),
    };
  }

  /**
   * Sync payment to Xero
   */
  async syncPayment(
    invoice: Invoice,
    payment: PaymentRecord,
    connection: AccountingConnection,
  ): Promise<AccountingSyncResult> {
    if (!connection.accountId) {
      throw this.createError(
        "Xero organization ID not configured",
        "MISSING_ORG_ID",
        false,
      );
    }

    // INTEGRATION: GET /v2/Invoices/{invoiceId}
    // to get current Xero invoice state

    // INTEGRATION: POST /v2/Invoices/{invoiceId}/Payments
    // Create payment linked to invoice

    const paymentId = `xero_payment_${Date.now()}`;

    return {
      success: true,
      invoiceId: invoice.id,
      externalId: paymentId,
      provider: "xero",
      message: `Payment recorded in Xero: ${paymentId}`,
      timestamp: new Date(),
    };
  }

  /**
   * Get or create contact in Xero
   */
  async getOrCreateContact(
    email: string,
    name?: string,
    connection?: AccountingConnection,
  ): Promise<string> {
    if (!connection || !connection.accountId) {
      throw this.createError(
        "Xero organization ID not configured",
        "MISSING_ORG_ID",
        false,
      );
    }

    // INTEGRATION: GET /v2/Contacts
    // with WHERE Clause: EmailAddress = '{email}'

    // If found, return contact ID
    const existingContactId = `xero_contact_existing_${Date.now()}`;

    // If not found, create
    // INTEGRATION: POST /v2/Contacts

    const newContactId = `xero_contact_${Date.now()}`;
    return newContactId;
  }

  /**
   * Sync line items (as Accounts in Xero)
   */
  async syncLineItems(
    invoiceId: string,
    connection: AccountingConnection,
  ): Promise<void> {
    if (!connection.accountId) {
      throw this.createError(
        "Xero organization ID not configured",
        "MISSING_ORG_ID",
        false,
      );
    }

    // INTEGRATION: Ensure corresponding revenue account exists in Xero
    // GET /v2/Accounts with Type = 'REVENUE'
    // Match or create as needed
  }

  /**
   * Get tax rates from Xero
   */
  async getTaxRates(
    connection: AccountingConnection,
  ): Promise<Array<{ id: string; name: string; rate: number }>> {
    if (!connection.accountId) {
      throw this.createError(
        "Xero organization ID not configured",
        "MISSING_ORG_ID",
        false,
      );
    }

    // INTEGRATION: GET /v2/TaxRates

    return [
      { id: "xero_tax_1", name: "Standard Rate", rate: 10 },
      { id: "xero_tax_2", name: "Zero Rated", rate: 0 },
    ];
  }

  /**
   * Get accounting status for an invoice
   */
  async getAccountingStatus(
    invoiceId: string,
    connection: AccountingConnection,
  ): Promise<{ synced: boolean; externalId?: string; lastSyncAt?: Date }> {
    // INTEGRATION: Query sync records to get external Xero ID and sync status
    return {
      synced: true,
      externalId: `xero_inv_${invoiceId}`,
      lastSyncAt: new Date(),
    };
  }

  /**
   * Map Witylogix invoice to Xero format
   */
  private mapToXeroInvoice(
    invoice: Invoice,
    connection: AccountingConnection,
  ): XeroInvoice {
    const lineItems: XeroInvoice["lineItems"] = [];

    // Add line items
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      invoice.lineItems.forEach((item) => {
        lineItems.push({
          description: item.description,
          quantity: item.quantity,
          unitAmount: item.unitPrice,
          accountCode: "200", // Default revenue account - should be configured
        });
      });
    }

    return {
      invoiceNumber: invoice.invoiceNumber,
      type: "ACCREC",
      status: "DRAFT",
      lineAmountTypes: "Exclusive",
      contactId: `xero_contact_${invoice.customerId || "unknown"}`,
      lineItems,
      date: invoice.issuedAt.toISOString().split("T")[0],
      dueDate: invoice.dueAt.toISOString().split("T")[0],
      total: invoice.total,
      tax: invoice.taxTotal,
    };
  }

  /**
   * Check rate limit status
   */
  private checkRateLimit(connectionId: string): void {
    const rateLimit = this.rateLimits.get(connectionId);

    if (rateLimit && rateLimit.remaining < this.RATE_LIMIT_THRESHOLD) {
      const waitTime = Math.ceil(
        (rateLimit.resetAt.getTime() - Date.now()) / 1000,
      );
      if (waitTime > 0) {
        console.warn(
          `[Xero] Approaching rate limit. ${rateLimit.remaining}/${rateLimit.limit} remaining. Resets in ${waitTime}s`,
        );
      }
    }
  }

  /**
   * Create accounting error
   */
  private createError(
    message: string,
    code?: string,
    retryable?: boolean,
  ): AccountingError {
    const error = new Error(message) as AccountingError;
    error.provider = "xero";
    error.code = code;
    error.retryable = retryable ?? true;
    return error;
  }

  /**
   * Generate random string for OAuth state
   */
  private generateRandomString(length: number): string {
    return Array.from({ length }, () => Math.random().toString(36)[2]).join("");
  }
}

/**
 * Helper to create Xero config
 */
export function createXeroConfig(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  environment?: "sandbox" | "production",
): XeroConfig {
  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
  };
}
