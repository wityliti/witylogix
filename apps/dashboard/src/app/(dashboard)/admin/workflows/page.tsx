"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../../../components/layout/header";
import { StatCard } from "../../../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { ArrowRight, Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ═══════════════════════════════════════════════════════════
   WORKFLOW EXECUTIONS PAGE — Monitor and manage workflow runs
   ═══════════════════════════════════════════════════════════ */

interface WorkflowExecution {
  id: string;
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating";
  startedAt: string;
  durationMs: number | null;
  error?: string | null;
}

interface WorkflowExecutionsResponse {
  executions: WorkflowExecution[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
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

const getStatusBadgeVariant = (
  status: "running" | "completed" | "failed" | "compensating"
): "info" | "success" | "danger" | "warning" => {
  switch (status) {
    case "running":
      return "info";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "compensating":
      return "warning";
    default:
      return "default" as any;
  }
};

const getStatusLabel = (status: "running" | "completed" | "failed" | "compensating"): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function WorkflowExecutionsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "running" | "completed" | "failed" | "compensating">("all");

  const { data, loading, error, refetch } = useApiQuery<WorkflowExecutionsResponse>('/api/v4/workflow/executions');
  const executions: WorkflowExecution[] = data?.executions ?? [];

  const totalRuns = executions.length;
  const activeRuns = executions.filter((e) => e.status === "running").length;
  const completedRuns = executions.filter((e) => e.status === "completed").length;
  const failedRuns = executions.filter((e) => e.status === "failed").length;

  const filtered = useMemo(() => {
    let result = executions;
    if (activeTab !== "all") result = result.filter((e) => e.status === activeTab);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.workflowName.toLowerCase().includes(q) || e.executionId.toLowerCase().includes(q));
    }
    return result;
  }, [executions, search, activeTab]);

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
            change={{ value: 12.5, label: "this month" }}
            accentColor="var(--blue-600)"
            icon={<Activity size={18} />}
            index={0}
          />
          <StatCard
            label="Active"
            value={activeRuns}
            accentColor="var(--blue-500)"
            icon={<Clock size={18} />}
            index={1}
          />
          <StatCard
            label="Completed"
            value={completedRuns}
            change={{ value: 8.3, label: "success rate" }}
            accentColor="var(--emerald-500)"
            icon={<CheckCircle2 size={18} />}
            index={2}
          />
          <StatCard
            label="Failed"
            value={failedRuns}
            change={{ value: -2.1, label: "vs last month" }}
            accentColor="var(--red-500)"
            icon={<AlertCircle size={18} />}
            index={3}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5 border-b border-wl-border-default pb-4">
          {(["all", "running", "completed", "failed", "compensating"] as const).map((tab) => {
            const count =
              tab === "all"
                ? executions.length
                : executions.filter((e) => e.status === tab).length;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-2 text-sm font-medium cursor-pointer bg-transparent border-0 border-b-2 transition-all capitalize",
                  isActive
                    ? "text-white border-b-blue-500"
                    : "text-gray-400 border-b-transparent"
                )}
              >
                {tab === "all" ? "All" : tab}
                <span className="ml-1.5 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search workflow name or execution ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm font-sans outline-none transition-all focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
          />
        </div>

        {/* Executions Table */}
        {filtered.length > 0 ? (
          <Card className="overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default bg-wl-bg-root">
                    <th className="p-3 px-4 text-left font-semibold text-gray-400">
                      Workflow Name
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="p-3 px-4 text-left font-semibold text-gray-400">
                      Started
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-gray-400">
                      Duration
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((execution, idx) => (
                    <tr
                      key={execution.id}
                      className="border-b border-wl-border-default transition-colors cursor-pointer hover:bg-wl-bg-elevated"
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "#12121a",
                      }}
                      onClick={() => router.push(`/admin/workflows/${execution.executionId}`)}
                    >
                      <td className="p-3 px-4 text-white font-medium">
                        {execution.workflowName}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={getStatusBadgeVariant(execution.status)} dot>
                          {getStatusLabel(execution.status)}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-gray-400">
                        {formatDateTime(execution.startedAt)}
                      </td>
                      <td className="p-3 px-4 text-center text-gray-400">
                        {execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Button variant="ghost" size="sm" onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          router.push(`/admin/workflows/${execution.executionId}`);
                        }}>
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
        ) : (
          <Card className="text-center p-8 bg-wl-bg-surface border border-wl-border-default">
            <div className="text-gray-400">
              <Activity size={40} className="mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-semibold m-0 mb-2 text-white">
                No executions found
              </h3>
              <p className="text-sm m-0 text-gray-400">
                {search ? "Try adjusting your search criteria" : "Start a new workflow to see executions here"}
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
