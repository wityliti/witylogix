"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { StatCard } from "../../../../components/ui/stat-card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
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
      return <CheckCircle2 size={20} style={{ color: "var(--wl-success-400)" }} />;
    case "failed":
      return <AlertCircle size={20} style={{ color: "var(--wl-danger-400)" }} />;
    case "running":
      return <Loader2 size={20} style={{ color: "var(--wl-info-400)", animation: "spin 1s linear infinite" }} />;
    case "compensating":
      return <RotateCcw size={20} style={{ color: "var(--wl-warning-400)" }} />;
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
    <pre
      style={{
        background: "var(--wl-bg-overlay)",
        border: "1px solid var(--wl-border-subtle)",
        borderRadius: "var(--wl-radius-md)",
        padding: "var(--wl-space-3)",
        fontSize: "var(--wl-text-xs)",
        color: "var(--wl-text-secondary)",
        overflow: "auto",
        fontFamily: "var(--wl-font-mono)",
        lineHeight: 1.5,
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "relative",
        paddingLeft: "var(--wl-space-6)",
      }}
    >
      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          left: "8px",
          top: "var(--wl-space-4)",
          bottom: 0,
          width: "2px",
          background: "var(--wl-border-subtle)",
        }}
      />

      {steps.map((step, idx) => (
        <div
          key={step.id}
          style={{
            marginBottom: idx < steps.length - 1 ? "var(--wl-space-5)" : 0,
            position: "relative",
          }}
        >
          {/* Timeline dot */}
          <div
            style={{
              position: "absolute",
              left: "-20px",
              top: "var(--wl-space-2)",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "var(--wl-bg-primary)",
              border: "3px solid var(--wl-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
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
            style={{
              cursor: "pointer",
              transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
              border: expandedStep === step.id ? "1px solid var(--wl-accent)" : "1px solid var(--wl-border-subtle)",
              background:
                expandedStep === step.id ? "var(--wl-bg-tertiary)" : "var(--wl-bg-elevated)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--wl-space-4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                  {getStatusIcon(step.status)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-2)",
                      marginBottom: "var(--wl-space-1)",
                    }}
                  >
                    <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", fontWeight: 600 }}>
                      Step {step.number}
                    </span>
                    <h4 style={{ margin: 0, fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
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
                  <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                    Duration: {step.duration}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--wl-space-2)",
                }}
              >
                {expandedStep === step.id ? (
                  <ChevronUp size={18} style={{ color: "var(--wl-text-tertiary)" }} />
                ) : (
                  <ChevronDown size={18} style={{ color: "var(--wl-text-tertiary)" }} />
                )}
              </div>
            </div>

            {/* Expanded content */}
            {expandedStep === step.id && (
              <div
                style={{
                  marginTop: "var(--wl-space-4)",
                  paddingTop: "var(--wl-space-4)",
                  borderTop: "1px solid var(--wl-border-subtle)",
                }}
              >
                {step.input && (
                  <div style={{ marginBottom: "var(--wl-space-4)" }}>
                    <h5 style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", marginBottom: "var(--wl-space-2)", letterSpacing: "0.04em" }}>
                      Input
                    </h5>
                    <JsonViewer data={step.input} />
                  </div>
                )}

                {step.output && (
                  <div style={{ marginBottom: "var(--wl-space-4)" }}>
                    <h5 style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", marginBottom: "var(--wl-space-2)", letterSpacing: "0.04em" }}>
                      Output
                    </h5>
                    <JsonViewer data={step.output} />
                  </div>
                )}

                {step.error && (
                  <div style={{ marginBottom: "var(--wl-space-4)" }}>
                    <h5 style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-danger-400)", textTransform: "uppercase", marginBottom: "var(--wl-space-2)", letterSpacing: "0.04em" }}>
                      Error Details
                    </h5>
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: "var(--wl-radius-md)",
                        padding: "var(--wl-space-3)",
                      }}
                    >
                      <p style={{ margin: "0 0 var(--wl-space-2) 0", color: "var(--wl-danger-400)", fontSize: "var(--wl-text-sm)", fontWeight: 500 }}>
                        {step.error.message}
                      </p>
                      {step.error.stack && (
                        <pre
                          style={{
                            margin: 0,
                            fontSize: "var(--wl-text-xs)",
                            color: "var(--wl-text-tertiary)",
                            fontFamily: "var(--wl-font-mono)",
                            overflow: "auto",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {step.error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {step.compensationStatus && (
                  <div>
                    <h5 style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", marginBottom: "var(--wl-space-2)", letterSpacing: "0.04em" }}>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--wl-space-5) var(--wl-space-6)",
          borderBottom: "1px solid var(--wl-border-subtle)",
          background: "var(--wl-bg-surface)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-4)" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/workflows")}
            style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-1)" }}
          >
            <ChevronLeft size={18} />
            Back
          </Button>
          <div>
            <h1
              style={{
                fontSize: "var(--wl-text-xl)",
                fontWeight: 700,
                color: "var(--wl-text-primary)",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {execution.workflowName}
            </h1>
            <p
              style={{
                fontSize: "var(--wl-text-sm)",
                color: "var(--wl-text-tertiary)",
                margin: "2px 0 0 0",
              }}
            >
              {execution.executionId}
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(execution.status)}>{execution.status.toUpperCase()}</Badge>
        </div>

        <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
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

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle>Step Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline steps={execution.steps} />
          </CardContent>
        </Card>

        {/* Execution Metadata */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                {Object.entries(execution.context).map(([key, value]) => (
                  <div key={key} style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                    <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", minWidth: 80, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {key}
                    </span>
                    <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", fontFamily: "var(--wl-font-mono)" }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-1)" }}>
                    <Calendar size={14} style={{ color: "var(--wl-text-tertiary)" }} />
                    <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Started
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", display: "block", marginLeft: 20 }}>
                    {formatDateTime(execution.startedAt)}
                  </span>
                </div>
                {execution.completedAt && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-1)" }}>
                      <CheckCircle2 size={14} style={{ color: "var(--wl-success-400)" }} />
                      <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Completed
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", display: "block", marginLeft: 20 }}>
                      {formatDateTime(execution.completedAt)}
                    </span>
                  </div>
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-1)" }}>
                    <User size={14} style={{ color: "var(--wl-text-tertiary)" }} />
                    <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Created By
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", display: "block", marginLeft: 20, textTransform: "capitalize" }}>
                    {execution.createdBy}
                  </span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-1)" }}>
                    <RotateCcw size={14} style={{ color: "var(--wl-text-tertiary)" }} />
                    <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Retry Count
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", display: "block", marginLeft: 20 }}>
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
            style={{
              borderColor: "var(--wl-danger-400)",
              borderLeftWidth: 4,
              borderLeftStyle: "solid",
              marginBottom: "var(--wl-space-6)",
            }}
          >
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <AlertCircle size={20} style={{ color: "var(--wl-danger-400)" }} />
                <CardTitle>Error Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {execution.steps
                .filter((s) => s.error)
                .map((step) => (
                  <div key={step.id} style={{ marginBottom: "var(--wl-space-3)" }}>
                    <p style={{ margin: "0 0 var(--wl-space-1) 0", color: "var(--wl-danger-400)", fontSize: "var(--wl-text-sm)", fontWeight: 600 }}>
                      Step {step.number}: {step.name}
                    </p>
                    <p style={{ margin: 0, color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-sm)" }}>
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
