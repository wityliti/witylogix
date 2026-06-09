'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { useApiList } from '@/hooks/use-api';
import {
  BarChart3,
  TrendingUp,
  Eye,
  Plus,
  Settings,
  Pause,
  Play,
  Trash2,
  RefreshCw,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ANALYTICS INTEGRATIONS — Dashboard for analytics providers
   ═══════════════════════════════════════════════════════════ */

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'AUTHENTICATING';
type ReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

interface AnalyticsConnection {
  id: string;
  provider: string;
  name: string;
  status: ConnectionStatus;
  lastSync: string;
  nextSync: string;
  dashboardCount: number;
  embedCount: number;
  errorMessage?: string;
}

interface ScheduledReport {
  id: string;
  title: string;
  provider: string;
  frequency: ReportFrequency;
  nextRun: string;
  lastRun: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  recipients: string[];
  format: 'PDF' | 'EMAIL' | 'SCHEDULED_EXPORT';
}

interface DataSource {
  id: string;
  name: string;
  provider: string;
  type: 'DATABASE' | 'DATAWAREHOUSE' | 'API' | 'FILE';
  lastRefresh: string;
  refreshSchedule: string;
  status: 'SYNCED' | 'SYNCING' | 'STALE' | 'FAILED';
}

const ANALYTICS_PROVIDERS = [
  {
    slug: 'tableau',
    name: 'Tableau',
    icon: '📊',
    description: 'Visual analytics and business intelligence',
    color: '#1F1F1F',
  },
  {
    slug: 'powerbi',
    name: 'Power BI',
    icon: '📈',
    description: 'Microsoft business analytics platform',
    color: '#FFB900',
  },
  {
    slug: 'looker',
    name: 'Looker',
    icon: '🔍',
    description: 'Modern data exploration platform',
    color: '#4285F4',
  },
  {
    slug: 'qlik',
    name: 'Qlik Sense',
    icon: '⚡',
    description: 'Associative analytics engine',
    color: '#A2D500',
  },
  {
    slug: 'ga',
    name: 'Google Analytics 4',
    icon: '📍',
    description: 'Web and app analytics platform',
    color: '#E37400',
  },
];

const connectionStatusVariant = (
  status: ConnectionStatus
): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  const map: Record<
    ConnectionStatus,
    'success' | 'warning' | 'danger' | 'info' | 'default'
  > = {
    CONNECTED: 'success',
    DISCONNECTED: 'warning',
    ERROR: 'danger',
    AUTHENTICATING: 'info',
  };
  return map[status];
};

const dataSourceStatusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    SYNCED: 'success',
    SYNCING: 'info',
    STALE: 'warning',
    FAILED: 'danger',
  };
  return map[status] ?? 'default';
};

export default function AnalyticsIntegrationsPage() {
  const [expandedConnection, setExpandedConnection] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [view, setView] = useState<'connections' | 'reports' | 'metrics'>('connections');

  // Fetch data from API
  const { items: connections, loading: connectionsLoading, error: connectionsError, refetch: refetchConnections } = useApiList<AnalyticsConnection>('/api/v4/integrations/analytics/connections');
  const { items: reports, loading: reportsLoading } = useApiList<ScheduledReport>('/api/v4/integrations/analytics/reports');
  const { items: dataSources, loading: dataSourcesLoading } = useApiList<DataSource>('/api/v4/integrations/analytics/datasources');

  const activeConnections = useMemo(
    () => connections.filter((c) => c.status === 'CONNECTED'),
    [connections]
  );
  const errorConnections = useMemo(
    () => connections.filter((c) => c.status === 'ERROR'),
    [connections]
  );

  const totalDashboards = useMemo(
    () => connections.reduce((sum, c) => sum + c.dashboardCount, 0),
    [connections]
  );
  const totalEmbeds = useMemo(
    () => connections.reduce((sum, c) => sum + c.embedCount, 0),
    [connections]
  );

  if (connectionsError) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">Failed to load analytics integrations</p>
          <Button onClick={refetchConnections} variant="secondary" size="sm" className="mt-3">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        title="Analytics Integrations"
        subtitle="Manage analytics providers, dashboards, and scheduled reports"
        actions={
          <div className={cn('flex gap-2')}>
            <Button
              variant="primary"
              onClick={() => setShowReportForm(true)}
              size="sm"
            >
              <Plus size={14} className={cn('mr-1')} />
              New Report
            </Button>
          </div>
        }
      />

      <div className={cn('min-h-screen bg-wl-bg-root p-6')}>
        {/* Top Stats */}
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4 mb-6')}>
          <StatCard
            label="Active Connections"
            value={activeConnections.length}
            icon={<BarChart3 size={16} />}
            accentColor="#059669"
            index={0}
          />
          <StatCard
            label="Connected Dashboards"
            value={totalDashboards}
            change={{ value: 12, label: 'this month' }}
            icon={<TrendingUp size={16} />}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Connections"
            value={connections.length}
            change={{ value: 0, label: 'configured' }}
            icon={<RefreshCw size={16} />}
            accentColor="#0284c7"
            index={2}
          />
          <StatCard
            label="Total Embeds"
            value={totalEmbeds}
            change={{ value: 24, label: 'vs last week' }}
            icon={<Eye size={16} />}
            accentColor="#d97706"
            index={3}
          />
        </div>

        {/* View Toggle */}
        <div className={cn('flex gap-2 mb-6 bg-wl-bg-elevated rounded-md p-1 w-fit')}>
          {(['connections', 'reports', 'metrics'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize',
                view === v
                  ? 'bg-blue-500 text-white'
                  : 'bg-transparent text-gray-500'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Connections View */}
        {view === 'connections' && (
          <div className={cn('space-y-4')}>
            {/* Provider Grid */}
            <div className={cn('mb-8')}>
              <h3 className={cn('text-sm font-semibold text-white mb-4')}>
                Available Providers
              </h3>
              <div className={cn('grid grid-cols-1 md:grid-cols-5 gap-3')}>
                {ANALYTICS_PROVIDERS.map((provider) => {
                  const connection = connections.find(
                    (c) => c.provider === provider.slug
                  );
                  return (
                    <div
                      key={provider.slug}
                      className={cn(
                        'p-4 rounded-lg border cursor-pointer transition-all',
                        connection?.status === 'CONNECTED'
                          ? 'border-emerald-400 border-opacity-30 bg-[rgba(16,185,129,0.08)]'
                          : connection?.status === 'ERROR'
                            ? 'border-red-400 border-opacity-30 bg-[rgba(239,68,68,0.08)]'
                            : 'border-wl-border-default hover:border-blue-400'
                      )}
                      onClick={() => setSelectedProvider(provider.slug)}
                    >
                      <div className={cn('flex items-center justify-between mb-2')}>
                        <span className={cn('text-2xl')}>{provider.icon}</span>
                        {connection && (
                          <Badge variant={connectionStatusVariant(connection.status)} dot>
                            {connection.status === 'CONNECTED' ? 'Connected' : connection.status}
                          </Badge>
                        )}
                      </div>
                      <p className={cn('text-sm font-semibold text-white')}>
                        {provider.name}
                      </p>
                      <p className={cn('text-xs text-gray-500 mt-1')}>
                        {provider.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connection Cards */}
            <div className={cn('space-y-3')}>
              <div className={cn('flex items-center justify-between mb-4')}>
                <h3 className={cn('text-sm font-semibold text-white')}>
                  Configured Connections ({connections.length})
                </h3>
                {errorConnections.length > 0 && (
                  <Badge variant="danger">
                    {errorConnections.length} error{errorConnections.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {connectionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="h-20 bg-wl-bg-elevated/50 rounded animate-pulse" />
                  </Card>
                ))
              ) : connections.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-gray-400">No connections configured</p>
                </Card>
              ) : (
                connections.map((connection, idx) => {
                  const provider = ANALYTICS_PROVIDERS.find(
                    (p) => p.slug === connection.provider
                  );
                  const isExpanded = expandedConnection === connection.id;

                  return (
                    <Card
                      key={connection.id}
                      className={cn(
                        'cursor-pointer transition-all wl-animate-in',
                        isExpanded && 'ring-1 ring-wl-primary-400'
                      )}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      onClick={() =>
                        setExpandedConnection(
                          isExpanded ? null : connection.id
                        )
                      }
                    >
                      <div className={cn('p-4')}>
                        <div className={cn('flex items-start justify-between mb-3')}>
                          <div className={cn('flex items-center gap-3 flex-1')}>
                            <span className={cn('text-2xl')}>{provider?.icon}</span>
                            <div className={cn('flex-1 min-w-0')}>
                              <p className={cn('text-sm font-semibold text-white')}>
                                {connection.name}
                              </p>
                              <p className={cn('text-xs text-gray-500 mt-1')}>
                                {connection.dashboardCount} dashboards • {connection.embedCount} embeds
                              </p>
                            </div>
                          </div>
                          <div className={cn('flex items-center gap-2 shrink-0')}>
                            <Badge variant={connectionStatusVariant(connection.status)} dot>
                              {connection.status === 'CONNECTED'
                                ? 'Connected'
                                : connection.status === 'ERROR'
                                  ? 'Error'
                                  : 'Disconnected'}
                            </Badge>
                          </div>
                        </div>

                        <div className={cn('flex items-center justify-between text-xs text-gray-500 mb-3')}>
                          <span>
                            Last sync: {connection.lastSync}
                          </span>
                          <span>
                            Next: {connection.nextSync}
                          </span>
                        </div>

                        {connection.status === 'ERROR' && connection.errorMessage && (
                          <div className={cn('mb-3 p-2 rounded bg-[rgba(239,68,68,0.1)] border border-red-400 border-opacity-30')}>
                            <p className={cn('text-xs text-red-400')}>
                              {connection.errorMessage}
                            </p>
                          </div>
                        )}

                        {isExpanded && (
                          <div className={cn('border-t border-wl-border-default pt-3 mt-3')}>
                            <div className={cn('grid grid-cols-3 gap-3 mb-4')}>
                              <div>
                                <p className={cn('text-xs text-gray-500 mb-1')}>Dashboards</p>
                                <p className={cn('text-lg font-bold text-white')}>
                                  {connection.dashboardCount}
                                </p>
                              </div>
                              <div>
                                <p className={cn('text-xs text-gray-500 mb-1')}>Embeds</p>
                                <p className={cn('text-lg font-bold text-white')}>
                                  {connection.embedCount}
                                </p>
                              </div>
                              <div>
                                <p className={cn('text-xs text-gray-500 mb-1')}>Status</p>
                                <p
                                  className={cn(
                                    'text-lg font-bold',
                                    connection.status === 'CONNECTED'
                                      ? 'text-emerald-400'
                                      : 'text-red-400'
                                  )}
                                >
                                  {connection.status === 'CONNECTED' ? 'Live' : 'Error'}
                                </p>
                              </div>
                            </div>

                            <div className={cn('flex gap-2')}>
                              <Button
                                variant={
                                  connection.status === 'ERROR'
                                    ? 'primary'
                                    : 'secondary'
                                }
                                size="sm"
                              >
                                {connection.status === 'ERROR'
                                  ? 'Reconnect'
                                  : 'Configure'}
                              </Button>
                              <Button variant="ghost" size="sm">
                                <RefreshCw size={14} className={cn('mr-1')} />
                                Sync Now
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Settings size={14} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Reports View */}
        {view === 'reports' && (
          <div className={cn('space-y-3')}>
            <div className={cn('flex items-center justify-between mb-4')}>
              <h3 className={cn('text-sm font-semibold text-white')}>
                Scheduled Reports ({reports.length})
              </h3>
              <Button variant="primary" size="sm" onClick={() => setShowReportForm(true)}>
                <Plus size={14} className={cn('mr-1')} />
                Create Report
              </Button>
            </div>

            {reportsLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="h-24 bg-wl-bg-elevated/50 rounded animate-pulse" />
                </Card>
              ))
            ) : reports.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-gray-400">No scheduled reports</p>
              </Card>
            ) : (
              reports.map((report, idx) => {
                const provider = ANALYTICS_PROVIDERS.find(
                  (p) => p.slug === report.provider
                );
                return (
                  <Card
                    key={report.id}
                    className={cn('wl-animate-in')}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className={cn('p-4')}>
                      <div className={cn('flex items-start justify-between mb-3')}>
                        <div className={cn('flex items-center gap-3 flex-1 min-w-0')}>
                          <span className={cn('text-xl shrink-0')}>{provider?.icon}</span>
                          <div className={cn('min-w-0')}>
                            <p className={cn('text-sm font-semibold text-white truncate')}>
                              {report.title}
                            </p>
                            <p className={cn('text-xs text-gray-500 mt-1')}>
                              {report.frequency} • {report.format}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            report.status === 'ACTIVE'
                              ? 'success'
                              : report.status === 'PAUSED'
                                ? 'warning'
                                : 'danger'
                          }
                          dot
                        >
                          {report.status}
                        </Badge>
                      </div>

                      <div className={cn('bg-wl-bg-surface rounded p-3 mb-3')}>
                        <div className={cn('grid grid-cols-2 gap-3 text-xs')}>
                          <div>
                            <p className={cn('text-gray-500 mb-1')}>Next Run</p>
                            <p className={cn('font-semibold text-white')}>
                              {report.nextRun}
                            </p>
                          </div>
                          <div>
                            <p className={cn('text-gray-500 mb-1')}>Last Run</p>
                            <p className={cn('font-semibold text-white')}>
                              {report.lastRun}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={cn('mb-3')}>
                        <p className={cn('text-xs text-gray-500 mb-2')}>
                          Recipients ({report.recipients.length})
                        </p>
                        <div className={cn('flex flex-wrap gap-1')}>
                          {report.recipients.map((recipient) => (
                            <span
                              key={recipient}
                              className={cn(
                                'text-xs px-2 py-1 rounded bg-wl-bg-elevated text-gray-400'
                              )}
                            >
                              {recipient}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className={cn('flex gap-2')}>
                        <Button
                          variant={report.status === 'PAUSED' ? 'primary' : 'secondary'}
                          size="sm"
                        >
                          {report.status === 'PAUSED' ? (
                            <>
                              <Play size={14} className={cn('mr-1')} />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause size={14} className={cn('mr-1')} />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings size={14} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 size={14} className={cn('text-red-400')} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Metrics View */}
        {view === 'metrics' && (
          <div className={cn('space-y-4')}>
            <h3 className={cn('text-sm font-semibold text-white mb-4')}>
              Data Source Sync Status
            </h3>

            {dataSourcesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <div className="h-12 bg-wl-bg-elevated/50 rounded animate-pulse" />
                </Card>
              ))
            ) : dataSources.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-gray-400">No data sources configured</p>
              </Card>
            ) : (
              <div className={cn('space-y-2')}>
                {dataSources.map((source, idx) => (
                  <Card key={source.id} className={cn('wl-animate-in')} style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className={cn('p-3 flex items-center justify-between')}>
                      <div className={cn('flex items-center gap-3 flex-1 min-w-0')}>
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            source.status === 'SYNCED'
                              ? 'bg-emerald-400'
                              : source.status === 'SYNCING'
                                ? 'bg-cyan-400'
                                : source.status === 'STALE'
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                          )}
                        />
                        <div className={cn('min-w-0')}>
                          <p className={cn('text-sm font-semibold text-white')}>
                            {source.name}
                          </p>
                          <p className={cn('text-xs text-gray-500 mt-0.5')}>
                            {source.type} • Refreshes {source.refreshSchedule}
                          </p>
                        </div>
                      </div>
                      <div className={cn('flex items-center gap-3 text-right shrink-0')}>
                        <div>
                          <p className={cn('text-xs text-gray-500')}>Last Refresh</p>
                          <p className={cn('text-xs font-semibold text-white')}>
                            {source.lastRefresh}
                          </p>
                        </div>
                        <Badge variant={dataSourceStatusVariant(source.status)} dot>
                          {source.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
