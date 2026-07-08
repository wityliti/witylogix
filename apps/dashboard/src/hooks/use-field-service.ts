"use client";

import {
  useApiList,
  useApiQuery,
  ApiFilters,
  UseApiListResult,
  UseApiQueryResult,
} from "./use-api";

/**
 * Work order status enum
 */
export type WorkOrderStatus =
  | "created"
  | "scheduled"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type WorkOrderType =
  | "installation"
  | "maintenance"
  | "repair"
  | "inspection";

/**
 * Technician status enum
 */
export type TechnicianStatus = "available" | "on_job" | "break" | "offline";
export type TechnicianSkill =
  | "electrical"
  | "plumbing"
  | "hvac"
  | "appliances"
  | "general";

/**
 * Work Order data structure
 */
export interface WorkOrder {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceType: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechId?: string;
  assignedTechName?: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  eta?: string;
  completionTime?: string;
  requiredSkills: TechnicianSkill[];
  notes: string[];
  partsUsed: { name: string; cost: number }[];
  photos: string[];
  signature?: string;
  createdAt: string;
  updatedAt: string;
  preferredDate: string;
  estimatedDuration: number; // in minutes
}

/**
 * Technician data structure
 */
export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TechnicianStatus;
  currentJobId?: string;
  skillSet: TechnicianSkill[];
  ratings: number;
  jobsCompleted: number;
  latitude: number;
  longitude: number;
  availableFrom?: string;
  currentWorkload: number; // 0-100
  responseTime: number; // in minutes
  location: string;
}

/**
 * Field service overview metrics
 */
export interface FieldServiceOverview {
  activeJobs: number;
  techniciansInField: number;
  completionRate: number;
  avgResponseTime: number;
  totalTechnicians: number;
  jobsCompletedToday: number;
  pendingDispatch: number;
}

/**
 * Job schedule item
 */
export interface ScheduleItem {
  jobId: string;
  technicianId: string;
  technicianName: string;
  startTime: string;
  endTime: string;
  jobNumber: string;
  customerName: string;
  location: string;
  status: WorkOrderStatus;
}

/**
 * SLA metrics
 */
export interface SLAMetrics {
  onTimePercentage: number;
  overdueCount: number;
  totalJobs: number;
  avgCompletionTime: number; // in minutes
}

export function useFieldServiceOverview(): UseApiQueryResult<FieldServiceOverview> {
  return useApiQuery<FieldServiceOverview>("/api/v4/field-service/overview");
}

export function useWorkOrders(
  filters?: ApiFilters,
): UseApiListResult<WorkOrder> {
  return useApiList<WorkOrder>("/api/v4/field-service/work-orders", filters);
}

export function useWorkOrderDetail(
  id: string | null,
): UseApiQueryResult<WorkOrder> {
  return useApiQuery<WorkOrder>(
    id ? `/api/v4/field-service/work-orders/${id}` : null,
  );
}

export function useTechnicians(
  filters?: ApiFilters,
): UseApiListResult<Technician> {
  return useApiList<Technician>("/api/v4/field-service/technicians", filters);
}

export function useTechnicianDetail(
  id: string | null,
): UseApiQueryResult<Technician> {
  return useApiQuery<Technician>(
    id ? `/api/v4/field-service/technicians/${id}` : null,
  );
}

export function useDispatchMap(
  filters?: ApiFilters,
): UseApiListResult<WorkOrder> {
  return useApiList<WorkOrder>("/api/v4/field-service/dispatch-map", filters);
}

export function useJobSchedule(
  filters?: ApiFilters,
): UseApiListResult<ScheduleItem> {
  return useApiList<ScheduleItem>("/api/v4/field-service/schedule", filters);
}

export function useSLAMetrics(): UseApiQueryResult<SLAMetrics> {
  return useApiQuery<SLAMetrics>("/api/v4/field-service/sla-metrics");
}
