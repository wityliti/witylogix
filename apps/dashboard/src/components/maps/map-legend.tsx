"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Map Legend Component
 *
 * Shows the color legend for:
 * - Driver status colors
 * - Delivery point types
 * - Route line types
 */
export function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-default",
        "rounded-lg shadow-lg overflow-hidden",
        "max-w-xs",
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between",
          "text-sm font-semibold text-wl-text-primary",
          "hover:bg-wl-bg-overlay transition-colors",
        )}
      >
        <span>Legend</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {/* Legend Content */}
      {isOpen && (
        <div className="px-4 py-3 space-y-4 border-t border-wl-border-default">
          {/* Driver Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-wl-text-secondary uppercase">
              Driver Status
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-success-400" />
                <span className="text-wl-text-secondary">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-info-400" />
                <span className="text-wl-text-secondary">En Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-warning-400" />
                <span className="text-wl-text-secondary">Delivering</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-neutral-400" />
                <span className="text-wl-text-secondary">Offline</span>
              </div>
            </div>
          </div>

          {/* Delivery Points */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-wl-text-secondary uppercase">
              Delivery Points
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-wl-info-400 rotate-45" />
                <span className="text-wl-text-secondary">Pickup</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-success-400" />
                <span className="text-wl-text-secondary">Dropoff</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-wl-success-400 relative flex items-center justify-center">
                  <span className="text-xs text-wl-bg-surface">✓</span>
                </div>
                <span className="text-wl-text-secondary">Completed</span>
              </div>
            </div>
          </div>

          {/* Routes */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-wl-text-secondary uppercase">
              Routes
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-0.5 bg-wl-info-400"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, currentColor 0, currentColor 2px, transparent 2px, transparent 6px)",
                  }}
                />
                <span className="text-wl-text-secondary">Planned</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-wl-success-400" />
                <span className="text-wl-text-secondary">Completed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

MapLegend.displayName = "MapLegend";
