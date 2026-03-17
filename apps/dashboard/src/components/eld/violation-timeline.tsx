"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HosViolation } from "@/hooks/use-eld";
import { AlertTriangle, CheckCircle, ChevronDown, Filter, Clock } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   VIOLATION TIMELINE — Vertical timeline of HOS violations
   Color-coded severity, expandable details, filtering
   ═══════════════════════════════════════════════════════════ */

interface ViolationTimelineProps {
  violations: HosViolation[];
  isLoading?: boolean;
  onFilterChange?: (filterType: string) => void;
}

export function ViolationTimeline({
  violations,
  isLoading = false,
  onFilterChange,
}: ViolationTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filteredViolations = useMemo(() => {
    if (!filterType) return violations;
    return violations.filter((v) => v.type === filterType);
  }, [violations, filterType]);

  const handleFilterChange = (type: string | null) => {
    setFilterType(type);
    onFilterChange?.(type || "");
  };

  const severityIcon = (severity: string) => {
    const iconClass = "w-4 h-4";
    if (severity === "CRITICAL") {
      return <AlertTriangle className={cn(iconClass, "text-wl-danger-400")} />;
    }
    if (severity === "WARNING") {
      return <AlertTriangle className={cn(iconClass, "text-wl-warning-400")} />;
    }
    return <Clock className={cn(iconClass, "text-wl-info-400")} />;
  };

  const violationTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      HOURS_EXCEEDED: "Hours Exceeded",
      NO_BREAK: "No Break Taken",
      FATIGUE: "Fatigue Detected",
      FALSIFIED: "Falsified Entry",
      LOGGED_EDIT: "Log Edit",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <Card className="border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-lg">Recent Violations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-wl-text-secondary">
            <div className="w-8 h-8 rounded-full border-2 border-wl-primary-500/30 border-t-wl-primary-500 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--wl-border)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Recent Violations</CardTitle>
          {filteredViolations.length > 0 && (
            <Badge variant={filterType ? "primary" : "default"}>
              {filteredViolations.length}
            </Badge>
          )}
        </div>

        {/* Filter buttons */}
        {violations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pb-4 border-b border-[var(--wl-border)]">
            <Button
              variant={filterType === null ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleFilterChange(null)}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button
              variant={filterType === "HOURS_EXCEEDED" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleFilterChange("HOURS_EXCEEDED")}
              className="h-7 text-xs"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Hours
            </Button>
            <Button
              variant={filterType === "NO_BREAK" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleFilterChange("NO_BREAK")}
              className="h-7 text-xs"
            >
              <Clock className="w-3 h-3 mr-1" />
              Break
            </Button>
            <Button
              variant={filterType === "FATIGUE" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleFilterChange("FATIGUE")}
              className="h-7 text-xs"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Fatigue
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredViolations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-wl-text-secondary">
            <CheckCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No violations</p>
            <p className="text-xs mt-1">Fleet is in good standing</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredViolations.map((violation, index) => (
              <div key={violation.id}>
                {/* Timeline entry */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === violation.id ? null : violation.id)
                  }
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    "hover:bg-[var(--wl-bg-secondary)] border-[var(--wl-border)]",
                    expandedId === violation.id && "bg-[var(--wl-bg-secondary)] border-wl-primary-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {severityIcon(violation.severity)}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-wl-text-primary">
                          {violationTypeLabel(violation.type)}
                        </h4>
                        <Badge
                          variant={
                            violation.severity === "CRITICAL"
                              ? "danger"
                              : violation.severity === "WARNING"
                                ? "warning"
                                : "info"
                          }
                        >
                          {violation.severity}
                        </Badge>
                      </div>

                      <p className="text-xs text-wl-text-secondary mt-1">
                        {violation.driverName} • {new Date(violation.timestamp).toLocaleDateString()}{" "}
                        {new Date(violation.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-wl-text-secondary">
                          Duration: {violation.duration}m
                        </span>
                        {violation.resolvedAt && (
                          <Badge variant="success" className="text-xs">
                            ✓ Resolved
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-wl-text-secondary flex-shrink-0 transition-transform",
                        expandedId === violation.id && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* Expanded details */}
                {expandedId === violation.id && (
                  <div className="mt-2 ml-6 p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)] space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold text-wl-text-secondary mb-1">
                        Description
                      </p>
                      <p className="text-sm text-wl-text-primary">{violation.description}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide font-semibold text-wl-text-secondary mb-1">
                        Suggested Action
                      </p>
                      <p className="text-sm text-wl-text-primary">
                        {violation.suggestedAction}
                      </p>
                    </div>

                    {violation.resolvedAt && (
                      <div>
                        <p className="text-xs uppercase tracking-wide font-semibold text-wl-text-secondary mb-1">
                          Resolved
                        </p>
                        <p className="text-sm text-wl-success-400">
                          {new Date(violation.resolvedAt).toLocaleDateString()} at{" "}
                          {new Date(violation.resolvedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-7 text-xs flex-1"
                      >
                        View Driver
                      </Button>
                      {!violation.resolvedAt && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs flex-1"
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline connector line */}
                {index < filteredViolations.length - 1 && (
                  <div className="h-2 border-l border-[var(--wl-border)] ml-[17px]" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
