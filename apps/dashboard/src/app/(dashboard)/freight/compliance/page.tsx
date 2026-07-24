"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiList } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  carrier?: string;
  complianceScore?: number | null;
}

type FilterStatus = "All" | "Active" | "Inactive" | "Suspended";

export default function FreightCompliancePage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const {
    items: shipments,
    loading,
    error,
    refetch,
  } = useApiList<Shipment>("/api/v4/shipments?type=freight&view=compliance");

  const stats = useMemo(() => {
    const compliantCount = shipments.filter(
      (s) => s.status === "compliant" || s.status === "DELIVERED",
    ).length;
    const avgScore =
      shipments.length > 0
        ? Math.round((compliantCount / shipments.length) * 100)
        : 0;
    const flagged = shipments.length - compliantCount;
    return { compliantCount, avgScore, flagged };
  }, [shipments]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filtered = filterStatus === "All" ? shipments : shipments.slice(0, 10);

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wl-text-primary">
          Carrier Compliance
        </h1>
        <p className="text-sm text-wl-text-secondary mt-0.5">
          {shipments.length} shipments monitored
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Compliant Shipments
              </span>
              <CheckCircle className="text-wl-success-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">
              {stats.compliantCount}
            </p>
            <p className="text-wl-text-tertiary text-xs mt-2">
              {stats.avgScore}% compliance rate
            </p>
          </div>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Avg. Score
              </span>
              <TrendingUp className="text-wl-info-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">
              {stats.avgScore}%
            </p>
            <p className="text-wl-text-tertiary text-xs mt-2">
              Overall compliance
            </p>
          </div>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Flagged Items
              </span>
              <AlertCircle className="text-wl-warning-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">
              {stats.flagged}
            </p>
            <p className="text-wl-text-tertiary text-xs mt-2">
              Requiring review
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-2">
          {(["All", "Active", "Inactive", "Suspended"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  filterStatus === status
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-bg-overlay text-wl-text-secondary hover:bg-wl-bg-elevated hover:text-wl-text-primary border border-wl-border-default",
                )}
              >
                {status}
              </button>
            ),
          )}
        </div>
        <Button variant="primary" size="md">
          Run Compliance Audit
        </Button>
      </div>

      {/* Compliance List */}
      {shipments.length === 0 ? (
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-12 text-center text-wl-text-tertiary">
            No shipments found
          </div>
        </Card>
      ) : (
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
              Compliance Status
            </h3>
            <div className="space-y-3">
              {filtered.slice(0, 15).map((shipment) => {
                const isCompliant =
                  shipment.status === "compliant" ||
                  shipment.status === "DELIVERED";
                const score =
                  shipment.complianceScore ?? (isCompliant ? 100 : 70);
                return (
                  <div
                    key={shipment.id}
                    className="flex items-center justify-between p-4 bg-wl-bg-overlay hover:bg-wl-bg-elevated rounded-lg transition-colors border border-wl-border-default"
                  >
                    <div>
                      <p className="text-sm font-semibold text-wl-text-primary">
                        {shipment.shipmentNumber ||
                          shipment.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-wl-text-tertiary">
                        {shipment.carrier || "Unknown Carrier"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-wl-text-primary">
                          {score}%
                        </p>
                        <p className="text-xs text-wl-text-tertiary">Score</p>
                      </div>
                      <Badge variant={isCompliant ? "success" : "warning"}>
                        {isCompliant ? "Compliant" : "Review"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
