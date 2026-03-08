"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../../components/layout/header";
import { StatCard } from "../../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   WORKFLOW EXECUTIONS PAGE — Monitor and manage workflow runs
   ═══════════════════════════════════════════════════════════ */

interface WorkflowExecution {
  id: string;
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating";
  totalSteps: number;
  completedSteps: number;
  startedAt: string;
  duration: string;
  createdBy?: string;
  tenantId?: string;
}

const WORKFLOW_EXECUTIONS: WorkflowExecution[] = [
  {
    id: "exec-001",
    executionId: "EXE-2026-00001",
    workflowName: "Order Processing Pipeline",
    status: "completed",
    totalSteps: 8,
    completedSteps: 8,
    startedAt: "2026-03-07T08:00:00Z",
    duration: "2m 34s",
    createdBy: "system",
    tenantId: "tenant-123",
  },
  {
    id: "exec-002",
    executionId: "EXE-2026-00002",
    workflowName: "Inventory Sync",
    status: "running",
    totalSteps: 12,
    completedSteps: 7,
    startedAt: "2026-03-07T09:15:00Z",
    duration: "45s",
    createdBy: "automation",
    tenantId: "tenant-456",
  },
  {
    id: "exec-003",
    executionId: "EXE-2026-00003",
    workflowName: "Customer Notification",
    status: "completed",
    totalSteps: 5,
    completedSteps: 5,
    startedAt: "2026-03-07T08:45:00Z",
    duration: "1m 12s",
    createdBy: "webhook",
    tenantId: "tenant-123",
  },
  {
    id: "exec-004",
    executionId: "EXE-2026-00004",
    workflowName: "Payment Processing",
    status: "failed",
    totalSteps: 6,
    completedSteps: 4,
    startedAt: "2026-03-07T07:30:00Z",
    duration: "3m 45s",
    createdBy: "system",
    tenantId: "tenant-789",
  },
  {
    id: "exec-005",
    executionId: "EXE-2026-00005",
    workflowName: "Order Processing Pipeline",
    status: "completed",
    totalSteps: 8,
    completedSteps: 8,
    startedAt: "2026-03-07T06:00:00Z",
    duration: "2m 18s",
    createdBy: "system",
    tenantId: "tenant-456",
  },
  {
    id: "exec-006",
    executionId: "EXE-2026-00006",
    workflowName: "Compliance Check",
    status: "compensating",
    totalSteps: 9,
    completedSteps: 5,
    startedAt: "2026-03-07T09:45:00Z",
    duration: "2m 10s",
    createdBy: "system",
    tenantId: "tenant-123",
  },
  {
    id: "exec-007",
    executionId: "EXE-2026-00007",
    workflowName: "Data Export",
    status: "completed",
    totalSteps: 4,
    completedSteps: 4,
    startedAt: "2026-03-07T05:30:00Z",
    duration: "58s",
    createdBy: "automation",
    tenantId: "tenant-101",
  },
  {
    id: "exec-008",
    executionId: "EXE-2026-00008",
    workflowName: "Inventory Sync",
    status: "completed",
    totalSteps: 12,
    completedSteps: 12,
    startedAt: "2026-03-07T04:15:00Z",
    duration: "5m 22s",
    createdBy: "webhook",
    tenantId: "tenant-456",
  },
  {
    id: "exec-009",
    executionId: "EXE-2026-00009",
    workflowName: "Customer Notification",
    status: "failed",
    totalSteps: 5,
    completedSteps: 2,
    startedAt: "2026-03-07T03:00:00Z",
    duration: "4m 51s",
    createdBy: "automation",
    tenantId: "tenant-789",
  },
  {
    id: "exec-010",
    executionId: "EXE-2026-00010",
    workflowName: "Payment Processing",
    status: "completed",
    totalSteps: 6,
    completedSteps: 6,
    startedAt: "2026-03-07T02:45:00Z",
    duration: "2m 05s",
    createdBy: "webhook",
    tenantId: "tenant-123",
  },
  {
    id: "exec-011",
    executionId: "EXE-2026-00011",
    workflowName: "Order Processing Pipeline",
    status: "running",
    totalSteps: 8,
    completedSteps: 3,
    startedAt: "2026-03-07T09:58:00Z",
    duration: "2s",
    createdBy: "system",
    tenantId: "tenant-456",
  },
  {
    id: "exec-012",
    executionId: "EXE-2026-00012",
    workflowName: "Compliance Check",
    status: "completed",
    totalSteps: 9,
    completedSteps: 9,
    startedAt: "2026-03-07T01:30:00Z",
    duration: "8m 15s",
    createdBy: "automation",
    tenantId: "tenant-789",
  },
];

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

  // Calculate stats
  const totalRuns = WORKFLOW_EXECUTIONS.length;
  const activeRuns = WORKFLOW_EXECUTIONS.filter((e) => e.status === "running").length;
  const completedRuns = WORKFLOW_EXECUTIONS.filter((e) => e.status === "completed").length;
  const failedRuns = WORKFLOW_EXECUTIONS.filter((e) => e.status === "failed").length;

  // Filter executions
  const filtered = useMemo(() => {
    let result = WORKFLOW_EXECUTIONS;

    if (activeTab !== "all") {
      result = result.filter((e) => e.status === activeTab);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.workflowName.toLowerCase().includes(q) || e.executionId.toLowerCase().includes(q));
    }

    return result;
  }, [search, activeTab]);

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

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Runs"
            value={totalRuns}
            change={{ value: 12.5, label: "this month" }}
            accentColor="var(--wl-primary-500)"
            icon={<Activity size={18} />}
            index={0}
          />
          <StatCard
            label="Active"
            value={activeRuns}
            accentColor="var(--wl-info-400)"
            icon={<Clock size={18} />}
            index={1}
          />
          <StatCard
            label="Completed"
            value={completedRuns}
            change={{ value: 8.3, label: "success rate" }}
            accentColor="var(--wl-success-400)"
            icon={<CheckCircle2 size={18} />}
            index={2}
          />
          <StatCard
            label="Failed"
            value={failedRuns}
            change={{ value: -2.1, label: "vs last month" }}
            accentColor="var(--wl-danger-400)"
            icon={<AlertCircle size={18} />}
            index={3}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5 border-b border-wl-border-subtle pb-4">
          {(["all", "running", "completed", "failed", "compensating"] as const).map((tab) => {
            const count =
              tab === "all"
                ? WORKFLOW_EXECUTIONS.length
                : WORKFLOW_EXECUTIONS.filter((e) => e.status === tab).length;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-2 text-sm font-medium cursor-pointer bg-transparent border-0 border-b-2 transition-all capitalize",
                  isActive
                    ? "text-wl-text-primary border-b-wl-accent"
                    : "text-wl-text-tertiary border-b-transparent"
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
            className="w-full max-w-md px-4 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none transition-all focus:border-wl-accent focus:ring-3 focus:ring-wl-accent/10"
          />
        </div>

        {/* Executions Table */}
        {filtered.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                    <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                      Workflow Name
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                      Status
                    </th>
                    <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                      Steps
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
                  {filtered.map((execution, idx) => (
                    <tr
                      key={execution.id}
                      className="border-b border-wl-border-subtle transition-colors cursor-pointer"
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                      }}
                      onClick={() => router.push(`/admin/workflows/${execution.id}`)}
                    >
                      <td className="p-3 px-4 text-wl-text-primary font-medium">
                        {execution.workflowName}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={getStatusBadgeVariant(execution.status)} dot>
                          {getStatusLabel(execution.status)}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-primary font-medium">
                        {execution.completedSteps}/{execution.totalSteps}
                      </td>
                      <td className="p-3 px-4 text-wl-text-secondary">
                        {formatDateTime(execution.startedAt)}
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-secondary">
                        {execution.duration}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/workflows/${execution.id}`);
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
          <Card className="text-center p-8">
            <div className="text-wl-text-secondary">
              <Activity size={40} className="mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-semibold m-0 mb-2">
                No executions found
              </h3>
              <p className="text-sm m-0 text-wl-text-tertiary">
                {search ? "Try adjusting your search criteria" : "Start a new workflow to see executions here"}
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
