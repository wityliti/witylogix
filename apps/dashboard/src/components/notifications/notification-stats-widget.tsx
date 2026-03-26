"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  Bell,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface NotificationStat {
  timestamp: Date;
  count: number;
}

interface NotificationStatsWidgetProps {
  className?: string;
}

// Mock data - in production, this would come from an API
const MOCK_DAILY_STATS: NotificationStat[] = [
  { timestamp: new Date("2026-03-05"), count: 145 },
  { timestamp: new Date("2026-03-06"), count: 267 },
  { timestamp: new Date("2026-03-07"), count: 198 },
  { timestamp: new Date("2026-03-08"), count: 312 },
  { timestamp: new Date("2026-03-09"), count: 289 },
  { timestamp: new Date("2026-03-10"), count: 401 },
  { timestamp: new Date("2026-03-11"), count: 356 },
];

const MOCK_CHANNEL_BREAKDOWN = {
  email: { count: 1200, percentage: 45 },
  sms: { count: 800, percentage: 30 },
  whatsapp: { count: 400, percentage: 15 },
  push: { count: 200, percentage: 10 },
};

const MOCK_FAILED_TEMPLATES = [
  {
    name: "Order Confirmation Email",
    failureCount: 12,
    failureRate: 2.1,
  },
  {
    name: "Delivery Update SMS",
    failureCount: 8,
    failureRate: 1.8,
  },
  {
    name: "Failed Delivery WhatsApp",
    failureCount: 5,
    failureRate: 3.5,
  },
];

const CHANNEL_COLORS = {
  email: "#3B82F6",
  sms: "#10B981",
  whatsapp: "#25D366",
  push: "#F59E0B",
};

const SimpleLineChart = ({ data }: { data: NotificationStat[] }) => {
  const maxValue = Math.max(...data.map((d) => d.count));
  const points = data.map((d, i) => {
    const height = (d.count / maxValue) * 60;
    return { x: (i / (data.length - 1)) * 100, height };
  });

  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {points.map((point, idx) => (
        <div
          key={idx}
          className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/60 rounded-t transition-colors"
          style={{ height: `${point.height}px` }}
          title={`${data[idx].count} notifications`}
        />
      ))}
    </div>
  );
};

const DonutChart = ({
  data,
}: {
  data: Record<string, { count: number; percentage: number }>;
}) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const channels = Object.entries(data);

  let offset = 0;
  const segments = channels.map(([channel, stats]) => {
    const segmentLength = (stats.percentage / 100) * circumference;
    const dashoffset = offset;
    offset += segmentLength;

    return {
      channel,
      percentage: stats.percentage,
      dashArray: `${segmentLength} ${circumference}`,
      dashOffset: dashoffset,
    };
  });

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.map((segment) => (
            <circle
              key={segment.channel}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={CHANNEL_COLORS[segment.channel as keyof typeof CHANNEL_COLORS]}
              strokeWidth="8"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={-segment.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Today</p>
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
              {Math.round(
                channels.reduce((sum, [_, stats]) => sum + stats.count, 0) / 7
              )}
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)]">avg/day</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {channels.map(([channel, stats]) => (
          <div key={channel} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor:
                  CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS],
              }}
            />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {channel}: {stats.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function NotificationStatsWidget({
  className,
}: NotificationStatsWidgetProps) {
  const stats = useMemo(() => {
    const totalToday = MOCK_DAILY_STATS[MOCK_DAILY_STATS.length - 1].count;
    const totalYesterday = MOCK_DAILY_STATS[MOCK_DAILY_STATS.length - 2].count;
    const changePercent =
      totalYesterday > 0
        ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1)
        : "0";

    const totalSent = MOCK_DAILY_STATS.reduce((sum, s) => sum + s.count, 0);
    const failedCount = Math.round(totalSent * 0.02); // 2% failure rate
    const failureRate = ((failedCount / totalSent) * 100).toFixed(1);

    return {
      totalToday,
      changePercent,
      failureRate,
      failedCount,
    };
  }, []);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Sent Today
            </p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {stats.totalToday}
              </p>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  parseFloat(stats.changePercent) >= 0
                    ? "text-[var(--wl-success)]"
                    : "text-[var(--wl-danger)]"
                )}
              >
                <TrendingUp className="w-3 h-3" />
                {parseFloat(stats.changePercent) > 0 ? "+" : ""}
                {stats.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Delivery Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">
              {(100 - parseFloat(stats.failureRate)).toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              {stats.failedCount} failed
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Bounce Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">
              {stats.failureRate}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Trend */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Notifications - Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleLineChart data={MOCK_DAILY_STATS} />
          <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
            <span>Mar 5</span>
            <span>Mar 11</span>
          </div>
        </CardContent>
      </Card>

      {/* Channel Breakdown */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Channel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DonutChart data={MOCK_CHANNEL_BREAKDOWN} />
        </CardContent>
      </Card>

      {/* Top Failed Templates */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Top Failed Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_FAILED_TEMPLATES.map((template, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]"
              >
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="w-4 h-4 text-[var(--wl-danger)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--wl-text-primary)]">
                      {template.name}
                    </p>
                    <p className="text-xs text-[var(--wl-text-secondary)]">
                      {template.failureCount} failures
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[var(--wl-danger)]">
                  {template.failureRate}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
