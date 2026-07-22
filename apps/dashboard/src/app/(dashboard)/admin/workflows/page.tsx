"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../../../components/layout/header";
import { StatCard } from "../../../../components/ui/stat-card";
import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/loading-skeleton";
import { ArrowRight, Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery } from '@/hooks/use-api';

interface WorkflowExecution {
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating" | "compensated";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  orderId?: string | null;
  driverId?: string | null;
}

interface WorkflowResponse {
  executions: WorkflowExecution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const formatDateTime = (isoStr: string): string => {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (ms: number | null): string => {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const getStatusBadgeVariant = (
  status: WorkflowExecution["status"]
): "info" | "success" | "danger" | "warning" => {
  switch (status) {
    case "running": return "info";
    case "completed": return "success";
    case "failed": return "danger";
    case "compensating":
    case "compensated": return "warning";
    default: return "info" as any;
  }
};

const getStatusLabel = (status: WorkflowExecution["status"]): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

export default function WorkflowExecutionsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "running" | "completed" | "failed" | "compensating">("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (activeTab !== "all") params.set("status", activeTab);
    if (debouncedSearch) params.set("workflowName", debouncedSearch);
    return `/api/workflow/executions?${params.toString()}`;
  }, [activeTab, debouncedSearch]);

  const { data: response, loading, error, refetch } = useApiQuery<WorkflowResponse>(apiUrl);

  const executions = response?.executions ?? [];

  const totalRuns = executions.length;
  const activeRuns = executions.filter((e) => e.status === "running").length;
  const completedRuns = executions.filter((e) => e.status === "completed").length;
  const failedRuns = executions.filter((e) => e.status === "failed").length;

  const tabCounts = useMemo(() => ({
    all: executions.length,
    running: executions.filter((e) => e.status === "running").length,
    completed: executions.filter((e) => e.status === "completed").length,
    failed: executions.filter((e) => e.status === "failed").length,
    compensating: executions.filter((e) => e.status === "compensating" || e.status === "compensated").length,
  }), [executions]);

  return (
    <>
      <Header
        title="Workflow Executions"
        subtitle="Monitor and manage workflow runs"
        actions={
          <Button variant="primary" size="md">
            + New Workflow
          </Button>
        }
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Runs"
            value={totalRuns}
            isLoading={loading}
            accentColor="var(--wl-primary-500)"
            icon={<Activity size={18} />}
            index={0}
          />
          <StatCard
            label="Active"
            value={activeRuns}
            isLoading={loading}
            accentColor="var(--wl-info-500)"
            icon={<Clock size={18} />}
            index={1}
          />
          <StatCard
            label="Completed"
            value={completedRuns}
            isLoading={loading}
            accentColor="var(--wl-success-500)"
            icon={<CheckCircle2 size={18} />}
            index={2}
          />
          <StatCard
            label="Failed"
            value={failedRuns}
            isLoading={loading}
            accentColor="var(--wl-danger-500)"
            icon={<AlertCircle size={18} />}
            index={3}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5 border-b border-wl-border-default pb-4">
          {(["all", "running", "completed", "failed", "compensating"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-2 text-sm font-medium cursor-pointer bg-transparent border-0 border-b-2 transition-all capitalize",
                  isActive
                    ? "text-wl-text-primary border-b-wl-info-500"
                    : "text-wl-text-secondary border-b-transparent"
                )}
              >
                {tab === "all" ? "All" : tab}
                {!loading && (
                  <span className="ml-1.5 opacity-60">({tabCounts[tab]})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search workflow name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search workflows"
            className="w-full max-w-md px-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans outline-none transition-all focus:border-wl-info-500 focus:ring-3 focus:ring-wl-info-500/10"
          />
        </div>

        {/* Error */}
        {error && !loading && (
          <Card className="p-6 text-center bg-wl-bg-surface border border-wl-border-default mb-5">
            <AlertCircle size={32} className="mx-auto mb-2 text-wl-danger-400" />
            <p className="text-sm text-wl-text-secondary mb-3">Failed to load workflow executions</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
          </Card>
        )}

        {/* Executions Table */}
        {loading ? (
          <Card className="overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default bg-wl-bg-root">
                    <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Workflow Name</th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                    <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Started</th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Duration</th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-wl-border-default">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="p-3 px-4">
                          <Skeleton type="text" className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : !error && executions.length > 0 ? (
          <Card className="overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default bg-wl-bg-root">
                    <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                      Workflow Name
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                      Status
                    </th>
                    <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                      Started
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                      Duration
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution, idx) => (
                    <tr
                      key={execution.executionId}
                      className={cn(
                        "border-b border-wl-border-default transition-colors cursor-pointer hover:bg-wl-bg-elevated",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-surface",
                      )}
                      onClick={() => router.push(`/admin/workflows/${execution.executionId}`)}
                    >
                      <td className="p-3 px-4">
                        <div className="font-medium text-wl-text-primary">{execution.workflowName}</div>
                        <div className="text-[11px] text-wl-text-tertiary font-mono mt-0.5">{execution.executionId}</div>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={getStatusBadgeVariant(execution.status)} dot>
                          {getStatusLabel(execution.status)}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-wl-text-secondary">
                        {formatDateTime(execution.startedAt)}
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-secondary">
                        {formatDuration(execution.durationMs)}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            router.push(`/admin/workflows/${execution.executionId}`);
                          }}
                        >
                          View
                          <ArrowRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : !error ? (
          <Card className="text-center p-8 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-wl-text-secondary">
              <Activity size={40} className="mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-semibold m-0 mb-2 text-wl-text-primary">
                No executions found
              </h3>
              <p className="text-sm m-0 text-wl-text-secondary">
                {search || activeTab !== "all"
                  ? "Try adjusting your filters"
                  : "Start a new workflow to see executions here"}
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
