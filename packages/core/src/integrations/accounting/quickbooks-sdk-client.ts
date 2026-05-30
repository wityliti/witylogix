/**
 * QuickBooks Online SDK Client
 *
 * Comprehensive REST API client for QuickBooks Online with:
 * - OAuth2 flow management (authorization, code exchange, refresh, revoke)
 * - Invoice management (create, read, update, void, send, PDF)
 * - Payment processing (create, void, apply)
 * - Customer management (CRUD, queries)
 * - Items/products (CRUD with inventory)
 * - Bills and bill payments
 * - Estimates/quotes
 * - Reports (P&L, Balance Sheet, Cash Flow)
 * - Webhook verification
 * - Rate limiting (500 req/min)
 * - Sandbox/production switching
 *
 * Uses Zod for response validation and error mapping.
 */

import { createHmac } from 'crypto';
import { z } from 'zod';
import type { ConfigService } from '../../config/config-service.js';

// ─── TYPES ──────────────────────────────────────────────────────────

/**
 * QBInvoice represents a QuickBooks invoice
 */
export interface QBInvoice {
  id?: string;
  syncToken?: string;
  docNumber: string;
  txnDate: string;
  dueDate?: string;
  customerRef: {
    value: string;
    name?: string;
  };
  line: Array<{
    lineNum?: number;
    description: string;
    amount: number;
    detailType: 'SalesItemLineDetail' | 'DescriptionLineDetail';
    salesItemLineDetail?: {
      itemRef: { value: string; name?: string };
      qty: number;
      unitPrice?: number;
      taxCodeRef?: { value: string };
    };
  }>;
  totalAmt: number;
  balanceAmt?: number;
  totalTax?: number;
  applyTaxAfterDiscount?: boolean;
  metadata?: Record<string, unknown>;
}

export interface QBPayment {
  id?: string;
  syncToken?: string;
  txnDate: string;
  line: Array<{
    amount: number;
    linkedTxn: Array<{
      txnId: string;
      txnType: 'Invoice';
    }>;
    detailType: 'PaymentLineDetail';
  }>;
  totalAmt: number;
  customerRef: {
    value: string;
    name?: string;
  };
  depositToAccountRef?: {
    value: string;
    name?: string;
  };
  paymentMethodRef?: {
    value: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface QBCustomer {
  id?: string;
  syncToken?: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  primaryEmailAddr?: { address: string };
  primaryPhone?: { freeFormNumber: string };
  billingAddr?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface QBItem {
  id?: string;
  syncToken?: string;
  name: string;
  description?: string;
  type: 'Service' | 'Inventory' | 'NonInventory';
  unitPrice?: number;
  incomeAccountRef: { value: string; name?: string };
  assetAccountRef?: { value: string; name?: string };
  expenseAccountRef?: { value: string; name?: string };
  qtyOnHand?: number;
  reorderPoint?: number;
  metadata?: Record<string, unknown>;
}

export interface QBBill {
  id?: string;
  syncToken?: string;
  docNumber: string;
  txnDate: string;
  dueDate?: string;
  vendorRef: {
    value: string;
    name?: string;
  };
  line: Array<{
    lineNum?: number;
    description: string;
    amount: number;
    detailType: 'AccountBasedExpenseLineDetail' | 'ItemBasedExpenseLineDetail';
  }>;
  totalAmt: number;
  metadata?: Record<string, unknown>;
}

export interface QBAccount {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface QBBillPayment {
  id?: string;
  syncToken?: string;
  txnDate: string;
  line: Array<{
    amount: number;
    linkedTxn: Array<{
      txnId: string;
      txnType: 'Bill';
    }>;
    detailType: 'BillPaymentLineDetail';
  }>;
  totalAmt: number;
  vendorRef: {
    value: string;
    name?: string;
  };
  paymentMethodRef?: {
    value: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface QBEstimate {
  id?: string;
  syncToken?: string;
  docNumber: string;
  txnDate: string;
  dueDate?: string;
  expirationDate?: string;
  customerRef: {
    value: string;
    name?: string;
  };
  line: Array<{
    lineNum?: number;
    description: string;
    amount: number;
    detailType: 'SalesItemLineDetail' | 'DescriptionLineDetail';
  }>;
  totalAmt: number;
  metadata?: Record<string, unknown>;
}

export interface QBCompanyInfo {
  companyName: string;
  legal_addr?: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  primaryEmailAddr?: { address: string };
  primaryPhone?: { freeFormNumber: string };
  taxId?: string;
  fiscalYearStart?: string;
  metadata?: Record<string, unknown>;
}

export interface QBRateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────────

const QBInvoiceSchema = z.object({
  id: z.string().optional(),
  syncToken: z.string().optional(),
  docNumber: z.string().min(1),
  txnDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  customerRef: z.object({
    value: z.string().min(1),
    name: z.string().optional(),
  }),
  line: z.array(
    z.object({
      lineNum: z.number().optional(),
      description: z.string().min(1),
      amount: z.number().min(0),
      detailType: z.enum(['SalesItemLineDetail', 'DescriptionLineDetail']),
      salesItemLineDetail: z.object({
        itemRef: z.object({ value: z.string(), name: z.string().optional() }),
        qty: z.number().min(0),
        unitPrice: z.number().optional(),
        taxCodeRef: z.object({ value: z.string() }).optional(),
      }).optional(),
    })
  ).min(1),
  totalAmt: z.number().min(0),
  balanceAmt: z.number().optional(),
  totalTax: z.number().optional(),
  applyTaxAfterDiscount: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const QBPaymentSchema = z.object({
  id: z.string().optional(),
  syncToken: z.string().optional(),
  txnDate: z.string().datetime(),
  line: z.array(
    z.object({
      amount: z.number().min(0),
      linkedTxn: z.array(
        z.object({
          txnId: z.string().min(1),
          txnType: z.literal('Invoice'),
        })
      ).min(1),
      detailType: z.literal('PaymentLineDetail'),
    })
  ).min(1),
  totalAmt: z.number().min(0),
  customerRef: z.object({
    value: z.string().min(1),
    name: z.string().optional(),
  }),
  depositToAccountRef: z.object({
    value: z.string().min(1),
    name: z.string().optional(),
  }).optional(),
  paymentMethodRef: z.object({
    value: z.string().min(1),
    name: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────

export class QuickBooksError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QuickBooksError';
  }
}

// ─── SDK CLIENT ─────────────────────────────────────────────────────

/**
 * QuickBooks Online SDK Client
 *
 * Manages OAuth2 authentication and comprehensive API interactions
 * with QuickBooks Online using REST API v73.
 */
export class QuickBooksSDKClient {
  private config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    environment: 'sandbox' | 'production';
    timeout: number;
    maxRetries: number;
  };

  private apiBaseUrl: string;
  private authBaseUrl: string;
  private minorVersion: string = '73';
  private rateLimits: Map<string, QBRateLimitInfo> = new Map();

  constructor(
    private configService: ConfigService,
    config?: Partial<typeof QuickBooksSDKClient.prototype.config>
  ) {
    const env = config?.environment || 'production';
    this.config = {
      clientId: this.configService.get('quickbooks.clientId') as string,
      clientSecret: this.configService.get('quickbooks.clientSecret') as string,
      redirectUri: this.configService.get('quickbooks.redirectUri') as string,
      environment: env as 'sandbox' | 'production',
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3,
      ...config,
    };

    const isSandbox = this.config.environment === 'sandbox';
    this.apiBaseUrl = 'https://quickbooks.api.intuit.com/v2/company';
    this.authBaseUrl = `https://${isSandbox ? 'sandbox' : 'auth'}.intuit.com`;
  }

  /**
   * Get OAuth authorization URL
   * @param state - Optional state parameter for CSRF protection
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.config.redirectUri,
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/oauth2/v1/oauth2Endpoint/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from OAuth callback
   * @param realmId - QuickBooks Realm ID (Company ID)
   */
  async exchangeAuthorizationCode(
    code: string,
    realmId: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    realmId: string;
  }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    try {
      const response = await this.request('POST', `${this.authBaseUrl}/oauth2/v1/tokens/bearer`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      return {
        accessToken: response.access_token as string,
        refreshToken: response.refresh_token as string,
        expiresIn: response.expires_in as number,
        realmId,
      };
    } catch (error) {
      throw new QuickBooksError(
        'Failed to exchange authorization code',
        'QB_AUTH_EXCHANGE_FAILED',
        401,
        false,
        { originalError: String(error) }
      );
    }
  }

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    try {
      const response = await this.request('POST', `${this.authBaseUrl}/oauth2/v1/tokens/bearer`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      return {
        accessToken: response.access_token as string,
        refreshToken: response.refresh_token as string,
        expiresIn: response.expires_in as number,
      };
    } catch (error) {
      throw new QuickBooksError(
        'Failed to refresh access token',
        'QB_REFRESH_FAILED',
        401,
        true,
        { originalError: String(error) }
      );
    }
  }

  /**
   * Revoke access token
   * @param token - Access token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    const body = new URLSearchParams({
      token,
    });

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    try {
      await this.request('POST', `${this.authBaseUrl}/oauth2/v1/tokens/revoke`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (error) {
      throw new QuickBooksError(
        'Failed to revoke token',
        'QB_REVOKE_FAILED',
        500,
        false,
        { originalError: String(error) }
      );
    }
  }

  // ─── INVOICE OPERATIONS ──────────────────────────────────────────

  /**
   * Create invoice in QuickBooks
   */
  async createInvoice(
    accessToken: string,
    realmId: string,
    invoice: QBInvoice
  ): Promise<QBInvoice> {
    const validated = QBInvoiceSchema.parse(invoice);

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/invoice`,
      accessToken,
      validated
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Read invoice from QuickBooks
   */
  async getInvoice(
    accessToken: string,
    realmId: string,
    invoiceId: string
  ): Promise<QBInvoice> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/invoice/${invoiceId}`,
      accessToken
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Update invoice in QuickBooks
   */
  async updateInvoice(
    accessToken: string,
    realmId: string,
    invoice: QBInvoice
  ): Promise<QBInvoice> {
    if (!invoice.id || !invoice.syncToken) {
      throw new QuickBooksError(
        'Invoice ID and syncToken are required for updates',
        'QB_INVALID_REQUEST',
        400,
        false
      );
    }

    const validated = QBInvoiceSchema.parse(invoice);

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/invoice`,
      accessToken,
      validated
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Void invoice in QuickBooks
   */
  async voidInvoice(
    accessToken: string,
    realmId: string,
    invoiceId: string,
    syncToken: string
  ): Promise<QBInvoice> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/invoice/${invoiceId}?operation=void&syncToken=${syncToken}`,
      accessToken
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(
    accessToken: string,
    realmId: string,
    invoiceId: string,
    email: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/invoice/${invoiceId}/send?sendTo=${email}`,
      accessToken
    );

    return {
      success: response.status === 'success' || response.id === invoiceId,
      message: 'Invoice sent successfully',
    };
  }

  /**
   * Download invoice as PDF
   */
  async downloadInvoicePDF(
    accessToken: string,
    realmId: string,
    invoiceId: string
  ): Promise<Buffer> {
    const response = await this.request('GET', `${this.apiBaseUrl}/company/${realmId}/invoice/${invoiceId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response instanceof Buffer) {
      return response;
    }

    throw new QuickBooksError(
      'Failed to download PDF',
      'QB_PDF_DOWNLOAD_FAILED',
      500,
      false
    );
  }

  // ─── PAYMENT OPERATIONS ──────────────────────────────────────────

  /**
   * Create payment in QuickBooks
   */
  async createPayment(
    accessToken: string,
    realmId: string,
    payment: QBPayment
  ): Promise<QBPayment> {
    const validated = QBPaymentSchema.parse(payment);

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/payment`,
      accessToken,
      validated
    );

    return this.parsePaymentResponse(response);
  }

  /**
   * Read payment from QuickBooks
   */
  async getPayment(
    accessToken: string,
    realmId: string,
    paymentId: string
  ): Promise<QBPayment> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/payment/${paymentId}`,
      accessToken
    );

    return this.parsePaymentResponse(response);
  }

  /**
   * Void payment in QuickBooks
   */
  async voidPayment(
    accessToken: string,
    realmId: string,
    paymentId: string,
    syncToken: string
  ): Promise<QBPayment> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/payment/${paymentId}?operation=void&syncToken=${syncToken}`,
      accessToken
    );

    return this.parsePaymentResponse(response);
  }

  // ─── CUSTOMER OPERATIONS ─────────────────────────────────────────

  /**
   * Create customer in QuickBooks
   */
  async createCustomer(
    accessToken: string,
    realmId: string,
    customer: QBCustomer
  ): Promise<QBCustomer> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/customer`,
      accessToken,
      customer
    );

    return (response.Customer ?? response) as QBCustomer;
  }

  /**
   * Read customer from QuickBooks
   */
  async getCustomer(
    accessToken: string,
    realmId: string,
    customerId: string
  ): Promise<QBCustomer> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/customer/${customerId}`,
      accessToken
    );

    return (response.Customer ?? response) as QBCustomer;
  }

  /**
   * Update customer in QuickBooks
   */
  async updateCustomer(
    accessToken: string,
    realmId: string,
    customer: QBCustomer
  ): Promise<QBCustomer> {
    if (!customer.id || !customer.syncToken) {
      throw new QuickBooksError(
        'Customer ID and syncToken are required for updates',
        'QB_INVALID_REQUEST',
        400,
        false
      );
    }

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/customer`,
      accessToken,
      customer
    );

    return (response.Customer ?? response) as QBCustomer;
  }

  /**
   * Query customers using QB SQL-like syntax
   */
  async queryCustomers(
    accessToken: string,
    realmId: string,
    query: string
  ): Promise<QBCustomer[]> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      accessToken
    );

    const qr = response.QueryResponse as { Customer?: QBCustomer[] } | undefined;
    return (qr?.Customer ?? []) as QBCustomer[];
  }

  // ─── ITEM OPERATIONS ────────────────────────────────────────────

  /**
   * Create item in QuickBooks
   */
  async createItem(
    accessToken: string,
    realmId: string,
    item: QBItem
  ): Promise<QBItem> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/item`,
      accessToken,
      item
    );

    return (response.Item ?? response) as QBItem;
  }

  /**
   * Read item from QuickBooks
   */
  async getItem(
    accessToken: string,
    realmId: string,
    itemId: string
  ): Promise<QBItem> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/item/${itemId}`,
      accessToken
    );

    return (response.Item ?? response) as QBItem;
  }

  /**
   * Update item in QuickBooks
   */
  async updateItem(
    accessToken: string,
    realmId: string,
    item: QBItem
  ): Promise<QBItem> {
    if (!item.id || !item.syncToken) {
      throw new QuickBooksError(
        'Item ID and syncToken are required for updates',
        'QB_INVALID_REQUEST',
        400,
        false
      );
    }

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/item`,
      accessToken,
      item
    );

    return (response.Item ?? response) as QBItem;
  }

  // ─── ACCOUNT OPERATIONS ─────────────────────────────────────────

  /**
   * List chart of accounts
   */
  async getChartOfAccounts(
    accessToken: string,
    realmId: string
  ): Promise<QBAccount[]> {
    const query = "select * from Account where Active=true";
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      accessToken
    );

    const qr = response.QueryResponse as { Account?: QBAccount[] } | undefined;
    return (qr?.Account ?? []) as QBAccount[];
  }

  /**
   * Get specific account
   */
  async getAccount(
    accessToken: string,
    realmId: string,
    accountId: string
  ): Promise<QBAccount> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/account/${accountId}`,
      accessToken
    );

    return (response.Account ?? response) as QBAccount;
  }

  // ─── BILL OPERATIONS ────────────────────────────────────────────

  /**
   * Create bill in QuickBooks
   */
  async createBill(
    accessToken: string,
    realmId: string,
    bill: QBBill
  ): Promise<QBBill> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/bill`,
      accessToken,
      bill
    );

    return (response.Bill ?? response) as QBBill;
  }

  /**
   * Read bill from QuickBooks
   */
  async getBill(
    accessToken: string,
    realmId: string,
    billId: string
  ): Promise<QBBill> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/bill/${billId}`,
      accessToken
    );

    return (response.Bill ?? response) as QBBill;
  }

  /**
   * Update bill in QuickBooks
   */
  async updateBill(
    accessToken: string,
    realmId: string,
    bill: QBBill
  ): Promise<QBBill> {
    if (!bill.id || !bill.syncToken) {
      throw new QuickBooksError(
        'Bill ID and syncToken are required for updates',
        'QB_INVALID_REQUEST',
        400,
        false
      );
    }

    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/bill`,
      accessToken,
      bill
    );

    return (response.Bill ?? response) as QBBill;
  }

  /**
   * Delete bill in QuickBooks
   */
  async deleteBill(
    accessToken: string,
    realmId: string,
    bill: QBBill
  ): Promise<{ success: boolean }> {
    if (!bill.id || !bill.syncToken) {
      throw new QuickBooksError(
        'Bill ID and syncToken are required for deletion',
        'QB_INVALID_REQUEST',
        400,
        false
      );
    }

    await this.apiRequest(
      'POST',
      `/company/${realmId}/bill?operation=delete&syncToken=${bill.syncToken}`,
      accessToken,
      { id: bill.id, syncToken: bill.syncToken }
    );

    return { success: true };
  }

  // ─── ESTIMATE OPERATIONS ────────────────────────────────────────

  /**
   * Create estimate in QuickBooks
   */
  async createEstimate(
    accessToken: string,
    realmId: string,
    estimate: QBEstimate
  ): Promise<QBEstimate> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/estimate`,
      accessToken,
      estimate
    );

    return (response.Estimate ?? response) as QBEstimate;
  }

  /**
   * Send estimate via email
   */
  async sendEstimateEmail(
    accessToken: string,
    realmId: string,
    estimateId: string,
    email: string
  ): Promise<{ success: boolean }> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/estimate/${estimateId}/send?sendTo=${email}`,
      accessToken
    );

    return { success: response.status === 'success' || response.id === estimateId };
  }

  /**
   * Convert estimate to invoice
   */
  async convertEstimateToInvoice(
    accessToken: string,
    realmId: string,
    estimateId: string
  ): Promise<QBInvoice> {
    const response = await this.apiRequest(
      'POST',
      `/company/${realmId}/estimate/${estimateId}?operation=convert`,
      accessToken
    );

    return this.parseInvoiceResponse(response);
  }

  // ─── COMPANY INFO ───────────────────────────────────────────────

  /**
   * Get company information
   */
  async getCompanyInfo(
    accessToken: string,
    realmId: string
  ): Promise<QBCompanyInfo> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/companyinfo/${realmId}`,
      accessToken
    );

    return (response.CompanyInfo ?? response) as QBCompanyInfo;
  }

  /**
   * Get company preferences
   */
  async getCompanyPreferences(
    accessToken: string,
    realmId: string
  ): Promise<Record<string, unknown>> {
    const response = await this.apiRequest(
      'GET',
      `/company/${realmId}/preferences`,
      accessToken
    );

    return (response.Preferences ?? response) as Record<string, unknown>;
  }

  // ─── REPORTS ────────────────────────────────────────────────────

  /**
   * Get Profit & Loss report
   */
  async getProfitAndLossReport(
    accessToken: string,
    realmId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);

    return this.apiRequest(
      'GET',
      `/company/${realmId}/reports/ProfitAndLoss?${params}`,
      accessToken
    );
  }

  /**
   * Get Balance Sheet report
   */
  async getBalanceSheetReport(
    accessToken: string,
    realmId: string,
    options?: { asOfDate?: string }
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (options?.asOfDate) params.append('as_of_date', options.asOfDate);

    return this.apiRequest(
      'GET',
      `/company/${realmId}/reports/BalanceSheet?${params}`,
      accessToken
    );
  }

  /**
   * Get Cash Flow report
   */
  async getCashFlowReport(
    accessToken: string,
    realmId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);

    return this.apiRequest(
      'GET',
      `/company/${realmId}/reports/CashFlow?${params}`,
      accessToken
    );
  }

  // ─── WEBHOOK VERIFICATION ──────────────────────────────────────

  /**
   * Verify Intuit webhook signature
   * Uses HMAC-SHA256 verification
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookToken: string
  ): boolean {
    const hash = createHmac('sha256', webhookToken)
      .update(payload)
      .digest('base64');

    return hash === signature;
  }

  // ─── PRIVATE METHODS ────────────────────────────────────────────

  /**
   * Make API request to QuickBooks
   */
  private async apiRequest(
    method: string,
    endpoint: string,
    accessToken: string,
    body?: unknown
  ): Promise<Record<string, unknown>> {
    const url = `${this.apiBaseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}minorversion=${this.minorVersion}`;

    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };
    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await this.request(method, url, {
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Update rate limit info from response headers (if available)
    const remaining = response['x-rate-limit-remaining'];
    const limit = response['x-rate-limit-limit'];
    if (remaining && limit) {
      const resetAt = new Date();
      resetAt.setMinutes(resetAt.getMinutes() + 1);
      this.rateLimits.set('qb', {
        remaining: parseInt(remaining as string),
        limit: parseInt(limit as string),
        resetAt,
      });
    }

    return response;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: string | Buffer;
    } = {}
  ): Promise<Record<string, unknown>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Using fetch API (available in Node 18+)
        const response = await fetch(url, {
          method,
          headers: {
            'User-Agent': 'Witylogix/1.0',
            ...options.headers,
          },
          body: options.body,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new QuickBooksError(
            `HTTP ${response.status}: ${errorBody}`,
            'QB_HTTP_ERROR',
            response.status,
            response.status >= 500 || response.status === 429
          );
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/pdf')) {
          return await response.arrayBuffer() as unknown as Record<string, unknown>;
        }

        return (await response.json()) as Record<string, unknown>;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw new QuickBooksError(
      `Request failed after ${this.config.maxRetries} retries`,
      'QB_REQUEST_FAILED',
      500,
      true,
      { originalError: lastError?.message }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private parseInvoiceResponse(response: Record<string, unknown>): QBInvoice {
    const invoice = (response.Invoice || response) as QBInvoice;
    return QBInvoiceSchema.parse(invoice);
  }

  private parsePaymentResponse(response: Record<string, unknown>): QBPayment {
    const payment = (response.Payment || response) as QBPayment;
    return QBPaymentSchema.parse(payment);
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): QBRateLimitInfo | undefined {
    return this.rateLimits.get('qb');
  }
}
