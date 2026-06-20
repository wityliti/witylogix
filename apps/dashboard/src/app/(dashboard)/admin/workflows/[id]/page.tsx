"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { LoadingSkeleton } from "../../../../../components/ui/loading-skeleton";
import { ErrorState } from "../../../../../components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
} from "lucide-react";
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { Skeleton } from '../../../../../components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════
   WORKFLOW EXECUTION DETAIL PAGE — Monitor step-by-step execution
   ═══════════════════════════════════════════════════════════ */

interface WorkflowStep {
  id: string;
  number: number;
  name: string;
  status: "completed" | "failed" | "running" | "compensating";
  duration: string;
  startedAt: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: { message: string; stack?: string };
  compensationStatus?: "pending" | "completed" | "failed";
}

interface WorkflowExecutionDetail {
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: Record<string, any>;
  steps: WorkflowStep[];
  metadata?: Record<string, any>;
  createdAt: string;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function normalizeExecution(raw: any): WorkflowExecutionDetail {
  const d = raw?.data ?? raw;
  const steps: WorkflowStep[] = Array.isArray(d.steps)
    ? d.steps.map((s: any, i: number) => ({
        id: s.id ?? `step-${i + 1}`,
        number: s.number ?? i + 1,
        name: s.name ?? `Step ${i + 1}`,
        status: s.status ?? "completed",
        duration: s.durationMs ? formatDuration(s.durationMs) : (s.duration ?? "—"),
        startedAt: s.startedAt ?? d.startedAt ?? new Date().toISOString(),
        input: s.input ?? {},
        output: s.output ?? {},
        error: s.error,
        compensationStatus: s.compensationStatus,
      }))
    : [];
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;
  const meta = (d.metadata as Record<string, any>) ?? {};
  return {
    id: d.executionId ?? d.id ?? "",
    executionId: d.executionId ?? d.id ?? "",
    workflowName: d.workflowName ?? "Workflow",
    status: (d.status ?? "completed") as WorkflowExecutionDetail["status"],
    totalSteps: steps.length || meta.totalSteps || 0,
    completedSteps,
    failedSteps,
    startedAt: d.startedAt ?? d.createdAt ?? new Date().toISOString(),
    completedAt: d.completedAt ?? undefined,
    totalDuration: formatDuration(d.durationMs),
    steps,
    input: (d.input as Record<string, any>) ?? {},
    context: (meta.context as Record<string, string>) ?? {},
    createdBy: meta.createdBy ?? meta.triggeredBy ?? "system",
    retryCount: meta.retryCount ?? 0,
  };
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={20} className="text-emerald-500" />;
    case "failed":
      return <AlertCircle size={20} className="text-red-500" />;
    case "running":
      return <Loader2 size={20} className="text-blue-500 animate-spin" />;
    case "compensating":
      return <RotateCcw size={20} className="text-amber-500" />;
    default:
      return null;
  }
};

const getStatusBadgeVariant = (
  status: "running" | "completed" | "failed" | "compensating"
): "info" | "success" | "danger" | "warning" => {
  switch (status) {
    case "running": return "info";
    case "completed": return "success";
    case "failed": return "danger";
    case "compensating": return "warning";
    default: return "default" as any;
  }
};

const formatDateTime = (isoStr: string): string => {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

const formatDuration = (ms?: number): string => {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

function JsonViewer({ data }: { data: Record<string, any> }) {
  return (
    <pre className="bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 text-xs text-gray-400 overflow-auto font-mono leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No step details available for this execution.
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-wl-bg-elevated" />
      {steps.map((step, idx) => (
        <div key={step.id} className={cn("relative", idx < steps.length - 1 ? "mb-5" : "")}>
          <div className="absolute -left-5 top-2 w-4.5 h-4.5 rounded-full bg-wl-bg-root border-4 border-wl-border-default flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  step.status === "completed" ? "#10b981" :
                  step.status === "failed" ? "#ef4444" :
                  step.status === "running" ? "#3b82f6" : "#f59e0b",
              }}
            />
          </div>

          <Card
            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            className={cn(
              "cursor-pointer transition-all border",
              expandedStep === step.id
                ? "bg-wl-bg-overlay border-wl-info-500"
                : "bg-wl-bg-surface border-wl-border-default",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(step.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-semibold">Step {step.number}</span>
                    <h4 className="m-0 text-sm font-semibold text-white">{step.name}</h4>
                    <Badge variant={step.status === "completed" ? "success" : step.status === "failed" ? "danger" : step.status === "running" ? "info" : "warning"}>
                      {step.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400">Duration: {step.duration}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedStep === step.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            </div>

            {expandedStep === step.id && (
              <div className="mt-4 pt-4 border-t border-wl-border-default">
                {step.input && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Input</h5>
                    <JsonViewer data={step.input} />
                  </div>
                )}
                {step.output && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Output</h5>
                    <JsonViewer data={step.output} />
                  </div>
                )}
                {step.error && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-red-500 uppercase mb-2 tracking-wider">Error Details</h5>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="m-0 mb-2 text-red-500 text-sm font-medium">{step.error.message}</p>
                      {step.error.stack && (
                        <pre className="m-0 text-xs text-gray-400 font-mono overflow-auto whitespace-pre-wrap break-words">
                          {step.error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
                {step.compensationStatus && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Compensation Status</h5>
                    <Badge variant={step.compensationStatus === "completed" ? "success" : step.compensationStatus === "failed" ? "danger" : "warning"}>
                      {step.compensationStatus}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      ))}
    </div>
  );
}

function normalizeExecution(raw: any): WorkflowExecutionDetail {
  const steps: WorkflowStep[] = (raw.steps ?? []).map((s: any, i: number) => ({
    id: s.id ?? `step-${i + 1}`,
    number: i + 1,
    name: s.name ?? s.stepName ?? `Step ${i + 1}`,
    status: s.status ?? "completed",
    duration: s.durationMs ? `${s.durationMs}ms` : "—",
    startedAt: s.startedAt ?? raw.startedAt ?? "",
    input: s.input ?? {},
    output: s.output ?? {},
    error: s.error,
    compensationStatus: s.compensationStatus,
  }));

  const completedSteps = steps.filter(s => s.status === "completed").length;
  const failedSteps = steps.filter(s => s.status === "failed").length;

  return {
    id: raw.executionId ?? raw.id ?? "",
    executionId: raw.executionId ?? raw.id ?? "",
    workflowName: raw.workflowName ?? "Workflow",
    status: raw.status ?? "running",
    totalSteps: steps.length,
    completedSteps,
    failedSteps,
    startedAt: raw.startedAt ?? "",
    completedAt: raw.completedAt,
    totalDuration: raw.durationMs ? `${Math.round(raw.durationMs / 1000)}s` : "—",
    createdBy: raw.metadata?.triggeredBy ?? "system",
    retryCount: raw.metadata?.retryCount ?? 0,
    input: (raw.input as Record<string, any>) ?? {},
    context: (raw.metadata as Record<string, string>) ?? {},
    steps,
  };
}

export default function WorkflowExecutionDetailPage() {
  const params = useParams();
  const { data: raw, loading, error, refetch } = useApiQuery<{data: any}>(`/api/v4/workflow/executions/${params.id}`);
  const router = useRouter();
  const params = useParams();
  const executionId = params.id as string;

  const { data: rawData, loading, error } = useApiQuery<any>(`/api/v4/workflow/executions/${executionId}`);

  const execution = rawData ? normalizeExecution(rawData) : null;

  if (loading) {
    return (
      <div className="bg-[#0a0a0f] min-h-screen p-6 space-y-6">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="bg-[#0a0a0f] min-h-screen p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/workflows")} className="flex items-center gap-1">
            <ChevronLeft size={18} />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center bg-[#12121a] border border-[#1e1e2e]">
          <p className="text-red-400 mb-4">{error?.message ?? "Execution not found"}</p>
          <Button variant="secondary" onClick={() => router.push("/admin/workflows")}>Back to Workflows</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-wl-bg-root min-h-screen">
      <div className="flex items-center justify-between p-5 px-6 border-b border-wl-border-default bg-wl-bg-surface backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/workflows")} className="flex items-center gap-1">
            <ChevronLeft size={18} />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white m-0 tracking-tight">{execution.workflowName}</h1>
            <p className="text-sm text-gray-400 m-0 mt-0.5">{execution.executionId}</p>
          </div>
          <Badge variant={getStatusBadgeVariant(execution.status)}>{execution.status.toUpperCase()}</Badge>
        </div>

        <div className="flex gap-2">
          {execution.status === "running" && (
            <Button variant="secondary" size="sm" onClick={handleCancel} disabled={cancelling}>
              <Square size={16} />
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          {(execution.status === "failed" || execution.status === "completed") && (
            <Button variant="primary" size="sm" onClick={handleRetry} disabled={retrying}>
              <RotateCcw size={16} />
              {retrying ? "Retrying…" : "Retry Workflow"}
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          <StatCard label="Total Steps" value={steps.length} accentColor="#3b82f6" index={0} />
          <StatCard label="Completed" value={completedSteps} accentColor="#10b981" index={1} />
          <StatCard label="Failed" value={failedSteps} accentColor="#ef4444" index={2} />
          <StatCard label="Duration" value={formatDuration(execution.durationMs)} accentColor="#3b82f6" index={3} />
        </div>

        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">Step Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline steps={steps} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-6">
          {execution.input && (
            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader><CardTitle className="text-white">Input Data</CardTitle></CardHeader>
              <CardContent><JsonViewer data={execution.input as Record<string, any>} /></CardContent>
            </Card>
          )}

          {execution.metadata && (
            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader><CardTitle className="text-white">Execution Context</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {Object.entries(execution.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-xs font-semibold text-gray-400 min-w-20 uppercase tracking-wider">{key}</span>
                      <span className="text-sm text-white font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader><CardTitle className="text-white">Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Started</span>
                  </div>
                  <span className="text-sm text-white block ml-5">{formatDateTime(execution.startedAt)}</span>
                </div>
                {execution.completedAt && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed</span>
                    </div>
                    <span className="text-sm text-white block ml-5">{formatDateTime(execution.completedAt)}</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</span>
                  </div>
                  <span className="text-sm text-white block ml-5">{formatDateTime(execution.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {execution.status === "failed" && execution.error && (
          <Card className="border-l-4 border-l-red-500 mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                <CardTitle>Error Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <JsonViewer data={execution.error as Record<string, any>} />
            </CardContent>
          </Card>
        )}

        {execution.status === "failed" && steps.some(s => s.error) && (
          <Card className="border-l-4 border-l-red-500 mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                <CardTitle>Step Errors</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {steps.filter(s => s.error).map(step => (
                <div key={step.id} className="mb-3">
                  <p className="m-0 mb-1 text-red-500 text-sm font-semibold">Step {step.number}: {step.name}</p>
                  <p className="m-0 text-gray-400 text-sm">{step.error?.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
