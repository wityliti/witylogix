"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ProviderComparisonProps, IntegrationConnection as Provider } from "./types";

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

  // Derive metric value from provider data where possible
  const getMetricValue = (provider: Provider, metric: string): number => {
    switch (metric) {
      case "latency":
        return (provider as any).latency ?? 0;
      case "uptime":
        return (provider as any).uptime ?? (provider.status === "connected" ? 99.9 : 95.0);
      case "cost":
        return (provider as any).cost ?? 0;
      case "features":
        return (provider as any).featureCount ?? 0;
      case "rate-limits":
        return (provider as any).rateLimit ?? 0;
      default:
        return 0;
    }
  };

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

  const getMetricUnit = (): string => {
    switch (selectedMetrics) {
      case "latency":
        return "ms";
      case "uptime":
        return "%";
      case "cost":
        return "$";
      case "features":
        return "";
      case "rate-limits":
        return "";
      default:
        return "";
    }
  };

  // Determine best value
  const getBestValue = () => {
    const values = comparisonProviders.map((p) => getMetricValue(p, selectedMetrics));
    if (selectedMetrics === "cost" || selectedMetrics === "latency") {
      return Math.min(...values);
    }
    return Math.max(...values);
  };

  const isBestValue = (value: number): boolean => {
    const best = getBestValue();
    return value === best;
  };

  // Features matrix derived from provider data where possible
  const features = [
    { name: "Real-time Sync" },
    { name: "Webhook Support" },
    { name: "Rate Limiting" },
    { name: "OAuth 2.0" },
    { name: "API Key Auth" },
    { name: "Bulk Operations" },
  ];

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
            {comparisonProviders.map((provider) => {
              const value = getMetricValue(provider, selectedMetrics);
              const max =
                selectedMetrics === "cost"
                  ? 600
                  : selectedMetrics === "latency"
                    ? 400
                    : selectedMetrics === "uptime"
                      ? 100
                      : selectedMetrics === "features"
                        ? 25
                        : 60000;

              const percentage = (value / max) * 100;
              const isBest = isBestValue(value);

              // For cost and latency, lower is better, so invert percentage for bar display
              const displayPercentage =
                selectedMetrics === "cost" || selectedMetrics === "latency"
                  ? 100 - percentage
                  : percentage;

              const barColor = isBest ? "var(--wl-success-500)" : "var(--wl-primary-500)";

              return (
                <div key={provider.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-wl-text-primary">
                      {provider.name}
                      {isBest && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900/30 dark:text-wl-success-300">
                          Best Value
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-semibold text-wl-text-primary">
                      {selectedMetrics === "uptime"
                        ? value.toFixed(2)
                        : selectedMetrics === "cost"
                          ? `$${value.toFixed(2)}`
                          : selectedMetrics === "latency"
                            ? `${Math.round(value)}ms`
                            : selectedMetrics === "features"
                              ? Math.round(value)
                              : Math.round(value).toLocaleString()}{" "}
                      {getMetricUnit()}
                    </span>
                  </div>
                  <div className="relative h-2 bg-wl-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${displayPercentage}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature support matrix */}
        <div>
          <h4 className="text-sm font-semibold text-wl-text-primary mb-4">Feature Support</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle">
                  <th className="text-left py-3 px-3 font-semibold text-wl-text-primary">
                    Feature
                  </th>
                  {comparisonProviders.map((provider) => (
                    <th
                      key={provider.id}
                      className="text-center py-3 px-3 font-semibold text-wl-text-primary"
                    >
                      {provider.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, featureIdx) => (
                  <tr
                    key={feature.name}
                    className={cn(
                      "border-b border-wl-border-subtle",
                      featureIdx % 2 === 1 && "bg-wl-surface-hover"
                    )}
                  >
                    <td className="py-3 px-3 text-wl-text-primary">{feature.name}</td>
                    {comparisonProviders.map((provider) => {
                      const supported =
                        (provider as any).features?.includes(feature.name) ??
                        (provider as any).capabilities?.includes(feature.name) ??
                        null;
                      return (
                        <td
                          key={`${feature.name}-${provider.id}`}
                          className="text-center py-3 px-3"
                        >
                          {supported === null ? (
                            <span className="text-xs text-wl-text-secondary">—</span>
                          ) : supported ? (
                            <span className="text-lg text-wl-success-600">✓</span>
                          ) : (
                            <span className="text-lg text-wl-danger-400">✗</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-8 pt-8 border-t border-wl-border-subtle grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comparisonProviders.map((provider) => {
            const providerFeatures: string[] =
              (provider as any).features ?? (provider as any).capabilities ?? [];
            const featureCount = features.filter(
              (f) => providerFeatures.includes(f.name)
            ).length;

            return (
              <div
                key={provider.id}
                className="p-4 rounded-lg border border-wl-border-subtle bg-wl-surface-hover"
              >
                <div className="font-semibold text-wl-text-primary mb-2">{provider.name}</div>
                <div className="text-sm text-wl-text-secondary space-y-1">
                  <div>Status: {provider.status}</div>
                  <div>Category: {provider.category}</div>
                  <div>Features: {featureCount} supported</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
