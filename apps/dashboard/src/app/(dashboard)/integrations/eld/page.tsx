'use client';

import { useState } from 'react';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  Truck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  MapPin,
  Plus,
  RefreshCw,
} from 'lucide-react';

// ── API types ──────────────────────────────────────────────────────────────

interface EldDriver {
  driverId: string;
  name: string;
  status: string;
  currentDuty: string;
  drivingRemaining: number;
  breakStatus: string;
  violations: number;
  lastUpdate: string;
}

interface EldViolation {
  id: string;
  driverId: string;
  driverName: string;
  type: string;
  severity: string;
  timestamp: string;
  duration: number;
  description: string;
  suggestedAction: string;
}

interface EldDvir {
  id: string;
  driverId: string;
  vehicleId: string;
  status: string;
  submittedAt: string;
  defects?: Array<{ id: string; component: string; severity: string; description: string }>;
}

interface EldCompliance {
  hosCompliance: number;
  dvirCompliance: number;
  totalDrivers: number;
  violations: number;
  period: string;
}

interface IntegrationConnection {
  id: string;
  name: string;
  slug: string;
  category: string;
  healthStatus: string | null;
  lastSyncAt: string | null;
  isEnabled: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function dutyBadge(duty: string) {
  const d = duty.toLowerCase();
  if (d === 'driving') return <Badge variant="danger" className="text-xs bg-wl-danger-500/10 text-wl-danger-400">Driving</Badge>;
  if (d === 'on_duty') return <Badge variant="warning" className="text-xs bg-wl-warning-500/10 text-wl-warning-400">On Duty</Badge>;
  if (d === 'sleeper') return <Badge variant="info" className="text-xs bg-wl-info-500/10 text-wl-info-400">Sleeper</Badge>;
  return <Badge variant="default" className="text-xs">Off Duty</Badge>;
}

function severityBadge(sev: string) {
  const s = sev.toLowerCase();
  if (s === 'critical') return <Badge variant="danger" className="text-xs bg-wl-danger-500/10 text-wl-danger-400">Critical</Badge>;
  if (s === 'warning') return <Badge variant="warning" className="text-xs bg-wl-warning-500/10 text-wl-warning-400">Warning</Badge>;
  return <Badge variant="info" className="text-xs">Info</Badge>;
}

function connStatusBadge(health: string | null) {
  if (health === 'HEALTHY') return <Badge variant="success" className="text-xs bg-wl-success-500/10 text-wl-success-400"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
  if (health === 'DEGRADED') return <Badge variant="warning" className="text-xs bg-wl-warning-500/10 text-wl-warning-400">Degraded</Badge>;
  if (health === 'UNHEALTHY') return <Badge variant="danger" className="text-xs bg-wl-danger-500/10 text-wl-danger-400">Error</Badge>;
  return <Badge variant="default" className="text-xs">Disconnected</Badge>;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({
  label, badge, expanded, onToggle, children,
}: {
  label: string; badge?: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <button
        className="flex items-center justify-between w-full mb-5 text-left group"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-wl-text-primary">{label}</h2>
          {badge}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-wl-text-tertiary transition-transform group-hover:text-wl-text-secondary', expanded ? 'rotate-180' : '')} />
      </button>
      {expanded && children}
    </div>
  );
}

// ── HOS bar ────────────────────────────────────────────────────────────────

function HosBar({ remaining, max = 11 }: { remaining: number; max?: number }) {
  const pct = Math.min(100, (remaining / max) * 100);
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-wl-bg-overlay overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-wl-text-tertiary w-10 text-right">{remaining.toFixed(1)}h</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ELDIntegrationPage() {
  const [sections, setSections] = useState({ providers: true, drivers: true, dvir: false, violations: true });
  const toggle = (k: keyof typeof sections) => setSections((p) => ({ ...p, [k]: !p[k] }));

  const { items: connections, loading: connLoading, error: connError, refetch: connRefetch } =
    useApiList<IntegrationConnection>('/api/v4/integrations/connections?category=eld&limit=20');

  const { items: eldDrivers, loading: drvLoading, error: drvError, refetch: drvRefetch } =
    useApiList<EldDriver>('/api/v4/eld/drivers?limit=50');

  const { items: violations, loading: violLoading, error: violError, refetch: violRefetch } =
    useApiList<EldViolation>('/api/v4/eld/violations?limit=20');

  const { items: dvirList, loading: dvirLoading, error: dvirError, refetch: dvirRefetch } =
    useApiList<EldDvir>('/api/v4/eld/dvir?limit=10');

  const { data: compliance, loading: compLoading } =
    useApiQuery<EldCompliance>('/api/v4/eld/compliance');

  const criticalCount = violations.filter((v) => v.severity.toLowerCase() === 'critical').length;
  const dvirFails = dvirList.filter((d) => d.status === 'FAIL' || d.status === 'fail').length;
  const connectedCount = connections.filter((c) => c.healthStatus === 'HEALTHY').length;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="ELD Integrations"
        subtitle="Manage electronic logging devices, HOS compliance, and vehicle inspections"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/integrations">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5 text-wl-text-tertiary hover:text-wl-text-secondary">
            <ChevronLeft className="w-4 h-4" />
            Back to Integrations
          </Button>
        </Link>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'ELD Providers',
              value: connLoading ? '…' : `${connectedCount}/${connections.length}`,
              sub: 'connected',
              icon: <Truck className="w-4 h-4" />,
              color: 'text-wl-text-primary',
            },
            {
              label: 'HOS Compliance',
              value: compLoading ? '…' : `${compliance?.hosCompliance ?? '—'}%`,
              sub: 'fleet average',
              icon: <Clock className="w-4 h-4" />,
              color: 'text-wl-success-400',
            },
            {
              label: 'Violations',
              value: violLoading ? '…' : violations.length.toString(),
              sub: `${criticalCount} critical`,
              icon: <AlertTriangle className="w-4 h-4" />,
              color: violations.length > 0 ? 'text-wl-danger-400' : 'text-wl-success-400',
            },
            {
              label: 'DVIR Pass Rate',
              value: compLoading ? '…' : `${compliance?.dvirCompliance ?? '—'}%`,
              sub: `${dvirFails} failures`,
              icon: <Shield className="w-4 h-4" />,
              color: dvirFails > 0 ? 'text-wl-warning-400' : 'text-wl-success-400',
            },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">{label}</p>
                <span className="text-wl-text-tertiary">{icon}</span>
              </div>
              <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
              <p className="text-xs text-wl-text-tertiary mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── ELD Providers ────────────────────────────────────────────── */}
        <Section
          label="ELD Providers"
          badge={<Badge variant="success" className="bg-wl-success-500/10 text-wl-success-400 text-xs">{connectedCount} connected</Badge>}
          expanded={sections.providers}
          onToggle={() => toggle('providers')}
        >
          {connLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : connError ? (
            <ErrorState title="Failed to load ELD providers" onRetry={connRefetch} />
          ) : connections.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-10 text-center">
              <Truck className="w-8 h-8 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary mb-1">No ELD providers connected</p>
              <p className="text-xs text-wl-text-tertiary mb-4">Connect Motive, Omnitracs, Azuga, or other ELD providers</p>
              <Link href="/integrations/marketplace">
                <Button variant="primary" size="sm"><Plus className="w-4 h-4 mr-1.5" />Browse Providers</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {connections.map((conn) => (
                <div key={conn.id} className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-5 hover:border-wl-border-strong transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-wl-bg-elevated border border-wl-border-default flex items-center justify-center">
                        <Truck className="w-5 h-5 text-wl-text-secondary" />
                      </div>
                      <div>
                        <p className="font-semibold text-wl-text-primary text-sm">{conn.name}</p>
                        <p className="text-xs text-wl-text-tertiary mt-0.5">{conn.slug}</p>
                      </div>
                    </div>
                    {connStatusBadge(conn.healthStatus)}
                  </div>
                  {conn.lastSyncAt && (
                    <p className="text-xs text-wl-text-tertiary flex items-center gap-1 mb-4">
                      <RefreshCw className="w-3 h-3" />
                      Last sync: {fmtTime(conn.lastSyncAt)}
                    </p>
                  )}
                  <div className="flex gap-2 pt-3 border-t border-wl-border-default">
                    <Link href={`/integrations/connected/${conn.slug}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">Configure</Button>
                    </Link>
                    <Link href="/eld">
                      <Button variant="ghost" size="sm" className="text-wl-text-tertiary hover:text-wl-text-secondary">
                        <Activity className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── HOS Driver Status ─────────────────────────────────────────── */}
        <Section
          label="HOS Driver Status"
          badge={
            violations.length > 0 ? (
              <Badge variant="warning" className="bg-wl-warning-500/10 text-wl-warning-400 text-xs">
                {violations.length} violations
              </Badge>
            ) : (
              <Badge variant="success" className="bg-wl-success-500/10 text-wl-success-400 text-xs">All compliant</Badge>
            )
          }
          expanded={sections.drivers}
          onToggle={() => toggle('drivers')}
        >
          {drvLoading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : drvError ? (
            <ErrorState title="Failed to load driver HOS data" onRetry={drvRefetch} />
          ) : eldDrivers.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-8 text-center">
              <Truck className="w-7 h-7 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary">No active drivers with ELD data</p>
              <p className="text-xs text-wl-text-tertiary mt-1">Connect an ELD provider to see HOS records</p>
            </div>
          ) : (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    {['Driver', 'Duty Status', 'Driving Remaining', 'Violations', 'Break', 'Updated'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-default">
                  {eldDrivers.map((drv) => (
                    <tr key={drv.driverId} className={cn('hover:bg-wl-bg-elevated transition-colors', drv.violations > 0 && 'bg-red-950/20')}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-wl-text-primary">{drv.name}</p>
                        <p className="text-xs text-wl-text-tertiary font-mono">{drv.driverId.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">{dutyBadge(drv.currentDuty)}</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <HosBar remaining={drv.drivingRemaining} />
                      </td>
                      <td className="px-4 py-3">
                        {drv.violations > 0 ? (
                          <span className="inline-flex items-center gap-1 text-wl-danger-400 text-sm font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {drv.violations}
                          </span>
                        ) : (
                          <span className="text-wl-success-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs', drv.breakStatus === 'REQUIRED' ? 'text-wl-warning-400 font-medium' : 'text-wl-text-tertiary')}>
                          {drv.breakStatus === 'REQUIRED' ? 'Required' : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-wl-text-tertiary">
                        {fmtTime(drv.lastUpdate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-wl-border-default flex justify-end">
                <Link href="/eld">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
                    Full ELD Dashboard <ChevronLeft className="w-3 h-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Section>

        {/* ── DVIR Reports ─────────────────────────────────────────────── */}
        <Section
          label="Recent DVIR Reports"
          badge={dvirFails > 0 ? (
            <Badge variant="danger" className="bg-wl-danger-500/10 text-wl-danger-400 text-xs">{dvirFails} failures</Badge>
          ) : (
            <Badge variant="success" className="bg-wl-success-500/10 text-wl-success-400 text-xs">All clear</Badge>
          )}
          expanded={sections.dvir}
          onToggle={() => toggle('dvir')}
        >
          {dvirLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : dvirError ? (
            <ErrorState title="Failed to load DVIR reports" onRetry={dvirRefetch} />
          ) : dvirList.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-8 text-center">
              <Shield className="w-7 h-7 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary">No DVIR reports yet</p>
              <p className="text-xs text-wl-text-tertiary mt-1">Reports appear after drivers complete pre/post-trip inspections</p>
            </div>
          ) : (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    {['Report ID', 'Vehicle', 'Status', 'Defects', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-default">
                  {dvirList.map((dvir) => {
                    const fail = dvir.status === 'FAIL' || dvir.status === 'fail';
                    const pending = dvir.status === 'PENDING' || dvir.status === 'pending';
                    return (
                      <tr key={dvir.id} className={cn('hover:bg-wl-bg-elevated transition-colors', fail && 'bg-red-950/20')}>
                        <td className="px-4 py-3 text-xs text-wl-text-tertiary font-mono">{dvir.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">{dvir.vehicleId}</td>
                        <td className="px-4 py-3">
                          {fail ? (
                            <Badge variant="danger" className="text-xs bg-wl-danger-500/10 text-wl-danger-400">Fail</Badge>
                          ) : pending ? (
                            <Badge variant="warning" className="text-xs bg-wl-warning-500/10 text-wl-warning-400">Pending</Badge>
                          ) : (
                            <Badge variant="success" className="text-xs bg-wl-success-500/10 text-wl-success-400">Pass</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">
                          {dvir.defects?.length ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-wl-text-tertiary">
                          {fmtTime(dvir.submittedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-wl-border-default flex justify-end">
                <Link href="/eld/dvir">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
                    All DVIR reports <ChevronLeft className="w-3 h-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Section>

        {/* ── Violation Alerts ──────────────────────────────────────────── */}
        <Section
          label="Violation Alerts"
          badge={criticalCount > 0 ? (
            <Badge variant="danger" className="bg-wl-danger-500/10 text-wl-danger-400 text-xs">{criticalCount} critical</Badge>
          ) : violations.length > 0 ? (
            <Badge variant="warning" className="bg-wl-warning-500/10 text-wl-warning-400 text-xs">{violations.length} open</Badge>
          ) : (
            <Badge variant="success" className="bg-wl-success-500/10 text-wl-success-400 text-xs">No violations</Badge>
          )}
          expanded={sections.violations}
          onToggle={() => toggle('violations')}
        >
          {violLoading ? (
            <TableSkeleton rows={3} columns={5} />
          ) : violError ? (
            <ErrorState title="Failed to load violations" onRetry={violRefetch} />
          ) : violations.length === 0 ? (
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-8 text-center">
              <CheckCircle2 className="w-7 h-7 text-wl-success-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-wl-text-secondary">No active violations</p>
              <p className="text-xs text-wl-text-tertiary mt-1">All drivers are within HOS limits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {violations.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    'rounded-xl border px-5 py-4',
                    v.severity.toLowerCase() === 'critical'
                      ? 'bg-red-950/20 border-wl-danger-500/20'
                      : 'bg-wl-bg-surface border-wl-border-default',
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {severityBadge(v.severity)}
                      <span className="text-sm font-medium text-wl-text-primary">{v.type.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-xs text-wl-text-tertiary">{fmtTime(v.timestamp)}</span>
                  </div>
                  <p className="text-xs text-wl-text-secondary mb-1">
                    Driver: <span className="text-wl-text-primary font-medium">{v.driverName}</span>
                  </p>
                  <p className="text-xs text-wl-text-tertiary">{v.description}</p>
                  {v.suggestedAction && (
                    <p className="text-xs text-wl-warning-400 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {v.suggestedAction}
                    </p>
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <Link href="/eld">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-wl-text-tertiary hover:text-wl-text-secondary">
                    Full ELD compliance <ChevronLeft className="w-3 h-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Section>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-wl-bg-surface border border-wl-border-default px-5 py-4">
          <div>
            <p className="text-sm font-medium text-wl-text-primary">Need another ELD provider?</p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">Browse Motive, Omnitracs, Azuga, and more in the marketplace</p>
          </div>
          <Link href="/integrations/marketplace">
            <Button variant="primary" size="sm"><Plus className="w-4 h-4 mr-1.5" />Browse ELD Providers</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
