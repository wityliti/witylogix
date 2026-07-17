'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { AlertCircle, Users, Clock, FileText, CheckCircle2, Shield, Server } from 'lucide-react';

interface KPICard {
  label: string;
  value: number | string;
  unit?: string;
  icon: string;
}

function KPICardComponent({ card }: { card: KPICard }) {
  const icons: Record<string, React.ReactNode> = {
    patients: <Users className="w-8 h-8 text-wl-info-500/30" />,
    encounters: <Clock className="w-8 h-8 text-cyan-500/30" />,
    lab: <FileText className="w-8 h-8 text-purple-500/30" />,
    alerts: <AlertCircle className="w-8 h-8 text-wl-warning-500/30" />,
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
          </div>
          <div className="ml-4">{icons[card.icon] || null}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Compliance {
  hipaaCompliant: boolean;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  accessControlsConfigured: boolean;
  outstandingIssues: number;
}

function ComplianceStatusCard({ compliance, loading }: { compliance: Compliance | null; loading: boolean }) {
  if (loading) return <TableSkeleton rows={4} />;
  const c: Compliance = compliance ?? {
    hipaaCompliant: false,
    encryptionEnabled: true,
    auditLoggingEnabled: true,
    accessControlsConfigured: false,
    outstandingIssues: 2,
  };
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
          <Badge variant={c.hipaaCompliant ? 'success' : 'danger'}>
            {c.hipaaCompliant ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Encryption</span>
          <Badge variant={c.encryptionEnabled ? 'success' : 'warning'}>
            {c.encryptionEnabled ? 'Platform-level' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Audit Logging</span>
          <Badge variant={c.auditLoggingEnabled ? 'success' : 'warning'}>
            {c.auditLoggingEnabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg">
          <span className="text-sm text-wl-text-secondary">Access Controls</span>
          <Badge variant={c.accessControlsConfigured ? 'success' : 'warning'}>
            {c.accessControlsConfigured ? 'Configured' : 'Pending'}
          </Badge>
        </div>
        {c.outstandingIssues > 0 && (
          <div className="p-3 bg-wl-warning-500/10 border border-wl-warning-500/30 rounded-lg">
            <p className="text-xs text-wl-warning-400 font-medium">
              ⚠ {c.outstandingIssues} outstanding compliance issue{c.outstandingIssues !== 1 ? 's' : ''}
            </p>
          </div>
        )}
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

function RecentRecordsCard({ patients }: { patients: LocalPatient[] }) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardHeader>
        <CardTitle className="text-white">Recent Patient Records</CardTitle>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <div className="text-center py-8 text-wl-text-tertiary">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No patient records yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.slice(0, 5).map((patient) => (
              <div
                key={patient.id}
                className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default hover:border-wl-info-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-xs text-wl-text-tertiary mt-1">MRN: {patient.mrn || '—'}</p>
                  </div>
                  <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'default'}>
                    {patient.status}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs text-wl-text-secondary">
                  <span>
                    Age:{' '}
                    {patient.dateOfBirth
                      ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()
                      : '—'}
                  </span>
                  <span>•</span>
                  <span>Conditions: {patient.activeConditionsCount ?? 0}</span>
                  <span>•</span>
                  <span>Medications: {patient.medicationsCount ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ShopSettings {
  hipaaMode?: boolean;
  mfaRequired?: boolean;
  authProviders?: string[];
  [key: string]: unknown;
}

interface ShopResponse {
  id: string;
  settings: ShopSettings;
  users?: unknown[];
}

interface PlatformService {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
}

interface PlatformStatus {
  score: number;
  services: PlatformService[];
  summary: { total: number; healthy: number; degraded: number; down: number };
}

export default function HealthcarePage() {
  const { items: patients, loading: patientsLoading, error: patientsError, refetch } =
    useApiList<LocalPatient>('/api/v4/customers?type=patient');

  const { data: shopData, loading: shopLoading, error: shopError } = useApiQuery<ShopResponse>('/api/v4/shops/me');

  const { data: platformStatus, loading: platformLoading, error: platformError } =
    useApiQuery<PlatformStatus>('/api/v4/platform/status');

  const compliance = useMemo<Compliance | null>(() => {
    if (shopLoading) return null;
    const settings = (shopData as any)?.data?.settings ?? (shopData as any)?.settings ?? {};
    const hipaaEnabled = settings?.hipaaMode === true;
    const hasMfa = settings?.mfaRequired === true;
    const hasAuthProviders = Array.isArray(settings?.authProviders) && settings.authProviders.length > 0;
    const accessConfigured = hasMfa || hasAuthProviders;
    const issues = [!hipaaEnabled].filter(Boolean).length;
    return {
      hipaaCompliant: hipaaEnabled,
      encryptionEnabled: true,
      auditLoggingEnabled: true,
      accessControlsConfigured: accessConfigured,
      outstandingIssues: issues,
    };
  }, [shopData, shopLoading]);

  const systemStatus = useMemo<{ label: string; color: string }>(() => {
    if (platformLoading || !platformStatus) return { label: '—', color: 'text-wl-text-secondary' };
    const s = (platformStatus as any)?.data ?? platformStatus;
    const score = s?.score ?? 0;
    if (score >= 90) return { label: 'Operational', color: 'text-wl-success-400' };
    if (score >= 50) return { label: 'Degraded', color: 'text-wl-warning-400' };
    return { label: 'Disrupted', color: 'text-wl-danger-400' };
  }, [platformStatus, platformLoading]);

  const activePatients = patients.filter((p) => p.status === 'ACTIVE').length;

  const kpiCards: KPICard[] = [
    { label: 'Total Patients', value: patients.length, icon: 'patients' },
    { label: 'Active Patients', value: activePatients, icon: 'encounters' },
  ];

  if (patientsLoading) return <LoadingSkeleton />;
  if (patientsError) return <ErrorState message={patientsError.message} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6 bg-wl-bg-root min-h-screen">
      {/* Secondary error banners */}
      {shopError && (
        <div className="px-4 py-2 rounded-md bg-wl-warning-500/10 border border-wl-warning-500/30 text-wl-warning-400 text-sm">
          Could not load compliance settings: {shopError.message}
        </div>
      )}
      {platformError && (
        <div className="px-4 py-2 rounded-md bg-wl-warning-500/10 border border-wl-warning-500/30 text-wl-warning-400 text-sm">
          Could not load platform status: {platformError.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Healthcare Dashboard</h1>
          <p className="text-sm text-wl-text-secondary mt-1">Patient management and clinical oversight</p>
        </div>
        <Button variant="primary">+ Add Patient</Button>
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
          <ComplianceStatusCard compliance={compliance} loading={shopLoading} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-wl-text-secondary mb-2">Avg. Patient Age</p>
            <p className="text-3xl font-bold text-white">
              {patients.length === 0
                ? '—'
                : Math.round(
                    patients.reduce(
                      (sum, p) =>
                        sum + (p.dateOfBirth
                          ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()
                          : 0),
                      0,
                    ) / patients.length,
                  )}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">Across all patients</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-wl-text-secondary">System Status</p>
              <Server className="w-4 h-4 text-wl-text-tertiary" />
            </div>
            {platformLoading ? (
              <div className="h-8 bg-wl-bg-elevated rounded animate-pulse" />
            ) : (
              <p className={cn('text-3xl font-bold', systemStatus.color)}>{systemStatus.label}</p>
            )}
            <p className="text-xs text-wl-text-tertiary mt-2">
              {platformLoading
                ? 'Checking services…'
                : platformStatus
                ? `${((platformStatus as any)?.data ?? platformStatus)?.summary?.healthy ?? 0}/${((platformStatus as any)?.data ?? platformStatus)?.summary?.total ?? 0} services healthy`
                : 'Status unavailable'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-wl-text-secondary mb-2">Inactive Patients</p>
            <p className="text-3xl font-bold text-white">
              {patients.length - activePatients}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">
              {patients.length > 0
                ? `${Math.round(((patients.length - activePatients) / patients.length) * 100)}% of total`
                : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* HIPAA Notice */}
      <Card className="bg-wl-info-500/10 border border-wl-info-500/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-wl-info-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-wl-info-400 mb-1">HIPAA Compliance Notice</p>
              <p className="text-sm text-wl-text-secondary">
                All patient information is encrypted at rest and access is logged for audit purposes.
                {!compliance?.hipaaCompliant && (
                  <span className="block mt-1 text-wl-warning-400">
                    Enable HIPAA Mode in Settings → Organization to activate full compliance controls.
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
