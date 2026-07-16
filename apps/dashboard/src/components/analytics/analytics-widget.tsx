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

const EmptyState = ({ label = "No data" }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center h-40 text-center p-4">
    <p className="text-sm text-wl-text-tertiary mb-1">{label}</p>
    <p className="text-xs text-wl-text-tertiary opacity-60">Connect a data source to display this widget</p>
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
        return <EmptyState label="No metric data" />;
      case "line-chart":
        return <EmptyState label="No chart data" />;
      case "bar-chart":
        return <EmptyState label="No chart data" />;
      case "pie-chart":
        return <EmptyState label="No breakdown data" />;
      case "table":
        return <EmptyState label="No table data" />;
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
