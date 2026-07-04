/**
 * Wave GraphQL API Client
 * Invoices, customers, products, transactions, accounts, taxes, receipt scanning
 * OAuth2 authentication
 */

import type {
  ERPInvoice,
  ERPCustomer,
  ERPProduct,
  ERPConnection,
} from "./types.js";

/**
 * Wave GraphQL API Client
 */
export class WaveClient {
  private accessToken?: string;
  private businessId?: string;
  private apiUrl: string = "https://gql.waveapps.com/graphql/public";
  private connection: ERPConnection;

  /**
   * Initialize Wave client
   */
  constructor(connection: ERPConnection) {
    this.connection = connection;
    this.accessToken = connection.credentials.accessToken;
    this.businessId = connection.credentials.organizationId;

    if (!this.accessToken || !this.businessId) {
      throw new Error("Missing Wave credentials: accessToken, organizationId");
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `
        query {
          business(id: "${this.businessId}") {
            id
          }
        }
      `;
      await this.graphqlRequest(query);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * GraphQL request helper
   */
  private async graphqlRequest(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<any> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Wave API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0]?.message}`);
    }

    return data.data;
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: ERPInvoice): Promise<ERPInvoice> {
    const query = `
      mutation CreateInvoice($input: InvoiceCreateInput!) {
        invoiceCreate(input: $input) {
          invoice {
            id
            invoiceNumber
            invoiceDate
            dueDate
            total
            customer { id name }
            status
          }
        }
      }
    `;

    const variables = {
      input: {
        customerId: invoice.customerId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
        dueDate: invoice.dueDate.toISOString().split("T")[0],
        items: invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        total: invoice.total,
      },
    };

    const result = await this.graphqlRequest(query, variables);
    const inv = result.invoiceCreate.invoice;

    return {
      id: inv.id,
      externalId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate),
      dueDate: new Date(inv.dueDate),
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      total: inv.total,
      status: inv.status,
      lineItems: [],
    };
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<ERPInvoice> {
    const query = `
      query GetInvoice($id: ID!) {
        invoice(id: $id) {
          id
          invoiceNumber
          invoiceDate
          dueDate
          total
          customer { id name }
          status
        }
      }
    `;

    const result = await this.graphqlRequest(query, { id: invoiceId });
    const inv = result.invoice;

    return {
      id: inv.id,
      externalId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate),
      dueDate: new Date(inv.dueDate),
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      total: inv.total,
      status: inv.status,
      lineItems: [],
    };
  }

  /**
   * List invoices
   */
  async listInvoices(): Promise<ERPInvoice[]> {
    const query = `
      query ListInvoices($businessId: ID!) {
        invoices(first: 100, businessId: $businessId) {
          edges {
            node {
              id
              invoiceNumber
              invoiceDate
              dueDate
              total
              customer { id name }
              status
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      businessId: this.businessId,
    });
    return result.invoices.edges.map((edge: any) => {
      const inv = edge.node;
      return {
        id: inv.id,
        externalId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: new Date(inv.invoiceDate),
        dueDate: new Date(inv.dueDate),
        customerId: inv.customer.id,
        customerName: inv.customer.name,
        total: inv.total,
        status: inv.status,
      };
    });
  }

  /**
   * Create customer
   */
  async createCustomer(customer: ERPCustomer): Promise<ERPCustomer> {
    const query = `
      mutation CreateCustomer($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer {
            id
            name
            email
            phone
          }
        }
      }
    `;

    const variables = {
      input: {
        businessId: this.businessId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    };

    const result = await this.graphqlRequest(query, variables);
    const cust = result.customerCreate.customer;

    return {
      id: cust.id,
      externalId: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      status: "active",
    };
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<ERPCustomer> {
    const query = `
      query GetCustomer($id: ID!) {
        customer(id: $id) {
          id
          name
          email
          phone
        }
      }
    `;

    const result = await this.graphqlRequest(query, { id: customerId });
    const cust = result.customer;

    return {
      id: cust.id,
      externalId: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      status: "active",
    };
  }

  /**
   * List customers
   */
  async listCustomers(): Promise<ERPCustomer[]> {
    const query = `
      query ListCustomers($businessId: ID!) {
        customers(first: 100, businessId: $businessId) {
          edges {
            node {
              id
              name
              email
              phone
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      businessId: this.businessId,
    });
    return result.customers.edges.map((edge: any) => {
      const cust = edge.node;
      return {
        id: cust.id,
        externalId: cust.id,
        name: cust.name,
        email: cust.email,
        phone: cust.phone,
        status: "active",
      };
    });
  }

  /**
   * Record payment
   */
  async recordPayment(invoiceId: string, amount: number): Promise<void> {
    const query = `
      mutation RecordPayment($input: PaymentRecordInput!) {
        paymentRecord(input: $input) {
          payment {
            id
            amount
            date
          }
        }
      }
    `;

    const variables = {
      input: {
        invoiceId,
        amount,
        date: new Date().toISOString().split("T")[0],
      },
    };

    await this.graphqlRequest(query, variables);
  }

  /**
   * Create product
   */
  async createProduct(product: ERPProduct): Promise<ERPProduct> {
    const query = `
      mutation CreateProduct($input: ProductCreateInput!) {
        productCreate(input: $input) {
          product {
            id
            name
            description
            unitPrice
          }
        }
      }
    `;

    const variables = {
      input: {
        businessId: this.businessId,
        name: product.name,
        description: product.description,
        unitPrice: product.unitPrice,
      },
    };

    const result = await this.graphqlRequest(query, variables);
    const prod = result.productCreate.product;

    return {
      id: prod.id,
      externalId: prod.id,
      sku: product.sku,
      name: prod.name,
      description: prod.description,
      unitPrice: prod.unitPrice,
      status: "active",
    };
  }

  /**
   * List products
   */
  async listProducts(): Promise<ERPProduct[]> {
    const query = `
      query ListProducts($businessId: ID!) {
        products(first: 100, businessId: $businessId) {
          edges {
            node {
              id
              name
              description
              unitPrice
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      businessId: this.businessId,
    });
    return result.products.edges.map((edge: any) => {
      const prod = edge.node;
      return {
        id: prod.id,
        externalId: prod.id,
        name: prod.name,
        description: prod.description,
        unitPrice: prod.unitPrice,
        status: "active",
      };
    });
  }

  /**
   * List accounts
   */
  async listAccounts(): Promise<any[]> {
    const query = `
      query ListAccounts($businessId: ID!) {
        accounts(first: 100, businessId: $businessId) {
          edges {
            node {
              id
              name
              accountType
              balance
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      businessId: this.businessId,
    });
    return result.accounts.edges.map((edge: any) => edge.node);
  }

  /**
   * Create tax
   */
  async createTax(name: string, rate: number): Promise<any> {
    const query = `
      mutation CreateTax($input: TaxCreateInput!) {
        taxCreate(input: $input) {
          tax {
            id
            name
            rate
          }
        }
      }
    `;

    const variables = {
      input: {
        businessId: this.businessId,
        name,
        rate,
      },
    };

    const result = await this.graphqlRequest(query, variables);
    return result.taxCreate.tax;
  }

  /**
   * List transactions
   */
  async listTransactions(): Promise<any[]> {
    const query = `
      query ListTransactions($businessId: ID!) {
        transactions(first: 100, businessId: $businessId) {
          edges {
            node {
              id
              date
              amount
              currency
              type
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      businessId: this.businessId,
    });
    return result.transactions.edges.map((edge: any) => edge.node);
  }
}
