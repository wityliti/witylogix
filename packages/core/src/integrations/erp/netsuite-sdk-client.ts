/**
 * Oracle NetSuite REST + SuiteTalk SDK Client
 * Token-Based Authentication (TBA) with OAuth1 support
 * Comprehensive support for Records, SuiteQL, Saved Searches, File Cabinet, RESTlets
 */

import { createHmac } from 'crypto';

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────

/**
 * NetSuite SDK client configuration
 */
export interface NetSuiteSdkConfig {
  accountId: string; // e.g., 12345678
  consumerKey: string;
  consumerSecret: string;
  tokenKey: string;
  tokenSecret: string;
  environment?: 'sandbox' | 'production';
  timeout?: number; // Default: 30000ms
  maxRetries?: number; // Default: 3
  concurrency?: {
    maxConcurrentRequests?: number; // Default: 10
    maxPointsPerDay?: number; // Default: 4500
  };
}

/**
 * OAuth1 signature for request authentication
 */
export interface OAuth1Signature {
  oauth_consumer_key: string;
  oauth_token: string;
  oauth_signature_method: string;
  oauth_signature: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
}

/**
 * SuiteQL query request
 */
export interface SuiteQLRequest {
  q: string;
  offset?: number;
  limit?: number;
}

/**
 * SuiteQL query result
 */
export interface SuiteQLResult<T = Record<string, any>> {
  totalResults: number;
  count: number;
  offset: number;
  hasMore: boolean;
  items: T[];
}

/**
 * NetSuite record operation result
 */
export interface RecordOperationResult {
  id: string;
  recordType: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * NetSuite customer record
 */
export interface NetSuiteCustomer {
  id?: string;
  internalId?: string;
  entityId: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  status?: 'active' | 'inactive';
  tier?: string;
  taxId?: string;
  creditLimit?: number;
  currency?: string;
  paymentTerms?: string;
  billingAddress?: NetSuiteAddress;
  shippingAddress?: NetSuiteAddress;
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite vendor record
 */
export interface NetSuiteVendor {
  id?: string;
  internalId?: string;
  entityId: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  status?: 'active' | 'inactive';
  taxId?: string;
  currency?: string;
  paymentTerms?: string;
  1099?: boolean;
  address?: NetSuiteAddress;
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite sales order record
 */
export interface NetSuiteSalesOrder {
  id?: string;
  internalId?: string;
  recordType: 'salesorder';
  tranId: string;
  entity: string; // Customer internal ID
  entityName?: string;
  tranDate: Date | string;
  dueDate?: Date | string;
  status?: string;
  currency?: string;
  exchangeRate?: number;
  subsidiary?: string;
  billingAddress?: NetSuiteAddress;
  shippingAddress?: NetSuiteAddress;
  memo?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  total?: number;
  items?: NetSuiteLineItem[];
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite purchase order record
 */
export interface NetSuitePurchaseOrder {
  id?: string;
  internalId?: string;
  recordType: 'purchaseorder';
  tranId: string;
  entity: string; // Vendor internal ID
  entityName?: string;
  tranDate: Date | string;
  dueDate?: Date | string;
  status?: string;
  currency?: string;
  exchangeRate?: number;
  subsidiary?: string;
  deliveryAddress?: NetSuiteAddress;
  memo?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  total?: number;
  items?: NetSuiteLineItem[];
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite invoice record
 */
export interface NetSuiteInvoice {
  id?: string;
  internalId?: string;
  recordType: 'invoice';
  tranId: string;
  entity: string; // Customer internal ID
  entityName?: string;
  tranDate: Date | string;
  dueDate: Date | string;
  postingPeriod?: string;
  currency?: string;
  exchangeRate?: number;
  subsidiary?: string;
  status?: 'Draft' | 'Open' | 'Fully Billed' | 'Paid in Full' | 'Overdue' | 'Closed';
  billingAddress?: NetSuiteAddress;
  shippingAddress?: NetSuiteAddress;
  memo?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  total?: number;
  amountPaid?: number;
  amountRemaining?: number;
  items?: NetSuiteLineItem[];
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite vendor bill record
 */
export interface NetSuiteVendorBill {
  id?: string;
  internalId?: string;
  recordType: 'vendorbill';
  tranId: string;
  entity: string; // Vendor internal ID
  entityName?: string;
  tranDate: Date | string;
  dueDate: Date | string;
  postingPeriod?: string;
  currency?: string;
  exchangeRate?: number;
  subsidiary?: string;
  status?: 'Open' | 'Fully Paid' | 'Partially Paid' | 'Overdue' | 'Closed';
  memo?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  total?: number;
  amountPaid?: number;
  amountRemaining?: number;
  items?: NetSuiteLineItem[];
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite item/product record
 */
export interface NetSuiteItem {
  id?: string;
  internalId?: string;
  itemId: string;
  displayName?: string;
  type?: string;
  baseUnit?: string;
  purchaseUnit?: string;
  saleUnit?: string;
  conversionRate?: number;
  description?: string;
  cost?: number;
  costUnits?: string;
  taxSchedule?: string;
  unitsType?: string;
  department?: string;
  class?: string;
  location?: string;
  isDeferredExpenseItem?: boolean;
  isExpenseItem?: boolean;
  isInvtItem?: boolean;
  isLotNumbered?: boolean;
  isSerialNumbered?: boolean;
  quantityOnHand?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  customFields?: Record<string, any>;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * NetSuite address
 */
export interface NetSuiteAddress {
  label?: string;
  attention?: string;
  addressee?: string;
  addr1: string;
  addr2?: string;
  addr3?: string;
  city: string;
  state?: string;
  zip: string;
  country: string;
  phone?: string;
  fax?: string;
  email?: string;
  isDefault?: boolean;
  isResidential?: boolean;
}

/**
 * NetSuite line item for orders/invoices
 */
export interface NetSuiteLineItem {
  line?: number;
  item: string; // Item internal ID or external ID
  itemName?: string;
  description?: string;
  quantity: number;
  quantityReceived?: number;
  quantityBilled?: number;
  quantityRemaining?: number;
  rate?: number;
  rateSchedule?: string;
  unitCost?: number;
  amount?: number;
  discount?: number | string; // Percent or amount
  taxCode?: string;
  customFields?: Record<string, any>;
}

/**
 * NetSuite search filter
 */
export interface NetSuiteSearchFilter {
  name: string;
  operator?: string;
  values?: string[];
}

/**
 * NetSuite saved search result
 */
export interface NetSuiteSavedSearchResult<T = Record<string, any>> {
  id: string;
  results: T[];
  count: number;
  totalResults: number;
  hasMore: boolean;
  offset: number;
}

/**
 * NetSuite file cabinet item
 */
export interface NetSuiteFile {
  id?: string;
  internalId?: string;
  name: string;
  fileType?: string;
  size?: number;
  folder?: string;
  description?: string;
  content?: Buffer | string;
  mimeType?: string;
  isOnline?: boolean;
  isInactive?: boolean;
  createdDate?: Date;
  lastModifiedDate?: Date;
}

/**
 * Request concurrency tracking
 */
interface ConcurrencyTracker {
  activeRequests: number;
  pointsUsedToday: number;
  lastResetDate: Date;
  queue: Array<() => Promise<any>>;
}

// ─── OAUTH1 SIGNATURE BUILDER ──────────────────────────────────────────────

/**
 * Builds OAuth1 signatures for NetSuite TBA requests
 */
export class OAuth1SignatureBuilder {
  /**
   * Generate OAuth1 signature
   */
  static generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string,
  ): string {
    const baseString = this.generateBaseString(method, url, params);
    const signingKey = `${consumerSecret}&${tokenSecret}`;

    return createHmac('sha256', signingKey).update(baseString).digest('base64');
  }

  /**
   * Generate base string for signature
   */
  private static generateBaseString(method: string, url: string, params: Record<string, string>): string {
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&');

    return baseString;
  }

  /**
   * Generate OAuth1 authorization header
   */
  static generateAuthHeader(signature: OAuth1Signature): string {
    return (
      `OAuth ` +
      Object.entries(signature)
        .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
        .join(',')
    );
  }

  /**
   * Generate nonce
   */
  static generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate timestamp
   */
  static generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }
}

// ─── NETSUITE SDK CLIENT ──────────────────────────────────────────────────

/**
 * Oracle NetSuite REST + SuiteTalk SDK Client
 * Supports OAuth1 Token-Based Authentication (TBA)
 */
export class NetSuiteSdkClient {
  private config: NetSuiteSdkConfig;
  private restBaseUrl: string;
  private concurrency: ConcurrencyTracker;
  private readonly defaultTimeout = 30000;
  private readonly defaultMaxRetries = 3;
  private readonly maxPointsPerDay = 4500;
  private readonly maxConcurrentRequests = 10;

  constructor(config: NetSuiteSdkConfig) {
    this.config = {
      timeout: this.defaultTimeout,
      maxRetries: this.defaultMaxRetries,
      environment: 'production',
      ...config,
    };

    if (!config.accountId || !config.consumerKey || !config.consumerSecret) {
      throw new Error('NetSuite client requires accountId, consumerKey, and consumerSecret');
    }

    if (!config.tokenKey || !config.tokenSecret) {
      throw new Error('NetSuite client requires tokenKey and tokenSecret for TBA');
    }

    const env = this.config.environment === 'sandbox' ? '_sb' : '';
    this.restBaseUrl = `https://${this.config.accountId}${env}.suiteapis.com/services/rest`;

    this.concurrency = {
      activeRequests: 0,
      pointsUsedToday: 0,
      lastResetDate: new Date(),
      queue: [],
    };
  }

  /**
   * Check health of NetSuite connection
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/record/v1/customer', {
        limit: 1,
      });

      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Get customer record
   */
  async getCustomer(customerId: string): Promise<NetSuiteCustomer> {
    const response = await this.request('GET', `/record/v1/customer/${customerId}`);

    return this.transformCustomerResponse(response as Record<string, any>);
  }

  /**
   * Create customer record
   */
  async createCustomer(customer: NetSuiteCustomer): Promise<NetSuiteCustomer> {
    const response = await this.request('POST', '/record/v1/customer', customer);

    return { ...customer, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Update customer record
   */
  async updateCustomer(customerId: string, updates: Partial<NetSuiteCustomer>): Promise<NetSuiteCustomer> {
    const response = await this.request('PATCH', `/record/v1/customer/${customerId}`, updates);

    return this.transformCustomerResponse(response as Record<string, any>);
  }

  /**
   * Delete customer record
   */
  async deleteCustomer(customerId: string): Promise<void> {
    await this.request('DELETE', `/record/v1/customer/${customerId}`);
  }

  /**
   * Search customers
   */
  async searchCustomers(filters: NetSuiteSearchFilter[] = []): Promise<SuiteQLResult<NetSuiteCustomer>> {
    let q = 'SELECT * FROM customer';

    if (filters.length > 0) {
      const whereClauses = filters
        .map((f) => {
          if (f.values && f.values.length > 0) {
            const values = f.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
            return `${f.name} ${f.operator || 'IN'} (${values})`;
          }
          return `${f.name} ${f.operator || '='} '${(f.values?.[0] || '').replace(/'/g, "''")}'`;
        })
        .join(' AND ');

      q += ` WHERE ${whereClauses}`;
    }

    return this.executeSuiteQL<NetSuiteCustomer>(q);
  }

  /**
   * Get vendor record
   */
  async getVendor(vendorId: string): Promise<NetSuiteVendor> {
    const response = await this.request('GET', `/record/v1/vendor/${vendorId}`);

    return response as NetSuiteVendor;
  }

  /**
   * Create vendor record
   */
  async createVendor(vendor: NetSuiteVendor): Promise<NetSuiteVendor> {
    const response = await this.request('POST', '/record/v1/vendor', vendor);

    return { ...vendor, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Update vendor record
   */
  async updateVendor(vendorId: string, updates: Partial<NetSuiteVendor>): Promise<NetSuiteVendor> {
    const response = await this.request('PATCH', `/record/v1/vendor/${vendorId}`, updates);

    return response as NetSuiteVendor;
  }

  /**
   * Get sales order
   */
  async getSalesOrder(orderId: string): Promise<NetSuiteSalesOrder> {
    const response = await this.request('GET', `/record/v1/salesorder/${orderId}`);

    return response as NetSuiteSalesOrder;
  }

  /**
   * Create sales order
   */
  async createSalesOrder(order: NetSuiteSalesOrder): Promise<NetSuiteSalesOrder> {
    const response = await this.request('POST', '/record/v1/salesorder', order);

    return { ...order, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Update sales order
   */
  async updateSalesOrder(orderId: string, updates: Partial<NetSuiteSalesOrder>): Promise<NetSuiteSalesOrder> {
    const response = await this.request('PATCH', `/record/v1/salesorder/${orderId}`, updates);

    return response as NetSuiteSalesOrder;
  }

  /**
   * Update line items on sales order
   */
  async updateSalesOrderItems(orderId: string, items: NetSuiteLineItem[]): Promise<void> {
    await this.request('PATCH', `/record/v1/salesorder/${orderId}`, {
      items: items,
    });
  }

  /**
   * Get purchase order
   */
  async getPurchaseOrder(orderId: string): Promise<NetSuitePurchaseOrder> {
    const response = await this.request('GET', `/record/v1/purchaseorder/${orderId}`);

    return response as NetSuitePurchaseOrder;
  }

  /**
   * Create purchase order
   */
  async createPurchaseOrder(order: NetSuitePurchaseOrder): Promise<NetSuitePurchaseOrder> {
    const response = await this.request('POST', '/record/v1/purchaseorder', order);

    return { ...order, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(orderId: string, updates: Partial<NetSuitePurchaseOrder>): Promise<NetSuitePurchaseOrder> {
    const response = await this.request('PATCH', `/record/v1/purchaseorder/${orderId}`, updates);

    return response as NetSuitePurchaseOrder;
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<NetSuiteInvoice> {
    const response = await this.request('GET', `/record/v1/invoice/${invoiceId}`);

    return response as NetSuiteInvoice;
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: NetSuiteInvoice): Promise<NetSuiteInvoice> {
    const response = await this.request('POST', '/record/v1/invoice', invoice);

    return { ...invoice, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Get vendor bill
   */
  async getVendorBill(billId: string): Promise<NetSuiteVendorBill> {
    const response = await this.request('GET', `/record/v1/vendorbill/${billId}`);

    return response as NetSuiteVendorBill;
  }

  /**
   * Create vendor bill
   */
  async createVendorBill(bill: NetSuiteVendorBill): Promise<NetSuiteVendorBill> {
    const response = await this.request('POST', '/record/v1/vendorbill', bill);

    return { ...bill, id: (response as any).id, internalId: (response as any).internalId };
  }

  /**
   * Get item/product
   */
  async getItem(itemId: string): Promise<NetSuiteItem> {
    const response = await this.request('GET', `/record/v1/item/${itemId}`);

    return response as NetSuiteItem;
  }

  /**
   * Search items
   */
  async searchItems(filters: NetSuiteSearchFilter[] = []): Promise<SuiteQLResult<NetSuiteItem>> {
    let q = 'SELECT * FROM item';

    if (filters.length > 0) {
      const whereClauses = filters
        .map((f) => {
          if (f.values && f.values.length > 0) {
            const values = f.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
            return `${f.name} ${f.operator || 'IN'} (${values})`;
          }
          return `${f.name} ${f.operator || '='} '${(f.values?.[0] || '').replace(/'/g, "''")}'`;
        })
        .join(' AND ');

      q += ` WHERE ${whereClauses}`;
    }

    return this.executeSuiteQL<NetSuiteItem>(q);
  }

  /**
   * Execute SuiteQL query
   */
  async executeSuiteQL<T = Record<string, any>>(
    query: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<SuiteQLResult<T>> {
    const response = await this.request('POST', '/query/v1/suiteql', {
      q: query,
      offset: options.offset || 0,
      limit: options.limit || 100,
    });

    const result = response as any;

    return {
      totalResults: result.totalResults || 0,
      count: result.count || 0,
      offset: result.offset || 0,
      hasMore: result.hasMore || false,
      items: result.items || [],
    };
  }

  /**
   * Execute saved search
   */
  async executeSavedSearch<T = Record<string, any>>(
    searchId: string,
    filters?: NetSuiteSearchFilter[],
    options: { offset?: number; limit?: number } = {},
  ): Promise<NetSuiteSavedSearchResult<T>> {
    const response = await this.request('GET', `/record/v1/savedsearch/${searchId}`, {
      filters: filters || [],
      offset: options.offset || 0,
      limit: options.limit || 100,
    });

    const result = response as any;

    return {
      id: searchId,
      results: result.results || [],
      count: result.count || 0,
      totalResults: result.totalResults || 0,
      hasMore: result.hasMore || false,
      offset: result.offset || 0,
    };
  }

  /**
   * Upload file to NetSuite File Cabinet
   */
  async uploadFile(file: NetSuiteFile): Promise<NetSuiteFile> {
    const formData = new FormData();

    if (file.content) {
      const blob =
        file.content instanceof Buffer ? new Blob([file.content], { type: file.mimeType }) : new Blob([file.content]);

      formData.append('file', blob, file.name);
    }

    if (file.description) {
      formData.append('description', file.description);
    }

    if (file.folder) {
      formData.append('folder', file.folder);
    }

    const response = await this.request('POST', '/file/v1/file', formData as any);

    return response as NetSuiteFile;
  }

  /**
   * Download file from File Cabinet
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await this.makeRawRequest('GET', `/file/v1/file/${fileId}`);

    return await response.arrayBuffer().then((buffer) => Buffer.from(buffer));
  }

  /**
   * Call custom RESTlet
   */
  async callRestlet(
    scriptId: string,
    deploymentId: string,
    params: Record<string, any> = {},
  ): Promise<Record<string, any>> {
    const response = await this.request('POST', `/restlets/v1/custom/script/${scriptId}/deployment/${deploymentId}`, params);

    return response as Record<string, any>;
  }

  /**
   * Check and apply concurrency limits
   */
  private async applyRequestLimit(): Promise<void> {
    // Reset daily points if needed
    const now = new Date();
    if (now.getDate() !== this.concurrency.lastResetDate.getDate()) {
      this.concurrency.pointsUsedToday = 0;
      this.concurrency.lastResetDate = now;
    }

    // Wait for available slot
    while (
      this.concurrency.activeRequests >= (this.config.concurrency?.maxConcurrentRequests || this.maxConcurrentRequests)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Check daily points limit
    if (this.concurrency.pointsUsedToday >= (this.config.concurrency?.maxPointsPerDay || this.maxPointsPerDay)) {
      throw new Error('NetSuite daily API points limit exceeded');
    }

    this.concurrency.activeRequests += 1;
  }

  /**
   * Release request slot
   */
  private releaseRequestSlot(pointsUsed: number = 1): void {
    this.concurrency.activeRequests -= 1;
    this.concurrency.pointsUsedToday += pointsUsed;
  }

  /**
   * Make OAuth1-signed HTTP request
   */
  private async request(method: string, path: string, body?: any): Promise<unknown> {
    await this.applyRequestLimit();

    let lastError: Error | undefined;
    let pointsUsed = 1;

    for (let attempt = 0; attempt < (this.config.maxRetries || this.defaultMaxRetries); attempt++) {
      try {
        const url = `${this.restBaseUrl}${path}`;

        // Build OAuth1 params
        const timestamp = OAuth1SignatureBuilder.generateTimestamp();
        const nonce = OAuth1SignatureBuilder.generateNonce();

        const oauthParams: Record<string, string> = {
          oauth_consumer_key: this.config.consumerKey,
          oauth_token: this.config.tokenKey,
          oauth_signature_method: 'HMAC-SHA256',
          oauth_timestamp: timestamp,
          oauth_nonce: nonce,
          oauth_version: '1.0',
        };

        // Add request params to signature
        const allParams = { ...oauthParams };
        if (method === 'GET' && body) {
          Object.assign(allParams, body as Record<string, string>);
        }

        const signature = OAuth1SignatureBuilder.generateSignature(
          method,
          url,
          allParams,
          this.config.consumerSecret,
          this.config.tokenSecret,
        );

        const authHeader = OAuth1SignatureBuilder.generateAuthHeader({
          ...oauthParams,
          oauth_signature: signature,
        });

        const headers: Record<string, string> = {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        };

        let fetchUrl = url;
        let fetchBody: string | undefined;

        if (method === 'GET' && body) {
          const params = new URLSearchParams(body);
          fetchUrl = `${url}?${params.toString()}`;
        } else if (body && typeof body !== 'string') {
          fetchBody = JSON.stringify(body);
        } else if (body && typeof body === 'string') {
          fetchBody = body;
        }

        const response = await fetch(fetchUrl, {
          method,
          headers,
          body: fetchBody,
          signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
        });

        if (!response.ok) {
          throw new Error(`NetSuite API error [${response.status}]: ${response.statusText}`);
        }

        if (response.status === 204 || method === 'DELETE') {
          this.releaseRequestSlot(pointsUsed);
          return undefined;
        }

        const result = await response.json();
        this.releaseRequestSlot(pointsUsed);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < (this.config.maxRetries || this.defaultMaxRetries) - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.releaseRequestSlot(pointsUsed);
    throw lastError || new Error('Unknown error in NetSuite API request');
  }

  /**
   * Make raw HTTP request (for file downloads)
   */
  private async makeRawRequest(method: string, path: string): Promise<Response> {
    const url = `${this.restBaseUrl}${path}`;

    const timestamp = OAuth1SignatureBuilder.generateTimestamp();
    const nonce = OAuth1SignatureBuilder.generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_token: this.config.tokenKey,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    const signature = OAuth1SignatureBuilder.generateSignature(
      method,
      url,
      oauthParams,
      this.config.consumerSecret,
      this.config.tokenSecret,
    );

    const authHeader = OAuth1SignatureBuilder.generateAuthHeader({
      ...oauthParams,
      oauth_signature: signature,
    });

    return fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
      },
    });
  }

  /**
   * Transform customer response to standard format
   */
  private transformCustomerResponse(response: Record<string, any>): NetSuiteCustomer {
    return {
      id: response.id || response.internalId,
      internalId: response.internalId,
      entityId: response.entityId,
      companyName: response.companyName,
      firstName: response.firstName,
      lastName: response.lastName,
      email: response.email,
      phone: response.phone,
      status: response.isInactive === false ? 'active' : 'inactive',
      customFields: response.customFields,
      createdDate: response.createdDate ? new Date(response.createdDate) : undefined,
      lastModifiedDate: response.lastModifiedDate ? new Date(response.lastModifiedDate) : undefined,
    };
  }
}
