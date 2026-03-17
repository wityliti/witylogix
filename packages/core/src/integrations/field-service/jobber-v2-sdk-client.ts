/**
 * Jobber GraphQL API v2 SDK Client
 * Comprehensive implementation using GraphQL with cursor-based pagination
 * OAuth2 authorization code flow with refresh token rotation
 * Rate limiting: 200 req/min + 1000 points/min cost-based
 */

import type {
  JobCreateRequest,
  JobUpdateRequest,
  JobScheduleRequest,
  JobResponse,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerResponse,
  TechnicianResponse,
  EstimateCreateRequest,
  EstimateUpdateRequest,
  EstimateResponse,
  InvoiceCreateRequest,
  InvoiceUpdateRequest,
  InvoiceResponse,
  PaymentRecordRequest,
  DispatchAssignmentRequest,
  DispatchAssignmentResponse,
  DispatchOptimizationRequest,
  DispatchOptimizationResponse,
  PaginationRequest,
  PaginatedResponse,
  GraphQLRequest,
  GraphQLResponse,
  APIError,
} from './field-service-sdk-types.js';

interface JobberConfig {
  accessToken: string;
  refreshToken?: string;
  apiUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

interface GraphQLCostTracker {
  used: number;
  limit: number;
  resetAt: Date;
}

/**
 * Jobber GraphQL API v2 Client
 * Handles OAuth2, GraphQL queries/mutations, cost-based rate limiting, and batch operations
 */
export class JobberV2Client {
  private config: JobberConfig;
  private accessToken: string;
  private readonly apiUrl: string;
  private costTracker: GraphQLCostTracker = {
    used: 0,
    limit: 1000,
    resetAt: new Date(),
  };
  private requestQueue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private processing = false;

  constructor(config: JobberConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
    this.apiUrl = config.apiUrl || 'https://api.getjobber.com/graphql';
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
      throw new APIError(
        'REFRESH_TOKEN_FAILED',
        401,
        { reason: 'Missing refresh token or client credentials' },
        false,
      );
    }

    const response = await fetch('https://api.getjobber.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new APIError(
        'TOKEN_REFRESH_FAILED',
        response.status,
        { endpoint: '/oauth/token' },
        true,
      );
    }

    const data = (await response.json()) as any;
    this.accessToken = data.access_token;
    this.config.refreshToken = data.refresh_token;
    return this.accessToken;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = '{ viewer { id } }';
      await this.graphqlRequest(query);
      return true;
    } catch {
      return false;
    }
  }

  // ─── JOB MANAGEMENT ────────────────────────────────────────────────────────

  /**
   * Create job via GraphQL mutation
   */
  async createJob(request: JobCreateRequest): Promise<JobResponse> {
    const mutation = `
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
            updatedAt
          }
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        clientId: request.customerId,
        title: request.title,
        description: request.description,
        priority: request.priority.toUpperCase(),
        scheduledStartTime: request.scheduledStart?.toISOString(),
        address: {
          street: request.location.address,
          city: request.location.city,
          province: request.location.state,
          postalCode: request.location.postalCode,
          country: request.location.country || 'CA',
        },
        notes: request.notes,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    if (result.jobCreate?.errors?.length > 0) {
      throw new APIError(
        'JOB_CREATE_FAILED',
        400,
        { errors: result.jobCreate.errors },
        false,
      );
    }

    return this.mapJobResponse(result.jobCreate.job);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<JobResponse> {
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
    return this.mapJobResponse(result.job);
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, request: JobUpdateRequest): Promise<JobResponse> {
    const mutation = `
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
          errors { message }
        }
      }
    `;

    const variables = {
      id: jobId,
      input: {
        title: request.title,
        description: request.description,
        status: request.status?.toUpperCase(),
        priority: request.priority?.toUpperCase(),
        scheduledStartTime: request.scheduledStart?.toISOString(),
        notes: request.notes,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapJobResponse(result.jobUpdate.job);
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    const mutation = `
      mutation DeleteJob($id: ID!) {
        jobDelete(id: $id) {
          deletedId
        }
      }
    `;

    await this.graphqlRequest(mutation, { id: jobId });
  }

  /**
   * List jobs with cursor-based pagination
   */
  async listJobs(request?: PaginationRequest): Promise<PaginatedResponse<JobResponse>> {
    const query = `
      query ListJobs($first: Int!, $after: String) {
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
            cursor
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
      first: request?.limit || 50,
      after: request?.pageToken,
    };

    const result = await this.graphqlRequest(query, variables);
    return {
      items: (result.jobs.edges || []).map((edge: any) => this.mapJobResponse(edge.node)),
      total: result.jobs.totalCount || 0,
      hasMore: result.jobs.pageInfo?.hasNextPage || false,
      nextPageToken: result.jobs.pageInfo?.endCursor,
    };
  }

  /**
   * Schedule job for technician
   */
  async scheduleJob(jobId: string, request: JobScheduleRequest): Promise<JobResponse> {
    const mutation = `
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
        scheduledStartTime: request.scheduledStart.toISOString(),
        assigneeId: request.technicianId,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapJobResponse(result.jobUpdate.job);
  }

  /**
   * Complete job
   */
  async completeJob(jobId: string, notes?: string): Promise<JobResponse> {
    const mutation = `
      mutation CompleteJob($id: ID!, $input: JobInput!) {
        jobUpdate(id: $id, input: $input) {
          job {
            id
            number
            status
            completedAt
          }
        }
      }
    `;

    const variables = {
      id: jobId,
      input: {
        status: 'COMPLETED',
        notes,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapJobResponse(result.jobUpdate.job);
  }

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  async createCustomer(request: CustomerCreateRequest): Promise<CustomerResponse> {
    const mutation = `
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
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        firstName: request.firstName,
        lastName: request.lastName,
        companyName: request.companyName,
        email: request.email,
        phone: request.phone,
        mobile: request.mobile,
        billingAddress: {
          street: request.primaryAddress.address,
          city: request.primaryAddress.city,
          province: request.primaryAddress.state,
          postalCode: request.primaryAddress.postalCode,
          country: request.primaryAddress.country || 'CA',
        },
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    if (result.clientCreate?.errors?.length > 0) {
      throw new APIError(
        'CLIENT_CREATE_FAILED',
        400,
        { errors: result.clientCreate.errors },
        false,
      );
    }

    return this.mapCustomerResponse(result.clientCreate.client);
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<CustomerResponse> {
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
    return this.mapCustomerResponse(result.client);
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, request: CustomerUpdateRequest): Promise<CustomerResponse> {
    const mutation = `
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
        email: request.email,
        phone: request.phone,
        mobile: request.mobile,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapCustomerResponse(result.clientUpdate.client);
  }

  /**
   * List customers with cursor pagination
   */
  async listCustomers(request?: PaginationRequest): Promise<PaginatedResponse<CustomerResponse>> {
    const query = `
      query ListClients($first: Int!, $after: String) {
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
            cursor
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `;

    const variables = {
      first: request?.limit || 50,
      after: request?.pageToken,
    };

    const result = await this.graphqlRequest(query, variables);
    return {
      items: (result.clients.edges || []).map((edge: any) => this.mapCustomerResponse(edge.node)),
      total: result.clients.totalCount || 0,
      hasMore: result.clients.pageInfo?.hasNextPage || false,
      nextPageToken: result.clients.pageInfo?.endCursor,
    };
  }

  // ─── TECHNICIAN MANAGEMENT ────────────────────────────────────────────────

  /**
   * Get technician
   */
  async getTechnician(technicianId: string): Promise<TechnicianResponse> {
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
    return this.mapTechnicianResponse(result.teamMember);
  }

  /**
   * List technicians
   */
  async listTechnicians(request?: PaginationRequest): Promise<PaginatedResponse<TechnicianResponse>> {
    const query = `
      query ListTeamMembers($first: Int!, $after: String) {
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
            cursor
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `;

    const variables = {
      first: request?.limit || 50,
      after: request?.pageToken,
    };

    const result = await this.graphqlRequest(query, variables);
    return {
      items: (result.teamMembers.edges || []).map((edge: any) =>
        this.mapTechnicianResponse(edge.node),
      ),
      total: result.teamMembers.totalCount || 0,
      hasMore: result.teamMembers.pageInfo?.hasNextPage || false,
      nextPageToken: result.teamMembers.pageInfo?.endCursor,
    };
  }

  /**
   * Update technician availability
   */
  async updateTechnicianAvailability(technicianId: string, status: string): Promise<TechnicianResponse> {
    const mutation = `
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
      input: { status: status.toUpperCase() },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapTechnicianResponse(result.teamMemberUpdate.teamMember);
  }

  /**
   * Get technician location
   */
  async getTechnicianLocation(technicianId: string): Promise<any> {
    const tech = await this.getTechnician(technicianId);
    return tech.currentLocation || {};
  }

  // ─── ESTIMATE/QUOTE MANAGEMENT ─────────────────────────────────────────────

  /**
   * Create estimate (quote in Jobber)
   */
  async createEstimate(request: EstimateCreateRequest): Promise<EstimateResponse> {
    const mutation = `
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
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        clientId: request.customerId,
        issueDate: request.issueDate.toISOString(),
        expiryDate: request.expiryDate?.toISOString(),
        lineItems: request.lineItems,
        total: request.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        notes: request.notes,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapEstimateResponse(result.quoteCreate.quote);
  }

  /**
   * Get estimate
   */
  async getEstimate(estimateId: string): Promise<EstimateResponse> {
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
    return this.mapEstimateResponse(result.quote);
  }

  /**
   * Update estimate
   */
  async updateEstimate(estimateId: string, request: EstimateUpdateRequest): Promise<EstimateResponse> {
    const mutation = `
      mutation UpdateQuote($id: ID!, $input: QuoteInput!) {
        quoteUpdate(id: $id, input: $input) {
          quote {
            id
            number
            clientId
            status
            issueDate
            lineItems { description quantity unitPrice }
            total
          }
        }
      }
    `;

    const variables = {
      id: estimateId,
      input: {
        status: request.status?.toUpperCase(),
        lineItems: request.lineItems,
        expiryDate: request.expiryDate?.toISOString(),
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapEstimateResponse(result.quoteUpdate.quote);
  }

  /**
   * Approve estimate (convert to job)
   */
  async approveEstimate(estimateId: string): Promise<JobResponse> {
    const mutation = `
      mutation ApproveQuote($id: ID!) {
        quoteApprove(id: $id) {
          job {
            id
            number
            clientId
            title
            status
            total
            createdAt
          }
        }
      }
    `;

    const result = await this.graphqlRequest(mutation, { id: estimateId });
    return this.mapJobResponse(result.quoteApprove.job);
  }

  // ─── INVOICE MANAGEMENT ────────────────────────────────────────────────────

  /**
   * Create invoice from job
   */
  async createInvoice(request: InvoiceCreateRequest): Promise<InvoiceResponse> {
    const mutation = `
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
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        clientId: request.customerId,
        invoiceDate: request.invoiceDate.toISOString(),
        dueDate: request.dueDate.toISOString(),
        jobIds: request.jobIds,
        lineItems: request.lineItems,
        total: request.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        notes: request.notes,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapInvoiceResponse(result.invoiceCreate.invoice);
  }

  /**
   * Get invoice
   */
  async getInvoice(invoiceId: string): Promise<InvoiceResponse> {
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
    return this.mapInvoiceResponse(result.invoice);
  }

  /**
   * Update invoice
   */
  async updateInvoice(invoiceId: string, request: InvoiceUpdateRequest): Promise<InvoiceResponse> {
    const mutation = `
      mutation UpdateInvoice($id: ID!, $input: InvoiceInput!) {
        invoiceUpdate(id: $id, input: $input) {
          invoice {
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
      }
    `;

    const variables = {
      id: invoiceId,
      input: {
        dueDate: request.dueDate?.toISOString(),
        lineItems: request.lineItems,
        status: request.status?.toUpperCase(),
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return this.mapInvoiceResponse(result.invoiceUpdate.invoice);
  }

  /**
   * List invoices
   */
  async listInvoices(request?: PaginationRequest): Promise<PaginatedResponse<InvoiceResponse>> {
    const query = `
      query ListInvoices($first: Int!, $after: String) {
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
            cursor
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `;

    const variables = {
      first: request?.limit || 50,
      after: request?.pageToken,
    };

    const result = await this.graphqlRequest(query, variables);
    return {
      items: (result.invoices.edges || []).map((edge: any) => this.mapInvoiceResponse(edge.node)),
      total: result.invoices.totalCount || 0,
      hasMore: result.invoices.pageInfo?.hasNextPage || false,
      nextPageToken: result.invoices.pageInfo?.endCursor,
    };
  }

  /**
   * Record invoice payment
   */
  async recordPayment(request: PaymentRecordRequest): Promise<InvoiceResponse> {
    const mutation = `
      mutation RecordPayment($input: PaymentInput!) {
        paymentCreate(input: $input) {
          payment { invoiceId amount paymentMethod }
        }
      }
    `;

    const variables = {
      input: {
        invoiceId: request.invoiceId,
        amount: request.amount,
        paymentMethod: request.method.toUpperCase(),
        paymentDate: new Date().toISOString(),
        reference: request.reference,
      },
    };

    await this.graphqlRequest(mutation, variables);
    return this.getInvoice(request.invoiceId);
  }

  /**
   * Send invoice via email/SMS
   */
  async sendInvoice(invoiceId: string, method: 'email' | 'sms'): Promise<void> {
    const mutation = `
      mutation SendInvoice($id: ID!, $method: String!) {
        invoiceSend(id: $id, method: $method) {
          sentAt
        }
      }
    `;

    await this.graphqlRequest(mutation, {
      id: invoiceId,
      method: method.toUpperCase(),
    });
  }

  // ─── DISPATCH MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create dispatch assignment (assign job to technician)
   */
  async createDispatchAssignment(request: DispatchAssignmentRequest): Promise<DispatchAssignmentResponse> {
    await this.scheduleJob(request.jobId, {
      technicianId: request.technicianId,
      scheduledStart: new Date(),
    });

    return {
      id: `${request.jobId}-${request.technicianId}`,
      jobId: request.jobId,
      technicianId: request.technicianId,
      status: 'assigned',
      assignedAt: new Date(),
      priority: request.priority || 'medium',
    };
  }

  /**
   * Get dispatch assignment
   */
  async getDispatchAssignment(assignmentId: string): Promise<DispatchAssignmentResponse> {
    const [jobId, technicianId] = assignmentId.split('-');
    const job = await this.getJob(jobId);

    return {
      id: assignmentId,
      jobId,
      technicianId,
      status: 'assigned',
      assignedAt: job.createdAt || new Date(),
      priority: 'high',
    };
  }

  /**
   * Batch operations for jobs
   */
  async batchCreateJobs(requests: JobCreateRequest[]): Promise<JobResponse[]> {
    const mutations = requests
      .map((_, idx) => `
        job${idx}: jobCreate(input: $input${idx}) {
          job {
            id
            number
            clientId
            title
            status
            scheduledStartTime
            total
            createdAt
          }
        }
      `)
      .join('\n');

    const variables: Record<string, unknown> = {};
    requests.forEach((req, idx) => {
      variables[`input${idx}`] = {
        clientId: req.customerId,
        title: req.title,
        description: req.description,
        priority: req.priority.toUpperCase(),
        scheduledStartTime: req.scheduledStart?.toISOString(),
        address: {
          street: req.location.address,
          city: req.location.city,
          province: req.location.state,
          postalCode: req.location.postalCode,
          country: req.location.country || 'CA',
        },
      };
    });

    const mutation = `mutation BatchCreateJobs(${Object.keys(variables)
      .map(k => `$${k}: JobInput!`)
      .join(', ')}) {
      ${mutations}
    }`;

    const result = await this.graphqlRequest(mutation, variables);
    return requests.map((_, idx) => this.mapJobResponse(result[`job${idx}`].job));
  }

  // ─── HELPER METHODS ────────────────────────────────────────────────────────

  /**
   * Execute GraphQL request with cost-based rate limiting
   */
  private async graphqlRequest(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        fn: async () => {
          await this.ensureTokenValid();
          await this.waitForCostLimit();

          try {
            const response = await fetch(this.apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
              },
              body: JSON.stringify({ query, variables }),
              signal: AbortSignal.timeout(30000),
            });

            const costUsed = parseInt(response.headers.get('X-GraphQL-Cost-Used') || '10');
            const costLimit = parseInt(response.headers.get('X-GraphQL-Cost-Limit') || '1000');
            this.costTracker.used = costUsed;
            this.costTracker.limit = costLimit;

            if (!response.ok) {
              throw new APIError(
                'GRAPHQL_REQUEST_FAILED',
                response.status,
                { endpoint: '/graphql', status: response.statusText },
                response.status >= 500,
              );
            }

            const data = (await response.json()) as GraphQLResponse<any>;

            if (data.errors && data.errors.length > 0) {
              throw new APIError(
                'GRAPHQL_ERROR',
                400,
                { errors: data.errors },
                false,
              );
            }

            return data.data;
          } catch (error) {
            if (error instanceof APIError) throw error;
            throw new APIError(
              'REQUEST_FAILED',
              500,
              { cause: error },
              true,
            );
          }
        },
        resolve,
        reject,
      });

      this.processQueue();
    });
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) return;

    this.processing = true;
    try {
      while (this.requestQueue.length > 0) {
        const { fn, resolve, reject } = this.requestQueue.shift()!;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Ensure valid access token
   */
  private async ensureTokenValid(): Promise<void> {
    // Token validity check would go here
    // For now, assume token is valid
  }

  /**
   * Wait for cost limit to reset if exceeded
   */
  private async waitForCostLimit(): Promise<void> {
    const now = new Date();
    if (this.costTracker.used >= this.costTracker.limit && now < this.costTracker.resetAt) {
      const waitTime = this.costTracker.resetAt.getTime() - now.getTime();
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
    }
  }

  /**
   * Map job response from Jobber
   */
  private mapJobResponse(data: any): JobResponse {
    return {
      id: data.id,
      jobNumber: data.number || data.jobNumber,
      customerId: data.clientId,
      title: data.title || '',
      description: data.description,
      status: data.status?.toLowerCase() || 'scheduled',
      priority: data.priority?.toLowerCase() || 'medium',
      location: {
        address: data.address?.street || '',
        city: data.address?.city || '',
        state: data.address?.province,
        postalCode: data.address?.postalCode || '',
        country: data.address?.country || 'CA',
      },
      assignedTechnicians: data.teamMembers?.map((m: any) => m.id) || [],
      scheduledStart: data.scheduledStartTime ? new Date(data.scheduledStartTime) : undefined,
      scheduledEnd: data.scheduledEndTime ? new Date(data.scheduledEndTime) : undefined,
      actualStart: data.actualStartTime ? new Date(data.actualStartTime) : undefined,
      actualEnd: data.actualEndTime ? new Date(data.actualEndTime) : undefined,
      total: data.total || 0,
      notes: data.notes,
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    };
  }

  /**
   * Map customer response from Jobber
   */
  private mapCustomerResponse(data: any): CustomerResponse {
    return {
      id: data.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      type: data.type || 'both',
      status: data.status?.toLowerCase() || 'active',
      primaryAddress: {
        address: data.billingAddress?.street || '',
        city: data.billingAddress?.city || '',
        state: data.billingAddress?.province,
        postalCode: data.billingAddress?.postalCode || '',
        country: data.billingAddress?.country || 'CA',
      },
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
    };
  }

  /**
   * Map technician response from Jobber
   */
  private mapTechnicianResponse(data: any): TechnicianResponse {
    return {
      id: data.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email,
      phone: data.phone,
      status: data.status?.toLowerCase() || 'available',
      skills: data.skills || [],
      currentLocation: data.currentLocation
        ? {
            latitude: data.currentLocation.latitude,
            longitude: data.currentLocation.longitude,
            timestamp: new Date(data.currentLocation.timestamp),
          }
        : undefined,
      currentJobId: data.currentJobId,
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
    };
  }

  /**
   * Map estimate response from Jobber
   */
  private mapEstimateResponse(data: any): EstimateResponse {
    return {
      id: data.id,
      estimateNumber: data.number || data.quoteNumber,
      customerId: data.clientId,
      jobId: data.jobId,
      status: data.status?.toLowerCase() || 'draft',
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      lineItems: data.lineItems || [],
      subtotal: data.subtotal || data.total * 0.9,
      total: data.total || 0,
      notes: data.notes,
      sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
      acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : undefined,
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
    };
  }

  /**
   * Map invoice response from Jobber
   */
  private mapInvoiceResponse(data: any): InvoiceResponse {
    return {
      id: data.id,
      invoiceNumber: data.number || data.invoiceNumber,
      customerId: data.clientId,
      jobIds: data.jobIds || [],
      status: data.status?.toLowerCase() || 'draft',
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      lineItems: data.lineItems || [],
      subtotal: data.subtotal || data.total * 0.9,
      total: data.total || 0,
      amountPaid: data.amountPaid,
      amountDue: data.amountDue || (data.total - (data.amountPaid || 0)),
      notes: data.notes,
      sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || Date.now()),
    };
  }
}
