"use client";

import {
  useApiList,
  useApiQuery,
  ApiFilters,
  UseApiQueryResult,
  UseApiListResult,
} from "./use-api";

// ─── TYPES ──────────────────────────────────────────────────────────

export type PatientStatus = "ACTIVE" | "INACTIVE" | "DECEASED" | "TRANSFERRED";
export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type EncounterType =
  | "CONSULTATION"
  | "HOSPITALIZATION"
  | "EMERGENCY"
  | "FOLLOW_UP"
  | "LABORATORY"
  | "IMAGING";
export type EncounterStatus =
  | "PLANNED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";
export type AllergyType =
  | "MEDICATION"
  | "FOOD"
  | "ENVIRONMENTAL"
  | "LATEX"
  | "OTHER";
export type RecordType =
  | "PROGRESS_NOTE"
  | "LAB_RESULT"
  | "IMAGING_REPORT"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "CONSULTATION_NOTE";

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth: string;
  status: PatientStatus;
  address: Address;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  insurance?: {
    provider: string;
    memberId: string;
    planName: string;
  };
  lastVisit?: string;
  activeConditionsCount: number;
  medicationsCount: number;
}

export interface Encounter {
  id: string;
  patientId: string;
  type: EncounterType;
  status: EncounterStatus;
  provider: {
    id: string;
    name: string;
    specialty: string;
  };
  department: string;
  startTime: string;
  endTime?: string;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  strength: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  status: "ACTIVE" | "DISCONTINUED" | "PAUSED";
}

export interface Condition {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "RESOLVED" | "INACTIVE";
  onsetDate: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes?: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  type: AllergyType;
  severity: "MILD" | "MODERATE" | "SEVERE";
  reaction: string;
  recordedDate: string;
  status: "CONFIRMED" | "UNCONFIRMED" | "RESOLVED";
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  type: RecordType;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    title: string;
  };
  createdDate: string;
  signedDate?: string;
  isSigned: boolean;
}

export interface FHIRResource {
  resourceType:
    | "Patient"
    | "Observation"
    | "Medication"
    | "MedicationRequest"
    | "Condition"
    | "Encounter"
    | "DiagnosticReport"
    | "Procedure";
  id: string;
  meta?: {
    versionId: string;
    lastUpdated: string;
  };
  data: Record<string, any>;
}

export interface ComplianceStatus {
  hipaaCompliant: boolean;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  accessControlsConfigured: boolean;
  lastComplianceAudit: string;
  lastDataBackup: string;
  outstandingIssues: number;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function usePatients(filters?: ApiFilters): UseApiListResult<Patient> {
  return useApiList<Patient>("/api/v4/patients", filters);
}

export function useEncounters(
  patientId: string | null,
): UseApiListResult<Encounter> {
  return useApiList<Encounter>(
    patientId ? `/api/v4/patients/${patientId}/encounters` : null,
  );
}

export function useClinicalRecords(
  patientId: string | null,
): UseApiListResult<ClinicalRecord> {
  return useApiList<ClinicalRecord>(
    patientId ? `/api/v4/patients/${patientId}/records` : null,
  );
}

export function useMedications(
  patientId: string | null,
): UseApiListResult<Medication> {
  return useApiList<Medication>(
    patientId ? `/api/v4/patients/${patientId}/medications` : null,
  );
}

export function useConditions(
  patientId: string | null,
): UseApiListResult<Condition> {
  return useApiList<Condition>(
    patientId ? `/api/v4/patients/${patientId}/conditions` : null,
  );
}

export function useAllergies(
  patientId: string | null,
): UseApiListResult<Allergy> {
  return useApiList<Allergy>(
    patientId ? `/api/v4/patients/${patientId}/allergies` : null,
  );
}

export function useFHIRResources(
  filters?: ApiFilters,
): UseApiListResult<FHIRResource> {
  return useApiList<FHIRResource>("/api/v4/fhir/resources", filters);
}

export function useHealthcareCompliance(): UseApiQueryResult<ComplianceStatus> {
  return useApiQuery<ComplianceStatus>("/api/v4/healthcare/compliance");
}
