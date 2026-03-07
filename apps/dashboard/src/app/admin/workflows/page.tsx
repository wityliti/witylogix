"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../../components/layout/header";
import { StatCard } from "../../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";

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

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-2)",
            marginBottom: "var(--wl-space-5)",
            borderBottom: "1px solid var(--wl-border-subtle)",
            paddingBottom: "var(--wl-space-4)",
          }}
        >
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
                style={{
                  padding: "var(--wl-space-2) var(--wl-space-3)",
                  fontSize: "var(--wl-text-sm)",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  color: isActive ? "var(--wl-text-primary)" : "var(--wl-text-tertiary)",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--wl-accent)" : "2px solid transparent",
                  transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                  textTransform: "capitalize",
                }}
              >
                {tab === "all" ? "All" : tab}
                <span style={{ marginLeft: 6, opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: "var(--wl-space-5)" }}>
          <input
            type="text"
            placeholder="Search workflow name or execution ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "var(--wl-space-2) var(--wl-space-4)",
              background: "var(--wl-bg-elevated)",
              border: "1px solid var(--wl-border-subtle)",
              borderRadius: "var(--wl-radius-md)",
              color: "var(--wl-text-primary)",
              fontSize: "var(--wl-text-sm)",
              fontFamily: "var(--wl-font-sans)",
              outline: "none",
              transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "var(--wl-accent)";
              (e.target as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(108, 92, 231, 0.1)";
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "var(--wl-border-subtle)";
              (e.target as HTMLInputElement).style.boxShadow = "none";
            }}
          />
        </div>

        {/* Executions Table */}
        {filtered.length > 0 ? (
          <Card style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--wl-text-sm)",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--wl-border-subtle)",
                      background: "var(--wl-bg-overlay)",
                    }}
                  >
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Workflow Name
                    </th>
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Status
                    </th>
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Steps
                    </th>
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Started
                    </th>
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Duration
                    </th>
                    <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((execution, idx) => (
                    <tr
                      key={execution.id}
                      style={{
                        borderBottom: "1px solid var(--wl-border-subtle)",
                        background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                        transition: "background var(--wl-duration-fast)",
                        cursor: "pointer",
                      }}
                      onClick={() => router.push(`/admin/workflows/${execution.id}`)}
                    >
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                        {execution.workflowName}
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
                        <Badge variant={getStatusBadgeVariant(execution.status)} dot>
                          {getStatusLabel(execution.status)}
                        </Badge>
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                        {execution.completedSteps}/{execution.totalSteps}
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-secondary)" }}>
                        {formatDateTime(execution.startedAt)}
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-secondary)" }}>
                        {execution.duration}
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
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
          <Card style={{ textAlign: "center", padding: "var(--wl-space-8)" }}>
            <div style={{ color: "var(--wl-text-secondary)" }}>
              <Activity size={40} style={{ margin: "0 auto var(--wl-space-3)", opacity: 0.5 }} />
              <h3 style={{ fontSize: "var(--wl-text-base)", fontWeight: 600, margin: "0 0 var(--wl-space-2) 0" }}>
                No executions found
              </h3>
              <p style={{ fontSize: "var(--wl-text-sm)", margin: 0, color: "var(--wl-text-tertiary)" }}>
                {search ? "Try adjusting your search criteria" : "Start a new workflow to see executions here"}
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
