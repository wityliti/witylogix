"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface DailyStat { date: string; count: number; }
interface StatsPayload {
  dailyStats: DailyStat[];
  channelBreakdown: Record<string, number>;
  failedTemplates: Array<{ template: string; count: number }>;
}

interface NotificationStatsWidgetProps { className?: string; }

interface DailyEntry {
  date: string;
  count: number;
}

interface ChannelEntry {
  channel: string;
  count: number;
  percentage: number;
}

interface FailedTemplateEntry {
  name: string;
  failureCount: number;
  failureRate: number;
}

interface NotificationStatsResponse {
  daily?: DailyEntry[];
  byChannel?: ChannelEntry[];
  failedTemplates?: FailedTemplateEntry[];
  summary?: {
    totalToday?: number;
    deliveryRate?: number;
    bounceRate?: number;
  };
}

const CHANNEL_CSS_VARS: Record<string, string> = {
  email: "var(--wl-primary-500)",
  sms: "var(--wl-success-500)",
  whatsapp: "var(--wl-info-500)",
  push: "var(--wl-warning-500)",
};

function getChannelColor(channel: string): string {
  return CHANNEL_CSS_VARS[channel.toLowerCase()] ?? "var(--wl-text-secondary)";
}

const SimpleLineChart = ({ data }: { data: NotificationStat[] }) => {
  if (data.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-xs text-[var(--wl-text-secondary)]">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const points = data.map((d, i) => {
    const height = (d.count / maxValue) * 60;
    return { height };
  });

  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {data.map((d, idx) => (
        <div
          key={idx}
          className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/60 rounded-t transition-colors"
          style={{ height: `${(d.count / maxValue) * 60}px` }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

const DonutChart = ({
  data,
}: {
  data: ChannelEntry[];
}) => {
  if (data.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-[var(--wl-text-secondary)]">
        No channel data available
      </div>
    );
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((entry) => {
    const segmentLength = (entry.percentage / 100) * circumference;
    const dashoffset = offset;
    offset += segmentLength;

    return {
      channel: entry.channel,
      percentage: entry.percentage,
      dashArray: `${segmentLength} ${circumference}`,
      dashOffset: dashoffset,
    };
  });
  const total = entries.reduce((s, [, v]) => s + v.count, 0);

  const totalAvg = Math.round(channels.reduce((sum, [, s]) => sum + s.count, 0) / 7);

  const totalAvg = Math.round(data.reduce((sum, d) => sum + d.count, 0) / 7);

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
              stroke={getChannelColor(segment.channel)}
              strokeWidth="8"
              strokeDasharray={s.dashArray}
              strokeDashoffset={-s.dashOffset}
              strokeLinecap="round" />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Today</p>
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
              {totalAvg}
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)]">avg/day</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {data.map((entry) => (
          <div key={entry.channel} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getChannelColor(entry.channel) }}
            />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {entry.channel}: {entry.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationStatsWidget({
  className,
}: NotificationStatsWidgetProps) {
  const { data, loading, error, refetch } = useApiQuery<NotificationStatsResponse>(
    "/api/v4/notifications/stats?days=7"
  );

  const dailyStats: NotificationStat[] = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map((d) => ({
      timestamp: new Date(d.date),
      count: d.count,
    }));
  }, [data]);

  const channelData: ChannelEntry[] = data?.byChannel ?? [];
  const failedTemplates: FailedTemplateEntry[] = data?.failedTemplates ?? [];

  const summary = useMemo(() => {
    if (data?.summary) {
      return {
        totalToday: data.summary.totalToday ?? 0,
        deliveryRate: data.summary.deliveryRate ?? 0,
        bounceRate: data.summary.bounceRate ?? 0,
        changePercent: "0",
      };
    }

    if (dailyStats.length >= 2) {
      const totalToday = dailyStats[dailyStats.length - 1].count;
      const totalYesterday = dailyStats[dailyStats.length - 2].count;
      const changePercent =
        totalYesterday > 0
          ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1)
          : "0";
      const totalSent = dailyStats.reduce((sum, s) => sum + s.count, 0);
      const failedCount = Math.round(totalSent * 0.02);
      const failureRate = totalSent > 0 ? ((failedCount / totalSent) * 100).toFixed(1) : "0";

      return {
        totalToday,
        deliveryRate: 100 - parseFloat(failureRate),
        bounceRate: parseFloat(failureRate),
        changePercent,
      };
    }

    return { totalToday: 0, deliveryRate: 0, bounceRate: 0, changePercent: "0" };
  }, [data, dailyStats]);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" height={96} />
          ))}
        </div>
        <LoadingSkeleton variant="card" height={160} />
        <LoadingSkeleton variant="card" height={200} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={refetch}
        className={className}
      />
    );
  }

  if (!data && !loading) {
    return (
      <div className="text-sm text-wl-text-secondary text-center py-8">
        No notification data yet.
      </div>
    );
  }

  const firstDate =
    dailyStats.length > 0
      ? dailyStats[0].timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
  const lastDate =
    dailyStats.length > 0
      ? dailyStats[dailyStats.length - 1].timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {summary.totalToday}
              </p>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  parseFloat(summary.changePercent) >= 0
                    ? "text-[var(--wl-success)]"
                    : "text-[var(--wl-danger)]"
                )}
              >
                <TrendingUp className="w-3 h-3" />
                {parseFloat(summary.changePercent) > 0 ? "+" : ""}
                {summary.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Delivery Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">
              {summary.deliveryRate.toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              {(100 - summary.deliveryRate).toFixed(1)}% bounce
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">{summary.failedCount} failed</p>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Bounce Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">
              {summary.bounceRate.toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Notifications — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyStats.length === 0 ? (
            <div className="text-sm text-wl-text-secondary text-center py-8">
              No notification data yet.
            </div>
          ) : (
            <>
              <SimpleLineChart data={dailyStats} />
              <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
                <span>{firstDate}</span>
                <span>{lastDate}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Channel Breakdown */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Channel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {channelData.length === 0 ? (
            <div className="text-sm text-wl-text-secondary text-center py-8">
              No notification data yet.
            </div>
          ) : (
            <DonutChart data={channelData} />
          )}
        </CardContent>
      </Card>

      {/* Top Failed Templates */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Top Failed Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {failedTemplates.length === 0 ? (
            <div className="text-sm text-wl-text-secondary text-center py-8">
              No failed templates.
            </div>
          ) : (
            <div className="space-y-3">
              {failedTemplates.map((template, idx) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
