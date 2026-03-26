"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Star, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PartnerCategory = "same-day" | "scheduled" | "freight";

interface CourierPartnerCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  category: PartnerCategory;
  logoUrl?: string;
  averageDeliveryTime: number; // minutes
  successRate: number; // 0-100
  activeDeliveries: number;
  rating: number; // 0-5
  totalRatings: number;
  coverageAreas: string[];
  onView: (id: string) => void;
  onDispatch: (id: string) => void;
}

const categoryLabels: Record<PartnerCategory, string> = {
  "same-day": "Same-Day",
  scheduled: "Scheduled",
  freight: "Freight",
};

const categoryColors: Record<PartnerCategory, string> = {
  "same-day": "bg-wl-success-500/20 text-wl-success-400",
  scheduled: "bg-wl-info-500/20 text-wl-info-400",
  freight: "bg-wl-warning-500/20 text-wl-warning-400",
};

const CourierPartnerCard = forwardRef<HTMLDivElement, CourierPartnerCardProps>(
  (
    {
      id,
      name,
      category,
      logoUrl,
      averageDeliveryTime,
      successRate,
      activeDeliveries,
      rating,
      totalRatings,
      coverageAreas,
      onView,
      onDispatch,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        className={cn("flex flex-col gap-4 hover:shadow-lg transition-shadow", className)}
        {...props}
      >
        {/* Header with logo and category */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {logoUrl ? (
              <div className="w-12 h-12 rounded-md bg-wl-bg-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
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
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 p-2 rounded-md bg-wl-bg-surface">
            <span className="text-xs text-wl-text-secondary font-medium uppercase">
              Avg Time
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {averageDeliveryTime} min
            </span>
          </div>
          <div className="flex flex-col gap-1 p-2 rounded-md bg-wl-bg-surface">
            <span className="text-xs text-wl-text-secondary font-medium uppercase">
              Success
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {successRate}%
            </span>
          </div>
          <div className="flex flex-col gap-1 p-2 rounded-md bg-wl-bg-surface">
            <span className="text-xs text-wl-text-secondary font-medium uppercase">
              Active
            </span>
            <span className="text-lg font-semibold text-wl-text-primary">
              {activeDeliveries}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-2 rounded-md bg-wl-bg-surface">
            <span className="text-xs text-wl-text-secondary font-medium uppercase">
              Status
            </span>
            <Badge variant="success" className="text-xs w-fit">
              Active
            </Badge>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-3 py-2">
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
            {rating.toFixed(1)} ({totalRatings} ratings)
          </span>
        </div>

        {/* Coverage areas */}
        {coverageAreas.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-wl-bg-surface">
            <MapPin className="w-4 h-4 text-wl-primary-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-wl-text-secondary mb-1 font-medium">
                Coverage Areas
              </p>
              <div className="flex flex-wrap gap-1">
                {coverageAreas.slice(0, 2).map((area, idx) => (
                  <Badge key={idx} variant="default" className="text-xs">
                    {area}
                  </Badge>
                ))}
                {coverageAreas.length > 2 && (
                  <Badge variant="default" className="text-xs">
                    +{coverageAreas.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-wl-border-subtle">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onView(id)}
          >
            View Details
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onDispatch(id)}
          >
            Dispatch
          </Button>
        </div>
      </Card>
    );
  }
);

CourierPartnerCard.displayName = "CourierPartnerCard";

export { CourierPartnerCard };
export type { CourierPartnerCardProps, PartnerCategory };
