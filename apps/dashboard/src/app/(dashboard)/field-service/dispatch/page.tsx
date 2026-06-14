'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { MapPin, Users, Activity, Map as MapIcon } from 'lucide-react';
import { WLMap } from '@/components/map/wl-map';
import type { DriverLocation } from '@/components/map/driver-location-layer';

const DriverLocationLayer = dynamic(
  () => import('@/components/map/driver-location-layer').then((m) => ({ default: m.DriverLocationLayer })),
  { ssr: false }
);

type TechnicianStatus = 'available' | 'on_job' | 'break' | 'offline';

const DRIVER_STATUS_MAP: Record<string, TechnicianStatus> = {
  AVAILABLE: 'available',
  ON_ROUTE: 'on_job',
  ON_BREAK: 'break',
  OFFLINE: 'offline',
};

const techStatusVariant = (status: TechnicianStatus): 'success' | 'warning' | 'info' | 'default' => {
  const map: Record<TechnicianStatus, 'success' | 'warning' | 'info' | 'default'> = {
    available: 'success',
    on_job: 'info',
    break: 'warning',
    offline: 'default',
  };
  return map[status];
};

interface RawDriver {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  status: string;
  isActive: boolean;
  _count: { orders: number };
}

interface RawOrder {
  id: string;
  externalOrderNumber: string | null;
  customerName: string;
  status: string;
  addressLine1: string | null;
  city: string | null;
  driverId: string | null;
  driver: { id: string; name: string } | null;
}

function formatJobNumber(order: RawOrder): string {
  return order.externalOrderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;
}

function formatLocation(order: RawOrder): string {
  return [order.addressLine1, order.city].filter(Boolean).join(', ') || '—';
}

function isActiveOrderStatus(status: string): boolean {
  return ['PROCESSING', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(status);
}

export default function DispatchPage() {
  const { items: driversRaw, loading: driversLoading, error: driversError, refetch: refetchDrivers } =
    useApiList<RawDriver>('/api/v4/drivers', { limit: 100 });
  const { data: locations, loading: locLoading, error: locError } =
    useApiQuery<DriverLocation[]>('/api/v4/drivers/locations');
  const { items: allJobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } =
    useApiList<RawOrder>('/api/v4/orders', { limit: 100 });

  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | 'all'>('all');
  const [mapId, setMapId] = useState<string | null>(null);

  // All hooks before early returns
  const locationMap = useMemo(() => new Map((locations ?? []).map((l) => [l.id, l])), [locations]);

  const allTechs = useMemo(
    () =>
      driversRaw
        .filter((d) => d.isActive)
        .map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          vehicleType: d.vehicleType || 'N/A',
          vehiclePlate: d.vehiclePlate || '—',
          status: (DRIVER_STATUS_MAP[d.status] ?? 'offline') as TechnicianStatus,
          activeOrders: d._count.orders,
        })),
    [driversRaw]
  );

  const filteredTechs = useMemo(
    () => (statusFilter === 'all' ? allTechs : allTechs.filter((t) => t.status === statusFilter)),
    [allTechs, statusFilter]
  );

  const driversWithLocation = useMemo(
    () => (locations ?? []).filter((l) => l.lat !== null && l.lng !== null),
    [locations]
  );

  const activeJobList = useMemo(
    () => allJobs.filter((j) => isActiveOrderStatus(j.status)).slice(0, 20),
    [allJobs]
  );

  const pendingJobList = useMemo(
    () => allJobs.filter((j) => j.status === 'PENDING').slice(0, 10),
    [allJobs]
  );

  const loading = driversLoading || jobsLoading;
  const error = driversError || jobsError;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={() => { refetchDrivers(); refetchJobs(); }} />;

  const selectedTechData = selectedTech ? allTechs.find((t) => t.id === selectedTech) : null;
  const inFieldCount = allTechs.filter((t) => t.status === 'on_job').length;
  const activeCount = activeJobList.length;
  const assignedCount = allJobs.filter((j) => j.driverId && isActiveOrderStatus(j.status)).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dispatch Management</h1>
            <p className="text-gray-400">{inFieldCount} in field · {activeCount} active jobs</p>
          </div>
          <Button variant="primary" size="md" className="flex items-center gap-2">
            <Activity size={16} /> New Assignment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Active Jobs</span>
              <MapPin className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{activeCount}</p>
            <p className="text-gray-400 text-xs mt-2">In progress now</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Drivers</span>
              <Users className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allTechs.length}</p>
            <p className="text-gray-400 text-xs mt-2">{inFieldCount} in field</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Assigned</span>
              <div className="w-5 h-5 rounded-full bg-amber-500" />
            </div>
            <p className="text-3xl font-bold text-white">{assignedCount}</p>
            <p className="text-gray-400 text-xs mt-2">Orders with drivers</p>
          </div>
        </Card>
      </div>

      {/* Live Map + Technician Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white flex items-center gap-2">
              <MapIcon size={18} className="text-blue-400" />
              Live Dispatch Map
            </CardTitle>
          </CardHeader>
          <div className="p-4">
            <div className="relative h-[480px] rounded-lg overflow-hidden border border-[#1e1e2e]">
              {locLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14] z-10">
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <div className="w-4 h-4 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin" />
                    Loading driver locations…
                  </div>
                </div>
              )}
              {locError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14] z-10">
                  <p className="text-sm text-red-400/70">Could not load locations</p>
                </div>
              )}
              {!locLoading && !locError && driversWithLocation.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14] z-10 gap-2">
                  <MapIcon className="w-8 h-8 text-white/10" />
                  <p className="text-sm text-white/30">No driver locations available</p>
                  <p className="text-xs text-white/20">Drivers appear once they update their position</p>
                </div>
              )}
              <WLMap center={[30.0, 31.2]} zoom={10} className="w-full h-full" onReady={setMapId} />
              {mapId && driversWithLocation.length > 0 && (
                <DriverLocationLayer
                  mapId={mapId}
                  drivers={driversWithLocation}
                  selectedDriverId={selectedTech}
                  onDriverClick={setSelectedTech}
                />
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-gray-400">Available</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-gray-400">On Route</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-gray-400">On Break</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-600" /><span className="text-gray-400">Offline</span></div>
            </div>
          </div>
        </Card>

        {/* Technician Panel */}
        <div className="space-y-4">
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <CardTitle className="text-base text-white">Filter by Status</CardTitle>
            </CardHeader>
            <div className="p-3 space-y-2">
              {(['all', 'available', 'on_job', 'break', 'offline'] as const).map((status) => {
                const count = status === 'all' ? allTechs.length : allTechs.filter((t) => t.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'w-full px-3 py-2 rounded text-xs font-medium text-left transition-all',
                      statusFilter === status ? 'bg-blue-500 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#242436]'
                    )}
                  >
                    <div className="flex justify-between">
                      <span className="capitalize">{status === 'all' ? 'All' : status.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400">({count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <CardTitle className="text-base text-white">Drivers ({filteredTechs.length})</CardTitle>
            </CardHeader>
            <div className="divide-y divide-[#1e1e2e] max-h-72 overflow-y-auto">
              {filteredTechs.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">No drivers found</div>
              ) : (
                filteredTechs.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTech(tech.id === selectedTech ? null : tech.id)}
                    className={cn('w-full p-3 text-left hover:bg-[#1a1a2e] transition-colors', selectedTech === tech.id && 'bg-[#1a1a2e]')}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-sm font-medium text-white truncate">{tech.name}</div>
                      <Badge variant={techStatusVariant(tech.status)}>{tech.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {tech.vehicleType} · {tech.vehiclePlate} · {tech.activeOrders} active
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {selectedTechData && (
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white">{selectedTechData.name}</div>
                  <Badge variant={techStatusVariant(selectedTechData.status)}>
                    {selectedTechData.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  {selectedTechData.phone && <div>{selectedTechData.phone}</div>}
                  <div>{selectedTechData.vehicleType} · {selectedTechData.vehiclePlate}</div>
                  <div>{selectedTechData.activeOrders} active order(s)</div>
                </div>
                <Button variant="primary" size="sm" className="w-full text-xs">Assign Job</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Active Jobs & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Active Assignments ({activeJobList.length})</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {activeJobList.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No active assignments</div>
            ) : (
              activeJobList.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job.id === selectedJob ? null : job.id)}
                  className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-blue-500 hover:bg-[#242436] transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{formatJobNumber(job)}</div>
                      <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                    </div>
                    <Badge variant="info">{job.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-xs text-gray-400">{formatLocation(job)}</div>
                  {job.driver && <div className="text-xs text-blue-400 mt-1">→ {job.driver.name}</div>}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Pending Dispatch ({pendingJobList.length})</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {pendingJobList.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">All jobs assigned!</div>
            ) : (
              pendingJobList.map((job) => (
                <div key={job.id} className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-amber-500 hover:bg-[#242436] transition-colors">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{formatJobNumber(job)}</div>
                      <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                    </div>
                    <Badge variant="warning">PENDING</Badge>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{formatLocation(job)}</div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">Auto</button>
                    <button className="flex-1 px-2 py-1 text-xs bg-[#242436] hover:bg-[#2d2d3d] text-gray-300 rounded transition-colors">Assign</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
