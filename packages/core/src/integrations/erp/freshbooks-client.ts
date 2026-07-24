/**
 * FreshBooks API v3 Client
 * Invoices, expenses, estimates, time tracking, projects, payments, taxes
 * OAuth2 authentication
 */

import type { ERPInvoice, ERPPayment, ERPConnection } from "./types.js";

/**
 * FreshBooks API v3 Client
 */
export class FreshBooksClient {
  private accessToken?: string;
  private accountId?: string;
  private apiUrl: string =
    "https://api.freshbooks.com/accounting_account/account";
  private connection: ERPConnection;

  /**
   * Initialize FreshBooks client
   */
  constructor(connection: ERPConnection) {
    this.connection = connection;
    this.accessToken = connection.credentials.accessToken;
    this.accountId = connection.credentials.accountId;

    if (!this.accessToken || !this.accountId) {
      throw new Error("Missing FreshBooks credentials: accessToken, accountId");
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/invoices?limit=1");
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
      Authorization: `Bearer ${this.accessToken}`,
    };

    const response = await fetch(
      `${this.apiUrl}/${this.accountId}${endpoint}`,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) {
      throw new Error(`FreshBooks API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    const data = {
      invoice: {
        clientid: invoice.customerId,
        invoicenumber: invoice.invoiceNumber,
        invoicedate: invoice.invoiceDate.toISOString().split("T")[0],
        duedate: invoice.dueDate.toISOString().split("T")[0],
        lines: invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.unitPrice,
          amount: item.totalAmount,
        })),
        amount: invoice.total,
        status: invoice.status || "draft",
      },
    };

    const response = await this.request("POST", "/invoices", data);
    return {
      id: response.invoice.id,
      externalId: response.invoice.id,
      invoiceNumber: response.invoice.invoicenumber,
      invoiceDate: new Date(response.invoice.invoicedate),
      dueDate: new Date(response.invoice.duedate),
      customerId: response.invoice.clientid,
      total: response.invoice.amount,
      status: response.invoice.status,
      lineItems: [],
    };
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<ERPInvoice> {
    const response = await this.request("GET", `/invoices/${invoiceId}`);
    const inv = response.invoice;
    return {
      id: inv.id,
      externalId: inv.id,
      invoiceNumber: inv.invoicenumber,
      invoiceDate: new Date(inv.invoicedate),
      dueDate: new Date(inv.duedate),
      customerId: inv.clientid,
      total: inv.amount,
      status: inv.status,
      lineItems: [],
    };
  }

  /**
   * List invoices
   */
  async listInvoices(): Promise<ERPInvoice[]> {
    const response = await this.request("GET", "/invoices");
    return (response.invoices || []).map((inv: any) => ({
      id: inv.id,
      externalId: inv.id,
      invoiceNumber: inv.invoicenumber,
      invoiceDate: new Date(inv.invoicedate),
      dueDate: new Date(inv.duedate),
      customerId: inv.clientid,
      total: inv.amount,
      status: inv.status,
      lineItems: [],
    }));
  }

  /**
   * Record payment
   */
  async recordPayment(invoiceId: string, payment: ERPPayment): Promise<void> {
    const data = {
      payment: {
        invoiceid: invoiceId,
        amount: payment.amount,
        paymentdate: payment.paymentDate.toISOString().split("T")[0],
        paymentmethod: payment.paymentMethod,
      },
    };

    await this.request("POST", "/payments", data);
  }

  /**
   * Create estimate
   */
  async createEstimate(estimate: any): Promise<any> {
    const data = {
      estimate: {
        clientid: estimate.customerId,
        estimatenumber: estimate.estimateNumber,
        estimatedate: estimate.issueDate.toISOString().split("T")[0],
        expirydate: estimate.expiryDate?.toISOString().split("T")[0],
        lines: estimate.lineItems,
        amount: estimate.total,
        status: estimate.status || "draft",
      },
    };

    const response = await this.request("POST", "/estimates", data);
    return response.estimate;
  }

  /**
   * Create expense
   */
  async createExpense(expense: any): Promise<any> {
    const data = {
      expense: {
        accountid: this.accountId,
        categoryid: expense.categoryId,
        amount: expense.amount,
        notes: expense.notes,
        date: expense.date.toISOString().split("T")[0],
        vendor: expense.vendor,
      },
    };

    const response = await this.request("POST", "/expenses", data);
    return response.expense;
  }

  /**
   * Create time entry
   */
  async createTimeEntry(entry: any): Promise<any> {
    const data = {
      timeentry: {
        projectid: entry.projectId,
        taskid: entry.taskId,
        userid: entry.userId,
        hours: entry.hours,
        notes: entry.notes,
        date: entry.date.toISOString().split("T")[0],
      },
    };

    const response = await this.request("POST", "/time_entries", data);
    return response.timeentry;
  }

  /**
   * List projects
   */
  async listProjects(): Promise<any[]> {
    const response = await this.request("GET", "/projects");
    return response.projects || [];
  }

  /**
   * Get project details
   */
  async getProject(projectId: string): Promise<any> {
    const response = await this.request("GET", `/projects/${projectId}`);
    return response.project;
  }

  /**
   * List clients
   */
  async listClients(): Promise<any[]> {
    const response = await this.request("GET", "/clients");
    return response.clients || [];
  }

  /**
   * Create tax
   */
  async createTax(tax: any): Promise<any> {
    const data = {
      tax: {
        name: tax.name,
        number: tax.number,
        percent: tax.percent,
        accountid: this.accountId,
      },
    };

    const response = await this.request("POST", "/taxes", data);
    return response.tax;
  }

  /**
   * List currencies
   */
  async listCurrencies(): Promise<any[]> {
    const response = await this.request("GET", "/currencies");
    return response.currencies || [];
  }
}
