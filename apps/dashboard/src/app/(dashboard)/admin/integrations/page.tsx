"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Link,
  Zap,
  Package,
  BarChart3,
  Mail,
} from "lucide-react";
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';

interface Integration {
  id: string;
  name: string;
  category: "payment" | "shipping" | "analytics" | "notification" | "inventory";
  status: "connected" | "disconnected" | "error";
  lastSyncTime: string;
  successRate: number;
  errorCount: number;
  totalSyncs: number;
  errors: Array<{ timestamp: string; message: string; code: string }>;
}

interface RawIntegration {
  slug: string;
  name: string;
  category: string;
  isEnabled: boolean;
  healthStatus: string | null;
  lastSyncAt: string | null;
}

function mapCategory(cat: string): Integration["category"] {
  const m: Record<string, Integration["category"]> = {
    PAYMENT: "payment",
    ROUTING: "shipping",
    ORDER_MANAGEMENT: "shipping",
    COMMUNICATION: "notification",
    INVENTORY: "inventory",
    ANALYTICS: "analytics",
  };
  return m[cat] ?? "analytics";
}

function mapStatus(raw: RawIntegration): Integration["status"] {
  if (!raw.isEnabled) return "disconnected";
  if (raw.healthStatus === "HEALTHY" || raw.healthStatus === "healthy" || !raw.healthStatus) return "connected";
  return "error";
}

function mapIntegration(raw: RawIntegration): Integration {
  return {
    id: raw.slug,
    name: raw.name,
    category: mapCategory(raw.category),
    status: mapStatus(raw),
    lastSyncTime: raw.lastSyncAt ? new Date(raw.lastSyncAt).toLocaleString() : "—",
    successRate: mapStatus(raw) === "error" ? 0 : 100,
    errorCount: mapStatus(raw) === "error" ? 1 : 0,
    totalSyncs: 0,
    errors: [],
  };
}

function StatusBadge({ status }: { status: "connected" | "disconnected" | "error" }) {
  const variants: Record<typeof status, any> = {
    connected: "success",
    disconnected: "warning",
    error: "danger",
  };

  const labels: Record<typeof status, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Error",
  };

  const icons: Record<typeof status, any> = {
    connected: CheckCircle2,
    disconnected: Clock,
    error: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <Badge variant={variants[status]} dot>
      {labels[status]}
    </Badge>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, any> = {
    payment: Zap,
    shipping: Package,
    analytics: BarChart3,
    notification: Mail,
    inventory: Link,
  };

  const Icon = icons[category] || Link;

  return <Icon className="w-4 h-4" />;
}

function IntegrationRow({
  integration,
  expanded,
  onToggle,
}: {
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#1e1e2e] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 hover:bg-[#1a1a2e] transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2 bg-[#1a1a2e] rounded-lg">
            <CategoryIcon category={integration.category} />
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white">
              {integration.name}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Last sync: {integration.lastSyncTime}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                {integration.successRate}%
              </p>
              <p className="text-xs text-gray-400">Success Rate</p>
            </div>

            <div className="text-right min-w-fit">
              <p className="text-sm font-semibold text-white">
                {integration.errorCount}
              </p>
              <p className="text-xs text-gray-400">Errors</p>
            </div>

            <StatusBadge status={integration.status} />

            <div className="ml-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-[#1a1a2e] border-t border-[#1e1e2e]">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Performance Metrics
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">
                    Total Syncs:
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {integration.totalSyncs.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">
                    Success Rate:
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    integration.successRate >= 99 ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {integration.successRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">
                    Error Count:
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    integration.errorCount === 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {integration.errorCount}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Actions
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm">
                  <RefreshCw className="w-4 h-4" />
                  Test Connection
                </Button>
                <Button variant="ghost" size="sm">
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm">
                  Settings
                </Button>
              </div>
            </div>
          </div>

          {integration.errors.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-semibold">
                Recent Errors ({integration.errors.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {integration.errors.map((error, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-red-600/50 rounded-md border border-red-500/30"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-red-500">
                          {error.code}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {error.message}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {error.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {integration.errors.length === 0 && (
            <div className="p-3 bg-emerald-600/50 rounded-md border border-emerald-500/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm text-emerald-500">
                No recent errors. Integration is operating normally.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: rawData, loading, error, refetch } = useApiQuery<{ integrations: RawIntegration[] }>('/api/v4/integrations');
  const integrations: Integration[] = useMemo(
    () => (rawData?.integrations ?? []).map(mapIntegration),
    [rawData]
  );

  const categories = useMemo(() => [
    { id: "payment", label: "Payment", count: integrations.filter(i => i.category === "payment").length },
    { id: "shipping", label: "Shipping", count: integrations.filter(i => i.category === "shipping").length },
    { id: "analytics", label: "Analytics", count: integrations.filter(i => i.category === "analytics").length },
    { id: "notification", label: "Notifications", count: integrations.filter(i => i.category === "notification").length },
    { id: "inventory", label: "Inventory", count: integrations.filter(i => i.category === "inventory").length },
  ], [integrations]);

  const filteredIntegrations = useMemo(() => {
    if (!selectedCategory) return integrations;
    return integrations.filter(i => i.category === selectedCategory);
  }, [integrations, selectedCategory]);

  const connectedCount = filteredIntegrations.filter(i => i.status === "connected").length;
  const errorCount = filteredIntegrations.filter(i => i.status === "error").length;
  const avgSuccessRate = filteredIntegrations.length > 0
    ? (filteredIntegrations.reduce((sum, i) => sum + i.successRate, 0) / filteredIntegrations.length).toFixed(2)
    : "0.00";

  if (loading && integrations.length === 0) return <LoadingSkeleton />;
  if (error && integrations.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[#12121a]">
      <Header
        title="Integration Health"
        subtitle="Monitor connected integrations and sync status"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              <Link className="w-4 h-4" />
              Add Integration
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Connected
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-500">
                  {connectedCount}
                </span>
                <span className="text-sm text-gray-400">
                  of {filteredIntegrations.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                Average Success Rate
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {avgSuccessRate}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                With Errors
              </p>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold",
                  errorCount === 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {errorCount}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !selectedCategory
                ? "bg-blue-600 text-white"
                : "bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#1e1e2e]"
            )}
          >
            All ({integrations.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white"
                  : "bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#1e1e2e]"
              )}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>

        {/* Integrations List */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {filteredIntegrations.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  No integrations found in this category.
                </div>
              ) : (
                filteredIntegrations.map(integration => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    expanded={expandedId === integration.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === integration.id ? null : integration.id
                      )
                    }
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Alert */}
        {errorCount > 0 && (
          <Card className="border border-red-600/30 bg-red-600/40">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-500">
                    {errorCount} Integration{errorCount !== 1 ? "s" : ""} Require Attention
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {errorCount === 1
                      ? "The SendGrid Email integration has authentication issues. Please update the API credentials."
                      : "Some integrations have encountered errors. Review and fix the issues to restore full functionality."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
