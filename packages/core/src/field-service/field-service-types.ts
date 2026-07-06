/**
 * Field Service Domain Types — Comprehensive definitions for work order, technician, scheduling, and dispatch.
 *
 * This module defines all core domain models for the field service management system including:
 * - Work order lifecycle (creation through completion)
 * - Technician profiles with skills and certifications
 * - Scheduling constraints and job allocation
 * - Dispatch optimization parameters
 * - SLA (Service Level Agreement) definitions
 * - Service zones and skill matrices
 *
 * Key principles:
 * - All timestamps are ISO 8601 UTC
 * - Enums use SCREAMING_SNAKE_CASE
 * - IDs are UUIDs
 * - Geographic coordinates: latitude [-90, 90], longitude [-180, 180]
 */

// ─── WORK ORDER TYPES ────────────────────────────────────────────

/**
 * Work order type classification.
 * Determines service category and required expertise.
 */
export type WorkOrderType =
  | "SERVICE"
  | "INSTALL"
  | "REPAIR"
  | "MAINTENANCE"
  | "INSPECTION";

/**
 * Work order priority level.
 * Drives scheduling urgency and SLA windows.
 */
export type WorkOrderPriority = "EMERGENCY" | "HIGH" | "MEDIUM" | "LOW";

/**
 * Work order lifecycle status.
 * Represents current state from creation through completion.
 */
export type WorkOrderStatus =
  | "CREATED" // Just created, not yet scheduled
  | "SCHEDULED" // Scheduled for specific date/time
  | "DISPATCHED" // Assigned to technician, en-route dispatch confirmation sent
  | "EN_ROUTE" // Technician confirmed departure to job site
  | "IN_PROGRESS" // Technician arrived and started work
  | "COMPLETED" // Work finished, customer signed, invoice generated
  | "CANCELLED"; // Job cancelled before completion

/**
 * Core work order entity.
 * Represents a service request that needs to be assigned to and completed by a technician.
 */
export interface WorkOrder {
  /** Unique identifier (UUID). */
  id: string;

  /** Customer account ID. */
  customerId: string;

  /** Work order type (service category). */
  type: WorkOrderType;

  /** Priority level determining SLA and scheduling urgency. */
  priority: WorkOrderPriority;

  /** Current lifecycle status. */
  status: WorkOrderStatus;

  /** Detailed description of work to be performed. */
  description: string;

  /** Array of required skill/certification codes. e.g., ["HVAC_CERT", "EPA_608"]. */
  requiredSkills: string[];

  /** Estimated duration in minutes (used for scheduling). */
  estimatedDuration: number;

  /** Actual duration in minutes (populated after completion). */
  actualDuration?: number;

  /** Scheduled start time (ISO 8601 UTC). */
  scheduledStart?: Date;

  /** Scheduled end time (ISO 8601 UTC). Derived from scheduledStart + estimatedDuration. */
  scheduledEnd?: Date;

  /** Service address with full details. */
  address: Address;

  /** Assigned technician ID (set when dispatched). */
  technicianId?: string;

  /** Parts required/used for this job. */
  parts: WorkOrderPart[];

  /** Free-form notes (technician observations, customer requests, etc.). */
  notes: string[];

  /** Signature metadata (customer sign-off). */
  signatures: SignatureData[];

  /** Photo metadata (before/after, issues found, etc.). */
  photos: PhotoData[];

  /** Linked invoice ID (set after completion). */
  invoiceId?: string;

  /** SLA definition ID to use for this work order. */
  slaRuleId: string;

  /** When SLA was breached (if applicable). */
  slaBreachAt?: Date;

  /** Internal metadata for scheduling and dispatch. */
  metadata?: Record<string, unknown>;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Part usage record for a work order.
 * Tracks inventory items consumed during job.
 */
export interface WorkOrderPart {
  /** Part/SKU ID. */
  partId: string;

  /** Part name for display. */
  name: string;

  /** Quantity used. */
  quantity: number;

  /** Unit cost at time of usage. */
  unitCost: number;

  /** Whether part was charged to customer. */
  billable: boolean;
}

/**
 * Customer signature data for work completion.
 */
export interface SignatureData {
  /** Signature timestamp (ISO 8601 UTC). */
  timestamp: Date;

  /** Signer name. */
  signerName: string;

  /** Base64-encoded image data or S3 URL. */
  signatureData: string;

  /** Signature type ("CUSTOMER" or "TECHNICIAN"). */
  type: "CUSTOMER" | "TECHNICIAN";
}

/**
 * Photo metadata for work order.
 * Stores reference to images taken during job.
 */
export interface PhotoData {
  /** Photo timestamp (ISO 8601 UTC). */
  timestamp: Date;

  /** Photo URL (S3 or similar). */
  url: string;

  /** Photo description/caption. */
  description: string;

  /** Category (e.g., "BEFORE", "AFTER", "DAMAGE", "COMPLETED"). */
  category: string;
}

// ─── TECHNICIAN TYPES ────────────────────────────────────────────

/**
 * Technician availability status.
 * Determines whether tech can accept new work.
 */
export type TechnicianStatus =
  | "AVAILABLE"
  | "EN_ROUTE"
  | "ON_JOB"
  | "BREAK"
  | "OFF_DUTY";

/**
 * Working hours pattern for a technician.
 */
export interface WorkingHours {
  /** Start time (HH:MM in 24-hour format). */
  startTime: string;

  /** End time (HH:MM in 24-hour format). */
  endTime: string;

  /** Days of week (0 = Sunday, 6 = Saturday). */
  daysOfWeek: number[];

  /** Timezone identifier (e.g., "America/New_York"). */
  timezone: string;
}

/**
 * Technician entity.
 * Represents field service personnel with skills, availability, and current status.
 */
export interface Technician {
  /** Unique identifier (UUID). */
  id: string;

  /** Full name. */
  name: string;

  /** Array of skill codes (matching WorkOrder.requiredSkills). e.g., ["HVAC_CERT", "EPA_608"]. */
  skills: string[];

  /** Professional certifications held. e.g., ["EPA_608", "EPA_609", "RYU_LICENSED"]. */
  certifications: string[];

  /** Home base location address. */
  homeBase: Address;

  /** Current location (latitude/longitude). Updated in real-time. */
  currentLocation: Coordinates;

  /** Current availability status. */
  status: TechnicianStatus;

  /** Working hours definition. */
  workingHours: WorkingHours;

  /** Service zones this technician is authorized to work in. */
  serviceZones: ServiceZone[];

  /** Assigned vehicle ID (if applicable). */
  vehicleId?: string;

  /** Performance metrics (utilization, rating, etc.). */
  performanceMetrics: PerformanceMetrics;

  /** Metadata and flags. */
  metadata?: Record<string, unknown>;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Technician performance tracking.
 */
export interface PerformanceMetrics {
  /** Total jobs completed. */
  totalJobsCompleted: number;

  /** Average customer rating (1-5 stars). */
  averageRating: number;

  /** Average job duration vs. estimate (ratio). */
  averageEfficiencyRatio: number;

  /** Percentage of jobs completed within SLA. */
  slaComplianceRate: number;

  /** Total customer complaints. */
  complaintCount: number;

  /** Last 30-day utilization percentage. */
  utilizationRate30d: number;

  /** Response time to dispatch (average minutes). */
  averageResponseTime: number;

  /** Last performance update timestamp. */
  lastUpdatedAt: Date;
}

// ─── SCHEDULING TYPES ────────────────────────────────────────────

/**
 * Time slot availability for a technician.
 */
export interface TimeSlot {
  /** Slot start time (ISO 8601 UTC). */
  startTime: Date;

  /** Slot end time (ISO 8601 UTC). */
  endTime: Date;

  /** Available duration in minutes. */
  durationMinutes: number;

  /** Is this slot available (not booked). */
  available: boolean;

  /** Type of slot ("WORK", "BREAK", "TRAVEL", "BUFFER"). */
  type: "WORK" | "BREAK" | "TRAVEL" | "BUFFER";
}

/**
 * Daily job schedule for a technician.
 */
export interface JobSchedule {
  /** Technician ID. */
  technicianId: string;

  /** Schedule date (YYYY-MM-DD). */
  date: string;

  /** Scheduled job slots for the day. */
  slots: TimeSlot[];

  /** Break periods during the day. */
  breaks: TimeSlot[];

  /** Estimated total travel time (minutes) for the day. */
  travelTime: number;

  /** Utilization percentage (booked time / working hours). */
  utilization: number;

  /** Metadata. */
  metadata?: Record<string, unknown>;

  /** Last updated timestamp. */
  updatedAt: Date;
}

/**
 * Dispatch result with scoring and routing info.
 * Returned from dispatch optimization algorithms.
 */
export interface DispatchResult {
  /** Work order ID. */
  jobId: string;

  /** Assigned technician ID. */
  technicianId: string;

  /** Dispatch score (0-100). Higher is better match. */
  score: number;

  /** Reason/explanation for this dispatch assignment. */
  reason: string;

  /** Estimated arrival time at job site (ISO 8601 UTC). */
  eta: Date;

  /** Distance from technician's current location to job (km). */
  distance: number;

  /** Estimated travel time (minutes). */
  travelMinutes: number;

  /** All competing candidates considered. */
  candidates?: DispatchCandidate[];
}

/**
 * Candidate technician for dispatch consideration.
 */
export interface DispatchCandidate {
  /** Technician ID. */
  technicianId: string;

  /** Dispatch score for this candidate. */
  score: number;

  /** Why this candidate was ranked. */
  reason: string;

  /** Estimated arrival (ISO 8601 UTC). */
  eta: Date;

  /** Distance (km). */
  distance: number;

  /** Ranking (1 = best). */
  rank: number;
}

// ─── RECURRING PLAN TYPES ───────────────────────────────────────

/**
 * Frequency pattern for recurring work orders.
 */
export type RecurrenceFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY";

/**
 * Recurring service plan.
 * Generates multiple work orders from a template on schedule.
 */
export interface RecurringPlan {
  /** Unique identifier (UUID). */
  id: string;

  /** Customer ID. */
  customerId: string;

  /** Service description (used as template). */
  description: string;

  /** Service type. */
  type: WorkOrderType;

  /** Required skills for all generated jobs. */
  requiredSkills: string[];

  /** Service address (same for all generated jobs). */
  address: Address;

  /** Estimated duration per instance (minutes). */
  estimatedDuration: number;

  /** Recurrence pattern. */
  frequency: RecurrenceFrequency;

  /** Day of week for weekly plans (0-6). */
  dayOfWeek?: number;

  /** Day of month for monthly/quarterly plans (1-31). */
  dayOfMonth?: number;

  /** Preferred time of day (HH:MM). */
  preferredTime: string;

  /** Timezone for scheduling. */
  timezone: string;

  /** Active status. */
  active: boolean;

  /** Recurrence ends on this date (or null for indefinite). */
  endDate?: Date;

  /** Custom SLA rule ID for all generated jobs. */
  slaRuleId: string;

  /** Metadata. */
  metadata?: Record<string, unknown>;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
}

// ─── SERVICE ZONE TYPES ──────────────────────────────────────────

/**
 * Geographic service zone.
 * Technicians are assigned to zones and can only work within them.
 */
export interface ServiceZone {
  /** Unique identifier (UUID). */
  id: string;

  /** Zone name (e.g., "North Seattle"). */
  name: string;

  /** Zone type ("POLYGON", "CIRCLE", or "CUSTOM"). */
  type: "POLYGON" | "CIRCLE" | "CUSTOM";

  /** Coordinates for boundary. */
  coordinates: Coordinates[];

  /** Radius (km) for CIRCLE type zones. */
  radius?: number;

  /** Zone color for UI display (hex). */
  color?: string;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
}

// ─── SKILL MATRIX TYPES ──────────────────────────────────────────

/**
 * Skill/certification definition and requirements.
 */
export interface SkillMatrix {
  /** Skill code (e.g., "HVAC_CERT"). */
  code: string;

  /** Skill display name. */
  name: string;

  /** Detailed description. */
  description: string;

  /** Required certifications (nested). e.g., ["EPA_608", "EPA_609"]. */
  requiredCertifications: string[];

  /** Training provider (e.g., "HVAC Academy"). */
  trainingProvider?: string;

  /** Renewal period (months). */
  renewalPeriodMonths?: number;

  /** Cost to renew. */
  renewalCost?: number;

  /** Is skill active. */
  active: boolean;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
}

// ─── SLA TYPES ──────────────────────────────────────────────────

/**
 * Service Level Agreement rule.
 * Defines response and completion time windows by priority.
 */
export interface SLARule {
  /** Unique identifier (UUID). */
  id: string;

  /** Rule name (e.g., "Standard SLA", "Premium SLA"). */
  name: string;

  /** Description. */
  description: string;

  /** SLA windows by priority. */
  windows: {
    /** Priority level. */
    priority: WorkOrderPriority;

    /** Response time window (minutes). */
    responseTimeMinutes: number;

    /** Completion time window (minutes). */
    completionTimeMinutes: number;

    /** Penalty for breach (% of service cost). */
    breachPenaltyPercent?: number;
  }[];

  /** Is this rule active. */
  active: boolean;

  /** Timestamps. */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SLA status for a work order.
 */
export interface SLAStatus {
  /** Work order ID. */
  jobId: string;

  /** SLA rule ID. */
  slaRuleId: string;

  /** Current priority. */
  priority: WorkOrderPriority;

  /** Expected response deadline (ISO 8601 UTC). */
  responseDeadline: Date;

  /** Expected completion deadline (ISO 8601 UTC). */
  completionDeadline: Date;

  /** Has SLA been breached. */
  breached: boolean;

  /** Breach type ("RESPONSE" or "COMPLETION"). */
  breachType?: "RESPONSE" | "COMPLETION";

  /** How many minutes late (if breached). */
  minutesLate?: number;

  /** Current status percentage towards deadline. */
  statusPercent: number;
}

// ─── ADDRESS & COORDINATE TYPES ──────────────────────────────────

/**
 * Geographic coordinates.
 */
export interface Coordinates {
  /** Latitude (-90 to 90). */
  latitude: number;

  /** Longitude (-180 to 180). */
  longitude: number;
}

/**
 * Full address structure.
 */
export interface Address {
  /** Street address line 1. */
  street: string;

  /** Street address line 2 (apartment, suite, etc.). */
  street2?: string;

  /** City. */
  city: string;

  /** State/province. */
  state: string;

  /** Postal/ZIP code. */
  postalCode: string;

  /** Country code (ISO 3166-1 alpha-2). */
  country: string;

  /** Geographic coordinates. */
  coordinates: Coordinates;

  /** Notes about location (gate codes, access instructions, etc.). */
  notes?: string;
}

// ─── CONSTRAINT VIOLATION TYPES ──────────────────────────────────

/**
 * Scheduling or dispatch constraint violation.
 */
export interface ConstraintViolation {
  /** Violation type/code. */
  type: string;

  /** Human-readable message. */
  message: string;

  /** Severity ("WARNING" or "ERROR"). */
  severity: "WARNING" | "ERROR";

  /** Affected work order ID. */
  jobId?: string;

  /** Affected technician ID. */
  technicianId?: string;

  /** Detailed resolution suggestion. */
  suggestion?: string;
}

/**
 * Result of scheduling operation.
 */
export interface SchedulingResult {
  /** Successfully scheduled work order IDs. */
  successCount: number;

  /** Failed work order IDs. */
  failedCount: number;

  /** List of violations encountered. */
  violations: ConstraintViolation[];

  /** Reason if entire operation failed. */
  error?: string;

  /** Execution time (ms). */
  executionTimeMs: number;
}

// ─── ROUTE TYPES ────────────────────────────────────────────────

/**
 * Optimized route for a technician with multiple jobs.
 */
export interface OptimizedRoute {
  /** Technician ID. */
  technicianId: string;

  /** Schedule date (YYYY-MM-DD). */
  date: string;

  /** Ordered list of job stops. */
  stops: RouteStop[];

  /** Total route distance (km). */
  totalDistance: number;

  /** Total route duration (minutes). */
  totalDuration: number;

  /** Route efficiency score (0-100). */
  efficiencyScore: number;

  /** Estimated time-in-transit for entire route (minutes). */
  travelTime: number;

  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Single stop on an optimized route.
 */
export interface RouteStop {
  /** Work order ID. */
  jobId: string;

  /** Stop sequence number (1-based). */
  sequence: number;

  /** Estimated arrival time (ISO 8601 UTC). */
  eta: Date;

  /** Address for this stop. */
  address: Address;

  /** Travel time from previous stop (minutes). */
  travelTimeFromPrevious: number;

  /** Distance from previous stop (km). */
  distanceFromPrevious: number;

  /** Estimated service duration (minutes). */
  serviceDuration: number;

  /** Estimated departure time (ISO 8601 UTC). */
  estimatedDeparture: Date;
}
