'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { DriverLocationLayer, type DriverLocation } from '@/components/map/driver-location-layer';
import { JobLocationLayer, type JobLocation } from '@/components/map/job-location-layer';
import { MapPin, Users, Activity } from 'lucide-react';

type TechnicianStatus = 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK' | 'OFFLINE';

const techStatusVariant = (status: TechnicianStatus): 'success' | 'warning' | 'info' | 'default' => {
  const map: Record<TechnicianStatus, 'success' | 'warning' | 'info' | 'default'> = {
    AVAILABLE: 'success',
    ON_ROUTE:  'info',
    ON_BREAK:  'warning',
    OFFLINE:   'default',
  };
  return map[status];
};

interface DispatchJob {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  priority: string;
  status: string;
  assignedTechId?: string | null;
  deliveryLocation?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
}

function jobToMapPoint(job: DispatchJob): JobLocation | null {
  const loc = job.deliveryLocation;
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return {
    id: job.id,
    jobNumber: job.orderNumber,
    customerName: job.customerName,
    address: job.address,
    status: job.assignedTechId ? 'dispatched' : 'created',
    priority: job.priority,
    lat,
    lng,
  };
}

export default function DispatchPage() {
  const {
    items: allJobs,
    loading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useApiList<DispatchJob>('/api/v4/dispatch/orders');

  const {
    data: locData,
    loading: locLoading,
    error: locError,
    refetch: refetchLoc,
  } = useApiQuery<{ data: DriverLocation[] }>('/api/v4/drivers/locations');

  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | 'all'>('all');
  const [mapId, setMapId] = useState<string | null>(null);

  const allTechs: DriverLocation[] = (locData as unknown as { data: DriverLocation[] })?.data ?? [];

  const loading = jobsLoading || locLoading;
  const error = jobsError || locError;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={() => { refetchJobs(); refetchLoc(); }} />;

  const filteredTechs = statusFilter === 'all'
    ? allTechs
    : allTechs.filter((t) => t.status === statusFilter);

  const mapJobs: JobLocation[] = useMemo(
    () => allJobs.map(jobToMapPoint).filter((j): j is JobLocation => j !== null),
    [allJobs]
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dispatch Management</h1>
          <p className="text-gray-400">
            {allTechs.filter((t) => t.status === 'ON_ROUTE').length} in field ·{' '}
            {allJobs.length} active jobs
          </p>
        </div>
        <Button variant="primary" size="md" className="flex items-center gap-2">
          <Activity size={16} /> New Assignment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Active Jobs</span>
              <MapPin className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allJobs.length}</p>
            <p className="text-gray-400 text-xs mt-2">In dispatch queue</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Technicians Located</span>
              <Users className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allTechs.length}</p>
            <p className="text-gray-400 text-xs mt-2">
              {allTechs.filter((t) => t.status === 'ON_ROUTE').length} on route ·{' '}
              {allTechs.filter((t) => t.status === 'AVAILABLE').length} available
            </p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Assigned</span>
              <div className="w-5 h-5 rounded-full bg-amber-500" />
            </div>
            <p className="text-3xl font-bold text-white">
              {allJobs.filter((j) => j.assignedTechId).length}
            </p>
            <p className="text-gray-400 text-xs mt-2">
              {allJobs.filter((j) => !j.assignedTechId).length} pending dispatch
            </p>
          </div>
        </Card>
      </div>

      {/* Map + Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
        <Card className="bg-[#12121a] border-[#1e1e2e] overflow-hidden">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Live Dispatch Map</CardTitle>
          </CardHeader>
          <div style={{ height: 520 }} className="relative">
            <WLMap
              center={[40.7128, -74.006]}
              zoom={11}
              className="w-full h-full"
              onReady={setMapId}
            />
            {mapId && (
              <>
                <DriverLocationLayer
                  mapId={mapId}
                  drivers={filteredTechs}
                  selectedDriverId={selectedTech}
                  onDriverClick={setSelectedTech}
                />
                <JobLocationLayer
                  mapId={mapId}
                  jobs={mapJobs}
                  selectedJobId={selectedJob}
                  onJobClick={setSelectedJob}
                />
              </>
            )}
          </div>
          <div className="p-3 border-t border-[#1e1e2e] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-gray-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-400">On Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-gray-400">On Break</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-purple-400" />
              <span className="text-gray-400">Job Location</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <CardTitle className="text-base text-white">Filter by Status</CardTitle>
            </CardHeader>
            <div className="p-3 space-y-2">
              {(['all', 'AVAILABLE', 'ON_ROUTE', 'ON_BREAK', 'OFFLINE'] as const).map((status) => {
                const count =
                  status === 'all' ? allTechs.length : allTechs.filter((t) => t.status === status).length;
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
                      <span className="capitalize">
                        {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-500">({count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <CardTitle className="text-base text-white flex items-center justify-between">
                <span>Technicians</span>
                {selectedTech && (
                  <button
                    onClick={() => setSelectedTech(null)}
                    className="text-xs text-blue-400 hover:underline font-normal"
                  >
                    Clear
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {filteredTechs.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">No technicians located</div>
              ) : (
                filteredTechs.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTech(selectedTech === tech.id ? null : tech.id)}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-all border',
                      selectedTech === tech.id
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-[#1a1a2e] border-transparent hover:border-[#1e1e2e]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{tech.name}</span>
                      <Badge variant={techStatusVariant(tech.status as TechnicianStatus)}>
                        {tech.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Job Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Active Assignments</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {allJobs.filter((j) => j.assignedTechId).length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No active assignments</div>
            ) : (
              allJobs
                .filter((j) => j.assignedTechId)
                .slice(0, 8)
                .map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                    className={cn(
                      'w-full p-3 rounded-md border-l-4 border-blue-500 text-left transition-colors',
                      selectedJob === job.id ? 'bg-blue-500/10' : 'bg-[#1a1a2e] hover:bg-[#242436]'
                    )}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{job.orderNumber}</div>
                        <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                      </div>
                      <Badge variant="info">{job.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="text-xs text-gray-400">{job.address}</div>
                  </button>
                ))
            )}
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Pending Dispatch</CardTitle>
          </CardHeader>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {allJobs.filter((j) => !j.assignedTechId).length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">All jobs assigned!</div>
            ) : (
              allJobs
                .filter((j) => !j.assignedTechId)
                .slice(0, 6)
                .map((job) => (
                  <div
                    key={job.id}
                    className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-amber-500 hover:bg-[#242436] transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{job.orderNumber}</div>
                        <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                      </div>
                      <Badge variant="warning">{job.priority}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">
                        Auto
                      </button>
                      <button className="flex-1 px-2 py-1 text-xs bg-[#242436] hover:bg-[#2d2d3d] text-gray-300 rounded transition-colors">
                        Assign
                      </button>
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
