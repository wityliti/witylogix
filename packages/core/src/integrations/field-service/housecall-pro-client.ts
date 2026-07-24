/**
 * HouseCall Pro API Client
 * Implements estimates, jobs, invoices, scheduling, dispatch, customer management
 * API key authentication
 */

import { AbstractFieldServiceAdapter } from "./field-service-adapter.js";
import type {
  Job,
  WorkOrder,
  Technician,
  Estimate,
  Invoice,
  CustomerRecord,
  DispatchAssignment,
  FieldServiceConnection,
  PaginationParams,
  PaginatedResult,
  FieldServiceBatchResult,
} from "./types.js";

interface HCPJobData {
  job_id: number;
  job_number: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  job_name: string;
  job_description: string;
  job_status: string;
  job_priority: string;
  job_date?: string;
  job_start_time?: string;
  job_end_time?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  assigned_to?: number;
  total_price: number;
  notes?: string;
  created_date?: string;
  modified_date?: string;
}

interface HCPEstimateData {
  estimate_id: number;
  estimate_number: string;
  customer_id: number;
  customer_name: string;
  job_id?: number;
  estimate_status: string;
  created_date: string;
  expiration_date?: string;
  line_items?: Array<{
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  total_price: number;
  notes?: string;
  sent_date?: string;
  accepted_date?: string;
}

interface HCPInvoiceData {
  invoice_id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  job_ids?: number[];
  invoice_status: string;
  created_date: string;
  due_date: string;
  line_items?: Array<{
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  total_price: number;
  amount_paid?: number;
  notes?: string;
  sent_date?: string;
}

interface HCPTechnicianData {
  tech_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status: string;
  skills?: string[];
  current_location_lat?: number;
  current_location_lng?: number;
  current_job_id?: number;
  avg_rating?: number;
}

interface HCPCustomerData {
  customer_id: number;
  first_name: string;
  last_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  customer_type: string;
  status: string;
}

/**
 * HouseCall Pro API Client
 */
export class HouseCallProClient extends AbstractFieldServiceAdapter {
  private apiKey: string;
  private apiUrl: string = "https://api.housecallpro.com/v2";

  /**
   * Initialize HouseCall Pro client
   */
  constructor(connection: FieldServiceConnection) {
    super("housecall-pro", connection);

    const { apiKey } = connection.credentials;
    if (!apiKey) {
      throw new Error("Missing HouseCall Pro credentials: apiKey");
    }

    this.apiKey = apiKey;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/customers?limit=1");
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
      Authorization: `Bearer ${this.apiKey}`,
      ...this.connection.config.customHeaders,
    };

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.connection.config.timeout || 30000),
    });

    if (!response.ok) {
      throw this.createOperationError(
        `HouseCall Pro API error: ${response.statusText}`,
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
        customer_id: job.customerId,
        job_number: job.jobNumber,
        job_name: job.title,
        job_description: job.description,
        job_priority: job.priority,
        job_date: job.scheduledStart?.toISOString().split("T")[0],
        address: job.location.address,
        city: job.location.city,
        state: job.location.state,
        zip_code: job.location.postalCode,
        country: job.location.country,
        notes: job.notes,
      };

      const response = await this.request("POST", "/jobs", data);
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.executeWithRetry(async () => {
      const response = await this.request("GET", `/jobs/${jobId}`);
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    return this.executeWithRetry(async () => {
      const data: Record<string, unknown> = {};

      if (updates.title) data.job_name = updates.title;
      if (updates.description) data.job_description = updates.description;
      if (updates.priority) data.job_priority = updates.priority;
      if (updates.status) data.job_status = updates.status;
      if (updates.notes) data.notes = updates.notes;

      const response = await this.request("PATCH", `/jobs/${jobId}`, data);
      return this.mapJobFromProvider(response);
    });
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request("DELETE", `/jobs/${jobId}`);
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

      const response = await this.request("GET", `/jobs?${queryParams}`);
      const items = (response.jobs || []).map((item: HCPJobData) =>
        this.mapJobFromProvider(item),
      );

      return {
        items,
        total: response.total_count || 0,
        hasMore: !!response.next_cursor,
        pageToken: response.next_cursor,
      };
    });
  }

  // ─── WORK ORDER MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Create work order (uses jobs)
   */
  async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const job = await this.createJob({
        jobNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        title: workOrder.description,
        description: workOrder.description,
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
      const job = await this.updateJob(workOrderId, updates as Partial<Job>);
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
      const response = await this.request(
        "GET",
        `/technicians/${technicianId}`,
      );
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

      const response = await this.request("GET", `/technicians?${queryParams}`);
      const items = (response.technicians || []).map(
        (item: HCPTechnicianData) => this.mapTechnicianFromProvider(item),
      );

      return {
        items,
        total: response.total_count || 0,
        hasMore: !!response.next_cursor,
        pageToken: response.next_cursor,
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
      const response = await this.request(
        "PATCH",
        `/technicians/${technicianId}`,
        data,
      );
      return this.mapTechnicianFromProvider(response);
    });
  }

  /**
   * Get technician location
   */
  async getTechnicianLocation(technicianId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await this.request(
        "GET",
        `/technicians/${technicianId}/location`,
      );
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
  async createSchedule(schedule: any): Promise<any> {
    return this.executeWithRetry(async () => {
      const data = {
        tech_id: schedule.technician,
        start_date: schedule.dateStart.toISOString().split("T")[0],
        end_date: schedule.dateEnd.toISOString().split("T")[0],
        type: schedule.type,
      };

      const response = await this.request("POST", "/schedules", data);
      return response;
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
        tech_id: technicianId,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      });

      const response = await this.request(
        "GET",
        `/availability-slots?${queryParams}`,
      );
      return (response.slots || []).map((slot: any) => ({
        start: new Date(slot.start_time),
        end: new Date(slot.end_time),
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
        assigned_to: technicianId,
        job_date: start.toISOString().split("T")[0],
      };

      const response = await this.request("PATCH", `/jobs/${jobId}`, data);
      return this.mapJobFromProvider(response);
    });
  }

  // ─── EQUIPMENT MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get equipment
   */
  async getEquipment(equipmentId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await this.request("GET", `/equipment/${equipmentId}`);
      return response;
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

      const response = await this.request("GET", `/equipment?${queryParams}`);
      return {
        items: response.equipment || [],
        total: response.total_count || 0,
        hasMore: !!response.next_cursor,
        pageToken: response.next_cursor,
      };
    });
  }

  /**
   * Get equipment service history
   */
  async getEquipmentServiceHistory(equipmentId: string): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.request(
        "GET",
        `/equipment/${equipmentId}/service-history`,
      );
      return response.history || [];
    });
  }

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(customer: CustomerRecord): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const data = {
        first_name: customer.firstName,
        last_name: customer.lastName,
        company_name: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        fax: customer.fax,
        address: customer.primaryAddress.address,
        city: customer.primaryAddress.city,
        state: customer.primaryAddress.state,
        zip_code: customer.primaryAddress.postalCode,
        country: customer.primaryAddress.country,
        customer_type:
          customer.type === "residential" ? "Residential" : "Commercial",
      };

      const response = await this.request("POST", "/customers", data);
      return this.mapCustomerFromProvider(response);
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const response = await this.request("GET", `/customers/${customerId}`);
      return this.mapCustomerFromProvider(response);
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

      const response = await this.request(
        "PATCH",
        `/customers/${customerId}`,
        data,
      );
      return this.mapCustomerFromProvider(response);
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

      const response = await this.request("GET", `/customers?${queryParams}`);
      const items = (response.customers || []).map((item: HCPCustomerData) =>
        this.mapCustomerFromProvider(item),
      );

      return {
        items,
        total: response.total_count || 0,
        hasMore: !!response.next_cursor,
        pageToken: response.next_cursor,
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
        customer_id: estimate.customerId,
        estimate_number: estimate.estimateNumber,
        created_date: estimate.issueDate.toISOString(),
        expiration_date: estimate.expiryDate?.toISOString(),
        line_items: estimate.lineItems,
        total_price: estimate.total,
        notes: estimate.notes,
      };

      const response = await this.request("POST", "/estimates", data);
      return this.mapEstimateFromProvider(response);
    });
  }

  /**
   * Get estimate
   */
  async getEstimate(estimateId: string): Promise<Estimate> {
    return this.executeWithRetry(async () => {
      const response = await this.request("GET", `/estimates/${estimateId}`);
      return this.mapEstimateFromProvider(response);
    });
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: Invoice): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const data = {
        customer_id: invoice.customerId,
        invoice_number: invoice.invoiceNumber,
        created_date: invoice.invoiceDate.toISOString(),
        due_date: invoice.dueDate.toISOString(),
        line_items: invoice.lineItems,
        total_price: invoice.total,
        notes: invoice.notes,
      };

      const response = await this.request("POST", "/invoices", data);
      return this.mapInvoiceFromProvider(response);
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const response = await this.request("GET", `/invoices/${invoiceId}`);
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

      const response = await this.request("GET", `/invoices?${queryParams}`);
      const items = (response.invoices || []).map((item: HCPInvoiceData) =>
        this.mapInvoiceFromProvider(item),
      );

      return {
        items,
        total: response.total_count || 0,
        hasMore: !!response.next_cursor,
        pageToken: response.next_cursor,
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
        invoice_id: invoiceId,
        amount,
        payment_method: method,
        payment_date: new Date().toISOString(),
      };

      await this.request("POST", "/payments", data);
      return this.getInvoice(invoiceId);
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
        job_id: assignment.jobId,
        tech_id: assignment.technicianId,
      };

      const response = await this.request("POST", "/dispatch", data);
      return {
        id: response.dispatch_id,
        externalId: response.dispatch_id,
        jobId: response.job_id,
        technicianId: response.tech_id,
        status: "assigned",
        assignedAt: new Date(),
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
      const response = await this.request("GET", `/dispatch/${assignmentId}`);
      return {
        id: response.dispatch_id,
        externalId: response.dispatch_id,
        jobId: response.job_id,
        technicianId: response.tech_id,
        status: response.status,
        assignedAt: new Date(response.assigned_date),
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

      const response = await this.request(
        "PATCH",
        `/dispatch/${assignmentId}`,
        data,
      );
      return this.getDispatchAssignment(response.dispatch_id);
    });
  }

  /**
   * Cancel dispatch assignment
   */
  async cancelDispatchAssignment(assignmentId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request("DELETE", `/dispatch/${assignmentId}`);
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
   * Map job from HCP response
   */
  private mapJobFromProvider(data: HCPJobData): Job {
    return {
      id: data.job_id.toString(),
      externalId: data.job_id.toString(),
      jobNumber: data.job_number,
      customerId: data.customer_id.toString(),
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      customerPhone: data.customer_phone,
      title: data.job_name,
      description: data.job_description,
      status: (data.job_status.toLowerCase() as any) || "scheduled",
      priority: (data.job_priority.toLowerCase() as any) || "medium",
      scheduledStart: data.job_date ? new Date(data.job_date) : undefined,
      location: {
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.zip_code,
        country: data.country,
      },
      notes: data.notes,
      createdAt: data.created_date ? new Date(data.created_date) : undefined,
      updatedAt: data.modified_date ? new Date(data.modified_date) : undefined,
    };
  }

  /**
   * Map technician from HCP response
   */
  private mapTechnicianFromProvider(data: HCPTechnicianData): Technician {
    return {
      id: data.tech_id.toString(),
      externalId: data.tech_id.toString(),
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      status: (data.status.toLowerCase() as any) || "available",
      skills: data.skills || [],
      currentLocation:
        data.current_location_lat && data.current_location_lng
          ? {
              latitude: data.current_location_lat,
              longitude: data.current_location_lng,
              timestamp: new Date(),
            }
          : undefined,
      currentJobId: data.current_job_id?.toString(),
      rating: data.avg_rating,
    };
  }

  /**
   * Map customer from HCP response
   */
  private mapCustomerFromProvider(data: HCPCustomerData): CustomerRecord {
    return {
      id: data.customer_id.toString(),
      externalId: data.customer_id.toString(),
      firstName: data.first_name,
      lastName: data.last_name,
      companyName: data.company_name,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      fax: data.fax,
      primaryAddress: {
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.zip_code,
        country: data.country,
      },
      type: data.customer_type === "Residential" ? "residential" : "commercial",
      status: (data.status.toLowerCase() as any) || "active",
    };
  }

  /**
   * Map estimate from HCP response
   */
  private mapEstimateFromProvider(data: HCPEstimateData): Estimate {
    return {
      id: data.estimate_id.toString(),
      externalId: data.estimate_id.toString(),
      estimateNumber: data.estimate_number,
      customerId: data.customer_id.toString(),
      customerName: data.customer_name,
      jobId: data.job_id?.toString(),
      status: (data.estimate_status.toLowerCase() as any) || "draft",
      issueDate: new Date(data.created_date),
      expiryDate: data.expiration_date
        ? new Date(data.expiration_date)
        : undefined,
      lineItems: (data.line_items || []).map((item) => ({
        ...item,
        unitPrice: item.unit_price,
        total: item.quantity * item.unit_price,
      })),
      subtotal: data.total_price * 0.9,
      total: data.total_price,
      notes: data.notes,
      sentAt: data.sent_date ? new Date(data.sent_date) : undefined,
      acceptedAt: data.accepted_date ? new Date(data.accepted_date) : undefined,
    };
  }

  /**
   * Map invoice from HCP response
   */
  private mapInvoiceFromProvider(data: HCPInvoiceData): Invoice {
    return {
      id: data.invoice_id.toString(),
      externalId: data.invoice_id.toString(),
      invoiceNumber: data.invoice_number,
      customerId: data.customer_id.toString(),
      customerName: data.customer_name,
      jobIds: data.job_ids?.map(String),
      status: (data.invoice_status.toLowerCase() as any) || "draft",
      invoiceDate: new Date(data.created_date),
      dueDate: new Date(data.due_date),
      lineItems: (data.line_items || []).map((item) => ({
        ...item,
        unitPrice: item.unit_price,
        total: item.quantity * item.unit_price,
      })),
      subtotal: data.total_price * 0.9,
      total: data.total_price,
      amountPaid: data.amount_paid,
      amountDue: data.total_price - (data.amount_paid || 0),
      notes: data.notes,
      sentAt: data.sent_date ? new Date(data.sent_date) : undefined,
    };
  }
}
