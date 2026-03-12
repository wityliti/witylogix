/**
 * Field Service Integration Types
 * Shared types for ServiceTitan, Jobber, HouseCall Pro, FieldEdge, and future field service providers
 * Supports job management, technician dispatch, scheduling, and equipment tracking
 */

// ─── ENUMS & CONSTANTS ──────────────────────────────────────────────────────

export type FieldServiceProvider = 'servicetitan' | 'jobber' | 'housecall-pro' | 'fieldedge';

export type JobStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'invoiced'
  | 'on_hold';

export type WorkOrderStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled';

export type TechnicianStatus = 'available' | 'busy' | 'on_break' | 'offline' | 'unavailable';

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'overdue'
  | 'paid'
  | 'partially_paid'
  | 'cancelled'
  | 'refunded';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export type DispatchStatus = 'unassigned' | 'assigned' | 'accepted' | 'en_route' | 'completed' | 'cancelled';

// ─── CORE FIELD SERVICE ENTITIES ────────────────────────────────────────────

/**
 * Job/Service appointment
 */
export interface Job {
  id?: string;
  externalId?: string;
  jobNumber: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  title: string;
  description?: string;
  status: JobStatus;
  priority: PriorityLevel;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  duration?: number; // minutes
  location: ServiceLocation;
  assignedTechnicians?: string[]; // technician IDs
  estimateId?: string;
  invoiceId?: string;
  serviceType?: string;
  lineItems?: ServiceLineItem[];
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

/**
 * Work Order (more detailed task within a job)
 */
export interface WorkOrder {
  id?: string;
  externalId?: string;
  workOrderNumber: string;
  jobId: string;
  status: WorkOrderStatus;
  description: string;
  priority: PriorityLevel;
  assignedTechnician?: string; // technician ID
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  checklist?: WorkOrderChecklist[];
  attachments?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkOrderChecklist {
  id: string;
  item: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

/**
 * Technician/Employee
 */
export interface Technician {
  id?: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status: TechnicianStatus;
  serviceTerritory?: string;
  skills?: string[];
  certifications?: TechnicianCertification[];
  vehicleAssignment?: VehicleAssignment;
  availability?: Availability[];
  currentLocation?: GeoLocation;
  currentJobId?: string;
  hoursWorked?: number;
  completedJobs?: number;
  rating?: number; // 0-5
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TechnicianCertification {
  name: string;
  expiryDate?: Date;
  verified?: boolean;
}

export interface VehicleAssignment {
  vehicleId: string;
  assignedAt: Date;
  status: 'active' | 'inactive';
}

export interface Availability {
  dayOfWeek: number; // 0-6 (Sun-Sat)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
}

/**
 * Service Territory
 */
export interface ServiceTerritory {
  id?: string;
  externalId?: string;
  name: string;
  description?: string;
  boundary?: GeoPolygon;
  managers?: string[]; // technician IDs
  assignedTechnicians?: string[];
  status: 'active' | 'inactive';
  metadata?: Record<string, unknown>;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>; // GeoJSON format
}

/**
 * Equipment/Asset
 */
export interface Equipment {
  id?: string;
  externalId?: string;
  equipmentNumber: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  location?: ServiceLocation;
  owner?: string; // technician or company ID
  purchaseDate?: Date;
  warrantyExpiration?: Date;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  hoursUsed?: number;
  cost?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Service Location
 */
export interface ServiceLocation {
  address: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

/**
 * Estimate/Quote
 */
export interface Estimate {
  id?: string;
  externalId?: string;
  estimateNumber: string;
  customerId: string;
  customerName?: string;
  jobId?: string;
  status: EstimateStatus;
  issueDate: Date;
  expiryDate?: Date;
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  total: number;
  notes?: string;
  termsAndConditions?: string;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  convertedToJobId?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EstimateLineItem {
  lineNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  taxable?: boolean;
  total: number;
}

/**
 * Invoice
 */
export interface Invoice {
  id?: string;
  externalId?: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  jobIds?: string[];
  status: InvoiceStatus;
  invoiceDate: Date;
  dueDate: Date;
  billingAddress?: ServiceLocation;
  shippingAddress?: ServiceLocation;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  payments?: PaymentRecord[];
  notes?: string;
  termsAndConditions?: string;
  sentAt?: Date;
  viewedAt?: Date;
  dueReminders?: DueReminder[];
  attachments?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceLineItem {
  lineNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  taxable?: boolean;
  total: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'check' | 'card' | 'bank_transfer' | 'online' | 'other';
  paidAt: Date;
  reference?: string;
}

export interface DueReminder {
  sentAt: Date;
  type: 'email' | 'sms' | 'in_app';
}

/**
 * Customer Record
 */
export interface CustomerRecord {
  id?: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  type: 'residential' | 'commercial' | 'both';
  status: 'active' | 'inactive' | 'blocked';
  primaryAddress: ServiceLocation;
  billingAddress?: ServiceLocation;
  shippingAddress?: ServiceLocation;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: string;
  preferredTechnician?: string;
  jobtags?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Membership/Service Plan
 */
export interface Membership {
  id?: string;
  externalId?: string;
  memberId: string;
  customerId: string;
  customerName?: string;
  planType: 'maintenance' | 'protection' | 'support' | 'premium' | 'custom';
  planName: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  billingFrequency: 'monthly' | 'quarterly' | 'annual';
  price: number;
  currency?: string;
  includedServices?: string[];
  visitFrequency?: number; // per year
  discountPercentage?: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schedule/Availability
 */
export interface Schedule {
  id?: string;
  externalId?: string;
  technician?: string; // technician ID
  dateStart: Date;
  dateEnd: Date;
  type: 'available' | 'unavailable' | 'training' | 'vacation' | 'sick_leave';
  recurring?: RecurringPattern;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[]; // 0-6
  endDate?: Date;
}

/**
 * Dispatch Assignment
 */
export interface DispatchAssignment {
  id?: string;
  externalId?: string;
  jobId: string;
  workOrderId?: string;
  technicianId: string;
  status: DispatchStatus;
  assignedAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  travelDistance?: number; // miles or km
  travelTime?: number; // minutes
  notes?: string;
  priority: PriorityLevel;
  metadata?: Record<string, unknown>;
}

/**
 * Service Line Item
 */
export interface ServiceLineItem {
  lineNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  taxable?: boolean;
  total: number;
}

// ─── CONFIGURATION & CONNECTION ────────────────────────────────────────────

/**
 * Field Service Connection with credentials and configuration
 */
export interface FieldServiceConnection {
  id: string;
  tenantId: string;
  provider: FieldServiceProvider;
  connectionName?: string;
  status: 'active' | 'inactive' | 'error' | 'expired' | 'pending_auth';
  credentials: FieldServiceCredentials;
  config: FieldServiceConnectionConfig;
  lastSyncAt?: Date;
  lastHealthCheckAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider-specific credentials (encrypted in database)
 */
export interface FieldServiceCredentials {
  // OAuth2 fields (Jobber, FieldEdge, HouseCall Pro)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  idToken?: string;

  // API key auth (ServiceTitan, ClearPathGPS, etc.)
  apiKey?: string;
  apiSecret?: string;
  apiToken?: string;

  // Basic auth
  username?: string;
  password?: string;

  // Provider-specific
  appKey?: string; // ServiceTitan
  tenantId?: string; // ServiceTitan
  clientId?: string;
  clientSecret?: string;
  siteUrl?: string; // HouseCall Pro, Jobber
  accountId?: string;

  // Custom metadata
  metadata?: Record<string, unknown>;
}

/**
 * Field Service Connection Configuration
 */
export interface FieldServiceConnectionConfig {
  // Connection behavior
  timeout?: number; // ms
  maxRetries?: number;
  retryDelayMs?: number;
  pollIntervalMs?: number;

  // Dispatch behavior
  autoDispatch?: boolean;
  maxJobsPerTechnician?: number;
  travelTimeBuffer?: number; // minutes

  // Webhook configuration
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;

  // Sync behavior
  batchSize?: number;
  pageSize?: number;
  rateLimitPerSecond?: number;

  // Custom mappings
  fieldMappings?: Record<string, FieldServiceFieldMapping>;

  // Advanced options
  customHeaders?: Record<string, string>;
  customParameters?: Record<string, unknown>;
}

/**
 * Field mapping between Witylogix and field service system
 */
export interface FieldServiceFieldMapping {
  entity: string;
  witylogixField: string;
  providerField: string;
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'currency' | 'enum';
  readOnly?: boolean;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── OPERATIONS & SYNC ──────────────────────────────────────────────────────

/**
 * Dispatch optimization request
 */
export interface DispatchOptimizationRequest {
  jobs: Job[];
  technicians: Technician[];
  constraints?: DispatchConstraints;
  optimizationGoals?: OptimizationGoal[];
}

export interface DispatchConstraints {
  maxJobsPerTechnician?: number;
  maxTravelDistance?: number;
  mustCompleteByTime?: Date;
  skillRequirements?: Map<string, string[]>;
  territoryRestrictions?: Map<string, string>;
}

export type OptimizationGoal = 'minimize_travel_time' | 'balance_workload' | 'respect_skills' | 'maximize_completion';

/**
 * Dispatch optimization result
 */
export interface DispatchOptimizationResult {
  assignments: DispatchAssignment[];
  unassignedJobs: string[];
  metrics: DispatchMetrics;
  executedAt: Date;
}

export interface DispatchMetrics {
  totalTravelTime: number;
  totalTravelDistance: number;
  jobsCovered: number;
  jobsUncovered: number;
  averageJobsPerTechnician: number;
  balanceScore: number; // 0-100
}

/**
 * Batch operation result
 */
export interface FieldServiceBatchResult<T = unknown> {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    recordId: string;
    externalId?: string;
    status: 'success' | 'failed' | 'skipped';
    data?: T;
    error?: string;
  }>;
  duration: number; // ms
}

/**
 * Field service operation error
 */
export interface FieldServiceOperationError extends Error {
  provider: FieldServiceProvider;
  code?: string;
  statusCode?: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ─── HELPER TYPES ──────────────────────────────────────────────────────────

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number; // Seconds to wait before retry
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
  offset?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
  pageToken?: string;
}
