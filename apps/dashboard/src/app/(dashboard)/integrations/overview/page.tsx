'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Plus,
  AlertCircle,
  CheckCircle,
  Zap,
  Activity,
  ArrowRight,
  Settings,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   INTEGRATION OVERVIEW / HUB PAGE
   Master view of ALL integrations
   ═══════════════════════════════════════════════════════════ */

interface IntegrationConnection {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
}

interface CategorySummary {
  id: string;
  name: string;
  total: number;
  active: number;
  error: number;
}

export default function IntegrationOverviewPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'error'>('all');

  const {
    items: connections,
    loading: connectionsLoading,
    error: connectionsError,
    refetch: refetchConnections,
  } = useApiList<IntegrationConnection>('/api/v4/integrations/connections');

  // Derive category summaries from API data
  const categories = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();
    for (const conn of connections) {
      const cat = conn.category || 'Uncategorized';
      if (!map.has(cat)) {
        map.set(cat, { id: cat, name: cat, total: 0, active: 0, error: 0 });
      }
      const entry = map.get(cat)!;
      entry.total += 1;
      if (conn.status === 'active') entry.active += 1;
      if (conn.status === 'error') entry.error += 1;
    }
    return Array.from(map.values());
  }, [connections]);

  const totalProviders = connections.length;
  const totalActive = connections.filter((c) => c.status === 'active').length;
  const totalError = connections.filter((c) => c.status === 'error').length;

  // Health score: 100 minus penalty for errors
  const healthScore =
    totalProviders === 0
      ? 100
      : Math.max(0, Math.round(100 - (totalError / totalProviders) * 100));

  // Filter categories
  const filteredCategories = useMemo(() => {
    let items = [...categories];

    if (selectedCategory) {
      items = items.filter((c) => c.id === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(q));
    }

    if (filterStatus === 'active') {
      items = items.filter((c) => c.active > 0);
    } else if (filterStatus === 'error') {
      items = items.filter((c) => c.error > 0);
    }

    return items;
  }, [categories, searchQuery, selectedCategory, filterStatus]);

  if (connectionsLoading && connections.length === 0) {
    return (
      <>
        <Header title="Integration Hub" subtitle="Loading..." />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (connectionsError && !connectionsLoading) {
    return (
      <>
        <Header title="Integration Hub" subtitle="Manage and monitor all your connected integrations" />
        <div className="p-6">
          <ErrorState error={connectionsError} onRetry={refetchConnections} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Integration Hub"
        subtitle={
          connectionsLoading
            ? 'Loading...'
            : `${totalActive} of ${totalProviders} providers active`
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Health Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Overall Health Score - SVG Gauge */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">System Health</h3>
                <Activity className="w-5 h-5 text-wl-info-500" />
              </div>

              {/* SVG Gauge */}
              <svg viewBox="0 0 200 100" className="w-full h-32 mx-auto">
                {/* Background arc */}
                <path
                  d="M 30 80 A 50 50 0 0 1 170 80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-wl-border-default"
                />
                {/* Health arc */}
                <path
                  d="M 30 80 A 50 50 0 0 1 170 80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(healthScore / 100) * 220} 220`}
                  className={
                    healthScore > 80
                      ? 'text-wl-success-500'
                      : healthScore > 60
                        ? 'text-wl-warning-500'
                        : 'text-wl-danger-500'
                  }
                />
                {/* Center text */}
                <text
                  x="100"
                  y="85"
                  textAnchor="middle"
                  className="font-bold text-2xl"
                  fill="white"
                >
                  {healthScore}
                </text>
              </svg>

              <div className="text-center mt-2">
                <Badge variant={healthScore > 80 ? 'success' : 'warning'}>
                  {healthScore > 80 ? 'Healthy' : healthScore > 60 ? 'Degraded' : 'Critical'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Active Connections */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Active Connections</h3>
                <Zap className="w-5 h-5 text-wl-success-500" />
              </div>
              {connectionsLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-wl-success-500/30 border-t-emerald-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-white">{totalActive}</span>
                    <span className="text-wl-text-secondary text-sm mb-1">of {totalProviders}</span>
                  </div>
                  <div className="w-full h-2 bg-wl-bg-root rounded-full overflow-hidden">
                    <div
                      className="h-full bg-wl-success-500 rounded-full transition-all"
                      style={{ width: `${totalProviders > 0 ? (totalActive / totalProviders) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-wl-text-tertiary">
                    {totalError > 0 ? `${totalError} with errors` : 'All connections healthy'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integration Health */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Integration Health</h3>
                <AlertCircle className={cn('w-5 h-5', totalError > 0 ? 'text-wl-danger-500' : 'text-wl-success-500')} />
              </div>
              {connectionsLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-wl-info-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <span className={cn('text-4xl font-bold', totalError > 0 ? 'text-wl-danger-400' : 'text-wl-success-400')}>
                      {totalProviders > 0 ? Math.round(((totalProviders - totalError) / totalProviders) * 100) : 100}
                    </span>
                    <span className="text-wl-text-secondary text-sm mb-1">%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-wl-success-400 font-semibold">{totalActive}</div>
                      <div className="text-wl-text-tertiary">Active</div>
                    </div>
                    <div className="text-center">
                      <div className={cn('font-semibold', totalError > 0 ? 'text-wl-danger-400' : 'text-wl-text-secondary')}>{totalError}</div>
                      <div className="text-wl-text-tertiary">Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-wl-text-secondary font-semibold">{totalProviders - totalActive - totalError}</div>
                      <div className="text-wl-text-tertiary">Inactive</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-wl-text-tertiary" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-sm text-white placeholder-gray-500 focus:border-wl-info-500 outline-none"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'active', 'error'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                  filterStatus === status
                    ? 'bg-wl-info-500 text-black border-wl-primary-600'
                    : 'border-wl-border-default text-wl-text-secondary hover:border-wl-info-500/50'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <Button variant="primary" className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Connect Provider
          </Button>
        </div>

        {/* Category Grid */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-bold text-white">Integration Categories</h2>

          {connectionsLoading ? (
            <div className="py-12 text-center text-wl-text-tertiary text-sm">
              Loading integrations...
            </div>
          ) : connectionsError ? (
            <div className="py-12 text-center text-wl-danger-400 text-sm">
              Failed to load integrations. Please try again.
            </div>
          ) : filteredCategories.length === 0 ? (
            <Card className="bg-wl-bg-elevated border-wl-border-default">
              <CardContent className="pt-6">
                <div className="py-8 text-center text-wl-text-tertiary text-sm">
                  {connections.length === 0
                    ? 'Connect an integration to see categories here.'
                    : 'No categories match your current filter.'}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCategories.map((category) => {
                const hasError = category.error > 0;
                const statusIcon = hasError ? (
                  <AlertCircle className="w-5 h-5 text-wl-danger-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-wl-success-500" />
                );

                return (
                  <Card
                    key={category.id}
                    className={cn(
                      'bg-wl-bg-elevated border-wl-border-default cursor-pointer transition-all hover:border-wl-info-500/50',
                      selectedCategory === category.id && 'ring-1 ring-wl-info-500'
                    )}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === category.id ? null : category.id)
                    }
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-white">{category.name}</h3>
                          <div className="text-xs text-wl-text-tertiary mt-1">
                            {category.active} of {category.total} active
                          </div>
                        </div>
                        {statusIcon}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-wl-border-default">
                        <div>
                          <div className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                            Active
                          </div>
                          <div className="font-bold text-white mt-1">{category.active}</div>
                        </div>
                        <div>
                          <div className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                            Errors
                          </div>
                          <div
                            className={cn(
                              'font-bold mt-1',
                              category.error > 0 ? 'text-wl-danger-400' : 'text-white'
                            )}
                          >
                            {category.error}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            <Button variant="ghost" size="sm" className="text-wl-text-tertiary">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity className="w-10 h-10 text-wl-text-tertiary mb-3" />
                <p className="text-sm text-wl-text-tertiary">
                  Connect integrations to see activity
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <Card className="bg-wl-bg-surface border border-wl-info-500/20 cursor-pointer hover:border-wl-info-500/50 transition-all">
            <CardContent className="pt-6">
              <Plus className="w-6 h-6 text-wl-info-500 mb-3" />
              <h3 className="font-semibold text-white">Connect New</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">Add a new integration</p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-info-500/20 cursor-pointer hover:border-wl-info-500/50 transition-all">
            <CardContent className="pt-6">
              <Zap className="w-6 h-6 text-wl-info-500 mb-3" />
              <h3 className="font-semibold text-white">Run Sync</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">Manually trigger sync</p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-info-500/20 cursor-pointer hover:border-wl-info-500/50 transition-all">
            <CardContent className="pt-6">
              <Activity className="w-6 h-6 text-wl-info-500 mb-3" />
              <h3 className="font-semibold text-white">View Logs</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">Integration logs</p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-info-500/20 cursor-pointer hover:border-wl-info-500/50 transition-all">
            <CardContent className="pt-6">
              <Settings className="w-6 h-6 text-wl-info-500 mb-3" />
              <h3 className="font-semibold text-white">Settings</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">Global integration config</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
