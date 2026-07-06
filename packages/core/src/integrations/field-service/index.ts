/**
 * Field Service Integration Module
 * Exports all field service adapters, clients, and utilities
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type {
  FieldServiceProvider,
  JobStatus,
  WorkOrderStatus,
  TechnicianStatus,
  EstimateStatus,
  InvoiceStatus,
  PriorityLevel,
  DispatchStatus,
  Job,
  WorkOrder,
  WorkOrderChecklist,
  Technician,
  TechnicianCertification,
  VehicleAssignment,
  Availability,
  GeoLocation,
  ServiceTerritory,
  GeoPolygon,
  Equipment,
  ServiceLocation,
  Estimate,
  EstimateLineItem,
  Invoice,
  InvoiceLineItem,
  PaymentRecord,
  DueReminder,
  CustomerRecord,
  Membership,
  Schedule,
  RecurringPattern,
  DispatchAssignment,
  ServiceLineItem,
  FieldServiceConnection,
  FieldServiceCredentials,
  FieldServiceConnectionConfig,
  FieldServiceFieldMapping,
  DispatchOptimizationRequest,
  DispatchConstraints,
  OptimizationGoal,
  DispatchOptimizationResult,
  DispatchMetrics,
  FieldServiceBatchResult,
  FieldServiceOperationError,
  RateLimitInfo,
  PaginationParams,
  PaginatedResult,
} from "./types.js";

// ─── BASE ADAPTER ───────────────────────────────────────────────────────────

export { AbstractFieldServiceAdapter } from "./field-service-adapter.js";

// ─── PROVIDER CLIENTS ────────────────────────────────────────────────────────

export { ServiceTitanClient } from "./servicetitan-client.js";
export { JobberClient } from "./jobber-client.js";
export { HouseCallProClient } from "./housecall-pro-client.js";
export { FieldEdgeClient } from "./fieldedge-client.js";

// ─── DISPATCH ENGINE ────────────────────────────────────────────────────────

export { FieldServiceDispatcher } from "./field-service-dispatcher.js";
