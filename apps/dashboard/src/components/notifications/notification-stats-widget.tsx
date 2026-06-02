"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";

interface DailyStat {
  timestamp: string;
  count: number;
}

interface ChannelInfo {
  count: number;
  percentage: number;
}

interface FailedTemplate {
  name: string;
  failureCount: number;
  failureRate: number;
}

interface NotificationStats {
  dailyStats: DailyStat[];
  channelBreakdown: Record<string, ChannelInfo>;
  failedTemplates: FailedTemplate[];
  totals: {
    sent: number;
    delivered: number;
    failed: number;
    total: number;
  };
}

interface NotificationStatsWidgetProps {
  className?: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "#3B82F6",
  sms: "#10B981",
  whatsapp: "#25D366",
  push: "#F59E0B",
  webhook: "#8B5CF6",
  slack: "#E01E5A",
};

const SimpleBarChart = ({ data }: { data: DailyStat[] }) => {
  if (!data.length) return null;
  const maxValue = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-16 flex items-end gap-1 px-2">
      {data.map((d, idx) => (
        <div
          key={idx}
          className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/70 rounded-t transition-colors cursor-default"
          style={{ height: `${Math.max((d.count / maxValue) * 60, 2)}px` }}
          title={`${new Date(d.timestamp).toLocaleDateString()}: ${d.count}`}
        />
      ))}
    </div>
  );
};

const DonutChart = ({ data }: { data: Record<string, ChannelInfo> }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const channels = Object.entries(data).filter(([, v]) => v.percentage > 0);
  const totalCount = channels.reduce((s, [, v]) => s + v.count, 0);

  let offset = 0;
  const segments = channels.map(([channel, stats]) => {
    const segmentLength = (stats.percentage / 100) * circumference;
    const dashoffset = offset;
    offset += segmentLength;
    return { channel, percentage: stats.percentage, dashArray: `${segmentLength} ${circumference}`, dashOffset: dashoffset };
  });

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.length === 0 && (
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          )}
          {segments.map((seg) => (
            <circle
              key={seg.channel}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={CHANNEL_COLORS[seg.channel] ?? "#6B7280"}
              strokeWidth="8"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={-seg.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Total</p>
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{totalCount}</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {channels.map(([ch, stats]) => (
          <div key={ch} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[ch] ?? "#6B7280" }} />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {ch}: {stats.percentage}%
            </span>
          </div>
        ))}
        {channels.length === 0 && (
          <span className="text-xs text-[var(--wl-text-secondary)]">No data</span>
        )}
      </div>
    </div>
  );
};

export function NotificationStatsWidget({ className }: NotificationStatsWidgetProps) {
  const { data: stats, loading } = useApiQuery<NotificationStats>("/api/v4/notifications/stats?days=7");

  const summary = useMemo(() => {
    if (!stats?.dailyStats?.length) return null;
    const daily = stats.dailyStats;
    const todayCount = daily[daily.length - 1]?.count ?? 0;
    const yesterdayCount = daily[daily.length - 2]?.count ?? 0;
    const changePercent = yesterdayCount > 0
      ? (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1)
      : "0";
    const total = stats.totals?.total ?? 0;
    const failed = stats.totals?.failed ?? 0;
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "0.0";
    const deliveryRate = total > 0 ? (((total - failed) / total) * 100).toFixed(1) : "100.0";

    return { todayCount, changePercent, failureRate, deliveryRate, failed };
  }, [stats]);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border border-[var(--wl-border)]">
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
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

  const dateLabels = stats?.dailyStats?.length
    ? {
        from: new Date(stats.dailyStats[0].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        to: new Date(stats.dailyStats[stats.dailyStats.length - 1].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }
    : null;

  const isUp = summary ? parseFloat(summary.changePercent) >= 0 : true;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{summary?.todayCount ?? 0}</p>
              {summary && (
                <div className={cn("flex items-center gap-1 text-xs font-semibold", isUp ? "text-[var(--wl-success)]" : "text-[var(--wl-danger)]")}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp && parseFloat(summary.changePercent) > 0 ? "+" : ""}{summary.changePercent}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Delivery Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">{summary?.deliveryRate ?? "—"}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">{summary?.failed ?? 0} failed</p>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Failure Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">{summary?.failureRate ?? "0.0"}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* 7-day trend */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Notifications — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.dailyStats?.length ? (
            <>
              <SimpleBarChart data={stats.dailyStats} />
              {dateLabels && (
                <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
                  <span>{dateLabels.from}</span>
                  <span>{dateLabels.to}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--wl-text-secondary)] text-center py-6">No notification data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Channel breakdown */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Channel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DonutChart data={stats?.channelBreakdown ?? {}} />
        </CardContent>
      </Card>

      {/* Top failed templates */}
      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Top Failed Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.failedTemplates?.length ? (
            <div className="space-y-3">
              {stats.failedTemplates.map((template, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]"
                >
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 text-[var(--wl-danger)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[var(--wl-text-primary)]">{template.name}</p>
                      <p className="text-xs text-[var(--wl-text-secondary)]">{template.failureCount} failures</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--wl-danger)]">{template.failureRate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--wl-text-secondary)] text-center py-4">No template failures</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
