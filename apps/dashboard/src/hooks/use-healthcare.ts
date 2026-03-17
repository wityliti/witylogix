/**
 * Healthcare hooks — Patient data & clinical records management
 *
 * Handles:
 * - usePatients: patient registry with search, filter, demographics
 * - useEncounters: clinical visit/encounter history
 * - useClinicalRecords: clinical notes, diagnoses, medications
 * - useFHIRResources: FHIR-compliant resource access
 * - useHealthcareCompliance: HIPAA, security, audit requirements
 */

"use client";

import { useEffect, useState } from "react";

// ─── TYPES ──────────────────────────────────────────────────────────

export type PatientStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DECEASED"
  | "TRANSFERRED";

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

export function usePatients(searchTerm?: string) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockPatients: Patient[] = [
        {
          id: "p-001",
          mrn: "MRN-10001",
          firstName: "Robert",
          lastName: "Johnson",
          email: "robert.johnson@email.com",
          phone: "+1-555-0101",
          gender: "MALE",
          dateOfBirth: "1965-03-15",
          status: "ACTIVE",
          address: {
            street: "123 Main Street",
            city: "Springfield",
            state: "IL",
            postalCode: "62701",
            country: "USA",
          },
          emergencyContact: {
            name: "Mary Johnson",
            phone: "+1-555-0102",
            relationship: "Spouse",
          },
          insurance: {
            provider: "Blue Cross",
            memberId: "BCB123456",
            planName: "Premier Plus",
          },
          lastVisit: "2026-03-10T14:30:00Z",
          activeConditionsCount: 2,
          medicationsCount: 4,
        },
        {
          id: "p-002",
          mrn: "MRN-10002",
          firstName: "Sarah",
          lastName: "Williams",
          email: "sarah.williams@email.com",
          phone: "+1-555-0201",
          gender: "FEMALE",
          dateOfBirth: "1978-07-22",
          status: "ACTIVE",
          address: {
            street: "456 Oak Avenue",
            city: "Shelbyville",
            state: "IL",
            postalCode: "62702",
            country: "USA",
          },
          emergencyContact: {
            name: "John Williams",
            phone: "+1-555-0202",
            relationship: "Brother",
          },
          insurance: {
            provider: "Aetna",
            memberId: "AET789012",
            planName: "Select Plus",
          },
          lastVisit: "2026-03-08T10:00:00Z",
          activeConditionsCount: 1,
          medicationsCount: 2,
        },
        {
          id: "p-003",
          mrn: "MRN-10003",
          firstName: "Michael",
          lastName: "Brown",
          email: "michael.brown@email.com",
          phone: "+1-555-0301",
          gender: "MALE",
          dateOfBirth: "1955-11-05",
          status: "ACTIVE",
          address: {
            street: "789 Elm Street",
            city: "Capital City",
            state: "IL",
            postalCode: "62703",
            country: "USA",
          },
          emergencyContact: {
            name: "Jennifer Brown",
            phone: "+1-555-0302",
            relationship: "Daughter",
          },
          lastVisit: "2026-03-12T09:15:00Z",
          activeConditionsCount: 3,
          medicationsCount: 6,
        },
        {
          id: "p-004",
          mrn: "MRN-10004",
          firstName: "Emily",
          lastName: "Davis",
          email: "emily.davis@email.com",
          phone: "+1-555-0401",
          gender: "FEMALE",
          dateOfBirth: "1992-02-14",
          status: "ACTIVE",
          address: {
            street: "321 Pine Road",
            city: "Springfield",
            state: "IL",
            postalCode: "62704",
            country: "USA",
          },
          emergencyContact: {
            name: "Thomas Davis",
            phone: "+1-555-0402",
            relationship: "Father",
          },
          insurance: {
            provider: "United Healthcare",
            memberId: "UHC456789",
            planName: "Choice Plus",
          },
          lastVisit: "2026-03-14T15:45:00Z",
          activeConditionsCount: 0,
          medicationsCount: 1,
        },
        {
          id: "p-005",
          mrn: "MRN-10005",
          firstName: "James",
          lastName: "Miller",
          email: "james.miller@email.com",
          phone: "+1-555-0501",
          gender: "MALE",
          dateOfBirth: "1970-09-28",
          status: "ACTIVE",
          address: {
            street: "654 Maple Drive",
            city: "Shelbyville",
            state: "IL",
            postalCode: "62705",
            country: "USA",
          },
          emergencyContact: {
            name: "Patricia Miller",
            phone: "+1-555-0502",
            relationship: "Spouse",
          },
          lastVisit: "2026-03-11T11:20:00Z",
          activeConditionsCount: 2,
          medicationsCount: 3,
        },
      ];

      setPatients(mockPatients);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return { patients, loading, error };
}

export function useEncounters(patientId: string) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockEncounters: Encounter[] = [
        {
          id: "enc-001",
          patientId,
          type: "CONSULTATION",
          status: "FINISHED",
          provider: {
            id: "pr-001",
            name: "Dr. Sarah Johnson",
            specialty: "Internal Medicine",
          },
          department: "Primary Care",
          startTime: "2026-03-10T14:00:00Z",
          endTime: "2026-03-10T14:45:00Z",
          chief_complaint: "Annual checkup",
          diagnosis: "Hypertension - controlled",
          notes: "BP stable on current medication",
        },
        {
          id: "enc-002",
          patientId,
          type: "FOLLOW_UP",
          status: "FINISHED",
          provider: {
            id: "pr-002",
            name: "Dr. Michael Chen",
            specialty: "Cardiology",
          },
          department: "Cardiology",
          startTime: "2026-02-28T10:00:00Z",
          endTime: "2026-02-28T10:30:00Z",
          diagnosis: "CAD - stable",
          notes: "Continue current regimen",
        },
        {
          id: "enc-003",
          patientId,
          type: "LABORATORY",
          status: "FINISHED",
          provider: {
            id: "pr-003",
            name: "Lab Technician - A. Williams",
            specialty: "Laboratory Medicine",
          },
          department: "Laboratory",
          startTime: "2026-03-05T08:30:00Z",
          endTime: "2026-03-05T08:45:00Z",
          chief_complaint: "Routine labs",
        },
      ];
      setEncounters(mockEncounters);
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [patientId]);

  return { encounters, loading };
}

export function useClinicalRecords(patientId: string) {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockRecords: ClinicalRecord[] = [
        {
          id: "rec-001",
          patientId,
          type: "PROGRESS_NOTE",
          title: "Follow-up Visit - Hypertension",
          content: "Patient reports compliance with medication regimen...",
          author: {
            id: "pr-001",
            name: "Dr. Sarah Johnson",
            title: "MD, Internal Medicine",
          },
          createdDate: "2026-03-10T14:30:00Z",
          signedDate: "2026-03-10T16:00:00Z",
          isSigned: true,
        },
      ];

      const mockMeds: Medication[] = [
        {
          id: "med-001",
          name: "Lisinopril",
          strength: "10mg",
          dosage: "1 tablet",
          frequency: "Once daily",
          route: "Oral",
          startDate: "2024-06-15",
          prescribedBy: "Dr. Sarah Johnson",
          status: "ACTIVE",
        },
        {
          id: "med-002",
          name: "Atorvastatin",
          strength: "20mg",
          dosage: "1 tablet",
          frequency: "Once daily",
          route: "Oral",
          startDate: "2024-08-20",
          prescribedBy: "Dr. Michael Chen",
          status: "ACTIVE",
        },
      ];

      const mockConditions: Condition[] = [
        {
          id: "cond-001",
          code: "I10",
          name: "Essential Hypertension",
          status: "ACTIVE",
          onsetDate: "2020-01-10",
          severity: "MEDIUM",
          notes: "Controlled on current medication",
        },
        {
          id: "cond-002",
          code: "I25.10",
          name: "Atherosclerotic Heart Disease",
          status: "ACTIVE",
          onsetDate: "2018-06-15",
          severity: "HIGH",
          notes: "Multiple vessel CAD, stable",
        },
      ];

      const mockAllergies: Allergy[] = [
        {
          id: "all-001",
          allergen: "Penicillin",
          type: "MEDICATION",
          severity: "SEVERE",
          reaction: "Anaphylaxis",
          recordedDate: "2015-03-20",
          status: "CONFIRMED",
        },
      ];

      setRecords(mockRecords);
      setMedications(mockMeds);
      setConditions(mockConditions);
      setAllergies(mockAllergies);
      setLoading(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [patientId]);

  return { records, medications, conditions, allergies, loading };
}

export function useFHIRResources(resourceType?: string) {
  const [resources, setResources] = useState<FHIRResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockResources: FHIRResource[] = [
        {
          resourceType: "Observation",
          id: "obs-001",
          meta: {
            versionId: "1",
            lastUpdated: "2026-03-10T14:30:00Z",
          },
          data: {
            code: { coding: [{ code: "85354-9", display: "Blood Pressure" }] },
            valueQuantity: { value: 140, unit: "mmHg" },
            effectiveDateTime: "2026-03-10T14:30:00Z",
          },
        },
        {
          resourceType: "Observation",
          id: "obs-002",
          meta: {
            versionId: "1",
            lastUpdated: "2026-03-05T08:30:00Z",
          },
          data: {
            code: {
              coding: [{ code: "2085-9", display: "Cholesterol [Moles/Volume]" }],
            },
            valueQuantity: { value: 5.2, unit: "mmol/L" },
            effectiveDateTime: "2026-03-05T08:30:00Z",
          },
        },
      ];

      setResources(mockResources);
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [resourceType]);

  return { resources, loading };
}

export function useHealthcareCompliance() {
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockCompliance: ComplianceStatus = {
        hipaaCompliant: true,
        encryptionEnabled: true,
        auditLoggingEnabled: true,
        accessControlsConfigured: true,
        lastComplianceAudit: "2026-03-01T09:00:00Z",
        lastDataBackup: "2026-03-16T23:00:00Z",
        outstandingIssues: 0,
      };
      setCompliance(mockCompliance);
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return { compliance, loading };
}
