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
} from "lucide-react";

type WidgetMode =
  | "metric"
  | "line-chart"
  | "bar-chart"
  | "pie-chart"
  | "table";

interface WidgetConfig {
  id: string;
  title: string;
  mode: WidgetMode;
  dataSource: string;
  width?: "1/2" | "1/3" | "full";
}

interface AnalyticsWidgetProps {
  config?: WidgetConfig;
  onRefresh?: () => void;
  onResize?: (width: string) => void;
  className?: string;
}

// Mock data for different modes
const mockMetricData = {
  value: "24,850",
  unit: "Active Users",
  change: "+12.5%",
  trendUp: true,
};

const mockChartData = [
  { label: "Mon", value: 65 },
  { label: "Tue", value: 78 },
  { label: "Wed", value: 72 },
  { label: "Thu", value: 89 },
  { label: "Fri", value: 94 },
  { label: "Sat", value: 85 },
  { label: "Sun", value: 92 },
];

const mockPieData = [
  { label: "Product A", value: 45, color: "wl-primary-400" },
  { label: "Product B", value: 30, color: "wl-success-400" },
  { label: "Product C", value: 15, color: "wl-info-400" },
  { label: "Product D", value: 10, color: "wl-warning-400" },
];

const mockTableData = [
  { name: "Revenue", value: "$45,234", trend: "+8.2%" },
  { name: "Conversions", value: "3,428", trend: "+5.1%" },
  { name: "Avg Order Value", value: "$156.89", trend: "-2.3%" },
  { name: "Cost per Acquisition", value: "$12.45", trend: "+1.2%" },
];

const defaultConfig: WidgetConfig = {
  id: "widget-1",
  title: "Revenue Overview",
  mode: "metric",
  dataSource: "analytics-api",
};

const MetricCard = ({ data }: { data: typeof mockMetricData }) => (
  <div className="text-center py-6">
    <p className="text-5xl font-bold text-wl-text-primary mb-2">
      {data.value}
    </p>
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

const LineChart = ({ data }: { data: typeof mockChartData }) => {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="p-4">
      <div className="flex items-end gap-1 h-40">
        {data.map((point, idx) => (
          <div
            key={idx}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full bg-gradient-to-t from-wl-primary-500 to-wl-primary-400 rounded-t transition-all hover:opacity-80"
              style={{
                height: `${(point.value / maxValue) * 100}%`,
                minHeight: "4px",
              }}
            />
            <p className="text-xs text-wl-text-tertiary">{point.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ data }: { data: typeof mockChartData }) => {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="p-4 space-y-3">
      {data.map((point, idx) => (
        <div key={idx}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-wl-text-primary">
              {point.label}
            </p>
            <p className="text-xs text-wl-text-tertiary">{point.value}</p>
          </div>
          <div className="w-full h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wl-success-500 to-wl-success-400 rounded-full transition-all"
              style={{
                width: `${(point.value / maxValue) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const PieChart = ({ data }: { data: typeof mockPieData }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-4 flex items-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          style={{ transform: "rotate(-90deg)" }}
        >
          {data.reduce(
            (acc, item, idx) => {
              const percentage = item.value / total;
              const circumference = 2 * Math.PI * 45;
              const strokeDashoffset =
                circumference * (1 - percentage);
              const rotation =
                data.slice(0, idx).reduce((s, d) => s + (d.value / total) * 360, 0);

              return (
                acc +
                `<circle
                  cx="60" cy="60" r="45"
                  fill="none"
                  stroke="var(--${item.color})"
                  strokeWidth="10"
                  strokeDasharray="${circumference}"
                  strokeDashoffset="${strokeDashoffset}"
                  style="transform: rotate(${rotation}deg); transform-origin: 60px 60px;"
                />`
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
            <div
              className={`w-2 h-2 rounded-full bg-${item.color}`}
            />
            <span className="text-wl-text-secondary">{item.label}</span>
            <span className="ml-auto font-semibold text-wl-text-primary">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DataTable = ({ data }: { data: typeof mockTableData }) => (
  <div className="p-4">
    <div className="space-y-3">
      {data.map((row, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-2 rounded bg-wl-bg-overlay"
        >
          <div>
            <p className="text-sm font-medium text-wl-text-primary">
              {row.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-wl-text-primary">
              {row.value}
            </p>
            <p className="text-xs text-wl-text-tertiary">{row.trend}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsWidget = ({
  config = defaultConfig,
  onRefresh,
  onResize,
  className,
}: AnalyticsWidgetProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const renderContent = () => {
    switch (config.mode) {
      case "metric":
        return <MetricCard data={mockMetricData} />;
      case "line-chart":
        return <LineChart data={mockChartData} />;
      case "bar-chart":
        return <BarChart data={mockChartData} />;
      case "pie-chart":
        return <PieChart data={mockPieData} />;
      case "table":
        return <DataTable data={mockTableData} />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <div className="flex items-center justify-between p-4 border-b border-wl-border-default">
        <div className="flex items-center gap-2">
          <GripVerticalIcon className="w-4 h-4 text-wl-text-tertiary cursor-grab" />
          <div>
            <h4 className="text-sm font-semibold text-wl-text-primary">
              {config.title}
            </h4>
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
              className={cn(
                "w-4 h-4",
                isRefreshing && "animate-spin"
              )}
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResize?.("full")}
          >
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
export type { WidgetConfig, AnalyticsWidgetProps, WidgetMode };
