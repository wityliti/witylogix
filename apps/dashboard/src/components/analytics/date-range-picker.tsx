"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DateRange, DateRangePreset } from "./types";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
  minDate?: Date;
  maxDate?: Date;
}

/**
 * Date range picker with preset options and custom range selection
 */
export function DateRangePicker({
  value,
  onChange,
  presets,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [tempStart, setTempStart] = useState(value.start.toISOString().split("T")[0]);
  const [tempEnd, setTempEnd] = useState(value.end.toISOString().split("T")[0]);
  const [dateError, setDateError] = useState<string | null>(null);

  // Default presets
  const defaultPresets: DateRangePreset[] = [
    {
      label: "Today",
      getValue: () => {
        const now = new Date();
        return { start: now, end: now };
      },
    },
    {
      label: "Yesterday",
      getValue: () => {
        const now = new Date();
        const yesterday = new Date(now.setDate(now.getDate() - 1));
        return { start: yesterday, end: yesterday };
      },
    },
    {
      label: "Last 7 days",
      getValue: () => {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        return { start, end };
      },
    },
    {
      label: "Last 30 days",
      getValue: () => {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 30);
        return { start, end };
      },
    },
    {
      label: "This month",
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start, end };
      },
    },
    {
      label: "Last month",
      getValue: () => {
        const now = new Date();
        const start = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end };
      },
    },
  ];

  const finalPresets = presets || defaultPresets;

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = preset.getValue();
    onChange(range);
    setMode("preset");
  };

  const handleCustomApply = () => {
    try {
      const start = new Date(tempStart);
      const end = new Date(tempEnd);

      if (start > end) {
        setDateError("Start date must be before end date");
        return;
      }

      setDateError(null);
      onChange({ start, end });
      setMode("preset");
    } catch {
      setDateError("Invalid date format");
    }
  };

  // Find matching preset
  const matchedPreset = useMemo(() => {
    const valueStart = value.start.toDateString();
    const valueEnd = value.end.toDateString();

    return finalPresets.find((p) => {
      const pRange = p.getValue();
      return (
        pRange.start.toDateString() === valueStart &&
        pRange.end.toDateString() === valueEnd
      );
    });
  }, [value, finalPresets]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="p-4 space-y-4">
      {/* Current range display */}
      <div className="flex items-center justify-between">
        <Badge variant="primary">
          {formatDate(value.start)} - {formatDate(value.end)}
        </Badge>
        {matchedPreset && (
          <span className="text-xs text-wl-text-tertiary">
            {matchedPreset.label}
          </span>
        )}
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {finalPresets.map((preset) => {
          const isActive =
            matchedPreset?.label === preset.label;
          return (
            <Button
              key={preset.label}
              variant={isActive ? "primary" : "ghost"}
              size="sm"
              onClick={() => handlePresetClick(preset)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {/* Custom range section */}
      <div className="space-y-3 pt-4 border-t border-wl-border-subtle">
        <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
          Custom Range
        </label>

        <div className="grid grid-cols-2 gap-3">
          {/* Start date */}
          <div>
            <label className="block text-xs text-wl-text-tertiary mb-1">
              From
            </label>
            <input
              type="date"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              min={minDate?.toISOString().split("T")[0]}
              max={maxDate?.toISOString().split("T")[0]}
              className={cn(
                "w-full px-3 py-2 rounded-md",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-wl-text-primary text-sm",
                "focus:outline-none focus:border-wl-border-focus",
                "transition-colors duration-fast"
              )}
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs text-wl-text-tertiary mb-1">
              To
            </label>
            <input
              type="date"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              min={minDate?.toISOString().split("T")[0]}
              max={maxDate?.toISOString().split("T")[0]}
              className={cn(
                "w-full px-3 py-2 rounded-md",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-wl-text-primary text-sm",
                "focus:outline-none focus:border-wl-border-focus",
                "transition-colors duration-fast"
              )}
            />
          </div>
        </div>

        {dateError && (
          <p className="text-xs text-wl-danger-400">{dateError}</p>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleCustomApply}
          className="w-full"
        >
          Apply Custom Range
        </Button>
      </div>
    </Card>
  );
}
