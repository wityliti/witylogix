"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Zap,
  RotateCw,
  Calendar,
  Play,
  Pause,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   SYNC SCHEDULE CONFIG — Schedule & direction settings
   ═══════════════════════════════════════════════════════════ */

interface SyncSchedule {
  interval: "realtime" | "5m" | "15m" | "30m" | "1h" | "daily";
  direction: "inbound" | "outbound" | "bidirectional";
  concurrencyLimit: number;
  nextSyncAt: string;
  paused: boolean;
}

interface SyncScheduleConfigProps {
  schedule: SyncSchedule;
  onScheduleChange: (schedule: SyncSchedule) => void;
  platformName: string;
}

const INTERVAL_OPTIONS = [
  {
    id: "realtime",
    name: "Real-time",
    description: "Sync as changes occur",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: "5m",
    name: "5 Minutes",
    description: "Every 5 minutes",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: "15m",
    name: "15 Minutes",
    description: "Every 15 minutes",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: "30m",
    name: "30 Minutes",
    description: "Every 30 minutes",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: "1h",
    name: "1 Hour",
    description: "Every hour",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: "daily",
    name: "Daily",
    description: "Once per day (UTC midnight)",
    icon: <Calendar className="w-5 h-5" />,
  },
];

const DIRECTION_OPTIONS = [
  {
    id: "inbound",
    name: "Inbound Only",
    description: "Pull from platform to Witylogix",
    icon: <ArrowDown className="w-5 h-5" />,
  },
  {
    id: "bidirectional",
    name: "Bidirectional",
    description: "Sync both directions",
    icon: <ArrowRightLeft className="w-5 h-5" />,
  },
  {
    id: "outbound",
    name: "Outbound Only",
    description: "Push from Witylogix to platform",
    icon: <ArrowUp className="w-5 h-5" />,
  },
];

export function SyncScheduleConfig({
  schedule,
  onScheduleChange,
  platformName,
}: SyncScheduleConfigProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextSync = new Date(schedule.nextSyncAt);
      const diff = nextSync.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Syncing now...");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeRemaining(`in ${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setTimeRemaining(`in ${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`in ${seconds}s`);
        }
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [schedule.nextSyncAt]);

  const handleIntervalChange = (interval: SyncSchedule["interval"]) => {
    onScheduleChange({
      ...schedule,
      interval,
    });
  };

  const handleDirectionChange = (direction: SyncSchedule["direction"]) => {
    onScheduleChange({
      ...schedule,
      direction,
    });
  };

  const handleConcurrencyChange = (concurrency: number) => {
    onScheduleChange({
      ...schedule,
      concurrencyLimit: concurrency,
    });
  };

  const handleTogglePause = () => {
    onScheduleChange({
      ...schedule,
      paused: !schedule.paused,
    });
  };

  return (
    <div className="space-y-6">
      {/* Pause/Resume Status */}
      <div className="p-4 rounded-lg border-2 flex items-center justify-between bg-wl-bg-surface border-wl-border-subtle">
        <div className="flex items-center gap-3">
          {schedule.paused ? (
            <>
              <Pause className="w-5 h-5 text-wl-warning-500" />
              <div>
                <p className="font-semibold text-wl-text-primary">
                  Sync Paused
                </p>
                <p className="text-sm text-wl-text-secondary">
                  No syncs will occur until resumed
                </p>
              </div>
            </>
          ) : (
            <>
              <RotateCw className="w-5 h-5 text-wl-success-500 animate-spin" />
              <div>
                <p className="font-semibold text-wl-text-primary">
                  Syncing Active
                </p>
                <p className="text-sm text-wl-text-secondary">
                  Next sync {timeRemaining}
                </p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleTogglePause}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-all",
            schedule.paused
              ? "bg-wl-success-500/20 text-wl-success-600 hover:bg-wl-success-500/30"
              : "bg-wl-warning-500/20 text-wl-warning-600 hover:bg-wl-warning-500/30",
          )}
        >
          {schedule.paused ? (
            <>
              <Play className="w-4 h-4 inline-block mr-2" />
              Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 inline-block mr-2" />
              Pause
            </>
          )}
        </button>
      </div>

      {/* Sync Interval */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-3">
          Sync Interval
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() =>
                handleIntervalChange(option.id as SyncSchedule["interval"])
              }
              className={cn(
                "p-3 rounded-lg border-2 transition-all text-center",
                schedule.interval === option.id
                  ? "border-wl-primary-500 bg-wl-primary-500/10"
                  : "border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-border-default",
              )}
            >
              <div className="flex items-center justify-center mb-2">
                {option.icon}
              </div>
              <p className="font-semibold text-sm text-wl-text-primary">
                {option.name}
              </p>
              <p className="text-xs text-wl-text-secondary mt-1">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Sync Direction */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-3">
          Sync Direction
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {DIRECTION_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() =>
                handleDirectionChange(option.id as SyncSchedule["direction"])
              }
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-center",
                schedule.direction === option.id
                  ? "border-wl-primary-500 bg-wl-primary-500/10"
                  : "border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-border-default",
              )}
            >
              <div className="flex items-center justify-center mb-2">
                {option.icon}
              </div>
              <p className="font-semibold text-sm text-wl-text-primary">
                {option.name}
              </p>
              <p className="text-xs text-wl-text-secondary mt-1">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency Limit */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-3">
          Concurrent Syncs
        </label>
        <div className="space-y-3">
          <input
            type="range"
            min="1"
            max="50"
            value={schedule.concurrencyLimit}
            onChange={(e) => handleConcurrencyChange(parseInt(e.target.value))}
            className={cn(
              "w-full h-2 rounded-lg appearance-none cursor-pointer",
              "bg-wl-bg-elevated",
            )}
            style={{
              background: `linear-gradient(to right, var(--color-primary-500) 0%, var(--color-primary-500) ${(schedule.concurrencyLimit / 50) * 100}%, var(--color-border-subtle) ${(schedule.concurrencyLimit / 50) * 100}%, var(--color-border-subtle) 100%)`,
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-wl-text-secondary">
              Max products synced simultaneously
            </span>
            <Badge variant="info">{schedule.concurrencyLimit} products</Badge>
          </div>
          <p className="text-xs text-wl-text-secondary">
            Higher values sync faster but consume more resources. Recommended:
            5-10 for stable performance.
          </p>
        </div>
      </div>

      {/* Sync Preview */}
      <div className="p-4 bg-wl-bg-surface rounded-lg border border-wl-border-subtle space-y-3">
        <h4 className="font-semibold text-wl-text-primary">
          Sync Configuration
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-wl-text-secondary text-xs uppercase font-medium mb-1">
              Platform
            </p>
            <p className="text-wl-text-primary font-medium">{platformName}</p>
          </div>
          <div>
            <p className="text-wl-text-secondary text-xs uppercase font-medium mb-1">
              Interval
            </p>
            <p className="text-wl-text-primary font-medium">
              {INTERVAL_OPTIONS.find((o) => o.id === schedule.interval)?.name}
            </p>
          </div>
          <div>
            <p className="text-wl-text-secondary text-xs uppercase font-medium mb-1">
              Direction
            </p>
            <p className="text-wl-text-primary font-medium">
              {DIRECTION_OPTIONS.find((o) => o.id === schedule.direction)?.name}
            </p>
          </div>
          <div>
            <p className="text-wl-text-secondary text-xs uppercase font-medium mb-1">
              Concurrency
            </p>
            <p className="text-wl-text-primary font-medium">
              {schedule.concurrencyLimit} simultaneous
            </p>
          </div>
        </div>
      </div>

      {/* Warning for Real-time */}
      {schedule.interval === "realtime" && (
        <div className="p-4 bg-wl-info-bg/20 border border-wl-info-500/30 rounded-lg">
          <p className="text-sm text-wl-text-secondary">
            Real-time sync requires webhook setup. Please configure webhooks in
            your {platformName} integration settings.
          </p>
        </div>
      )}
    </div>
  );
}
