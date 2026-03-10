"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TooltipRenderFn } from "./types";

interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  data: any;
  renderContent: TooltipRenderFn;
  offset?: number;
}

/**
 * Reusable tooltip component for charts
 * Positions relative to cursor with auto-flip when near edges
 */
export function ChartTooltip({
  visible,
  x,
  y,
  data,
  renderContent,
  offset = 12,
}: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible || !tooltipRef.current) {
      return;
    }

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = y + offset;
    let left = x + offset;

    // Flip horizontally if too close to right edge
    if (left + rect.width > viewportWidth - 10) {
      left = x - rect.width - offset;
    }

    // Flip vertically if too close to bottom edge
    if (top + rect.height > viewportHeight - 10) {
      top = y - rect.height - offset;
    }

    setPosition({ top, left });
  }, [visible, x, y, offset]);

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-50 pointer-events-none",
        "bg-wl-bg-elevated border border-wl-border-default rounded-md",
        "shadow-lg p-2 text-xs",
        "transition-opacity duration-fast ease-default",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="text-wl-text-primary">
        {renderContent(data)}
      </div>
    </div>
  );
}
