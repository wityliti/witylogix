"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface RouteColor {
  id: string;
  color: string;
  driverName: string;
  isVisible?: boolean;
}

export interface ColorLegendProps {
  routes: RouteColor[];
  onToggleRoute?: (routeId: string, isVisible: boolean) => void;
  className?: string;
  compact?: boolean;
}

export function ColorLegend({
  routes,
  onToggleRoute,
  className,
  compact = false,
}: ColorLegendProps) {
  const [visibilityState, setVisibilityState] = useState<
    Record<string, boolean>
  >(
    routes.reduce(
      (acc, route) => ({ ...acc, [route.id]: route.isVisible !== false }),
      {},
    ),
  );

  const handleToggle = (routeId: string) => {
    const newState = !visibilityState[routeId];
    setVisibilityState((prev) => ({ ...prev, [routeId]: newState }));
    onToggleRoute?.(routeId, newState);
  };

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {routes.map((route) => (
          <button
            key={route.id}
            onClick={() => handleToggle(route.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              "border border-wl-border-subtle transition-all duration-200",
              visibilityState[route.id]
                ? "bg-wl-bg-secondary border-wl-border-default"
                : "bg-wl-bg-secondary opacity-50 border-dashed",
            )}
            aria-pressed={visibilityState[route.id]}
            aria-label={`Toggle ${route.driverName} route`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: route.color }}
            />
            <span className="text-wl-text-secondary">{route.driverName}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default horizontal list layout
  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2">
        {routes.map((route) => (
          <button
            key={route.id}
            onClick={() => handleToggle(route.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg",
              "border border-wl-border-default transition-all duration-200",
              "hover:bg-wl-bg-secondary hover:border-wl-primary-500",
              visibilityState[route.id]
                ? "bg-wl-bg-elevated"
                : "bg-wl-bg-secondary opacity-50",
            )}
            aria-pressed={visibilityState[route.id]}
            aria-label={`Toggle ${route.driverName} route on map`}
          >
            {/* Color swatch */}
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 border-white shadow-md",
                "flex-shrink-0 transition-transform duration-200",
                visibilityState[route.id] &&
                  "ring-2 ring-offset-2 ring-wl-primary-500",
              )}
              style={{ backgroundColor: route.color }}
            />

            {/* Driver name and visibility indicator */}
            <div className="flex-1 text-left">
              <p className="font-medium text-wl-text-primary text-sm">
                {route.driverName}
              </p>
            </div>

            {/* Eye icon for visibility toggle */}
            <span className="text-wl-text-tertiary text-sm">
              {visibilityState[route.id] ? "👁️" : "🚫"}
            </span>
          </button>
        ))}
      </div>

      {/* Legend footer */}
      {routes.length > 0 && (
        <div className="mt-3 px-3 py-2 text-xs text-wl-text-tertiary bg-wl-bg-secondary rounded-lg border border-wl-border-subtle">
          Click to show/hide routes on map
        </div>
      )}
    </div>
  );
}
