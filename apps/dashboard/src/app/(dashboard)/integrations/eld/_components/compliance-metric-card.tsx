"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface ComplianceMetric {
  metric: string;
  value: number;
  target: number;
  status: "compliant" | "warning" | "violation";
}

interface ComplianceMetricCardProps {
  metric: ComplianceMetric;
}

export function ComplianceMetricCard({ metric }: ComplianceMetricCardProps) {
  const difference = metric.value - metric.target;
  const percentage = (metric.value / 100) * 100;

  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-white">
            {metric.metric}
          </h3>
          <Badge
            variant={metric.status === "compliant" ? "success" : "warning"}
            className={cn(
              metric.status === "compliant"
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400",
            )}
          >
            {metric.status}
          </Badge>
        </div>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <p className="text-3xl font-bold text-white">{metric.value}%</p>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Target: {metric.target}%
            </p>
          </div>
          {difference >= 0 ? (
            <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />+{difference}%
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-400 text-sm font-semibold">
              <TrendingUp className="w-4 h-4 rotate-180" />
              {difference}%
            </div>
          )}
        </div>

        <div className="w-full h-2 bg-wl-bg-surface rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              metric.status === "compliant"
                ? "bg-gradient-to-r from-green-500 to-green-400"
                : "bg-gradient-to-r from-yellow-500 to-yellow-400",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
