"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useProviderDetail,
  type ProviderMetrics,
} from "@/hooks/use-integration-health";
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";

/**
 * Provider Detail Page
 * Metrics, latency charts, error breakdown, request logs, incidents, config
 */

interface TimeRange {
  label: string;
  value: "1h" | "6h" | "24h" | "7d";
}

const TIME_RANGES: TimeRange[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

function LatencyChart({ metrics }: { metrics: ProviderMetrics | null }) {
  if (!metrics) return null;

  const maxLatency = Math.max(
    metrics.latencyP50,
    metrics.latencyP95,
    metrics.latencyP99
  );
  const scale = maxLatency > 0 ? 200 / maxLatency : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 h-40 px-4 py-6 bg-wl-bg-tertiary rounded-lg border border-wl-neutral-700">
        {/* P50 */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-gradient-to-t from-wl-primary-500 to-wl-primary-400 rounded-t transition-all"
            style={{ height: `${metrics.latencyP50 * scale}px` }}
          />
          <div className="text-center text-xs">
            <p className="text-wl-text-secondary">P50</p>
            <p className="font-medium text-wl-text-primary">
              {metrics.latencyP50}ms
            </p>
          </div>
        </div>

        {/* P95 */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-gradient-to-t from-wl-warning-500 to-wl-warning-400 rounded-t transition-all"
            style={{ height: `${metrics.latencyP95 * scale}px` }}
          />
          <div className="text-center text-xs">
            <p className="text-wl-text-secondary">P95</p>
            <p className="font-medium text-wl-text-primary">
              {metrics.latencyP95}ms
            </p>
          </div>
        </div>

        {/* P99 */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-gradient-to-t from-wl-danger-500 to-wl-danger-400 rounded-t transition-all"
            style={{ height: `${metrics.latencyP99 * scale}px` }}
          />
          <div className="text-center text-xs">
            <p className="text-wl-text-secondary">P99</p>
            <p className="font-medium text-wl-text-primary">
              {metrics.latencyP99}ms
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-wl-primary-500" />
          <span className="text-wl-text-secondary">P50 (50th percentile)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-wl-warning-500" />
          <span className="text-wl-text-secondary">P95 (95th percentile)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-wl-danger-500" />
          <span className="text-wl-text-secondary">P99 (99th percentile)</span>
        </div>
      </div>
    </div>
  );
}

function ErrorBreakdown({ metrics }: { metrics: ProviderMetrics | null }) {
  if (!metrics || !metrics.errorBreakdown) return null;

  const total = Object.values(metrics.errorBreakdown).reduce(
    (sum, val) => sum + val,
    0
  );
  const entries = Object.entries(metrics.errorBreakdown).sort(
    (a, b) => b[1] - a[1]
  );

  const colors = [
    "bg-wl-danger-500",
    "bg-wl-warning-500",
    "bg-wl-info-500",
    "bg-wl-primary-500",
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Pie Chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 rounded-full border-8 flex items-center justify-center" style={{
              borderColor: `conic-gradient(${entries.map((e, i) => `${colors[i % colors.length].replace('bg-', '')} ${(e[1] / total) * 360}deg`).join(', ')}`
            }}>
              <div className="text-center bg-wl-bg-secondary rounded-full w-24 h-24 flex items-center justify-center">
                <div>
                  <p className="text-sm text-wl-text-secondary">Total</p>
                  <p className="text-2xl font-bold text-wl-text-primary">
                    {total}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div key={entry[0]} className="flex items-center gap-3">
              <div
                className={cn("w-3 h-3 rounded", colors[idx % colors.length])}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-wl-text-primary">
                  {entry[0]}
                </p>
                <p className="text-xs text-wl-text-secondary">
                  {entry[1]} ({((entry[1] / total) * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  const [selectedProviderId, setSelectedProviderId] = useState("stripe");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [configMode, setConfigMode] = useState(false);

  const { metrics, isLoading, error, updateConfiguration } =
    useProviderDetail(selectedProviderId);

  const circuitBreakerColor = useMemo(() => {
    if (!metrics) return "text-wl-text-secondary";
    if (metrics.currentCircuitBreaker === "closed")
      return "text-wl-success-400";
    if (metrics.currentCircuitBreaker === "half-open")
      return "text-wl-warning-400";
    return "text-wl-danger-400";
  }, [metrics?.currentCircuitBreaker]);

  if (error) {
    return (
      <div className="rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/20 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-wl-danger-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-wl-text-primary">
              Failed to load provider
            </h3>
            <p className="text-sm text-wl-text-secondary mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Selector */}
      <div>
        <label className="block text-sm font-medium text-wl-text-primary mb-2">
          Select Provider
        </label>
        <select
          value={selectedProviderId}
          onChange={(e) => setSelectedProviderId(e.target.value)}
          className="w-full md:w-80 px-3 py-2 rounded-lg bg-wl-bg-secondary border border-wl-neutral-700 text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
        >
          <optgroup label="Payment">
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </optgroup>
          <optgroup label="Shipping">
            <option value="fedex">FedEx</option>
            <option value="ups">UPS</option>
            <option value="usps">USPS</option>
          </optgroup>
          <optgroup label="ERP">
            <option value="sap">SAP</option>
            <option value="oracle">Oracle</option>
          </optgroup>
        </select>
      </div>

      {/* Status Header */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-wl-bg-secondary border-wl-neutral-700">
            <CardContent className="pt-6">
              <p className="text-sm text-wl-text-secondary mb-2">Uptime</p>
              <p className="text-3xl font-bold text-wl-text-primary">
                {metrics.uptime.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border-wl-neutral-700">
            <CardContent className="pt-6">
              <p className="text-sm text-wl-text-secondary mb-2">SLA Target</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-wl-text-primary">
                  {metrics.slaTarget}%
                </p>
                {metrics.uptime >= metrics.slaTarget ? (
                  <CheckCircle className="w-4 h-4 text-wl-success-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-wl-warning-400" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border-wl-neutral-700">
            <CardContent className="pt-6">
              <p className="text-sm text-wl-text-secondary mb-2">Circuit Breaker</p>
              <p className={cn("text-lg font-bold capitalize", circuitBreakerColor)}>
                {metrics.currentCircuitBreaker}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-secondary border-wl-neutral-700">
            <CardContent className="pt-6">
              <p className="text-sm text-wl-text-secondary mb-2">Avg Latency</p>
              <p className="text-2xl font-bold text-wl-text-primary">
                {Math.round(metrics.latencyP50)}ms
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Latency Chart */}
      <Card className="bg-wl-bg-secondary border-wl-neutral-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Latency by Percentile</CardTitle>
            <div className="flex gap-1">
              {TIME_RANGES.map((range) => (
                <Button
                  key={range.value}
                  size="sm"
                  variant={timeRange === range.value ? "primary" : "ghost"}
                  onClick={() => setTimeRange(range.value)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LatencyChart metrics={metrics} />
        </CardContent>
      </Card>

      {/* Error Breakdown */}
      <Card className="bg-wl-bg-secondary border-wl-neutral-700">
        <CardHeader>
          <CardTitle>Error Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBreakdown metrics={metrics} />
        </CardContent>
      </Card>

      {/* Recent Requests */}
      {metrics?.recentRequests && metrics.recentRequests.length > 0 && (
        <Card className="bg-wl-bg-secondary border-wl-neutral-700">
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-neutral-700">
                    <th className="text-left py-2 px-3 text-wl-text-secondary font-medium">
                      Status
                    </th>
                    <th className="text-left py-2 px-3 text-wl-text-secondary font-medium">
                      Endpoint
                    </th>
                    <th className="text-left py-2 px-3 text-wl-text-secondary font-medium">
                      Latency
                    </th>
                    <th className="text-left py-2 px-3 text-wl-text-secondary font-medium">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentRequests.slice(0, 10).map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-wl-neutral-700 hover:bg-wl-bg-tertiary"
                    >
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            req.status < 400
                              ? "success"
                              : req.status < 500
                                ? "warning"
                                : "danger"
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-wl-text-primary font-mono text-xs">
                        {req.endpoint}
                      </td>
                      <td className="py-2 px-3 text-wl-text-primary">
                        {req.latency}ms
                      </td>
                      <td className="py-2 px-3 text-wl-text-secondary text-xs">
                        {new Date(req.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incident History Timeline */}
      {metrics?.incidents && metrics.incidents.length > 0 && (
        <Card className="bg-wl-bg-secondary border-wl-neutral-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Incident History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.incidents.map((incident, idx) => (
                <div key={incident.id} className="flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        incident.resolved
                          ? "bg-wl-success-500"
                          : "bg-wl-warning-500"
                      )}
                    />
                    {idx < metrics.incidents.length - 1 && (
                      <div className="w-px h-12 bg-wl-neutral-700 my-2" />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium text-wl-text-primary">
                      {incident.title}
                    </p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {new Date(incident.timestamp).toLocaleString()}
                    </p>
                    <Badge
                      variant={incident.resolved ? "success" : "warning"}
                      className="mt-2"
                    >
                      {incident.resolved ? "Resolved" : "Ongoing"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Panel */}
      <Card className="bg-wl-bg-secondary border-wl-neutral-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Configuration
            </CardTitle>
            <Button
              size="sm"
              variant={configMode ? "danger" : "secondary"}
              onClick={() => setConfigMode(!configMode)}
            >
              {configMode ? "Cancel" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-wl-text-primary">
                Rate Limit (req/s)
              </label>
              <input
                type="number"
                defaultValue="1000"
                disabled={!configMode}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-wl-bg-tertiary border border-wl-neutral-700 text-wl-text-primary disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-wl-text-primary">
                Timeout (ms)
              </label>
              <input
                type="number"
                defaultValue="5000"
                disabled={!configMode}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-wl-bg-tertiary border border-wl-neutral-700 text-wl-text-primary disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-wl-text-primary">
                Retry Policy
              </label>
              <select
                defaultValue="exponential"
                disabled={!configMode}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-wl-bg-tertiary border border-wl-neutral-700 text-wl-text-primary disabled:opacity-50"
              >
                <option value="exponential">Exponential Backoff</option>
                <option value="linear">Linear Backoff</option>
                <option value="fixed">Fixed Delay</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-wl-text-primary">
                Circuit Breaker Threshold
              </label>
              <input
                type="number"
                defaultValue="50"
                disabled={!configMode}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-wl-bg-tertiary border border-wl-neutral-700 text-wl-text-primary disabled:opacity-50"
              />
            </div>

            {configMode && (
              <Button className="w-full">Save Configuration</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
