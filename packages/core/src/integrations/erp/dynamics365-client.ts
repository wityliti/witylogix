/**
 * Microsoft Dynamics 365 Business Central / Finance Adapter
 * OAuth2 with Azure AD (MSAL) authentication
 * Supports Companies, Customers, Sales Orders, Invoices, Items, GL, Dimensions
 */

import type {
  ERPConnection,
  ERPCustomer,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  SyncEntityType,
  PaginationParams,
  PaginatedResult,
} from './types.js';
import { AbstractERPAdapter } from './erp-adapter.js';

// ─── DYNAMICS365-SPECIFIC TYPES ────────────────────────────────────────────

export interface Dynamics365Config {
  tenantId: string; // Azure AD Tenant ID
  clientId: string; // Azure AD App Registration ID
  clientSecret: string;
  redirectUri: string;
  environment?: 'sandbox' | 'production';
  timeout?: number;
  maxRetries?: number;
}

export interface Dynamics365AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface Dynamics365Company {
  id: string;
  name: string;
  displayName: string;
  businessProfileId?: string;
}

export interface D365QueryOptions {
  $filter?: string;
  $select?: string[];
  $expand?: string[];
  $orderby?: string;
  $top?: number;
  $skip?: number;
}

// ─── DYNAMICS 365 ADAPTER ──────────────────────────────────────────────────

/**
 * Microsoft Dynamics 365 Business Central / Finance Adapter
 * Implements OData v4 with Azure AD OAuth2
 */
export class Dynamics365Client extends AbstractERPAdapter {
  private config: Dynamics365Config;
  private apiBaseUrl: string;
  private authBaseUrl: string;
  private companyId?: string;

  constructor(connection: ERPConnection, config: Dynamics365Config) {
    super('dynamics365', connection);
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: 'production',
      ...config,
    };

    const env = this.config.environment === 'sandbox' ? 'sandbox' : '';
    this.apiBaseUrl = `https://api.businesscentral.dynamics.com/v2.0/${env}/companies`;
    this.authBaseUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0`;
    this.companyId = connection.credentials.companyId;
  }

  /**
   * Get authorization URL for OAuth2
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: 'https://api.businesscentral.dynamics.com/.default',
      redirect_uri: this.config.redirectUri,
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/authorize?${params}`;
  }

  /**
   * Authenticate with Dynamics365
   */
  async authenticate(authCode: string): Promise<void> {
    // INTEGRATION: Exchange OAuth code for access token
    // POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token

    const mockResponse: Dynamics365AuthResponse = {
      access_token: `d365_at_${Date.now()}`,
      refresh_token: `d365_rt_${Date.now()}`,
      expires_in: 3600,
      token_type: 'Bearer',
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
        const companies = await this.getCompanies();
        return companies.length > 0;
      });
    } catch {
      return false;
    }
  }

  // ─── COMPANIES ────────────────────────────────────────────────────────

  /**
   * Get all companies
   */
  async getCompanies(): Promise<Dynamics365Company[]> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet('/companies');
      return response.value.map((company: any) => ({
        id: company.id,
        name: company.name,
        displayName: company.displayName,
        businessProfileId: company.businessProfileId,
      }));
    });
  }

  /**
   * Get company by ID
   */
  async getCompany(companyId: string): Promise<Dynamics365Company> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(`/companies('${companyId}')`);
      return {
        id: response.id,
        name: response.name,
        displayName: response.displayName,
        businessProfileId: response.businessProfileId,
      };
    });
  }

  /**
   * Set active company
   */
  setActiveCompany(companyId: string): void {
    this.companyId = companyId;
  }

  // ─── CUSTOMERS ────────────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapCustomerToD365(customer);
      const response = await this.oDataPost(
        `/companies('${this.companyId}')/customers`,
        d365Payload,
      );

      return {
        ...customer,
        id: response.id,
        externalId: response.number,
      };
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const response = await this.oDataGet(
        `/companies('${this.companyId}')/customers('${customerId}')`,
      );
      return this.mapCustomerFromD365(response);
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, customer: Partial<ERPCustomer>): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapCustomerToD365(customer as ERPCustomer);
      await this.oDataPatch(
        `/companies('${this.companyId}')/customers('${customerId}')`,
        d365Payload,
      );
      return this.getCustomer(customerId);
    });
  }

  /**
   * Query customers with OData filters
   */
  async queryCustomers(
    options?: D365QueryOptions,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPCustomer>> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const queryUrl = this.buildODataUrl(
        `/companies('${this.companyId}')/customers`,
        { ...options, $skip: skip, $top: limit },
      );

      const response = await this.oDataGet(queryUrl);

      return {
        items: response.value.map((c: any) => this.mapCustomerFromD365(c)),
        total: response['@odata.count'] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── SALES ORDERS ──────────────────────────────────────────────────────

  /**
   * Create sales order
   */
  async createSalesOrder(order: ERPOrder): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapOrderToD365(order);
      const response = await this.oDataPost(
        `/companies('${this.companyId}')/salesOrders`,
        d365Payload,
      );

      return {
        ...order,
        id: response.id,
        externalId: response.number,
        orderNumber: response.number,
      };
    });
  }

  /**
   * Get sales order
   */
  async getSalesOrder(orderId: string): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const response = await this.oDataGet(
        `/companies('${this.companyId}')/salesOrders('${orderId}')?$expand=salesOrderLines`,
      );
      return this.mapOrderFromD365(response);
    });
  }

  /**
   * Post sales order (create sales invoice)
   */
  async postSalesOrder(orderId: string): Promise<{ invoiceId: string }> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      // In Dynamics, posting a sales order creates a sales invoice
      const order = await this.getSalesOrder(orderId);
      const invoice: ERPInvoice = {
        customerId: order.customerId,
        invoiceNumber: order.orderNumber,
        invoiceDate: order.orderDate,
        dueDate: order.dueDate || new Date(),
        lineItems: order.lineItems,
        total: order.total,
        status: 'draft',
      };

      const response = await this.createInvoice(invoice);
      return { invoiceId: response.id || '' };
    });
  }

  /**
   * Ship sales order
   */
  async shipSalesOrder(orderId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      await this.oDataPatch(`/companies('${this.companyId}')/salesOrders('${orderId}')`, {
        status: 'shipped',
      });
    });
  }

  // ─── INVOICES ──────────────────────────────────────────────────────────

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const endpoint =
        invoice.invoiceType === 'purchase'
          ? `/companies('${this.companyId}')/purchaseInvoices`
          : `/companies('${this.companyId}')/salesInvoices`;

      const d365Payload = this.mapInvoiceToD365(invoice);
      const response = await this.oDataPost(endpoint, d365Payload);

      return {
        ...invoice,
        id: response.id,
        externalId: response.number,
        invoiceNumber: response.number,
      };
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string, isPurchase: boolean = false): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const endpoint =
        isPurchase
          ? `/companies('${this.companyId}')/purchaseInvoices('${invoiceId}')`
          : `/companies('${this.companyId}')/salesInvoices('${invoiceId}')`;

      const response = await this.oDataGet(`${endpoint}?$expand=salesInvoiceLines`);
      return this.mapInvoiceFromD365(response);
    });
  }

  /**
   * Post invoice
   */
  async postInvoice(invoiceId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      await this.oDataPatch(
        `/companies('${this.companyId}')/salesInvoices('${invoiceId}')`,
        { status: 'posted' },
      );
    });
  }

  /**
   * Create credit memo
   */
  async createCreditMemo(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapInvoiceToD365({
        ...invoice,
        invoiceType: 'credit_memo',
      });

      const response = await this.oDataPost(
        `/companies('${this.companyId}')/creditMemos`,
        d365Payload,
      );

      return {
        ...invoice,
        id: response.id,
        externalId: response.number,
        invoiceType: 'credit_memo',
      };
    });
  }

  // ─── ITEMS (PRODUCTS) ──────────────────────────────────────────────────

  /**
   * Create item
   */
  async createItem(item: ERPProduct): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapItemToD365(item);
      const response = await this.oDataPost(
        `/companies('${this.companyId}')/items`,
        d365Payload,
      );

      return {
        ...item,
        id: response.id,
        externalId: response.number,
      };
    });
  }

  /**
   * Get item
   */
  async getItem(itemId: string): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const response = await this.oDataGet(`/companies('${this.companyId}')/items('${itemId}')`);
      return this.mapItemFromD365(response);
    });
  }

  /**
   * Update item
   */
  async updateItem(itemId: string, item: Partial<ERPProduct>): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const d365Payload = this.mapItemToD365(item as ERPProduct);
      await this.oDataPatch(`/companies('${this.companyId}')/items('${itemId}')`, d365Payload);
      return this.getItem(itemId);
    });
  }

  /**
   * Query items
   */
  async queryItems(
    options?: D365QueryOptions,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPProduct>> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const queryUrl = this.buildODataUrl(
        `/companies('${this.companyId}')/items`,
        { ...options, $skip: skip, $top: limit },
      );

      const response = await this.oDataGet(queryUrl);

      return {
        items: response.value.map((i: any) => this.mapItemFromD365(i)),
        total: response['@odata.count'] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── GENERAL LEDGER ────────────────────────────────────────────────────

  /**
   * Query GL accounts
   */
  async queryChartOfAccounts(
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<{ code: string; name: string }>> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const response = await this.oDataGet(
        `/companies('${this.companyId}')/chartOfAccounts?$skip=${skip}&$top=${limit}`,
      );

      return {
        items: response.value.map((acc: any) => ({
          code: acc.number,
          name: acc.displayName,
        })),
        total: response['@odata.count'] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  /**
   * Post journal entry
   */
  async postJournalEntry(data: Record<string, any>): Promise<{ journalId: string }> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const response = await this.oDataPost(
        `/companies('${this.companyId}')/journalLines`,
        data,
      );

      return { journalId: response.id };
    });
  }

  // ─── DIMENSIONS (Cost Centers, Departments, Projects) ────────────────

  /**
   * Query dimensions
   */
  async queryDimensions(
    code: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<{ code: string; name: string }>> {
    return this.executeWithRateLimit(async () => {
      if (!this.companyId) throw this.createError('Company ID not set', 'MISSING_COMPANY_ID');

      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;

      const response = await this.oDataGet(
        `/companies('${this.companyId}')/dimensionLines?$filter=code eq '${code}'&$skip=${skip}&$top=${limit}`,
      );

      return {
        items: response.value.map((dim: any) => ({
          code: dim.code,
          name: dim.displayName,
        })),
        total: response['@odata.count'] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────

  /**
   * Build OData URL with query options
   */
  private buildODataUrl(basePath: string, options: D365QueryOptions): string {
    const params = new URLSearchParams();

    if (options.$filter) params.append('$filter', options.$filter);
    if (options.$select) params.append('$select', options.$select.join(','));
    if (options.$expand) params.append('$expand', options.$expand.join(','));
    if (options.$orderby) params.append('$orderby', options.$orderby);
    if (options.$skip) params.append('$skip', String(options.$skip));
    if (options.$top) params.append('$top', String(options.$top));

    return params.toString() ? `${basePath}?${params}` : basePath;
  }

  /**
   * OData GET request
   */
  protected async oDataGet(path: string, headers?: Record<string, string>): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(`OData GET failed: ${response.statusText}`, 'ODATA_ERROR', response.status >= 500);
    }

    return response.json();
  }

  /**
   * OData POST request
   */
  protected async oDataPost(path: string, body: any, headers?: Record<string, string>): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(`OData POST failed: ${response.statusText}`, 'ODATA_ERROR', response.status >= 500);
    }

    return response.json();
  }

  /**
   * OData PATCH request
   */
  protected async oDataPatch(path: string, body: any, headers?: Record<string, string>): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw this.createError(`OData PATCH failed: ${response.statusText}`, 'ODATA_ERROR', response.status >= 500);
    }

    return response.json();
  }

  private getAccessToken(): Promise<string> {
    return (this.tokenManager as any).getAccessToken();
  }

  private mapCustomerToD365(customer: ERPCustomer): Record<string, any> {
    return {
      number: customer.code,
      displayName: customer.name,
      email: customer.email,
      phoneNumber: customer.phone,
      website: customer.website,
      taxRegistrationNumber: customer.taxId,
      creditLimit: customer.creditLimit,
      currencyCode: customer.currency,
    };
  }

  private mapCustomerFromD365(c: any): ERPCustomer {
    return {
      id: c.id,
      externalId: c.number,
      code: c.number,
      name: c.displayName,
      email: c.email,
      phone: c.phoneNumber,
      website: c.website,
      taxId: c.taxRegistrationNumber,
      creditLimit: c.creditLimit,
      currency: c.currencyCode,
    };
  }

  private mapOrderToD365(order: ERPOrder): Record<string, any> {
    return {
      customerNumber: order.customerId,
      orderDate: order.orderDate.toISOString().split('T')[0],
      requestedDeliveryDate: order.dueDate?.toISOString().split('T')[0],
      salesOrderLines: order.lineItems.map((line) => ({
        itemNumber: line.itemCode,
        description: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
    };
  }

  private mapOrderFromD365(o: any): ERPOrder {
    return {
      id: o.id,
      externalId: o.number,
      orderNumber: o.number,
      customerId: o.customerNumber,
      customerName: o.customerName,
      orderDate: new Date(o.orderDate),
      dueDate: o.requestedDeliveryDate ? new Date(o.requestedDeliveryDate) : undefined,
      status: o.status,
      lineItems: o.salesOrderLines || [],
      total: o.totalAmountIncludingTax,
    };
  }

  private mapInvoiceToD365(invoice: ERPInvoice): Record<string, any> {
    return {
      customerNumber: invoice.customerId,
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      salesInvoiceLines: invoice.lineItems.map((line) => ({
        itemNumber: line.itemCode,
        description: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
    };
  }

  private mapInvoiceFromD365(i: any): ERPInvoice {
    return {
      id: i.id,
      externalId: i.number,
      invoiceNumber: i.number,
      customerId: i.customerNumber,
      customerName: i.customerName,
      invoiceDate: new Date(i.invoiceDate),
      dueDate: new Date(i.dueDate),
      status: i.status,
      lineItems: i.salesInvoiceLines || [],
      total: i.totalAmountIncludingTax,
    };
  }

  private mapItemToD365(item: ERPProduct): Record<string, any> {
    return {
      number: item.sku,
      displayName: item.name,
      description: item.description,
      baseUnitOfMeasure: item.unit,
      unitPrice: item.unitPrice,
      standardCost: item.cost,
    };
  }

  private mapItemFromD365(i: any): ERPProduct {
    return {
      id: i.id,
      externalId: i.number,
      sku: i.number,
      name: i.displayName,
      description: i.description,
      unit: i.baseUnitOfMeasure,
      unitPrice: i.unitPrice,
      cost: i.standardCost,
      status: 'active',
    };
  }

  private generateRandomString(length: number): string {
    return Array.from({ length }, () => Math.random().toString(36)[2]).join('');
  }
}
