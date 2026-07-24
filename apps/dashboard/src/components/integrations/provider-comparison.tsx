"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type {
  ProviderComparisonProps,
  IntegrationConnection as Provider,
} from "./types";

/**
 * Provider comparison component
 * Side-by-side comparison table for up to 4 providers
 * Shows metrics, features, and recommendations
 */
export function ProviderComparison({
  providers,
  metrics: selectedMetrics,
  maxCompare = 4,
  className,
}: ProviderComparisonProps) {
  // Get selected providers to compare
  const comparisonProviders = useMemo(() => {
    return providers.slice(0, maxCompare);
  }, [providers, maxCompare]);

  const getMetricLabel = (): string => {
    switch (selectedMetrics) {
      case "latency":
        return "Response Time (ms) - Lower is better";
      case "uptime":
        return "Uptime (%) - Higher is better";
      case "cost":
        return "Monthly Cost ($) - Lower is better";
      case "features":
        return "Number of Features - Higher is better";
      case "rate-limits":
        return "Rate Limit (req/hr) - Higher is better";
      default:
        return "Metrics";
    }
  };

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-wl-text-primary mb-1">
            Provider Comparison
          </h3>
          <p className="text-sm text-wl-text-secondary">
            Comparing {comparisonProviders.length} integration providers
          </p>
        </div>

        {/* Metric comparison */}
        <div className="mb-8 pb-8 border-b border-wl-border-subtle">
          <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
            {getMetricLabel()}
          </h4>
          <div className="space-y-4">
            {comparisonProviders.map((provider) => (
              <div key={provider.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-wl-text-primary">
                    {provider.name}
                  </span>
                  <span className="text-sm text-wl-text-secondary">
                    No data
                  </span>
                </div>
                <div className="relative h-2 bg-wl-surface-hover rounded-full overflow-hidden">
                  <div className="h-full w-0 rounded-full bg-wl-primary-500" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-wl-text-secondary">
            Metric data will appear once providers report performance
            statistics.
          </p>
        </div>

        {/* Feature support matrix */}
        <div>
          <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
            Feature Support
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle">
                  <th className="text-left py-3 px-3 font-semibold text-wl-text-primary">
                    Provider
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-wl-text-primary">
                    Status
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-wl-text-primary">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonProviders.map((provider, idx) => (
                  <tr
                    key={provider.id}
                    className={cn(
                      "border-b border-wl-border-subtle",
                      idx % 2 === 1 && "bg-wl-surface-hover",
                    )}
                  >
                    <td className="py-3 px-3 text-wl-text-primary font-medium">
                      {provider.name}
                    </td>
                    <td className="py-3 px-3 text-center text-wl-text-secondary">
                      {provider.status}
                    </td>
                    <td className="py-3 px-3 text-center text-wl-text-secondary">
                      {provider.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-wl-text-secondary">
            Detailed feature matrix requires provider capability data from the
            API.
          </p>
        </div>

        {/* Summary cards */}
        <div className="mt-8 pt-8 border-t border-wl-border-subtle grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comparisonProviders.map((provider) => (
            <div
              key={provider.id}
              className="p-4 rounded-lg border border-wl-border-subtle bg-wl-surface-hover"
            >
              <div className="font-semibold text-wl-text-primary mb-2">
                {provider.name}
              </div>
              <div className="text-sm text-wl-text-secondary space-y-1">
                <div>Status: {provider.status}</div>
                <div>Category: {provider.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
