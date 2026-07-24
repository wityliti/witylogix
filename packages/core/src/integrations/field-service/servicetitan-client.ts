/**
 * ServiceTitan API v2 Client
 * Implements job management, estimates, invoices, dispatch, technician GPS, memberships
 * OAuth2 authentication with app key and tenant ID
 */

import { AbstractFieldServiceAdapter } from "./field-service-adapter.js";
import type {
  Job,
  WorkOrder,
  Technician,
  TechnicianCertification,
  Estimate,
  Invoice,
  CustomerRecord,
  Membership,
  Schedule,
  DispatchAssignment,
  FieldServiceConnection,
  PaginationParams,
  PaginatedResult,
  PriorityLevel,
  FieldServiceBatchResult,
} from "./types.js";

interface ServiceTitanConfig {
  appKey: string;
  appSecret: string;
  tenantId: string;
  apiUrl?: string;
}

interface ServiceTitanJobData {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  status: string;
  priority: number;
  jobDate?: string;
  jobStartTime?: string;
  jobEndTime?: string;
  locationStreet: string;
  locationCity: string;
  locationZip: string;
  locationState: string;
  assignedResources?: Array<{ resourceId: string }>;
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  jobTotal: number;
  notes?: string;
  createdDate: string;
  modifiedDate: string;
  completionDate?: string;
}

interface ServiceTitanEstimateData {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  status: string;
  issueDate: string;
  expirationDate?: string;
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  notes?: string;
  sentDate?: string;
  acceptedDate?: string;
}

interface ServiceTitanInvoiceData {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
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
  createdDate: string;
  modifiedDate: string;
}

interface ServiceTitanResourceData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status: string;
  skillIds?: string[];
  certifications?: Array<{ name: string; expiryDate?: string }>;
  currentLocationLatitude?: number;
  currentLocationLongitude?: number;
  currentJobId?: string;
  hoursWorked?: number;
  rating?: number;
  createdDate: string;
  modifiedDate: string;
}

/**
 * ServiceTitan API v2 Client
 */
export class ServiceTitanClient extends AbstractFieldServiceAdapter {
  private config: ServiceTitanConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private readonly apiUrl: string;

  /**
   * Initialize ServiceTitan client
   */
  constructor(connection: FieldServiceConnection) {
    super("servicetitan", connection);

    const { apiKey, apiSecret, tenantId, siteUrl } = connection.credentials;
    if (!apiKey || !apiSecret || !tenantId) {
      throw new Error(
        "Missing ServiceTitan credentials: appKey, appSecret, tenantId",
      );
    }

    this.config = {
      appKey: apiKey,
      appSecret: apiSecret,
      tenantId: tenantId,
      apiUrl: siteUrl,
    };

    this.apiUrl = this.config.apiUrl || "https://api.servicetitan.com";
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.executeWithProtection(() =>
        this.request("GET", "/crm/v2/customers?limit=1"),
      );
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Authenticate and get access token
   */
  async authenticate(): Promise<void> {
    try {
      const response = (await this.request(
        "POST",
        "/auth/v1/oauth/token",
        {
          grant_type: "client_credentials",
          client_id: this.config.appKey,
          client_secret: this.config.appSecret,
        },
        false,
      )) as any;

      this.accessToken = response.access_token;
      this.tokenExpiresAt = new Date(
        Date.now() + (response.expires_in - 300) * 1000,
      );
    } catch (error) {
      throw this.createOperationError(
        "Failed to authenticate with ServiceTitan",
        "AUTH_ERROR",
        401,
      );
    }
  }

  /**
   * Make HTTP request
   */
  private async request(
    method: string,
    endpoint: string,
    body?: unknown,
    requireAuth: boolean = true,
  ): Promise<unknown> {
    if (
      requireAuth &&
      (!this.accessToken ||
        (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt.getTime()))
    ) {
      await this.authenticate();
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requireAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers: { ...headers, ...this.connection.config.customHeaders },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.connection.config.timeout || 30000),
    });

    if (!response.ok) {
      throw this.createOperationError(
        `ServiceTitan API error: ${response.statusText}`,
        "API_ERROR",
        response.status,
        response.status >= 500 || response.status === 429,
      );
    }

    return response.json();
  }

  // ─── JOB MANAGEMENT ────────────────────────────────────────────────────────

  /**
   * Create job
   */
  async createJob(job: Job): Promise<Job> {
    return this.executeWithRetry(async () => {
      const data = {
        customerId: job.customerId,
        jobNumber: job.jobNumber,
        description: job.title,
        priority: this.mapPriority(job.priority),
        locationStreet: job.location.address,
        locationCity: job.location.city,
        locationZip: job.location.postalCode,
        locationState: job.location.state,
        jobDate: job.scheduledStart?.toISOString().split("T")[0],
        notes: job.notes,
      };

      const response = (await this.request(
        "POST",
        "/jobs/v2/jobs",
        data,
      )) as ServiceTitanJobData;
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/jobs/v2/jobs/${jobId}`,
      )) as ServiceTitanJobData;
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    return this.executeWithRetry(async () => {
      const data: Record<string, unknown> = {};

      if (updates.title) data.description = updates.title;
      if (updates.priority) data.priority = this.mapPriority(updates.priority);
      if (updates.notes) data.notes = updates.notes;
      if (updates.status) data.status = updates.status;

      const response = (await this.request(
        "PATCH",
        `/jobs/v2/jobs/${jobId}`,
        data,
      )) as ServiceTitanJobData;
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request("DELETE", `/jobs/v2/jobs/${jobId}`);
    });
  }

  /**
   * List jobs
   */
  async listJobs(params?: PaginationParams): Promise<PaginatedResult<Job>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
      });

      const response = (await this.request(
        "GET",
        `/jobs/v2/jobs?${queryParams}`,
      )) as any;
      const items = (response.data || []).map((item: ServiceTitanJobData) =>
        this.mapJobFromProvider(item),
      );

      return {
        items,
        total: response.pageInfo?.totalCount || 0,
        hasMore: response.pageInfo?.hasMore || false,
        nextOffset: response.pageInfo?.nextOffset,
      };
    });
  }

  // ─── WORK ORDER MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Create work order (mapped to jobs in ServiceTitan)
   */
  async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      // ServiceTitan uses jobs for work orders
      const jobData = {
        customerId: workOrder.jobId,
        description: workOrder.description,
        priority: this.mapPriority(workOrder.priority),
        notes: workOrder.notes,
      };

      const response = (await this.request(
        "POST",
        "/jobs/v2/jobs",
        jobData,
      )) as ServiceTitanJobData;
      return {
        id: response.id,
        externalId: response.id,
        workOrderNumber: response.number,
        jobId: workOrder.jobId,
        status: workOrder.status,
        description: response.description,
        priority: workOrder.priority,
        estimatedDuration: workOrder.estimatedDuration,
        createdAt: new Date(response.createdDate),
      };
    });
  }

  /**
   * Get work order
   */
  async getWorkOrder(workOrderId: string): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/jobs/v2/jobs/${workOrderId}`,
      )) as ServiceTitanJobData;
      return {
        id: response.id,
        externalId: response.id,
        workOrderNumber: response.number,
        jobId: response.customerId,
        status: "in_progress",
        description: response.description,
        priority: "high",
        createdAt: new Date(response.createdDate),
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
      const data: Record<string, unknown> = {};
      if (updates.status) data.status = updates.status;
      if (updates.description) data.description = updates.description;

      const response = (await this.request(
        "PATCH",
        `/jobs/v2/jobs/${workOrderId}`,
        data,
      )) as ServiceTitanJobData;
      return this.getWorkOrder(response.id);
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
      const workOrders: WorkOrder[] = result.items.map((job) => ({
        id: job.id,
        externalId: job.externalId,
        workOrderNumber: job.jobNumber,
        jobId: job.customerId,
        status: "in_progress" as const,
        description: job.description ?? "",
        priority: job.priority,
        createdAt: job.createdAt,
      }));
      return {
        items: workOrders,
        total: result.total,
        hasMore: result.hasMore,
        nextOffset: result.nextOffset,
        pageToken: result.pageToken,
      };
    });
  }

  // ─── TECHNICIAN MANAGEMENT ────────────────────────────────────────────────

  /**
   * Get technician
   */
  async getTechnician(technicianId: string): Promise<Technician> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/crm/v2/resources/${technicianId}`,
      )) as ServiceTitanResourceData;
      return this.mapTechnicianFromProvider(response);
    });
  }

  /**
   * List technicians
   */
  async listTechnicians(
    params?: PaginationParams,
  ): Promise<PaginatedResult<Technician>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
      });

      const response = (await this.request(
        "GET",
        `/crm/v2/resources?${queryParams}`,
      )) as any;
      const items = (response.data || []).map(
        (item: ServiceTitanResourceData) =>
          this.mapTechnicianFromProvider(item),
      );

      return {
        items,
        total: response.pageInfo?.totalCount || 0,
        hasMore: response.pageInfo?.hasMore || false,
        nextOffset: response.pageInfo?.nextOffset,
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
      const data = { status };
      const response = (await this.request(
        "PATCH",
        `/crm/v2/resources/${technicianId}`,
        data,
      )) as ServiceTitanResourceData;
      return this.mapTechnicianFromProvider(response);
    });
  }

  /**
   * Get technician location via GPS
   */
  async getTechnicianLocation(technicianId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/gps/v2/resources/${technicianId}/location`,
      )) as any;
      return {
        latitude: response.latitude,
        longitude: response.longitude,
        timestamp: new Date(response.timestamp),
        accuracy: response.accuracy,
      };
    });
  }

  // ─── SCHEDULING ────────────────────────────────────────────────────────────

  /**
   * Create schedule
   */
  async createSchedule(schedule: Schedule): Promise<Schedule> {
    return this.executeWithRetry(async () => {
      const data = {
        resourceId: schedule.technician,
        startDate: schedule.dateStart.toISOString().split("T")[0],
        endDate: schedule.dateEnd.toISOString().split("T")[0],
        type: schedule.type,
      };

      const response = (await this.request(
        "POST",
        "/crm/v2/schedules",
        data,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        technician: response.resourceId,
        dateStart: new Date(response.startDate),
        dateEnd: new Date(response.endDate),
        type: schedule.type,
      };
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
      const queryParams = new URLSearchParams({
        resourceId: technicianId,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      });

      const response = (await this.request(
        "GET",
        `/crm/v2/availability-slots?${queryParams}`,
      )) as any;
      return (response.data || []).map((slot: any) => ({
        start: new Date(slot.startTime),
        end: new Date(slot.endTime),
      }));
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
      const data = {
        resourceId: technicianId,
        jobDate: start.toISOString().split("T")[0],
      };

      const response = (await this.request(
        "PATCH",
        `/jobs/v2/jobs/${jobId}`,
        data,
      )) as ServiceTitanJobData;
      return this.mapJobFromProvider(response);
    });
  }

  // ─── EQUIPMENT MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get equipment
   */
  async getEquipment(equipmentId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/assets/v2/equipment/${equipmentId}`,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        equipmentNumber: response.number,
        name: response.name,
        type: response.type,
        serialNumber: response.serialNumber,
        status: response.status,
      };
    });
  }

  /**
   * List equipment
   */
  async listEquipment(
    params?: PaginationParams,
  ): Promise<PaginatedResult<any>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
      });

      const response = (await this.request(
        "GET",
        `/assets/v2/equipment?${queryParams}`,
      )) as any;
      return {
        items: response.data || [],
        total: response.pageInfo?.totalCount || 0,
        hasMore: response.pageInfo?.hasMore || false,
      };
    });
  }

  /**
   * Get equipment service history
   */
  async getEquipmentServiceHistory(equipmentId: string): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/assets/v2/equipment/${equipmentId}/service-history`,
      )) as any;
      return response.data || [];
    });
  }

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: CustomerRecord): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const data = {
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        street: customer.primaryAddress.address,
        city: customer.primaryAddress.city,
        state: customer.primaryAddress.state,
        zip: customer.primaryAddress.postalCode,
        country: customer.primaryAddress.country,
        type: customer.type === "residential" ? "Residential" : "Commercial",
      };

      const response = (await this.request(
        "POST",
        "/crm/v2/customers",
        data,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
        phone: response.phone,
        primaryAddress: {
          address: response.street,
          city: response.city,
          state: response.state,
          postalCode: response.zip,
          country: response.country,
        },
        type: customer.type,
        status: "active",
      };
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/crm/v2/customers/${customerId}`,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
        phone: response.phone,
        primaryAddress: {
          address: response.street,
          city: response.city,
          state: response.state,
          postalCode: response.zip,
          country: response.country,
        },
        type: response.type === "Residential" ? "residential" : "commercial",
        status: response.status,
      };
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
      const data: Record<string, unknown> = {};
      if (updates.email) data.email = updates.email;
      if (updates.phone) data.phone = updates.phone;
      if (updates.mobile) data.mobile = updates.mobile;

      const response = (await this.request(
        "PATCH",
        `/crm/v2/customers/${customerId}`,
        data,
      )) as any;
      return this.getCustomer(response.id);
    });
  }

  /**
   * List customers
   */
  async listCustomers(
    params?: PaginationParams,
  ): Promise<PaginatedResult<CustomerRecord>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
      });

      const response = (await this.request(
        "GET",
        `/crm/v2/customers?${queryParams}`,
      )) as any;
      const items = (response.data || []).map((item: any) => ({
        id: item.id,
        externalId: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        phone: item.phone,
        primaryAddress: {
          address: item.street,
          city: item.city,
          state: item.state,
          postalCode: item.zip,
          country: item.country,
        },
        type: item.type === "Residential" ? "residential" : "commercial",
        status: item.status,
      }));

      return {
        items,
        total: response.pageInfo?.totalCount || 0,
        hasMore: response.pageInfo?.hasMore || false,
      };
    });
  }

  // ─── ESTIMATES & INVOICES ──────────────────────────────────────────────────

  /**
   * Create estimate
   */
  async createEstimate(estimate: Estimate): Promise<Estimate> {
    return this.executeWithRetry(async () => {
      const data = {
        customerId: estimate.customerId,
        number: estimate.estimateNumber,
        issueDate: estimate.issueDate.toISOString(),
        expirationDate: estimate.expiryDate?.toISOString(),
        lineItems: estimate.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        total: estimate.total,
        notes: estimate.notes,
      };

      const response = (await this.request(
        "POST",
        "/billing/v2/estimates",
        data,
      )) as ServiceTitanEstimateData;
      return this.mapEstimateFromProvider(response);
    });
  }

  /**
   * Get estimate
   */
  async getEstimate(estimateId: string): Promise<Estimate> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/billing/v2/estimates/${estimateId}`,
      )) as ServiceTitanEstimateData;
      return this.mapEstimateFromProvider(response);
    });
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: Invoice): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const data = {
        customerId: invoice.customerId,
        number: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        lineItems: invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        total: invoice.total,
        notes: invoice.notes,
      };

      const response = (await this.request(
        "POST",
        "/billing/v2/invoices",
        data,
      )) as ServiceTitanInvoiceData;
      return this.mapInvoiceFromProvider(response);
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/billing/v2/invoices/${invoiceId}`,
      )) as ServiceTitanInvoiceData;
      return this.mapInvoiceFromProvider(response);
    });
  }

  /**
   * List invoices
   */
  async listInvoices(
    params?: PaginationParams,
  ): Promise<PaginatedResult<Invoice>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
      });

      const response = (await this.request(
        "GET",
        `/billing/v2/invoices?${queryParams}`,
      )) as any;
      const items = (response.data || []).map((item: ServiceTitanInvoiceData) =>
        this.mapInvoiceFromProvider(item),
      );

      return {
        items,
        total: response.pageInfo?.totalCount || 0,
        hasMore: response.pageInfo?.hasMore || false,
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
      const data = {
        invoiceId,
        amount,
        paymentMethod: method,
        paymentDate: new Date().toISOString(),
      };

      const response = (await this.request(
        "POST",
        "/billing/v2/payments",
        data,
      )) as any;
      return this.getInvoice(response.invoiceId);
    });
  }

  // ─── DISPATCH OPERATIONS ───────────────────────────────────────────────────

  /**
   * Create dispatch assignment
   */
  async createDispatchAssignment(
    assignment: DispatchAssignment,
  ): Promise<DispatchAssignment> {
    return this.executeWithRetry(async () => {
      const data = {
        jobId: assignment.jobId,
        resourceId: assignment.technicianId,
        priority: this.mapPriority(assignment.priority),
      };

      const response = (await this.request(
        "POST",
        "/dispatch/v2/assignments",
        data,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        jobId: response.jobId,
        technicianId: response.resourceId,
        status: "assigned",
        assignedAt: new Date(response.createdDate),
        priority: assignment.priority,
      };
    });
  }

  /**
   * Get dispatch assignment
   */
  async getDispatchAssignment(
    assignmentId: string,
  ): Promise<DispatchAssignment> {
    return this.executeWithRetry(async () => {
      const response = (await this.request(
        "GET",
        `/dispatch/v2/assignments/${assignmentId}`,
      )) as any;
      return {
        id: response.id,
        externalId: response.id,
        jobId: response.jobId,
        technicianId: response.resourceId,
        status: response.status,
        assignedAt: new Date(response.createdDate),
        priority: "high",
      };
    });
  }

  /**
   * Update dispatch assignment
   */
  async updateDispatchAssignment(
    assignmentId: string,
    updates: Partial<DispatchAssignment>,
  ): Promise<DispatchAssignment> {
    return this.executeWithRetry(async () => {
      const data: Record<string, unknown> = {};
      if (updates.status) data.status = updates.status;

      const response = (await this.request(
        "PATCH",
        `/dispatch/v2/assignments/${assignmentId}`,
        data,
      )) as any;
      return this.getDispatchAssignment(response.id);
    });
  }

  /**
   * Cancel dispatch assignment
   */
  async cancelDispatchAssignment(assignmentId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request("DELETE", `/dispatch/v2/assignments/${assignmentId}`);
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
          error: (result.reason as any).message || "Unknown error",
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
          error: (result.reason as any).message || "Unknown error",
        });
      }
    });

    return batchResult;
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────────

  /**
   * Map priority level to ServiceTitan number
   */
  private mapPriority(priority: string): number {
    const map: Record<string, number> = {
      low: 3,
      medium: 2,
      high: 1,
      urgent: 0,
    };
    return map[priority] || 2;
  }

  /**
   * Map job from ServiceTitan response
   */
  private mapJobFromProvider(data: ServiceTitanJobData): Job {
    return {
      id: data.id,
      externalId: data.id,
      jobNumber: data.number,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      title: data.description,
      description: data.description,
      status: (data.status.toLowerCase() as any) || "scheduled",
      priority: this.unmapPriority(data.priority),
      scheduledStart: data.jobDate ? new Date(data.jobDate) : undefined,
      location: {
        address: data.locationStreet,
        city: data.locationCity,
        state: data.locationState,
        postalCode: data.locationZip,
        country: "US",
      },
      notes: data.notes,
      createdAt: new Date(data.createdDate),
      updatedAt: new Date(data.modifiedDate),
      completedAt: data.completionDate
        ? new Date(data.completionDate)
        : undefined,
    };
  }

  /**
   * Map technician from ServiceTitan response
   */
  private mapTechnicianFromProvider(
    data: ServiceTitanResourceData,
  ): Technician {
    return {
      id: data.id,
      externalId: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      status: (data.status.toLowerCase() as any) || "available",
      skills: data.skillIds || [],
      certifications: (data.certifications || []).map(
        (c: {
          name: string;
          expiryDate?: string;
        }): TechnicianCertification => ({
          name: c.name,
          expiryDate: c.expiryDate ? new Date(c.expiryDate) : undefined,
        }),
      ),
      currentLocation:
        data.currentLocationLatitude && data.currentLocationLongitude
          ? {
              latitude: data.currentLocationLatitude,
              longitude: data.currentLocationLongitude,
              timestamp: new Date(),
            }
          : undefined,
      currentJobId: data.currentJobId,
      hoursWorked: data.hoursWorked,
      rating: data.rating,
      createdAt: new Date(data.createdDate),
      updatedAt: new Date(data.modifiedDate),
    };
  }

  /**
   * Map estimate from ServiceTitan response
   */
  private mapEstimateFromProvider(data: ServiceTitanEstimateData): Estimate {
    return {
      id: data.id,
      externalId: data.id,
      estimateNumber: data.number,
      customerId: data.customerId,
      customerName: data.customerName,
      jobId: data.jobId,
      status: (data.status.toLowerCase() as any) || "draft",
      issueDate: new Date(data.issueDate),
      expiryDate: data.expirationDate
        ? new Date(data.expirationDate)
        : undefined,
      lineItems: (data.lineItems || []).map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      })),
      subtotal: data.total * 0.9,
      total: data.total,
      notes: data.notes,
    };
  }

  /**
   * Map invoice from ServiceTitan response
   */
  private mapInvoiceFromProvider(data: ServiceTitanInvoiceData): Invoice {
    return {
      id: data.id,
      externalId: data.id,
      invoiceNumber: data.number,
      customerId: data.customerId,
      customerName: data.customerName,
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
    };
  }

  /**
   * Reverse map priority from ServiceTitan number
   */
  private unmapPriority(priority: number): PriorityLevel {
    const map: Record<number, PriorityLevel> = {
      0: "urgent",
      1: "high",
      2: "medium",
      3: "low",
    };
    return map[priority] ?? "medium";
  }
}
