'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   CRM INTEGRATION PAGE — Multi-vendor CRM sync & management
   ═══════════════════════════════════════════════════════════ */

interface CRMProvider {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string;
  syncCount: number;
  contactsCount: number;
  dealsCount: number;
  errorMessage?: string;
}

interface SyncLog {
  id: string;
  timestamp: string;
  type: 'contact' | 'deal' | 'activity' | 'field';
  direction: 'push' | 'pull' | 'bidirectional';
  status: 'success' | 'failed' | 'pending';
  details: string;
  recordsAffected: number;
}

interface FieldMapping {
  id: string;
  witylogixField: string;
  crmField: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  customMapping?: boolean;
}

const CRM_PROVIDER_LIST = [
  { id: 'salesforce', name: 'Salesforce', logo: 'SF' },
  { id: 'hubspot', name: 'HubSpot', logo: 'HS' },
  { id: 'zoho', name: 'Zoho CRM', logo: 'ZC' },
  { id: 'ms-dynamics', name: 'MS Dynamics CRM', logo: 'MD' },
  { id: 'pipedrive', name: 'Pipedrive', logo: 'PD' },
];

const DEAL_PIPELINE_STAGES = [
  { name: 'Lead', count: 342, value: 0 },
  { name: 'Qualified', count: 156, value: 78000 },
  { name: 'Proposal', count: 89, value: 445000 },
  { name: 'Negotiation', count: 34, value: 170000 },
  { name: 'Closed Won', count: 78, value: 390000 },
];

const getStatusColor = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
  switch (status) {
    case 'connected':
      return 'success';
    case 'error':
      return 'danger';
    case 'disconnected':
      return 'default';
    default:
      return 'default';
  }
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function CRMIntegrationPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>('salesforce');
  const [syncFilterType, setSyncFilterType] = useState<'all' | 'contact' | 'deal' | 'activity'>('all');
  const [conflictResolution, setConflictResolution] = useState<'witylogix' | 'crm' | 'manual'>('manual');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Fetch data from API
  const { items: providers, loading: providersLoading, error: providersError, refetch } = useApiList<CRMProvider>('/api/v4/integrations/crm/providers');
  const { items: syncLogs, loading: logsLoading } = useApiList<SyncLog>('/api/v4/integrations/crm/sync-logs');
  const { items: fieldMappings } = useApiList<FieldMapping>('/api/v4/integrations/crm/field-mappings');

  const connectedCount = providers.filter((p) => p.status === 'connected').length;
  const totalContacts = providers.reduce((sum, p) => sum + p.contactsCount, 0);
  const totalDeals = providers.reduce((sum, p) => sum + p.dealsCount, 0);
  const syncSuccessRate = (
    (syncLogs.filter((s) => s.status === 'success').length / Math.max(syncLogs.length, 1)) *
    100
  ).toFixed(1);

  const filteredLogs = useMemo(
    () =>
      syncLogs.filter((log) => {
        if (syncFilterType !== 'all' && log.type !== syncFilterType) return false;
        return true;
      }),
    [syncFilterType, syncLogs]
  );

  const pipelineValue = DEAL_PIPELINE_STAGES.reduce((sum, stage) => sum + stage.value, 0);

  if (providersError) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/20 p-4">
          <p className="text-sm text-wl-danger-400">Failed to load CRM integrations</p>
          <Button onClick={refetch} variant="secondary" size="sm" className="mt-3">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        title="CRM Integration"
        subtitle={`${connectedCount} connected · ${totalContacts.toLocaleString()} total contacts`}
        actions={
          <Button variant="primary" size="md">
            + Add New Provider
          </Button>
        }
      />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Connected Providers"
            value={connectedCount}
            change={{ value: 0, label: `of ${providers.length} available` }}
            accentColor="var(--wl-success-400)"
            index={0}
          />
          <StatCard
            label="Total Contacts"
            value={totalContacts.toLocaleString()}
            change={{ value: 8.3, label: 'vs last month' }}
            accentColor="var(--wl-primary-500)"
            index={1}
          />
          <StatCard
            label="Active Deals"
            value={totalDeals}
            change={{ value: 12.5, label: 'vs last month' }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Sync Success Rate"
            value={`${syncSuccessRate}%`}
            change={{ value: 2.1, label: 'avg success rate' }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* Provider Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-wl-text-primary mb-4 uppercase tracking-wider">
            Connected Providers
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {providersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="h-32 bg-wl-bg-overlay/50 rounded animate-pulse" />
                </Card>
              ))
            ) : providers.length === 0 ? (
              <Card className="p-6 col-span-full text-center">
                <p className="text-wl-text-secondary">No CRM providers connected</p>
              </Card>
            ) : (
              providers.map((provider) => (
                <Card
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedProvider === provider.id && 'ring-2 ring-wl-primary-500'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-wl-primary-500/20 flex items-center justify-center text-xs font-bold text-wl-primary-400">
                        {provider.logo}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-wl-text-primary">
                          {provider.name}
                        </h3>
                        <Badge variant={getStatusColor(provider.status)} className="mt-1">
                          {provider.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {provider.status === 'error' && provider.errorMessage && (
                    <div className="bg-wl-danger-bg/30 border border-wl-danger-400/30 rounded px-2 py-1.5 mb-2 text-xs text-wl-danger-400">
                      {provider.errorMessage}
                    </div>
                  )}

                  <div className="space-y-2 text-xs text-wl-text-secondary mb-3">
                    <div className="flex justify-between">
                      <span>Contacts:</span>
                      <span className="text-wl-text-primary font-semibold">
                        {provider.contactsCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deals:</span>
                      <span className="text-wl-text-primary font-semibold">
                        {provider.dealsCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Syncs:</span>
                      <span className="text-wl-text-primary font-semibold">
                        {provider.syncCount}
                      </span>
                    </div>
                    {provider.lastSync && (
                      <div className="flex justify-between">
                        <span>Last Sync:</span>
                        <span className="text-wl-text-tertiary">
                          {formatDateTime(provider.lastSync)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1">
                      Settings
                    </Button>
                    {provider.status !== 'disconnected' && (
                      <Button variant="ghost" size="sm" className="flex-1">
                        Sync Now
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Deal Pipeline View */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Deal Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DEAL_PIPELINE_STAGES.map((stage, idx) => {
                const percentage = (stage.value / pipelineValue) * 100;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-wl-text-primary">
                          {stage.name}
                        </span>
                        <span className="text-xs text-wl-text-tertiary ml-2">
                          {stage.count} deals
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-wl-primary-400">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                    <div className="w-full bg-wl-bg-surface rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-wl-border-subtle pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-wl-text-primary">Total Pipeline</span>
                  <span className="text-lg font-bold text-wl-primary-400">
                    {formatCurrency(pipelineValue)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-wl-text-primary">Auto-Sync Enabled</h4>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    Automatically sync data every 30 minutes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-wl-bg-surface border border-wl-border-default rounded-full peer peer-checked:bg-wl-primary-500 peer-checked:border-wl-primary-500 transition-all" />
                </label>
              </div>

              <div className="border-t border-wl-border-subtle pt-4">
                <h4 className="text-sm font-semibold text-wl-text-primary mb-3">
                  Conflict Resolution
                </h4>
                <div className="space-y-2">
                  {(['witylogix', 'crm', 'manual'] as const).map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-wl-bg-overlay"
                    >
                      <input
                        type="radio"
                        checked={conflictResolution === option}
                        onChange={() => setConflictResolution(option)}
                        className="cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-medium text-wl-text-primary capitalize">
                          {option === 'witylogix' ? 'Prefer Witylogix' : option === 'crm' ? 'Prefer CRM' : 'Manual Review'}
                        </span>
                        <p className="text-xs text-wl-text-tertiary">
                          {option === 'witylogix'
                            ? 'Always use Witylogix data when conflicts occur'
                            : option === 'crm'
                            ? 'Always use CRM data when conflicts occur'
                            : 'Require manual approval for conflicting records'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Field Mapping Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Field Mapping Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">
                      Witylogix Field
                    </th>
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">
                      CRM Field
                    </th>
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">Type</th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Required
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.slice(0, 5).map((mapping, idx) => (
                    <tr
                      key={mapping.id}
                      className={cn(
                        'border-b border-wl-border-subtle',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay/30'
                      )}
                    >
                      <td className="p-3 text-wl-text-primary font-medium">
                        {mapping.witylogixField}
                        {mapping.customMapping && (
                          <Badge variant="info" className="ml-2">
                            Custom
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-wl-text-secondary">{mapping.crmField}</td>
                      <td className="p-3 text-wl-text-secondary text-xs">
                        <Badge variant="default">{mapping.type}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {mapping.required && (
                          <Badge variant="primary">Required</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm">
                  View All {fieldMappings.length} Mappings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Activity Log</CardTitle>
            <div className="flex gap-2 ml-auto">
              {(['all', 'contact', 'deal', 'activity'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSyncFilterType(type)}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-md border capitalize transition-all',
                    syncFilterType === type
                      ? 'bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500'
                      : 'bg-transparent text-wl-text-secondary border-wl-border-subtle hover:border-wl-border-default'
                  )}
                >
                  {type === 'all' ? 'All' : type}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-wl-bg-overlay/50 rounded animate-pulse" />
                ))
              ) : filteredLogs.length === 0 ? (
                <p className="text-center text-wl-text-secondary">No sync logs</p>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div
                    key={log.id}
                    className={cn(
                      'p-3 rounded-md border',
                      log.status === 'success'
                        ? 'border-wl-success-400/20 bg-wl-success-bg/30'
                        : log.status === 'failed'
                        ? 'border-wl-danger-400/20 bg-wl-danger-bg/30'
                        : 'border-wl-warning-400/20 bg-wl-warning-bg/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              log.status === 'success'
                                ? 'success'
                                : log.status === 'failed'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {log.status}
                          </Badge>
                          <span className="text-xs font-semibold text-wl-text-secondary capitalize">
                            {log.type}
                          </span>
                          <span className="text-xs text-wl-text-tertiary">
                            ({log.direction})
                          </span>
                        </div>
                        <p className="text-sm text-wl-text-primary mb-1">{log.details}</p>
                        <div className="flex items-center gap-3 text-xs text-wl-text-tertiary">
                          <span>{formatDateTime(log.timestamp)}</span>
                          <span>•</span>
                          <span>{log.recordsAffected} records affected</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
