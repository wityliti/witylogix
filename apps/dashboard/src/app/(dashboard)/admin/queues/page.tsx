"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  RefreshCw,
  Trash2,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface QueueStats {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  throughputPerMin: number;
  avgProcessingTimeMs: number;
  errorRate: number;
}

interface JobItem {
  id: string;
  name: string;
  status: "active" | "waiting" | "completed" | "failed" | "delayed" | "paused";
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
}

interface ScheduledJob {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  nextRunAt: string;
  lastRunStatus?: "success" | "failed";
  lastRunTime?: string;
}

interface DLQItem {
  jobId: string;
  jobName: string;
  queue: string;
  failedReason: string;
  category: string;
  failedAt: string;
}

export default function QueuesPage() {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [searchJob, setSearchJob] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedScheduledId, setExpandedScheduledId] = useState<string | null>(null);

  const { items: queues, loading: queuesLoading, error: queuesError, refetch: refetchQueues } = useApiList<QueueStats>('/api/v4/admin/queues');
  const { items: jobs, loading: jobsLoading, error: jobsError } = useApiList<JobItem>('/api/v4/admin/queues/jobs');
  const { items: scheduledJobs, loading: scheduledLoading } = useApiList<ScheduledJob>('/api/v4/admin/queues/scheduled');
  const { items: dlqItems, loading: dlqLoading } = useApiList<DLQItem>('/api/v4/admin/queues/dlq');

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = job.name.toLowerCase().includes(searchJob.toLowerCase()) ||
                           job.id.toLowerCase().includes(searchJob.toLowerCase());
      const matchesStatus = jobStatusFilter === "all" || job.status === jobStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchJob, jobStatusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-800";
      case "failed": return "bg-red-100 text-red-800";
      case "active": return "bg-blue-100 text-blue-800";
      case "waiting": return "bg-yellow-100 text-yellow-800";
      case "delayed": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4" />;
      case "failed": return <AlertTriangle className="w-4 h-4" />;
      case "active": return <Zap className="w-4 h-4" />;
      case "waiting": return <Clock className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (queuesLoading && queues.length === 0) return <LoadingSkeleton />;
  if (queuesError && queues.length === 0) return <ErrorState message={queuesError.message} onRetry={refetchQueues} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Queue Management" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Queue Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {queues.map(queue => (
            <Card
              key={queue.name}
              className={cn(
                "cursor-pointer transition hover:shadow-lg",
                selectedQueue === queue.name && "ring-2 ring-blue-500"
              )}
              onClick={() => setSelectedQueue(queue.name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{queue.name}</CardTitle>
                  {queue.paused && <Badge variant="danger">Paused</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active</span>
                    <span className="font-semibold text-blue-600">{queue.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Waiting</span>
                    <span className="font-semibold">{queue.waiting}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Failed</span>
                    <span className={cn("font-semibold", queue.failed > 0 && "text-red-600")}>
                      {queue.failed}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Error Rate</span>
                      <span className="font-semibold">{queue.errorRate.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {queues.length === 0 && (
            <div className="col-span-4 text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No queues available</p>
            </div>
          )}
        </div>

        {/* Queue Details Section */}
        {selectedQueue && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Queue Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.find(q => q.name === selectedQueue) && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Completed</span>
                          <span className="font-semibold">
                            {queues.find(q => q.name === selectedQueue)?.completed.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Error Rate</span>
                          <span className="font-semibold">
                            {queues.find(q => q.name === selectedQueue)?.errorRate.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, queues.find(q => q.name === selectedQueue)?.errorRate || 0)}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Queue Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" className="gap-2">
                    <Play className="w-4 h-4" />
                    Resume
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-2">
                    <Pause className="w-4 h-4" />
                    Pause
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-2" onClick={() => refetchQueues()}>
                    <RefreshCw className="w-4 h-4" />
                    Refresh Stats
                  </Button>
                  <Button size="sm" variant="danger" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Clear Completed
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Jobs Table */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Jobs</CardTitle>
              <div className="flex gap-3">
                <Input
                  placeholder="Search jobs..."
                  value={searchJob}
                  onChange={e => setSearchJob(e.target.value)}
                  className="w-48"
                />
                <select
                  value={jobStatusFilter}
                  onChange={e => setJobStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="waiting">Waiting</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <TableSkeleton rows={4} />
            ) : jobsError ? (
              <p className="text-sm text-red-500 text-center py-4">{jobsError.message}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Job ID</th>
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Progress</th>
                      <th className="text-left py-3 px-4 font-semibold">Attempts</th>
                      <th className="text-left py-3 px-4 font-semibold">Created</th>
                      <th className="text-left py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No jobs found
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map(job => (
                        <tr key={job.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-xs">{job.id}</td>
                          <td className="py-3 px-4">{job.name}</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(job.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(job.status)}
                                {job.status}
                              </span>
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${job.progress}%` }} />
                              </div>
                              <span className="text-xs text-gray-600">{job.progress}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">{job.attempts}/{job.maxAttempts}</td>
                          <td className="py-3 px-4 text-xs text-gray-600">{job.createdAt}</td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                            >
                              {expandedJobId === job.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DLQ Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Dead Letter Queue ({dlqLoading ? '…' : dlqItems.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="gap-2">
                  <RotateCw className="w-4 h-4" />
                  Retry All
                </Button>
                <Button size="sm" variant="danger" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Purge
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dlqLoading ? (
              <TableSkeleton rows={2} />
            ) : dlqItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                No items in dead letter queue
              </div>
            ) : (
              <div className="space-y-3">
                {dlqItems.map(item => (
                  <div key={item.jobId} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{item.jobName}</p>
                        <p className="text-xs text-gray-600">Queue: {item.queue} · ID: {item.jobId}</p>
                      </div>
                      <Badge variant="danger">{item.category}</Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{item.failedReason}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{item.failedAt}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="gap-1 text-xs">
                          <RotateCw className="w-3 h-3" />
                          Retry
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-xs">
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledLoading ? (
              <TableSkeleton rows={3} />
            ) : scheduledJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No scheduled jobs found</div>
            ) : (
              <div className="space-y-3">
                {scheduledJobs.map(job => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{job.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{job.pattern}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.enabled ? (
                          <Badge variant="success">Enabled</Badge>
                        ) : (
                          <Badge variant="default">Disabled</Badge>
                        )}
                        {job.lastRunStatus && (
                          <Badge className={job.lastRunStatus === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                            {job.lastRunStatus}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Next Run</span>
                        <p className="font-semibold text-xs">{job.nextRunAt ?? '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Last Run</span>
                        <p className="font-semibold text-xs">{job.lastRunTime || "Never"}</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" className="gap-1 text-xs">
                          {job.enabled ? <><Pause className="w-3 h-3" />Disable</> : <><Play className="w-3 h-3" />Enable</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
