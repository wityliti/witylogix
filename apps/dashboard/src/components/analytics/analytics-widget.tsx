"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GripVerticalIcon,
  MoreVerticalIcon,
  RotateCwIcon,
  MaximizeIcon,
  BarChart3Icon,
} from "lucide-react";

type WidgetMode = "metric" | "line-chart" | "bar-chart" | "pie-chart" | "table";

interface MetricData {
  value: string;
  unit: string;
  change: string;
  trendUp: boolean;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface TableRow {
  name: string;
  value: string;
  trend: string;
}

interface WidgetData {
  metric?: MetricData;
  chart?: ChartPoint[];
  pie?: PieSlice[];
  table?: TableRow[];
}

interface WidgetConfig {
  id: string;
  title: string;
  mode: WidgetMode;
  dataSource: string;
  width?: "1/2" | "1/3" | "full";
}

interface AnalyticsWidgetProps {
  config?: WidgetConfig;
  data?: WidgetData;
  onRefresh?: () => void;
  onResize?: (width: string) => void;
  className?: string;
}

const defaultConfig: WidgetConfig = {
  id: "widget-1",
  title: "Analytics Widget",
  mode: "metric",
  dataSource: "analytics-api",
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-10 text-wl-text-tertiary">
    <BarChart3Icon className="w-8 h-8 mb-2 opacity-30" />
    <p className="text-sm">No data available</p>
  </div>
);

const MetricCard = ({ data }: { data: MetricData }) => (
  <div className="text-center py-6">
    <p className="text-5xl font-bold text-wl-text-primary mb-2">{data.value}</p>
    <p className="text-sm text-wl-text-tertiary mb-2">{data.unit}</p>
    <p
      className={cn(
        "text-sm font-semibold",
        data.trendUp ? "text-wl-success-400" : "text-wl-danger-400"
      )}
    >
      {data.change}
    </p>
  </div>
);

const LineChart = ({ data }: { data: ChartPoint[] }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="p-4">
      <div className="flex items-end gap-1 h-40">
        {data.map((point, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-gradient-to-t from-wl-primary-500 to-wl-primary-400 rounded-t transition-all hover:opacity-80"
              style={{ height: `${(point.value / maxValue) * 100}%`, minHeight: "4px" }}
            />
            <p className="text-xs text-wl-text-tertiary">{point.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ data }: { data: ChartPoint[] }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="p-4 space-y-3">
      {data.map((point, idx) => (
        <div key={idx}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-wl-text-primary">{point.label}</p>
            <p className="text-xs text-wl-text-tertiary">{point.value}</p>
          </div>
          <div className="w-full h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wl-success-500 to-wl-success-400 rounded-full transition-all"
              style={{ width: `${(point.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const PieChart = ({ data }: { data: PieSlice[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  return (
    <div className="p-4 flex items-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          {data.reduce(
            (acc, item, idx) => {
              const percentage = item.value / total;
              const circumference = 2 * Math.PI * 45;
              const strokeDashoffset = circumference * (1 - percentage);
              const rotation = data
                .slice(0, idx)
                .reduce((s, d) => s + (d.value / total) * 360, 0);
              return (
                acc +
                `<circle cx="60" cy="60" r="45" fill="none" stroke="var(--${item.color})" strokeWidth="10" strokeDasharray="${circumference}" strokeDashoffset="${strokeDashoffset}" style="transform: rotate(${rotation}deg); transform-origin: 60px 60px;" />`
              );
            },
            ""
          )}
        </svg>
        <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-wl-text-primary">
          {total}
        </p>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full bg-${item.color}`} />
            <span className="text-wl-text-secondary">{item.label}</span>
            <span className="ml-auto font-semibold text-wl-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DataTable = ({ data }: { data: TableRow[] }) => (
  <div className="p-4">
    <div className="space-y-3">
      {data.map((row, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-2 rounded bg-wl-bg-overlay"
        >
          <p className="text-sm font-medium text-wl-text-primary">{row.name}</p>
          <div className="text-right">
            <p className="text-sm font-bold text-wl-text-primary">{row.value}</p>
            <p className="text-xs text-wl-text-tertiary">{row.trend}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsWidget = ({
  config = defaultConfig,
  data,
  onRefresh,
  onResize,
  className,
}: AnalyticsWidgetProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const renderContent = () => {
    switch (config.mode) {
      case "metric":
        return data?.metric ? <MetricCard data={data.metric} /> : <EmptyState />;
      case "line-chart":
        return data?.chart?.length ? <LineChart data={data.chart} /> : <EmptyState />;
      case "bar-chart":
        return data?.chart?.length ? <BarChart data={data.chart} /> : <EmptyState />;
      case "pie-chart":
        return data?.pie?.length ? <PieChart data={data.pie} /> : <EmptyState />;
      case "table":
        return data?.table?.length ? <DataTable data={data.table} /> : <EmptyState />;
      default:
        return <EmptyState />;
    }
  };

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <div className="flex items-center justify-between p-4 border-b border-wl-border-default">
        <div className="flex items-center gap-2">
          <GripVerticalIcon className="w-4 h-4 text-wl-text-tertiary cursor-grab" />
          <div>
            <h4 className="text-sm font-semibold text-wl-text-primary">{config.title}</h4>
            <p className="text-xs text-wl-text-tertiary">{config.dataSource}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RotateCwIcon
              className={cn("w-4 h-4", isRefreshing && "animate-spin")}
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onResize?.("full")}>
            <MaximizeIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreVerticalIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-40">{renderContent()}</div>
    </Card>
  );
};

export { AnalyticsWidget };
export type { WidgetConfig, AnalyticsWidgetProps, WidgetMode, WidgetData };
