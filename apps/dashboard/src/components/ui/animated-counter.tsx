"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FormatType = "integer" | "decimal" | "currency" | "distance" | "time";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: FormatType;
  className?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  currencyCode?: string;
}

const easeOutQuad = (t: number): number => {
  return 1 - (1 - t) * (1 - t);
};

const formatValue = (
  value: number,
  format: FormatType,
  decimals: number = 2,
  currencyCode: string = "USD"
): string => {
  switch (format) {
    case "integer":
      return Math.round(value).toString();

    case "decimal":
      return value.toFixed(decimals);

    case "currency": {
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
      return formatted;
    }

    case "distance": {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} km`;
      }
      return `${Math.round(value)} m`;
    }

    case "time": {
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      const seconds = Math.round(value % 60);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    }

    default:
      return value.toFixed(decimals);
  }
};

export const AnimatedCounter = ({
  value,
  duration = 500,
  format = "integer",
  className,
  decimals = 2,
  suffix = "",
  prefix = "",
  currencyCode = "USD",
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(displayValue);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeOutQuad(progress);

      const newValue = startValueRef.current + (value - startValueRef.current) * easeProgress;
      setDisplayValue(newValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={cn("font-mono font-medium", className)}>
      {prefix}
      {formatValue(displayValue, format, decimals, currencyCode)}
      {suffix}
    </span>
  );
};

AnimatedCounter.displayName = "AnimatedCounter";
