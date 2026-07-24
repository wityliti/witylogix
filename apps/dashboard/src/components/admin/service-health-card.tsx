"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceHealthCardProps, ServiceStatus } from "./types";

/**
 * Service health status card component
 * Displays service name, status badge, uptime %, response time, and mini sparkline
 */
export function ServiceHealthCard({ data, className }: ServiceHealthCardProps) {
  const statusColor: Record<ServiceStatus, "success" | "warning" | "danger"> = {
    healthy: "success",
    degraded: "warning",
    unhealthy: "danger",
  };

  const statusText: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    unhealthy: "Unhealthy",
  };

  // Generate sparkline from response time history
  const sparklineData = useMemo(() => {
    if (!data.responseTimeHistory || data.responseTimeHistory.length === 0) {
      return { max: 100, points: [] };
    }

    const max = Math.max(...data.responseTimeHistory);
    const min = Math.min(...data.responseTimeHistory);
    const range = max - min || 1;

    const points = data.responseTimeHistory.map((value) => {
      const normalized = (value - min) / range;
      return { value, normalized };
    });

    return { max, points };
  }, [data.responseTimeHistory]);

  // Generate sparkline SVG path
  const sparklinePath = useMemo(() => {
    if (sparklineData.points.length < 2) return "";

    const width = 120;
    const height = 20;
    const padding = 2;

    const points = sparklineData.points.map((point, index) => {
      const x =
        padding +
        (index / (sparklineData.points.length - 1)) * (width - 2 * padding);
      const y = height - padding - point.normalized * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M${points.join("L")}`;
  }, [sparklineData]);

  const getStatusIcon = (status: ServiceStatus): React.ReactNode => {
    switch (status) {
      case "healthy":
        return (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.2" />
            <circle cx="8" cy="8" r="4" fill="currentColor" />
          </svg>
        );
      case "degraded":
        return (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.2" />
            <path d="M8 4 L12 12 L4 12 Z" fill="currentColor" opacity="0.7" />
          </svg>
        );
      case "unhealthy":
        return (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.2" />
            <path
              d="M8 4 L8 12 M4 8 L12 8"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        );
    }
  };

  const lastCheckTime = new Date(data.lastCheckAt);
  const now = new Date();
  const diffMs = now.getTime() - lastCheckTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let relativeTime = "";
  if (diffMins < 1) {
    relativeTime = "now";
  } else if (diffMins < 60) {
    relativeTime = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relativeTime = `${diffHours}h ago`;
  } else {
    relativeTime = lastCheckTime.toLocaleDateString();
  }

  return (
    <Card
      className={cn(
        "hover:border-wl-border-default transition-all duration-base",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{data.name}</CardTitle>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Service ID: {data.id.substring(0, 12)}...
            </p>
          </div>
          <Badge variant={statusColor[data.status]} dot>
            {statusText[data.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status metrics */}
        <div className="grid grid-cols-2 gap-4">
          {/* Uptime */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
                Uptime
              </p>
              <p className="text-lg font-bold text-wl-text-primary mt-1">
                {data.uptimePercentage.toFixed(2)}%
              </p>
            </div>
            {/* Uptime bar */}
            <div className="w-1 h-12 bg-wl-bg-surface rounded overflow-hidden">
              <div
                className="w-full bg-gradient-to-b from-green-500 to-green-600 rounded"
                style={{ height: `${Math.min(data.uptimePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Response time */}
          <div>
            <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
              Response Time
            </p>
            <p className="text-lg font-bold text-wl-text-primary mt-1">
              {Math.round(data.responseTimeMs)}ms
            </p>
            {data.responseTimeHistory &&
              data.responseTimeHistory.length > 0 && (
                <p className="text-xs text-wl-text-tertiary mt-1">
                  avg{" "}
                  {Math.round(
                    data.responseTimeHistory.reduce((a, b) => a + b, 0) /
                      data.responseTimeHistory.length,
                  )}
                  ms
                </p>
              )}
          </div>
        </div>

        {/* Sparkline */}
        {data.responseTimeHistory && data.responseTimeHistory.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide mb-2">
              Response Time History
            </p>
            <div className="bg-wl-bg-surface rounded p-2 flex items-center justify-center">
              <svg
                width="120"
                height="24"
                viewBox="0 0 120 20"
                className="w-full"
              >
                {/* Grid lines */}
                <line
                  x1="0"
                  y1="10"
                  x2="120"
                  y2="10"
                  stroke="var(--wl-border-subtle)"
                  strokeWidth="0.5"
                  opacity="0.3"
                />

                {/* Sparkline path */}
                {sparklinePath && (
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke="var(--wl-primary-500)"
                    strokeWidth="1.5"
                  />
                )}

                {/* Current point */}
                {sparklineData.points.length > 0 && (
                  <circle
                    cx={
                      2 +
                      ((sparklineData.points.length - 1) /
                        sparklineData.points.length) *
                        116
                    }
                    cy={
                      20 -
                      2 -
                      sparklineData.points[sparklineData.points.length - 1]
                        .normalized *
                        16
                    }
                    r="1.5"
                    fill="var(--wl-primary-500)"
                  />
                )}
              </svg>
            </div>
          </div>
        )}

        {/* Last check timestamp */}
        <div className="pt-2 border-t border-wl-border-subtle">
          <p className="text-xs text-wl-text-tertiary">
            Last check:{" "}
            <span className="font-semibold text-wl-text-secondary">
              {relativeTime}
            </span>
          </p>
          <p className="text-xs text-wl-text-tertiary mt-1">
            {lastCheckTime.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
