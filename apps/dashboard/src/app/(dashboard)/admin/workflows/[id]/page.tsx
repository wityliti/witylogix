"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

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
  id: string;
  executionId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating";
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  startedAt: string;
  completedAt?: string;
  totalDuration: string;
  steps: WorkflowStep[];
  input: Record<string, any>;
  context: Record<string, string>;
  createdBy: string;
  retryCount: number;
}

const MOCK_EXECUTION: WorkflowExecutionDetail = {
  id: "exec-004",
  executionId: "EXE-2026-00004",
  workflowName: "Payment Processing",
  status: "failed",
  totalSteps: 6,
  completedSteps: 4,
  failedSteps: 1,
  startedAt: "2026-03-07T07:30:00Z",
  completedAt: "2026-03-07T07:33:45Z",
  totalDuration: "3m 45s",
  createdBy: "webhook",
  retryCount: 1,
  input: {
    orderId: "ORD-2026-123456",
    amount: 1250.5,
    currency: "USD",
    customerId: "CUST-789",
    paymentMethod: "credit_card",
  },
  context: {
    tenantId: "tenant-789",
    userId: "user-456",
    requestId: "req-abc-def-123",
    region: "us-east-1",
  },
  steps: [
    {
      id: "step-1",
      number: 1,
      name: "Validate Payment Details",
      status: "completed",
      duration: "245ms",
      startedAt: "2026-03-07T07:30:00Z",
      input: { paymentMethod: "credit_card", amount: 1250.5 },
      output: { validated: true, riskScore: 0.15 },
    },
    {
      id: "step-2",
      number: 2,
      name: "Check Fraud Detection",
      status: "completed",
      duration: "1.2s",
      startedAt: "2026-03-07T07:30:00Z",
      input: { amount: 1250.5, customerId: "CUST-789" },
      output: { fraudRisk: "low", flagged: false },
    },
    {
      id: "step-3",
      number: 3,
      name: "Reserve Inventory",
      status: "completed",
      duration: "890ms",
      startedAt: "2026-03-07T07:30:02Z",
      input: { items: [{ sku: "ITEM-001", qty: 2 }] },
      output: { reservationId: "RES-12345", reserved: true },
    },
    {
      id: "step-4",
      number: 4,
      name: "Process Payment",
      status: "completed",
      duration: "2.1s",
      startedAt: "2026-03-07T07:30:03Z",
      input: { amount: 1250.5, method: "credit_card" },
      output: { transactionId: "TXN-98765", status: "charged" },
    },
    {
      id: "step-5",
      number: 5,
      name: "Send Confirmation Email",
      status: "failed",
      duration: "1.8s",
      startedAt: "2026-03-07T07:30:06Z",
      input: { recipientEmail: "customer@example.com", orderId: "ORD-2026-123456" },
      error: {
        message: "Email service timeout: Unable to reach SMTP server",
        stack: "Error: SMTP connection timeout\n    at SMTPClient.connect (smtp.js:145)\n    at EmailService.send (email.js:89)",
      },
    },
    {
      id: "step-6",
      number: 6,
      name: "Complete Order",
      status: "compensating",
      duration: "—",
      startedAt: "2026-03-07T07:30:08Z",
      compensationStatus: "completed",
      input: { orderId: "ORD-2026-123456", status: "pending" },
      output: { orderStatus: "compensation_completed" },
    },
  ],
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={20} className="text-wl-success-400" />;
    case "failed":
      return <AlertCircle size={20} className="text-wl-danger-400" />;
    case "running":
      return <Loader2 size={20} className="text-wl-info-400 animate-spin" />;
    case "compensating":
      return <RotateCcw size={20} className="text-wl-warning-400" />;
    default:
      return null;
  }
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

const formatDateTime = (isoStr: string): string => {
  const date = new Date(isoStr);
  return date.toLocaleDateString("en-US", {
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
    <pre className="bg-wl-bg-overlay border border-wl-border-subtle rounded-lg p-3 text-xs text-wl-text-secondary overflow-auto font-mono leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-wl-border-subtle" />

      {steps.map((step, idx) => (
        <div
          key={step.id}
          className={cn("relative", idx < steps.length - 1 ? "mb-5" : "")}
        >
          {/* Timeline dot */}
          <div className="absolute -left-5 top-2 w-4.5 h-4.5 rounded-full bg-wl-bg-primary border-4 border-wl-border-subtle flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  step.status === "completed"
                    ? "var(--wl-success-400)"
                    : step.status === "failed"
                    ? "var(--wl-danger-400)"
                    : step.status === "running"
                    ? "var(--wl-info-400)"
                    : "var(--wl-warning-400)",
              }}
            />
          </div>

          {/* Step card */}
          <Card
            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            className="cursor-pointer transition-all"
            style={{
              borderColor: expandedStep === step.id ? "var(--wl-accent)" : undefined,
              background:
                expandedStep === step.id ? "var(--wl-bg-tertiary)" : "var(--wl-bg-elevated)",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-wl-text-tertiary font-semibold">
                      Step {step.number}
                    </span>
                    <h4 className="m-0 text-sm font-semibold text-wl-text-primary">
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
                  <span className="text-xs text-wl-text-tertiary">
                    Duration: {step.duration}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {expandedStep === step.id ? (
                  <ChevronUp size={18} className="text-wl-text-tertiary"  />
                ) : (
                  <ChevronDown size={18} className="text-wl-text-tertiary"  />
                )}
              </div>
            </div>

            {/* Expanded content */}
            {expandedStep === step.id && (
              <div className="mt-4 pt-4 border-t border-wl-border-subtle">
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
                    <h5 className="text-xs font-semibold text-wl-danger-400 uppercase mb-2 tracking-wider">
                      Error Details
                    </h5>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="m-0 mb-2 text-wl-danger-400 text-sm font-medium">
                        {step.error.message}
                      </p>
                      {step.error.stack && (
                        <pre className="m-0 text-xs text-wl-text-tertiary font-mono overflow-auto whitespace-pre-wrap break-words">
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
                      variant={step.compensationStatus === "completed" ? "success" : step.compensationStatus === "failed" ? "danger" : "warning"}
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

export default function WorkflowExecutionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const execution = MOCK_EXECUTION;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-5 px-6 border-b border-wl-border-subtle bg-wl-bg-surface backdrop-blur-sm sticky top-0 z-40">
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
            <h1 className="text-xl font-bold text-wl-text-primary m-0 tracking-tight">
              {execution.workflowName}
            </h1>
            <p className="text-sm text-wl-text-tertiary m-0 mt-0.5">
              {execution.executionId}
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(execution.status)}>{execution.status.toUpperCase()}</Badge>
        </div>

        <div className="flex gap-2">
          {execution.status === "running" && (
            <>
              <Button variant="secondary" size="sm">
                <Square size={16} />
                Cancel
              </Button>
            </>
          )}
          {(execution.status === "failed" || execution.status === "completed") && (
            <Button variant="primary" size="sm">
              <RotateCcw size={16} />
              Retry Workflow
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Steps"
            value={execution.totalSteps}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Completed"
            value={execution.completedSteps}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Failed"
            value={execution.failedSteps}
            accentColor="var(--wl-danger-400)"
            index={2}
          />
          <StatCard
            label="Duration"
            value={execution.totalDuration}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* Step Timeline */}
        <Card className="mb-6" >
          <CardHeader>
            <CardTitle>Step Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline steps={execution.steps} />
          </CardContent>
        </Card>

        {/* Execution Metadata */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-6">
          {/* Input Data */}
          <Card>
            <CardHeader>
              <CardTitle>Input Data</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonViewer data={execution.input} />
            </CardContent>
          </Card>

          {/* Execution Context */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {Object.entries(execution.context).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-xs font-semibold text-wl-text-secondary min-w-20 uppercase tracking-wider">
                      {key}
                    </span>
                    <span className="text-sm text-wl-text-primary font-mono">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-wl-text-tertiary" />
                    <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                      Started
                    </span>
                  </div>
                  <span className="text-sm text-wl-text-primary block ml-5">
                    {formatDateTime(execution.startedAt)}
                  </span>
                </div>
                {execution.completedAt && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={14} className="text-wl-success-400" />
                      <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                        Completed
                      </span>
                    </div>
                    <span className="text-sm text-wl-text-primary block ml-5">
                      {formatDateTime(execution.completedAt)}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-wl-text-tertiary" />
                    <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                      Created By
                    </span>
                  </div>
                  <span className="text-sm text-wl-text-primary block ml-5 capitalize">
                    {execution.createdBy}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <RotateCcw size={14} className="text-wl-text-tertiary" />
                    <span className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                      Retry Count
                    </span>
                  </div>
                  <span className="text-sm text-wl-text-primary block ml-5">
                    {execution.retryCount}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Details Card (if failed) */}
        {execution.status === "failed" && execution.steps.some((s) => s.error) && (
          <Card
            className="border-l-4 border-l-wl-danger-400 mb-6"
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-wl-danger-400" />
                <CardTitle>Error Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {execution.steps
                .filter((s) => s.error)
                .map((step) => (
                  <div key={step.id} className="mb-3">
                    <p className="m-0 mb-1 text-wl-danger-400 text-sm font-semibold">
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

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
