"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, TrendingUp } from "lucide-react";
import { useApiList } from "@/hooks/use-api";

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

const CHANNEL_COLORS: Record<string, string> = {
  email: "#3B82F6",
  sms: "#10B981",
  whatsapp: "#25D366",
  push: "#F59E0B",
};

const SimpleLineChart = ({ data }: { data: NotificationStat[] }) => {
  if (data.length === 0) return <div className="h-16 flex items-center justify-center text-xs text-gray-500">No data</div>;
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="h-16 relative flex items-end gap-1 px-2">
      {data.map((d, idx) => (
        <div
          key={idx}
          className="flex-1 bg-[var(--wl-primary)]/40 hover:bg-[var(--wl-primary)]/60 rounded-t transition-colors"
          style={{ height: `${(d.count / maxValue) * 60}px` }}
          title={`${d.count} notifications`}
        />
      ))}
    </div>
  );
};

const DonutChart = ({ data }: { data: Record<string, { count: number; percentage: number }> }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const channels = Object.entries(data);
  let offset = 0;
  const segments = channels.map(([channel, stats]) => {
    const segmentLength = (stats.percentage / 100) * circumference;
    const dashoffset = offset;
    offset += segmentLength;
    return { channel, percentage: stats.percentage, dashArray: `${segmentLength} ${circumference}`, dashOffset: dashoffset };
  });

  const totalAvg = Math.round(channels.reduce((sum, [, s]) => sum + s.count, 0) / 7);

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {segments.map((seg) => (
            <circle
              key={segment.channel}
              cx="50" cy="50" r={radius} fill="none"
              stroke={CHANNEL_COLORS[segment.channel] ?? "#6B7280"}
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
            <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{totalAvg}</p>
            <p className="text-xs text-[var(--wl-text-secondary)]">avg/day</p>
          </div>
        </div>
      </div>
      <div className="ml-4 space-y-2">
        {channels.map(([channel, stats]) => (
          <div key={channel} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[channel] ?? "#6B7280" }} />
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
  const { items: logs, loading } = useApiList<any>("/api/v4/notifications/delivery-log", { limit: 200 });

  const { dailyStats, channelBreakdown, failedTemplates, stats } = useMemo(() => {
    if (logs.length === 0) {
      return { dailyStats: [], channelBreakdown: {}, failedTemplates: [], stats: { totalToday: 0, changePercent: "0", failureRate: "0", failedCount: 0 } };
    }

    // Build daily stats for last 7 days
    const now = new Date();
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap[d.toDateString()] = 0;
    }
    logs.forEach((log) => {
      const d = new Date(log.sentAt ?? log.createdAt ?? Date.now()).toDateString();
      if (d in dayMap) dayMap[d]++;
    });
    const dailyStats: NotificationStat[] = Object.entries(dayMap).map(([ds, count]) => ({ timestamp: new Date(ds), count }));

    const totalToday = dailyStats[dailyStats.length - 1]?.count ?? 0;
    const totalYesterday = dailyStats[dailyStats.length - 2]?.count ?? 0;
    const changePercent = totalYesterday > 0
      ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1)
      : "0";

    // Channel breakdown
    const channelCounts: Record<string, number> = {};
    logs.forEach((log) => {
      const ch = (log.channel ?? "email").toLowerCase();
      channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
    });
    const totalLogs = logs.length;
    const channelBreakdown: Record<string, { count: number; percentage: number }> = {};
    Object.entries(channelCounts).forEach(([ch, count]) => {
      channelBreakdown[ch] = { count, percentage: Math.round((count / totalLogs) * 100) };
    });

    // Failed logs
    const failed = logs.filter((log) => log.status === "FAILED" || log.status === "BOUNCED");
    const failedCount = failed.length;
    const failureRate = totalLogs > 0 ? ((failedCount / totalLogs) * 100).toFixed(1) : "0";

    // Failed templates (group by template name)
    const templateFails: Record<string, number> = {};
    failed.forEach((log) => {
      const name = log.templateName ?? log.template ?? "Unknown Template";
      templateFails[name] = (templateFails[name] ?? 0) + 1;
    });
    const failedTemplates = Object.entries(templateFails)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, failureCount]) => ({
        name,
        failureCount,
        failureRate: totalLogs > 0 ? ((failureCount / totalLogs) * 100).toFixed(1) : "0",
      }));

    return { dailyStats, channelBreakdown, failedTemplates, stats: { totalToday, changePercent, failureRate, failedCount } };
  }, [logs]);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Sent Today</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">{stats.totalToday}</p>
              <div className={cn("flex items-center gap-1 text-xs font-semibold", parseFloat(stats.changePercent) >= 0 ? "text-[var(--wl-success)]" : "text-[var(--wl-danger)]")}>
                <TrendingUp className="w-3 h-3" />
                {parseFloat(stats.changePercent) > 0 ? "+" : ""}{stats.changePercent}%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[var(--wl-border)]">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">Delivery Rate</p>
            <p className="text-2xl font-bold text-[var(--wl-success)]">{(100 - parseFloat(stats.failureRate)).toFixed(1)}%</p>
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
          <SimpleLineChart data={dailyStats} />
          {dailyStats.length >= 2 && (
            <div className="flex justify-between mt-4 px-2 text-xs text-[var(--wl-text-secondary)]">
              <span>{dailyStats[0]?.timestamp.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              <span>{dailyStats[dailyStats.length - 1]?.timestamp.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(channelBreakdown).length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader><CardTitle className="text-sm">Channel Breakdown</CardTitle></CardHeader>
          <CardContent><DonutChart data={channelBreakdown} /></CardContent>
        </Card>
      )}

      {failedTemplates.length > 0 && (
        <Card className="border border-[var(--wl-border)]">
          <CardHeader><CardTitle className="text-sm">Top Failed Templates</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedTemplates.map((template, idx) => (
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
