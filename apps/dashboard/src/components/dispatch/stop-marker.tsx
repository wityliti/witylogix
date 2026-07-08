"use client";

import { cn } from "@/lib/utils";

export type MarkerSize = "small" | "large";

export interface StopMarkerProps {
  number: number;
  color: string;
  isNext?: boolean;
  isDelivered?: boolean;
  size?: MarkerSize;
  className?: string;
}

const sizeClasses: Record<MarkerSize, { container: string; text: string }> = {
  small: {
    container: "w-8 h-8",
    text: "text-xs",
  },
  large: {
    container: "w-12 h-12",
    text: "text-lg",
  },
};

export function StopMarker({
  number,
  color,
  isNext = false,
  isDelivered = false,
  size = "small",
  className,
}: StopMarkerProps) {
  const sizeConfig = sizeClasses[size];
  const checkIcon = "✓";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-full font-bold font-mono",
        "border-2 border-white shadow-lg",
        "transition-all duration-200",
        isNext && "ring-4 ring-offset-2 animate-pulse",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <div
        className={cn(
          "flex items-center justify-center text-white",
          sizeConfig.container,
        )}
      >
        {isDelivered ? (
          <span className={cn("font-bold", sizeConfig.text)}>{checkIcon}</span>
        ) : (
          <span className={cn(sizeConfig.text)}>{number}</span>
        )}
      </div>

      {/* Next delivery pulse animation */}
      {isNext && (
        <div
          className="absolute inset-0 rounded-full border-2 border-white opacity-50"
          style={{
            animation: "pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      )}

      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 1;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
