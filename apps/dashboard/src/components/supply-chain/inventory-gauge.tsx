"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "lucide-react";

interface InventoryGaugeProps {
  sku: string;
  current: number;
  max: number;
  reorderPoint: number;
  daysOfSupply: number;
  unit?: string;
  className?: string;
}

const getStockStatus = (
  current: number,
  max: number,
  reorderPoint: number
): { status: "critical" | "low" | "optimal" | "overstocked"; color: string } => {
  const percentage = (current / max) * 100;

  if (current <= reorderPoint) {
    return {
      status: "critical",
      color: "#ef4444",
    };
  } else if (percentage < 30) {
    return {
      status: "low",
      color: "#f97316",
    };
  } else if (percentage > 90) {
    return {
      status: "overstocked",
      color: "#f59e0b",
    };
  } else {
    return {
      status: "optimal",
      color: "#10b981",
    };
  }
};

const InventoryGauge = ({
  sku = "",
  current = 0,
  max = 100,
  reorderPoint = 0,
  daysOfSupply = 0,
  unit = "units",
  className,
}: InventoryGaugeProps) => {
  const percentage = (current / max) * 100;
  const { status, color } = getStockStatus(current, max, reorderPoint);
  const needsReorder = current <= reorderPoint;

  const getStatusLabel = () => {
    switch (status) {
      case "critical":
        return "Critical - Reorder Immediately";
      case "low":
        return "Low Stock";
      case "overstocked":
        return "Overstocked";
      case "optimal":
        return "Optimal";
    }
  };

  const getStatusVariant = (): "danger" | "warning" | "success" => {
    switch (status) {
      case "critical":
        return "danger";
      case "low":
        return "warning";
      case "overstocked":
        return "warning";
      case "optimal":
        return "success";
    }
  };

  return (
    <Card className={cn("w-full p-6", className)}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-wl-text-primary">
            Stock Level
          </h3>
          {needsReorder && (
            <Badge variant="danger" className="gap-1">
              <AlertTriangleIcon className="w-3 h-3" />
              Reorder Alert
            </Badge>
          )}
        </div>
        <p className="text-sm text-wl-text-tertiary">{sku}</p>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="relative w-48 h-48 flex items-center justify-center mb-4">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full"
            style={{
              filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))",
            }}
          >
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="33%" stopColor="#f97316" />
                <stop offset="66%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />

            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="8"
              strokeDasharray={`${(percentage / 100) * Math.PI * 180} ${Math.PI * 180}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "100px 100px",
              }}
            />

            <circle
              cx="100"
              cy="100"
              r="70"
              fill="#ffffff"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
              }}
            />

            <text
              x="100"
              y="85"
              textAnchor="middle"
              fontSize="32"
              fontWeight="bold"
              fill="#1f2937"
            >
              {percentage.toFixed(0)}%
            </text>
            <text
              x="100"
              y="105"
              textAnchor="middle"
              fontSize="12"
              fill="#6b7280"
            >
              of {max.toLocaleString()}
            </text>
          </svg>
        </div>

        <Badge variant={getStatusVariant()}>
          {getStatusLabel()}
        </Badge>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-wl-text-secondary">Current Stock</span>
          <span className="font-semibold text-wl-text-primary">
            {current.toLocaleString()} {unit}
          </span>
        </div>

        <div className="w-full h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
          <div
            className="h-full transition-all rounded-full"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-wl-text-tertiary">Reorder Point</p>
            <p className="font-semibold text-wl-text-primary">
              {reorderPoint.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-wl-text-tertiary">Max Capacity</p>
            <p className="font-semibold text-wl-text-primary">
              {max.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-wl-text-tertiary">Safety Stock</p>
            <p className="font-semibold text-wl-text-primary">
              {reorderPoint.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-wl-text-primary">
            Days of Supply
          </p>
          <p className="text-2xl font-bold text-wl-primary-400">
            {daysOfSupply}
          </p>
        </div>
        <p className="text-xs text-wl-text-tertiary">
          Estimated coverage based on average daily consumption
        </p>
      </div>

      {needsReorder && (
        <div className="mt-4 p-3 bg-wl-danger-500/10 border border-wl-danger-400/20 rounded-lg flex gap-3">
          <AlertTriangleIcon className="w-5 h-5 text-wl-danger-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-wl-danger-400">
              Reorder Recommended
            </p>
            <p className="text-xs text-wl-danger-400/80 mt-0.5">
              Current stock is below reorder point. Initiate purchase order to maintain
              inventory levels.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

export { InventoryGauge };
export type { InventoryGaugeProps };
