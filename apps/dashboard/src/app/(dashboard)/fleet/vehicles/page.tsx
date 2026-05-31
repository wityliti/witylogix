'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Truck, Plus, Eye, Search, ChevronLeft, ChevronRight, RefreshCw, MapPin, Gauge, Fuel } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════════
   VEHICLE INVENTORY PAGE — Paginated list with status filter
   ═══════════════════════════════════════════════════════════════ */

interface FleetVehicle {
  id: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  status: string;
  telematicsProvider: string;
  lastPosition?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  } | null;
  lastFuelLevel?: number | null;
  lastDiagnosticAt?: string | null;
  createdAt: string;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE';

const STATUS_CONFIGS: Record<string, {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default';
  dot: string;
  label: string;
}> = {
  ACTIVE: { variant: 'success', dot: 'bg-wl-success-400', label: 'Active' },
  IDLE: { variant: 'warning', dot: 'bg-wl-warning-400', label: 'Idle' },
  OFFLINE: { variant: 'danger', dot: 'bg-wl-neutral-500', label: 'Offline' },
  MAINTENANCE: { variant: 'info', dot: 'bg-wl-info-400', label: 'Maintenance' },
  INACTIVE: { variant: 'default', dot: 'bg-wl-neutral-600', label: 'Inactive' },
};

function formatOdometer(value?: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US').format(value) + ' km';
}

function FuelBar({ level }: { level: number | null | undefined }) {
  if (level == null) return <span className="text-wl-text-tertiary">—</span>;
  const pct = Math.round(Number(level));
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct > 50 ? 'bg-wl-success-500' : pct > 25 ? 'bg-wl-warning-500' : 'bg-wl-danger-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-wl-text-primary w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function VehiclesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [localSearch, setLocalSearch] = useState('');

  const { items: vehicles, pagination, loading, error, refetch, setPage } =
    useApiList<FleetVehicle>('/api/v4/fleet/vehicles', { limit: 20 });

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Client-side status filter (server doesn't paginate by status yet)
  const filtered = vehicles.filter((v) => {
    const statusMatch = statusFilter === 'ALL' || v.status.toUpperCase() === statusFilter;
    const searchLower = localSearch.toLowerCase();
    const searchMatch = !localSearch || [
      v.name, v.make, v.model, v.licensePlate, v.vin,
    ].some((f) => f?.toLowerCase().includes(searchLower));
    return statusMatch && searchMatch;
  });

  const statusCounts: Record<StatusFilter, number> = {
    ALL: vehicles.length,
    ACTIVE: vehicles.filter((v) => v.status.toUpperCase() === 'ACTIVE').length,
    IDLE: vehicles.filter((v) => v.status.toUpperCase() === 'IDLE').length,
    OFFLINE: vehicles.filter((v) => v.status.toUpperCase() === 'OFFLINE').length,
    MAINTENANCE: vehicles.filter((v) => v.status.toUpperCase() === 'MAINTENANCE').length,
  };

  return (
    <>
      <Header
        title="Vehicle Inventory"
        subtitle={`${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} · ${statusCounts.ACTIVE} active`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Vehicle
            </Button>
          </div>
        }
      />

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 bg-wl-bg-elevated rounded-lg border border-wl-border-subtle">
          {(['ALL', 'ACTIVE', 'IDLE', 'MAINTENANCE', 'OFFLINE'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                statusFilter === s
                  ? 'bg-wl-bg-overlay text-wl-text-primary shadow-sm'
                  : 'text-wl-text-tertiary hover:text-wl-text-secondary',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIGS[s]?.label ?? s}
              <span className="ml-1.5 opacity-60">{statusCounts[s]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wl-text-tertiary" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className={cn(
              'w-full pl-8 pr-3 py-2 text-sm rounded-lg',
              'bg-wl-bg-elevated border border-wl-border-subtle',
              'text-wl-text-primary placeholder:text-wl-text-tertiary',
              'focus:outline-none focus:ring-1 focus:ring-wl-primary-500/50 focus:border-wl-primary-500/60',
            )}
          />
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-wl-border-subtle bg-wl-bg-elevated/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide hidden md:table-cell">VIN</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide hidden lg:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide hidden md:table-cell">Fuel</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Provider</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="w-10 h-10 text-wl-text-tertiary opacity-30" />
                      <p className="text-sm text-wl-text-secondary">No vehicles found</p>
                      {localSearch && (
                        <p className="text-xs text-wl-text-tertiary">
                          Try adjusting your search
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((vehicle, idx) => {
                  const statusKey = vehicle.status.toUpperCase();
                  const statusCfg = STATUS_CONFIGS[statusKey] ?? STATUS_CONFIGS.INACTIVE;
                  const displayName = vehicle.name ||
                    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') ||
                    vehicle.licensePlate || '—';
                  const hasGps = vehicle.lastPosition != null;

                  return (
                    <tr
                      key={vehicle.id}
                      className={cn(
                        'border-b border-wl-border-subtle/50 transition-colors',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-elevated/20',
                        'hover:bg-wl-bg-elevated/50',
                      )}
                    >
                      {/* Vehicle */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-wl-primary-500/10 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4 text-wl-primary-400" />
                          </div>
                          <div>
                            <p className="font-medium text-wl-text-primary text-sm">{displayName}</p>
                            {vehicle.licensePlate && (
                              <p className="text-xs text-wl-text-tertiary font-mono">{vehicle.licensePlate}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* VIN */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-mono text-wl-text-tertiary">
                          {vehicle.vin ? vehicle.vin.slice(-8) : '—'}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {hasGps && vehicle.lastPosition ? (
                          <div className="flex items-center justify-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-wl-success-400" />
                            <span className="text-xs text-wl-text-secondary font-mono">
                              {vehicle.lastPosition.latitude.toFixed(3)},
                              {vehicle.lastPosition.longitude.toFixed(3)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-wl-text-tertiary">No GPS</span>
                        )}
                      </td>

                      {/* Fuel */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <FuelBar level={vehicle.lastFuelLevel} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                          <span className={cn(
                            'text-xs font-medium',
                            statusKey === 'ACTIVE' ? 'text-wl-success-400' :
                            statusKey === 'IDLE' ? 'text-wl-warning-400' :
                            statusKey === 'OFFLINE' ? 'text-wl-danger-400' :
                            statusKey === 'MAINTENANCE' ? 'text-wl-info-400' :
                            'text-wl-text-tertiary',
                          )}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-wl-text-tertiary capitalize bg-wl-bg-overlay px-2 py-0.5 rounded">
                          {vehicle.telematicsProvider || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/fleet/vehicles/${vehicle.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-wl-bg-overlay transition-colors text-wl-text-tertiary hover:text-wl-primary-400"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-wl-border-subtle bg-wl-bg-elevated/30">
            <p className="text-xs text-wl-text-tertiary">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs text-wl-text-secondary">
                {pagination.page}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
