"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  Database,
  RotateCw,
  Eye,
  Lock,
  Copy,
  Download,
  Upload,
  Send,
  Activity,
  User,
  FileText,
  Search,
  Filter,
  Loader,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   HEALTHCARE PROVIDER INTEGRATION PAGE
   HIPAA Compliance · FHIR · HL7 · EHR Sync
   ═══════════════════════════════════════════════════════════ */

interface HealthcareProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSync?: string;
  patientsSynced: number;
  observationsSynced: number;
  hipaaCompliant: boolean;
  apiStatus: "healthy" | "degraded" | "down";
  connectionType: "fhir" | "hl7" | "direct";
  errorMessage?: string;
}

interface FHIRResourceType {
  resourceType: string;
  count: number;
  lastSynced: string;
  syncStatus: "synced" | "syncing" | "error" | "pending";
}

interface PatientDataSyncConfig {
  id: string;
  patientId: string;
  patientName: string;
  consentStatus: "active" | "pending" | "revoked" | "expired";
  consentDate: string;
  dataTypes: string[];
  lastSync: string;
  nextSync: string;
  syncEnabled: boolean;
}

interface ClinicalCodeMapping {
  id: string;
  localCode: string;
  localName: string;
  standardCode: string;
  standardSystem: "SNOMED" | "LOINC" | "ICD-10" | "RxNorm";
  status: "mapped" | "unmapped" | "pending";
  mappedBy: string;
  mappedDate: string;
}

interface HL7Segment {
  segment: string;
  fields: Array<{ name: string; value: string }>;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: "READ" | "WRITE" | "DELETE" | "EXPORT" | "IMPORT";
  resourceType: string;
  userId: string;
  patientId: string;
  details: string;
  status: "success" | "failed";
}

const PROVIDERS: HealthcareProvider[] = [
  {
    id: "cerner",
    name: "Cerner",
    logo: "⚕️",
    status: "connected",
    lastSync: "2026-03-12T14:32:00Z",
    patientsSynced: 8945,
    observationsSynced: 142356,
    hipaaCompliant: true,
    apiStatus: "healthy",
    connectionType: "fhir",
  },
  {
    id: "allscripts",
    name: "Allscripts",
    logo: "📋",
    status: "connected",
    lastSync: "2026-03-12T14:15:00Z",
    patientsSynced: 5432,
    observationsSynced: 89234,
    hipaaCompliant: true,
    apiStatus: "healthy",
    connectionType: "hl7",
  },
  {
    id: "epic",
    name: "Epic Systems",
    logo: "🏥",
    status: "connected",
    lastSync: "2026-03-12T13:45:00Z",
    patientsSynced: 12187,
    observationsSynced: 234567,
    hipaaCompliant: true,
    apiStatus: "degraded",
    connectionType: "fhir",
    errorMessage: "API response time elevated - 2.5s avg",
  },
  {
    id: "hl7-fhir",
    name: "HL7 FHIR Gateway",
    logo: "🔗",
    status: "connected",
    lastSync: "2026-03-12T14:00:00Z",
    patientsSynced: 3214,
    observationsSynced: 45123,
    hipaaCompliant: true,
    apiStatus: "healthy",
    connectionType: "fhir",
  },
];

const FHIR_RESOURCES: FHIRResourceType[] = [
  { resourceType: "Patient", count: 28778, lastSynced: "2026-03-12T14:32:00Z", syncStatus: "synced" },
  { resourceType: "Observation", count: 511280, lastSynced: "2026-03-12T14:31:45Z", syncStatus: "synced" },
  { resourceType: "MedicationRequest", count: 89234, lastSynced: "2026-03-12T14:30:15Z", syncStatus: "synced" },
  { resourceType: "Encounter", count: 156789, lastSynced: "2026-03-12T14:25:30Z", syncStatus: "syncing" },
  { resourceType: "Procedure", count: 45612, lastSynced: "2026-03-12T14:20:00Z", syncStatus: "synced" },
  { resourceType: "Condition", count: 234567, lastSynced: "2026-03-12T14:15:45Z", syncStatus: "synced" },
  { resourceType: "DiagnosticReport", count: 78945, lastSynced: "2026-03-12T14:10:20Z", syncStatus: "synced" },
  { resourceType: "Medication", count: 12345, lastSynced: "2026-03-12T14:05:00Z", syncStatus: "synced" },
];

const PATIENT_SYNC_CONFIGS: PatientDataSyncConfig[] = [
  {
    id: "patient-001",
    patientId: "PAT-2024-0001",
    patientName: "John Smith",
    consentStatus: "active",
    consentDate: "2026-01-15T00:00:00Z",
    dataTypes: ["Demographics", "Observations", "Medications", "Encounters"],
    lastSync: "2026-03-12T14:32:00Z",
    nextSync: "2026-03-13T14:32:00Z",
    syncEnabled: true,
  },
  {
    id: "patient-002",
    patientId: "PAT-2024-0002",
    patientName: "Jane Doe",
    consentStatus: "active",
    consentDate: "2026-02-10T00:00:00Z",
    dataTypes: ["Demographics", "Observations", "Procedures"],
    lastSync: "2026-03-12T13:15:00Z",
    nextSync: "2026-03-13T13:15:00Z",
    syncEnabled: true,
  },
  {
    id: "patient-003",
    patientId: "PAT-2024-0003",
    patientName: "Robert Johnson",
    consentStatus: "pending",
    consentDate: "",
    dataTypes: ["Demographics"],
    lastSync: "2026-03-11T10:00:00Z",
    nextSync: "2026-03-13T10:00:00Z",
    syncEnabled: false,
  },
  {
    id: "patient-004",
    patientId: "PAT-2024-0004",
    patientName: "Emily Davis",
    consentStatus: "active",
    consentDate: "2026-01-20T00:00:00Z",
    dataTypes: ["Demographics", "Medications"],
    lastSync: "2026-03-12T12:45:00Z",
    nextSync: "2026-03-13T12:45:00Z",
    syncEnabled: true,
  },
  {
    id: "patient-005",
    patientId: "PAT-2024-0005",
    patientName: "Michael Wilson",
    consentStatus: "revoked",
    consentDate: "2025-11-30T00:00:00Z",
    dataTypes: [],
    lastSync: "2026-02-15T08:20:00Z",
    nextSync: "—",
    syncEnabled: false,
  },
];

const CLINICAL_CODE_MAPPINGS: ClinicalCodeMapping[] = [
  {
    id: "mapping-001",
    localCode: "BP-SYS",
    localName: "Systolic Blood Pressure",
    standardCode: "8480-6",
    standardSystem: "LOINC",
    status: "mapped",
    mappedBy: "admin@witylogix.com",
    mappedDate: "2026-01-10T00:00:00Z",
  },
  {
    id: "mapping-002",
    localCode: "HbA1c",
    localName: "Hemoglobin A1c",
    standardCode: "4548-4",
    standardSystem: "LOINC",
    status: "mapped",
    mappedBy: "admin@witylogix.com",
    mappedDate: "2026-01-12T00:00:00Z",
  },
  {
    id: "mapping-003",
    localCode: "DIAB-T2",
    localName: "Type 2 Diabetes",
    standardCode: "E11",
    standardSystem: "ICD-10",
    status: "mapped",
    mappedBy: "clinical-lead@witylogix.com",
    mappedDate: "2026-01-08T00:00:00Z",
  },
  {
    id: "mapping-004",
    localCode: "AMX-500",
    localName: "Amoxicillin 500mg",
    standardCode: "308191",
    standardSystem: "RxNorm",
    status: "mapped",
    mappedBy: "pharmacy@witylogix.com",
    mappedDate: "2026-02-01T00:00:00Z",
  },
  {
    id: "mapping-005",
    localCode: "CHOL-TOTAL",
    localName: "Total Cholesterol",
    standardCode: "2093-3",
    standardSystem: "LOINC",
    status: "pending",
    mappedBy: "—",
    mappedDate: "—",
  },
];

const HL7_MESSAGE_SAMPLE: HL7Segment[] = [
  { segment: "MSH", fields: [{ name: "Field Separator", value: "|" }, { name: "Encoding Characters", value: "^~\\&" }] },
  { segment: "EVN", fields: [{ name: "Event Type Code", value: "A01" }, { name: "Recorded DateTime", value: "20260312143200" }] },
  { segment: "PID", fields: [{ name: "Patient ID", value: "PAT-2024-0001" }, { name: "Patient Name", value: "Smith^John" }, { name: "DOB", value: "19801215" }] },
  { segment: "OBX", fields: [{ name: "Observation Identifier", value: "8480-6" }, { name: "Value", value: "140" }, { name: "Units", value: "mmHg" }] },
];

const AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "audit-001",
    timestamp: "2026-03-12T14:32:15Z",
    action: "READ",
    resourceType: "Observation",
    userId: "clinic-001@epic",
    patientId: "PAT-2024-0001",
    details: "Retrieved vital signs observation",
    status: "success",
  },
  {
    id: "audit-002",
    timestamp: "2026-03-12T14:31:42Z",
    action: "WRITE",
    resourceType: "MedicationRequest",
    userId: "dr-smith@hospital",
    patientId: "PAT-2024-0002",
    details: "New prescription created",
    status: "success",
  },
  {
    id: "audit-003",
    timestamp: "2026-03-12T14:30:05Z",
    action: "READ",
    resourceType: "Patient",
    userId: "nurse-admin@cerner",
    patientId: "PAT-2024-0003",
    details: "Patient demographics accessed",
    status: "success",
  },
  {
    id: "audit-004",
    timestamp: "2026-03-12T14:28:33Z",
    action: "EXPORT",
    resourceType: "DiagnosticReport",
    userId: "compliance@witylogix.com",
    patientId: "PAT-2024-0001",
    details: "Lab results exported for audit",
    status: "success",
  },
  {
    id: "audit-005",
    timestamp: "2026-03-12T14:25:19Z",
    action: "READ",
    resourceType: "MedicationRequest",
    userId: "unauthorized-user",
    patientId: "PAT-2024-0001",
    details: "Unauthorized access attempt",
    status: "failed",
  },
];

interface TabState {
  tab: "providers" | "fhir-browser" | "hl7-viewer" | "compliance" | "sync-config" | "code-mapping" | "audit-log";
}

const getStatusColor = (status: string): "success" | "danger" | "warning" | "default" => {
  switch (status) {
    case "connected":
    case "active":
    case "synced":
    case "healthy":
    case "mapped":
      return "success";
    case "error":
    case "revoked":
    case "failed":
    case "down":
      return "danger";
    case "disconnected":
    case "pending":
    case "degraded":
    case "unmapped":
      return "warning";
    default:
      return "default";
  }
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr || isoStr === "—") return "—";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

export default function HealthcareIntegrationPage() {
  const [tabState, setTabState] = useState<TabState>({ tab: "providers" });
  const [selectedProvider, setSelectedProvider] = useState<string>("cerner");
  const [fhirFilter, setFhirFilter] = useState<string>("all");
  const [patientFilter, setPatientFilter] = useState<"all" | "active" | "pending" | "revoked">("all");
  const [auditFilter, setAuditFilter] = useState<"all" | "READ" | "WRITE" | "EXPORT">("all");
  const [hl7ViewerExpanded, setHl7ViewerExpanded] = useState<string | null>(null);

  // Calculate statistics
  const connectedProviders = PROVIDERS.filter((p) => p.status === "connected").length;
  const totalPatients = PROVIDERS.reduce((sum, p) => sum + p.patientsSynced, 0);
  const totalObservations = PROVIDERS.reduce((sum, p) => sum + p.observationsSynced, 0);
  const activeSyncs = PATIENT_SYNC_CONFIGS.filter((p) => p.syncEnabled).length;
  const mappedCodes = CLINICAL_CODE_MAPPINGS.filter((m) => m.status === "mapped").length;
  const auditSuccessRate = ((AUDIT_LOGS.filter((a) => a.status === "success").length / AUDIT_LOGS.length) * 100).toFixed(1);

  const filteredPatients = useMemo(
    () =>
      PATIENT_SYNC_CONFIGS.filter((patient) => {
        if (patientFilter !== "all" && patient.consentStatus !== patientFilter) return false;
        return true;
      }),
    [patientFilter]
  );

  const filteredAuditLogs = useMemo(
    () =>
      AUDIT_LOGS.filter((log) => {
        if (auditFilter !== "all" && log.action !== auditFilter) return false;
        return true;
      }),
    [auditFilter]
  );

  return (
    <>
      <Header
        title="Healthcare Integration"
        subtitle={`${connectedProviders} providers connected · ${formatNumber(totalPatients)} patients`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 mb-8 sticky top-0 z-10">
        <div className="px-6 flex items-center gap-8 overflow-x-auto">
          {[
            { id: "providers", label: "Providers" },
            { id: "fhir-browser", label: "FHIR Browser" },
            { id: "hl7-viewer", label: "HL7 Messages" },
            { id: "compliance", label: "Compliance" },
            { id: "sync-config", label: "Patient Sync" },
            { id: "code-mapping", label: "Code Mapping" },
            { id: "audit-log", label: "Audit Log" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabState({ tab: t.id as TabState["tab"] })}
              className={cn(
                "px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tabState.tab === t.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* PROVIDERS TAB */}
        {tabState.tab === "providers" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Connected Providers" value={connectedProviders.toString()} trend="up" />
              <StatCard label="Total Patients" value={formatNumber(totalPatients)} trend="up" />
              <StatCard label="Observations" value={formatNumber(totalObservations)} trend="up" />
              <StatCard label="HIPAA Compliant" value="100%" trend="stable" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {PROVIDERS.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{provider.logo}</div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {provider.name}
                          <Badge variant={getStatusColor(provider.status)}>
                            {provider.status === "connected" ? "●" : "○"} {provider.status}
                          </Badge>
                          {provider.hipaaCompliant && <Shield className="w-4 h-4 text-green-600" />}
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {provider.connectionType.toUpperCase()} · {provider.apiStatus}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm">
                        <RotateCw className="w-4 h-4" />
                        Sync
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Patients Synced</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.patientsSynced)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Observations</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.observationsSynced)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Last Sync</p>
                      <p className="text-sm font-mono">{formatDateTime(provider.lastSync || "")}</p>
                    </div>
                  </CardContent>
                  {provider.errorMessage && (
                    <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{provider.errorMessage}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* FHIR BROWSER TAB */}
        {tabState.tab === "fhir-browser" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>FHIR Resource Browser</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">HL7 FHIR R4 compliant resources</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search resource..."
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {FHIR_RESOURCES.map((resource) => (
                    <div key={resource.resourceType} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-center gap-4 flex-1">
                        <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div className="flex-1">
                          <p className="font-medium">{resource.resourceType}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Last synced: {formatDateTime(resource.lastSynced)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatNumber(resource.count)}</p>
                          <Badge variant={getStatusColor(resource.syncStatus)} className="text-xs">
                            {resource.syncStatus}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* HL7 MESSAGE VIEWER TAB */}
        {tabState.tab === "hl7-viewer" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>HL7 Message Viewer</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">v2.5 message parsing & analysis</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded font-mono text-sm overflow-x-auto">
                  <p>MSH|^~\&|Cerner|Hospital A|Witylogix|MAIN|20260312143200||ADT^A01|MSG0001|P|2.5</p>
                  <p>EVN|A01|20260312143200||Patient Admission</p>
                  <p>PID|1||PAT-2024-0001||Smith^John||19801215|M|||123 Main St^^Springfield||555-1234</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {HL7_MESSAGE_SAMPLE.map((item, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3 cursor-pointer" onClick={() => setHl7ViewerExpanded(hl7ViewerExpanded === item.segment ? null : item.segment)}>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span className="font-mono">{item.segment}</span>
                          <ChevronRight className={cn("w-4 h-4 transition", hl7ViewerExpanded === item.segment && "rotate-90")} />
                        </CardTitle>
                      </CardHeader>
                      {hl7ViewerExpanded === item.segment && (
                        <CardContent className="space-y-2">
                          {item.fields.map((field, fidx) => (
                            <div key={fidx} className="flex justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-400">{field.name}</span>
                              <span className="font-mono">{field.value}</span>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export Message
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Send className="w-4 h-4" />
                    Test Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* COMPLIANCE TAB */}
        {tabState.tab === "compliance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  HIPAA Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Encryption in Transit", status: "active" },
                  { label: "Encryption at Rest", status: "active" },
                  { label: "Access Control Lists", status: "active" },
                  { label: "Audit Logging", status: "active" },
                  { label: "Data Integrity", status: "active" },
                  { label: "Backup & Recovery", status: "active" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <p className="text-sm">{item.label}</p>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3" />
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Administrative Safeguards", done: true },
                  { label: "Physical Safeguards", done: true },
                  { label: "Technical Safeguards", done: true },
                  { label: "Organizational Policies", done: true },
                  { label: "Business Associate Agreements", done: true },
                  { label: "Incident Response Plan", done: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input type="checkbox" checked={item.done} readOnly className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* PATIENT SYNC CONFIG TAB */}
        {tabState.tab === "sync-config" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Patient Data Sync Configuration</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{activeSyncs} active syncs</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={patientFilter}
                    onChange={(e) => setPatientFilter(e.target.value as any)}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  >
                    <option value="all">All Patients</option>
                    <option value="active">Active Consent</option>
                    <option value="pending">Pending</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPatients.map((patient) => (
                    <div key={patient.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="font-medium">{patient.patientName}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{patient.patientId}</p>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(patient.consentStatus)}>{patient.consentStatus}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Data Types</p>
                          <p className="font-medium">{patient.dataTypes.join(", ") || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Last Sync</p>
                          <p className="font-mono">{formatDateTime(patient.lastSync)}</p>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="secondary" size="sm" disabled={!patient.syncEnabled}>
                            <RotateCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CODE MAPPING TAB */}
        {tabState.tab === "code-mapping" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Mappings" value={CLINICAL_CODE_MAPPINGS.length.toString()} trend="up" />
              <StatCard label="Mapped Codes" value={mappedCodes.toString()} trend="up" />
              <StatCard label="Pending" value={(CLINICAL_CODE_MAPPINGS.length - mappedCodes).toString()} trend="down" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Clinical Code Mapping</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Local to standard terminology conversion</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">Local Code</th>
                        <th className="text-left py-3 px-4 font-semibold">Standard Code</th>
                        <th className="text-left py-3 px-4 font-semibold">System</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 font-semibold">Mapped By</th>
                        <th className="text-left py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLINICAL_CODE_MAPPINGS.map((mapping) => (
                        <tr key={mapping.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-mono">{mapping.localCode}</td>
                          <td className="py-3 px-4 font-mono">{mapping.standardCode}</td>
                          <td className="py-3 px-4">{mapping.standardSystem}</td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusColor(mapping.status)}>{mapping.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-xs">{mapping.mappedBy}</td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Plus className="w-4 h-4" />
                    Add Mapping
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4" />
                    Bulk Import
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {tabState.tab === "audit-log" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>PHI Access Audit Log</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Success rate: {auditSuccessRate}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value as any)}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  >
                    <option value="all">All Actions</option>
                    <option value="READ">Read</option>
                    <option value="WRITE">Write</option>
                    <option value="EXPORT">Export</option>
                  </select>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Activity className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="font-medium">{log.action}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{log.details}</p>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(log.status)}>{log.status}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <div>
                          <p className="font-semibold">Resource</p>
                          <p>{log.resourceType}</p>
                        </div>
                        <div>
                          <p className="font-semibold">User</p>
                          <p className="font-mono">{log.userId}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Patient</p>
                          <p className="font-mono">{log.patientId}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Time</p>
                          <p>{formatDateTime(log.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
