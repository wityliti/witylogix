"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useIntegrationStatus } from "@/hooks/use-integration-status";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/error-state";
import {
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  Zap,
  Copy,
  ExternalLink,
  Trash2,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
} from "lucide-react";

interface UsageMetric {
  label: string;
  value: number;
  unit: string;
  period: string;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: "success" | "warning" | "error";
}

interface ErrorEntry {
  id: string;
  timestamp: string;
  error: string;
  stackTrace: string;
  context?: string;
}

export default function IntegrationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const connectionId = params.providerId as string;

  const { connections, getStatus, pauseSync, resumeSync, forceSync, disconnect, isLoading: connectionsLoading, error: connectionsError, revalidate } =
    useIntegrationStatus({ enablePolling: true });

  const connection = getStatus(connectionId);

  const { data: usageData } = useApiQuery<{ usage: UsageMetric[] }>(
    connection ? `/api/v4/integrations/${connectionId}/usage` : null,
  );
  const { data: activityData } = useApiQuery<{ activity: ActivityLogEntry[] }>(
    connection ? `/api/v4/integrations/${connectionId}/activity` : null,
  );
  const { data: errorsData } = useApiQuery<{ errors: ErrorEntry[] }>(
    connection ? `/api/v4/integrations/${connectionId}/errors` : null,
  );

  const usageMetrics: UsageMetric[] = usageData?.usage ?? [];
  const activityLog: ActivityLogEntry[] = activityData?.activity ?? [];
  const errorLog: ErrorEntry[] = errorsData?.errors ?? [];

  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showTestResult, setShowTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (connectionsError && !connectionsLoading) return <ErrorState title="Failed to load integration" message={connectionsError} onRetry={revalidate} />;

  if (!connection) {
    const isLoading = connections.length === 0;
    return (
      <div className="space-y-8">
        <Link
          href="/integrations/connected"
          className="text-wl-info-500 hover:text-wl-info-400 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Connected Integrations
        </Link>

        <Card className="bg-wl-bg-elevated border-wl-border-default">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full border-2 border-wl-info-500 border-t-transparent animate-spin mx-auto mb-4" />
              ) : (
                <AlertCircle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
              )}
              <h2 className="text-xl font-semibold text-wl-text-primary mb-2">
                {isLoading ? "Loading…" : "Integration not found"}
              </h2>
              {!isLoading && (
                <>
                  <p className="text-wl-text-secondary mb-4">
                    The integration you&apos;re looking for doesn&apos;t exist or has been disconnected.
                  </p>
                  <Button variant="primary" asChild>
                    <Link href="/integrations/connected">View All Integrations</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHealthy =
    connection.status === "connected" && connection.errorCount === 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <Link
        href="/integrations/connected"
        className="text-wl-info-500 hover:text-wl-info-400 inline-flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Connected Integrations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-wl-info-500/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-wl-info-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-wl-text-primary">
              {connection.providerName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge
                variant={isHealthy ? "success" : "danger"}
              >
                {connection.status.charAt(0).toUpperCase() +
                  connection.status.slice(1)}
              </Badge>
              <span className="text-sm text-wl-text-secondary">
                Uptime: {connection.uptime}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDisconnectModal(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Usage Meters Grid */}
      {usageMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {usageMetrics.map((metric) => (
            <Card
              key={`${metric.label}-${metric.period}`}
              className="bg-wl-bg-elevated border-wl-border-default"
            >
              <CardContent className="pt-6">
                <div className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-2">
                  {metric.label} ({metric.period})
                </div>
                <div className="text-2xl font-bold text-wl-text-primary">
                  {metric.value.toLocaleString()}
                </div>
                <div className="text-xs text-wl-text-tertiary mt-1">
                  {metric.unit}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sync Controls */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardHeader>
              <CardTitle>Sync Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => resumeSync(connectionId)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => pauseSync(connectionId)}
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => forceSync(connectionId)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Force Sync
                </Button>
              </div>

              <div className="pt-4 border-t border-wl-border-default">
                <Button
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={async () => {
                    try {
                      const result = await api.post<{ message?: string }>(
                        `/api/v4/integrations/${connectionId}/test`,
                        {}
                      );
                      setShowTestResult({
                        success: true,
                        message: result.message ?? "Connection test completed",
                      });
                    } catch (err) {
                      setShowTestResult({
                        success: false,
                        message: err instanceof Error ? err.message : "Test failed",
                      });
                    }
                  }}
                >
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Result */}
          {showTestResult && (
            <Card
              className={cn(
                "bg-wl-bg-elevated border",
                showTestResult.success
                  ? "border-wl-success-500/20"
                  : "border-wl-danger-500/20"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {showTestResult.success ? (
                    <CheckCheck className="w-5 h-5 text-wl-success-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-wl-danger-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-wl-text-secondary">
                      {showTestResult.message}
                    </p>
                    <button
                      onClick={() => setShowTestResult(null)}
                      className="text-xs text-wl-text-tertiary hover:text-wl-text-secondary mt-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link href="/integrations/logs">
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLog.length === 0 ? (
                <p className="text-sm text-wl-text-tertiary text-center py-4">No activity recorded yet.</p>
              ) : (
                activityLog.map((entry) => {
                  const time = new Date(entry.timestamp);
                  const diffMs = new Date().getTime() - time.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMins / 60);

                  let timeStr = `${diffMins}m ago`;
                  if (diffHours > 0) timeStr = `${diffHours}h ago`;
                  if (diffMins < 1) timeStr = "just now";

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 rounded-lg border-l-2",
                        entry.status === "success"
                          ? "border-l-emerald-500 bg-wl-success-bg"
                          : "border-l-amber-500 bg-wl-warning-bg"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-wl-text-secondary">
                            {entry.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-wl-text-tertiary mt-1">
                            {entry.description}
                          </p>
                        </div>
                        <span className="text-xs text-wl-text-tertiary whitespace-nowrap ml-2">
                          {timeStr}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Error Log */}
          {errorLog.length > 0 && (
            <Card className="bg-wl-bg-elevated border-wl-border-default">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-wl-danger-500">
                  <AlertTriangle className="w-5 h-5" />
                  Error Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {errorLog.map((error) => {
                  const isExpanded = expandedErrors.has(error.id);

                  return (
                    <div
                      key={error.id}
                      className="border border-wl-danger-500/20 rounded-lg bg-wl-danger-bg"
                    >
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedErrors);
                          if (isExpanded) {
                            newSet.delete(error.id);
                          } else {
                            newSet.add(error.id);
                          }
                          setExpandedErrors(newSet);
                        }}
                        className="w-full p-3 text-left hover:bg-wl-danger-500/10 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-wl-danger-500">
                              {error.error}
                            </p>
                            {error.context && (
                              <p className="text-xs text-wl-text-tertiary mt-1">
                                {error.context}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-wl-text-tertiary ml-2">
                            {new Date(error.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </button>

                      {isExpanded && error.stackTrace && (
                        <div className="border-t border-wl-danger-500/20 p-3 bg-wl-bg-root">
                          <pre className="text-xs text-wl-text-secondary font-mono overflow-auto bg-wl-bg-elevated p-2 rounded border border-wl-border-default">
                            {error.stackTrace}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Webhook Configuration */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-wl-text-tertiary uppercase tracking-wide">
                  Webhook URL
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={`https://api.example.com/webhooks/${connectionId}`}
                    readOnly
                    className="flex-1 px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-xs text-wl-text-secondary font-mono"
                  />
                  <button className="p-2 hover:bg-wl-bg-elevated rounded transition-colors">
                    <Copy className="w-4 h-4 text-wl-text-tertiary" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-wl-text-tertiary uppercase tracking-wide block mb-2">
                  Subscribed Events
                </label>
                <div className="space-y-2">
                  {["orders.created", "orders.updated", "inventory.changed"].map(
                    (event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-wl-text-secondary">
                          {event}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connection Info */}
          <Card className="bg-wl-bg-elevated border-wl-border-default">
            <CardHeader>
              <CardTitle>Connection Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-wl-text-tertiary mb-1">Provider</p>
                <p className="text-wl-text-primary font-medium">
                  {connection.providerName}
                </p>
              </div>
              <div>
                <p className="text-wl-text-tertiary mb-1">Category</p>
                <p className="text-wl-text-primary font-medium capitalize">
                  {connection.category}
                </p>
              </div>
              <div>
                <p className="text-wl-text-tertiary mb-1">Status</p>
                <Badge variant="success">Connected</Badge>
              </div>
              {connection.credentialsExpireAt && (
                <div>
                  <p className="text-wl-text-tertiary mb-1">Credentials Expire</p>
                  <p className="text-wl-text-primary font-medium">
                    {new Date(connection.credentialsExpireAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentation */}
          <Card className="bg-wl-info-500/10 border border-wl-info-500/20">
            <CardContent className="pt-6">
              <p className="text-sm text-wl-text-secondary mb-4">
                Need help? Check the integration documentation.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                asChild
              >
                <a
                  href={`https://docs.example.com/${connection.providerName.toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center"
                >
                  View Documentation
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <Modal
          isOpen={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
        >
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-wl-text-primary">
              Disconnect {connection.providerName}?
            </h2>
            <p className="text-wl-text-secondary">
              This will stop syncing data from {connection.providerName}. You can reconnect anytime.
            </p>
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDisconnectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  try {
                    await disconnect(connectionId);
                    setShowDisconnectModal(false);
                    router.push("/integrations/connected");
                  } catch (err) {
                    console.error("Disconnect failed:", err);
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
