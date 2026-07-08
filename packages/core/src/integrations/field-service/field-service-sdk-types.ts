/**
 * Unified Field Service SDK Types
 * Shared type definitions for ServiceTitan v2 and Jobber v2 SDKs
 * Provides consistent interfaces across different field service platforms
 */

// ─── AUTHENTICATION & OAUTH2 ───────────────────────────────────────────────

export interface OAuth2Credentials {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];
  grantType: "client_credentials" | "authorization_code" | "refresh_token";
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
}

// ─── RATE LIMITING ───────────────────────────────────────────────────────

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstSize?: number;
  retryAfterMs?: number;
  backoffMultiplier?: number;
  maxRetries?: number;
}

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfter: number,
    public readonly remaining: number,
    public readonly limit: number,
  ) {
    super(
      `Rate limited: ${remaining}/${limit} remaining, retry after ${retryAfter}ms`,
    );
    this.name = "RateLimitError";
  }
}

// ─── WEBHOOK HANDLING ───────────────────────────────────────────────────────

export interface WebhookEvent<T = Record<string, unknown>> {
  id: string;
  timestamp: Date;
  type: WebhookEventType;
  provider: "servicetitan" | "jobber";
  data: T;
  signature?: string;
}

export type WebhookEventType =
  | "job.created"
  | "job.updated"
  | "job.completed"
  | "job.cancelled"
  | "customer.created"
  | "customer.updated"
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.overdue"
  | "technician.location_updated"
  | "quote.created"
  | "quote.accepted"
  | "quote.rejected"
  | "payment.received";

export interface WebhookConfig {
  url: string;
  secret: string;
  events: WebhookEventType[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  verifySignature: boolean;
}

// ─── JOB MANAGEMENT ───────────────────────────────────────────────────────

export interface JobCreateRequest {
  customerId: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status?: "draft" | "scheduled" | "in_progress";
  scheduledStart?: Date;
  scheduledEnd?: Date;
  location: {
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  estimatedDuration?: number; // minutes
  notes?: string;
  lineItems?: JobLineItem[];
  customFields?: Record<string, unknown>;
}

export interface JobUpdateRequest {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledStart?: Date;
  scheduledEnd?: Date;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface JobScheduleRequest {
  technicianId: string;
  scheduledStart: Date;
  duration?: number; // minutes
  notes?: string;
}

export interface JobLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
  type?: "material" | "labor" | "equipment";
}

export interface JobResponse {
  id: string;
  jobNumber: string;
  customerId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  location: JobLocation;
  assignedTechnicians?: string[];
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  lineItems?: JobLineItem[];
  total?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface JobLocation {
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

// ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

export interface CustomerCreateRequest {
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type: "residential" | "commercial" | "both";
  primaryAddress: {
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country?: string;
  };
  billingAddress?: {
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country?: string;
  };
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface CustomerUpdateRequest {
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface CustomerResponse {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type: string;
  status: string;
  primaryAddress: JobLocation;
  billingAddress?: JobLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerLocation {
  id: string;
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  type: "primary" | "billing" | "shipping";
}

// ─── TECHNICIAN MANAGEMENT ───────────────────────────────────────────────────

export interface TechnicianResponse {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: "available" | "busy" | "offline";
  skills?: string[];
  certifications?: TechnicianCertification[];
  currentLocation?: GeoLocation;
  currentJobId?: string;
  hoursWorked?: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicianCertification {
  name: string;
  expiryDate?: Date;
  verified?: boolean;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

export interface TechnicianAvailability {
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  available: boolean;
}

// ─── ESTIMATE/QUOTE MANAGEMENT ───────────────────────────────────────────────

export interface EstimateCreateRequest {
  customerId: string;
  jobId?: string;
  issueDate: Date;
  expiryDate?: Date;
  lineItems: EstimateLineItem[];
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface EstimateLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
}

export interface EstimateUpdateRequest {
  status?: "draft" | "sent" | "accepted" | "rejected";
  lineItems?: EstimateLineItem[];
  notes?: string;
  expiryDate?: Date;
}

export interface EstimateResponse {
  id: string;
  estimateNumber: string;
  customerId: string;
  jobId?: string;
  status: string;
  issueDate: Date;
  expiryDate?: Date;
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxAmount?: number;
  total: number;
  notes?: string;
  sentAt?: Date;
  acceptedAt?: Date;
  convertedToJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── INVOICE MANAGEMENT ───────────────────────────────────────────────────

export interface InvoiceCreateRequest {
  customerId: string;
  jobIds?: string[];
  invoiceDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
}

export interface InvoiceUpdateRequest {
  dueDate?: Date;
  lineItems?: InvoiceLineItem[];
  notes?: string;
  status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobIds?: string[];
  status: string;
  invoiceDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecordRequest {
  invoiceId: string;
  amount: number;
  method: "cash" | "check" | "card" | "bank_transfer" | "online";
  reference?: string;
}

// ─── DISPATCH MANAGEMENT ───────────────────────────────────────────────────

export interface DispatchAssignmentRequest {
  jobId: string;
  technicianId: string;
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
}

export interface DispatchAssignmentResponse {
  id: string;
  jobId: string;
  technicianId: string;
  status: "assigned" | "accepted" | "in_progress" | "completed" | "cancelled";
  assignedAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  priority: string;
}

export interface DispatchOptimizationRequest {
  jobIds: string[];
  technicianIds: string[];
  constraints?: {
    maxJobsPerTechnician?: number;
    maxTravelTime?: number;
    skillRequirements?: Record<string, string[]>;
    preferredTechnicians?: Record<string, string>;
  };
  goals?: DispatchGoal[];
}

export type DispatchGoal =
  | "minimize_travel_time"
  | "minimize_travel_distance"
  | "balance_workload"
  | "respect_skills"
  | "maximize_completion";

export interface DispatchOptimizationResponse {
  assignments: DispatchAssignmentResponse[];
  unassignedJobIds: string[];
  metrics: {
    totalTravelTime: number;
    totalTravelDistance: number;
    jobsCovered: number;
    jobsUncovered: number;
    averageJobsPerTechnician: number;
  };
  executedAt: Date;
}

// ─── PRICEBOOK MANAGEMENT ───────────────────────────────────────────────────

export interface PricebookItem {
  id?: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  taxable?: boolean;
  type: "material" | "labor" | "equipment" | "service";
  unit?: string;
  estimatedTime?: number; // minutes (for labor)
}

export interface PricebookCategory {
  id?: string;
  name: string;
  description?: string;
  items?: PricebookItem[];
}

// ─── MEMBERSHIP MANAGEMENT ───────────────────────────────────────────────────

export interface MembershipPlan {
  id?: string;
  customerId: string;
  planType: "maintenance" | "protection" | "support" | "premium";
  planName: string;
  startDate: Date;
  renewalDate?: Date;
  status: "active" | "expired" | "cancelled";
  billingFrequency: "monthly" | "quarterly" | "annual";
  price: number;
  includedServices?: string[];
  visitFrequency?: number; // per year
}

// ─── PAGINATION ───────────────────────────────────────────────────────────

export interface PaginationRequest {
  limit?: number;
  offset?: number;
  pageToken?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextPageToken?: string;
  nextOffset?: number;
}

// ─── ERROR HANDLING ───────────────────────────────────────────────────────

export interface APIErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
  retryable: boolean;
  retryAfter?: number;
}

export class APIError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details: Record<string, unknown> = {},
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number,
  ) {
    super(`[${code}] ${statusCode}`);
    this.name = "APIError";
  }
}

// ─── BATCH OPERATIONS ───────────────────────────────────────────────────────

export interface BatchOperationRequest<T> {
  operations: Array<{
    id: string;
    operation: "create" | "update" | "delete";
    data: T;
  }>;
}

export interface BatchOperationResponse<T> {
  successful: T[];
  failed: Array<{
    id: string;
    error: APIError;
  }>;
  total: number;
  duration: number; // ms
}

// ─── GRAPHQL SUPPORT (JOBBER) ───────────────────────────────────────────────

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

// ─── REPORTING & METRICS ───────────────────────────────────────────────────

export interface JobReport {
  jobId: string;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  hoursWorked: number;
  technicianCount: number;
  completedAt?: Date;
}

export interface TechnicianMetrics {
  technicianId: string;
  jobsCompleted: number;
  totalRevenue: number;
  averageJobValue: number;
  utilizationRate: number; // 0-1
  avgRating: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface CustomerRetention {
  customerId: string;
  lastJobDate: Date;
  jobFrequency: number; // jobs per year
  retentionScore: number; // 0-1
  atRiskStatus: "low" | "medium" | "high";
}
