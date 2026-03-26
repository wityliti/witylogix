'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { MapPin, Users, Activity } from 'lucide-react';

type TechnicianStatus = 'available' | 'on_job' | 'break' | 'offline';

const techStatusVariant = (status: TechnicianStatus): 'success' | 'warning' | 'info' | 'primary' | 'default' => {
  const map: Record<TechnicianStatus, 'success' | 'warning' | 'info' | 'primary' | 'default'> = {
    available: 'success',
    on_job: 'info',
    break: 'warning',
    offline: 'default',
  };
  return map[status];
};

interface Technician {
  id: string;
  name: string;
  location: string;
  status: TechnicianStatus;
  currentJobId?: string;
  skillSet: string[];
  currentWorkload: number;
  ratings: number;
  responseTime: number;
  jobsCompleted: number;
}

interface Job {
  id: string;
  jobNumber: string;
  customerName: string;
  location: string;
  status: string;
  priority: string;
  assignedTechId?: string;
}

export default function DispatchPage() {
  const { items: allJobs, loading, error, refetch } = useApiList<Job>('/api/v4/orders?type=field-service&view=dispatch');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | 'all'>('all');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const allTechs: Technician[] = [];
  const jobs = allJobs;

  const filteredTechs = useMemo(
    () =>
      statusFilter === 'all'
        ? allTechs
        : allTechs.filter((t) => t.status === statusFilter),
    [allTechs, statusFilter]
  );

  const selectedTechData = selectedTech ? allTechs.find((t) => t.id === selectedTech) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dispatch Management</h1>
            <p className="text-gray-400">
              {allTechs.filter((t) => t.status === "on_job").length} in field · {jobs.length} active jobs
            </p>
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
            <p className="text-3xl font-bold text-white">{jobs.length}</p>
            <p className="text-gray-400 text-xs mt-2">Dispatch queue</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Technicians</span>
              <Users className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allTechs.length}</p>
            <p className="text-gray-400 text-xs mt-2">In field</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Assignments</span>
              <div className="w-5 h-5 rounded-full bg-amber-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">{jobs.filter(j => j.assignedTechId).length}</p>
            <p className="text-gray-400 text-xs mt-2">Pending dispatch</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Map + Technician Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
        {/* Map Card */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Live Dispatch Map</CardTitle>
          </CardHeader>

          <div className="p-4" style={{ height: "500px" }}>
            <div className="w-full h-full rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] flex items-center justify-center relative overflow-hidden">
              {/* Background grid effect */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    "linear-gradient(0deg, transparent 24%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05) 76%, transparent 77%, transparent)",
                  backgroundSize: "50px 50px",
                }}
              />

              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-600">
                  <div className="text-4xl mb-2">🗺️</div>
                  <div className="text-sm text-gray-400">Live Dispatch Map</div>
                  <div className="text-xs text-gray-500 mt-1">No technicians assigned</div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-gray-400">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-400">On Job</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-gray-400">Break</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                <span className="text-gray-400">Offline</span>
              </div>
            </div>
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
              {(['all', 'available', 'on_job', 'break', 'offline'] as const).map((status) => {
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
                      <span className="capitalize">{status === 'all' ? 'All' : status.replace(/_/g, ' ')}</span>
                      <span className="text-gray-500">({count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Info */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <div className="p-4 text-center text-gray-400 text-sm">
              <p>No technicians assigned</p>
              <p className="text-xs text-gray-500 mt-2">Technician data loading...</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Active Jobs & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Assignments */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Active Assignments</CardTitle>
          </CardHeader>

          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {jobs
              .filter((j) => j.assignedTechId)
              .slice(0, 5)
              .map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-[#1a1a2e] rounded-md border-l-4 border-blue-500 hover:bg-[#242436] transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                      <div className="text-xs text-gray-400 truncate">{job.customerName}</div>
                    </div>
                    <Badge variant="info">{job.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-xs text-gray-400">{job.location}</div>
                </div>
              ))}

            {jobs.filter((j) => j.assignedTechId).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No active assignments
              </div>
            )}
          </div>
        </Card>

        {/* Pending Dispatch */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Pending Dispatch</CardTitle>
          </CardHeader>

          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {jobs
              .filter((j) => !j.assignedTechId && j.status !== "completed")
              .slice(0, 6)
              .map((job) => (
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

                  <div className="flex gap-2 mt-2">
                    <button className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">
                      Auto
                    </button>
                    <button className="flex-1 px-2 py-1 text-xs bg-[#242436] hover:bg-[#2d2d3d] text-gray-300 rounded transition-colors">
                      Assign
                    </button>
                  </div>
                </div>
              ))}

            {jobs.filter((j) => !j.assignedTechId && j.status !== "completed").length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                All jobs assigned!
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
