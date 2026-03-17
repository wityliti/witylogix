/**
 * Field Service Module Barrel Export
 *
 * Exports all public types, classes, and functions for field service management.
 * Organized by functional domain for easy importing.
 */

// ─── TYPE EXPORTS ───────────────────────────────────────────────

export type {
  WorkOrder,
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderPart,
  SignatureData,
  PhotoData,
  Technician,
  TechnicianStatus,
  WorkingHours,
  PerformanceMetrics,
  TimeSlot,
  JobSchedule,
  DispatchResult,
  DispatchCandidate,
  RecurringPlan,
  RecurrenceFrequency,
  ServiceZone,
  SkillMatrix,
  SLARule,
  SLAStatus,
  Address,
  Coordinates,
  ConstraintViolation,
  SchedulingResult,
  OptimizedRoute,
  RouteStop,
} from "./field-service-types.js";

// ─── SCHEDULING ENGINE EXPORTS ──────────────────────────────────

export {
  ConstraintSolver,
  TimeSlotFinder,
  BatchScheduler,
  RecurringScheduler,
  ConflictDetector,
  RescheduleEngine,
} from "./scheduling-engine.js";

// ─── DISPATCH OPTIMIZER EXPORTS ─────────────────────────────────

export {
  NearestAvailableDispatcher,
  WorkloadBalancer,
  PriorityDispatcher,
  RouteOptimizer,
  ETACalculator,
  AutoDispatcher,
} from "./dispatch-optimizer.js";

// ─── WORK ORDER ENGINE EXPORTS ──────────────────────────────────

export type {
  InvoiceLineItem,
  WorkOrderInvoice,
  TimeEntry,
  TimeSummary,
} from "./work-order-engine.js";

export {
  WorkOrderLifecycle,
  PartsTracker,
  TimeTracker,
  SignatureCapture,
  InvoiceGenerator,
  SLAMonitor,
} from "./work-order-engine.js";

// ─── API EXPORTS ────────────────────────────────────────────────

export type {
  ApiResponse,
} from "./field-service-api.js";

export {
  ApiError,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  assignWorkOrderSchema,
  completeWorkOrderSchema,
  createTechnicianSchema,
  updateTechnicianLocationSchema,
  updateTechnicianStatusSchema,
  findAvailableSlotsSchema,
  batchScheduleSchema,
  recurringScheduleSchema,
  autoDispatchSchema,
  manualDispatchSchema,
  optimizeRouteSchema,
  slaStatusQuerySchema,
  slaReportSchema,
  fieldServiceEndpoints,
  FieldServiceHandler,
} from "./field-service-api.js";
