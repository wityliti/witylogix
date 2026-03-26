"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DriverScheduleSlot, ScheduleGridProps } from "./types";

/**
 * Driver schedule grid component
 * Rows: drivers, Columns: time slots (30-min intervals)
 * Color-coded cells by zone assignment with utilization indicator
 */
export function ScheduleGrid({
  slots,
  onSlotClick,
  className,
}: ScheduleGridProps) {
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Organize data by driver and time slot
  const { drivers, timeSlots, slotMap, zoneColors } = useMemo(() => {
    const driverMap = new Map<string, { name: string; slots: Map<number, DriverScheduleSlot> }>();

    // Group slots by driver
    slots.forEach((slot) => {
      if (!driverMap.has(slot.driverId)) {
        driverMap.set(slot.driverId, {
          name: slot.driverName,
          slots: new Map(),
        });
      }

      const timeSlotIndex = Math.floor(
        new Date(slot.timeSlot).getHours() * 2 + new Date(slot.timeSlot).getMinutes() / 30
      );
      const driver = driverMap.get(slot.driverId)!;
      driver.slots.set(timeSlotIndex, slot);
    });

    // Get unique time slots (hourly, 30-min intervals from 6 AM to 10 PM)
    const startHour = 6;
    const endHour = 22;
    const timeSlotLabels: string[] = [];

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        timeSlotLabels.push(time);
      }
    }

    // Generate unique colors for zones
    const uniqueZones = new Set(slots.map((s) => s.zoneId).filter(Boolean));
    const colors = [
      "rgb(59, 130, 246)",   // Blue
      "rgb(34, 197, 94)",    // Green
      "rgb(234, 179, 8)",    // Yellow
      "rgb(239, 68, 68)",    // Red
      "rgb(168, 85, 247)",   // Purple
      "rgb(236, 72, 153)",   // Pink
      "rgb(14, 165, 233)",   // Sky
      "rgb(249, 115, 22)",   // Orange
    ];

    const zoneColorMap = new Map<string, string>();
    let colorIndex = 0;
    uniqueZones.forEach((zone) => {
      if (zone) {
        zoneColorMap.set(zone, colors[colorIndex % colors.length]);
        colorIndex++;
      }
    });

    return {
      drivers: Array.from(driverMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        slots: data.slots,
      })),
      timeSlots: timeSlotLabels,
      slotMap: driverMap,
      zoneColors: zoneColorMap,
    };
  }, [slots]);

  const cellWidth = 80;
  const cellHeight = 45;
  const driverLabelWidth = 140;

  const headerHeight = 60;
  const svgWidth = driverLabelWidth + timeSlots.length * cellWidth;
  const svgHeight = headerHeight + drivers.length * cellHeight;

  const getSlotKey = (driverId: string, timeIndex: number): string => {
    return `${driverId}-${timeIndex}`;
  };

  const handleSlotHover = useCallback(
    (slot: DriverScheduleSlot | null, event?: React.MouseEvent) => {
      if (slot) {
        setHoveredSlotId(getSlotKey(slot.driverId, Math.floor(
          new Date(slot.timeSlot).getHours() * 2 + new Date(slot.timeSlot).getMinutes() / 30
        )));
        if (event) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        }
      } else {
        setHoveredSlotId(null);
      }
    },
    []
  );

  const handleSlotClick = useCallback(
    (slot: DriverScheduleSlot) => {
      onSlotClick?.(slot);
    },
    [onSlotClick]
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-4">
        {/* Grid */}
        <div className="overflow-auto border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-4">
          <svg width={svgWidth} height={svgHeight} className="bg-transparent">
            {/* Time slot headers */}
            {timeSlots.map((timeLabel, idx) => {
              const x = driverLabelWidth + idx * cellWidth;
              return (
                <g key={`time-header-${idx}`}>
                  <rect
                    x={x}
                    y={0}
                    width={cellWidth}
                    height={headerHeight}
                    fill="var(--wl-bg-elevated)"
                    stroke="var(--wl-border-subtle)"
                    strokeWidth="1"
                  />
                  <text
                    x={x + cellWidth / 2}
                    y={headerHeight / 2 + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="500"
                    fill="var(--wl-text-secondary)"
                  >
                    {timeLabel}
                  </text>
                </g>
              );
            })}

            {/* Driver rows and schedule cells */}
            {drivers.map((driver, driverIdx) => {
              const y = headerHeight + driverIdx * cellHeight;

              return (
                <g key={`driver-${driver.id}`}>
                  {/* Driver label cell */}
                  <rect
                    x={0}
                    y={y}
                    width={driverLabelWidth}
                    height={cellHeight}
                    fill="var(--wl-bg-elevated)"
                    stroke="var(--wl-border-subtle)"
                    strokeWidth="1"
                  />
                  <text
                    x={10}
                    y={y + cellHeight / 2 - 4}
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--wl-text-primary)"
                  >
                    {driver.name}
                  </text>

                  {/* Utilization indicator */}
                  {driver.slots.size > 0 && (
                    <text
                      x={10}
                      y={y + cellHeight / 2 + 12}
                      fontSize="10"
                      fill="var(--wl-text-tertiary)"
                    >
                      {driver.slots.size} slots assigned
                    </text>
                  )}

                  {/* Time slot cells */}
                  {timeSlots.map((_, timeIdx) => {
                    const cellX = driverLabelWidth + timeIdx * cellWidth;
                    const cellY = y;
                    const slot = driver.slots.get(timeIdx);
                    const slotKey = getSlotKey(driver.id, timeIdx);
                    const isHovered = hoveredSlotId === slotKey;

                    // Cell background
                    const cellBg = slot
                      ? zoneColors.get(slot.zoneId || "")
                      : "var(--wl-bg-surface)";
                    const cellOpacity = slot ? 0.6 : 0.3;
                    const cellStroke = isHovered
                      ? "var(--wl-primary-500)"
                      : "var(--wl-border-subtle)";
                    const strokeWidth = isHovered ? 2 : 1;

                    return (
                      <g key={slotKey}>
                        {/* Cell */}
                        <rect
                          x={cellX + 2}
                          y={cellY + 2}
                          width={cellWidth - 4}
                          height={cellHeight - 4}
                          fill={cellBg}
                          opacity={cellOpacity}
                          stroke={cellStroke}
                          strokeWidth={strokeWidth}
                          rx="2"
                          style={{
                            transition: "all 0.2s ease",
                            cursor: slot ? "pointer" : "default",
                          }}
                          onMouseEnter={(e) =>
                            slot && handleSlotHover(slot, e as any)
                          }
                          onMouseLeave={() => handleSlotHover(null)}
                          onClick={() => slot && handleSlotClick(slot)}
                        />

                        {/* Zone name or empty indicator */}
                        {slot ? (
                          <g>
                            <text
                              x={cellX + cellWidth / 2}
                              y={cellY + cellHeight / 2 - 4}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="var(--wl-text-inverse)"
                              pointerEvents="none"
                            >
                              {slot.zoneName?.substring(0, 8)}
                            </text>
                            <text
                              x={cellX + cellWidth / 2}
                              y={cellY + cellHeight / 2 + 8}
                              textAnchor="middle"
                              fontSize="8"
                              fill="var(--wl-text-inverse)"
                              opacity="0.8"
                              pointerEvents="none"
                            >
                              {Math.round(slot.utilizationRate * 100)}%
                            </text>
                          </g>
                        ) : (
                          <text
                            x={cellX + cellWidth / 2}
                            y={cellY + cellHeight / 2 + 2}
                            textAnchor="middle"
                            fontSize="9"
                            fill="var(--wl-text-tertiary)"
                            opacity="0.5"
                            pointerEvents="none"
                          >
                            -
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface">
          <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
            Zone Colors
          </p>
          <div className="flex flex-wrap gap-3">
            {Array.from(zoneColors.entries()).map(([zone, color]) => (
              <div key={zone} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: color, opacity: 0.6 }}
                />
                <span className="text-xs text-wl-text-tertiary">{zone || "Unassigned"}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-wl-text-tertiary mt-2">
            Cells show zone assignment and utilization rate. Empty slots (-) are available.
          </p>
        </div>

        {/* Tooltip */}
        {hoveredSlotId && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg p-3 z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y + 10}px`,
              maxWidth: "220px",
            }}
          >
            {slots.map((slot) => {
              if (getSlotKey(slot.driverId, Math.floor(
                new Date(slot.timeSlot).getHours() * 2 + new Date(slot.timeSlot).getMinutes() / 30
              )) !== hoveredSlotId) return null;

              return (
                <div key={getSlotKey(slot.driverId, 0)}>
                  <p className="text-sm font-semibold text-wl-text-primary">
                    {slot.driverName}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    Zone: {slot.zoneName || "Unassigned"}
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Time:{" "}
                    {new Date(slot.timeSlot).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Utilization: {Math.round(slot.utilizationRate * 100)}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
