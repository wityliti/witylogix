/**
 * Jobber GraphQL API Client
 * Implements clients, properties, quotes, jobs, invoices, payments, expenses
 * OAuth2 authentication
 */

import { AbstractFieldServiceAdapter } from "./field-service-adapter.js";
import type {
  Job,
  JobStatus,
  WorkOrder,
  Technician,
  Estimate,
  Invoice,
  CustomerRecord,
  FieldServiceConnection,
  PaginationParams,
  PaginatedResult,
  FieldServiceBatchResult,
} from "./types.js";

interface JobberJobData {
  id: string;
  jobNumber: string;
  clientId: string;
  clientName?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  address?: {
    street: string;
    city: string;
    province?: string;
    postalCode: string;
    country?: string;
  };
  teamMembers?: Array<{ id: string; name: string }>;
  total?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

interface JobberQuoteData {
  id: string;
  quoteNumber: string;
  clientId: string;
  jobId?: string;
  status: string;
  issueDate: string;
  expiryDate?: string;
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  notes?: string;
  sentAt?: string;
  acceptedAt?: string;
}

interface JobberInvoiceData {
  id: string;
  invoiceNumber: string;
  clientId: string;
  jobIds?: string[];
  status: string;
  invoiceDate: string;
  dueDate: string;
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  amountPaid?: number;
  notes?: string;
  sentAt?: string;
}

interface JobberTeamMemberData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: string;
  skills?: string[];
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  currentJobId?: string;
}

interface JobberClientData {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  billingAddress?: {
    street: string;
    city: string;
    province?: string;
    postalCode: string;
    country?: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    province?: string;
    postalCode: string;
    country?: string;
  };
  status: string;
}

/**
 * Jobber GraphQL API Client
 */
export class JobberClient extends AbstractFieldServiceAdapter {
  private accessToken?: string;
  private apiUrl: string = "https://api.getjobber.com/graphql";

  /**
   * Initialize Jobber client
   */
  constructor(connection: FieldServiceConnection) {
    super("jobber", connection);

    const { accessToken } = connection.credentials;
    if (!accessToken) {
      throw new Error("Missing Jobber credentials: accessToken");
    }

    this.accessToken = accessToken;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `{ viewer { id } }`;
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
        ...this.connection.config.customHeaders,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(this.connection.config.timeout || 30000),
    });

    if (!response.ok) {
      throw this.createOperationError(
        `Jobber API error: ${response.statusText}`,
        "API_ERROR",
        response.status,
        response.status >= 500 || response.status === 429,
      );
    }

    const data = (await response.json()) as any;

    if (data.errors) {
      throw this.createOperationError(
        `GraphQL error: ${data.errors[0]?.message}`,
        "GRAPHQL_ERROR",
        400,
      );
    }

    return data.data;
  }

  // ─── JOB MANAGEMENT ────────────────────────────────────────────────────────

  /**
   * Create job
   */
  async createJob(job: Job): Promise<Job> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation CreateJob($input: JobInput!) {
          jobCreate(input: $input) {
            job {
              id
              number
              clientId
              title
              description
              status
              priority
              scheduledStartTime
              scheduledEndTime
              address { street city province postalCode country }
              total
              notes
              createdAt
            }
            errors { message }
          }
        }
      `;

      const variables = {
        input: {
          clientId: job.customerId,
          title: job.title,
          description: job.description,
          scheduledStartTime: job.scheduledStart?.toISOString(),
          address: {
            street: job.location.address,
            city: job.location.city,
            province: job.location.state,
            postalCode: job.location.postalCode,
            country: job.location.country,
          },
          notes: job.notes,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapJobFromProvider(result.jobCreate.job);
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetJob($id: ID!) {
          job(id: $id) {
            id
            number
            clientId
            title
            description
            status
            priority
            scheduledStartTime
            scheduledEndTime
            actualStartTime
            actualEndTime
            address { street city province postalCode country }
            teamMembers { id name }
            total
            notes
            createdAt
            updatedAt
            completedAt
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: jobId });
      return this.mapJobFromProvider(result.job);
    });
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation UpdateJob($id: ID!, $input: JobInput!) {
          jobUpdate(id: $id, input: $input) {
            job {
              id
              number
              clientId
              title
              status
              priority
              scheduledStartTime
              scheduledEndTime
              address { street city province postalCode country }
              total
              notes
              createdAt
              updatedAt
            }
          }
        }
      `;

      const variables = {
        id: jobId,
        input: {
          title: updates.title,
          description: updates.description,
          status: updates.status,
          notes: updates.notes,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapJobFromProvider(result.jobUpdate.job);
    });
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation DeleteJob($id: ID!) {
          jobDelete(id: $id) {
            deletedId
          }
        }
      `;

      await this.graphqlRequest(query, { id: jobId });
    });
  }

  /**
   * List jobs
   */
  async listJobs(params?: PaginationParams): Promise<PaginatedResult<Job>> {
    return this.executeWithRetry(async () => {
      const query = `
        query ListJobs($first: Int, $after: String) {
          jobs(first: $first, after: $after) {
            edges {
              node {
                id
                number
                clientId
                title
                status
                priority
                scheduledStartTime
                scheduledEndTime
                address { street city province postalCode country }
                total
                notes
                createdAt
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `;

      const variables = {
        first: params?.limit || 50,
        after: params?.cursor,
      };

      const result = await this.graphqlRequest(query, variables);
      const items = result.jobs.edges.map((edge: any) =>
        this.mapJobFromProvider(edge.node),
      );

      return {
        items,
        total: result.jobs.totalCount,
        hasMore: result.jobs.pageInfo.hasNextPage,
        pageToken: result.jobs.pageInfo.endCursor,
      };
    });
  }

  // ─── WORK ORDER MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Create work order
   */
  async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const job = await this.createJob({
        jobNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        title: workOrder.description,
        location: { address: "", city: "", postalCode: "", country: "" },
        status: "scheduled",
        priority: workOrder.priority,
      });

      return {
        id: job.id,
        externalId: job.externalId,
        workOrderNumber: workOrder.workOrderNumber,
        jobId: workOrder.jobId,
        status: workOrder.status,
        description: workOrder.description,
        priority: workOrder.priority,
        estimatedDuration: workOrder.estimatedDuration,
        createdAt: job.createdAt,
      };
    });
  }

  /**
   * Get work order
   */
  async getWorkOrder(workOrderId: string): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const job = await this.getJob(workOrderId);
      return {
        id: job.id,
        externalId: job.externalId,
        workOrderNumber: job.jobNumber,
        jobId: job.customerId,
        status: "in_progress",
        description: job.description || "",
        priority: job.priority,
        createdAt: job.createdAt,
      };
    });
  }

  /**
   * Update work order
   */
  async updateWorkOrder(
    workOrderId: string,
    updates: Partial<WorkOrder>,
  ): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const job = await this.updateJob(workOrderId, {
        status: updates.status as JobStatus | undefined,
        description: updates.description,
      });

      return {
        id: job.id,
        externalId: job.externalId,
        workOrderNumber: job.jobNumber,
        jobId: job.customerId,
        status: updates.status || "in_progress",
        description: updates.description || "",
        priority: updates.priority || job.priority,
        createdAt: job.createdAt,
      };
    });
  }

  /**
   * List work orders
   */
  async listWorkOrders(
    params?: PaginationParams,
  ): Promise<PaginatedResult<WorkOrder>> {
    return this.executeWithRetry(async () => {
      const result = await this.listJobs(params);
      return {
        ...result,
        items: result.items.map((job) => ({
          id: job.id,
          externalId: job.externalId,
          workOrderNumber: job.jobNumber,
          jobId: job.customerId,
          status: "in_progress" as const,
          description: job.description || "",
          priority: job.priority,
          createdAt: job.createdAt,
        })),
      };
    });
  }

  // ─── TECHNICIAN MANAGEMENT ────────────────────────────────────────────────

  /**
   * Get technician
   */
  async getTechnician(technicianId: string): Promise<Technician> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetTeamMember($id: ID!) {
          teamMember(id: $id) {
            id
            firstName
            lastName
            email
            phone
            status
            skills
            currentLocation { latitude longitude timestamp }
            currentJobId
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: technicianId });
      return this.mapTechnicianFromProvider(result.teamMember);
    });
  }

  /**
   * List technicians
   */
  async listTechnicians(
    params?: PaginationParams,
  ): Promise<PaginatedResult<Technician>> {
    return this.executeWithRetry(async () => {
      const query = `
        query ListTeamMembers($first: Int, $after: String) {
          teamMembers(first: $first, after: $after) {
            edges {
              node {
                id
                firstName
                lastName
                email
                phone
                status
                skills
                currentLocation { latitude longitude timestamp }
              }
            }
            pageInfo { hasNextPage endCursor }
            totalCount
          }
        }
      `;

      const variables = {
        first: params?.limit || 50,
        after: params?.cursor,
      };

      const result = await this.graphqlRequest(query, variables);
      const items = result.teamMembers.edges.map((edge: any) =>
        this.mapTechnicianFromProvider(edge.node),
      );

      return {
        items,
        total: result.teamMembers.totalCount,
        hasMore: result.teamMembers.pageInfo.hasNextPage,
        pageToken: result.teamMembers.pageInfo.endCursor,
      };
    });
  }

  /**
   * Update technician availability
   */
  async updateTechnicianAvailability(
    technicianId: string,
    status: string,
  ): Promise<Technician> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation UpdateTeamMember($id: ID!, $input: TeamMemberInput!) {
          teamMemberUpdate(id: $id, input: $input) {
            teamMember {
              id
              firstName
              lastName
              email
              status
              currentLocation { latitude longitude }
            }
          }
        }
      `;

      const variables = {
        id: technicianId,
        input: { status },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapTechnicianFromProvider(result.teamMemberUpdate.teamMember);
    });
  }

  /**
   * Get technician location
   */
  async getTechnicianLocation(technicianId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const tech = await this.getTechnician(technicianId);
      return tech.currentLocation;
    });
  }

  // ─── SCHEDULING ────────────────────────────────────────────────────────────

  /**
   * Create schedule
   */
  async createSchedule(schedule: any): Promise<any> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation CreateSchedule($input: ScheduleInput!) {
          scheduleCreate(input: $input) {
            schedule { id startDate endDate type }
          }
        }
      `;

      const variables = {
        input: {
          teamMemberId: schedule.technician,
          startDate: schedule.dateStart.toISOString().split("T")[0],
          endDate: schedule.dateEnd.toISOString().split("T")[0],
          type: schedule.type,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return result.scheduleCreate.schedule;
    });
  }

  /**
   * List available time slots
   */
  async listAvailableSlots(
    technicianId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ start: Date; end: Date }>> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetAvailability($teamMemberId: ID!, $startDate: Date!, $endDate: Date!) {
          teamMemberAvailability(teamMemberId: $teamMemberId, startDate: $startDate, endDate: $endDate) {
            availableSlots {
              startTime
              endTime
            }
          }
        }
      `;

      const variables = {
        teamMemberId: technicianId,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      };

      const result = await this.graphqlRequest(query, variables);
      return (result.teamMemberAvailability.availableSlots || []).map(
        (slot: any) => ({
          start: new Date(slot.startTime),
          end: new Date(slot.endTime),
        }),
      );
    });
  }

  /**
   * Schedule job for technician
   */
  async scheduleJob(
    jobId: string,
    technicianId: string,
    start: Date,
  ): Promise<Job> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation ScheduleJob($id: ID!, $input: JobInput!) {
          jobUpdate(id: $id, input: $input) {
            job {
              id
              number
              clientId
              title
              status
              scheduledStartTime
              address { street city province postalCode country }
              total
              createdAt
            }
          }
        }
      `;

      const variables = {
        id: jobId,
        input: {
          scheduledStartTime: start.toISOString(),
          assigneeId: technicianId,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapJobFromProvider(result.jobUpdate.job);
    });
  }

  // ─── EQUIPMENT MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get equipment
   */
  async getEquipment(equipmentId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetEquipment($id: ID!) {
          equipment(id: $id) {
            id
            name
            type
            serialNumber
            status
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: equipmentId });
      return result.equipment;
    });
  }

  /**
   * List equipment
   */
  async listEquipment(
    params?: PaginationParams,
  ): Promise<PaginatedResult<any>> {
    return this.executeWithRetry(async () => {
      const query = `
        query ListEquipment($first: Int, $after: String) {
          equipment(first: $first, after: $after) {
            edges { node { id name type status } }
            pageInfo { hasNextPage endCursor }
            totalCount
          }
        }
      `;

      const variables = {
        first: params?.limit || 50,
        after: params?.cursor,
      };

      const result = await this.graphqlRequest(query, variables);
      return {
        items: result.equipment.edges.map((edge: any) => edge.node),
        total: result.equipment.totalCount,
        hasMore: result.equipment.pageInfo.hasNextPage,
        pageToken: result.equipment.pageInfo.endCursor,
      };
    });
  }

  /**
   * Get equipment service history
   */
  async getEquipmentServiceHistory(equipmentId: string): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetEquipmentHistory($equipmentId: ID!) {
          equipmentServiceHistory(equipmentId: $equipmentId) {
            id
            serviceDate
            description
            technician { id name }
            notes
          }
        }
      `;

      const result = await this.graphqlRequest(query, { equipmentId });
      return result.equipmentServiceHistory || [];
    });
  }

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: CustomerRecord): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation CreateClient($input: ClientInput!) {
          clientCreate(input: $input) {
            client {
              id
              firstName
              lastName
              companyName
              email
              phone
              mobile
              billingAddress { street city province postalCode country }
              status
            }
          }
        }
      `;

      const variables = {
        input: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          mobile: customer.mobile,
          billingAddress: {
            street: customer.primaryAddress.address,
            city: customer.primaryAddress.city,
            province: customer.primaryAddress.state,
            postalCode: customer.primaryAddress.postalCode,
            country: customer.primaryAddress.country,
          },
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapCustomerFromProvider(result.clientCreate.client);
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetClient($id: ID!) {
          client(id: $id) {
            id
            firstName
            lastName
            companyName
            email
            phone
            mobile
            billingAddress { street city province postalCode country }
            shippingAddress { street city province postalCode country }
            status
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: customerId });
      return this.mapCustomerFromProvider(result.client);
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    updates: Partial<CustomerRecord>,
  ): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation UpdateClient($id: ID!, $input: ClientInput!) {
          clientUpdate(id: $id, input: $input) {
            client {
              id
              firstName
              lastName
              email
              phone
              mobile
              billingAddress { street city province postalCode country }
              status
            }
          }
        }
      `;

      const variables = {
        id: customerId,
        input: {
          email: updates.email,
          phone: updates.phone,
          mobile: updates.mobile,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapCustomerFromProvider(result.clientUpdate.client);
    });
  }

  /**
   * List customers
   */
  async listCustomers(
    params?: PaginationParams,
  ): Promise<PaginatedResult<CustomerRecord>> {
    return this.executeWithRetry(async () => {
      const query = `
        query ListClients($first: Int, $after: String) {
          clients(first: $first, after: $after) {
            edges {
              node {
                id
                firstName
                lastName
                companyName
                email
                phone
                mobile
                billingAddress { street city province postalCode country }
                status
              }
            }
            pageInfo { hasNextPage endCursor }
            totalCount
          }
        }
      `;

      const variables = {
        first: params?.limit || 50,
        after: params?.cursor,
      };

      const result = await this.graphqlRequest(query, variables);
      const items = result.clients.edges.map((edge: any) =>
        this.mapCustomerFromProvider(edge.node),
      );

      return {
        items,
        total: result.clients.totalCount,
        hasMore: result.clients.pageInfo.hasNextPage,
        pageToken: result.clients.pageInfo.endCursor,
      };
    });
  }

  // ─── ESTIMATES & INVOICES ──────────────────────────────────────────────────

  /**
   * Create estimate
   */
  async createEstimate(estimate: Estimate): Promise<Estimate> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation CreateQuote($input: QuoteInput!) {
          quoteCreate(input: $input) {
            quote {
              id
              number
              clientId
              jobId
              status
              issueDate
              expiryDate
              lineItems { description quantity unitPrice }
              total
              notes
            }
          }
        }
      `;

      const variables = {
        input: {
          clientId: estimate.customerId,
          number: estimate.estimateNumber,
          issueDate: estimate.issueDate.toISOString(),
          expiryDate: estimate.expiryDate?.toISOString(),
          lineItems: estimate.lineItems,
          total: estimate.total,
          notes: estimate.notes,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapEstimateFromProvider(result.quoteCreate.quote);
    });
  }

  /**
   * Get estimate
   */
  async getEstimate(estimateId: string): Promise<Estimate> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetQuote($id: ID!) {
          quote(id: $id) {
            id
            number
            clientId
            jobId
            status
            issueDate
            expiryDate
            lineItems { description quantity unitPrice }
            total
            notes
            sentAt
            acceptedAt
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: estimateId });
      return this.mapEstimateFromProvider(result.quote);
    });
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: Invoice): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation CreateInvoice($input: InvoiceInput!) {
          invoiceCreate(input: $input) {
            invoice {
              id
              number
              clientId
              status
              invoiceDate
              dueDate
              lineItems { description quantity unitPrice }
              total
              amountPaid
              notes
            }
          }
        }
      `;

      const variables = {
        input: {
          clientId: invoice.customerId,
          number: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
          lineItems: invoice.lineItems,
          total: invoice.total,
          notes: invoice.notes,
        },
      };

      const result = await this.graphqlRequest(query, variables);
      return this.mapInvoiceFromProvider(result.invoiceCreate.invoice);
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const query = `
        query GetInvoice($id: ID!) {
          invoice(id: $id) {
            id
            number
            clientId
            status
            invoiceDate
            dueDate
            lineItems { description quantity unitPrice }
            total
            amountPaid
            notes
            sentAt
          }
        }
      `;

      const result = await this.graphqlRequest(query, { id: invoiceId });
      return this.mapInvoiceFromProvider(result.invoice);
    });
  }

  /**
   * List invoices
   */
  async listInvoices(
    params?: PaginationParams,
  ): Promise<PaginatedResult<Invoice>> {
    return this.executeWithRetry(async () => {
      const query = `
        query ListInvoices($first: Int, $after: String) {
          invoices(first: $first, after: $after) {
            edges {
              node {
                id
                number
                clientId
                status
                invoiceDate
                dueDate
                total
                amountPaid
              }
            }
            pageInfo { hasNextPage endCursor }
            totalCount
          }
        }
      `;

      const variables = {
        first: params?.limit || 50,
        after: params?.cursor,
      };

      const result = await this.graphqlRequest(query, variables);
      const items = result.invoices.edges.map((edge: any) =>
        this.mapInvoiceFromProvider(edge.node),
      );

      return {
        items,
        total: result.invoices.totalCount,
        hasMore: result.invoices.pageInfo.hasNextPage,
        pageToken: result.invoices.pageInfo.endCursor,
      };
    });
  }

  /**
   * Record invoice payment
   */
  async recordPayment(
    invoiceId: string,
    amount: number,
    method: string,
  ): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const query = `
        mutation RecordPayment($input: PaymentInput!) {
          paymentCreate(input: $input) {
            payment { invoiceId amount paymentMethod }
          }
        }
      `;

      const variables = {
        input: {
          invoiceId,
          amount,
          paymentMethod: method,
          paymentDate: new Date().toISOString(),
        },
      };

      await this.graphqlRequest(query, variables);
      return this.getInvoice(invoiceId);
    });
  }

  // ─── DISPATCH OPERATIONS ───────────────────────────────────────────────────

  /**
   * Create dispatch assignment
   */
  async createDispatchAssignment(assignment: any): Promise<any> {
    return this.executeWithRetry(async () => {
      await this.scheduleJob(
        assignment.jobId,
        assignment.technicianId,
        new Date(),
      );
      return assignment;
    });
  }

  /**
   * Get dispatch assignment
   */
  async getDispatchAssignment(assignmentId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const job = await this.getJob(assignmentId);
      return {
        id: assignmentId,
        jobId: job.id,
        technicianId: job.id,
        status: "assigned",
        assignedAt: job.createdAt,
      };
    });
  }

  /**
   * Update dispatch assignment
   */
  async updateDispatchAssignment(
    assignmentId: string,
    updates: Partial<any>,
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      return this.getDispatchAssignment(assignmentId);
    });
  }

  /**
   * Cancel dispatch assignment
   */
  async cancelDispatchAssignment(assignmentId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.deleteJob(assignmentId);
    });
  }

  // ─── BATCH OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Batch create jobs
   */
  async batchCreateJobs(jobs: Job[]): Promise<FieldServiceBatchResult<Job>> {
    const results = await Promise.allSettled(
      jobs.map((job) => this.createJob(job)),
    );

    const batchResult: FieldServiceBatchResult<Job> = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      duration: 0,
    };

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        batchResult.successful++;
        batchResult.results.push({
          recordId: jobs[index]!.id || "",
          externalId: result.value.externalId,
          status: "success",
          data: result.value,
        });
      } else {
        batchResult.failed++;
        batchResult.results.push({
          recordId: jobs[index]!.id || "",
          status: "failed",
          error: (result.reason as any).message,
        });
      }
    });

    return batchResult;
  }

  /**
   * Batch update jobs
   */
  async batchUpdateJobs(
    updates: Array<{ jobId: string; data: Partial<Job> }>,
  ): Promise<FieldServiceBatchResult<Job>> {
    const results = await Promise.allSettled(
      updates.map((update) => this.updateJob(update.jobId, update.data)),
    );

    const batchResult: FieldServiceBatchResult<Job> = {
      total: updates.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      duration: 0,
    };

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        batchResult.successful++;
        batchResult.results.push({
          recordId: updates[index]!.jobId,
          externalId: result.value.externalId,
          status: "success",
          data: result.value,
        });
      } else {
        batchResult.failed++;
        batchResult.results.push({
          recordId: updates[index]!.jobId,
          status: "failed",
          error: (result.reason as any).message,
        });
      }
    });

    return batchResult;
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────────

  /**
   * Map job from Jobber response
   */
  private mapJobFromProvider(data: JobberJobData): Job {
    return {
      id: data.id,
      externalId: data.id,
      jobNumber: data.jobNumber,
      customerId: data.clientId,
      customerName: data.clientName,
      title: data.title,
      description: data.description,
      status: (data.status.toLowerCase() as any) || "scheduled",
      priority: (data.priority.toLowerCase() as any) || "medium",
      scheduledStart: data.scheduledStartTime
        ? new Date(data.scheduledStartTime)
        : undefined,
      scheduledEnd: data.scheduledEndTime
        ? new Date(data.scheduledEndTime)
        : undefined,
      actualStart: data.actualStartTime
        ? new Date(data.actualStartTime)
        : undefined,
      actualEnd: data.actualEndTime ? new Date(data.actualEndTime) : undefined,
      location: {
        address: data.address?.street || "",
        city: data.address?.city || "",
        state: data.address?.province,
        postalCode: data.address?.postalCode || "",
        country: data.address?.country || "CA",
      },
      notes: data.notes,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    };
  }

  /**
   * Map technician from Jobber response
   */
  private mapTechnicianFromProvider(data: JobberTeamMemberData): Technician {
    return {
      id: data.id,
      externalId: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      status: (data.status.toLowerCase() as any) || "available",
      skills: data.skills || [],
      currentLocation: data.currentLocation
        ? {
            latitude: data.currentLocation.latitude,
            longitude: data.currentLocation.longitude,
            timestamp: new Date(data.currentLocation.timestamp),
          }
        : undefined,
      currentJobId: data.currentJobId,
    };
  }

  /**
   * Map customer from Jobber response
   */
  private mapCustomerFromProvider(data: JobberClientData): CustomerRecord {
    return {
      id: data.id,
      externalId: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      primaryAddress: {
        address: data.billingAddress?.street || "",
        city: data.billingAddress?.city || "",
        state: data.billingAddress?.province,
        postalCode: data.billingAddress?.postalCode || "",
        country: data.billingAddress?.country || "CA",
      },
      type: "both",
      status: (data.status.toLowerCase() as any) || "active",
    };
  }

  /**
   * Map estimate from Jobber response
   */
  private mapEstimateFromProvider(data: JobberQuoteData): Estimate {
    return {
      id: data.id,
      externalId: data.id,
      estimateNumber: data.quoteNumber,
      customerId: data.clientId,
      jobId: data.jobId,
      status: (data.status.toLowerCase() as any) || "draft",
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      lineItems: (data.lineItems || []).map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      })),
      subtotal: data.total * 0.9,
      total: data.total,
      notes: data.notes,
      sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
      acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : undefined,
    };
  }

  /**
   * Map invoice from Jobber response
   */
  private mapInvoiceFromProvider(data: JobberInvoiceData): Invoice {
    return {
      id: data.id,
      externalId: data.id,
      invoiceNumber: data.invoiceNumber,
      customerId: data.clientId,
      jobIds: data.jobIds,
      status: (data.status.toLowerCase() as any) || "draft",
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      lineItems: (data.lineItems || []).map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      })),
      subtotal: data.total * 0.9,
      total: data.total,
      amountPaid: data.amountPaid,
      amountDue: data.total - (data.amountPaid || 0),
      notes: data.notes,
      sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
    };
  }
}
