"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface ETACountdownProps {
  estimatedTime: Date | string;
  timeWindowEnd?: Date | string;
  isLate?: boolean;
  showOriginalEta?: boolean;
  originalEta?: Date | string;
  className?: string;
  compact?: boolean;
}

export const ETACountdown = ({
  estimatedTime,
  timeWindowEnd,
  isLate = false,
  showOriginalEta = false,
  originalEta,
  className,
  compact = false,
}: ETACountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isArrived, setIsArrived] = useState(false);
  const [lateByMinutes, setLateByMinutes] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<
    "on-time" | "close" | "late" | "arrived"
  >("on-time");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const eta = new Date(estimatedTime);
      const timeEnd = timeWindowEnd ? new Date(timeWindowEnd) : null;

      const diffMs = eta.getTime() - now.getTime();

      if (diffMs <= 0) {
        setIsArrived(true);
        setDisplayStatus("arrived");
        setTimeRemaining(0);
        return;
      }

      setIsArrived(false);

      const diffSeconds = Math.floor(diffMs / 1000);
      setTimeRemaining(diffSeconds);

      // Check if late (past time window end)
      if (isLate || (timeEnd && now > timeEnd)) {
        const lateMs = now.getTime() - (timeEnd?.getTime() || eta.getTime());
        setLateByMinutes(Math.floor(lateMs / 60000));
        setDisplayStatus("late");
        return;
      }

      // Check if close (within 15 minutes)
      if (diffSeconds < 900) {
        setDisplayStatus("close");
      } else {
        setDisplayStatus("on-time");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [estimatedTime, timeWindowEnd, isLate]);

  const getStatusColor = () => {
    switch (displayStatus) {
      case "on-time":
        return "text-wl-success-400";
      case "close":
        return "text-wl-warning-400";
      case "late":
        return "text-wl-danger-400";
      case "arrived":
        return "text-wl-success-400";
      default:
        return "text-wl-text-primary";
    }
  };

  const getStatusBgColor = () => {
    switch (displayStatus) {
      case "on-time":
        return "bg-wl-success-bg";
      case "close":
        return "bg-wl-warning-bg";
      case "late":
        return "bg-wl-danger-bg";
      case "arrived":
        return "bg-wl-success-bg";
      default:
        return "bg-wl-bg-overlay";
    }
  };

  if (isArrived) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center",
          "px-3 py-1.5 rounded-full",
          "bg-wl-success-bg text-wl-success-400",
          "text-sm font-semibold",
          compact && "text-xs px-2 py-1",
          className,
        )}
      >
        Arrived
      </div>
    );
  }

  if (displayStatus === "late") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center",
          "px-3 py-1.5 rounded-full",
          "bg-wl-danger-bg text-wl-danger-400",
          "text-sm font-semibold",
          compact && "text-xs px-2 py-1",
          className,
        )}
      >
        Late by {lateByMinutes}m
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-1", compact && "gap-0.5", className)}
    >
      <div
        className={cn(
          "inline-flex items-center justify-center",
          "px-3 py-1.5 rounded-full",
          getStatusBgColor(),
          getStatusColor(),
          "text-sm font-semibold",
          "font-mono",
          compact && "text-xs px-2 py-1",
          "transition-colors duration-300",
        )}
      >
        {timeRemaining < 60 ? (
          <span>&lt; 1m</span>
        ) : (
          <>
            <AnimatedCounter
              value={timeRemaining}
              duration={300}
              format="time"
              className="!text-current"
            />
          </>
        )}
      </div>

      {showOriginalEta && originalEta && displayStatus === "close" && (
        <div
          className={cn("text-xs text-wl-text-secondary", compact && "hidden")}
        >
          <span className="line-through text-wl-text-tertiary">
            {new Date(originalEta).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </div>
  );
};

ETACountdown.displayName = "ETACountdown";
