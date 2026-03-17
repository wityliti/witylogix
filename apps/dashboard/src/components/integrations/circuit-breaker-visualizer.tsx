"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface StateTransition {
  from: CircuitBreakerState;
  to: CircuitBreakerState;
  count: number;
}

export interface HistorySegment {
  state: CircuitBreakerState;
  duration: number; // in minutes
  percentage: number; // percent of 24h
}

export interface CircuitBreakerVisualizerProps {
  currentState: CircuitBreakerState;
  transitions: StateTransition[];
  stateHistory: HistorySegment[];
  onReset?: () => void;
  className?: string;
}

export function CircuitBreakerVisualizer({
  currentState,
  transitions,
  stateHistory,
  onReset,
  className,
}: CircuitBreakerVisualizerProps) {
  const [isResetting, setIsResetting] = useState(false);

  const getStateColor = (state: CircuitBreakerState): string => {
    switch (state) {
      case "closed":
        return "var(--wl-success-500)";
      case "open":
        return "var(--wl-danger-500)";
      case "half-open":
        return "var(--wl-warning-500)";
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStateLabel = (state: CircuitBreakerState): string => {
    switch (state) {
      case "closed":
        return "Closed";
      case "open":
        return "Open";
      case "half-open":
        return "Half-Open";
      default:
        return "Unknown";
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onReset?.();
    } finally {
      setIsResetting(false);
    }
  };

  // SVG state machine diagram
  const svgWidth = 500;
  const svgHeight = 280;
  const radius = 50;
  const centerY = svgHeight / 2;

  // State positions
  const statePositions = {
    closed: { x: 80, y: centerY },
    "half-open": { x: 250, y: centerY - 60 },
    open: { x: 420, y: centerY },
  };

  const drawArrow = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    label: string,
    count: number
  ) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Shorten the line to not overlap with circles
    const startX = fromX + Math.cos(angle) * radius;
    const startY = fromY + Math.sin(angle) * radius;
    const endX = toX - Math.cos(angle) * radius;
    const endY = toY - Math.sin(angle) * radius;

    // Calculate control point for curve
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const perpX = -Math.sin(angle) * 30;
    const perpY = Math.cos(angle) * 30;

    return (
      <g key={`arrow-${label}`}>
        {/* Arrow line */}
        <path
          d={`M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
          stroke="var(--wl-border-subtle)"
          strokeWidth="2"
          fill="none"
        />
        {/* Arrow head */}
        <polygon
          points={`${endX},${endY} ${endX - 8 * Math.cos(angle - 0.3)},${endY - 8 * Math.sin(angle - 0.3)} ${endX - 8 * Math.cos(angle + 0.3)},${endY - 8 * Math.sin(angle + 0.3)}`}
          fill="var(--wl-border-subtle)"
        />
        {/* Label background */}
        <rect
          x={midX + perpX - 20}
          y={midY + perpY - 12}
          width="40"
          height="24"
          fill="white"
          stroke="var(--wl-border-subtle)"
          rx="4"
        />
        {/* Count label */}
        <text
          x={midX + perpX}
          y={midY + perpY + 5}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="var(--wl-text-primary)"
        >
          {count}
        </text>
      </g>
    );
  };

  // Get transition counts
  const getTransitionCount = (from: CircuitBreakerState, to: CircuitBreakerState): number => {
    const t = transitions.find((tr) => tr.from === from && tr.to === to);
    return t?.count || 0;
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Circuit Breaker State Machine
          </h3>
          {currentState === "open" && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                isResetting && "opacity-60 cursor-not-allowed"
              )}
            >
              {isResetting ? "Resetting..." : "Reset"}
            </button>
          )}
        </div>

        {/* State Machine Diagram */}
        <div className="mb-8 pb-8 border-b border-wl-border-subtle">
          <svg
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="mb-4"
          >
            {/* Transition arrows */}
            {drawArrow(
              statePositions.closed.x,
              statePositions.closed.y,
              statePositions.open.x,
              statePositions.open.y,
              "Closed→Open",
              getTransitionCount("closed", "open")
            )}
            {drawArrow(
              statePositions.open.x,
              statePositions.open.y,
              statePositions["half-open"].x,
              statePositions["half-open"].y,
              "Open→Half-Open",
              getTransitionCount("open", "half-open")
            )}
            {drawArrow(
              statePositions["half-open"].x,
              statePositions["half-open"].y,
              statePositions.closed.x,
              statePositions.closed.y,
              "Half-Open→Closed",
              getTransitionCount("half-open", "closed")
            )}
            {drawArrow(
              statePositions["half-open"].x - 20,
              statePositions["half-open"].y + 20,
              statePositions.open.x + 20,
              statePositions.open.y - 20,
              "Half-Open→Open",
              getTransitionCount("half-open", "open")
            )}

            {/* State circles */}
            {(["closed", "open", "half-open"] as const).map((state) => {
              const pos = statePositions[state];
              const isActive = currentState === state;
              const color = getStateColor(state);

              return (
                <g key={state}>
                  {/* Glow effect for active state */}
                  {isActive && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius + 8}
                      fill={color}
                      opacity="0.15"
                    />
                  )}
                  {/* Main circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={color}
                    opacity={isActive ? 1 : 0.3}
                  />
                  {/* Label */}
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill={isActive ? "white" : "var(--wl-text-secondary)"}
                  >
                    {getStateLabel(state)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Current state indicator */}
          <div className="flex items-center justify-center gap-3 p-4 bg-wl-surface-hover rounded">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStateColor(currentState) }}
            />
            <span className="text-sm font-semibold text-wl-text-primary">
              Current State: {getStateLabel(currentState)}
            </span>
          </div>
        </div>

        {/* State History Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-wl-text-primary mb-3">
            24-Hour State History
          </h4>
          <div className="flex h-6 rounded-full overflow-hidden border border-wl-border-subtle">
            {stateHistory.map((segment, idx) => (
              <div
                key={idx}
                className="transition-all hover:opacity-80"
                style={{
                  width: `${segment.percentage}%`,
                  backgroundColor: getStateColor(segment.state),
                  minWidth: segment.percentage > 2 ? "auto" : "2px",
                  opacity: 0.8,
                }}
                title={`${getStateLabel(segment.state)}: ${segment.duration}min (${segment.percentage.toFixed(1)}%)`}
              />
            ))}
          </div>

          {/* History legend */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            {(["closed", "open", "half-open"] as const).map((state) => {
              const segment = stateHistory.find((s) => s.state === state);
              return (
                <div key={state} className="p-3 rounded bg-wl-surface-hover border border-wl-border-subtle">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStateColor(state) }}
                    />
                    <span className="text-xs font-medium text-wl-text-secondary">
                      {getStateLabel(state)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-wl-text-primary">
                    {segment?.percentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-wl-text-secondary">
                    {segment?.duration || 0} min
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
