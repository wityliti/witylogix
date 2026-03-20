"use client";

import { useState, useEffect, useMemo } from "react";
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

// Mock data
const mockQueues: QueueStats[] = [
  {
    name: "analytics",
    active: 3,
    waiting: 12,
    completed: 1243,
    failed: 5,
    delayed: 2,
    paused: false,
    throughputPerMin: 8,
    avgProcessingTimeMs: 1250,
    errorRate: 0.4,
  },
  {
    name: "email",
    active: 1,
    waiting: 24,
    completed: 5612,
    failed: 12,
    delayed: 0,
    paused: false,
    throughputPerMin: 15,
    avgProcessingTimeMs: 450,
    errorRate: 0.21,
  },
  {
    name: "system",
    active: 0,
    waiting: 0,
    completed: 892,
    failed: 2,
    delayed: 0,
    paused: false,
    throughputPerMin: 2,
    avgProcessingTimeMs: 800,
    errorRate: 0.22,
  },
];

const mockJobs: JobItem[] = [
  {
    id: "job-001",
    name: "daily-usage-aggregation",
    status: "completed",
    progress: 100,
    attempts: 1,
    maxAttempts: 3,
    createdAt: "2026-03-16 10:15:00",
    processedAt: "2026-03-16 10:15:45",
  },
  {
    id: "job-002",
    name: "email-send",
    status: "active",
    progress: 65,
    attempts: 1,
    maxAttempts: 3,
    createdAt: "2026-03-16 10:20:00",
  },
  {
    id: "job-003",
    name: "report-generation",
    status: "waiting",
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    createdAt: "2026-03-16 10:25:00",
  },
  {
    id: "job-004",
    name: "data-export",
    status: "failed",
    progress: 0,
    attempts: 2,
    maxAttempts: 3,
    createdAt: "2026-03-16 10:30:00",
  },
];

const mockScheduledJobs: ScheduledJob[] = [
  {
    id: "daily-usage-aggregation",
    name: "Daily Usage Aggregation",
    pattern: "0 2 * * *",
    enabled: true,
    nextRunAt: "2026-03-17 02:00:00",
    lastRunStatus: "success",
    lastRunTime: "2026-03-16 02:00:45",
  },
  {
    id: "hourly-health-check",
    name: "Hourly Health Check",
    pattern: "0 * * * *",
    enabled: true,
    nextRunAt: "2026-03-16 11:00:00",
    lastRunStatus: "success",
    lastRunTime: "2026-03-16 10:00:30",
  },
  {
    id: "weekly-report",
    name: "Weekly Report Generation",
    pattern: "0 1 * * 1",
    enabled: true,
    nextRunAt: "2026-03-17 01:00:00",
    lastRunStatus: "failed",
    lastRunTime: "2026-03-10 01:15:22",
  },
];

const mockDLQ: DLQItem[] = [
  {
    jobId: "dlq-001",
    jobName: "payment-processing",
    queue: "billing",
    failedReason: "External API timeout after 3 retries",
    category: "external_api",
    failedAt: "2026-03-15 14:22:15",
  },
  {
    jobId: "dlq-002",
    jobName: "report-generation",
    queue: "analytics",
    failedReason: "Database constraint violation",
    category: "database",
    failedAt: "2026-03-14 08:45:30",
  },
];

export default function QueuesPage() {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [searchJob, setSearchJob] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedScheduledId, setExpandedScheduledId] = useState<string | null>(null);

  const filteredJobs = useMemo(() => {
    return mockJobs.filter(job => {
      const matchesSearch = job.name.toLowerCase().includes(searchJob.toLowerCase()) ||
                           job.id.toLowerCase().includes(searchJob.toLowerCase());
      const matchesStatus = jobStatusFilter === "all" || job.status === jobStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchJob, jobStatusFilter]);

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
        return "bg-gray-100 text-gray-800";
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Queue Management" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Queue Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {mockQueues.map(queue => (
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
                  {queue.paused && (
                    <Badge variant="danger">Paused</Badge>
                  )}
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
                      <span className="text-gray-500">Throughput</span>
                      <span className="font-semibold">{queue.throughputPerMin}/min</span>
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
            {/* Health Metrics */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Queue Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockQueues.find(q => q.name === selectedQueue) && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Throughput</span>
                          <span className="font-semibold">
                            {mockQueues.find(q => q.name === selectedQueue)?.throughputPerMin}/min
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: "60%" }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Avg Processing Time</span>
                          <span className="font-semibold">
                            {mockQueues.find(q => q.name === selectedQueue)?.avgProcessingTimeMs}ms
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Error Rate</span>
                          <span className="font-semibold">
                            {mockQueues.find(q => q.name === selectedQueue)?.errorRate.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-600 h-2 rounded-full"
                            style={{
                              width: `${mockQueues.find(q => q.name === selectedQueue)?.errorRate || 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Queue Controls */}
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Jobs Table */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Jobs</CardTitle>
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
                  {filteredJobs.map(job => (
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
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{job.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">{job.createdAt}</td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedJobId(expandedJobId === job.id ? null : job.id)
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
          </CardContent>
        </Card>

        {/* DLQ Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Dead Letter Queue ({mockDLQ.length})
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
            {mockDLQ.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No items in dead letter queue
              </div>
            ) : (
              <div className="space-y-3">
                {mockDLQ.map(item => (
                  <div
                    key={item.jobId}
                    className="p-4 border border-red-200 bg-red-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{item.jobName}</p>
                        <p className="text-xs text-gray-600">ID: {item.jobId}</p>
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
            <div className="space-y-3">
              {mockScheduledJobs.map(job => (
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
                        <Badge
                          className={
                            job.lastRunStatus === "success"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {job.lastRunStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Next Run</span>
                      <p className="font-semibold text-xs">{job.nextRunAt}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Run</span>
                      <p className="font-semibold text-xs">{job.lastRunTime || "Never"}</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" className="gap-1 text-xs">
                        {job.enabled ? (
                          <>
                            <Pause className="w-3 h-3" />
                            Disable
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Enable
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
