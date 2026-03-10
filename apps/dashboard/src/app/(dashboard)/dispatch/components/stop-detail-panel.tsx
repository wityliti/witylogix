"use client";

import { X, MapPin, Phone, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Stop, StopStatus } from "@witylogix/core/dispatch";

interface StopDetailPanelProps {
  stop: Stop | null;
  onClose?: () => void;
  onReassign?: (stopId: string) => void;
  onSkip?: (stopId: string) => void;
  onPrioritize?: (stopId: string) => void;
}

const STATUS_BADGE_VARIANT: Record<StopStatus, "default" | "info" | "success" | "warning" | "danger"> = {
  pending: "info",
  en_route: "warning",
  arrived: "warning",
  completed: "success",
  skipped: "default",
  failed: "danger",
};

const STATUS_ICON: Record<StopStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  en_route: <AlertCircle className="w-4 h-4" />,
  arrived: <MapPin className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  skipped: <X className="w-4 h-4" />,
  failed: <AlertCircle className="w-4 h-4" />,
};

export function StopDetailPanel({
  stop,
  onClose,
  onReassign,
  onSkip,
  onPrioritize,
}: StopDetailPanelProps) {
  if (!stop) {
    return null;
  }

  const formatTime = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="sticky top-24 h-fit">
      <CardContent className="p-6 space-y-6">
        {/* Header with close button */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary">
              Stop #{stop.sequence}
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">
              Order: {stop.orderId || "N/A"}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div className="text-wl-text-tertiary">
            {STATUS_ICON[stop.status]}
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[stop.status]}>
            {stop.status.replace("_", " ")}
          </Badge>
        </div>

        {/* Customer info */}
        <div className="border-t border-wl-border-subtle pt-4">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
            Customer
          </p>
          <div className="space-y-2">
            {stop.customerName && (
              <p className="text-sm font-medium text-wl-text-primary">
                {stop.customerName}
              </p>
            )}
            {stop.customerPhone && (
              <a
                href={`tel:${stop.customerPhone}`}
                className="flex items-center gap-2 text-sm text-wl-primary-400 hover:text-wl-primary-300 transition-colors"
              >
                <Phone className="w-4 h-4" />
                {stop.customerPhone}
              </a>
            )}
          </div>
        </div>

        {/* Delivery address */}
        <div className="border-t border-wl-border-subtle pt-4">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
            Delivery Address
          </p>
          <div className="flex gap-3">
            <MapPin className="w-4 h-4 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-wl-text-primary">
                {stop.address}
              </p>
              <p className="text-xs text-wl-text-secondary">
                {stop.city}, {stop.postalCode}
              </p>
              <p className="text-xs text-wl-text-tertiary">
                Lat: {stop.latitude.toFixed(4)}, Lng: {stop.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* Time information */}
        <div className="border-t border-wl-border-subtle pt-4">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
            Timeline
          </p>
          <div className="space-y-2 text-sm">
            {stop.timeWindowStart && stop.timeWindowEnd && (
              <div>
                <p className="text-xs text-wl-text-secondary mb-1">Time Window</p>
                <p className="text-wl-text-primary">
                  {formatTime(stop.timeWindowStart)} - {formatTime(stop.timeWindowEnd)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">Est. Arrival</p>
              <p className="text-wl-text-primary">
                {formatTime(stop.estimatedArrival)}
              </p>
            </div>
            {stop.actualArrival && (
              <div>
                <p className="text-xs text-wl-text-secondary mb-1">Actual Arrival</p>
                <p className="text-wl-success-400">
                  {formatTime(stop.actualArrival)}
                </p>
              </div>
            )}
            {stop.departedAt && (
              <div>
                <p className="text-xs text-wl-text-secondary mb-1">Departed</p>
                <p className="text-wl-text-primary">
                  {formatTime(stop.departedAt)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {stop.notes && (
          <div className="border-t border-wl-border-subtle pt-4">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
              Notes
            </p>
            <p className="text-sm text-wl-text-secondary bg-wl-bg-overlay rounded p-2">
              {stop.notes}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-wl-border-subtle pt-4 space-y-2">
          {stop.status !== "completed" && stop.status !== "skipped" && (
            <>
              {onReassign && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => onReassign(stop.id)}
                >
                  Reassign to Another Route
                </Button>
              )}

              {onPrioritize && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => onPrioritize(stop.id)}
                >
                  Make Priority
                </Button>
              )}

              {onSkip && (
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => onSkip(stop.id)}
                >
                  Skip Stop
                </Button>
              )}
            </>
          )}
        </div>

        {/* Metadata */}
        <div className="border-t border-wl-border-subtle pt-4">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
            Details
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-wl-text-secondary">Created</span>
              <span className="text-wl-text-primary">
                {formatDate(stop.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-wl-text-secondary">Updated</span>
              <span className="text-wl-text-primary">
                {formatDate(stop.updatedAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-wl-text-secondary">Stop Type</span>
              <span className="text-wl-text-primary capitalize">
                {stop.stopType}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
