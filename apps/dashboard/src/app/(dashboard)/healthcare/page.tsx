'use client';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { AlertCircle, Users, Clock, FileText, CheckCircle2, Shield } from 'lucide-react';

interface KPICard {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: string;
}

function KPICardComponent({ card }: { card: KPICard }) {
  const icons: Record<string, React.ReactNode> = {
    patients: <Users className="w-8 h-8 text-blue-500/30" />,
    encounters: <Clock className="w-8 h-8 text-cyan-500/30" />,
    lab: <FileText className="w-8 h-8 text-purple-500/30" />,
    alerts: <AlertCircle className="w-8 h-8 text-amber-500/30" />,
  };

  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400 mb-2">{card.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{card.value}</span>
              {card.unit && (
                <span className="text-sm text-gray-400">{card.unit}</span>
              )}
            </div>
            {card.trend && (
              <div className="mt-2 text-xs">
                <span className={cn(
                  card.trend === "up"
                    ? "text-emerald-400"
                    : "text-amber-400"
                )}>
                  {card.trend === "up" ? "↑" : "↓"} {card.trendValue || "0%"}
                </span>
              </div>
            )}
          </div>
          <div className="ml-4">{icons[card.icon] || null}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceStatusCard({ compliance }: { compliance: Compliance }) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Compliance Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-gray-400">HIPAA Compliant</span>
          <Badge variant={compliance?.hipaaCompliant ? "success" : "danger"}>
            {compliance?.hipaaCompliant ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-gray-400">Encryption</span>
          <Badge variant={compliance?.encryptionEnabled ? "success" : "warning"}>
            {compliance?.encryptionEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-gray-400">Audit Logging</span>
          <Badge variant={compliance?.auditLoggingEnabled ? "success" : "warning"}>
            {compliance?.auditLoggingEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-gray-400">Access Controls</span>
          <Badge variant={compliance?.accessControlsConfigured ? "success" : "warning"}>
            {compliance?.accessControlsConfigured ? "Configured" : "Pending"}
          </Badge>
        </div>
        {compliance?.outstandingIssues > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-400 font-medium">
              ⚠ {compliance.outstandingIssues} outstanding compliance issues
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRecordsCard({ patients }: { patients: LocalPatient[] }) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardHeader>
        <CardTitle className="text-white">Recent Patient Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patients.slice(0, 5).map((patient) => (
            <div
              key={patient.id}
              className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default hover:border-blue-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">MRN: {patient.mrn}</p>
                </div>
                <Badge variant={patient.status === "ACTIVE" ? "success" : "default"}>
                  {patient.status}
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                <span>Age: {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}</span>
                <span>•</span>
                <span>Conditions: {patient.activeConditionsCount}</span>
                <span>•</span>
                <span>Medications: {patient.medicationsCount}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderSummaryCard() {
  const providers = [
    { name: "Dr. Sarah Johnson", specialty: "Internal Medicine", patients: 45 },
    { name: "Dr. Michael Chen", specialty: "Cardiology", patients: 32 },
    { name: "Dr. Emily Watson", specialty: "Pediatrics", patients: 28 },
  ];

  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardHeader>
        <CardTitle className="text-white">Provider Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {providers.map((prov) => (
            <div
              key={prov.name}
              className="flex items-center justify-between p-3 hover:bg-wl-bg-elevated rounded-lg transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-white">{prov.name}</p>
                <p className="text-xs text-gray-500">{prov.specialty}</p>
              </div>
              <Badge variant="info">{prov.patients}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface LocalPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  status: string;
  dateOfBirth: string;
  activeConditionsCount: number;
  medicationsCount: number;
}

interface Compliance {
  hipaaCompliant: boolean;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  accessControlsConfigured: boolean;
  outstandingIssues: number;
}

export default function HealthcarePage() {
  const { items: patients, loading, error, refetch } = useApiList<LocalPatient>('/api/v4/customers?type=patient');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const compliance: Compliance = {
    hipaaCompliant: true,
    encryptionEnabled: true,
    auditLoggingEnabled: true,
    accessControlsConfigured: true,
    outstandingIssues: 0,
  };

  // Simulate additional metrics
  const activePatients = patients.filter((p) => p.status === "ACTIVE").length;
  const totalEncounters = 128;
  const labResultsThisMonth = 42;
  const pendingAlerts = 3;

  const kpiCards: KPICard[] = [
    {
      label: "Active Patients",
      value: activePatients,
      icon: "patients",
      trend: "up",
      trendValue: "3%",
    },
    {
      label: "Encounters",
      value: totalEncounters,
      icon: "encounters",
      trend: "up",
      trendValue: "8%",
    },
    {
      label: "Lab Results",
      value: labResultsThisMonth,
      unit: "This Month",
      icon: "lab",
    },
    {
      label: "Pending Alerts",
      value: pendingAlerts,
      icon: "alerts",
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-wl-bg-root min-h-screen">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Healthcare Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Patient management and clinical oversight</p>
        </div>
        <Button variant="primary">
          + Add Patient
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <KPICardComponent key={idx} card={card} />
        ))}
      </div>

      {/* Compliance and Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentRecordsCard patients={patients} />
        </div>
        <div>
          <ComplianceStatusCard compliance={compliance} />
        </div>
      </div>

      {/* Provider Summary */}
      <ProviderSummaryCard />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Avg. Patient Age</p>
            <p className="text-3xl font-bold text-white">
              {Math.round(
                patients.reduce(
                  (sum, p) =>
                    sum +
                    (new Date().getFullYear() -
                      new Date(p.dateOfBirth).getFullYear()),
                  0
                ) / (patients.length || 1)
              )}
            </p>
            <p className="text-xs text-gray-500 mt-2">Across all patients</p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">System Status</p>
            <p className="text-3xl font-bold text-emerald-400">Operational</p>
            <p className="text-xs text-gray-500 mt-2">All systems normal</p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-400 mb-2">Data Backup</p>
            <p className="text-3xl font-bold text-white">Completed</p>
            <p className="text-xs text-gray-500 mt-2">Last run: Today 11:00 PM</p>
          </CardContent>
        </Card>
      </div>

      {/* HIPAA Notice */}
      <Card className="bg-blue-500/10 border border-blue-500/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-400 mb-1">HIPAA Compliance Notice</p>
              <p className="text-sm text-gray-400">
                All patient information is encrypted and access is logged for audit purposes.
                Ensure you follow proper procedures when accessing and handling patient records.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
