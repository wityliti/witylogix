/**
 * Infor CloudSuite API Client
 * ERP data sync: GL, AP, AR, inventory, supply chain, asset management, document management
 * OAuth2 authentication with Infor IMS
 */

import type {
  ERPCustomer,
  ERPVendor,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPPayment,
  ERPJournalEntry,
  ERPInventory,
  ERPConnection,
} from "./types.js";

/**
 * Infor CloudSuite API Client
 */
export class InforClient {
  private accessToken?: string;
  private apiUrl: string = "https://infor-api.inforcloud.com/v1";
  private connection: ERPConnection;

  /**
   * Initialize Infor client
   */
  constructor(connection: ERPConnection) {
    this.connection = connection;
    if (connection.credentials.accessToken) {
      this.accessToken = connection.credentials.accessToken;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/companies?limit=1");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request
   */
  private async request(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Infor API error: ${response.statusText}`);
    }

    return response.json();
  }

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    const data = {
      customerCode: customer.code,
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      taxId: customer.taxId,
      creditLimit: customer.creditLimit,
      paymentTerms: customer.paymentTerms,
      status: customer.status || "active",
      addresses: customer.addresses,
    };

    const response = await this.request("POST", "/customers", data);
    return {
      id: response.customerId,
      externalId: response.customerId,
      code: response.customerCode,
      name: response.customerName,
      email: response.email,
      phone: response.phone,
      taxId: response.taxId,
      creditLimit: response.creditLimit,
      status: response.status,
    };
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    const response = await this.request("GET", `/customers/${customerId}`);
    return {
      id: response.customerId,
      externalId: response.customerId,
      code: response.customerCode,
      name: response.customerName,
      email: response.email,
      phone: response.phone,
      status: response.status,
    };
  }

  /**
   * List customers
   */
  async listCustomers(): Promise<ERPCustomer[]> {
    const response = await this.request("GET", "/customers");
    return (response.customers || []).map((cust: any) => ({
      id: cust.customerId,
      externalId: cust.customerId,
      code: cust.customerCode,
      name: cust.customerName,
      email: cust.email,
      phone: cust.phone,
      status: cust.status,
    }));
  }

  // ─── VENDOR MANAGEMENT ─────────────────────────────────────────────────────

  /**
   * Create vendor
   */
  async createVendor(vendor: ERPVendor): Promise<ERPVendor> {
    const data = {
      vendorCode: vendor.code,
      vendorName: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      taxId: vendor.taxId,
      paymentTerms: vendor.paymentTerms,
      status: vendor.status || "active",
    };

    const response = await this.request("POST", "/vendors", data);
    return {
      id: response.vendorId,
      externalId: response.vendorId,
      code: response.vendorCode,
      name: response.vendorName,
      email: response.email,
      phone: response.phone,
      status: response.status,
    };
  }

  /**
   * Get vendor
   */
  async getVendor(vendorId: string): Promise<ERPVendor> {
    const response = await this.request("GET", `/vendors/${vendorId}`);
    return {
      id: response.vendorId,
      externalId: response.vendorId,
      code: response.vendorCode,
      name: response.vendorName,
      email: response.email,
      status: response.status,
    };
  }

  /**
   * List vendors
   */
  async listVendors(): Promise<ERPVendor[]> {
    const response = await this.request("GET", "/vendors");
    return (response.vendors || []).map((v: any) => ({
      id: v.vendorId,
      externalId: v.vendorId,
      code: v.vendorCode,
      name: v.vendorName,
      email: v.email,
      status: v.status,
    }));
  }

  // ─── PRODUCT MANAGEMENT ────────────────────────────────────────────────────

  /**
   * Create product
   */
  async createProduct(product: ERPProduct): Promise<ERPProduct> {
    const data = {
      itemCode: product.sku,
      itemName: product.name,
      description: product.description,
      category: product.category,
      unitPrice: product.unitPrice,
      cost: product.cost,
      status: product.status || "active",
      taxCode: product.taxCode,
    };

    const response = await this.request("POST", "/products", data);
    return {
      id: response.itemId,
      externalId: response.itemId,
      sku: response.itemCode,
      name: response.itemName,
      unitPrice: response.unitPrice,
      cost: response.cost,
      status: response.status,
    };
  }

  /**
   * Get product
   */
  async getProduct(productId: string): Promise<ERPProduct> {
    const response = await this.request("GET", `/products/${productId}`);
    return {
      id: response.itemId,
      externalId: response.itemId,
      sku: response.itemCode,
      name: response.itemName,
      unitPrice: response.unitPrice,
      cost: response.cost,
      status: response.status,
    };
  }

  /**
   * List products
   */
  async listProducts(): Promise<ERPProduct[]> {
    const response = await this.request("GET", "/products");
    return (response.items || []).map((item: any) => ({
      id: item.itemId,
      externalId: item.itemId,
      sku: item.itemCode,
      name: item.itemName,
      unitPrice: item.unitPrice,
      cost: item.cost,
      status: item.status,
    }));
  }

  // ─── ORDER MANAGEMENT ──────────────────────────────────────────────────────

  /**
   * Create sales order
   */
  async createOrder(order: ERPOrder): Promise<ERPOrder> {
    const data = {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      customerId: order.customerId,
      lineItems: order.lineItems,
      total: order.total,
      status: order.status || "pending",
    };

    const response = await this.request("POST", "/orders", data);
    return {
      id: response.orderId,
      externalId: response.orderId,
      orderNumber: response.orderNumber,
      orderDate: new Date(response.orderDate),
      customerId: response.customerId,
      total: response.total,
      status: response.status,
      lineItems: [],
    };
  }

  /**
   * Get order
   */
  async getOrder(orderId: string): Promise<ERPOrder> {
    const response = await this.request("GET", `/orders/${orderId}`);
    return {
      id: response.orderId,
      externalId: response.orderId,
      orderNumber: response.orderNumber,
      orderDate: new Date(response.orderDate),
      customerId: response.customerId,
      total: response.total,
      status: response.status,
      lineItems: [],
    };
  }

  /**
   * List orders
   */
  async listOrders(): Promise<ERPOrder[]> {
    const response = await this.request("GET", "/orders");
    return (response.orders || []).map((o: any) => ({
      id: o.orderId,
      externalId: o.orderId,
      orderNumber: o.orderNumber,
      orderDate: new Date(o.orderDate),
      customerId: o.customerId,
      total: o.total,
      status: o.status,
    }));
  }

  // ─── INVOICE MANAGEMENT ────────────────────────────────────────────────────

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    const data = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      customerId: invoice.customerId,
      lineItems: invoice.lineItems,
      total: invoice.total,
      status: invoice.status || "draft",
    };

    const response = await this.request("POST", "/invoices", data);
    return {
      id: response.invoiceId,
      externalId: response.invoiceId,
      invoiceNumber: response.invoiceNumber,
      invoiceDate: new Date(response.invoiceDate),
      dueDate: new Date(response.dueDate),
      customerId: response.customerId,
      total: response.total,
      status: response.status,
      lineItems: [],
    };
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<ERPInvoice> {
    const response = await this.request("GET", `/invoices/${invoiceId}`);
    return {
      id: response.invoiceId,
      externalId: response.invoiceId,
      invoiceNumber: response.invoiceNumber,
      invoiceDate: new Date(response.invoiceDate),
      dueDate: new Date(response.dueDate),
      customerId: response.customerId,
      total: response.total,
      status: response.status,
      lineItems: [],
    };
  }

  /**
   * List invoices
   */
  async listInvoices(): Promise<ERPInvoice[]> {
    const response = await this.request("GET", "/invoices");
    return (response.invoices || []).map((inv: any) => ({
      id: inv.invoiceId,
      externalId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate),
      dueDate: new Date(inv.dueDate),
      customerId: inv.customerId,
      total: inv.total,
      status: inv.status,
    }));
  }

  // ─── GENERAL LEDGER ────────────────────────────────────────────────────────

  /**
   * Post journal entry
   */
  async postJournalEntry(entry: ERPJournalEntry): Promise<ERPJournalEntry> {
    const data = {
      transactionDate: entry.transactionDate,
      description: entry.description,
      lines: entry.lines,
      status: entry.status || "draft",
    };

    const response = await this.request("POST", "/journal-entries", data);
    return {
      id: response.journalId,
      externalId: response.journalId,
      referenceNumber: response.referenceNumber,
      transactionDate: new Date(response.transactionDate),
      status: response.status,
      lines: [],
    };
  }

  /**
   * Get journal entry
   */
  async getJournalEntry(journalId: string): Promise<ERPJournalEntry> {
    const response = await this.request("GET", `/journal-entries/${journalId}`);
    return {
      id: response.journalId,
      externalId: response.journalId,
      referenceNumber: response.referenceNumber,
      transactionDate: new Date(response.transactionDate),
      status: response.status,
      lines: [],
    };
  }

  // ─── INVENTORY MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get inventory
   */
  async getInventory(
    itemId: string,
    warehouse?: string,
  ): Promise<ERPInventory> {
    const endpoint = warehouse
      ? `/inventory/${itemId}?warehouse=${warehouse}`
      : `/inventory/${itemId}`;
    const response = await this.request("GET", endpoint);
    return {
      id: response.inventoryId,
      itemId: response.itemId,
      itemCode: response.itemCode,
      warehouse: response.warehouse,
      quantity: response.quantity,
      unit: response.unit,
    };
  }

  /**
   * List inventory
   */
  async listInventory(): Promise<ERPInventory[]> {
    const response = await this.request("GET", "/inventory");
    return (response.inventory || []).map((inv: any) => ({
      id: inv.inventoryId,
      itemId: inv.itemId,
      itemCode: inv.itemCode,
      quantity: inv.quantity,
      unit: inv.unit,
    }));
  }

  /**
   * Adjust inventory
   */
  async adjustInventory(
    itemId: string,
    quantity: number,
    reason: string,
  ): Promise<void> {
    const data = { itemId, quantity, reason };
    await this.request("POST", "/inventory/adjustments", data);
  }
}
