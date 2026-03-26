"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import {
  ChevronDown,
  Wrench,
  Calendar,
  Gauge,
  Zap,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MaintenanceHistoryEvent {
  date: string;
  type: "preventive" | "reactive" | "predictive" | "recall";
  description: string;
  cost: number;
  vendor: string;
  duration: number; // minutes
}

interface VehicleHealthCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status: "active" | "maintenance" | "retired";
  healthScore: number; // 0-100
  mileage: number;
  lastServiceDate: string;
  nextServiceDue: string;
  maintenanceHistory?: MaintenanceHistoryEvent[];
  onClick?: (id: string) => void;
}

const getHealthColor = (score: number) => {
  if (score >= 80) return "text-wl-success-400";
  if (score >= 50) return "text-wl-warning-400";
  return "text-wl-danger-400";
};

const getHealthBadgeVariant = (score: number): "success" | "warning" | "danger" => {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
};

const getStatusBadgeVariant = (
  status: string
): "default" | "success" | "warning" | "danger" => {
  if (status === "active") return "success";
  if (status === "maintenance") return "warning";
  return "danger";
};

interface HealthGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function HealthGauge({ score, size = "md" }: HealthGaugeProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  const sizeMap = {
    sm: { radius: 45, textSize: "text-lg", width: 120, height: 120 },
    md: { radius: 60, textSize: "text-2xl", width: 160, height: 160 },
    lg: { radius: 75, textSize: "text-3xl", width: 200, height: 200 },
  };

  const config = sizeMap[size];

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={config.width} height={config.height} className="transform -rotate-90">
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={config.radius}
          stroke="var(--wl-bg-elevated)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={config.radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold", config.textSize)}>{score}</span>
        <span className="text-xs text-wl-text-secondary">Health</span>
      </div>
    </div>
  );
}

const VehicleHealthCard = forwardRef<HTMLDivElement, VehicleHealthCardProps>(
  (
    {
      id,
      name,
      make,
      model,
      year,
      vin,
      status,
      healthScore,
      mileage,
      lastServiceDate,
      nextServiceDue,
      maintenanceHistory,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const statusInfo = getStatusBadgeVariant(status);
    const lastServiceTime = new Date(lastServiceDate);
    const nextServiceTime = new Date(nextServiceDue);
    const daysUntilService = Math.ceil(
      (nextServiceTime.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    // Sort maintenance history by date (most recent first)
    const sortedHistory = [...(maintenanceHistory || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const maintenanceTypeColors = {
      preventive: "bg-wl-primary-500/20 text-wl-primary-400",
      reactive: "bg-wl-danger-500/20 text-wl-danger-400",
      predictive: "bg-wl-info-500/20 text-wl-info-400",
      recall: "bg-wl-warning-500/20 text-wl-warning-400",
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "flex flex-col gap-4 transition-all",
          onClick && "cursor-pointer hover:shadow-lg",
          className
        )}
        onClick={() => onClick?.(id)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-wl-text-primary">{name}</h3>
            <p className="text-xs text-wl-text-secondary">
              {make} {model} ({year})
            </p>
            <p className="text-xs text-wl-text-secondary font-mono mt-1">
              VIN: {vin}
            </p>
          </div>
          <Badge variant={statusInfo}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Health Gauge and Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          {/* Gauge */}
          <div className="flex justify-center">
            <HealthGauge score={healthScore} size="sm" />
          </div>

          {/* Metrics */}
          <div className="col-span-2 space-y-3">
            {/* Mileage */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-wl-bg-surface">
              <Gauge className="w-4 h-4 text-wl-primary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-wl-text-secondary">Mileage</p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {mileage.toLocaleString()} km
                </p>
              </div>
            </div>

            {/* Last Service */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-wl-bg-surface">
              <Wrench className="w-4 h-4 text-wl-success-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-wl-text-secondary">Last Service</p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {lastServiceTime.toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Next Due */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-wl-bg-surface">
              <Calendar className="w-4 h-4 text-wl-warning-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-wl-text-secondary">Next Due</p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {daysUntilService > 0
                    ? `In ${daysUntilService} days`
                    : "Overdue"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Section */}
        {maintenanceHistory && maintenanceHistory.length > 0 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center justify-between text-sm text-wl-text-primary hover:text-wl-primary-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Maintenance History ({sortedHistory.length})
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "transform rotate-180"
                )}
              />
            </button>

            {isExpanded && (
              <div className="pt-2 border-t border-wl-border-subtle space-y-2">
                {/* Timeline */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sortedHistory.slice(0, 5).map((event, idx) => (
                    <div
                      key={`${event.date}-${idx}`}
                      className="flex gap-3 text-xs"
                    >
                      <div className="flex flex-col items-center flex-shrink-0 pt-1">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            event.type === "preventive"
                              ? "bg-wl-primary-400"
                              : event.type === "reactive"
                                ? "bg-wl-danger-400"
                                : event.type === "predictive"
                                  ? "bg-wl-info-400"
                                  : "bg-wl-warning-400"
                          )}
                        />
                        {idx < sortedHistory.length - 1 && (
                          <div className="w-0.5 h-6 bg-wl-border-subtle" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-wl-text-primary">
                            {event.type.charAt(0).toUpperCase() +
                              event.type.slice(1)}
                          </span>
                          <Badge
                            variant="default"
                            className={cn(
                              "text-xs py-0.5",
                              maintenanceTypeColors[event.type]
                            )}
                          >
                            ${event.cost}
                          </Badge>
                        </div>
                        <p className="text-wl-text-secondary">
                          {event.description}
                        </p>
                        <p className="text-wl-text-secondary mt-1">
                          {event.vendor} • {event.duration}m •{" "}
                          {new Date(event.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fuel Efficiency Sparkline */}
                <div className="pt-2 mt-2 border-t border-wl-border-subtle">
                  <p className="text-xs text-wl-text-secondary font-semibold mb-2">
                    Fuel Efficiency Trend
                  </p>
                  <svg
                    width="100%"
                    height="40"
                    viewBox="0 0 200 40"
                    className="text-wl-primary-400"
                  >
                    <polyline
                      points="5,35 25,30 45,28 65,25 85,32 105,20 125,25 145,18 165,28 185,15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    );
  }
);

VehicleHealthCard.displayName = "VehicleHealthCard";

export { VehicleHealthCard };
export type { VehicleHealthCardProps, MaintenanceHistoryEvent };
