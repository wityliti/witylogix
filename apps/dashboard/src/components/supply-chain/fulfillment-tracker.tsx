"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PackageIcon,
  HandIcon,
  BoxIcon,
  TruckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "lucide-react";

interface FulfillmentStage {
  id: "received" | "picked" | "packed" | "shipped" | "delivered";
  label: string;
  count: number;
  icon: React.ReactNode;
}

interface FulfillmentTrackerProps {
  received?: number;
  picked?: number;
  packed?: number;
  shipped?: number;
  delivered?: number;
  slaTotalHours?: number;
  slaDueTime?: Date;
  isOverdue?: boolean;
  className?: string;
}

const FulfillmentTracker = ({
  received: receivedProp = 0,
  picked: pickedProp = 0,
  packed: packedProp = 0,
  shipped: shippedProp = 0,
  delivered: deliveredProp = 0,
  slaTotalHours = 48,
  slaDueTime = undefined,
  isOverdue = false,
  className,
}: FulfillmentTrackerProps) => {
  const received = receivedProp ?? 0;
  const picked = pickedProp ?? 0;
  const packed = packedProp ?? 0;
  const shipped = shippedProp ?? 0;
  const delivered = deliveredProp ?? 0;
  const stages: FulfillmentStage[] = [
    {
      id: "received",
      label: "Received",
      count: received,
      icon: <PackageIcon className="w-5 h-5" />,
    },
    {
      id: "picked",
      label: "Picked",
      count: picked,
      icon: <HandIcon className="w-5 h-5" />,
    },
    {
      id: "packed",
      label: "Packed",
      count: packed,
      icon: <BoxIcon className="w-5 h-5" />,
    },
    {
      id: "shipped",
      label: "Shipped",
      count: shipped,
      icon: <TruckIcon className="w-5 h-5" />,
    },
    {
      id: "delivered",
      label: "Delivered",
      count: delivered,
      icon: <CheckCircleIcon className="w-5 h-5" />,
    },
  ];

  const totalOrders = received;
  const completionPercentage =
    totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;

  const timeRemaining = slaDueTime
    ? Math.max(0, slaDueTime.getTime() - Date.now())
    : 0;
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor(
    (timeRemaining % (60 * 60 * 1000)) / (60 * 1000),
  );

  const getTimeStatus = (): "critical" | "warning" | "ok" => {
    const remainingHours = timeRemaining / (60 * 60 * 1000);
    if (isOverdue) return "critical";
    if (remainingHours < 4) return "critical";
    if (remainingHours < 12) return "warning";
    return "ok";
  };

  const timeStatus = getTimeStatus();

  const getProgressColor = () => {
    if (completionPercentage >= 80)
      return "from-wl-success-500 to-wl-success-400";
    if (completionPercentage >= 50) return "from-wl-info-500 to-wl-info-400";
    return "from-wl-primary-500 to-wl-primary-400";
  };

  return (
    <Card className={cn("w-full p-6 space-y-6", className)}>
      <div>
        <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
          Order Fulfillment Pipeline
        </h3>
        <p className="text-sm text-wl-text-tertiary">
          {totalOrders} total orders in process
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-wl-text-secondary">
            Progress: {completionPercentage}% Complete
          </p>
          {timeStatus === "critical" && (
            <Badge variant="danger" className="gap-1">
              <AlertTriangleIcon className="w-3 h-3" />
              SLA At Risk
            </Badge>
          )}
          {timeStatus === "warning" && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangleIcon className="w-3 h-3" />
              SLA Warning
            </Badge>
          )}
        </div>

        <div className="w-full h-3 bg-wl-bg-overlay rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all bg-gradient-to-r",
              getProgressColor(),
            )}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => {
          const percentage = (stage.count / totalOrders) * 100;
          const isActive = stage.count > 0;
          const isPast =
            index <
            stages.findIndex((s) => s.count > 0 || index === stages.length - 1);

          return (
            <div key={stage.id}>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    isActive
                      ? "bg-wl-primary-500/20 text-wl-primary-400"
                      : "bg-wl-bg-surface text-wl-text-tertiary",
                  )}
                >
                  {stage.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-wl-text-primary">
                    {stage.label}
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    {stage.count} orders
                  </p>
                </div>

                <p className="text-sm font-bold text-wl-text-primary flex-shrink-0">
                  {percentage.toFixed(0)}%
                </p>
              </div>

              <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all rounded-full",
                    isPast
                      ? "bg-wl-success-400"
                      : "bg-gradient-to-r from-wl-primary-500 to-wl-primary-400",
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
        <div>
          <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
            Backlog
          </p>
          <p className="text-2xl font-bold text-wl-warning-400">
            {received - delivered}
          </p>
        </div>

        <div>
          <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
            On-Time
          </p>
          <p className="text-2xl font-bold text-wl-success-400">
            {Math.max(0, delivered - Math.max(0, received - delivered))}
          </p>
        </div>

        <div>
          <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
            Delayed
          </p>
          <p className="text-2xl font-bold text-wl-danger-400">
            {Math.max(0, Math.round((received - delivered) * 0.1))}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "p-4 rounded-lg border flex gap-3",
          timeStatus === "critical"
            ? "bg-wl-danger-500/10 border-wl-danger-400/20"
            : timeStatus === "warning"
              ? "bg-wl-warning-500/10 border-wl-warning-400/20"
              : "bg-wl-success-500/10 border-wl-success-400/20",
        )}
      >
        <ClockIcon
          className={cn(
            "w-5 h-5 flex-shrink-0 mt-0.5",
            timeStatus === "critical"
              ? "text-wl-danger-400"
              : timeStatus === "warning"
                ? "text-wl-warning-400"
                : "text-wl-success-400",
          )}
        />

        <div className="flex-1">
          <p
            className={cn(
              "text-sm font-semibold mb-1",
              timeStatus === "critical"
                ? "text-wl-danger-400"
                : timeStatus === "warning"
                  ? "text-wl-warning-400"
                  : "text-wl-success-400",
            )}
          >
            SLA Timer {isOverdue ? "(Overdue)" : ""}
          </p>
          <p className="text-xs text-wl-text-secondary">
            {isOverdue ? (
              "SLA breach - immediate action required"
            ) : (
              <>
                {hoursRemaining}h {minutesRemaining}m remaining
                <br />
                Due:{" "}
                {slaDueTime?.toLocaleString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
};

export { FulfillmentTracker };
export type { FulfillmentTrackerProps };
