"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../../../../components/ui/card";
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
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

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

interface ExecutionResponse {
  data: WorkflowExecutionDetail;
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
  status: "running" | "completed" | "failed" | "compensating",
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

const formatDateTime = (isoStr: string): string => {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

function JsonViewer({ data }: { data: Record<string, any> }) {
  return (
    <pre className="bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 text-xs text-wl-text-secondary overflow-auto font-mono leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <p className="text-sm text-wl-text-secondary text-center py-6">
        No step details available for this execution.
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-wl-bg-elevated" />
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className={cn("relative", idx < steps.length - 1 ? "mb-5" : "")}
        >
          <div className="absolute -left-5 top-2 w-4.5 h-4.5 rounded-full bg-wl-bg-root border-4 border-wl-border-default flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  step.status === "completed"
                    ? "var(--wl-success-500)"
                    : step.status === "failed"
                      ? "var(--wl-danger-500)"
                      : step.status === "running"
                        ? "var(--wl-info-500)"
                        : "var(--wl-warning-500)",
              }}
            />
          </div>

          <Card
            onClick={() =>
              setExpandedStep(expandedStep === step.id ? null : step.id)
            }
            className="cursor-pointer transition-all bg-wl-bg-surface border border-wl-border-default"
            style={{
              borderColor:
                expandedStep === step.id ? "var(--wl-info-500)" : undefined,
              background:
                expandedStep === step.id
                  ? "var(--wl-bg-elevated)"
                  : "var(--wl-bg-root)",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(step.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-wl-text-secondary font-semibold">
                      Step {step.number}
                    </span>
                    <h4 className="m-0 text-sm font-semibold text-white">
                      {step.name}
                    </h4>
                    <Badge
                      variant={
                        step.status === "completed"
                          ? "success"
                          : step.status === "failed"
                            ? "danger"
                            : step.status === "running"
                              ? "info"
                              : "warning"
                      }
                    >
                      {step.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-wl-text-secondary">
                    Duration: {step.duration}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedStep === step.id ? (
                  <ChevronUp size={18} className="text-wl-text-secondary" />
                ) : (
                  <ChevronDown size={18} className="text-wl-text-secondary" />
                )}
              </div>
            </div>

            {expandedStep === step.id && (
              <div className="mt-4 pt-4 border-t border-wl-border-default">
                {step.input && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider">
                      Input
                    </h5>
                    <JsonViewer data={step.input} />
                  </div>
                )}
                {step.output && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider">
                      Output
                    </h5>
                    <JsonViewer data={step.output} />
                  </div>
                )}
                {step.error && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-red-500 uppercase mb-2 tracking-wider">
                      Error Details
                    </h5>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="m-0 mb-2 text-red-500 text-sm font-medium">
                        {step.error.message}
                      </p>
                      {step.error.stack && (
                        <pre className="m-0 text-xs text-wl-text-secondary font-mono overflow-auto whitespace-pre-wrap break-words">
                          {step.error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
                {step.compensationStatus && (
                  <div>
                    <h5 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider">
                      Compensation Status
                    </h5>
                    <Badge
                      variant={
                        step.compensationStatus === "completed"
                          ? "success"
                          : step.compensationStatus === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
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

export default function WorkflowExecutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { data, loading, error, refetch } = useApiQuery<ExecutionResponse>(
    id ? `/api/v4/workflow/executions/${id}` : null,
  );

  const execution = data?.data;

  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleCancel = async () => {
    if (!execution || cancelling) return;
    setCancelling(true);
    try {
      await api.post(`/api/v4/workflow/executions/${id}/cancel`, {});
      refetch();
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (!execution || retrying) return;
    setRetrying(true);
    try {
      refetch();
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error || !execution)
    return (
      <ErrorState
        message={error?.message ?? "Execution not found"}
        onRetry={refetch}
      />
    );

  const steps = execution.steps ?? [];
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;

  return (
    <div className="bg-wl-bg-root min-h-screen">
      <div className="flex items-center justify-between p-5 px-6 border-b border-wl-border-default bg-wl-bg-surface backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/workflows")}
            className="flex items-center gap-1"
          >
            <ChevronLeft size={18} />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white m-0 tracking-tight">
              {execution.workflowName}
            </h1>
            <p className="text-sm text-wl-text-secondary m-0 mt-0.5">
              {execution.executionId}
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(execution.status)}>
            {execution.status.toUpperCase()}
          </Badge>
        </div>

        <div className="flex gap-2">
          {execution.status === "running" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <Square size={16} />
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          {(execution.status === "failed" ||
            execution.status === "completed") && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
            >
              <RotateCcw size={16} />
              {retrying ? "Retrying…" : "Retry Workflow"}
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          <StatCard label="Total Steps" value={steps.length} index={0} />
          <StatCard
            label="Completed"
            value={completedSteps}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Failed"
            value={failedSteps}
            accentColor="var(--wl-danger-500)"
            index={2}
          />
          <StatCard
            label="Duration"
            value={formatDuration(execution.durationMs ?? 0)}
            index={3}
          />
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
              <CardHeader>
                <CardTitle className="text-white">Input Data</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonViewer data={execution.input as Record<string, any>} />
              </CardContent>
            </Card>
          )}

          {execution.metadata && (
            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-white">Execution Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {Object.entries(execution.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-xs font-semibold text-wl-text-secondary min-w-20 uppercase tracking-wider">
                        {key}
                      </span>
                      <span className="text-sm text-white font-mono">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-white">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-wl-text-secondary" />
                    <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                      Started
                    </span>
                  </div>
                  <span className="text-sm text-white block ml-5">
                    {formatDateTime(execution.startedAt)}
                  </span>
                </div>
                {execution.completedAt && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                        Completed
                      </span>
                    </div>
                    <span className="text-sm text-white block ml-5">
                      {formatDateTime(execution.completedAt)}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-wl-text-secondary" />
                    <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                      Created
                    </span>
                  </div>
                  <span className="text-sm text-white block ml-5">
                    {formatDateTime(execution.createdAt)}
                  </span>
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

        {execution.status === "failed" && steps.some((s) => s.error) && (
          <Card className="border-l-4 border-l-red-500 mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                <CardTitle>Step Errors</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {steps
                .filter((s) => s.error)
                .map((step) => (
                  <div key={step.id} className="mb-3">
                    <p className="m-0 mb-1 text-red-500 text-sm font-semibold">
                      Step {step.number}: {step.name}
                    </p>
                    <p className="m-0 text-wl-text-secondary text-sm">
                      {step.error?.message}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
