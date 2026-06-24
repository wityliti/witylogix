'use client';

import { useState, useMemo } from 'react';
import { Plus, Copy, Edit2, Trash2, Send, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface RouteItem {
  id: string;
  name: string;
  stopsCount: number;
  totalDistance: number;
  totalDuration: number;
  assignedDriver?: string | null;
  driverId?: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
  rawStatus?: string;
  lastUsed: string;
  isTemplate: boolean;
  createdAt: string;
  date: string;
}


const statusVariant = (
  s: string
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<
    string,
    'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  > = {
    draft: 'default',
    scheduled: 'info',
    active: 'success',
    completed: 'primary',
    cancelled: 'danger',
  };
  return map[s] ?? 'default';
};

const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[s] ?? s;
};

export default function RoutesPage() {
  const { items: routes, loading, error, refetch } = useApiList<RouteItem>('/api/v4/routes');
  const [filter, setFilter] = useState<'all' | 'active' | 'templates' | 'completed'>('all');
  const [search, setSearch] = useState('');

  // Filter routes
  const filtered = useMemo(() => {
    let result = routes;

    if (filter === 'active') {
      result = result.filter((r) => r.status === 'active' || r.status === 'scheduled');
    } else if (filter === 'templates') {
      result = result.filter((r) => r.isTemplate);
    } else if (filter === 'completed') {
      result = result.filter((r) => r.status === 'completed');
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.assignedDriver?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [filter, search, routes]);

  // Calculate stats from real API data
  const stats = useMemo(() => {
    const total = routes.length;
    const active = routes.filter(
      (r) => r.status === 'active' || r.status === 'scheduled'
    ).length;
    const templates = routes.filter((r) => r.isTemplate).length;
    const completed = routes.filter((r) => r.status === 'completed').length;
    const cancelled = routes.filter((r) => r.status === 'cancelled').length;
    return { total, active, templates, completed, cancelled };
  }, [routes]);

  if (loading && routes.length === 0) return <LoadingSkeleton />;
  if (error && routes.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <>
      <Header
        title="Route Planning"
        subtitle={`${stats.total} total routes · ${stats.active} active · ${stats.templates} templates`}
        actions={
          <Link href="/routes/plan">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Plan New Route
            </Button>
          </Link>
        }
      />

      <div className="p-6 bg-wl-bg-root">
        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 auto-rows-max">
          <Card className="p-4 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Total Routes
            </div>
            <div className="text-3xl font-bold text-blue-500">{stats.total}</div>
          </Card>

          <Card className="p-4 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Active Now
            </div>
            <div className="text-3xl font-bold text-emerald-500">{stats.active}</div>
          </Card>

          <Card className="p-4 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Templates
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.templates}</div>
          </Card>

          <Card className="p-4 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Completed
            </div>
            <div className="text-3xl font-bold text-amber-500">{stats.completed}</div>
          </Card>
        </div>

        {/* ═══ Filter & Search Row ═══ */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[300px] max-w-[400px]">
            <input
              type="text"
              placeholder="Search routes by name or driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full px-4 py-2 rounded-md text-sm',
                'bg-wl-bg-surface text-wl-text-primary',
                'border border-wl-border-default',
                'placeholder:text-wl-text-tertiary',
                'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                'transition-colors',
              )}
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'templates', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors border',
                  filter === f
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-border-strong'
                )}
              >
                {f === 'all' ? 'All Routes' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Routes Table ═══ */}
        {filtered.length > 0 ? (
          <Card className="border border-wl-border-default overflow-hidden bg-wl-bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {/* Header */}
                <thead>
                  <tr className="border-b border-wl-border-default bg-wl-bg-surface">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Route Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Stops
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-wl-border-default">
                  {filtered.map((route) => (
                    <tr
                      key={route.id}
                      className="hover:bg-wl-bg-overlay transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/routes/${route.id}`}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          {route.name}
                          {route.isTemplate && (
                            <span className="ml-2 text-xs text-gray-400">
                              (Template)
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {route.stopsCount}
                      </td>
                      <td className="px-6 py-4 text-gray-300 font-mono">
                        {route.totalDistance.toFixed(1)} km
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {formatDuration(route.totalDuration)}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {route.assignedDriver ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVariant(route.status)}>
                          {statusLabel(route.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {route.lastUsed}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {route.status === 'draft' && (
                            <>
                              <Link href={`/routes/plan?templateId=${route.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(route.status === 'active' ||
                            route.status === 'scheduled') && (
                            <Button variant="ghost" size="sm">
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          <button className="px-2 py-1 hover:bg-wl-bg-elevated rounded-md transition-colors">
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-12 bg-wl-bg-surface border border-dashed border-wl-border-default text-center">
            <div className="text-wl-text-tertiary mb-3">📍</div>
            <div className="text-lg font-semibold text-wl-text-primary mb-1">
              No routes found
            </div>
            <div className="text-sm text-wl-text-secondary mb-6">
              {search
                ? 'Try adjusting your search criteria'
                : 'Start by creating a new route'}
            </div>
            {!search && (
              <Link href="/routes/plan">
                <Button variant="primary">
                  <Plus className="w-4 h-4" />
                  Plan Your First Route
                </Button>
              </Link>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
