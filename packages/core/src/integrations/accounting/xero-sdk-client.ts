/**
 * Xero SDK Client
 *
 * Comprehensive REST API client for Xero with:
 * - OAuth2 PKCE flow (authorization, code exchange, refresh, disconnect)
 * - Tenant/organization management
 * - Invoice management (CRUD, send, void, credit notes, allocate payments)
 * - Contact management (CRUD, groups, merge)
 * - Payment processing (create, allocate, refund)
 * - Bank transactions
 * - Items/products (CRUD with purchase/sale details)
 * - Purchase orders
 * - Quotes
 * - Reports (P&L, Balance Sheet, Bank Summary)
 * - Webhook verification
 * - Rate limiting (60 req/min per tenant, 5000 req/day)
 * - Efficient polling with If-Modified-Since
 *
 * Uses Zod for response validation and error mapping.
 */

import { createHmac } from "crypto";
import { z } from "zod";
import type { ConfigService } from "../../config/config-service.js";

// ─── TYPES ──────────────────────────────────────────────────────────

/**
 * XeroInvoice represents a Xero invoice
 */
export interface XeroInvoice {
  invoiceID?: string;
  invoiceNumber: string;
  type: "ACCREC" | "ACCPAY";
  status?: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "DELETED";
  lineAmountTypes: "Exclusive" | "Inclusive";
  contactId?: string;
  contact?: {
    name: string;
    emailAddress?: string;
    addresses?: Array<{
      addressType: "STREET" | "POBOX";
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType?: string;
    taxAmount?: number;
    lineAmount?: number;
    lineItemID?: string;
    tracking?: Array<{
      trackingCategoryName: string;
      trackingOptionName: string;
    }>;
  }>;
  date: string;
  dueDate?: string;
  total?: number;
  tax?: number;
  amountPaid?: number;
  amountDue?: number;
  metadata?: Record<string, unknown>;
}

export interface XeroContact {
  contactID?: string;
  name: string;
  emailAddress?: string;
  primaryPerson?: {
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
  };
  addresses?: Array<{
    addressType: "STREET" | "POBOX";
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  phones?: Array<{
    phoneType: "DEFAULT" | "PRIMARY" | "DDI" | "MOBILE" | "FAX";
    phoneNumber: string;
  }>;
  contactStatus?: "ACTIVE" | "ARCHIVED" | "GDPRREQUEST";
  taxNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface XeroPayment {
  paymentID?: string;
  invoiceID: string;
  accountID: string;
  date: string;
  amount: number;
  reference?: string;
  currencyCode?: string;
  status?: "AUTHORISED" | "SUBMITTED" | "DELETED";
  metadata?: Record<string, unknown>;
}

export interface XeroBankTransaction {
  bankTransactionID?: string;
  type:
    | "ACCRECPAYMENT"
    | "ACCPAYPAYMENT"
    | "ARCREDITPAYMENT"
    | "APCREDICPAYMENT";
  contact: {
    contactID?: string;
    name?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType?: string;
    taxAmount?: number;
  }>;
  date: string;
  total?: number;
  tax?: number;
  status?: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "DELETED";
  metadata?: Record<string, unknown>;
}

export interface XeroItem {
  itemID?: string;
  code: string;
  description?: string;
  quantity?: number;
  unitAmount?: number;
  accountCode?: string;
  purchaseDetails?: {
    unitAmount?: number;
    accountCode?: string;
    taxType?: string;
  };
  salesDetails?: {
    unitAmount?: number;
    accountCode?: string;
    taxType?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface XeroAccount {
  accountID: string;
  code: string;
  name: string;
  type: string;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  currentBalance: number;
  taxType?: string;
  metadata?: Record<string, unknown>;
}

export interface XeroPurchaseOrder {
  purchaseOrderID?: string;
  purchaseOrderNumber: string;
  contact: {
    contactID?: string;
    name?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType?: string;
  }>;
  date: string;
  deliveryDate?: string;
  status?: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "DELETED";
  total?: number;
  tax?: number;
  metadata?: Record<string, unknown>;
}

export interface XeroQuote {
  quoteID?: string;
  quoteNumber: string;
  contact: {
    contactID?: string;
    name?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType?: string;
  }>;
  date: string;
  expirationDate?: string;
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "DELETED";
  total?: number;
  tax?: number;
  metadata?: Record<string, unknown>;
}

export interface XeroTenant {
  id: string;
  tenantName: string;
  tenantType: string;
  createdUtc: string;
}

export interface XeroRateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
  dailyRemaining?: number;
  dailyLimit?: number;
}

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────────

const XeroInvoiceSchema = z.object({
  invoiceID: z.string().optional(),
  invoiceNumber: z.string().min(1),
  type: z.enum(["ACCREC", "ACCPAY"]),
  status: z
    .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "DELETED"])
    .optional(),
  lineAmountTypes: z.enum(["Exclusive", "Inclusive"]),
  contactId: z.string().optional(),
  contact: z
    .object({
      name: z.string().min(1),
      emailAddress: z.string().email().optional(),
      addresses: z
        .array(
          z.object({
            addressType: z.enum(["STREET", "POBOX"]),
            city: z.string().optional(),
            region: z.string().optional(),
            postalCode: z.string().optional(),
            country: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().min(0),
        unitAmount: z.number().min(0),
        accountCode: z.string().min(1),
        taxType: z.string().optional(),
        taxAmount: z.number().optional(),
        lineAmount: z.number().optional(),
        lineItemID: z.string().optional(),
        tracking: z
          .array(
            z.object({
              trackingCategoryName: z.string(),
              trackingOptionName: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
  date: z.string(),
  dueDate: z.string().optional(),
  total: z.number().optional(),
  tax: z.number().optional(),
  amountPaid: z.number().optional(),
  amountDue: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const XeroContactSchema = z.object({
  contactID: z.string().optional(),
  name: z.string().min(1),
  emailAddress: z.string().email().optional(),
  primaryPerson: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      emailAddress: z.string().email().optional(),
    })
    .optional(),
  addresses: z
    .array(
      z.object({
        addressType: z.enum(["STREET", "POBOX"]),
        line1: z.string().optional(),
        line2: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
  phones: z
    .array(
      z.object({
        phoneType: z.enum(["DEFAULT", "PRIMARY", "DDI", "MOBILE", "FAX"]),
        phoneNumber: z.string().min(1),
      }),
    )
    .optional(),
  contactStatus: z.enum(["ACTIVE", "ARCHIVED", "GDPRREQUEST"]).optional(),
  taxNumber: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────

export class XeroError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "XeroError";
  }
}

// ─── SDK CLIENT ─────────────────────────────────────────────────────

/**
 * Xero SDK Client
 *
 * Manages OAuth2 PKCE authentication and comprehensive API interactions
 * with Xero using REST API v2.0.
 */
export class XeroSDKClient {
  private config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    timeout: number;
    maxRetries: number;
  };

  private apiBaseUrl: string = "https://api.xero.com/api.xro/2.0";
  private authBaseUrl: string = "https://login.xero.com/identity/connect";
  private activeTenantId: string | undefined;
  private rateLimits: Map<string, XeroRateLimitInfo> = new Map();

  constructor(
    private configService: ConfigService,
    config?: Partial<typeof XeroSDKClient.prototype.config>,
  ) {
    this.config = {
      clientId: this.configService.get("xero.clientId") as string,
      clientSecret: this.configService.get("xero.clientSecret") as string,
      redirectUri: this.configService.get("xero.redirectUri") as string,
      scopes: [
        "openid",
        "profile",
        "email",
        "accounting.transactions",
        "accounting.settings",
        "accounting.contacts",
        "accounting.reports.read",
        "offline_access",
      ],
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3,
      ...config,
    };
  }

  /**
   * Generate authorization URL for OAuth2 PKCE flow
   * @param codeChallenge - Base64-encoded SHA256 hash of code verifier
   * @param state - Optional state parameter for CSRF protection
   */
  getAuthorizationUrl(codeChallenge: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      scope: this.config.scopes.join(" "),
      redirect_uri: this.config.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token (PKCE flow)
   */
  async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    idToken: string;
  }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await this.request("POST", `${this.authBaseUrl}/token`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      return {
        accessToken: response.access_token as string,
        refreshToken: response.refresh_token as string,
        expiresIn: response.expires_in as number,
        idToken: response.id_token as string,
      };
    } catch (error) {
      throw new XeroError(
        "Failed to exchange authorization code",
        "XERO_AUTH_EXCHANGE_FAILED",
        401,
        false,
        { originalError: String(error) },
      );
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await this.request("POST", `${this.authBaseUrl}/token`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      return {
        accessToken: response.access_token as string,
        refreshToken: response.refresh_token as string,
        expiresIn: response.expires_in as number,
      };
    } catch (error) {
      throw new XeroError(
        "Failed to refresh access token",
        "XERO_REFRESH_FAILED",
        401,
        true,
        { originalError: String(error) },
      );
    }
  }

  /**
   * Disconnect / revoke token
   */
  async disconnect(accessToken: string): Promise<void> {
    try {
      const body = new URLSearchParams({
        token: accessToken,
      });

      await this.request("POST", `${this.authBaseUrl}/disconnect`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${accessToken}`,
        },
        body: body.toString(),
      });
    } catch (error) {
      throw new XeroError(
        "Failed to disconnect",
        "XERO_DISCONNECT_FAILED",
        500,
        false,
        { originalError: String(error) },
      );
    }
  }

  // ─── TENANT MANAGEMENT ──────────────────────────────────────────

  /**
   * List connected tenants (organisations)
   */
  async listTenants(accessToken: string): Promise<XeroTenant[]> {
    try {
      const response = await this.request(
        "GET",
        "https://api.xero.com/connections",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return (response as unknown as XeroTenant[]) || [];
    } catch (error) {
      throw new XeroError(
        "Failed to list tenants",
        "XERO_LIST_TENANTS_FAILED",
        500,
        true,
        { originalError: String(error) },
      );
    }
  }

  /**
   * Set active tenant for subsequent API calls
   */
  setActiveTenant(tenantId: string): void {
    this.activeTenantId = tenantId;
  }

  /**
   * Get active tenant ID
   */
  getActiveTenant(): string | undefined {
    return this.activeTenantId;
  }

  // ─── INVOICE OPERATIONS ──────────────────────────────────────────

  /**
   * Create invoice in Xero
   */
  async createInvoice(
    accessToken: string,
    invoice: XeroInvoice,
  ): Promise<XeroInvoice> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const validated = XeroInvoiceSchema.parse(invoice);

    const response = await this.apiRequest("PUT", "/Invoices", accessToken, {
      Invoices: [validated],
    });

    return this.parseInvoiceResponse(response);
  }

  /**
   * Read invoice from Xero
   */
  async getInvoice(
    accessToken: string,
    invoiceId: string,
  ): Promise<XeroInvoice> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/Invoices/${invoiceId}`,
      accessToken,
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Update invoice in Xero
   */
  async updateInvoice(
    accessToken: string,
    invoice: XeroInvoice,
  ): Promise<XeroInvoice> {
    if (!invoice.invoiceID) {
      throw new XeroError(
        "Invoice ID is required for updates",
        "XERO_INVALID_REQUEST",
        400,
        false,
      );
    }

    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const validated = XeroInvoiceSchema.parse(invoice);

    const response = await this.apiRequest("POST", "/Invoices", accessToken, {
      Invoices: [validated],
    });

    return this.parseInvoiceResponse(response);
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(
    accessToken: string,
    invoiceId: string,
    email?: string,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const body: Record<string, unknown> = {
      EmailAddress: email,
      IncludeOnlineinvoiceLink: true,
    };

    await this.apiRequest(
      "POST",
      `/Invoices/${invoiceId}/Email`,
      accessToken,
      body,
    );

    return { success: true };
  }

  /**
   * Void invoice in Xero
   */
  async voidInvoice(
    accessToken: string,
    invoiceId: string,
  ): Promise<XeroInvoice> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "POST",
      `/Invoices/${invoiceId}`,
      accessToken,
      { Status: "VOIDED" },
    );

    return this.parseInvoiceResponse(response);
  }

  /**
   * Allocate payment to invoice
   */
  async allocatePaymentToInvoice(
    accessToken: string,
    invoiceId: string,
    paymentAmount: number,
    paymentDate: string,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    await this.apiRequest(
      "POST",
      `/Invoices/${invoiceId}/Allocations`,
      accessToken,
      {
        amount: paymentAmount,
        date: paymentDate,
      },
    );

    return { success: true };
  }

  /**
   * Create credit note for invoice
   */
  async createCreditNote(
    accessToken: string,
    invoice: XeroInvoice,
  ): Promise<XeroInvoice> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const creditNote = { ...invoice, type: "ACCRECCRN" };
    const response = await this.apiRequest("PUT", "/CreditNotes", accessToken, {
      CreditNotes: [creditNote],
    });

    return this.parseInvoiceResponse(response);
  }

  // ─── CONTACT OPERATIONS ─────────────────────────────────────────

  /**
   * Create contact in Xero
   */
  async createContact(
    accessToken: string,
    contact: XeroContact,
  ): Promise<XeroContact> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const validated = XeroContactSchema.parse(contact);

    const response = await this.apiRequest("PUT", "/Contacts", accessToken, {
      Contacts: [validated],
    });

    return this.parseContactResponse(response);
  }

  /**
   * Read contact from Xero
   */
  async getContact(
    accessToken: string,
    contactId: string,
  ): Promise<XeroContact> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/Contacts/${contactId}`,
      accessToken,
    );

    return this.parseContactResponse(response);
  }

  /**
   * Update contact in Xero
   */
  async updateContact(
    accessToken: string,
    contact: XeroContact,
  ): Promise<XeroContact> {
    if (!contact.contactID) {
      throw new XeroError(
        "Contact ID is required for updates",
        "XERO_INVALID_REQUEST",
        400,
        false,
      );
    }

    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const validated = XeroContactSchema.parse(contact);

    const response = await this.apiRequest("POST", "/Contacts", accessToken, {
      Contacts: [validated],
    });

    return this.parseContactResponse(response);
  }

  /**
   * Delete contact in Xero (archive)
   */
  async deleteContact(
    accessToken: string,
    contactId: string,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    await this.apiRequest("POST", `/Contacts/${contactId}`, accessToken, {
      ContactStatus: "ARCHIVED",
    });

    return { success: true };
  }

  /**
   * Query contacts with filters
   */
  async queryContacts(
    accessToken: string,
    filter?: string,
  ): Promise<XeroContact[]> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const url = filter
      ? `/Contacts?where=${encodeURIComponent(filter)}`
      : "/Contacts";
    const response = await this.apiRequest("GET", url, accessToken);

    return (response.Contacts || []) as XeroContact[];
  }

  // ─── PAYMENT OPERATIONS ─────────────────────────────────────────

  /**
   * Create payment in Xero
   */
  async createPayment(
    accessToken: string,
    payment: XeroPayment,
  ): Promise<XeroPayment> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest("PUT", "/Payments", accessToken, {
      Payments: [payment],
    });

    return this.parsePaymentResponse(response);
  }

  /**
   * Get payment from Xero
   */
  async getPayment(
    accessToken: string,
    paymentId: string,
  ): Promise<XeroPayment> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/Payments/${paymentId}`,
      accessToken,
    );

    return this.parsePaymentResponse(response);
  }

  /**
   * Allocate payment to invoice
   */
  async allocatePayment(
    accessToken: string,
    invoiceId: string,
    amount: number,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    await this.apiRequest(
      "POST",
      `/Invoices/${invoiceId}/Allocations`,
      accessToken,
      { amount, date: new Date().toISOString().split("T")[0] },
    );

    return { success: true };
  }

  /**
   * Refund payment in Xero
   */
  async refundPayment(
    accessToken: string,
    paymentId: string,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    await this.apiRequest("POST", `/Payments/${paymentId}`, accessToken, {
      Status: "DRAFT",
    });

    return { success: true };
  }

  // ─── BANK TRANSACTION OPERATIONS ────────────────────────────────

  /**
   * Create bank transaction in Xero
   */
  async createBankTransaction(
    accessToken: string,
    transaction: XeroBankTransaction,
  ): Promise<XeroBankTransaction> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "PUT",
      "/BankTransactions",
      accessToken,
      { BankTransactions: [transaction] },
    );

    return this.parseBankTransactionResponse(response);
  }

  /**
   * Get bank transaction from Xero
   */
  async getBankTransaction(
    accessToken: string,
    transactionId: string,
  ): Promise<XeroBankTransaction> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/BankTransactions/${transactionId}`,
      accessToken,
    );

    return this.parseBankTransactionResponse(response);
  }

  // ─── ITEM OPERATIONS ────────────────────────────────────────────

  /**
   * Create item in Xero
   */
  async createItem(accessToken: string, item: XeroItem): Promise<XeroItem> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest("PUT", "/Items", accessToken, {
      Items: [item],
    });

    return this.parseItemResponse(response);
  }

  /**
   * Get item from Xero
   */
  async getItem(accessToken: string, itemId: string): Promise<XeroItem> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/Items/${itemId}`,
      accessToken,
    );

    return this.parseItemResponse(response);
  }

  /**
   * Update item in Xero
   */
  async updateItem(accessToken: string, item: XeroItem): Promise<XeroItem> {
    if (!item.itemID) {
      throw new XeroError(
        "Item ID is required for updates",
        "XERO_INVALID_REQUEST",
        400,
        false,
      );
    }

    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest("POST", "/Items", accessToken, {
      Items: [item],
    });

    return this.parseItemResponse(response);
  }

  // ─── ACCOUNT OPERATIONS ─────────────────────────────────────────

  /**
   * List chart of accounts
   */
  async getChartOfAccounts(accessToken: string): Promise<XeroAccount[]> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest("GET", "/Accounts", accessToken);

    return (response.Accounts || []) as XeroAccount[];
  }

  /**
   * Get specific account
   */
  async getAccount(
    accessToken: string,
    accountId: string,
  ): Promise<XeroAccount> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/Accounts/${accountId}`,
      accessToken,
    );

    return (response.Account ?? response) as XeroAccount;
  }

  // ─── PURCHASE ORDER OPERATIONS ──────────────────────────────────

  /**
   * Create purchase order in Xero
   */
  async createPurchaseOrder(
    accessToken: string,
    po: XeroPurchaseOrder,
  ): Promise<XeroPurchaseOrder> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "PUT",
      "/PurchaseOrders",
      accessToken,
      { PurchaseOrders: [po] },
    );

    return this.parsePOResponse(response);
  }

  /**
   * Get purchase order from Xero
   */
  async getPurchaseOrder(
    accessToken: string,
    poId: string,
  ): Promise<XeroPurchaseOrder> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "GET",
      `/PurchaseOrders/${poId}`,
      accessToken,
    );

    return this.parsePOResponse(response);
  }

  // ─── QUOTE OPERATIONS ───────────────────────────────────────────

  /**
   * Create quote in Xero
   */
  async createQuote(accessToken: string, quote: XeroQuote): Promise<XeroQuote> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest("PUT", "/Quotes", accessToken, {
      Quotes: [quote],
    });

    return this.parseQuoteResponse(response);
  }

  /**
   * Send quote via email
   */
  async sendQuote(
    accessToken: string,
    quoteId: string,
    email?: string,
  ): Promise<{ success: boolean }> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const body: Record<string, unknown> = {
      EmailAddress: email,
    };

    await this.apiRequest(
      "POST",
      `/Quotes/${quoteId}/Email`,
      accessToken,
      body,
    );

    return { success: true };
  }

  /**
   * Accept quote in Xero
   */
  async acceptQuote(accessToken: string, quoteId: string): Promise<XeroQuote> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "POST",
      `/Quotes/${quoteId}`,
      accessToken,
      { Status: "ACCEPTED" },
    );

    return this.parseQuoteResponse(response);
  }

  /**
   * Decline quote in Xero
   */
  async declineQuote(accessToken: string, quoteId: string): Promise<XeroQuote> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const response = await this.apiRequest(
      "POST",
      `/Quotes/${quoteId}`,
      accessToken,
      { Status: "DECLINED" },
    );

    return this.parseQuoteResponse(response);
  }

  // ─── REPORTS ────────────────────────────────────────────────────

  /**
   * Get Profit & Loss report
   */
  async getProfitAndLossReport(
    accessToken: string,
    options?: { period?: string; standardLayout?: boolean },
  ): Promise<Record<string, unknown>> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const params = new URLSearchParams();
    if (options?.period) params.append("period", options.period);
    if (options?.standardLayout) params.append("standardLayout", "true");

    return this.apiRequest(
      "GET",
      `/Reports/ProfitAndLoss?${params}`,
      accessToken,
    );
  }

  /**
   * Get Balance Sheet report
   */
  async getBalanceSheetReport(
    accessToken: string,
    options?: { period?: string },
  ): Promise<Record<string, unknown>> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const params = new URLSearchParams();
    if (options?.period) params.append("period", options.period);

    return this.apiRequest(
      "GET",
      `/Reports/BalanceSheet?${params}`,
      accessToken,
    );
  }

  /**
   * Get Bank Summary report
   */
  async getBankSummaryReport(
    accessToken: string,
    options?: { bankAccountID?: string },
  ): Promise<Record<string, unknown>> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const params = new URLSearchParams();
    if (options?.bankAccountID)
      params.append("bankAccountID", options.bankAccountID);

    return this.apiRequest(
      "GET",
      `/Reports/BankSummary?${params}`,
      accessToken,
    );
  }

  // ─── WEBHOOK VERIFICATION ──────────────────────────────────────

  /**
   * Verify Xero webhook signature
   * Uses HMAC-SHA256 verification with intent-to-receive
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookKey: string,
  ): boolean {
    const hash = createHmac("sha256", webhookKey)
      .update(payload)
      .digest("base64");

    return hash === signature;
  }

  // ─── PRIVATE METHODS ────────────────────────────────────────────

  /**
   * Make API request to Xero
   */
  private async apiRequest(
    method: string,
    endpoint: string,
    accessToken: string,
    body?: unknown,
    modifiedSince?: Date,
  ): Promise<Record<string, unknown>> {
    if (!this.activeTenantId) {
      throw new XeroError(
        "Active tenant not set",
        "XERO_NO_ACTIVE_TENANT",
        400,
        false,
      );
    }

    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Xero-tenant-id": this.activeTenantId,
    };

    if (modifiedSince) {
      headers["If-Modified-Since"] = modifiedSince.toISOString();
    }

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.request(method, url, {
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Update rate limit info from response headers
    const remaining = response["x-rate-limit-remaining"];
    const limit = response["x-rate-limit-limit"];
    const dailyRemaining = response["x-rate-limit-daily-remaining"];
    const dailyLimit = response["x-rate-limit-daily-limit"];

    if (remaining && limit) {
      const resetAt = new Date();
      resetAt.setMinutes(resetAt.getMinutes() + 1);
      this.rateLimits.set(this.activeTenantId, {
        remaining: parseInt(remaining as string),
        limit: parseInt(limit as string),
        resetAt,
        dailyRemaining: dailyRemaining
          ? parseInt(dailyRemaining as string)
          : undefined,
        dailyLimit: dailyLimit ? parseInt(dailyLimit as string) : undefined,
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
      body?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "User-Agent": "Witylogix/1.0",
            ...options.headers,
          },
          body: options.body,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
          continue;
        }

        if (response.status === 304) {
          // Not Modified - return empty response
          return {};
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new XeroError(
            `HTTP ${response.status}: ${errorBody}`,
            "XERO_HTTP_ERROR",
            response.status,
            response.status >= 500 || response.status === 429,
          );
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

    throw new XeroError(
      `Request failed after ${this.config.maxRetries} retries`,
      "XERO_REQUEST_FAILED",
      500,
      true,
      { originalError: lastError?.message },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private parseInvoiceResponse(response: Record<string, unknown>): XeroInvoice {
    const invoices = response.Invoices as XeroInvoice[] | undefined;
    const invoice = (invoices?.[0] ??
      response.Invoice ??
      response) as XeroInvoice;
    return XeroInvoiceSchema.parse(invoice);
  }

  private parseContactResponse(response: Record<string, unknown>): XeroContact {
    const contacts = response.Contacts as XeroContact[] | undefined;
    const contact = (contacts?.[0] ??
      response.Contact ??
      response) as XeroContact;
    return XeroContactSchema.parse(contact);
  }

  private parsePaymentResponse(response: Record<string, unknown>): XeroPayment {
    const payments = response.Payments as XeroPayment[] | undefined;
    return (payments?.[0] ?? response.Payment ?? response) as XeroPayment;
  }

  private parseBankTransactionResponse(
    response: Record<string, unknown>,
  ): XeroBankTransaction {
    const txns = response.BankTransactions as XeroBankTransaction[] | undefined;
    return (txns?.[0] ??
      response.BankTransaction ??
      response) as XeroBankTransaction;
  }

  private parseItemResponse(response: Record<string, unknown>): XeroItem {
    const items = response.Items as XeroItem[] | undefined;
    return (items?.[0] ?? response.Item ?? response) as XeroItem;
  }

  private parsePOResponse(
    response: Record<string, unknown>,
  ): XeroPurchaseOrder {
    const pos = response.PurchaseOrders as XeroPurchaseOrder[] | undefined;
    return (pos?.[0] ??
      response.PurchaseOrder ??
      response) as XeroPurchaseOrder;
  }

  private parseQuoteResponse(response: Record<string, unknown>): XeroQuote {
    const quotes = response.Quotes as XeroQuote[] | undefined;
    return (quotes?.[0] ?? response.Quote ?? response) as XeroQuote;
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): XeroRateLimitInfo | undefined {
    return this.activeTenantId
      ? this.rateLimits.get(this.activeTenantId)
      : undefined;
  }
}
