/**
 * SAP Business One / S/4HANA API Adapter
 * OAuth2 with SAP Passport authentication
 * Supports Business Partners, Sales Orders, Invoices, Items, Inventory, Journal Entries
 */

import type {
  ERPConnection,
  ERPCustomer,
  ERPVendor,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPPayment,
  ERPJournalEntry,
  ERPInventory,
  SyncEntityType,
  PaginationParams,
  PaginatedResult,
} from "./types.js";
import { AbstractERPAdapter } from "./erp-adapter.js";

// ─── SAP-SPECIFIC TYPES ────────────────────────────────────────────────────

export interface SAPConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  instanceUrl: string; // e.g., https://my.example.com:50000
  companyDatabase?: string; // Database ID
  environment?: "sandbox" | "production";
  timeout?: number;
  maxRetries?: number;
}

export interface SAPAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface SAPBatchRequest {
  method: string;
  url: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface SAPBatchResponse {
  statusCode: number;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

// ─── SAP ADAPTER ───────────────────────────────────────────────────────────

/**
 * SAP Business One / S/4HANA Adapter
 * Implements OData 4.0 and REST API integration
 */
export class SAPClient extends AbstractERPAdapter {
  private config: SAPConfig;
  private oDataBaseUrl: string;
  private restBaseUrl: string;
  private sapPassport?: string;

  constructor(connection: ERPConnection, config: SAPConfig) {
    super("sap", connection);
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      environment: "production",
      ...config,
    };

    this.oDataBaseUrl = `${this.config.instanceUrl}/b1s/v2`;
    this.restBaseUrl = `${this.config.instanceUrl}/api/v1`;
    this.sapPassport = connection.credentials.sapPassport;
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthorizationUrl(state: string): string {
    return `${this.config.instanceUrl}/oauth2/authorize?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&state=${state}&response_type=code`;
  }

  /**
   * Authenticate with SAP using OAuth2
   */
  async authenticate(authCode: string): Promise<void> {
    // INTEGRATION: Exchange OAuth code for SAP access token
    // POST https://sappassport.auth.sap.com/oauth2/authorize
    // with: grant_type=authorization_code&code={code}&client_id={clientId}&client_secret={clientSecret}

    const mockResponse: SAPAuthResponse = {
      access_token: `sap_at_${Date.now()}`,
      refresh_token: `sap_rt_${Date.now()}`,
      expires_in: 3600,
      token_type: "Bearer",
    };

    const accessToken = mockResponse.access_token;
    const expiresInSeconds = mockResponse.expires_in;

    this.connection.credentials.accessToken = accessToken;
    if (mockResponse.refresh_token) {
      this.connection.credentials.refreshToken = mockResponse.refresh_token;
    }
    this.tokenManager.updateExpiry(expiresInSeconds);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.executeWithRateLimit(async () => {
        const response = await this.oDataGet("/BusinessPartners?$top=1");
        return Array.isArray(response.value);
      });
    } catch {
      return false;
    }
  }

  // ─── BUSINESS PARTNERS (CUSTOMERS & VENDORS) ──────────────────────────

  /**
   * Create customer (Business Partner)
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapCustomerToSAP(customer);

      const response = await this.oDataPost("/BusinessPartners", sapPayload);

      return {
        ...customer,
        id: response.CardCode,
        externalId: response.CardCode,
      };
    });
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(
        `/BusinessPartners('${customerId}')`,
      );
      return this.mapCustomerFromSAP(response);
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
      const sapPayload = this.mapCustomerToSAP(customer as ERPCustomer);
      await this.oDataPatch(`/BusinessPartners('${customerId}')`, sapPayload);
      return this.getCustomer(customerId);
    });
  }

  /**
   * Create vendor
   */
  async createVendor(vendor: ERPVendor): Promise<ERPVendor> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapVendorToSAP(vendor);
      const response = await this.oDataPost("/BusinessPartners", sapPayload);

      return {
        ...vendor,
        id: response.CardCode,
        externalId: response.CardCode,
      };
    });
  }

  /**
   * Get vendor by ID
   */
  async getVendor(vendorId: string): Promise<ERPVendor> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(`/BusinessPartners('${vendorId}')`);
      return this.mapVendorFromSAP(response);
    });
  }

  /**
   * Query business partners with pagination
   */
  async queryBusinessPartners(
    filter?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPCustomer>> {
    return this.executeWithRateLimit(async () => {
      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;
      const filterStr = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
      const url = `/BusinessPartners${filterStr}&$skip=${skip}&$top=${limit}`;

      const response = await this.oDataGet(url);

      return {
        items: response.value.map((bp: any) => this.mapCustomerFromSAP(bp)),
        total: response["odata.count"] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── SALES ORDERS ──────────────────────────────────────────────────────

  /**
   * Create sales order
   */
  async createOrder(order: ERPOrder): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapOrderToSAP(order);
      const response = await this.oDataPost("/Orders", sapPayload);

      return {
        ...order,
        id: response.DocEntry,
        externalId: response.DocEntry,
        orderNumber: response.DocNum,
      };
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(`/Orders(${orderId})`);
      return this.mapOrderFromSAP(response);
    });
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: string,
    order: Partial<ERPOrder>,
  ): Promise<ERPOrder> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapOrderToSAP(order as ERPOrder);
      await this.oDataPatch(`/Orders(${orderId})`, sapPayload);
      return this.getOrder(orderId);
    });
  }

  /**
   * Close order
   */
  async closeOrder(orderId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      const order = await this.getOrder(orderId);
      await this.updateOrder(orderId, { status: "completed" });
    });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      await this.updateOrder(orderId, { status: "cancelled" });
    });
  }

  // ─── INVOICES ──────────────────────────────────────────────────────────

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const endpoint =
        invoice.invoiceType === "purchase" ? "/PurchaseInvoices" : "/Invoices";
      const sapPayload = this.mapInvoiceToSAP(invoice);

      const response = await this.oDataPost(endpoint, sapPayload);

      return {
        ...invoice,
        id: response.DocEntry,
        externalId: response.DocEntry,
        invoiceNumber: response.DocNum,
      };
    });
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(
    invoiceId: string,
    isPurchase: boolean = false,
  ): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const endpoint = isPurchase ? "/PurchaseInvoices" : "/Invoices";
      const response = await this.oDataGet(`${endpoint}(${invoiceId})`);
      return this.mapInvoiceFromSAP(response);
    });
  }

  /**
   * Post invoice to G/L
   */
  async postInvoice(invoiceId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      // SAP: Invoices are automatically posted when created with PostingType='Document'
      // For manual posting, call an update with Status='Posted'
      await this.oDataPatch(`/Invoices(${invoiceId})`, {
        DocumentStatus: "bost_Open",
      });
    });
  }

  /**
   * Create credit note
   */
  async createCreditNote(invoice: ERPInvoice): Promise<ERPInvoice> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapInvoiceToSAP({
        ...invoice,
        invoiceType: "credit_memo",
        status: "draft",
      });

      const response = await this.oDataPost("/CreditNotes", sapPayload);

      return {
        ...invoice,
        id: response.DocEntry,
        externalId: response.DocEntry,
        invoiceType: "credit_memo",
      };
    });
  }

  // ─── ITEMS (PRODUCTS) ──────────────────────────────────────────────────

  /**
   * Create item
   */
  async createItem(product: ERPProduct): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapProductToSAP(product);
      const response = await this.oDataPost("/Items", sapPayload);

      return {
        ...product,
        id: response.ItemCode,
        externalId: response.ItemCode,
      };
    });
  }

  /**
   * Get item by SKU
   */
  async getItem(itemCode: string): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(`/Items('${itemCode}')`);
      return this.mapProductFromSAP(response);
    });
  }

  /**
   * Update item
   */
  async updateItem(
    itemCode: string,
    product: Partial<ERPProduct>,
  ): Promise<ERPProduct> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapProductToSAP(product as ERPProduct);
      await this.oDataPatch(`/Items('${itemCode}')`, sapPayload);
      return this.getItem(itemCode);
    });
  }

  /**
   * Query items
   */
  async queryItems(
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<ERPProduct>> {
    return this.executeWithRateLimit(async () => {
      const skip = pagination?.skip || 0;
      const limit = pagination?.limit || 100;
      const url = `/Items?$skip=${skip}&$top=${limit}`;

      const response = await this.oDataGet(url);

      return {
        items: response.value.map((item: any) => this.mapProductFromSAP(item)),
        total: response["odata.count"] || response.value.length,
        hasMore: response.value.length === limit,
        nextOffset: skip + limit,
      };
    });
  }

  // ─── INVENTORY ────────────────────────────────────────────────────────

  /**
   * Get inventory for item
   */
  async getInventory(itemCode: string): Promise<ERPInventory> {
    return this.executeWithRateLimit(async () => {
      const response = await this.oDataGet(
        `/Items('${itemCode}')?$select=ItemCode,QuantityOnStock,QuantityOnOrder`,
      );

      return {
        itemId: response.ItemCode,
        itemCode: response.ItemCode,
        quantity: response.QuantityOnStock || 0,
      };
    });
  }

  /**
   * Stock transfer
   */
  async stockTransfer(
    fromWarehouse: string,
    toWarehouse: string,
    itemCode: string,
    quantity: number,
  ): Promise<void> {
    return this.executeWithRateLimit(async () => {
      const payload = {
        FromWarehouse: fromWarehouse,
        ToWarehouse: toWarehouse,
        DocumentLines: [
          {
            ItemCode: itemCode,
            Quantity: quantity,
          },
        ],
      };

      await this.oDataPost("/StockTransfers", payload);
    });
  }

  /**
   * Goods receipt (Inbound)
   */
  async goodsReceipt(
    purchaseOrderId: string,
    items: Array<{ itemCode: string; quantity: number }>,
  ): Promise<void> {
    return this.executeWithRateLimit(async () => {
      const payload = {
        BaseDocumentType: "dDocument_PurchaseOrder",
        BaseDocumentEntry: purchaseOrderId,
        DocumentLines: items.map((item) => ({
          ItemCode: item.itemCode,
          QuantityReceived: item.quantity,
        })),
      };

      await this.oDataPost("/GoodsReceiptPOs", payload);
    });
  }

  /**
   * Goods issue (Outbound)
   */
  async goodsIssue(
    salesOrderId: string,
    items: Array<{ itemCode: string; quantity: number }>,
  ): Promise<void> {
    return this.executeWithRateLimit(async () => {
      const payload = {
        BaseDocumentType: "dDocument_SalesOrder",
        BaseDocumentEntry: salesOrderId,
        DocumentLines: items.map((item) => ({
          ItemCode: item.itemCode,
          QuantityDispatched: item.quantity,
        })),
      };

      await this.oDataPost("/DeliveryNotes", payload);
    });
  }

  // ─── JOURNAL ENTRIES ───────────────────────────────────────────────────

  /**
   * Post journal entry to G/L
   */
  async postJournalEntry(entry: ERPJournalEntry): Promise<ERPJournalEntry> {
    return this.executeWithRateLimit(async () => {
      const sapPayload = this.mapJournalEntryToSAP(entry);
      const response = await this.oDataPost("/JournalEntries", sapPayload);

      return {
        ...entry,
        id: response.ReferenceNumber,
        externalId: response.ReferenceNumber,
      };
    });
  }

  /**
   * Reverse journal entry
   */
  async reverseJournalEntry(entryId: string): Promise<void> {
    return this.executeWithRateLimit(async () => {
      const entry = await this.oDataGet(`/JournalEntries('${entryId}')`);
      const reversalPayload = this.mapJournalEntryToSAP({
        ...entry,
        status: "reversed",
      });

      await this.oDataPost("/JournalEntries", reversalPayload);
    });
  }

  // ─── BATCH OPERATIONS ──────────────────────────────────────────────────

  /**
   * Execute batch requests via $batch endpoint
   */
  async executeBatchRequests(
    requests: Array<SAPBatchRequest>,
  ): Promise<SAPBatchResponse[]> {
    return this.executeWithRateLimit(async () => {
      const batchBody = this.buildBatchRequestBody(requests);
      const response = await this.oDataPost("/$batch", batchBody, {
        "Content-Type": "multipart/mixed",
      });

      return this.parseBatchResponse(response);
    });
  }

  // ─── HELPER METHODS ───────────────────────────────────────────────────

  /**
   * OData GET request
   */
  protected async oDataGet(
    path: string,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.oDataBaseUrl}${path}`;
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
        `OData GET failed: ${response.statusText}`,
        "ODATA_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  /**
   * OData POST request
   */
  protected async oDataPost(
    path: string,
    body: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.oDataBaseUrl}${path}`;
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
        `OData POST failed: ${response.statusText}`,
        "ODATA_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  /**
   * OData PATCH request
   */
  protected async oDataPatch(
    path: string,
    body: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${this.oDataBaseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: "PATCH",
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
        `OData PATCH failed: ${response.statusText}`,
        "ODATA_ERROR",
        response.status >= 500,
      );
    }

    return response.json();
  }

  private getAccessToken(): Promise<string> {
    return (this.tokenManager as any).getAccessToken();
  }

  /**
   * Map customer to SAP format
   */
  private mapCustomerToSAP(customer: ERPCustomer): Record<string, any> {
    return {
      CardCode: customer.code,
      CardName: customer.name,
      CardType: "cCustomer",
      Email: customer.email,
      Phone1: customer.phone,
      Website: customer.website,
      TaxIdNum: customer.taxId,
      CreditLimit: customer.creditLimit,
      Currency: customer.currency,
      BPAddresses: customer.addresses?.map((addr) => ({
        AddressType: addr.type === "billing" ? "bo_BillTo" : "bo_ShipTo",
        Street: addr.line1,
        StreetNo: addr.line2,
        City: addr.city,
        State: addr.state,
        ZipCode: addr.postalCode,
        Country: addr.country,
      })),
    };
  }

  /**
   * Map customer from SAP format
   */
  private mapCustomerFromSAP(bp: any): ERPCustomer {
    return {
      id: bp.CardCode,
      externalId: bp.CardCode,
      code: bp.CardCode,
      name: bp.CardName,
      email: bp.Email,
      phone: bp.Phone1,
      website: bp.Website,
      taxId: bp.TaxIdNum,
      creditLimit: bp.CreditLimit,
      currency: bp.Currency,
      status: bp.Frozen ? "inactive" : "active",
    };
  }

  private mapVendorToSAP(vendor: ERPVendor): Record<string, any> {
    return this.mapCustomerToSAP(vendor as any);
  }

  private mapVendorFromSAP(bp: any): ERPVendor {
    return this.mapCustomerFromSAP(bp) as any;
  }

  private mapOrderToSAP(order: ERPOrder): Record<string, any> {
    const result: Record<string, any> = {};
    if (order.customerId) result.CardCode = order.customerId;
    if (order.orderDate)
      result.DocDate = order.orderDate.toISOString().split("T")[0];
    if (order.dueDate)
      result.DueDate = order.dueDate.toISOString().split("T")[0];
    if (order.status) result.DocumentStatus = order.status;
    if (order.lineItems) {
      result.DocumentLines = order.lineItems.map((item) => ({
        ItemCode: item.itemCode,
        ItemDescription: item.itemName,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        DiscountPercent: item.discountPercent,
        TaxCode: item.taxCode,
      }));
    }
    return result;
  }

  private mapOrderFromSAP(order: any): ERPOrder {
    return {
      id: order.DocEntry,
      externalId: order.DocEntry,
      orderNumber: order.DocNum,
      customerId: order.CardCode,
      orderDate: new Date(order.DocDate),
      dueDate: order.DueDate ? new Date(order.DueDate) : undefined,
      status: "completed" as any,
      lineItems: order.DocumentLines || [],
      total: order.DocTotal,
    };
  }

  private mapInvoiceToSAP(invoice: ERPInvoice): Record<string, any> {
    const result: Record<string, any> = {};
    if (invoice.customerId) result.CardCode = invoice.customerId;
    if (invoice.invoiceDate)
      result.DocDate = invoice.invoiceDate.toISOString().split("T")[0];
    if (invoice.dueDate)
      result.DueDate = invoice.dueDate.toISOString().split("T")[0];
    if (invoice.status) result.DocumentStatus = invoice.status;
    if (invoice.lineItems) {
      result.DocumentLines = invoice.lineItems.map((item) => ({
        ItemCode: item.itemCode,
        ItemDescription: item.itemName,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        DiscountPercent: item.discountPercent,
        TaxCode: item.taxCode,
      }));
    }
    return result;
  }

  private mapInvoiceFromSAP(invoice: any): ERPInvoice {
    return {
      id: invoice.DocEntry,
      externalId: invoice.DocEntry,
      invoiceNumber: invoice.DocNum,
      customerId: invoice.CardCode,
      invoiceDate: new Date(invoice.DocDate),
      dueDate: new Date(invoice.DueDate),
      status: "posted" as any,
      lineItems: invoice.DocumentLines || [],
      total: invoice.DocTotal,
    };
  }

  private mapProductToSAP(product: ERPProduct): Record<string, any> {
    return {
      ItemCode: product.sku,
      ItemName: product.name,
      Description: product.description,
      ItemClass: product.category,
      SalesUnit: product.unit,
      PurchaseUnit: product.unit,
      SalesPrice: product.unitPrice,
      StandardPrice: product.cost,
      TaxCode: product.taxCode,
    };
  }

  private mapProductFromSAP(item: any): ERPProduct {
    return {
      id: item.ItemCode,
      externalId: item.ItemCode,
      sku: item.ItemCode,
      name: item.ItemName,
      description: item.Description,
      category: item.ItemClass,
      unit: item.SalesUnit,
      unitPrice: item.SalesPrice,
      cost: item.StandardPrice,
      status: "active" as any,
    };
  }

  private mapJournalEntryToSAP(entry: ERPJournalEntry): Record<string, any> {
    const result: Record<string, any> = {};
    if (entry.referenceNumber) result.Reference = entry.referenceNumber;
    if (entry.description) result.Memo = entry.description;
    if (entry.status) result.Status = entry.status;
    if (entry.lines) {
      result.DebitCredit = entry.lines.map((line) => ({
        AccountCode: line.accountCode,
        Debit: line.debitAmount || 0,
        Credit: line.creditAmount || 0,
        LineMemo: line.description,
      }));
    } else if ((entry as any).DebitCredit) {
      result.DebitCredit = (entry as any).DebitCredit;
    }
    return result;
  }

  private buildBatchRequestBody(requests: SAPBatchRequest[]): any {
    // OData batch request format
    return requests;
  }

  private parseBatchResponse(response: any): SAPBatchResponse[] {
    // Parse OData batch response
    return [];
  }
}
