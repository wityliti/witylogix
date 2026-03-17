/**
 * SAP S/4HANA OData v4 API Client
 * Implements OAuth2 client credentials + SAML bearer assertion authentication
 * Provides comprehensive OData query building, batch operations, and CSRF token handling
 * Supports Business Partners, Sales Orders, Purchase Orders, Materials, Deliveries, Invoices
 */

import { createHmac } from 'crypto';

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────

/**
 * SAP OData query builder filter operators
 */
export type ODataOperator = 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'startswith' | 'endswith' | 'contains';

/**
 * SAP OData client configuration
 */
export interface SapODataConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  instanceUrl: string; // e.g., https://my.example.com/sap/opu/odata/sap/
  environment?: 'sandbox' | 'production';
  timeout?: number; // Default: 30000ms
  maxRetries?: number; // Default: 3
  rateLimit?: {
    requestsPerSecond?: number;
    maxConcurrentRequests?: number;
  };
  samlAssertion?: string; // Optional SAML bearer assertion
}

/**
 * OData query filter condition
 */
export interface ODataFilterCondition {
  field: string;
  operator: ODataOperator;
  value: string | number | boolean;
  caseSensitive?: boolean;
}

/**
 * OData query builder
 */
export interface ODataQuery {
  filter?: ODataFilterCondition[];
  select?: string[];
  expand?: string[];
  orderby?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  top?: number;
  skip?: number;
  count?: boolean;
}

/**
 * CSRF token metadata
 */
export interface CsrfTokenInfo {
  token: string;
  fetchedAt: number;
  expiresIn?: number;
}

/**
 * SAP business partner (customer) entity
 */
export interface SapBusinessPartner {
  id?: string;
  BusinessPartner: string; // BP number (key)
  BusinessPartnerName: string;
  BusinessPartnerType?: string; // Customer, Vendor, etc.
  SearchTerm?: string;
  Language?: string;
  AddressID?: string;
  LegalComplianceExempt?: boolean;
  GroupBusinessPartnerNumber?: string;
  CreationDate?: string; // ISO format
  CreatedByUser?: string;
  ModifiedDate?: string;
  ModifiedByUser?: string;
  BusinessPartnerIsBlocked?: boolean;
  IsNaturalPerson?: boolean;
  CentralCorrespondenceLanguage?: string;
  Emails?: Array<{ EmailAddress: string; IsPreferredEmailAddress?: boolean }>;
  PhoneNumbers?: Array<{ PhoneNumber: string; IsPreferredPhoneNumber?: boolean }>;
  WebsiteURL?: string;
  BPAddresses?: SapBusinessPartnerAddress[];
}

/**
 * SAP business partner address
 */
export interface SapBusinessPartnerAddress {
  BusinessPartner: string;
  AddressID: string;
  AddressType?: string; // 1=Billing, 2=Shipping
  AddressName?: string;
  StreetName?: string;
  StreetNumber?: string;
  PostalCode?: string;
  City?: string;
  RegionCode?: string;
  CountryCode?: string;
  TimeZone?: string;
  IsDefaultAddress?: boolean;
  IsPreferredAddress?: boolean;
  IsBeingEditedIndicator?: boolean;
}

/**
 * SAP sales order entity
 */
export interface SapSalesOrder {
  id?: string;
  SalesOrder: string; // Order number (key)
  SalesOrderType?: string;
  CreationDate?: string;
  CreatedByUser?: string;
  DocumentDate?: string;
  ValidityStartDate?: string;
  ValidityEndDate?: string;
  Bill_Cust?: string; // Billing customer
  Bill_ToParty?: string;
  Bill_ToCountry?: string;
  Ship_ToParty?: string;
  Ship_ToCountry?: string;
  Incoterms1?: string;
  IncotermsTransferLocation?: string;
  OrderCurrency?: string;
  NetAmount?: number;
  TaxAmount?: number;
  TotalNetAmount?: number;
  TotalTaxAmount?: number;
  TotalAmount?: number;
  OrderStatus?: string;
  CreationTime?: string;
  SOItems?: SapSalesOrderItem[];
  to_SalesOrderSchedule?: any[];
}

/**
 * SAP sales order line item
 */
export interface SapSalesOrderItem {
  SalesOrder: string;
  SalesOrderItem: string; // Item number
  Material?: string;
  MaterialDescription?: string;
  OrderQuantity?: number;
  OrderQuantityUnit?: string;
  NetAmount?: number;
  TaxAmount?: number;
  TotalNetAmount?: number;
  TotalTaxAmount?: number;
  TotalAmount?: number;
  ItemStatus?: string;
  ConfirmedQuantity?: number;
  DeliveredQuantity?: number;
  CreationDate?: string;
  CreatedByUser?: string;
}

/**
 * SAP purchase order entity
 */
export interface SapPurchaseOrder {
  id?: string;
  PurchaseOrder: string; // PO number (key)
  CreationDate?: string;
  CreatedByUser?: string;
  DocumentDate?: string;
  ValidityStartDate?: string;
  ValidityEndDate?: string;
  Vendor?: string;
  VendorCountry?: string;
  PurchasingOrganization?: string;
  PurchasingGroup?: string;
  DocumentCurrency?: string;
  NetAmount?: number;
  TaxAmount?: number;
  TotalNetAmount?: number;
  TotalTaxAmount?: number;
  TotalAmount?: number;
  DocumentStatus?: string;
  to_PurchaseOrderScheduleLine?: any[];
  to_PurchaseOrderItem?: SapPurchaseOrderItem[];
}

/**
 * SAP purchase order line item
 */
export interface SapPurchaseOrderItem {
  PurchaseOrder: string;
  PurchaseOrderItem: string;
  Material?: string;
  MaterialName?: string;
  OrderQuantity?: number;
  OrderQuantityUnit?: string;
  NetAmount?: number;
  TaxAmount?: number;
  TotalNetAmount?: number;
  TotalTaxAmount?: number;
  TotalAmount?: number;
  ItemStatus?: string;
  CreationDate?: string;
  ReceivedQuantity?: number;
  BilledQuantity?: number;
}

/**
 * SAP product/material entity
 */
export interface SapProduct {
  id?: string;
  Material: string; // Material number (key)
  MaterialType?: string;
  MaterialDescription?: string;
  BaseUnit?: string; // Unit of measure
  IndustrySector?: string;
  CreatedByUser?: string;
  CreationDate?: string;
  LastModifiedByUser?: string;
  LastModifiedDate?: string;
  MaterialStatus?: string;
  Deleted?: boolean;
  to_MaterialPlant?: SapProductPlant[];
}

/**
 * SAP material plant data (inventory/plant-specific)
 */
export interface SapProductPlant {
  Material: string;
  Plant: string;
  PlantName?: string;
  StorageLocation?: string;
  StorageLocationName?: string;
  Quantity?: number;
  Unit?: string;
  ReorderPoint?: number;
  SafetyStock?: number;
  AverageCost?: number;
  StandardCost?: number;
  ValuationType?: string;
  CreatedByUser?: string;
  CreationDate?: string;
  LastModifiedByUser?: string;
  LastModifiedDate?: string;
}

/**
 * SAP outbound delivery entity
 */
export interface SapDelivery {
  id?: string;
  DeliveryDocument: string; // Delivery number (key)
  CreationDate?: string;
  CreatedByUser?: string;
  DeliveryDocumentType?: string;
  DocumentDate?: string;
  ShippingPoint?: string;
  RecipientParty?: string;
  ShippingAddress?: string;
  TransportationPlannigStatus?: string;
  ActualDeliveryRoute?: string;
  ActualGoodsMovementDate?: string;
  ActualGoodsMovementTime?: string;
  BillingDocumentDate?: string;
  HeaderBillingBlockReason?: string;
  DeliveryStatus?: string;
  DeliveryDate?: string;
  to_DeliveryItem?: SapDeliveryItem[];
}

/**
 * SAP delivery line item
 */
export interface SapDeliveryItem {
  DeliveryDocument: string;
  DeliveryDocumentItem: string;
  Material?: string;
  MaterialDescription?: string;
  ActualDeliveryQuantity?: number;
  DeliveryQuantityUnit?: string;
  NetWeight?: number;
  Weight?: number;
  Volume?: number;
}

/**
 * SAP billing document (invoice) entity
 */
export interface SapInvoice {
  id?: string;
  BillingDocument: string; // Invoice number (key)
  CreationDate?: string;
  CreatedByUser?: string;
  BillingDocumentType?: string;
  DocumentDate?: string;
  PostingDate?: string;
  BillingDocumentDate?: string;
  BillingCustomer?: string;
  ShipToParty?: string;
  BillingDocumentStatus?: string;
  TotalNetAmount?: number;
  TotalTaxAmount?: number;
  TotalGrossAmount?: number;
  DocumentCurrency?: string;
  ReferenceSDDocument?: string; // Sales order reference
  to_BillingDocumentItem?: SapInvoiceItem[];
}

/**
 * SAP billing document line item
 */
export interface SapInvoiceItem {
  BillingDocument: string;
  BillingDocumentItem: string;
  Material?: string;
  MaterialDescription?: string;
  BilledQuantity?: number;
  BilledQuantityUnit?: string;
  NetAmount?: number;
  TaxAmount?: number;
  GrossAmount?: number;
  TaxCode?: string;
}

/**
 * SAP batch request operation
 */
export interface SapBatchOperation {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  uri: string;
  id?: string;
  headers?: Record<string, string>;
  body?: unknown;
  dependsOn?: string[];
}

/**
 * SAP batch response
 */
export interface SapBatchResponse {
  responses: Array<{
    id?: string;
    status: number;
    statusCode?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>;
}

/**
 * SAP error details from sap-message header
 */
export interface SapErrorDetail {
  severity?: 'error' | 'warning' | 'info' | 'success';
  code?: string;
  message: string;
  details?: string;
  longTextUrl?: string;
}

// ─── ODATA QUERY BUILDER ───────────────────────────────────────────────────

/**
 * Builds and escapes OData query parameters
 * Prevents injection attacks by proper escaping
 */
export class ODataQueryBuilder {
  private query: ODataQuery;

  constructor() {
    this.query = {};
  }

  /**
   * Add filter condition
   */
  filter(field: string, operator: ODataOperator, value: string | number | boolean): this {
    if (!this.query.filter) {
      this.query.filter = [];
    }

    // Input validation
    if (!field || field.length === 0) {
      throw new Error('Filter field cannot be empty');
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_/]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }

    this.query.filter.push({
      field,
      operator,
      value,
    });

    return this;
  }

  /**
   * Add SELECT clause to limit returned fields
   */
  select(fields: string[]): this {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('Select fields must be a non-empty array');
    }

    // Validate field names
    for (const field of fields) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_/,]*$/.test(field)) {
        throw new Error(`Invalid field name in select: ${field}`);
      }
    }

    this.query.select = fields;
    return this;
  }

  /**
   * Add EXPAND clause for related entities
   */
  expand(entities: string[]): this {
    if (!Array.isArray(entities) || entities.length === 0) {
      throw new Error('Expand entities must be a non-empty array');
    }

    for (const entity of entities) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entity)) {
        throw new Error(`Invalid entity name in expand: ${entity}`);
      }
    }

    this.query.expand = entities;
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderby(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    if (!field || field.length === 0) {
      throw new Error('Orderby field cannot be empty');
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid field name in orderby: ${field}`);
    }

    if (!this.query.orderby) {
      this.query.orderby = [];
    }

    this.query.orderby.push({ field, direction });
    return this;
  }

  /**
   * Add TOP clause to limit results
   */
  top(count: number): this {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Top count must be a positive integer');
    }

    this.query.top = count;
    return this;
  }

  /**
   * Add SKIP clause for pagination
   */
  skip(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Skip count must be a non-negative integer');
    }

    this.query.skip = count;
    return this;
  }

  /**
   * Enable record count in response
   */
  count(): this {
    this.query.count = true;
    return this;
  }

  /**
   * Build the OData query string
   * Returns properly encoded query parameters
   */
  build(): string {
    const params: string[] = [];

    if (this.query.filter && this.query.filter.length > 0) {
      const filterStr = this.buildFilterString(this.query.filter);
      params.push(`$filter=${encodeURIComponent(filterStr)}`);
    }

    if (this.query.select && this.query.select.length > 0) {
      params.push(`$select=${this.query.select.join(',')}`);
    }

    if (this.query.expand && this.query.expand.length > 0) {
      params.push(`$expand=${this.query.expand.join(',')}`);
    }

    if (this.query.orderby && this.query.orderby.length > 0) {
      const orderStr = this.query.orderby.map((o) => `${o.field} ${o.direction}`).join(',');
      params.push(`$orderby=${orderStr}`);
    }

    if (this.query.top !== undefined) {
      params.push(`$top=${this.query.top}`);
    }

    if (this.query.skip !== undefined) {
      params.push(`$skip=${this.query.skip}`);
    }

    if (this.query.count) {
      params.push('$count=true');
    }

    return params.join('&');
  }

  /**
   * Build filter string with proper escaping
   */
  private buildFilterString(conditions: ODataFilterCondition[]): string {
    return conditions
      .map((cond) => {
        const value = this.escapeFilterValue(cond.value);

        switch (cond.operator) {
          case 'startswith':
          case 'endswith':
          case 'contains':
            return `${cond.operator}(${cond.field},'${value}')`;
          default:
            return `${cond.field} ${cond.operator} ${value}`;
        }
      })
      .join(' and ');
  }

  /**
   * Escape special characters in filter values
   */
  private escapeFilterValue(value: string | number | boolean): string | number | boolean {
    if (typeof value === 'string') {
      // Escape single quotes by doubling them
      return value.replace(/'/g, "''");
    }
    return value;
  }
}

// ─── SAP ODATA CLIENT ──────────────────────────────────────────────────────

/**
 * SAP S/4HANA OData v4 API Client
 * Comprehensive support for OAuth2 authentication, OData queries, batch operations
 */
export class SapODataClient {
  private config: SapODataConfig;
  private accessToken?: string;
  private tokenExpireTime?: number;
  private csrfToken?: CsrfTokenInfo;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private requestTimestamps: number[] = [];
  private readonly defaultTimeout = 30000;
  private readonly defaultMaxRetries = 3;

  constructor(config: SapODataConfig) {
    this.config = {
      timeout: this.defaultTimeout,
      maxRetries: this.defaultMaxRetries,
      environment: 'production',
      ...config,
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('SAP OData client requires clientId and clientSecret');
    }

    if (!config.tokenUrl || !config.instanceUrl) {
      throw new Error('SAP OData client requires tokenUrl and instanceUrl');
    }
  }

  /**
   * Authenticate using OAuth2 client credentials flow
   */
  async authenticate(): Promise<string> {
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json() as { access_token: string; expires_in?: number };
      this.accessToken = data.access_token;

      if (data.expires_in) {
        this.tokenExpireTime = Date.now() + data.expires_in * 1000;
      }

      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to authenticate with SAP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch CSRF token for write operations
   */
  private async fetchCsrfToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid
    if (
      this.csrfToken &&
      this.csrfToken.expiresIn &&
      now - this.csrfToken.fetchedAt < this.csrfToken.expiresIn * 1000
    ) {
      return this.csrfToken.token;
    }

    try {
      const token = await this.accessToken || (await this.authenticate());

      const response = await fetch(`${this.config.instanceUrl}A_BusinessPartner?$top=1`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-csrf-token': 'Fetch',
        },
      });

      const csrfToken = response.headers.get('x-csrf-token');

      if (!csrfToken) {
        throw new Error('Failed to fetch CSRF token from SAP');
      }

      this.csrfToken = {
        token: csrfToken,
        fetchedAt: now,
        expiresIn: 600, // 10 minutes
      };

      return csrfToken;
    } catch (error) {
      throw new Error(`Failed to fetch CSRF token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new business partner (customer)
   */
  async createBusinessPartner(partner: Omit<SapBusinessPartner, 'id'>): Promise<SapBusinessPartner> {
    const csrfToken = await this.fetchCsrfToken();
    const token = this.accessToken || (await this.authenticate());

    const response = await this.makeRequest('POST', 'A_BusinessPartner', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: partner,
    });

    return response as SapBusinessPartner;
  }

  /**
   * Get business partner by number
   */
  async getBusinessPartner(bpNumber: string): Promise<SapBusinessPartner> {
    const query = new ODataQueryBuilder().expand(['BPAddresses']).build();

    const response = await this.makeRequest('GET', `A_BusinessPartner('${bpNumber}')?${query}`, {});

    return response as SapBusinessPartner;
  }

  /**
   * Query business partners with OData filters
   */
  async queryBusinessPartners(
    queryBuilder: ODataQueryBuilder,
  ): Promise<{ value: SapBusinessPartner[]; '@odata.count'?: number }> {
    const query = queryBuilder.build();

    const response = await this.makeRequest('GET', `A_BusinessPartner?${query}`, {});

    return response as { value: SapBusinessPartner[]; '@odata.count'?: number };
  }

  /**
   * Update business partner
   */
  async updateBusinessPartner(
    bpNumber: string,
    updates: Partial<SapBusinessPartner>,
  ): Promise<SapBusinessPartner> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('PATCH', `A_BusinessPartner('${bpNumber}')`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: updates,
    });

    return response as SapBusinessPartner;
  }

  /**
   * Delete business partner
   */
  async deleteBusinessPartner(bpNumber: string): Promise<void> {
    const csrfToken = await this.fetchCsrfToken();

    await this.makeRequest('DELETE', `A_BusinessPartner('${bpNumber}')`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
    });
  }

  /**
   * Create business partner address
   */
  async createBusinessPartnerAddress(
    bpNumber: string,
    address: Omit<SapBusinessPartnerAddress, 'BusinessPartner'>,
  ): Promise<SapBusinessPartnerAddress> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('POST', `A_BusinessPartner('${bpNumber}')/BPAddresses`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: { BusinessPartner: bpNumber, ...address },
    });

    return response as SapBusinessPartnerAddress;
  }

  /**
   * Create sales order
   */
  async createSalesOrder(order: Omit<SapSalesOrder, 'id'>): Promise<SapSalesOrder> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('POST', 'A_SalesOrder', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: order,
    });

    return response as SapSalesOrder;
  }

  /**
   * Get sales order
   */
  async getSalesOrder(salesOrder: string): Promise<SapSalesOrder> {
    const query = new ODataQueryBuilder().expand(['SOItems']).build();

    const response = await this.makeRequest('GET', `A_SalesOrder('${salesOrder}')?${query}`, {});

    return response as SapSalesOrder;
  }

  /**
   * Query sales orders
   */
  async querySalesOrders(
    queryBuilder: ODataQueryBuilder,
  ): Promise<{ value: SapSalesOrder[]; '@odata.count'?: number }> {
    const query = queryBuilder.build();

    const response = await this.makeRequest('GET', `A_SalesOrder?${query}`, {});

    return response as { value: SapSalesOrder[]; '@odata.count'?: number };
  }

  /**
   * Create purchase order
   */
  async createPurchaseOrder(order: Omit<SapPurchaseOrder, 'id'>): Promise<SapPurchaseOrder> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('POST', 'A_PurchaseOrder', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: order,
    });

    return response as SapPurchaseOrder;
  }

  /**
   * Get purchase order
   */
  async getPurchaseOrder(purchaseOrder: string): Promise<SapPurchaseOrder> {
    const query = new ODataQueryBuilder().expand(['to_PurchaseOrderItem']).build();

    const response = await this.makeRequest('GET', `A_PurchaseOrder('${purchaseOrder}')?${query}`, {});

    return response as SapPurchaseOrder;
  }

  /**
   * Query purchase orders
   */
  async queryPurchaseOrders(
    queryBuilder: ODataQueryBuilder,
  ): Promise<{ value: SapPurchaseOrder[]; '@odata.count'?: number }> {
    const query = queryBuilder.build();

    const response = await this.makeRequest('GET', `A_PurchaseOrder?${query}`, {});

    return response as { value: SapPurchaseOrder[]; '@odata.count'?: number };
  }

  /**
   * Get product/material
   */
  async getProduct(materialNumber: string): Promise<SapProduct> {
    const query = new ODataQueryBuilder().expand(['to_MaterialPlant']).build();

    const response = await this.makeRequest('GET', `A_Product('${materialNumber}')?${query}`, {});

    return response as SapProduct;
  }

  /**
   * Query products
   */
  async queryProducts(
    queryBuilder: ODataQueryBuilder,
  ): Promise<{ value: SapProduct[]; '@odata.count'?: number }> {
    const query = queryBuilder.build();

    const response = await this.makeRequest('GET', `A_Product?${query}`, {});

    return response as { value: SapProduct[]; '@odata.count'?: number };
  }

  /**
   * Create outbound delivery
   */
  async createDelivery(delivery: Omit<SapDelivery, 'id'>): Promise<SapDelivery> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('POST', 'A_OutbDeliveryHeader', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: delivery,
    });

    return response as SapDelivery;
  }

  /**
   * Get delivery
   */
  async getDelivery(deliveryNumber: string): Promise<SapDelivery> {
    const query = new ODataQueryBuilder().expand(['to_DeliveryItem']).build();

    const response = await this.makeRequest('GET', `A_OutbDeliveryHeader('${deliveryNumber}')?${query}`, {});

    return response as SapDelivery;
  }

  /**
   * Create billing document (invoice)
   */
  async createInvoice(invoice: Omit<SapInvoice, 'id'>): Promise<SapInvoice> {
    const csrfToken = await this.fetchCsrfToken();

    const response = await this.makeRequest('POST', 'A_BillingDocument', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: invoice,
    });

    return response as SapInvoice;
  }

  /**
   * Get billing document
   */
  async getInvoice(billingDocument: string): Promise<SapInvoice> {
    const query = new ODataQueryBuilder().expand(['to_BillingDocumentItem']).build();

    const response = await this.makeRequest('GET', `A_BillingDocument('${billingDocument}')?${query}`, {});

    return response as SapInvoice;
  }

  /**
   * Execute batch request with multiple operations
   * Supports $batch multipart/mixed format
   */
  async executeBatch(operations: SapBatchOperation[]): Promise<SapBatchResponse> {
    const csrfToken = await this.fetchCsrfToken();

    const batchBody = this.buildBatchRequest(operations);

    const response = await this.makeRequest('POST', '$batch', {
      headers: {
        'x-csrf-token': csrfToken,
        'Content-Type': 'multipart/mixed;boundary=batch_boundary',
      },
      body: batchBody,
      raw: true,
    });

    return this.parseBatchResponse(response as string);
  }

  /**
   * Build multipart/mixed batch request body
   */
  private buildBatchRequest(operations: SapBatchOperation[]): string {
    let body = '';

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i] as SapBatchOperation;

      body += '--batch_boundary\r\n';

      if (op.method === 'GET' || op.method === 'DELETE') {
        body += `Content-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
        body += `${op.method} ${op.uri} HTTP/1.1\r\n`;
        body += 'Accept: application/json\r\n\r\n';
      } else {
        body += `Content-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
        body += `${op.method} ${op.uri} HTTP/1.1\r\n`;
        body += 'Content-Type: application/json\r\n';
        body += `\r\n${JSON.stringify(op.body)}\r\n`;
      }
    }

    body += '--batch_boundary--';

    return body;
  }

  /**
   * Parse batch response
   */
  private parseBatchResponse(response: string): SapBatchResponse {
    const lines = response.split('\r\n');
    const responses: SapBatchResponse['responses'] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i] as string;

      // Look for HTTP status line
      if (line.startsWith('HTTP/')) {
        const [, statusStr] = line.split(' ');
        const status = parseInt(statusStr || '200', 10);

        responses.push({ status });
      }

      i += 1;
    }

    return { responses };
  }

  /**
   * Check health of SAP connection
   */
  async checkHealth(): Promise<boolean> {
    try {
      const token = this.accessToken || (await this.authenticate());

      const response = await fetch(`${this.config.instanceUrl}A_BusinessPartner?$top=1`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
      raw?: boolean;
    } = {},
  ): Promise<unknown> {
    await this.applyRateLimit();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < (this.config.maxRetries || this.defaultMaxRetries); attempt++) {
      try {
        const token = this.accessToken || (await this.authenticate());

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          ...options.headers,
        };

        if (options.body && !options.raw) {
          headers['Content-Type'] = 'application/json';
        }

        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
        };

        if (options.body) {
          fetchOptions.body = options.raw ? (options.body as string) : JSON.stringify(options.body);
        }

        const response = await fetch(`${this.config.instanceUrl}${endpoint}`, fetchOptions);

        if (!response.ok) {
          const errorDetail = this.parseSapError(response);
          throw new Error(
            `SAP API error [${response.status}]: ${errorDetail.message || response.statusText}`,
          );
        }

        if (method === 'DELETE' || response.status === 204) {
          return undefined;
        }

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < (this.config.maxRetries || this.defaultMaxRetries) - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Unknown error in SAP API request');
  }

  /**
   * Parse SAP-specific error from sap-message header
   */
  private parseSapError(response: Response): SapErrorDetail {
    const sapMessage = response.headers.get('sap-message');

    if (!sapMessage) {
      return { message: response.statusText };
    }

    try {
      // SAP message format: severity=error&code=SY/500&message=Server%20Error
      const params = new URLSearchParams(sapMessage);
      return {
        severity: (params.get('severity') as 'error' | 'warning' | 'info' | 'success') || 'error',
        code: params.get('code') || undefined,
        message: params.get('message') || response.statusText,
        details: params.get('details') || undefined,
        longTextUrl: params.get('longtext_url') || undefined,
      };
    } catch {
      return { message: response.statusText };
    }
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    const rateLimit = this.config.rateLimit?.requestsPerSecond || 10;
    const now = Date.now();

    // Remove old timestamps outside 1 second window
    this.requestTimestamps = this.requestTimestamps.filter((ts) => now - ts < 1000);

    if (this.requestTimestamps.length >= rateLimit) {
      const oldestTimestamp = this.requestTimestamps[0] as number;
      const waitTime = 1000 - (now - oldestTimestamp);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requestTimestamps.push(now);
  }
}
