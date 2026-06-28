'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { MapPin, Users, Activity, Map, List } from 'lucide-react';

const FieldServiceDispatchMap = dynamic(
  () => import('./components/field-service-dispatch-map'),
  { ssr: false, loading: () => <Skeleton className="w-full h-full rounded-lg" /> }
);

type TechnicianStatus = 'available' | 'busy' | 'break' | 'offline';

const techStatusVariant = (
  status: TechnicianStatus
): 'success' | 'warning' | 'info' | 'primary' | 'default' => {
  const map: Record<TechnicianStatus, 'success' | 'warning' | 'info' | 'primary' | 'default'> = {
    available: 'success',
    busy: 'info',
    break: 'warning',
    offline: 'default',
  };
  return map[status];
};

interface DispatchDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
  vehicleType: string;
  vehiclePlate?: string | null;
  location: string;
  lat: number | null;
  lng: number | null;
  activeDeliveries: number;
}

interface DispatchOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  status: string;
  priority: string;
  lat: number | null;
  lng: number | null;
}

export default function DispatchPage() {
  const {
    items: orders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useApiList<DispatchOrder>('/api/v4/dispatch/orders');

  const {
    items: drivers,
    loading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useApiList<DispatchDriver>('/api/v4/dispatch/drivers');

  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | 'all'>('all');
  const [view, setView] = useState<'list' | 'map'>('map');

  const loading = ordersLoading || driversLoading;
  const error = ordersError || driversError;

  const allTechs = drivers as (DispatchDriver & { status: TechnicianStatus })[];

  const filteredTechs = useMemo(
    () =>
      statusFilter === 'all'
        ? allTechs
        : allTechs.filter((t) => t.status === statusFilter),
    [allTechs, statusFilter]
  );

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          refetchOrders();
          refetchDrivers();
        }}
      />
    );

  const selectedTechData = selectedTech ? allTechs.find((t) => t.id === selectedTech) : null;

  return (
    <div className="min-h-screen bg-surface-primary p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-content-primary mb-2">Dispatch Management</h1>
            <p className="text-content-secondary">
              {allTechs.filter((t) => t.status === 'busy').length} in field ·{' '}
              {orders.length} active jobs
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex rounded-lg border border-border-subtle overflow-hidden">
              <button
                onClick={() => setView('map')}
                className={cn(
                  'px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors',
                  view === 'map'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary'
                )}
              >
                <Map size={14} /> Map
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors',
                  view === 'list'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-secondary text-content-secondary hover:text-content-primary'
                )}
              >
                <List size={14} /> List
              </button>
            </div>
            <Button variant="primary" size="md" className="flex items-center gap-2">
              <Activity size={16} /> New Assignment
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Active Jobs</span>
              <MapPin className="text-brand-primary" size={20} />
            </div>
            <p className="text-3xl font-bold text-content-primary">{orders.length}</p>
            <p className="text-content-tertiary text-xs mt-2">Dispatch queue</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Technicians</span>
              <Users className="text-success" size={20} />
            </div>
            <p className="text-3xl font-bold text-content-primary">{allTechs.length}</p>
            <p className="text-content-tertiary text-xs mt-2">
              {allTechs.filter((t) => t.status === 'available').length} available
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Unassigned</span>
              <div className="w-5 h-5 rounded-full bg-warning" />
            </div>
            <p className="text-3xl font-bold text-content-primary">
              {orders.filter((j) => !j.status || j.status === 'PENDING').length}
            </p>
            <p className="text-content-tertiary text-xs mt-2">Pending dispatch</p>
          </div>
        </Card>
      </div>

      {/* Map View */}
      {view === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
          {/* Map Card */}
          <Card>
            <CardHeader className="border-b border-border-subtle">
              <CardTitle>Live Dispatch Map</CardTitle>
            </CardHeader>
            <div className="p-4" style={{ height: '500px' }}>
              <FieldServiceDispatchMap
                drivers={drivers}
                orders={orders}
                onDriverSelect={setSelectedTech}
                onOrderSelect={setSelectedJob}
              />
            </div>
          </Card>

          {/* Technician Panel */}
          <div className="space-y-4">
            {/* Status Filter */}
            <Card>
              <CardHeader className="border-b border-border-subtle">
                <CardTitle className="text-base">Filter by Status</CardTitle>
              </CardHeader>
              <div className="p-3 space-y-2">
                {(['all', 'available', 'busy', 'break', 'offline'] as const).map((status) => {
                  const count =
                    status === 'all'
                      ? allTechs.length
                      : allTechs.filter((t) => t.status === status).length;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'w-full px-3 py-2 rounded text-xs font-medium text-left transition-all',
                        statusFilter === status
                          ? 'bg-brand-primary text-white'
                          : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                      )}
                    >
                      <div className="flex justify-between">
                        <span className="capitalize">
                          {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-content-muted">({count})</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Technician List */}
            <Card>
              <CardHeader className="border-b border-border-subtle">
                <CardTitle className="text-base">Technicians</CardTitle>
              </CardHeader>
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {filteredTechs.length === 0 ? (
                  <div className="text-center py-6 text-content-tertiary text-sm">
                    No technicians match this filter
                  </div>
                ) : (
                  filteredTechs.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() =>
                        setSelectedTech(tech.id === selectedTech ? null : tech.id)
                      }
                      className={cn(
                        'w-full p-3 rounded-md border text-left transition-all',
                        selectedTechData?.id === tech.id
                          ? 'border-brand-primary bg-brand-subtle'
                          : 'border-border-subtle bg-surface-secondary hover:bg-surface-tertiary'
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-content-primary">{tech.name}</div>
                          <div className="text-xs text-content-tertiary">{tech.location}</div>
                        </div>
                        <Badge variant={techStatusVariant(tech.status as TechnicianStatus)}>
                          {tech.status}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Active Jobs & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Assignments */}
        <Card>
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>Active Assignments</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {orders
              .filter((j) => j.status === 'ASSIGNED' || j.status === 'PICKED_UP' || j.status === 'OUT_FOR_DELIVERY')
              .slice(0, 5)
              .map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-surface-secondary rounded-md border-l-4 border-brand-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-content-primary">
                        {job.orderNumber}
                      </div>
                      <div className="text-xs text-content-secondary truncate">
                        {job.customerName}
                      </div>
                    </div>
                    <Badge variant="info">{job.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-xs text-content-tertiary">{job.address}</div>
                </div>
              ))}
            {orders.filter(
              (j) =>
                j.status === 'ASSIGNED' ||
                j.status === 'PICKED_UP' ||
                j.status === 'OUT_FOR_DELIVERY'
            ).length === 0 && (
              <div className="text-center py-8 text-content-tertiary text-sm">
                No active assignments
              </div>
            )}
          </div>
        </Card>

        {/* Pending Dispatch */}
        <Card>
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>Pending Dispatch</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {orders
              .filter((j) => j.status === 'PENDING' || j.status === 'ACCEPTED')
              .slice(0, 6)
              .map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-surface-secondary rounded-md border-l-4 border-warning hover:bg-surface-tertiary transition-colors"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-content-primary">
                        {job.orderNumber}
                      </div>
                      <div className="text-xs text-content-secondary truncate">
                        {job.customerName}
                      </div>
                    </div>
                    <Badge variant="warning">{job.priority}</Badge>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button className="flex-1 px-2 py-1 text-xs bg-brand-primary hover:bg-brand-primary-hover text-white rounded transition-colors">
                      Auto Assign
                    </button>
                    <button className="flex-1 px-2 py-1 text-xs bg-surface-tertiary hover:bg-surface-overlay text-content-secondary rounded transition-colors">
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            {orders.filter(
              (j) => j.status === 'PENDING' || j.status === 'ACCEPTED'
            ).length === 0 && (
              <div className="text-center py-8 text-content-tertiary text-sm">
                All jobs assigned!
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
