"use client";

import { useEffect, useRef } from "react";
import { Phone, MapPin, Clock, Zap, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DriverPopoverProps } from "./delivery-types";

/**
 * Driver Popover Component
 *
 * Floating popover displayed when a driver marker is clicked.
 * Shows:
 * - Driver avatar and name
 * - Status badge
 * - Current delivery address
 * - ETA countdown
 * - Current speed
 * - Phone (clickable to call)
 * - Action buttons: View Details, Reassign, Message
 */
export function DriverPopover({
  driver,
  delivery,
  position,
  onClose,
  onReassign,
  onMessage,
}: DriverPopoverProps) {
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calculate ETA countdown
  const etaMinutes = delivery?.eta
    ? Math.ceil((delivery.eta.getTime() - Date.now()) / 60000)
    : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "success";
      case "en-route":
        return "info";
      case "delivering":
        return "warning";
      case "offline":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      available: "Available",
      "en-route": "En Route",
      delivering: "Delivering",
      offline: "Offline",
    };
    return labels[status] || status;
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-50 w-80 rounded-lg shadow-2xl",
        "bg-wl-bg-elevated border border-wl-border-strong",
        "p-4 space-y-4",
      )}
      style={{
        left: `${Math.min(position.x, window.innerWidth - 340)}px`,
        top: `${Math.min(position.y - 200, window.innerHeight - 450)}px`,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={cn(
          "absolute top-3 right-3 p-1",
          "text-wl-text-secondary hover:text-wl-text-primary",
          "transition-colors",
        )}
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Driver Header */}
      <div className="flex items-start gap-3 pr-6">
        <img
          src={driver.photo}
          alt={driver.name}
          className={cn(
            "w-12 h-12 rounded-full flex-shrink-0",
            "border border-wl-border-default",
          )}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-wl-text-primary truncate">
            {driver.name}
          </h3>
          <Badge variant={getStatusColor(driver.status)} className="mt-1">
            {getStatusLabel(driver.status)}
          </Badge>
        </div>
      </div>

      {/* Current Delivery Info */}
      {delivery && (
        <div
          className={cn(
            "p-3 rounded-lg",
            "bg-wl-bg-surface border border-wl-border-default",
          )}
        >
          <p className="text-xs text-wl-text-secondary font-semibold mb-1 uppercase">
            Current Delivery
          </p>
          <p className="text-sm text-wl-text-primary mb-2 line-clamp-2">
            {delivery.dropoffAddress}
          </p>
          <p className="text-xs text-wl-text-secondary">
            Order #{delivery.orderId}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-2">
        {/* ETA */}
        {delivery && etaMinutes !== null && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-wl-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-wl-text-secondary">ETA</p>
              <p className="text-wl-text-primary font-semibold">
                {etaMinutes} min{etaMinutes !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        {/* Speed */}
        <div className="flex items-center gap-3 text-sm">
          <Zap className="w-4 h-4 text-wl-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-wl-text-secondary">Speed</p>
            <p className="text-wl-text-primary font-semibold">
              {driver.speed} km/h
            </p>
          </div>
        </div>

        {/* Phone */}
        <a
          href={`tel:${driver.phone}`}
          className={cn(
            "flex items-center gap-3 text-sm",
            "hover:bg-wl-bg-overlay rounded-md px-2 py-1.5 -mx-2",
            "transition-colors",
          )}
        >
          <Phone className="w-4 h-4 text-wl-success-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-wl-text-secondary">Phone</p>
            <p className="text-wl-text-primary font-semibold">{driver.phone}</p>
          </div>
        </a>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => {
            onClose();
            router.push(`/dashboard/drivers/${driver.id}`);
          }}
        >
          Details
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => {
            onClose();
            if (onReassign) {
              onReassign(driver.id);
            } else {
              router.push(`/dashboard/drivers/${driver.id}?action=reassign`);
            }
          }}
        >
          Reassign
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => {
            onClose();
            if (onMessage) {
              onMessage(driver.id);
            } else {
              router.push(`/dashboard/messages?driverId=${driver.id}`);
            }
          }}
        >
          Message
        </Button>
      </div>
    </div>
  );
}
