"use client";

import {
  useApiList,
  useApiQuery,
  useApiMutation,
  ApiFilters,
  UseApiQueryResult,
  UseApiListResult,
  UseApiMutationResult,
} from "./use-api";

// Types
export type DutyStatus = "OFF_DUTY" | "SLEEPER" | "DRIVING" | "ON_DUTY";
export type ViolationType =
  | "HOURS_EXCEEDED"
  | "NO_BREAK"
  | "FATIGUE"
  | "FALSIFIED"
  | "LOGGED_EDIT";
export type DefectSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type DefectStatus =
  | "REPORTED"
  | "ACKNOWLEDGED"
  | "REPAIRED"
  | "CERTIFIED";
export type InspectionType = "PRE_TRIP" | "POST_TRIP";
export type InspectionStatus = "PASSED" | "FAILED";

export interface DriverHOS {
  driverId: string;
  driverName: string;
  currentStatus: DutyStatus;
  drivingTimeRemaining: number;
  onDutyWindowRemaining: number;
  cycleHours: number;
  cycleHoursUsed: number;
  breakStatus: "TAKEN" | "REQUIRED" | "NOT_REQUIRED";
  breakTimeRemaining: number;
  lastStatusChange: string;
  personalConveyance: boolean;
  yardMove: boolean;
}

export interface HosViolation {
  id: string;
  driverId: string;
  driverName: string;
  type: ViolationType;
  severity: "CRITICAL" | "WARNING" | "INFO";
  timestamp: string;
  duration: number;
  resolvedAt?: string;
  description: string;
  suggestedAction: string;
}

export interface DvirDefect {
  id: string;
  vehicleId: string;
  component: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  reportedAt: string;
  photoUrl?: string;
  driverId: string;
  driverName: string;
  mechanicApproval?: {
    mechanicId: string;
    mechanicName: string;
    approvedAt: string;
  };
}

export interface DvirInspection {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  type: InspectionType;
  status: InspectionStatus;
  driverId: string;
  driverName: string;
  inspectionDate: string;
  items: {
    name: string;
    status: "PASS" | "FAIL" | "N/A";
    notes?: string;
  }[];
  defects: DvirDefect[];
  signatureUrl?: string;
  photos: string[];
}

export interface EldEvent {
  id: string;
  driverId: string;
  driverName: string;
  type: "STATUS_CHANGE" | "VIOLATION" | "EDIT_REQUEST" | "DVIR_COMPLETION";
  timestamp: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface FleetCompliance {
  totalDrivers: number;
  compliantDrivers: number;
  compliancePercentage: number;
  activeViolations: number;
  dvirCompletionRate: number;
  openDefects: number;
  criticalDefects: number;
}

export type DriverComplianceStatus =
  | "COMPLIANT"
  | "WARNING"
  | "VIOLATION"
  | "OFFLINE";

export interface DriverStatusInfo {
  driverId: string;
  name: string;
  status: DriverComplianceStatus;
  currentDuty: DutyStatus;
  drivingRemaining: number;
  breakStatus: "TAKEN" | "REQUIRED" | "NOT_REQUIRED";
  violations: number;
  lastUpdate: string;
}

export interface DvirInspectionSummary {
  id: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  type: InspectionType;
  status: InspectionStatus;
  date: string;
  defectsCount: number;
  criticalDefects: number;
}

// Hooks
export const useDriverHOS = (
  driverId: string | null,
): UseApiQueryResult<DriverHOS> => {
  return useApiQuery<DriverHOS>(
    driverId ? `/api/v4/eld/drivers/${driverId}/hos` : null,
  );
};

export const useViolations = (
  filters?: ApiFilters,
): UseApiListResult<HosViolation> => {
  return useApiList<HosViolation>("/api/v4/eld/violations", filters);
};

export const useDVIRDefects = (
  filters?: ApiFilters,
): UseApiListResult<DvirDefect> => {
  return useApiList<DvirDefect>("/api/v4/eld/defects", filters);
};

export const useDvirInspection = (
  id: string | null,
): UseApiQueryResult<DvirInspection> => {
  return useApiQuery<DvirInspection>(
    id ? `/api/v4/eld/inspections/${id}` : null,
  );
};

export const useCreateDvirDefect = (): UseApiMutationResult<DvirDefect> => {
  return useApiMutation<DvirDefect>("POST", "/api/v4/eld/defects");
};

export const useUpdateDvirDefectStatus = (
  id: string,
): UseApiMutationResult<DvirDefect> => {
  return useApiMutation<DvirDefect>(
    "PATCH",
    `/api/v4/eld/defects/${id}/status`,
  );
};

export const useELDEvents = (
  filters?: ApiFilters,
): UseApiListResult<EldEvent> => {
  return useApiList<EldEvent>("/api/v4/eld/events", filters);
};

export const useFleetCompliance = (): UseApiQueryResult<FleetCompliance> => {
  return useApiQuery<FleetCompliance>("/api/v4/eld/compliance");
};

export const useELDDriverStatus = (
  filters?: ApiFilters,
): UseApiListResult<DriverStatusInfo> => {
  return useApiList<DriverStatusInfo>("/api/v4/eld/drivers", filters);
};

export const useDvirInspections = (
  filters?: ApiFilters,
): UseApiListResult<DvirInspectionSummary> => {
  return useApiList<DvirInspectionSummary>("/api/v4/eld/dvir", filters);
};

/**
 * Combined DVIR hook that provides defects list with update capability
 */
export const useDVIR = () => {
  const defectsResult = useApiList<DvirDefect>("/api/v4/eld/defects");
  const updateMutation = useApiMutation<DvirDefect>(
    "PATCH",
    "/api/v4/eld/defects/status",
  );

  return {
    defects: defectsResult.items,
    isLoading: defectsResult.loading,
    error: defectsResult.error,
    pagination: defectsResult.pagination,
    refetch: defectsResult.refetch,
    updateDefectStatus: updateMutation.execute,
  };
};
