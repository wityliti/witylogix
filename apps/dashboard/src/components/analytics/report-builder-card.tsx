"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClockIcon, TrashIcon, SaveIcon, EyeIcon } from "lucide-react";

type ChartType = "line" | "bar" | "pie" | "area" | "scatter";
type DataSource = "sales" | "inventory" | "customers" | "finance";

interface ReportBuilderCardProps {
  onSchedule?: (frequency: string) => void;
  onSave?: (config: ReportConfig) => void;
  className?: string;
}

interface ReportConfig {
  id: string;
  name: string;
  chartType: ChartType;
  dataSource: DataSource;
  dimensions: string[];
  measures: string[];
  filters: Array<{ field: string; operator: string; value: string }>;
  scheduled: boolean;
  frequency?: "daily" | "weekly" | "monthly";
}

const chartTypes: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "area", label: "Area Chart" },
  { value: "scatter", label: "Scatter Plot" },
];

const dataSources: { value: DataSource; label: string }[] = [
  { value: "sales", label: "Sales Data" },
  { value: "inventory", label: "Inventory" },
  { value: "customers", label: "Customer Analytics" },
  { value: "finance", label: "Financial Reports" },
];

const dimensionOptions = [
  "Month",
  "Region",
  "Product",
  "Category",
  "Salesperson",
];
const measureOptions = [
  "Revenue",
  "Units Sold",
  "Gross Margin",
  "Cost",
  "Count",
];

const defaultConfig: ReportConfig = {
  id: "report-1",
  name: "Monthly Sales Report",
  chartType: "bar",
  dataSource: "sales",
  dimensions: ["Month"],
  measures: ["Revenue"],
  filters: [],
  scheduled: false,
};

const ReportBuilderCard = ({
  onSchedule,
  onSave,
  className,
}: ReportBuilderCardProps) => {
  const [config, setConfig] = useState<ReportConfig>(defaultConfig);
  const [showPreview, setShowPreview] = useState(false);

  const addFilter = () => {
    const newFilters = [
      ...config.filters,
      { field: "Region", operator: "equals", value: "" },
    ];
    setConfig({ ...config, filters: newFilters });
  };

  const removeFilter = (index: number) => {
    const newFilters = config.filters.filter((_, i) => i !== index);
    setConfig({ ...config, filters: newFilters });
  };

  const toggleMeasure = (measure: string) => {
    const newMeasures = config.measures.includes(measure)
      ? config.measures.filter((m) => m !== measure)
      : [...config.measures, measure];
    setConfig({ ...config, measures: newMeasures });
  };

  const toggleDimension = (dimension: string) => {
    const newDimensions = config.dimensions.includes(dimension)
      ? config.dimensions.filter((d) => d !== dimension)
      : [...config.dimensions, dimension];
    setConfig({ ...config, dimensions: newDimensions });
  };

  return (
    <Card className={cn("w-full p-6 space-y-6", className)}>
      <div>
        <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
          Report Builder
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-wl-text-secondary mb-2">
            Report Name
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-sm text-wl-text-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-wl-text-secondary mb-2">
            Chart Type
          </label>
          <select
            value={config.chartType}
            onChange={(e) =>
              setConfig({
                ...config,
                chartType: e.target.value as ChartType,
              })
            }
            className="w-full px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-sm text-wl-text-primary"
          >
            {chartTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-wl-text-secondary mb-2">
          Data Source
        </label>
        <div className="grid grid-cols-2 gap-2">
          {dataSources.map((source) => (
            <button
              key={source.value}
              onClick={() => setConfig({ ...config, dataSource: source.value })}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                config.dataSource === source.value
                  ? "bg-wl-primary-500/20 border-wl-primary-400 text-wl-primary-400"
                  : "bg-wl-bg-surface border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong",
              )}
            >
              {source.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-wl-text-secondary mb-2">
          Dimensions
        </label>
        <div className="flex flex-wrap gap-2">
          {dimensionOptions.map((dimension) => (
            <button
              key={dimension}
              onClick={() => toggleDimension(dimension)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                config.dimensions.includes(dimension)
                  ? "bg-wl-info-500/20 border-wl-info-400 text-wl-info-400"
                  : "bg-wl-bg-surface border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong",
              )}
            >
              {dimension}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-wl-text-secondary mb-2">
          Measures
        </label>
        <div className="flex flex-wrap gap-2">
          {measureOptions.map((measure) => (
            <button
              key={measure}
              onClick={() => toggleMeasure(measure)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                config.measures.includes(measure)
                  ? "bg-wl-success-500/20 border-wl-success-400 text-wl-success-400"
                  : "bg-wl-bg-surface border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong",
              )}
            >
              {measure}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-wl-text-secondary">
            Filters
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addFilter}
            className="text-xs"
          >
            + Add Filter
          </Button>
        </div>

        {config.filters.map((filter, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Field"
              value={filter.field}
              onChange={(e) => {
                const newFilters = [...config.filters];
                newFilters[idx].field = e.target.value;
                setConfig({ ...config, filters: newFilters });
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-xs text-wl-text-primary"
            />
            <select
              value={filter.operator}
              onChange={(e) => {
                const newFilters = [...config.filters];
                newFilters[idx].operator = e.target.value;
                setConfig({ ...config, filters: newFilters });
              }}
              className="px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-xs text-wl-text-primary"
            >
              <option>equals</option>
              <option>contains</option>
              <option>greater than</option>
              <option>less than</option>
            </select>
            <input
              type="text"
              placeholder="Value"
              value={filter.value}
              onChange={(e) => {
                const newFilters = [...config.filters];
                newFilters[idx].value = e.target.value;
                setConfig({ ...config, filters: newFilters });
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-xs text-wl-text-primary"
            />
            <Button variant="ghost" size="sm" onClick={() => removeFilter(idx)}>
              <TrashIcon className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {showPreview && (
        <div className="p-4 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
          <p className="text-xs font-semibold text-wl-text-secondary mb-2">
            Preview
          </p>
          <div className="w-full h-24 flex items-center justify-center text-xs text-wl-text-secondary border border-dashed border-wl-border-default rounded">
            Run report to see preview
          </div>
        </div>
      )}

      <div className="p-4 bg-wl-bg-overlay rounded-lg border border-wl-border-default space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="scheduled"
            checked={config.scheduled}
            onChange={(e) =>
              setConfig({ ...config, scheduled: e.target.checked })
            }
            className="rounded"
          />
          <label htmlFor="scheduled" className="text-sm text-wl-text-secondary">
            Schedule Report
          </label>
        </div>

        {config.scheduled && (
          <select
            value={config.frequency}
            onChange={(e) =>
              setConfig({
                ...config,
                frequency: e.target.value as "daily" | "weekly" | "monthly",
              })
            }
            className="w-full px-3 py-2 rounded-lg bg-wl-bg-surface border border-wl-border-default text-sm text-wl-text-primary"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1"
        >
          <EyeIcon className="w-4 h-4" />
          {showPreview ? "Hide" : "Preview"}
        </Button>

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfig(defaultConfig)}
        >
          Reset
        </Button>

        {config.scheduled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSchedule?.(config.frequency || "daily")}
            className="gap-1"
          >
            <ClockIcon className="w-4 h-4" />
            Schedule
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave?.(config)}
          className="gap-1"
        >
          <SaveIcon className="w-4 h-4" />
          Save Report
        </Button>
      </div>
    </Card>
  );
};

export { ReportBuilderCard };
export type { ReportConfig, ReportBuilderCardProps };
