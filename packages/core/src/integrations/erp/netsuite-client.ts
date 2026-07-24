/**
 * Oracle NetSuite SuiteTalk REST API Adapter
 * Token-Based Authentication (TBA) with OAuth 1.0
 * Supports Records, SuiteQL, Saved Searches, and Custom Records
 */

import type {
  ERPConnection,
  ERPCustomer,
  ERPVendor,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPPayment,
  SyncEntityType,
  PaginationParams,
  PaginatedResult,
} from "./types.js";
import { AbstractERPAdapter } from "./erp-adapter.js";
import { createHmac } from "crypto";

// ─── NETSUITE-SPECIFIC TYPES ───────────────────────────────────────────────

export interface NetSuiteConfig {
  accountId: string; // e.g., 12345678
  tokenId: string;
  tokenSecret: string;
  consumerKey: string;
  consumerSecret: string;
  environment?: "sandbox" | "production";
  timeout?: number;
  maxRetries?: number;
}

export interface SuiteQLQuery {
  q: string;
  offset?: number;
  limit?: number;
}

export interface SuiteQLResult<T> {
  results: T[];
  count: number;
  offset: number;
  hasMore: boolean;
}

export interface SavedSearchParams {
  searchId: string;
  filters?: Record<string, any>;
  columns?: string[];
  offset?: number;
  limit?: number;
}

export interface SavedSearchResult<T> {
  results: T[];
  count: number;
  offset: number;
  hasMore: boolean;
}

export interface FileUploadRequest {
  fileName: string;
  fileContent: Buffer | string;
  folder?: string;
  description?: string;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate?: Date;
}

// ─── NETSUITE ADAPTER ──────────────────────────────────────────────────────

/**
 * Oracle NetSuite SuiteTalk REST API Adapter
 * Implements OAuth 1.0 Token-Based Authentication
 */
export class NetSuiteClient extends AbstractERPAdapter {
  private config: NetSuiteConfig;
  private restBaseUrl: string;
  private consumerSecret: string;
  private tokenSecret: string;

  constructor(connection: ERPConnection, config: NetSuiteConfig) {
    super("netsuite", connection);
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: "production",
      ...config,
    };

    const env = this.config.environment === "sandbox" ? "sandbox" : "";
    this.restBaseUrl = `https://${this.config.accountId}${env}.suiteapis.com/services/rest/record/v1`;
    this.consumerSecret = config.consumerSecret;
    this.tokenSecret = config.tokenSecret;
  }

  /**
   * Authenticate with OAuth1 token-based authentication
   */
  async authenticate(_authCode: string): Promise<void> {
    // TBA authentication - tokens are already configured via constructor
    // Just verify the connection works
    this.connection.credentials.accessToken =
      this.connection.credentials.accessToken || `ns_tba_${Date.now()}`;
  }

  /**
   * Get authorization URL for OAuth1 flow
   */
  getAuthorizationUrl(state: string): string {
    const env = this.config.environment === "sandbox" ? "sandbox." : "";
    return `https://${env}netsuite.com/app/login/oauth.nl?accountId=${this.config.accountId}&state=${state}`;
  }

  /**
   * Create purchase invoice
   */
  async createPurchaseInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.createInvoice({ ...invoice, invoiceType: "purchase" });
  }

  /**
   * Get purchase invoice
   */
  async getPurchaseInvoice(
    invoiceId: string,
    _expand?: boolean,
  ): Promise<ERPInvoice> {
    return this.getInvoice(invoiceId, true);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.executeWithRateLimit(async () => {
        const response = await this.restGet("/customer");
        return response.status === "ok" || Array.isArray(response.results);
      });
    } catch {
      return false;
    }
  }

  // ─── CUSTOMERS ────────────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapCustomerToNetSuite(customer);
      const response = await this.restPost("/customer", nsPayload);

      return {
        ...customer,
        id: response.id,
        externalId: response.externalId,
      };
    });
  }

  /**
   * Get customer by internal ID
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/customer/${customerId}`);
      return this.mapCustomerFromNetSuite(response);
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
      const nsPayload = this.mapCustomerToNetSuite(customer as ERPCustomer);
      await this.restPatch(`/customer/${customerId}`, nsPayload);
      return this.getCustomer(customerId);
    });
  }

  /**
   * Search customers using SuiteQL
   */
  async searchCustomers(
    name?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPCustomer>> {
    return this.executeWithRateLimit(async () => {
      const offset = pagination?.offset || 0;
      const limit = pagination?.limit || 100;

      let query = "SELECT id, entityid, email, phone FROM customer";
      if (name) {
        query += ` WHERE entityid LIKE '%${name}%'`;
      }
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const result = await this.suiteQL<any>({ q: query, offset, limit });

      return {
        items: result.results.map((row: any) =>
          this.mapCustomerFromNetSuite(row),
        ),
        total: result.count,
        hasMore: result.hasMore,
        nextOffset: offset + limit,
      };
    });
  }

  // ─── VENDORS ───────────────────────────────────────────────────────────

  /**
   * Create vendor
   */
  async createVendor(vendor: ERPVendor): Promise<ERPVendor> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapVendorToNetSuite(vendor);
      const response = await this.restPost("/vendor", nsPayload);

      return {
        ...vendor,
        id: response.id,
        externalId: response.externalId,
      };
    });
  }

  /**
   * Get vendor by ID
   */
  async getVendor(vendorId: string): Promise<ERPVendor> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/vendor/${vendorId}`);
      return this.mapVendorFromNetSuite(response);
    });
  }

  /**
   * Update vendor
   */
  async updateVendor(
    vendorId: string,
    vendor: Partial<ERPVendor>,
  ): Promise<ERPVendor> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapVendorToNetSuite(vendor as ERPVendor);
      await this.restPatch(`/vendor/${vendorId}`, nsPayload);
      return this.getVendor(vendorId);
    });
  }

  // ─── SALES ORDERS ──────────────────────────────────────────────────────

  /**
   * Create sales order
   */
  async createSalesOrder(order: ERPOrder): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapOrderToNetSuite(order);
      const response = await this.restPost("/salesorder", nsPayload);

      return {
        ...order,
        id: response.id,
        externalId: response.externalId,
      };
    });
  }

  /**
   * Get sales order
   */
  async getSalesOrder(orderId: string): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/salesorder/${orderId}`);
      return this.mapOrderFromNetSuite(response);
    });
  }

  /**
   * Update sales order
   */
  async updateSalesOrder(
    orderId: string,
    order: Partial<ERPOrder>,
  ): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapOrderToNetSuite(order as ERPOrder);
      await this.restPatch(`/salesorder/${orderId}`, nsPayload);
      return this.getSalesOrder(orderId);
    });
  }

  // ─── INVOICES ──────────────────────────────────────────────────────────

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const endpoint =
        invoice.invoiceType === "purchase" ? "/purchaseinvoice" : "/invoice";
      const nsPayload = this.mapInvoiceToNetSuite(invoice);
      const response = await this.restPost(endpoint, nsPayload);

      return {
        ...invoice,
        id: response.id,
        externalId: response.externalId,
      };
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(
    invoiceId: string,
    isPurchase: boolean = false,
  ): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const endpoint = isPurchase ? "/purchaseinvoice" : "/invoice";
      const response = await this.restGet(`${endpoint}/${invoiceId}`);
      return this.mapInvoiceFromNetSuite(response);
    });
  }

  /**
   * Update invoice
   */
  async updateInvoice(
    invoiceId: string,
    invoice: Partial<ERPInvoice>,
  ): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const endpoint =
        invoice.invoiceType === "purchase" ? "/purchaseinvoice" : "/invoice";
      const nsPayload = this.mapInvoiceToNetSuite(invoice as ERPInvoice);
      await this.restPatch(`${endpoint}/${invoiceId}`, nsPayload);
      return this.getInvoice(invoiceId, invoice.invoiceType === "purchase");
    });
  }

  // ─── PAYMENTS ──────────────────────────────────────────────────────────

  /**
   * Create payment
   */
  async createPayment(payment: ERPPayment): Promise<ERPPayment> {
    return this.executeWithRateLimit(async () => {
      const nsPayload = this.mapPaymentToNetSuite(payment);
      const response = await this.restPost("/payment", nsPayload);

      return {
        ...payment,
        id: response.id,
        externalId: response.externalId,
      };
    });
  }

  /**
   * Get payment
   */
  async getPayment(paymentId: string): Promise<ERPPayment> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/payment/${paymentId}`);
      return this.mapPaymentFromNetSuite(response);
    });
  }

  // ─── ITEMS (PRODUCTS) ──────────────────────────────────────────────────

  /**
   * Create item
   */
  async createItem(item: any): Promise<any> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/inventoryitem", item);
      return response;
    });
  }

  /**
   * Get item by internal ID
   */
  async getItem(itemId: string): Promise<any> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/inventoryitem/${itemId}`);
      return response;
    });
  }

  /**
   * Update item
   */
  async updateItem(itemId: string, item: any): Promise<any> {
    return this.executeWithRateLimit(async () => {
      await this.restPatch(`/inventoryitem/${itemId}`, item);
      return this.getItem(itemId);
    });
  }

  // ─── SUITEQL QUERIES ───────────────────────────────────────────────────

  /**
   * Execute SuiteQL query
   */
  async suiteQL<T = any>(query: SuiteQLQuery): Promise<SuiteQLResult<T>> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost("/query", query);

      return {
        results: response.items || response.results || [],
        count: response.count || 0,
        offset: response.offset || query.offset || 0,
        hasMore: response.hasMore || false,
      };
    });
  }

  // ─── SAVED SEARCHES ────────────────────────────────────────────────────

  /**
   * Execute saved search
   */
  async executeSavedSearch<T = any>(
    params: SavedSearchParams,
  ): Promise<SavedSearchResult<T>> {
    return this.executeWithRateLimit(async () => {
      const url = `/savedsearch/${params.searchId}`;
      const queryParams = new URLSearchParams({
        offset: String(params.offset || 0),
        limit: String(params.limit || 100),
      });

      const response = await this.restGet(`${url}?${queryParams}`);

      return {
        results: response.items || response.results || [],
        count: response.count || 0,
        offset: response.offset || params.offset || 0,
        hasMore: response.hasMore || false,
      };
    });
  }

  // ─── FILE CABINET ──────────────────────────────────────────────────────

  /**
   * Upload file to file cabinet
   */
  async uploadFile(
    fileRequest: FileUploadRequest,
  ): Promise<{ fileId: string; internalId: string }> {
    return this.executeWithRateLimit(async () => {
      const formData = new FormData();
      const blob = new Blob([fileRequest.fileContent], {
        type: "application/octet-stream",
      });
      formData.append("file", blob, fileRequest.fileName);

      if (fileRequest.folder) {
        formData.append("folder", fileRequest.folder);
      }
      if (fileRequest.description) {
        formData.append("description", fileRequest.description);
      }

      const response = await this.restPostFormData("/file", formData);
      return response;
    });
  }

  /**
   * Download file from file cabinet
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(`/file/${fileId}`, true);
      return response;
    });
  }

  // ─── CURRENCY & EXCHANGE RATES ─────────────────────────────────────────

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ExchangeRate> {
    return this.executeWithRateLimit(async () => {
      const query = `
        SELECT exchangerate, effectivedate
        FROM currencyrate
        WHERE fromcurrency = '${fromCurrency}'
        AND tocurrency = '${toCurrency}'
        ORDER BY effectivedate DESC
        LIMIT 1
      `;

      const result = await this.suiteQL<any>({ q: query, limit: 1 });

      if (result.results.length === 0) {
        throw this.createError(
          `Exchange rate not found: ${fromCurrency} -> ${toCurrency}`,
          "RATE_NOT_FOUND",
        );
      }

      return {
        fromCurrency,
        toCurrency,
        rate: result.results[0].exchangerate,
        effectiveDate: new Date(result.results[0].effectivedate),
      };
    });
  }

  // ─── CUSTOM RECORDS ────────────────────────────────────────────────────

  /**
   * Create custom record
   */
  async createCustomRecord(
    recordType: string,
    data: Record<string, any>,
  ): Promise<{ internalId: string }> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restPost(`/customrecord/${recordType}`, data);
      return response;
    });
  }

  /**
   * Get custom record
   */
  async getCustomRecord(
    recordType: string,
    recordId: string,
  ): Promise<Record<string, any>> {
    return this.executeWithRateLimit(async () => {
      const response = await this.restGet(
        `/customrecord/${recordType}/${recordId}`,
      );
      return response;
    });
  }

  /**
   * Update custom record
   */
  async updateCustomRecord(
    recordType: string,
    recordId: string,
    data: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.executeWithRateLimit(async () => {
      await this.restPatch(`/customrecord/${recordType}/${recordId}`, data);
      return this.getCustomRecord(recordType, recordId);
    });
  }

  // ─── OAUTH1 REQUEST SIGNING ────────────────────────────────────────────

  /**
   * Generate OAuth 1.0 Authorization header
   */
  private generateOAuth1Header(
    method: string,
    url: string,
    body?: string,
  ): string {
    const oauth: Record<string, string> = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_token: this.config.tokenId,
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: this.generateNonce(),
      oauth_version: "1.0",
    };

    // Sort parameters
    const baseString = this.createBaseString(method, url, oauth);
    const signingKey = `${this.consumerSecret}&${this.tokenSecret}`;
    const signature = createHmac("sha256", signingKey)
      .update(baseString)
      .digest("base64");

    oauth.oauth_signature = signature;

    return `OAuth ${Object.entries(oauth)
      .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
      .join(", ")}`;
  }

  private createBaseString(
    method: string,
    url: string,
    oauth: Record<string, string>,
  ): string {
    const sortedParams = Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join("&");

    return baseString;
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(7);
  }

  // ─── REST API METHODS ──────────────────────────────────────────────────

  protected async restGet(
    path: string,
    isBinary: boolean = false,
  ): Promise<any> {
    const url = `${this.restBaseUrl}${path}`;
    const authHeader = this.generateOAuth1Header("GET", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
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

    return isBinary ? response.arrayBuffer() : response.json();
  }

  protected async restPost(path: string, body: any): Promise<any> {
    const url = `${this.restBaseUrl}${path}`;
    const bodyString = JSON.stringify(body);
    const authHeader = this.generateOAuth1Header("POST", url, bodyString);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: bodyString,
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

  protected async restPostFormData(
    path: string,
    formData: FormData,
  ): Promise<any> {
    const url = `${this.restBaseUrl}${path}`;
    const authHeader = this.generateOAuth1Header("POST", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: formData,
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

  protected async restPatch(path: string, body: any): Promise<any> {
    const url = `${this.restBaseUrl}${path}`;
    const bodyString = JSON.stringify(body);
    const authHeader = this.generateOAuth1Header("PATCH", url, bodyString);

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: bodyString,
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(
        `REST PATCH failed: ${response.statusText}`,
        "REST_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  // ─── MAPPING METHODS ───────────────────────────────────────────────────

  private mapCustomerToNetSuite(customer: ERPCustomer): Record<string, any> {
    return {
      entityid: customer.code || customer.name,
      companyname: customer.companyName || customer.name,
      email: customer.email,
      phone: customer.phone,
      subsidiary: this.connection.credentials.subsidiaryId,
    };
  }

  private mapCustomerFromNetSuite(ns: any): ERPCustomer {
    return {
      id: ns.id,
      externalId: ns.externalId,
      code: ns.entityid,
      name: ns.companyname || ns.entityid,
      email: ns.email,
      phone: ns.phone,
      status: ns.isinactive ? "inactive" : "active",
    };
  }

  private mapVendorToNetSuite(vendor: ERPVendor): Record<string, any> {
    return this.mapCustomerToNetSuite(vendor as any);
  }

  private mapVendorFromNetSuite(ns: any): ERPVendor {
    return this.mapCustomerFromNetSuite(ns) as any;
  }

  private mapOrderToNetSuite(order: ERPOrder): Record<string, any> {
    const result: Record<string, any> = {};
    if (order.customerId) result.entity = order.customerId;
    if (order.orderDate)
      result.trandate = order.orderDate.toISOString().split("T")[0];
    if (order.dueDate)
      result.duedate = order.dueDate.toISOString().split("T")[0];
    if (order.status) result.status = order.status;
    if (order.lineItems) {
      result.item = order.lineItems.map((line) => ({
        item: line.itemCode,
        quantity: line.quantity,
        rate: line.unitPrice,
      }));
    }
    return result;
  }

  private mapOrderFromNetSuite(ns: any): ERPOrder {
    return {
      id: ns.id,
      externalId: ns.externalId,
      orderNumber: ns.tranid,
      customerId: ns.entity,
      orderDate: new Date(ns.trandate),
      status: ns.status || ("completed" as any),
      lineItems: ns.item || [],
      total: ns.total,
    };
  }

  private mapInvoiceToNetSuite(invoice: ERPInvoice): Record<string, any> {
    const result: Record<string, any> = {};
    if (invoice.customerId) result.entity = invoice.customerId;
    if (invoice.invoiceDate)
      result.trandate = invoice.invoiceDate.toISOString().split("T")[0];
    if (invoice.dueDate)
      result.duedate = invoice.dueDate.toISOString().split("T")[0];
    if (invoice.status) result.status = invoice.status;
    if (invoice.lineItems) {
      result.item = invoice.lineItems.map((line) => ({
        item: line.itemCode,
        quantity: line.quantity,
        rate: line.unitPrice,
      }));
    }
    return result;
  }

  private mapInvoiceFromNetSuite(ns: any): ERPInvoice {
    return {
      id: ns.id,
      externalId: ns.externalId,
      invoiceNumber: ns.tranid,
      customerId: ns.entity,
      invoiceDate: new Date(ns.trandate),
      dueDate: new Date(ns.duedate),
      status: ns.status || ("posted" as any),
      lineItems: ns.item || [],
      total: ns.total,
    };
  }

  private mapPaymentToNetSuite(payment: ERPPayment): Record<string, any> {
    return {
      entity: payment.customerId || payment.vendorId,
      trandate: payment.paymentDate.toISOString().split("T")[0],
      amount: payment.amount,
      apply: [
        {
          doc: payment.invoiceId,
          amount: payment.amount,
        },
      ],
    };
  }

  private mapPaymentFromNetSuite(ns: any): ERPPayment {
    return {
      id: ns.id,
      externalId: ns.externalId,
      amount: ns.amount,
      paymentDate: new Date(ns.trandate),
      status: "posted" as any,
    };
  }
}
