"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

interface DailyStat { date: string; count: number; }
interface StatsPayload {
  dailyStats: DailyStat[];
  channelBreakdown: Record<string, number>;
  failedTemplates: Array<{ template: string; count: number }>;
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

const CHANNEL_COLORS = {
  email: "#3B82F6",
  sms: "#10B981",
  whatsapp: "#25D366",
  push: "#F59E0B",
};

const SimpleLineChart = ({ data }: { data: Array<{ date: string; count: number }> }) => {
  if (!data.length) return null;
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {data.map((d, idx) => {
        const height = (d.count / maxValue) * 60;
        return (
          <div
            key={idx}
            className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/60 rounded-t transition-colors"
            style={{ height: `${height}px` }}
            title={`${d.count} notifications`}
          />
        );
      })}
    </div>
  );
};

const DonutChart = ({ data }: { data: Record<string, number> }) => {
  const total = Math.max(1, Object.values(data).reduce((s, v) => s + v, 0));
  const channels = Object.entries(data);
  const avgPerDay = Math.round(
    channels.reduce((sum, [, s]) => sum + s.count, 0) / 7
  );

  let offset = 0;
  const segments = channels.map(([channel, stats]) => {
    const segmentLength = (stats.percentage / 100) * circumference;
    const dashoffset = offset;
    offset += segmentLength;
    return { channel, percentage: stats.percentage, dashArray: `${segmentLength} ${circumference}`, dashOffset: dashoffset };
  });

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.map((seg) => (
            <circle
              key={seg.channel}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={CHANNEL_COLORS[seg.channel as keyof typeof CHANNEL_COLORS]}
              strokeWidth="8"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={-seg.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-[var(--wl-text-secondary)]">Today</p>
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{avgPerDay}</p>
            <p className="text-xs text-[var(--wl-text-secondary)]">avg/day</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {channels.map(([channel, stats]) => (
          <div key={channel} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS] }} />
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
  const { data, loading } = useApiQuery<NotificationStatsData>('/api/v4/notifications/stats');

  const stats = useMemo(() => {
    if (!data) return null;
    const { dailyStats, totalSent, deliveredCount, failedCount } = data;
    const today = dailyStats[dailyStats.length - 1]?.count ?? 0;
    const yesterday = dailyStats[dailyStats.length - 2]?.count ?? 0;
    const changePercent = yesterday > 0 ? (((today - yesterday) / yesterday) * 100).toFixed(1) : '0';
    const failureRate = totalSent > 0 ? ((failedCount / totalSent) * 100).toFixed(1) : '0';
    const deliveryRate = totalSent > 0 ? ((deliveredCount / totalSent) * 100).toFixed(1) : '100';
    return { today, changePercent, failureRate, deliveryRate, failedCount };
  }, [data]);

  if (loading) return <LoadingSkeleton />;
  if (!data || !stats) return null;

  const EMPTY_CHANNEL = { count: 0, percentage: 0 };
  const channelBreakdown = data.channelBreakdown ?? {
    email: EMPTY_CHANNEL, sms: EMPTY_CHANNEL, whatsapp: EMPTY_CHANNEL, push: EMPTY_CHANNEL,
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{stats.today}</p>
              <div className={cn("flex items-center gap-1 text-xs font-semibold",
                parseFloat(stats.changePercent) >= 0 ? "text-[var(--wl-success)]" : "text-[var(--wl-danger)]"
              )}>
                <TrendingUp className="w-3 h-3" />
                {parseFloat(stats.changePercent) > 0 ? '+' : ''}{stats.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Delivery Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">{stats.deliveryRate}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">{stats.failedCount} failed</p>
          </CardContent>
        </Card>

        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Bounce Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-warning)]">{stats.failureRate}%</p>
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[var(--wl-border)]">
        <CardHeader><CardTitle className="text-sm">Notifications — Last 7 Days</CardTitle></CardHeader>
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

      <Card className="border border-[var(--wl-border)]">
        <CardHeader><CardTitle className="text-sm">Channel Breakdown</CardTitle></CardHeader>
        <CardContent><DonutChart data={channelBreakdown} /></CardContent>
      </Card>

      {data.failedTemplates.length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader><CardTitle className="text-sm">Top Failed Templates</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.failedTemplates.map((template, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
