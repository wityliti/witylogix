"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";

interface DailyStat { date: string; count: number }
interface ChannelInfo { count: number; percentage: number }
interface FailedTemplate { name: string; failureCount: number; failureRate: number }
interface NotificationStatsData {
  dailyStats: DailyStat[];
  channels: Record<string, ChannelInfo>;
  failedTemplates: FailedTemplate[];
  summary: {
    totalToday: number;
    totalYesterday: number;
    totalFailed: number;
    totalSent: number;
    deliveryRate: number;
    failureRate: number;
  };
}

interface NotificationStatsWidgetProps { className?: string; }

interface NotificationStatsData {
  dailyStats: Array<{ date: string; count: number }>;
  channelBreakdown: {
    email: { count: number; percentage: number };
    sms: { count: number; percentage: number };
    whatsapp: { count: number; percentage: number };
    push: { count: number; percentage: number };
  };
  failedTemplates: Array<{ name: string; failureCount: number; failureRate: number }>;
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  email:    "#3B82F6",
  sms:      "#10B981",
  whatsapp: "#25D366",
  push:     "#F59E0B",
};

function SimpleBarChart({ data }: { data: DailyStat[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {data.map((d, i) => {
        const h = Math.max(4, (d.count / max) * 60);
        return (
          <div
            key={i}
            className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/70 rounded-t transition-colors"
            style={{ height: `${h}px` }}
            title={`${d.date}: ${d.count} sent`}
          />
        );
      })}
    </div>
  );
}

function DonutChart({ channels }: { channels: Record<string, ChannelInfo> }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const entries = Object.entries(channels);
  let offset = 0;
  const segments = entries.map(([ch, info]) => {
    const len = (info.percentage / 100) * circumference;
    const s = { ch, percentage: info.percentage, dashArray: `${len} ${circumference}`, dashOffset: offset };
    offset += len;
    return s;
  });
  const total = entries.reduce((s, [, v]) => s + v.count, 0);

  const totalAvg = Math.round(channels.reduce((sum, [, s]) => sum + s.count, 0) / 7);

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.map((seg) => (
            <circle
              key={seg.ch}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={CHANNEL_COLORS[seg.ch] ?? "#6b7280"}
              strokeWidth="8"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={-seg.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div>
            <p className="text-xs text-[var(--wl-text-secondary)]">Total</p>
            <p className="text-xl font-bold text-[var(--wl-text-primary)]">{total}</p>
            <p className="text-xs text-[var(--wl-text-secondary)]">7 days</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {entries.map(([ch, info]) => (
          <div key={ch} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ch] ?? "#6b7280" }} />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {ch}: {info.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="border border-[var(--wl-border)] rounded-lg p-6 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function NotificationStatsWidget({ className }: NotificationStatsWidgetProps) {
  const { data, loading, error } = useApiQuery<NotificationStatsData>("/api/v4/notifications/stats");

  const stats = useMemo(() => {
    if (!data) return null;
    const { summary, dailyStats } = data;
    const changePercent =
      summary.totalYesterday > 0
        ? (((summary.totalToday - summary.totalYesterday) / summary.totalYesterday) * 100).toFixed(1)
        : "0";
    return { ...summary, changePercent, dailyStats };
  }, [data]);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="border border-[var(--wl-border)] rounded-lg p-6">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (error || !stats || !data) {
    return (
      <div className={cn("flex items-center justify-center py-16 text-center", className)}>
        <div>
          <AlertCircle className="w-8 h-8 text-wl-danger-400 mx-auto mb-2 opacity-70" />
          <p className="text-sm text-[var(--wl-text-secondary)]">Unable to load notification stats</p>
        </div>
      </div>
    );
  }

  const changeFloat = parseFloat(stats.changePercent);
  const isUp = changeFloat >= 0;

  const dateLabels = stats.dailyStats;
  const firstDate = dateLabels[0]?.date ? new Date(dateLabels[0].date).toLocaleDateString("en", { month: "short", day: "numeric" }) : "";
  const lastDate = dateLabels[dateLabels.length - 1]?.date
    ? new Date(dateLabels[dateLabels.length - 1].date).toLocaleDateString("en", { month: "short", day: "numeric" })
    : "";

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{stats.totalToday}</p>
              <div className={cn("flex items-center gap-1 text-xs font-semibold", isUp ? "text-[var(--wl-success)]" : "text-[var(--wl-danger)]")}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? "+" : ""}{stats.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Delivery Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">{stats.deliveryRate.toFixed(1)}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">{stats.totalFailed} failed</p>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
              Bounce Rate
            </p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">{stats.failureRate.toFixed(1)}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Notifications — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyStats.length > 0 ? (
            <>
              <SimpleBarChart data={data.dailyStats} />
              <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
                <span>{firstDate}</span>
                <span>{lastDate}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--wl-text-secondary)] py-4 text-center">No data for the last 7 days</p>
          )}
        </CardContent>
      </Card>

      {Object.keys(data.channels).length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle className="text-sm">Channel Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart channels={data.channels} />
          </CardContent>
        </Card>
      )}

      {data.failedTemplates.length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle className="text-sm">Top Failed Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.failedTemplates.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]"
                >
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 text-[var(--wl-danger)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[var(--wl-text-primary)]">{t.name}</p>
                      <p className="text-xs text-[var(--wl-text-secondary)]">{t.failureCount} failures</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--wl-danger)]">{t.failureRate}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
