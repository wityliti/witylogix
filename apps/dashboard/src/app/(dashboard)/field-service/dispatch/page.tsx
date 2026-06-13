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
import { MapPin, Users, Activity, RefreshCw } from 'lucide-react';
import type { DriverLocation } from '@/components/map/driver-location-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0d0d14] rounded-xl animate-pulse" />,
});

const DriverLocationLayer = dynamic(
  () => import('@/components/map/driver-location-layer').then((m) => ({ default: m.DriverLocationLayer })),
  { ssr: false }
);

type TechnicianStatus = 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK' | 'OFFLINE';

interface DriverLocation2 {
  id: string;
  name: string;
  status: TechnicianStatus;
  lat: number;
  lng: number;
  last_location_at?: string | null;
  heading?: number | null;
}

interface Job {
  id: string;
  jobNumber: string;
  customerName: string;
  location: string;
  status: string;
  priority: string;
  assignedTechId?: string | null;
  assignedTechName?: string | null;
}

const STATUS_BADGE: Record<TechnicianStatus, 'success' | 'info' | 'warning' | 'default'> = {
  AVAILABLE: 'success',
  ON_ROUTE: 'info',
  ON_BREAK: 'warning',
  OFFLINE: 'default',
};

const STATUS_LABEL: Record<TechnicianStatus, string> = {
  AVAILABLE: 'Available',
  ON_ROUTE: 'On Route',
  ON_BREAK: 'On Break',
  OFFLINE: 'Offline',
};

export default function DispatchPage() {
  const { data: locData, loading: locLoading, error: locError, refetch: refetchLoc } =
    useApiQuery<DriverLocation2[]>('/api/v4/drivers/locations');
  const { items: jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } =
    useApiList<Job>('/api/v4/field-service/jobs');

  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | 'all'>('all');
  const [mapId, setMapId] = useState<string>('');

  if (locLoading || jobsLoading) return <LoadingSkeleton />;
  if (locError) return <ErrorState message={locError.message} onRetry={refetchLoc} />;
  if (jobsError) return <ErrorState message={jobsError.message} onRetry={refetchJobs} />;

  const allTechs = locData ?? [];

  const filteredTechs = useMemo(
    () => (statusFilter === 'all' ? allTechs : allTechs.filter((t) => t.status === statusFilter)),
    [allTechs, statusFilter]
  );

  // Map DriverLocation2 → DriverLocation interface required by the layer
  const driverLayerData: DriverLocation[] = filteredTechs.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    heading: t.heading,
    last_location_at: t.last_location_at,
    lat: t.lat,
    lng: t.lng,
  }));

  const inFieldCount = allTechs.filter((t) => t.status === 'ON_ROUTE').length;
  const activeJobCount = jobs.filter((j) => j.assignedTechId && j.status !== 'completed').length;
  const pendingCount = jobs.filter((j) => !j.assignedTechId && j.status !== 'completed').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dispatch Management</h1>
            <p className="text-gray-400">
              {inFieldCount} in field · {jobs.length} active jobs · {pendingCount} pending assignment
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => { refetchLoc(); refetchJobs(); }}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button variant="primary" size="md" className="flex items-center gap-2">
              <Activity size={16} /> New Assignment
            </Button>
          </div>
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
            <p className="text-3xl font-bold text-white">{activeJobCount}</p>
            <p className="text-gray-400 text-xs mt-2">Assigned & in progress</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Technicians</span>
              <Users className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allTechs.length}</p>
            <p className="text-gray-400 text-xs mt-2">{inFieldCount} on route · {allTechs.filter(t => t.status === 'AVAILABLE').length} available</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Pending Dispatch</span>
              <div className="w-5 h-5 rounded-full bg-amber-500" />
            </div>
            <p className="text-3xl font-bold text-white">{pendingCount}</p>
            <p className="text-gray-400 text-xs mt-2">Awaiting assignment</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Map + Technician Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
        {/* Live Dispatch Map */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Live Dispatch Map</CardTitle>
              <span className="text-xs text-gray-500">{filteredTechs.length} technicians visible</span>
            </div>
          </CardHeader>

          <div className="p-0" style={{ height: '500px' }}>
            <WLMap
              className="w-full h-full rounded-none"
              center={[40.7128, -74.006]}
              zoom={11}
              onReady={setMapId}
            >
              {mapId && driverLayerData.length > 0 && (
                <DriverLocationLayer
                  mapId={mapId}
                  drivers={driverLayerData}
                  selectedDriverId={selectedTech}
                  onDriverClick={(id) => setSelectedTech(id === selectedTech ? null : id)}
                />
              )}
              {/* Empty state overlay */}
              {driverLayerData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                  <div className="text-center bg-[#12121a]/80 backdrop-blur rounded-xl px-6 py-4">
                    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No technicians with location data</p>
                  </div>
                </div>
              )}
            </WLMap>
          </div>

          {/* Legend */}
          <div className="p-3 border-t border-[#1e1e2e] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400" /><span className="text-gray-400">Available</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400" /><span className="text-gray-400">On Route</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /><span className="text-gray-400">On Break</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-500" /><span className="text-gray-400">Offline</span></div>
          </div>
        </Card>

        {/* Technician Panel */}
        <div className="space-y-4">
          {/* Status Filter */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <CardTitle className="text-base text-white">Filter by Status</CardTitle>
            </CardHeader>
            <div className="p-3 space-y-2">
              {(['all', 'AVAILABLE', 'ON_ROUTE', 'ON_BREAK', 'OFFLINE'] as const).map((status) => {
                const count = status === 'all' ? allTechs.length : allTechs.filter((t) => t.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'w-full px-3 py-2 rounded text-xs font-medium text-left transition-all',
                      statusFilter === status
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#242436]'
                    )}
                  >
                    <div className="flex justify-between">
                      <span>{status === 'all' ? 'All' : STATUS_LABEL[status]}</span>
                      <span className="text-gray-500">({count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Technician List */}
          <Card className="bg-[#12121a] border-[#1e1e2e] max-h-80 overflow-y-auto">
            {filteredTechs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No technicians in this status
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e2e]">
                {filteredTechs.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTech(tech.id === selectedTech ? null : tech.id)}
                    className={cn(
                      'w-full p-3 text-left transition-colors hover:bg-[#1a1a2e]',
                      selectedTech === tech.id && 'bg-blue-500/10 border-l-2 border-blue-500'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{tech.name}</span>
                      <Badge variant={STATUS_BADGE[tech.status]} className="flex-shrink-0 text-xs">
                        {STATUS_LABEL[tech.status]}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Active Jobs & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Assignments */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Active Assignments</CardTitle>
              <Badge variant="info">{jobs.filter((j) => j.assignedTechId).length}</Badge>
            </div>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {jobs.filter((j) => j.assignedTechId).slice(0, 6).map((job) => (
              <div
                key={job.id}
                className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-blue-500 hover:bg-[#242436] transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                    <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                  </div>
                  <Badge variant="info">{job.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="text-xs text-gray-400">{job.location}</div>
                {job.assignedTechName && (
                  <div className="text-xs text-blue-400 mt-1">→ {job.assignedTechName}</div>
                )}
              </div>
            ))}
            {jobs.filter((j) => j.assignedTechId).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No active assignments</div>
            )}
          </div>
        </Card>

        {/* Pending Dispatch */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Pending Dispatch</CardTitle>
              {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
            </div>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {jobs.filter((j) => !j.assignedTechId && j.status !== 'completed').slice(0, 6).map((job) => (
              <div
                key={job.id}
                className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-amber-500 hover:bg-[#242436] transition-colors"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                    <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                  </div>
                  <Badge variant="warning">{job.priority}</Badge>
                </div>
                <div className="text-xs text-gray-400 mb-2">{job.location}</div>
                <div className="flex gap-2">
                  <button className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">
                    Auto
                  </button>
                  <button className="flex-1 px-2 py-1 text-xs bg-[#242436] hover:bg-[#2d2d3d] text-gray-300 rounded transition-colors">
                    Assign
                  </button>
                </div>
              </div>
            ))}
            {pendingCount === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">All jobs assigned!</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
