"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Star, MapPin, CheckCircle, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PartnerStatus = "active" | "pending" | "inactive";
type PartnerCategory = "courier" | "freight" | "same-day" | "scheduled";

interface PartnerCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  category: PartnerCategory;
  status: PartnerStatus;
  logoUrl?: string;
  averageDeliveryTime: number;
  successRate: number;
  activeDeliveries: number;
  rating: number;
  totalRatings: number;
  onViewDetails: (id: string) => void;
  onConfigure: (id: string) => void;
}

const categoryLabels: Record<PartnerCategory, string> = {
  courier: "Courier",
  freight: "Freight",
  "same-day": "Same-Day",
  scheduled: "Scheduled",
};

const categoryColors: Record<PartnerCategory, string> = {
  courier: "bg-wl-primary-500/20 text-wl-primary-400",
  freight: "bg-wl-info-500/20 text-wl-info-400",
  "same-day": "bg-wl-success-500/20 text-wl-success-400",
  scheduled: "bg-wl-warning-500/20 text-wl-warning-400",
};

const statusConfig: Record<
  PartnerStatus,
  { icon: any; label: string; color: string }
> = {
  active: {
    icon: CheckCircle,
    label: "Active",
    color: "text-wl-success-400 bg-wl-success-bg",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-wl-warning-400 bg-wl-warning-bg",
  },
  inactive: {
    icon: Package,
    label: "Inactive",
    color: "text-wl-neutral-400 bg-wl-neutral-500/12",
  },
};

const PartnerCard = forwardRef<HTMLDivElement, PartnerCardProps>(
  (
    {
      id,
      name,
      category,
      status,
      logoUrl,
      averageDeliveryTime,
      successRate,
      activeDeliveries,
      rating,
      totalRatings,
      onViewDetails,
      onConfigure,
      className,
      ...props
    },
    ref
  ) => {
    const statusInfo = statusConfig[status];
    const StatusIcon = statusInfo.icon;

    return (
      <Card
        ref={ref}
        className={cn("flex flex-col gap-4 hover:shadow-lg", className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {logoUrl ? (
              <div className="w-12 h-12 rounded-md bg-wl-bg-surface flex items-center justify-center flex-shrink-0">
                <img
                  src={logoUrl}
                  alt={name}
                  className="w-10 h-10 object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-md bg-gradient-to-br from-wl-primary-500 to-wl-primary-600 flex items-center justify-center flex-shrink-0 text-wl-text-inverse font-bold text-sm">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-wl-text-primary truncate">
                {name}
              </h3>
              <span
                className={cn(
                  "inline-block text-xs font-medium rounded px-2 py-1 mt-1",
                  categoryColors[category]
                )}
              >
                {categoryLabels[category]}
              </span>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0",
              statusInfo.color
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {statusInfo.label}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-wl-text-secondary uppercase tracking-wide">
              Avg Time
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {averageDeliveryTime}m
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-wl-text-secondary uppercase tracking-wide">
              Success Rate
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {successRate}%
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-wl-text-secondary uppercase tracking-wide">
              Active
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {activeDeliveries}
            </span>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-4 h-4",
                  i < Math.floor(rating)
                    ? "fill-wl-warning-400 text-wl-warning-400"
                    : "text-wl-border-subtle"
                )}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-wl-text-secondary">
            {rating.toFixed(1)} ({totalRatings})
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-wl-border-subtle">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails(id)}
          >
            View Details
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onConfigure(id)}
          >
            Configure
          </Button>
        </div>
      </Card>
    );
  }
);

PartnerCard.displayName = "PartnerCard";

export { PartnerCard };
export type { PartnerCardProps, PartnerStatus, PartnerCategory };
