"use client";

import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Navigation,
  Radio,
  Map,
  Mountain,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MapControlsProps } from "./delivery-types";

/**
 * Map Controls Component
 *
 * Control panel for map interactions:
 * - Layer toggles: traffic, satellite, terrain (radio buttons)
 * - Zoom in/out buttons
 * - Fullscreen toggle
 * - Center on all drivers button
 * - Center on selected driver button
 * - Map legend
 */
export function MapControls({
  currentLayer,
  onLayerChange,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  onCenterAll,
  onCenterSelected,
}: MapControlsProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2",
      "bg-wl-bg-elevated border border-wl-border-default",
      "rounded-lg p-2 shadow-lg"
    )}>
      {/* Layer Controls */}
      <div className={cn(
        "flex flex-col gap-1 pb-2 border-b border-wl-border-default",
        "space-y-1"
      )}>
        <p className="text-xs text-wl-text-secondary font-semibold px-2 py-1">
          LAYER
        </p>

        <button
          onClick={() => onLayerChange("street")}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded text-sm",
            "transition-all duration-200",
            currentLayer === "street"
              ? "bg-wl-primary-500/20 text-wl-primary-400"
              : "text-wl-text-secondary hover:bg-wl-bg-overlay"
          )}
        >
          <Map className="w-4 h-4" />
          <span>Street</span>
        </button>

        <button
          onClick={() => onLayerChange("satellite")}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded text-sm",
            "transition-all duration-200",
            currentLayer === "satellite"
              ? "bg-wl-primary-500/20 text-wl-primary-400"
              : "text-wl-text-secondary hover:bg-wl-bg-overlay"
          )}
        >
          <Radio className="w-4 h-4" />
          <span>Satellite</span>
        </button>

        <button
          onClick={() => onLayerChange("terrain")}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded text-sm",
            "transition-all duration-200",
            currentLayer === "terrain"
              ? "bg-wl-primary-500/20 text-wl-primary-400"
              : "text-wl-text-secondary hover:bg-wl-bg-overlay"
          )}
        >
          <Mountain className="w-4 h-4" />
          <span>Terrain</span>
        </button>
      </div>

      {/* Zoom Controls */}
      <div className={cn(
        "flex flex-col gap-1 pb-2 border-b border-wl-border-default"
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="w-full justify-start"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
          <span className="ml-2">Zoom In</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          className="w-full justify-start"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
          <span className="ml-2">Zoom Out</span>
        </Button>
      </div>

      {/* Navigation Controls */}
      <div className={cn(
        "flex flex-col gap-1 pb-2 border-b border-wl-border-default"
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCenterAll}
          className="w-full justify-start"
          title="Center on all drivers"
        >
          <Navigation className="w-4 h-4" />
          <span className="ml-2">Center All</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCenterSelected}
          className="w-full justify-start"
          title="Center on selected driver"
        >
          <Navigation className="w-4 h-4 rotate-45" />
          <span className="ml-2">Center Selected</span>
        </Button>
      </div>

      {/* Fullscreen */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onFullscreen}
        className="w-full justify-start"
        title="Toggle fullscreen"
      >
        <Maximize className="w-4 h-4" />
        <span className="ml-2">Fullscreen</span>
      </Button>
    </div>
  );
}
