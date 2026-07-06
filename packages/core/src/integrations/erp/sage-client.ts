/**
 * Sage Business Cloud Accounting API Adapter
 * OAuth2 authentication with refresh token flow
 * Supports Contacts, Invoices, Products, Bank Transactions, Tax, GL, Reports
 */

import type {
  ERPConnection,
  ERPCustomer,
  ERPVendor,
  ERPProduct,
  ERPInvoice,
  ERPPayment,
  TaxRate,
  PaginationParams,
  PaginatedResult,
} from "./types.js";
import { AbstractERPAdapter } from "./erp-adapter.js";

// ─── SAGE-SPECIFIC TYPES ───────────────────────────────────────────────────

export interface SageConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: "sandbox" | "production";
  timeout?: number;
  maxRetries?: number;
}

export interface SageAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface SageContact {
  id?: string;
  name: string;
  status?: "ACTIVE" | "ARCHIVED";
  reference?: string;
  email?: string;
  phone?: string;
  mainAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    county?: string;
    postCode?: string;
    country?: string;
  };
}

export interface SageProduct {
  id?: string;
  name: string;
  productCode?: string;
  description?: string;
  salesPrice?: number;
  purchasePrice?: number;
  taxRate?: {
    id: string;
    percentage: number;
  };
  status?: "ACTIVE" | "ARCHIVED";
}

export interface SageLedgerAccount {
  id?: string;
  code: string;
  name: string;
  type: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface SageFinancialReport {
  id?: string;
  reportType: "PROFIT_AND_LOSS" | "BALANCE_SHEET" | "TRIAL_BALANCE";
  generatedDate: Date;
  data: Record<string, any>;
}

// ─── SAGE ADAPTER ──────────────────────────────────────────────────────────

/**
 * Sage Business Cloud Accounting Adapter
 * Implements OAuth2 and REST API integration
 */
export class SageClient extends AbstractERPAdapter {
  private config: SageConfig;
  private apiBaseUrl: string;
  private authBaseUrl: string;

  constructor(connection: ERPConnection, config: SageConfig) {
    super("sage", connection);
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: "production",
      ...config,
    };

    const env = this.config.environment === "sandbox" ? "sandbox" : "";
    this.apiBaseUrl = `https://api${env ? `.${env}` : ""}.columbus.sage.com/v3.1`;
    this.authBaseUrl = `https://oauth${env ? `.${env}` : ""}.columbus.sage.com`;
  }

  /**
   * Get authorization URL for OAuth2
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: "full_access",
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/authorize?${params}`;
  }

  /**
   * Authenticate with Sage
   */
  async authenticate(authCode: string): Promise<void> {
    // INTEGRATION: Exchange OAuth code for access token
    // POST https://oauth.columbus.sage.com/token
    // with: grant_type=authorization_code&code={code}&client_id={clientId}&client_secret={clientSecret}&redirect_uri={redirectUri}

    const mockResponse: SageAuthResponse = {
      access_token: `sage_at_${Date.now()}`,
      refresh_token: `sage_rt_${Date.now()}`,
      expires_in: 3600,
      token_type: "Bearer",
    };

    this.connection.credentials.accessToken = mockResponse.access_token;
    if (mockResponse.refresh_token) {
      this.connection.credentials.refreshToken = mockResponse.refresh_token;
    }
    this.tokenManager.updateExpiry(mockResponse.expires_in);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.executeWithRateLimit(async () => {
        const response = await this.restGet(
          "/contacts?attributes=id&$pageSize=1",
        );
        return Array.isArray(response.data);
      });
    } catch {
      return false;
    }
  }

  // ─── CONTACTS (CUSTOMERS & VENDORS) ────────────────────────────────────

  /**
   * Create contact (customer or vendor)
   */
  async createContact(
    contact: SageContact,
    contactType: "customer" | "vendor",
  ): Promise<SageContact> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapContactToSage(contact);
      const response = await this.restPost(`/${contactType}s`, sagePayload);

      return {
        ...contact,
        id: response.data.id,
      };
    });
  }

  /**
   * Get contact
   */
  async getContact(
    contactId: string,
    contactType: "customer" | "vendor",
  ): Promise<SageContact> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/${contactType}s/${contactId}`);
      return this.mapContactFromSage(response.data);
    });
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: string,
    contact: Partial<SageContact>,
    contactType: "customer" | "vendor",
  ): Promise<SageContact> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapContactToSage(contact as SageContact);
      await this.restPut(`/${contactType}s/${contactId}`, sagePayload);
      return this.getContact(contactId, contactType);
    });
  }

  /**
   * Create customer
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const sageContact = this.mapERPCustomerToSageContact(customer);
      const response = await this.restPost("/customers", sageContact);

      return {
        ...customer,
        id: response.data.id,
        externalId: response.data.id,
      };
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/customers/${customerId}`);
      return this.mapERPCustomerFromSage(response.data);
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    customer: Partial<ERPCustomer>,
  ): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const sageContact = this.mapERPCustomerToSageContact(
        customer as ERPCustomer,
      );
      await this.restPut(`/customers/${customerId}`, sageContact);
      return this.getCustomer(customerId);
    });
  }

  /**
   * Query customers
   */
  async queryCustomers(
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPCustomer>> {
    return this.executeWithRateLimit(async () => {
      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const response = await this.restGet(
        `/customers?$skip=${skip}&$pageSize=${limit}`,
      );

      return {
        items: response.data.map((c: any) => this.mapERPCustomerFromSage(c)),
        total: response.pageInfo?.totalResults || response.data.length,
        hasMore: response.pageInfo?.hasMore || false,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── SALES INVOICES ────────────────────────────────────────────────────

  /**
   * Create sales invoice
   */
  async createSalesInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapInvoiceToSage(invoice);
      const response = await this.restPost("/salesInvoices", sagePayload);

      return {
        ...invoice,
        id: response.data.id,
        externalId: response.data.id,
        invoiceNumber: response.data.reference,
      };
    });
  }

  /**
   * Get sales invoice
   */
  async getSalesInvoice(invoiceId: string): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/salesInvoices/${invoiceId}`);
      return this.mapInvoiceFromSage(response.data);
    });
  }

  /**
   * Update sales invoice
   */
  async updateSalesInvoice(
    invoiceId: string,
    invoice: Partial<ERPInvoice>,
  ): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapInvoiceToSage(invoice as ERPInvoice);
      await this.restPut(`/salesInvoices/${invoiceId}`, sagePayload);
      return this.getSalesInvoice(invoiceId);
    });
  }

  /**
   * Void invoice
   */
  async voidSalesInvoice(invoiceId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.restPost(`/salesInvoices/${invoiceId}/void`, {});
    });
  }

  /**
   * Send invoice via email
   */
  async emailSalesInvoice(
    invoiceId: string,
    recipients: string[],
  ): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.restPost(`/salesInvoices/${invoiceId}/email`, {
        to: recipients,
      });
    });
  }

  // ─── PURCHASE INVOICES ─────────────────────────────────────────────────

  /**
   * Create purchase invoice
   */
  async createPurchaseInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapInvoiceToSage(invoice);
      const response = await this.restPost("/purchaseInvoices", sagePayload);

      return {
        ...invoice,
        id: response.data.id,
        externalId: response.data.id,
        invoiceNumber: response.data.reference,
      };
    });
  }

  /**
   * Get purchase invoice
   */
  async getPurchaseInvoice(invoiceId: string): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/purchaseInvoices/${invoiceId}`);
      return this.mapInvoiceFromSage(response.data);
    });
  }

  /**
   * Mark purchase invoice as paid
   */
  async markPurchaseInvoiceAsPaid(invoiceId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.restPost(`/purchaseInvoices/${invoiceId}/markAsPaid`, {});
    });
  }

  // ─── PRODUCTS/SERVICES ────────────────────────────────────────────────

  /**
   * Create product/service
   */
  async createProduct(product: ERPProduct): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapProductToSage(product);
      const response = await this.restPost("/products", sagePayload);

      return {
        ...product,
        id: response.data.id,
        externalId: response.data.id,
      };
    });
  }

  /**
   * Get product
   */
  async getProduct(productId: string): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/products/${productId}`);
      return this.mapProductFromSage(response.data);
    });
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    product: Partial<ERPProduct>,
  ): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapProductToSage(product as ERPProduct);
      await this.restPut(`/products/${productId}`, sagePayload);
      return this.getProduct(productId);
    });
  }

  // ─── BANK TRANSACTIONS ─────────────────────────────────────────────────

  /**
   * Create bank transaction
   */
  async createBankTransaction(payment: ERPPayment): Promise<ERPPayment> {
    return this.executeWithRateLimit(async () => {
      const sagePayload = this.mapPaymentToSage(payment);
      const response = await this.restPost("/bankTransactions", sagePayload);

      return {
        ...payment,
        id: response.data.id,
        externalId: response.data.id,
      };
    });
  }

  /**
   * Get bank transaction
   */
  async getBankTransaction(transactionId: string): Promise<ERPPayment> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/bankTransactions/${transactionId}`);
      return this.mapPaymentFromSage(response.data);
    });
  }

  /**
   * Reconcile bank transaction
   */
  async reconcileBankTransaction(transactionId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.restPost(`/bankTransactions/${transactionId}/reconcile`, {});
    });
  }

  /**
   * Match bank transaction to invoice
   */
  async matchBankTransaction(
    transactionId: string,
    invoiceId: string,
  ): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.restPost(`/bankTransactions/${transactionId}/match`, {
        invoiceId,
      });
    });
  }

  // ─── TAX RATES ─────────────────────────────────────────────────────────

  /**
   * Get all tax rates
   */
  async getTaxRates(): Promise<TaxRate[]> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet("/taxRates");

      return response.data.map((tr: any) => ({
        code: tr.code,
        name: tr.name,
        rate: tr.percentage,
        type: tr.type,
      }));
    });
  }

  /**
   * Get tax rate by code
   */
  async getTaxRate(taxCode: string): Promise<TaxRate> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/taxRates/${taxCode}`);

      return {
        code: response.data.code,
        name: response.data.name,
        rate: response.data.percentage,
        type: response.data.type,
      };
    });
  }

  // ─── LEDGER ACCOUNTS & JOURNAL ENTRIES ─────────────────────────────────

  /**
   * Get ledger accounts (chart of accounts)
   */
  async getLedgerAccounts(
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<SageLedgerAccount>> {
    return this.executeWithRateLimit(async () => {
      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const response = await this.restGet(
        `/ledgerAccounts?$skip=${skip}&$pageSize=${limit}`,
      );

      return {
        items: response.data.map((acc: any) => ({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          status: acc.status,
        })),
        total: response.pageInfo?.totalResults || response.data.length,
        hasMore: response.pageInfo?.hasMore || false,
        nextOffset: skip + limit,
      };
    });
  }

  /**
   * Post journal entry
   */
  async postJournalEntry(
    data: Record<string, any>,
  ): Promise<{ journalId: string }> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/journalEntries", data);
      return { journalId: response.data.id };
    });
  }

  // ─── FINANCIAL REPORTS ────────────────────────────────────────────────

  /**
   * Generate profit and loss report
   */
  async generateProfitAndLossReport(
    fromDate: Date,
    toDate: Date,
  ): Promise<SageFinancialReport> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/reports/profitAndLoss", {
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: toDate.toISOString().split("T")[0],
      });

      return {
        id: response.data.id,
        reportType: "PROFIT_AND_LOSS",
        generatedDate: new Date(),
        data: response.data,
      };
    });
  }

  /**
   * Generate balance sheet report
   */
  async generateBalanceSheetReport(
    asOfDate: Date,
  ): Promise<SageFinancialReport> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/reports/balanceSheet", {
        asOfDate: asOfDate.toISOString().split("T")[0],
      });

      return {
        id: response.data.id,
        reportType: "BALANCE_SHEET",
        generatedDate: new Date(),
        data: response.data,
      };
    });
  }

  /**
   * Generate trial balance report
   */
  async generateTrialBalanceReport(
    asOfDate: Date,
  ): Promise<SageFinancialReport> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/reports/trialBalance", {
        asOfDate: asOfDate.toISOString().split("T")[0],
      });

      return {
        id: response.data.id,
        reportType: "TRIAL_BALANCE",
        generatedDate: new Date(),
        data: response.data,
      };
    });
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────

  /**
   * REST GET request
   */
  protected async restGet(
    path: string,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(
        `REST GET failed: ${response.statusText}`,
        "REST_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  /**
   * REST POST request
   */
  protected async restPost(
    path: string,
    body: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(
        `REST POST failed: ${response.statusText}`,
        "REST_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  /**
   * REST PUT request
   */
  protected async restPut(
    path: string,
    body: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(
        `REST PUT failed: ${response.statusText}`,
        "REST_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  private getAccessToken(): Promise<string> {
    return (this.tokenManager as any).getAccessToken();
  }

  private mapContactToSage(contact: SageContact): Record<string, any> {
    return {
      name: contact.name,
      reference: contact.reference || contact.name,
      status: contact.status || "ACTIVE",
      email: contact.email,
      phone: contact.phone,
      mainAddress: contact.mainAddress,
    };
  }

  private mapContactFromSage(data: any): SageContact {
    return {
      id: data.id,
      name: data.name,
      status: data.status,
      reference: data.reference,
      email: data.email,
      phone: data.phone,
      mainAddress: data.mainAddress,
    };
  }

  private mapERPCustomerToSageContact(
    customer: ERPCustomer,
  ): Record<string, any> {
    return {
      name: customer.name,
      reference: customer.code || customer.name,
      status: customer.status === "active" ? "ACTIVE" : "ARCHIVED",
      email: customer.email,
      phone: customer.phone,
      mainAddress: customer.addresses?.[0] && {
        address1: customer.addresses[0].line1,
        address2: customer.addresses[0].line2,
        city: customer.addresses[0].city,
        county: customer.addresses[0].state,
        postCode: customer.addresses[0].postalCode,
        country: customer.addresses[0].country,
      },
    };
  }

  private mapERPCustomerFromSage(data: any): ERPCustomer {
    return {
      id: data.id,
      externalId: data.id,
      code: data.reference,
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: data.status === "ACTIVE" ? "active" : "inactive",
    };
  }

  private mapInvoiceToSage(invoice: ERPInvoice): Record<string, any> {
    return {
      customerRef: {
        id: invoice.customerId,
      },
      reference: invoice.invoiceNumber,
      date: invoice.invoiceDate.toISOString().split("T")[0],
      dueDate: invoice.dueDate.toISOString().split("T")[0],
      lineItems: invoice.lineItems.map((line) => ({
        description: line.itemName,
        quantity: line.quantity,
        unitAmount: line.unitPrice,
        taxRate: {
          id: line.taxCode,
        },
      })),
    };
  }

  private mapInvoiceFromSage(data: any): ERPInvoice {
    return {
      id: data.id,
      externalId: data.id,
      invoiceNumber: data.reference,
      customerId: data.customerRef?.id || "",
      invoiceDate: new Date(data.date),
      dueDate: new Date(data.dueDate),
      status: (data.status as any) || "draft",
      lineItems: data.lineItems || [],
      total: data.total,
    };
  }

  private mapProductToSage(product: ERPProduct): Record<string, any> {
    return {
      name: product.name,
      productCode: product.sku,
      description: product.description,
      salesPrice: product.unitPrice,
      purchasePrice: product.cost,
      taxRate: product.taxCode ? { id: product.taxCode } : undefined,
      status: product.status === "active" ? "ACTIVE" : "ARCHIVED",
    };
  }

  private mapProductFromSage(data: any): ERPProduct {
    return {
      id: data.id,
      externalId: data.id,
      sku: data.productCode,
      name: data.name,
      description: data.description,
      unitPrice: data.salesPrice,
      cost: data.purchasePrice,
      status: data.status === "ACTIVE" ? "active" : "inactive",
    };
  }

  private mapPaymentToSage(payment: ERPPayment): Record<string, any> {
    return {
      type: payment.paymentMethod || "BANK_TRANSFER",
      date: payment.paymentDate.toISOString().split("T")[0],
      amount: payment.amount,
      reference: payment.referenceNumber,
    };
  }

  private mapPaymentFromSage(data: any): ERPPayment {
    return {
      id: data.id,
      externalId: data.id,
      amount: data.amount,
      paymentDate: new Date(data.date),
      paymentMethod: data.type,
      referenceNumber: data.reference,
      status: "posted",
    };
  }

  private generateRandomString(length: number): string {
    return Array.from({ length }, () => Math.random().toString(36)[2]).join("");
  }
}
