/**
 * Epicor Kinetic REST API Client
 * Sales/purchase orders, job management, inventory, warehouse, BAQ queries
 * OAuth2 + API key authentication
 */

import type {
  ERPOrder,
  ERPInvoice,
  ERPProduct,
  ERPInventory,
  ERPConnection,
} from "./types.js";

/**
 * Epicor Kinetic API Client
 */
export class EpicorClient {
  private accessToken?: string;
  private apiKey?: string;
  private apiUrl: string = "https://api.epicor.com/kinetic/v1";
  private connection: ERPConnection;

  /**
   * Initialize Epicor client
   */
  constructor(connection: ERPConnection) {
    this.connection = connection;
    this.accessToken = connection.credentials.accessToken;
    this.apiKey = connection.credentials.apiKey;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/companies?pageSize=1");
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Epicor API error: ${response.statusText}`);
    }

    return response.json();
  }

  // ─── SALES ORDER MANAGEMENT ────────────────────────────────────────────────

  /**
   * Create sales order
   */
  async createSalesOrder(order: ERPOrder): Promise<ERPOrder> {
    const data = {
      orderNum: order.orderNumber,
      orderDate: order.orderDate,
      dueDate: order.dueDate,
      custID: order.customerId,
      lines: order.lineItems,
      orderTotal: order.total,
      orderStatus: order.status || "Open",
    };

    const response = await this.request("POST", "/sales-orders", data);
    return {
      id: response.orderID,
      externalId: response.orderID,
      orderNumber: response.orderNum,
      orderDate: new Date(response.orderDate),
      customerId: response.custID,
      total: response.orderTotal,
      status: response.orderStatus,
      lineItems: [],
    };
  }

  /**
   * Get sales order
   */
  async getSalesOrder(orderId: string): Promise<ERPOrder> {
    const response = await this.request("GET", `/sales-orders/${orderId}`);
    return {
      id: response.orderID,
      externalId: response.orderID,
      orderNumber: response.orderNum,
      orderDate: new Date(response.orderDate),
      customerId: response.custID,
      total: response.orderTotal,
      status: response.orderStatus,
      lineItems: [],
    };
  }

  /**
   * List sales orders
   */
  async listSalesOrders(): Promise<ERPOrder[]> {
    const response = await this.request("GET", "/sales-orders");
    return (response.value || []).map((o: any) => ({
      id: o.orderID,
      externalId: o.orderID,
      orderNumber: o.orderNum,
      orderDate: new Date(o.orderDate),
      customerId: o.custID,
      total: o.orderTotal,
      status: o.orderStatus,
    }));
  }

  // ─── PURCHASE ORDER MANAGEMENT ──────────────────────────────────────────────

  /**
   * Create purchase order
   */
  async createPurchaseOrder(order: ERPOrder): Promise<ERPOrder> {
    const data = {
      poNum: order.orderNumber,
      poDate: order.orderDate,
      dueDate: order.dueDate,
      vendorID: order.customerId,
      lines: order.lineItems,
      poTotal: order.total,
      poStatus: order.status || "Open",
    };

    const response = await this.request("POST", "/purchase-orders", data);
    return {
      id: response.poID,
      externalId: response.poID,
      orderNumber: response.poNum,
      orderDate: new Date(response.poDate),
      customerId: response.vendorID,
      total: response.poTotal,
      status: response.poStatus,
      lineItems: [],
    };
  }

  /**
   * Get purchase order
   */
  async getPurchaseOrder(poId: string): Promise<ERPOrder> {
    const response = await this.request("GET", `/purchase-orders/${poId}`);
    return {
      id: response.poID,
      externalId: response.poID,
      orderNumber: response.poNum,
      orderDate: new Date(response.poDate),
      customerId: response.vendorID,
      total: response.poTotal,
      status: response.poStatus,
      lineItems: [],
    };
  }

  // ─── JOB MANAGEMENT ────────────────────────────────────────────────────────

  /**
   * Create job
   */
  async createJob(jobData: any): Promise<any> {
    const data = {
      jobNum: jobData.jobNumber,
      jobStatus: jobData.status || "Open",
      jobDescription: jobData.description,
      projectID: jobData.projectId,
    };

    const response = await this.request("POST", "/jobs", data);
    return response;
  }

  /**
   * Get job
   */
  async getJob(jobId: string): Promise<any> {
    const response = await this.request("GET", `/jobs/${jobId}`);
    return response;
  }

  /**
   * Schedule job
   */
  async scheduleJob(
    jobId: string,
    resourceId: string,
    startDate: Date,
  ): Promise<any> {
    const data = {
      resourceID: resourceId,
      startDate,
      allocPercent: 100,
    };

    const response = await this.request(
      "POST",
      `/jobs/${jobId}/scheduling`,
      data,
    );
    return response;
  }

  // ─── INVENTORY MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get inventory
   */
  async getInventory(
    partNum: string,
    warehouse?: string,
  ): Promise<ERPInventory> {
    const endpoint = warehouse
      ? `/inventory/parts/${partNum}?warehouse=${warehouse}`
      : `/inventory/parts/${partNum}`;

    const response = await this.request("GET", endpoint);
    return {
      id: response.inventoryID,
      itemId: response.partNum,
      itemCode: response.partNum,
      warehouse: response.warehouse,
      quantity: response.onHandQty,
      unit: response.uOM,
    };
  }

  /**
   * List inventory
   */
  async listInventory(): Promise<ERPInventory[]> {
    const response = await this.request("GET", "/inventory/parts");
    return (response.value || []).map((inv: any) => ({
      id: inv.inventoryID,
      itemId: inv.partNum,
      itemCode: inv.partNum,
      quantity: inv.onHandQty,
      unit: inv.uOM,
    }));
  }

  /**
   * Transfer inventory
   */
  async transferInventory(
    partNum: string,
    fromWarehouse: string,
    toWarehouse: string,
    quantity: number,
  ): Promise<void> {
    const data = {
      partNum,
      fromWarehouse,
      toWarehouse,
      transferQty: quantity,
    };

    await this.request("POST", "/inventory/transfers", data);
  }

  // ─── WAREHOUSE MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get warehouse
   */
  async getWarehouse(warehouseId: string): Promise<any> {
    const response = await this.request("GET", `/warehouses/${warehouseId}`);
    return response;
  }

  /**
   * List warehouses
   */
  async listWarehouses(): Promise<any[]> {
    const response = await this.request("GET", "/warehouses");
    return response.value || [];
  }

  /**
   * Get warehouse bins
   */
  async getWarehouseBins(warehouseId: string): Promise<any[]> {
    const response = await this.request(
      "GET",
      `/warehouses/${warehouseId}/bins`,
    );
    return response.value || [];
  }

  // ─── BAQ (BUSINESS ACTIVITY QUERIES) ────────────────────────────────────────

  /**
   * Execute BAQ
   */
  async executeBAQ(
    baqId: string,
    parameters?: Record<string, unknown>,
  ): Promise<any> {
    const data = { baqID: baqId, parameters };
    const response = await this.request("POST", "/baqs/execute", data);
    return response;
  }

  /**
   * Get BAQ results
   */
  async getBAQResults(executionId: string): Promise<any[]> {
    const response = await this.request("GET", `/baqs/results/${executionId}`);
    return response.value || [];
  }

  /**
   * List BAQs
   */
  async listBAQs(): Promise<any[]> {
    const response = await this.request("GET", "/baqs");
    return response.value || [];
  }

  // ─── REPORTING ─────────────────────────────────────────────────────────────

  /**
   * Get sales analysis
   */
  async getSalesAnalysis(startDate: Date, endDate: Date): Promise<any> {
    const queryParams = new URLSearchParams({
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });

    const response = await this.request(
      "GET",
      `/reports/sales-analysis?${queryParams}`,
    );
    return response;
  }

  /**
   * Get inventory report
   */
  async getInventoryReport(): Promise<any> {
    const response = await this.request("GET", "/reports/inventory-valuation");
    return response;
  }

  /**
   * Get production scheduling
   */
  async getProductionSchedule(jobId?: string): Promise<any> {
    const endpoint = jobId
      ? `/production-schedule?jobNum=${jobId}`
      : "/production-schedule";
    const response = await this.request("GET", endpoint);
    return response;
  }
}
