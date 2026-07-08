"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { TrendingUp, AlertCircle } from "lucide-react";

interface DailyStatPoint {
  date: string;
  count: number;
}

interface ChannelStat {
  count: number;
  percentage: number;
}

interface FailedTemplate {
  name: string;
  failureCount: number;
  failureRate: number;
}

interface NotificationStatsData {
  dailyStats: DailyStatPoint[];
  channelBreakdown: Record<string, ChannelStat>;
  failedTemplates: FailedTemplate[];
  total: number;
}

interface NotificationStatsWidgetProps {
  className?: string;
}

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

function SimpleLineChart({ data }: { data: DailyStatPoint[] }) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {data.map((point, idx) => {
        const height = (point.count / maxValue) * 60;
        return (
          <div
            key={idx}
            className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/60 rounded-t transition-colors"
            style={{ height: `${Math.max(height, 2)}px` }}
            title={`${point.count} notifications`}
          />
        );
      })}
    </div>
  );
}

function DonutChart({ data }: { data: Record<string, ChannelStat> }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const channels = Object.entries(data).filter(([, s]) => s.count > 0);

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

  const avgPerDay = channels.reduce((sum, [, s]) => sum + s.count, 0) / 7;

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 100 100"
        >
          {segments.map((segment) => (
            <circle
              key={segment.channel}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={CHANNEL_CSS_VARS[segment.channel] ?? "#6b7280"}
              strokeWidth="8"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={-segment.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Avg/day</p>
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
              {Math.round(avgPerDay)}
            </p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {channels.map(([channel, stats]) => (
          <div key={channel} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHANNEL_CSS_VARS[channel] ?? "#6b7280" }}
            />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {channel}: {stats.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeletons() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <Skeleton className="h-3 w-20 mb-2 rounded" />
              <Skeleton className="h-8 w-16 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border border-[var(--wl-border)]">
        <CardContent className="pt-6">
          <Skeleton className="h-16 w-full rounded" />
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationStatsWidget({
  className,
}: NotificationStatsWidgetProps) {
  const { data: raw, loading } = useApiQuery<{ data: NotificationStatsData }>(
    "/api/v4/notifications/stats?days=7",
  );
  const stats =
    raw?.data ?? (raw as unknown as NotificationStatsData | undefined);

  const summary = useMemo(() => {
    if (!stats) return null;
    const daily = stats.dailyStats ?? [];
    const totalToday = daily[daily.length - 1]?.count ?? 0;
    const totalYesterday = daily[daily.length - 2]?.count ?? 0;
    const changePercent =
      totalYesterday > 0
        ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1)
        : "0";
    const totalSent = daily.reduce((sum, d) => sum + d.count, 0);
    const failedCount =
      stats.failedTemplates?.reduce((sum, t) => sum + t.failureCount, 0) ?? 0;
    const failureRate =
      totalSent > 0 ? ((failedCount / totalSent) * 100).toFixed(1) : "0.0";
    return { totalToday, changePercent, failureRate, failedCount };
  }, [stats]);

  if (loading) return <StatsSkeletons />;

  if (!stats || !summary) {
    return (
      <div className={cn("space-y-6", className)}>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6 text-center py-12">
            <p className="text-sm text-[var(--wl-text-secondary)]">
              No notification data available
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daily = stats.dailyStats ?? [];
  const channelBreakdown = stats.channelBreakdown ?? {};
  const failedTemplates = stats.failedTemplates ?? [];

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Sent Today
            </p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {summary.totalToday}
              </p>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  parseFloat(summary.changePercent) >= 0
                    ? "text-[var(--wl-success)]"
                    : "text-[var(--wl-danger)]",
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
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Delivery Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">
              {(100 - parseFloat(summary.failureRate)).toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              {summary.failureRate}% bounce
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              {summary.failedCount} failed
            </p>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Bounce Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">
              {summary.failureRate}%
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
          {daily.length > 0 ? (
            <>
              <SimpleLineChart data={daily} />
              <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
                <span>{daily[0]?.date}</span>
                <span>{daily[daily.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--wl-text-secondary)] text-center py-4">
              No data
            </p>
          )}
        </CardContent>
      </Card>

      {Object.keys(channelBreakdown).length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle className="text-sm">Channel Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={channelBreakdown} />
          </CardContent>
        </Card>
      )}

      {failedTemplates.length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle className="text-sm">Top Failed Templates</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
