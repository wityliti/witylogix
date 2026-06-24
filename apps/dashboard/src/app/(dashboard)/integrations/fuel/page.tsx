'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Fuel,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  DollarSign,
  Clock,
  Download,
  BarChart3,
  Plug,
  MapPin,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   FUEL INTEGRATIONS — Real API data
   Fuel card providers come from /api/v4/integrations/connections
   Fuel transactions come from /api/v4/fleet/fuel-transactions
   ═══════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────

interface Connection {
  id: string;
  providerName: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

interface FuelTransaction {
  id: string;
  vehicleId: string;
  date: string;
  station?: string;
  gallons?: number;
  amount?: number;
  price?: number;
  mpg?: number;
  flagged?: boolean;
  location?: string;
  status?: string;
}

type TabView = 'providers' | 'transactions' | 'analytics' | 'stations' | 'reports';

// ── Helpers ──────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'connected') return 'success';
  if (s === 'pending') return 'info';
  if (s === 'error') return 'danger';
  return 'default';
};

const statusIcon = (s: string) => {
  if (s === 'connected') return <CheckCircle className="w-4 h-4 text-wl-success-400" />;
  if (s === 'error') return <AlertCircle className="w-4 h-4 text-wl-danger-400" />;
  return <Clock className="w-4 h-4 text-wl-text-tertiary" />;
};

// ── Empty state ──────────────────────────────────────────────

function Empty({ icon: Icon, title, body, cta }: { icon: typeof Plug; title: string; body: string; cta?: React.ReactNode }) {
  return (
    <Card className="p-12 text-center bg-wl-bg-surface border-wl-border-default">
      <div className="w-12 h-12 rounded-full bg-wl-bg-overlay flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-wl-text-tertiary" />
      </div>
      <p className="text-sm font-medium text-wl-text-secondary mb-1">{title}</p>
      <p className="text-xs text-wl-text-tertiary mb-4">{body}</p>
      {cta}
    </Card>
  );
}

// ── Providers tab ────────────────────────────────────────────

function ProvidersTab({ connections, loading, error }: { connections: Connection[]; loading: boolean; error: Error | null }) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  const fuelConnections = connections.filter(
    (c) => c.category === 'fleet' || c.category === 'fuel' || c.providerName.toLowerCase().includes('fuel'),
  );

  if (fuelConnections.length === 0) {
    return (
      <Empty
        icon={Plug}
        title="No fuel integrations connected"
        body="Connect WEX, Comdata, Fuelman, or EFS to manage fuel cards and track fuel costs in real time."
        cta={
          <Button variant="primary" size="sm" onClick={() => window.location.href = '/integrations/catalog'}>
            Browse Fuel Integrations
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {fuelConnections.map((c) => (
        <Card key={c.id} className="p-5 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {statusIcon(c.status)}
              <div>
                <p className="text-sm font-semibold text-wl-text-primary">{c.providerName}</p>
                {c.lastSyncTime && (
                  <p className="text-xs text-wl-text-tertiary mt-0.5">
                    Last sync {formatDate(c.lastSyncTime)}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={statusVariant(c.status)} dot>
              {c.status}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-wl-border-subtle pt-4">
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-wl-text-primary">{c.apiCallsCount.toLocaleString()}</p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">API calls</p>
            </div>
            <div className="text-center">
              <p className={cn('text-lg font-bold font-mono', c.errorCount > 0 ? 'text-wl-danger-400' : 'text-wl-success-400')}>
                {c.errorCount}
              </p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">Errors</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-wl-text-primary">{c.uptime}%</p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">Uptime</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Transactions tab ─────────────────────────────────────────

function TransactionsTab({ transactions, loading, error }: { transactions: FuelTransaction[]; loading: boolean; error: Error | null }) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  if (transactions.length === 0) {
    return (
      <Empty
        icon={Fuel}
        title="No fuel transactions recorded"
        body="Fuel transactions appear here once vehicles with telematics providers record fuel events."
      />
    );
  }

  const flagged = transactions.filter((t) => t.flagged || t.status === 'FLAGGED');

  return (
    <div className="space-y-4">
      {flagged.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-warning-500/10 border border-wl-warning-500/20">
          <AlertTriangle className="w-4 h-4 text-wl-warning-400 shrink-0" />
          <p className="text-sm text-wl-warning-400">
            {flagged.length} transaction{flagged.length !== 1 ? 's' : ''} flagged for review
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-wl-border-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-wl-border-subtle bg-wl-bg-elevated/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide hidden md:table-cell">Station</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Gallons</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, idx) => (
              <tr
                key={t.id}
                className={cn(
                  'border-b border-wl-border-subtle/50 transition-colors hover:bg-wl-bg-elevated/50',
                  idx % 2 !== 0 && 'bg-wl-bg-elevated/20',
                  t.flagged && 'bg-wl-warning-500/5',
                )}
              >
                <td className="px-4 py-3 text-xs text-wl-text-secondary whitespace-nowrap">
                  {formatDate(t.date)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-wl-text-primary">{t.station || t.location || '—'}</span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono text-wl-text-primary">
                  {t.gallons != null ? t.gallons.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono text-wl-text-primary">
                  {t.amount != null ? formatCurrency(t.amount) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {t.flagged ? (
                    <Badge variant="warning" dot>Flagged</Badge>
                  ) : (
                    <Badge variant="success" dot>OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────

function AnalyticsTab({ transactions }: { transactions: FuelTransaction[] }) {
  const stats = useMemo(() => {
    const withAmount = transactions.filter((t) => t.amount != null);
    const totalCost = withAmount.reduce((s, t) => s + (t.amount ?? 0), 0);
    const totalGallons = transactions.reduce((s, t) => s + (t.gallons ?? 0), 0);
    const avgPpg = totalGallons > 0 ? totalCost / totalGallons : 0;
    const mpgValues = transactions.map((t) => t.mpg).filter((v): v is number => v != null && v > 0);
    const avgMpg = mpgValues.length > 0 ? mpgValues.reduce((a, b) => a + b, 0) / mpgValues.length : 0;
    const flagged = transactions.filter((t) => t.flagged).length;
    return { totalCost, totalGallons, avgPpg, avgMpg, flagged, count: transactions.length };
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <Empty
        icon={BarChart3}
        title="No data to analyse yet"
        body="Analytics will appear once fuel transactions are recorded from your fleet telematics."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
          <p className="text-xs text-wl-text-tertiary mb-1">Total Spend</p>
          <p className="text-2xl font-bold font-mono text-wl-text-primary">{formatCurrency(stats.totalCost)}</p>
        </Card>
        <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
          <p className="text-xs text-wl-text-tertiary mb-1">Total Gallons</p>
          <p className="text-2xl font-bold font-mono text-wl-text-primary">{stats.totalGallons.toFixed(0)}</p>
        </Card>
        <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
          <p className="text-xs text-wl-text-tertiary mb-1">Avg Price/Gallon</p>
          <p className="text-2xl font-bold font-mono text-wl-text-primary">{formatCurrency(stats.avgPpg)}</p>
        </Card>
        <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
          <p className="text-xs text-wl-text-tertiary mb-1">Avg MPG</p>
          <p className="text-2xl font-bold font-mono text-wl-text-primary">
            {stats.avgMpg > 0 ? stats.avgMpg.toFixed(1) : '—'}
          </p>
        </Card>
      </div>

      <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
        <p className="text-sm font-medium text-wl-text-primary mb-3">Fuel Efficiency Overview</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold font-mono text-wl-text-primary">{stats.count}</p>
            <p className="text-xs text-wl-text-tertiary mt-1">Transactions</p>
          </div>
          <div>
            <p className={cn('text-2xl font-bold font-mono', stats.flagged > 0 ? 'text-wl-warning-400' : 'text-wl-success-400')}>
              {stats.flagged}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-1">Flagged</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-wl-text-primary">
              {stats.count > 0 ? (((stats.count - stats.flagged) / stats.count) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-xs text-wl-text-tertiary mt-1">Compliance</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function FuelIntegrationsPage() {
  const [view, setView] = useState<TabView>('providers');

  const {
    items: allConnections,
    loading: connLoading,
    error: connError,
  } = useApiList<Connection>('/api/v4/integrations/connections');

  const {
    items: transactions,
    loading: txLoading,
    error: txError,
  } = useApiList<FuelTransaction>('/api/v4/fleet/fuel-transactions', { limit: 50 });

  // Derive KPIs from real data
  const fuelConnections = useMemo(
    () =>
      allConnections.filter(
        (c) => c.category === 'fleet' || c.category === 'fuel' || c.providerName.toLowerCase().includes('fuel'),
      ),
    [allConnections],
  );

  const activeProviders = fuelConnections.filter((c) => c.status === 'connected').length;

  const totalSpend = useMemo(
    () => transactions.reduce((s, t) => s + (t.amount ?? 0), 0),
    [transactions],
  );

  const flaggedCount = useMemo(
    () => transactions.filter((t) => t.flagged || t.status === 'FLAGGED').length,
    [transactions],
  );

  const TABS: { id: TabView; label: string; icon: typeof Plug }[] = [
    { id: 'providers', label: 'Providers', icon: Plug },
    { id: 'transactions', label: 'Transactions', icon: Fuel },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'stations', label: 'Stations', icon: MapPin },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <>
      <Header
        title="Fuel Integrations"
        subtitle="Manage fuel card providers, monitor purchases, and analyse fleet fuel costs"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const csv = [
                  ['Date', 'Station', 'Gallons', 'Amount', 'Flagged'].join(','),
                  ...transactions.map((t) =>
                    [t.date, t.station ?? '', t.gallons ?? '', t.amount ?? '', t.flagged ? 'Yes' : 'No'].join(','),
                  ),
                ].join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = 'fuel-transactions.csv';
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
            <Button variant="primary" size="md" onClick={() => window.location.href = '/integrations/catalog'}>
              <Plus className="w-4 h-4 mr-1.5" />
              Connect Provider
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Connected Providers"
            value={activeProviders}
            icon={<Plug size={16} />}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Total Fuel Spend"
            value={totalSpend > 0 ? `$${(totalSpend / 1000).toFixed(1)}K` : '$0'}
            icon={<DollarSign size={16} />}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Transactions"
            value={transactions.length}
            icon={<Clock size={16} />}
            accentColor="#3b82f6"
            index={2}
          />
          <StatCard
            label="Fraud Alerts"
            value={flaggedCount}
            icon={<AlertTriangle size={16} />}
            accentColor={flaggedCount > 0 ? '#f59e0b' : '#3b82f6'}
            index={3}
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-wl-bg-elevated rounded-lg border border-wl-border-subtle w-fit flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === id
                  ? 'bg-wl-bg-overlay text-wl-text-primary shadow-sm'
                  : 'text-wl-text-tertiary hover:text-wl-text-secondary',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {view === 'providers' && (
          <ProvidersTab
            connections={allConnections}
            loading={connLoading}
            error={connError}
          />
        )}

        {view === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            loading={txLoading}
            error={txError}
          />
        )}

        {view === 'analytics' && <AnalyticsTab transactions={transactions} />}

        {view === 'stations' && (
          <Empty
            icon={MapPin}
            title="Station network requires a fuel card integration"
            body="Connect WEX, Comdata, or Fuelman to browse their station networks and see real-time pricing near your fleet."
            cta={
              <Button variant="primary" size="sm" onClick={() => window.location.href = '/integrations/catalog'}>
                Browse Integrations
              </Button>
            }
          />
        )}

        {view === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-wl-text-primary">Monthly Reports</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (transactions.length === 0) return;
                  const csv = [
                    ['Month', 'Transactions', 'Total Spend', 'Total Gallons', 'Flagged'].join(','),
                    (() => {
                      const now = new Date();
                      const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                      const spend = transactions.reduce((s, t) => s + (t.amount ?? 0), 0);
                      const gallons = transactions.reduce((s, t) => s + (t.gallons ?? 0), 0);
                      const flagged = transactions.filter((t) => t.flagged).length;
                      return [month, transactions.length, spend.toFixed(2), gallons.toFixed(1), flagged].join(',');
                    })(),
                  ].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = 'fuel-report.csv';
                  a.click();
                }}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download CSV
              </Button>
            </div>

            {transactions.length === 0 ? (
              <Empty
                icon={FileText}
                title="No report data yet"
                body="Monthly fuel reports will appear once transactions are recorded from your fleet telematics."
              />
            ) : (
              <Card className="p-5 bg-wl-bg-surface border-wl-border-default">
                <p className="text-sm font-semibold text-wl-text-primary mb-4">
                  {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Total Cost</p>
                    <p className="text-lg font-bold font-mono text-wl-text-primary mt-1">
                      {formatCurrency(transactions.reduce((s, t) => s + (t.amount ?? 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Total Gallons</p>
                    <p className="text-lg font-bold font-mono text-wl-text-primary mt-1">
                      {transactions.reduce((s, t) => s + (t.gallons ?? 0), 0).toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Transactions</p>
                    <p className="text-lg font-bold font-mono text-wl-text-primary mt-1">{transactions.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Flagged</p>
                    <p className={cn('text-lg font-bold font-mono mt-1', flaggedCount > 0 ? 'text-wl-warning-400' : 'text-wl-success-400')}>
                      {flaggedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Compliance</p>
                    <p className="text-lg font-bold font-mono text-wl-success-400 mt-1">
                      {transactions.length > 0
                        ? (((transactions.length - flaggedCount) / transactions.length) * 100).toFixed(0)
                        : 100}%
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
