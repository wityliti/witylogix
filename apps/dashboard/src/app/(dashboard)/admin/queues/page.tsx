"use client";

import { useState, useMemo, useCallback } from "react";
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
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiQuery, useApiList } from "@/hooks/use-api";

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

interface DLQItem {
  jobId: string;
  jobName: string;
  queue: string;
  failedReason: string;
  category: string;
  failedAt: string;
}

interface QueuesResponse {
  data: {
    queues: QueueStats[];
    dlq: DLQItem[];
  };
}

interface JobItem {
  id: string;
  name: string;
  status: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
}

interface QueueJobsResponse {
  data: JobItem[];
}

export default function QueuesPage() {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [searchJob, setSearchJob] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const {
    data: queuesData,
    loading,
    error,
    refetch,
  } = useApiQuery<QueuesResponse>("/api/v4/admin/queues");
  const { data: jobsData, loading: jobsLoading } =
    useApiQuery<QueueJobsResponse>(
      selectedQueue
        ? `/api/v4/admin/queues/${encodeURIComponent(selectedQueue)}/jobs?status=${jobStatusFilter === "all" ? "active" : jobStatusFilter}`
        : null,
    );

  const queues = queuesData?.data?.queues ?? [];
  const dlqItems = queuesData?.data?.dlq ?? [];
  const jobs = jobsData?.data ?? [];

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.name.toLowerCase().includes(searchJob.toLowerCase()) ||
        job.id.toLowerCase().includes(searchJob.toLowerCase());
      return matchesSearch;
    });
  }, [jobs, searchJob]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "active":
        return "bg-blue-100 text-blue-800";
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "delayed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-wl-bg-surface text-wl-text-primary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "failed":
        return <AlertTriangle className="w-4 h-4" />;
      case "active":
        return <Zap className="w-4 h-4" />;
      case "waiting":
        return <Clock className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (loading && queues.length === 0) {
    return (
      <div className="min-h-screen bg-wl-bg-surface">
        <Header title="Queue Management" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-surface">
        <Header title="Queue Management" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState message={error.message} onRetry={refetch} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="Queue Management"
        actions={
          <Button variant="secondary" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {queues.length === 0 ? (
          <Card className="mb-8">
            <CardContent className="py-12 text-center text-wl-text-tertiary">
              No queues found. Queues are created on first use.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Queue Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {queues.map((queue) => (
                <Card
                  key={queue.name}
                  className={cn(
                    "cursor-pointer transition hover:shadow-lg",
                    selectedQueue === queue.name && "ring-2 ring-blue-500",
                  )}
                  onClick={() => setSelectedQueue(queue.name)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {queue.name}
                      </CardTitle>
                      {queue.paused && <Badge variant="danger">Paused</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-wl-text-tertiary">Active</span>
                        <span className="font-semibold text-blue-600">
                          {queue.active}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-wl-text-tertiary">Waiting</span>
                        <span className="font-semibold">{queue.waiting}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-wl-text-tertiary">Failed</span>
                        <span
                          className={cn(
                            "font-semibold",
                            queue.failed > 0 && "text-red-600",
                          )}
                        >
                          {queue.failed}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between text-xs">
                          <span className="text-wl-text-tertiary">
                            Completed
                          </span>
                          <span className="font-semibold">
                            {queue.completed.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Queue Details Section */}
            {selectedQueue && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Queue Health: {selectedQueue}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const q = queues.find((q) => q.name === selectedQueue);
                      if (!q) return null;
                      return (
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Error Rate</span>
                              <span className="font-semibold">
                                {q.errorRate.toFixed(2)}%
                              </span>
                            </div>
                            <div className="w-full bg-wl-neutral-200 rounded-full h-2">
                              <div
                                className="bg-red-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(q.errorRate, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Delayed Jobs</span>
                              <span className="font-semibold">{q.delayed}</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Status</span>
                              <span className="font-semibold">
                                {q.paused ? "Paused" : "Running"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
                      <Button size="sm" variant="secondary" className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh Stats
                      </Button>
                      <Button size="sm" variant="danger" className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Clear Completed
                      </Button>
                    </div>
                    <p className="text-xs text-wl-text-tertiary mt-3">
                      Queue controls operate on the {selectedQueue} queue in
                      real-time via Redis.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Jobs Table */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Jobs {selectedQueue ? `— ${selectedQueue}` : "(select a queue)"}
              </CardTitle>
              <div className="flex gap-3">
                <Input
                  placeholder="Search jobs..."
                  value={searchJob}
                  onChange={(e) => setSearchJob(e.target.value)}
                  className="w-48"
                />
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-wl-border-default rounded-md text-sm"
                >
                  <option value="all">Active</option>
                  <option value="waiting">Waiting</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedQueue ? (
              <p className="text-center text-wl-text-tertiary py-8">
                Select a queue above to view its jobs.
              </p>
            ) : jobsLoading ? (
              <LoadingSkeleton />
            ) : filteredJobs.length === 0 ? (
              <p className="text-center text-wl-text-tertiary py-8">
                No jobs found in this queue.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">
                        Job ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Progress
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Attempts
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Created
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b hover:bg-wl-bg-surface"
                      >
                        <td className="py-3 px-4 font-mono text-xs">
                          {job.id.slice(0, 8)}
                        </td>
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
                            <div className="w-24 bg-wl-neutral-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-wl-text-tertiary">
                              {job.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {job.attempts}/{job.maxAttempts}
                        </td>
                        <td className="py-3 px-4 text-xs text-wl-text-tertiary">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedJobId(
                                expandedJobId === job.id ? null : job.id,
                              )
                            }
                          >
                            {expandedJobId === job.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
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
                Dead Letter Queue ({dlqItems.length})
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
            {dlqItems.length === 0 ? (
              <div className="text-center py-8 text-wl-text-tertiary">
                No items in dead letter queue
              </div>
            ) : (
              <div className="space-y-3">
                {dlqItems.map((item) => (
                  <div
                    key={item.jobId}
                    className="p-4 border border-red-200 bg-red-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{item.jobName}</p>
                        <p className="text-xs text-wl-text-tertiary">
                          Queue: {item.queue} · ID: {item.jobId.slice(0, 8)}
                        </p>
                      </div>
                      <Badge variant="danger">{item.category}</Badge>
                    </div>
                    <p className="text-sm text-wl-text-primary mb-3">
                      {item.failedReason}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-wl-text-tertiary">
                        {new Date(item.failedAt).toLocaleString()}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1 text-xs"
                        >
                          <RotateCw className="w-3 h-3" />
                          Retry
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs"
                        >
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

        {/* Scheduled Jobs — BullMQ repeatable jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled / Repeatable Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-wl-text-tertiary py-4 text-center">
              Repeatable job schedules are configured in the worker service.
              Select a queue above and filter by "Delayed" to see upcoming
              repeatable jobs.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
