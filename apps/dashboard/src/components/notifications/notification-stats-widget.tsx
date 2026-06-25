"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

const CHANNEL_COLORS: Record<string, string> = {
  email: "var(--wl-primary-500)",
  sms: "var(--wl-success-500)",
  whatsapp: "var(--wl-success-400)",
  push: "var(--wl-warning-500)",
};

const SimpleLineChart = ({ data }: { data: DailyStat[] }) => {
  if (data.length === 0) return <div className="h-16 flex items-center justify-center text-xs text-[var(--wl-text-secondary)]">No data</div>;
  const maxValue = Math.max(1, ...data.map((d) => d.count));
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
};

const DonutChart = ({ data }: { data: Record<string, number> }) => {
  const total = Math.max(1, Object.values(data).reduce((s, v) => s + v, 0));
  const channels = Object.entries(data);
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const segments = channels.map(([channel, count]) => {
    const pct = count / total;
    const len = pct * circ;
    const seg = { channel, pct: Math.round(pct * 100), dashArray: `${len} ${circ}`, dashOffset: offset };
    offset += len;
    return seg;
  });

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.map((s) => (
            <circle key={s.channel} cx="50" cy="50" r={radius} fill="none"
              stroke={CHANNEL_COLORS[s.channel] ?? "var(--wl-neutral-500)"}
              strokeWidth="8"
              strokeDasharray={s.dashArray}
              strokeDashoffset={-s.dashOffset}
              strokeLinecap="round" />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Total</p>
            <p className="text-xl font-bold text-[var(--wl-text-primary)]">{total}</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {segments.map((s) => (
          <div key={s.channel} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[s.channel] ?? "var(--wl-neutral-500)" }} />
            <span className="text-xs text-[var(--wl-text-secondary)] capitalize">
              {s.channel}: {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function NotificationStatsWidget({ className }: NotificationStatsWidgetProps) {
  const { data, loading, error, refetch } = useApiQuery<StatsPayload>('/api/v4/notifications/stats?days=7');

  const summary = useMemo(() => {
    if (!data) return null;
    const d = data.dailyStats;
    const totalToday = d[d.length - 1]?.count ?? 0;
    const totalYesterday = d[d.length - 2]?.count ?? 0;
    const changePercent = totalYesterday > 0
      ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1)
      : "0";
    const totalSent = d.reduce((s, x) => s + x.count, 0);
    const failedCount = data.failedTemplates.reduce((s, t) => s + t.count, 0);
    const failureRate = totalSent > 0 ? ((failedCount / totalSent) * 100).toFixed(1) : "0.0";
    return { totalToday, changePercent, failureRate, failedCount };
  }, [data]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!data || !summary) return (
    <div className="text-center py-12 text-[var(--wl-text-secondary)] text-sm">
      No notification data available
    </div>
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{summary.totalToday}</p>
              <div className={cn("flex items-center gap-1 text-xs font-semibold",
                parseFloat(summary.changePercent) >= 0 ? "text-[var(--wl-success)]" : "text-[var(--wl-danger)]")}>
                <TrendingUp className="w-3 h-3" />
                {parseFloat(summary.changePercent) > 0 ? "+" : ""}{summary.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Delivery Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">
              {(100 - parseFloat(summary.failureRate)).toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">{summary.failedCount} failed</p>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Bounce Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">{summary.failureRate}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[var(--wl-border)]">
        <CardHeader>
          <CardTitle className="text-sm">Notifications — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleLineChart data={data.dailyStats} />
          {data.dailyStats.length >= 2 && (
            <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
              <span>{data.dailyStats[0].date}</span>
              <span>{data.dailyStats[data.dailyStats.length - 1].date}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(data.channelBreakdown).length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle className="text-sm">Channel Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={data.channelBreakdown} />
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
              {data.failedTemplates.map((t, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 text-[var(--wl-danger)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[var(--wl-text-primary)]">{t.template}</p>
                      <p className="text-xs text-[var(--wl-text-secondary)]">{t.count} failures</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
