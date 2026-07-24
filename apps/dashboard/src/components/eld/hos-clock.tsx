"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   HOS CLOCK — Circular gauge showing Hours of Service remaining
   Color zones: green (>4h), yellow (2-4h), red (<2h), flashing red (violation)
   ═══════════════════════════════════════════════════════════ */

interface HOSClockProps {
  remainingMinutes: number;
  maxMinutes: number;
  label: string;
  isViolation?: boolean;
  showAnimation?: boolean;
}

export function HOSClock({
  remainingMinutes,
  maxMinutes,
  label,
  isViolation = false,
  showAnimation = true,
}: HOSClockProps) {
  const [displayMinutes, setDisplayMinutes] = useState(remainingMinutes);
  const [animate, setAnimate] = useState(false);

  // Animate when value changes
  useEffect(() => {
    if (displayMinutes !== remainingMinutes) {
      setAnimate(true);
      const timer = setTimeout(() => {
        setDisplayMinutes(remainingMinutes);
        setAnimate(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [remainingMinutes, displayMinutes]);

  const percentage = (displayMinutes / maxMinutes) * 100;
  const hours = Math.floor(displayMinutes / 60);
  const minutes = displayMinutes % 60;

  // Determine color based on remaining time
  const getColor = (): { bg: string; text: string; accent: string } => {
    if (isViolation) {
      return {
        bg: "from-wl-danger-900/30 to-wl-danger-950/50",
        text: "text-wl-danger-300",
        accent: "text-wl-danger-400",
      };
    }

    if (percentage > 50) {
      return {
        bg: "from-wl-success-900/30 to-wl-success-950/50",
        text: "text-wl-success-300",
        accent: "text-wl-success-400",
      };
    }

    if (percentage > 25) {
      return {
        bg: "from-wl-warning-900/30 to-wl-warning-950/50",
        text: "text-wl-warning-300",
        accent: "text-wl-warning-400",
      };
    }

    return {
      bg: "from-wl-danger-900/30 to-wl-danger-950/50",
      text: "text-wl-danger-300",
      accent: "text-wl-danger-400",
    };
  };

  const colors = getColor();

  // SVG gauge calculation
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-6")}>
      {/* Circular Gauge */}
      <div className="relative w-40 h-40">
        {/* Background glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br opacity-0 blur-xl",
            colors.bg,
            isViolation && showAnimation && "animate-pulse",
          )}
        />

        {/* SVG Gauge */}
        <svg
          className="absolute inset-0 w-full h-full transform -rotate-90"
          viewBox="0 0 100 100"
          style={{ filter: "drop-shadow(0 0 12px rgba(0,0,0,0.3))" }}
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgb(75, 85, 99)"
            strokeWidth="2"
            opacity="0.2"
          />

          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={cn("transition-all duration-300", colors.accent)}
            strokeDasharray={circumference}
            strokeDashoffset={animate ? strokeDashoffset : strokeDashoffset}
            style={{
              filter:
                isViolation && showAnimation
                  ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))"
                  : "none",
            }}
          />

          {/* Center circle */}
          <circle cx="50" cy="50" r="38" fill="rgb(30, 30, 30)" opacity="0.8" />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={cn(
              "text-center transition-opacity duration-300",
              colors.text,
            )}
          >
            <div className="text-3xl font-bold tabular-nums">
              {String(hours).padStart(2, "0")}
              <span className="text-lg">:</span>
              {String(minutes).padStart(2, "0")}
            </div>
            <div className="text-xs uppercase tracking-wide font-semibold mt-1 opacity-75">
              remaining
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-wl-text-primary uppercase tracking-wide">
          {label}
        </h3>
        <p className={cn("text-xs font-medium mt-1", colors.accent)}>
          {percentage > 50 && "✓ Compliant"}
          {percentage <= 50 && percentage > 25 && "⚠ Caution"}
          {percentage <= 25 && !isViolation && "⚠ Critical"}
          {isViolation && "⛔ Violation"}
        </p>
      </div>

      {/* Percentage indicator */}
      <div className="text-xs text-wl-text-secondary">
        {percentage.toFixed(0)}% remaining
      </div>
    </div>
  );
}

// Multi-gauge display component
interface MultiHOSGaugeProps {
  driving: number; // remaining driving minutes
  onDutyWindow: number; // remaining on-duty window minutes
  cycle: { used: number; max: number }; // cycle hours
  breakRemaining?: number; // break minutes remaining
  isViolation?: boolean;
}

export function MultiHOSGauge({
  driving,
  onDutyWindow,
  cycle,
  breakRemaining = 0,
  isViolation = false,
}: MultiHOSGaugeProps) {
  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 p-6 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
      <HOSClock
        remainingMinutes={driving}
        maxMinutes={660}
        label="Driving"
        isViolation={isViolation}
      />
      <HOSClock
        remainingMinutes={onDutyWindow}
        maxMinutes={840}
        label="On-Duty Window (14h)"
        isViolation={isViolation}
      />
      <HOSClock
        remainingMinutes={(cycle.max - cycle.used) * 60}
        maxMinutes={cycle.max * 60}
        label={`Cycle (${cycle.max}h)`}
        isViolation={isViolation}
      />
      {breakRemaining > 0 && (
        <HOSClock
          remainingMinutes={breakRemaining}
          maxMinutes={30}
          label="Break Required"
          isViolation={false}
        />
      )}
    </div>
  );
}
