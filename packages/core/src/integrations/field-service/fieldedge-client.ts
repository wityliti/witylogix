/**
 * FieldEdge API Client
 * Implements work orders, dispatch, equipment tracking, inventory, and invoicing
 * OAuth2 authentication
 */

import { AbstractFieldServiceAdapter } from './field-service-adapter.js';
import type {
  Job,
  JobStatus,
  WorkOrder,
  WorkOrderStatus,
  Technician,
  Equipment,
  Invoice,
  CustomerRecord,
  DispatchAssignment,
  FieldServiceConnection,
  PaginationParams,
  PaginatedResult,
  FieldServiceBatchResult,
} from './types.js';

/** Map FieldEdge WorkOrderStatus to the normalized JobStatus. */
function workOrderStatusToJobStatus(status: WorkOrderStatus | undefined): JobStatus | undefined {
  if (status === undefined) return undefined;
  const map: Record<WorkOrderStatus, JobStatus> = {
    open: 'scheduled',
    assigned: 'scheduled',
    in_progress: 'in_progress',
    completed: 'completed',
    closed: 'completed',
    cancelled: 'cancelled',
  };
  return map[status] ?? 'scheduled';
}

interface FieldEdgeWorkOrderData {
  id: string;
  workOrderNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  description: string;
  priority: string;
  assignedTo?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  estimatedDuration?: number;
  actualDuration?: number;
  notes?: string;
  createdDate: string;
  modifiedDate: string;
}

interface FieldEdgeEquipmentData {
  id: string;
  equipmentNumber: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: string;
  location?: string;
  owner?: string;
  purchaseDate?: string;
  warrantyExpiration?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  hoursUsed?: number;
  cost?: number;
}

interface FieldEdgeInvoiceData {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  workOrderIds?: string[];
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

interface FieldEdgeTechnicianData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status: string;
  currentLocationLatitude?: number;
  currentLocationLongitude?: number;
  currentWorkOrderId?: string;
  skills?: string[];
}

interface FieldEdgeCustomerData {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  status: string;
}

/**
 * FieldEdge API Client
 */
export class FieldEdgeClient extends AbstractFieldServiceAdapter {
  private accessToken?: string;
  private apiUrl: string = 'https://api.fieldedge.com/v1';

  /**
   * Initialize FieldEdge client
   */
  constructor(connection: FieldServiceConnection) {
    super('fieldedge', connection);

    const { accessToken } = connection.credentials;
    if (!accessToken) {
      throw new Error('Missing FieldEdge credentials: accessToken');
    }

    this.accessToken = accessToken;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/work-orders?limit=1');
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
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
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
        `FieldEdge API error: ${response.statusText}`,
        'API_ERROR',
        response.status,
        response.status >= 500 || response.status === 429,
      );
    }

    return response.json();
  }

  // ─── JOB MANAGEMENT (via Work Orders) ──────────────────────────────────────

  /**
   * Create job
   */
  async createJob(job: Job): Promise<Job> {
    return this.executeWithRetry(async () => {
      const workOrder = await this.createWorkOrder({
        workOrderNumber: job.jobNumber,
        jobId: job.customerId,
        status: 'open' as WorkOrderStatus,
        description: job.title,
        priority: job.priority,
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
      });

      return {
        id: workOrder.id,
        externalId: workOrder.externalId,
        jobNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        title: workOrder.description,
        description: workOrder.description,
        status: workOrderStatusToJobStatus(workOrder.status) ?? 'scheduled',
        priority: workOrder.priority,
        scheduledStart: workOrder.scheduledStart,
        location: { address: '', city: '', postalCode: '', country: '' },
        createdAt: workOrder.createdAt,
      };
    });
  }

  /**
   * Get job
   */
  async getJob(jobId: string): Promise<Job> {
    return this.executeWithRetry(async () => {
      const workOrder = await this.getWorkOrder(jobId);
      return {
        id: workOrder.id,
        externalId: workOrder.externalId,
        jobNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        title: workOrder.description,
        description: workOrder.description,
        status: workOrderStatusToJobStatus(workOrder.status) ?? 'scheduled',
        priority: workOrder.priority,
        scheduledStart: workOrder.scheduledStart,
        location: { address: '', city: '', postalCode: '', country: '' },
        createdAt: workOrder.createdAt,
      };
    });
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    return this.executeWithRetry(async () => {
      const workOrder = await this.updateWorkOrder(jobId, {
        status: 'in_progress' as WorkOrderStatus,
        description: updates.title,
        priority: updates.priority,
      });

      return {
        id: workOrder.id,
        externalId: workOrder.externalId,
        jobNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        title: workOrder.description,
        description: workOrder.description,
        status: workOrderStatusToJobStatus(workOrder.status) ?? 'in_progress',
        priority: workOrder.priority,
        location: { address: '', city: '', postalCode: '', country: '' },
        createdAt: workOrder.createdAt,
      };
    });
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.deleteWorkOrder(jobId);
    });
  }

  /**
   * List jobs
   */
  async listJobs(params?: PaginationParams): Promise<PaginatedResult<Job>> {
    return this.executeWithRetry(async () => {
      const result = await this.listWorkOrders(params);
      return {
        ...result,
        items: result.items.map((wo) => ({
          id: wo.id,
          externalId: wo.externalId,
          jobNumber: wo.workOrderNumber,
          customerId: wo.jobId,
          title: wo.description,
          description: wo.description,
          status: workOrderStatusToJobStatus(wo.status) ?? 'scheduled',
          priority: wo.priority,
          scheduledStart: wo.scheduledStart,
          location: { address: '', city: '', postalCode: '', country: '' },
          createdAt: wo.createdAt,
        })),
      };
    });
  }

  // ─── WORK ORDER MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Create work order
   */
  async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const data = {
        workOrderNumber: workOrder.workOrderNumber,
        customerId: workOrder.jobId,
        status: workOrder.status,
        description: workOrder.description,
        priority: workOrder.priority,
        scheduledStart: workOrder.scheduledStart?.toISOString(),
        scheduledEnd: workOrder.scheduledEnd?.toISOString(),
        notes: workOrder.notes,
      };

      const response = await this.request('POST', '/work-orders', data);
      return this.mapWorkOrderFromProvider(response);
    });
  }

  /**
   * Get work order
   */
  async getWorkOrder(workOrderId: string): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/work-orders/${workOrderId}`);
      return this.mapWorkOrderFromProvider(response);
    });
  }

  /**
   * Update work order
   */
  async updateWorkOrder(workOrderId: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    return this.executeWithRetry(async () => {
      const data: Record<string, unknown> = {};
      if (updates.status) data.status = updates.status;
      if (updates.description) data.description = updates.description;
      if (updates.priority) data.priority = updates.priority;

      const response = await this.request('PATCH', `/work-orders/${workOrderId}`, data);
      return this.mapWorkOrderFromProvider(response);
    });
  }

  /**
   * Delete work order
   */
  async deleteWorkOrder(workOrderId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request('DELETE', `/work-orders/${workOrderId}`);
    });
  }

  /**
   * List work orders
   */
  async listWorkOrders(params?: PaginationParams): Promise<PaginatedResult<WorkOrder>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: ((params?.limit) || 50).toString(),
        offset: ((params?.offset) || 0).toString(),
      });

      const response = await this.request('GET', `/work-orders?${queryParams}`);
      const items = (response.data || []).map((item: FieldEdgeWorkOrderData) =>
        this.mapWorkOrderFromProvider(item),
      );

      return {
        items,
        total: response.total || 0,
        hasMore: !!response.nextCursor,
        pageToken: response.nextCursor,
      };
    });
  }

  // ─── TECHNICIAN MANAGEMENT ────────────────────────────────────────────────

  /**
   * Get technician
   */
  async getTechnician(technicianId: string): Promise<Technician> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/technicians/${technicianId}`);
      return this.mapTechnicianFromProvider(response);
    });
  }

  /**
   * List technicians
   */
  async listTechnicians(params?: PaginationParams): Promise<PaginatedResult<Technician>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: ((params?.limit) || 50).toString(),
        offset: ((params?.offset) || 0).toString(),
      });

      const response = await this.request('GET', `/technicians?${queryParams}`);
      const items = (response.data || []).map((item: FieldEdgeTechnicianData) =>
        this.mapTechnicianFromProvider(item),
      );

      return {
        items,
        total: response.total || 0,
        hasMore: !!response.nextCursor,
        pageToken: response.nextCursor,
      };
    });
  }

  /**
   * Update technician availability
   */
  async updateTechnicianAvailability(technicianId: string, status: string): Promise<Technician> {
    return this.executeWithRetry(async () => {
      const data = { status };
      const response = await this.request('PATCH', `/technicians/${technicianId}`, data);
      return this.mapTechnicianFromProvider(response);
    });
  }

  /**
   * Get technician location
   */
  async getTechnicianLocation(technicianId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/technicians/${technicianId}/location`);
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
        technicianId: schedule.technician,
        startDate: schedule.dateStart.toISOString().split('T')[0],
        endDate: schedule.dateEnd.toISOString().split('T')[0],
        type: schedule.type,
      };

      const response = await this.request('POST', '/schedules', data);
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
        technicianId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      const response = await this.request('GET', `/availability?${queryParams}`);
      return (response.slots || []).map((slot: any) => ({
        start: new Date(slot.startTime),
        end: new Date(slot.endTime),
      }));
    });
  }

  /**
   * Schedule job for technician
   */
  async scheduleJob(jobId: string, technicianId: string, start: Date): Promise<Job> {
    return this.executeWithRetry(async () => {
      const data = { assignedTo: technicianId, scheduledStart: start.toISOString() };
      const response = await this.request('PATCH', `/work-orders/${jobId}`, data);
      return this.getJob(response.id);
    });
  }

  // ─── EQUIPMENT MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get equipment
   */
  async getEquipment(equipmentId: string): Promise<Equipment> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/equipment/${equipmentId}`);
      return this.mapEquipmentFromProvider(response);
    });
  }

  /**
   * List equipment
   */
  async listEquipment(params?: PaginationParams): Promise<PaginatedResult<Equipment>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: ((params?.limit) || 50).toString(),
        offset: ((params?.offset) || 0).toString(),
      });

      const response = await this.request('GET', `/equipment?${queryParams}`);
      const items = (response.data || []).map((item: FieldEdgeEquipmentData) =>
        this.mapEquipmentFromProvider(item),
      );

      return {
        items,
        total: response.total || 0,
        hasMore: !!response.nextCursor,
        pageToken: response.nextCursor,
      };
    });
  }

  /**
   * Get equipment service history
   */
  async getEquipmentServiceHistory(equipmentId: string): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/equipment/${equipmentId}/service-history`);
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
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        address: customer.primaryAddress.address,
        city: customer.primaryAddress.city,
        state: customer.primaryAddress.state,
        zipCode: customer.primaryAddress.postalCode,
        country: customer.primaryAddress.country,
        status: customer.status || 'active',
      };

      const response = await this.request('POST', '/customers', data);
      return this.mapCustomerFromProvider(response);
    });
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/customers/${customerId}`);
      return this.mapCustomerFromProvider(response);
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, updates: Partial<CustomerRecord>): Promise<CustomerRecord> {
    return this.executeWithRetry(async () => {
      const data: Record<string, unknown> = {};
      if (updates.email) data.email = updates.email;
      if (updates.phone) data.phone = updates.phone;
      if (updates.mobile) data.mobile = updates.mobile;

      const response = await this.request('PATCH', `/customers/${customerId}`, data);
      return this.mapCustomerFromProvider(response);
    });
  }

  /**
   * List customers
   */
  async listCustomers(params?: PaginationParams): Promise<PaginatedResult<CustomerRecord>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: ((params?.limit) || 50).toString(),
        offset: ((params?.offset) || 0).toString(),
      });

      const response = await this.request('GET', `/customers?${queryParams}`);
      const items = (response.data || []).map((item: FieldEdgeCustomerData) =>
        this.mapCustomerFromProvider(item),
      );

      return {
        items,
        total: response.total || 0,
        hasMore: !!response.nextCursor,
        pageToken: response.nextCursor,
      };
    });
  }

  // ─── ESTIMATES & INVOICES ──────────────────────────────────────────────────

  /**
   * Create estimate (not available in FieldEdge)
   */
  async createEstimate(): Promise<any> {
    throw this.createOperationError('Estimates not supported in FieldEdge', 'NOT_SUPPORTED', 400, false);
  }

  /**
   * Get estimate (not available in FieldEdge)
   */
  async getEstimate(): Promise<any> {
    throw this.createOperationError('Estimates not supported in FieldEdge', 'NOT_SUPPORTED', 400, false);
  }

  /**
   * Create invoice
   */
  async createInvoice(invoice: Invoice): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const data = {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        invoiceDate: invoice.invoiceDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        lineItems: invoice.lineItems,
        total: invoice.total,
        notes: invoice.notes,
      };

      const response = await this.request('POST', '/invoices', data);
      return this.mapInvoiceFromProvider(response);
    });
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/invoices/${invoiceId}`);
      return this.mapInvoiceFromProvider(response);
    });
  }

  /**
   * List invoices
   */
  async listInvoices(params?: PaginationParams): Promise<PaginatedResult<Invoice>> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        limit: ((params?.limit) || 50).toString(),
        offset: ((params?.offset) || 0).toString(),
      });

      const response = await this.request('GET', `/invoices?${queryParams}`);
      const items = (response.data || []).map((item: FieldEdgeInvoiceData) =>
        this.mapInvoiceFromProvider(item),
      );

      return {
        items,
        total: response.total || 0,
        hasMore: !!response.nextCursor,
        pageToken: response.nextCursor,
      };
    });
  }

  /**
   * Record invoice payment
   */
  async recordPayment(invoiceId: string, amount: number, method: string): Promise<Invoice> {
    return this.executeWithRetry(async () => {
      const data = { amount, paymentMethod: method, paymentDate: new Date().toISOString() };
      await this.request('POST', `/invoices/${invoiceId}/payments`, data);
      return this.getInvoice(invoiceId);
    });
  }

  // ─── DISPATCH OPERATIONS ───────────────────────────────────────────────────

  /**
   * Create dispatch assignment
   */
  async createDispatchAssignment(assignment: DispatchAssignment): Promise<DispatchAssignment> {
    return this.executeWithRetry(async () => {
      const data = {
        workOrderId: assignment.jobId,
        technicianId: assignment.technicianId,
      };

      const response = await this.request('POST', '/dispatch', data);
      return {
        id: response.id,
        externalId: response.id,
        jobId: response.workOrderId,
        technicianId: response.technicianId,
        status: 'assigned',
        assignedAt: new Date(),
        priority: assignment.priority,
      };
    });
  }

  /**
   * Get dispatch assignment
   */
  async getDispatchAssignment(assignmentId: string): Promise<DispatchAssignment> {
    return this.executeWithRetry(async () => {
      const response = await this.request('GET', `/dispatch/${assignmentId}`);
      return {
        id: response.id,
        externalId: response.id,
        jobId: response.workOrderId,
        technicianId: response.technicianId,
        status: response.status,
        assignedAt: new Date(response.assignedDate),
        priority: 'high',
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

      const response = await this.request('PATCH', `/dispatch/${assignmentId}`, data);
      return this.getDispatchAssignment(response.id);
    });
  }

  /**
   * Cancel dispatch assignment
   */
  async cancelDispatchAssignment(assignmentId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.request('DELETE', `/dispatch/${assignmentId}`);
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
      if (result.status === 'fulfilled') {
        batchResult.successful++;
        batchResult.results.push({
          recordId: jobs[index]!.id || '',
          externalId: result.value.externalId,
          status: 'success',
          data: result.value,
        });
      } else {
        batchResult.failed++;
        batchResult.results.push({
          recordId: jobs[index]!.id || '',
          status: 'failed',
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
      if (result.status === 'fulfilled') {
        batchResult.successful++;
        batchResult.results.push({
          recordId: updates[index]!.jobId,
          externalId: result.value.externalId,
          status: 'success',
          data: result.value,
        });
      } else {
        batchResult.failed++;
        batchResult.results.push({
          recordId: updates[index]!.jobId,
          status: 'failed',
          error: (result.reason as any).message,
        });
      }
    });

    return batchResult;
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────────

  /**
   * Map work order from FieldEdge response
   */
  private mapWorkOrderFromProvider(data: FieldEdgeWorkOrderData): WorkOrder {
    return {
      id: data.id,
      externalId: data.id,
      workOrderNumber: data.workOrderNumber,
      jobId: data.customerId,
      status: (data.status.toLowerCase() as any) || 'open',
      description: data.description,
      priority: (data.priority.toLowerCase() as any) || 'medium',
      assignedTechnician: data.assignedTo,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      actualStart: data.actualStart ? new Date(data.actualStart) : undefined,
      actualEnd: data.actualEnd ? new Date(data.actualEnd) : undefined,
      estimatedDuration: data.estimatedDuration,
      actualDuration: data.actualDuration,
      notes: data.notes,
      createdAt: new Date(data.createdDate),
      updatedAt: new Date(data.modifiedDate),
    };
  }

  /**
   * Map technician from FieldEdge response
   */
  private mapTechnicianFromProvider(data: FieldEdgeTechnicianData): Technician {
    return {
      id: data.id,
      externalId: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      status: (data.status.toLowerCase() as any) || 'available',
      skills: data.skills || [],
      currentLocation: data.currentLocationLatitude && data.currentLocationLongitude
        ? {
            latitude: data.currentLocationLatitude,
            longitude: data.currentLocationLongitude,
            timestamp: new Date(),
          }
        : undefined,
      currentJobId: data.currentWorkOrderId,
    };
  }

  /**
   * Map equipment from FieldEdge response
   */
  private mapEquipmentFromProvider(data: FieldEdgeEquipmentData): Equipment {
    return {
      id: data.id,
      externalId: data.id,
      equipmentNumber: data.equipmentNumber,
      name: data.name,
      type: data.type,
      manufacturer: data.manufacturer,
      model: data.model,
      serialNumber: data.serialNumber,
      status: (data.status.toLowerCase() as any) || 'active',
      owner: data.owner,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : undefined,
      lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : undefined,
      nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
      hoursUsed: data.hoursUsed,
      cost: data.cost,
    };
  }

  /**
   * Map customer from FieldEdge response
   */
  private mapCustomerFromProvider(data: FieldEdgeCustomerData): CustomerRecord {
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
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.zipCode,
        country: data.country,
      },
      type: 'both',
      status: (data.status.toLowerCase() as any) || 'active',
    };
  }

  /**
   * Map invoice from FieldEdge response
   */
  private mapInvoiceFromProvider(data: FieldEdgeInvoiceData): Invoice {
    return {
      id: data.id,
      externalId: data.id,
      invoiceNumber: data.invoiceNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      jobIds: data.workOrderIds,
      status: (data.status.toLowerCase() as any) || 'draft',
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      lineItems: (data.lineItems || []).map((item) => ({ ...item, total: item.quantity * item.unitPrice })),
      subtotal: data.total * 0.9,
      total: data.total,
      amountPaid: data.amountPaid,
      amountDue: (data.total - (data.amountPaid || 0)),
      notes: data.notes,
      createdAt: new Date(data.createdDate),
      updatedAt: new Date(data.modifiedDate),
    };
  }
}
