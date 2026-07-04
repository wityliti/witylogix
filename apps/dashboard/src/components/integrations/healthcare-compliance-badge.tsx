"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Calendar,
  ShieldAlert,
  Lock,
  Eye,
} from "lucide-react";

type ComplianceStatus = "compliant" | "warning" | "violation";

interface ComplianceRequirement {
  id: string;
  name: string;
  status: "completed" | "pending" | "failed";
  dueDate?: Date;
  description: string;
}

interface HealthcareComplianceBadgeProps {
  status: ComplianceStatus;
  lastAuditDate: Date;
  nextScheduledDate: Date;
  phiAccessCount: number;
  requirements?: ComplianceRequirement[];
  onViewAudit?: () => void;
  className?: string;
}

const defaultRequirements: ComplianceRequirement[] = [
  {
    id: "req-001",
    name: "Access Control Policy",
    status: "completed",
    description: "Implementation and maintenance of access control policies",
  },
  {
    id: "req-002",
    name: "Audit & Accountability",
    status: "completed",
    description: "System activity logging and monitoring",
  },
  {
    id: "req-003",
    name: "Data Integrity",
    status: "completed",
    description:
      "Mechanisms to protect health information from improper alteration",
  },
  {
    id: "req-004",
    name: "Encryption Standards",
    status: "completed",
    description: "Encryption of electronic PHI at rest and in transit",
  },
  {
    id: "req-005",
    name: "Incident Response",
    status: "pending",
    dueDate: new Date("2025-04-15"),
    description: "Procedures for response to security incidents",
  },
  {
    id: "req-006",
    name: "Business Associate Agreements",
    status: "completed",
    description: "Required BAA documentation with all third parties",
  },
];

export function HealthcareComplianceBadge({
  status,
  lastAuditDate,
  nextScheduledDate,
  phiAccessCount,
  requirements = defaultRequirements,
  onViewAudit,
  className,
}: HealthcareComplianceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (): string => {
    switch (status) {
      case "compliant":
        return "var(--wl-success-500)";
      case "warning":
        return "var(--wl-warning-500)";
      case "violation":
        return "var(--wl-danger-500)";
    }
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case "compliant":
        return "Compliant";
      case "warning":
        return "Warning";
      case "violation":
        return "Non-Compliant";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "compliant":
        return <CheckCircle2 className="w-5 h-5" />;
      case "warning":
        return <AlertCircle className="w-5 h-5" />;
      case "violation":
        return <ShieldAlert className="w-5 h-5" />;
    }
  };

  const getBadgeVariant = (): "success" | "warning" | "danger" => {
    switch (status) {
      case "compliant":
        return "success";
      case "warning":
        return "warning";
      case "violation":
        return "danger";
    }
  };

  const completedCount = requirements.filter(
    (r) => r.status === "completed",
  ).length;
  const failedCount = requirements.filter((r) => r.status === "failed").length;

  return (
    <div
      className={cn(
        "flex flex-col border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden transition-all duration-200",
        className,
      )}
    >
      {/* Main badge section */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div
              className="flex-shrink-0 text-wl-text-primary"
              style={{ color: getStatusColor() }}
            >
              {getStatusIcon()}
            </div>

            <div className="flex-1">
              <h3 className="text-base font-semibold text-wl-text-primary">
                HIPAA Compliance Status
              </h3>
              <p className="text-sm text-wl-text-secondary mt-1">
                Latest assessment on {lastAuditDate.toLocaleDateString()}
              </p>
            </div>
          </div>

          <Badge variant={getBadgeVariant()} className="flex-shrink-0">
            {getStatusLabel()}
          </Badge>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-wl-bg-overlay rounded-lg">
            <p className="text-xs text-wl-text-secondary mb-1">Requirements</p>
            <p className="text-lg font-bold text-wl-success-400">
              {completedCount}/{requirements.length}
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">Completed</p>
          </div>

          <div className="p-3 bg-wl-bg-overlay rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-3.5 h-3.5 text-wl-text-secondary" />
              <p className="text-xs text-wl-text-secondary">PHI Access</p>
            </div>
            <p className="text-lg font-bold text-wl-text-primary">
              {phiAccessCount.toLocaleString()}
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">This month</p>
          </div>

          <div className="p-3 bg-wl-bg-overlay rounded-lg">
            <p className="text-xs text-wl-text-secondary mb-1">Next Audit</p>
            <p className="text-sm font-semibold text-wl-text-primary">
              {nextScheduledDate.toLocaleDateString()}
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">
              {Math.ceil(
                (nextScheduledDate.getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24),
              )}{" "}
              days
            </p>
          </div>
        </div>

        {/* Audit button */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onViewAudit}
          className="w-full"
        >
          View Latest Audit Report
        </Button>
      </div>

      {/* Expandable checklist */}
      <div className="border-t border-wl-border-subtle">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between bg-wl-bg-overlay hover:bg-wl-border-subtle transition-colors text-left"
        >
          <span className="text-sm font-semibold text-wl-text-primary">
            Compliance Requirements Checklist
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-wl-text-secondary transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>

        {isExpanded && (
          <div className="p-4 space-y-3 bg-wl-bg-surface">
            {requirements.map((req) => (
              <div
                key={req.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  req.status === "completed"
                    ? "border-wl-success-400/20 bg-wl-success-bg/20"
                    : req.status === "pending"
                      ? "border-wl-warning-400/20 bg-wl-warning-bg/20"
                      : "border-wl-danger-400/20 bg-wl-danger-bg/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    {req.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-wl-success-400" />
                    ) : req.status === "pending" ? (
                      <AlertCircle className="w-4 h-4 text-wl-warning-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-wl-danger-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-wl-text-primary">
                        {req.name}
                      </h4>
                      <Badge
                        variant={
                          req.status === "completed"
                            ? "success"
                            : req.status === "pending"
                              ? "warning"
                              : "danger"
                        }
                        className="flex-shrink-0 text-xs"
                      >
                        {req.status === "completed"
                          ? "Completed"
                          : req.status === "pending"
                            ? "Pending"
                            : "Failed"}
                      </Badge>
                    </div>

                    <p className="text-xs text-wl-text-secondary">
                      {req.description}
                    </p>

                    {req.dueDate && req.status !== "completed" && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Calendar className="w-3 h-3 text-wl-text-secondary" />
                        <span className="text-xs text-wl-text-secondary">
                          Due: {req.dueDate.toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {failedCount > 0 && (
              <div className="mt-4 p-3 bg-wl-danger-bg/30 border border-wl-danger-400/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-wl-danger-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-wl-danger-400">
                      {failedCount} requirement(s) failed
                    </p>
                    <p className="text-xs text-wl-danger-300 mt-1">
                      Immediate action required to maintain compliance
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-3 border-t border-wl-border-subtle bg-wl-bg-overlay text-xs text-wl-text-secondary flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        <span>HIPAA compliance data is encrypted and regularly audited</span>
      </div>
    </div>
  );
}
