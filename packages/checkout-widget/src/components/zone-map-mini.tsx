"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ZoneMapMiniProps {
  zoneName: string;
  zoneColor?: string;
  isInZone?: boolean;
  zonePolygonCoords?: Array<{ lat: number; lng: number }>;
  customerLat?: number;
  customerLng?: number;
  className?: string;
}

export function ZoneMapMini({
  zoneName,
  zoneColor = "#3b82f6",
  isInZone = true,
  zonePolygonCoords,
  customerLat,
  customerLng,
  className,
}: ZoneMapMiniProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Map container */}
      <div
        className={cn(
          "relative w-full rounded-lg overflow-hidden border-2",
          "bg-wl-bg-secondary",
          isInZone ? "border-wl-success-300" : "border-wl-danger-300"
        )}
        style={{ aspectRatio: "16 / 9", minHeight: "120px" }}
      >
        {/* SVG Map visualization */}
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {/* Zone polygon */}
          {zonePolygonCoords && zonePolygonCoords.length > 0 && (
            <polygon
              points={zonePolygonCoords
                .map((coord) => {
                  // Normalize coordinates to 0-100 range (simplified)
                  const x = ((coord.lng + 180) % 360) * (100 / 360);
                  const y = ((coord.lat + 90) % 180) * (100 / 180);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill={zoneColor}
              opacity="0.2"
              stroke={zoneColor}
              strokeWidth="0.5"
            />
          )}

          {/* Generic zone representation */}
          {(!zonePolygonCoords || zonePolygonCoords.length === 0) && (
            <>
              <circle cx="50" cy="50" r="35" fill={zoneColor} opacity="0.15" />
              <circle cx="50" cy="50" r="35" fill="none" stroke={zoneColor} strokeWidth="0.5" />
            </>
          )}

          {/* Customer location marker */}
          {customerLat !== undefined && customerLng !== undefined && (
            <g>
              {/* Pin marker */}
              <circle
                cx={((customerLng + 180) % 360) * (100 / 360)}
                cy={((customerLat + 90) % 180) * (100 / 180)}
                r="2"
                fill="#ef4444"
              />
              {/* Glow effect */}
              <circle
                cx={((customerLng + 180) % 360) * (100 / 360)}
                cy={((customerLat + 90) % 180) * (100 / 180)}
                r="4"
                fill="none"
                stroke="#ef4444"
                strokeWidth="0.5"
                opacity="0.5"
              />
            </g>
          )}
        </svg>

        {/* Status indicator overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-wl-bg-primary/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <span
            className={cn("w-2 h-2 rounded-full", isInZone ? "bg-wl-success-500" : "bg-wl-danger-500")}
          />
          <span className="text-xs font-medium text-wl-text-secondary">
            {isInZone ? "In Zone" : "Out of Zone"}
          </span>
        </div>
      </div>

      {/* Zone label and info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: zoneColor }}
          />
          <p className="font-semibold text-sm text-wl-text-primary">{zoneName}</p>
        </div>
        <p className="text-xs text-wl-text-tertiary">
          {isInZone
            ? "You're in the delivery zone. Great! We deliver to your area."
            : "This location is outside our delivery zone."}
        </p>
      </div>
    </div>
  );
}
