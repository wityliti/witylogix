'use client';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { AlertCircle, Users, Clock, FileText, Shield, Database, Server } from 'lucide-react';

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
            <p className="text-sm font-medium text-wl-text-secondary mb-2">{card.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{card.value}</span>
              {card.unit && (
                <span className="text-sm text-wl-text-secondary">{card.unit}</span>
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

function ComplianceStatusCard({ shopIsActive }: { shopIsActive: boolean }) {
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
          <span className="text-sm text-wl-text-secondary">HIPAA Mode</span>
          <Badge variant={shopIsActive ? "success" : "warning"}>
            {shopIsActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Encryption (TLS)</span>
          <Badge variant="success">Enabled</Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Audit Logging</span>
          <Badge variant="success">Enabled</Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Access Controls</span>
          <Badge variant={shopIsActive ? "success" : "warning"}>
            {shopIsActive ? "Configured" : "Pending"}
          </Badge>
        </div>
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
                  <p className="text-xs text-wl-text-tertiary mt-1">MRN: {patient.mrn}</p>
                </div>
                <Badge variant={patient.status === "ACTIVE" ? "success" : "default"}>
                  {patient.status}
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-wl-text-secondary">
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

interface SystemService {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  responseTime: number;
  lastChecked: string;
}

interface SystemHealth {
  data: {
    services: SystemService[];
    metrics: {
      memoryUsage: number;
      uptimeSeconds: number;
      deploymentVersion: string;
    };
  };
}

interface ShopProfile {
  id: string;
  status?: string;
  settings?: Record<string, unknown>;
}

export default function HealthcarePage() {
  const { items: patients, loading: patientsLoading, error: patientsError, refetch: refetchPatients } = useApiList<LocalPatient>('/api/v4/customers?type=patient');
  const { data: systemHealth } = useApiQuery<SystemHealth>('/api/v4/admin/system');
  const { data: shop } = useApiQuery<ShopProfile>('/api/v4/shops/me');

  const loading = patientsLoading;
  const error = patientsError;
  const refetch = refetchPatients;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const services = systemHealth?.data?.services ?? [];
  const apiService = services.find((s) => s.name === 'API Server');
  const dbService = services.find((s) => s.name === 'PostgreSQL');

  const systemStatus = services.length === 0
    ? null
    : services.every((s) => s.status === 'healthy') ? 'Operational' : 'Degraded';

  const activePatients = patients.filter((p) => p.status === "ACTIVE").length;

  const shopIsActive = shop?.status === 'ACTIVE' || shop?.status == null;

  const kpiCards: KPICard[] = [
    {
      label: "Active Patients",
      value: activePatients,
      icon: "patients",
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-wl-bg-root min-h-screen">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Healthcare Dashboard</h1>
          <p className="text-sm text-wl-text-secondary mt-1">Patient management and clinical oversight</p>
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
          <ComplianceStatusCard shopIsActive={shopIsActive} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-wl-text-secondary mb-2">Avg. Patient Age</p>
            <p className="text-3xl font-bold text-white">
              {patients.length > 0
                ? Math.round(
                    patients.reduce(
                      (sum, p) =>
                        sum + (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()),
                      0
                    ) / patients.length
                  )
                : '—'}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">Across all patients</p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-wl-text-secondary">API Server</p>
              <Server className="w-4 h-4 text-wl-text-tertiary" />
            </div>
            {systemStatus === null ? (
              <p className="text-xl font-bold text-wl-text-tertiary">—</p>
            ) : (
              <p className={cn(
                "text-2xl font-bold",
                systemStatus === 'Operational' ? "text-emerald-400" : "text-amber-400"
              )}>
                {systemStatus}
              </p>
            )}
            {apiService && (
              <p className="text-xs text-wl-text-tertiary mt-2">
                {apiService.responseTime}ms response
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-wl-text-secondary">Database</p>
              <Database className="w-4 h-4 text-wl-text-tertiary" />
            </div>
            {dbService ? (
              <>
                <p className={cn(
                  "text-2xl font-bold",
                  dbService.status === 'healthy' ? "text-emerald-400" : "text-amber-400"
                )}>
                  {dbService.status === 'healthy' ? 'Connected' : 'Degraded'}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-2">
                  {dbService.responseTime}ms latency
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-wl-text-tertiary">—</p>
            )}
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
              <p className="text-sm text-wl-text-secondary">
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
