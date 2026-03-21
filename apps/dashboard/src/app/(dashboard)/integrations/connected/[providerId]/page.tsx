"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useIntegrationStatus } from "@/hooks/use-integration-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  Gauge,
  AlertTriangle,
  Activity,
  Settings,
  ArrowRight,
  CheckCheck,
  X,
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

/**
 * Single Integration Detail/Management Page
 *
 * Displays:
 * - Connection status with uptime
 * - Usage meters
 * - Recent activity log
 * - Error log with stack traces
 * - Configuration panel
 * - Sync controls
 * - Webhook URL and subscriptions
 * - Test Connection
 * - Disconnect
 */
export default function IntegrationDetailPage() {
  const params = useParams();
  const connectionId = params.providerId as string;

  const { connections, getStatus, pauseSync, resumeSync, forceSync, disconnect } =
    useIntegrationStatus({ enablePolling: true });

  const connection = getStatus(connectionId);

  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showTestResult, setShowTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Mock data for development
  const mockUsageMetrics: UsageMetric[] = [
    { label: "API Calls", value: 4230, unit: "calls", period: "today" },
    { label: "API Calls", value: 28950, unit: "calls", period: "week" },
    { label: "API Calls", value: 125400, unit: "calls", period: "month" },
    { label: "Data Synced", value: 2.5, unit: "GB", period: "month" },
    { label: "Webhooks", value: 892, unit: "events", period: "today" },
  ];

  const mockActivityLog: ActivityLogEntry[] = [
    {
      id: "1",
      type: "sync_completed",
      description: "Full sync completed successfully",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "success",
    },
    {
      id: "2",
      type: "webhook_delivered",
      description: "Webhook event delivered",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: "success",
    },
    {
      id: "3",
      type: "api_call",
      description: "API call to /api/orders",
      timestamp: new Date(Date.now() - 900000).toISOString(),
      status: "success",
    },
  ];

  const mockErrors: ErrorEntry[] = [
    {
      id: "err-1",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      error: "Connection timeout",
      stackTrace:
        "Error: ETIMEDOUT\n  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:23)",
      context: "During sync operation",
    },
    {
      id: "err-2",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      error: "Invalid credentials",
      stackTrace: "UnauthorizedError: API key expired\n  at validateAuth (auth.js:45:12)",
      context: "OAuth token refresh",
    },
  ];

  if (!connection) {
    return (
      <div className="space-y-8">
        <Link
          href="/integrations/connected"
          className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Connected Integrations
        </Link>

        <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Integration not found
              </h2>
              <p className="text-gray-400 mb-4">
                The integration you&apos;re looking for doesn&apos;t exist or has been disconnected.
              </p>
              <Button variant="primary" asChild>
                <Link href="/integrations/connected">View All Integrations</Link>
              </Button>
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
        className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Connected Integrations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {connection.providerName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge
                variant={isHealthy ? "success" : "danger"}
              >
                {connection.status.charAt(0).toUpperCase() +
                  connection.status.slice(1)}
              </Badge>
              <span className="text-sm text-gray-400">
                Uptime: {connection.uptime}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {mockUsageMetrics.map((metric) => (
          <Card
            key={`${metric.label}-${metric.period}`}
            className="bg-[#1a1a2e] border-[#1e1e2e]"
          >
            <CardContent className="pt-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                {metric.label} ({metric.period})
              </div>
              <div className="text-2xl font-bold text-white">
                {metric.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metric.unit}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sync Controls */}
          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
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

              <div className="pt-4 border-t border-[#1e1e2e]">
                <Button
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        `/api/integrations/connections/${connectionId}/test`,
                        { method: "POST" }
                      );
                      const result = await response.json();
                      setShowTestResult({
                        success: response.ok,
                        message: result.message || "Connection test completed",
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
                "bg-[#1a1a2e] border",
                showTestResult.success
                  ? "border-emerald-500/20"
                  : "border-red-500/20"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {showTestResult.success ? (
                    <CheckCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {showTestResult.message}
                    </p>
                    <button
                      onClick={() => setShowTestResult(null)}
                      className="text-xs text-gray-500 hover:text-gray-400 mt-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
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
              {mockActivityLog.map((entry) => {
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
                        ? "border-l-emerald-500 bg-emerald-500/5"
                        : "border-l-amber-500 bg-amber-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {entry.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {entry.description}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {timeStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Error Log */}
          {mockErrors.length > 0 && (
            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                  Error Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockErrors.map((error) => {
                  const isExpanded = expandedErrors.has(error.id);

                  return (
                    <div
                      key={error.id}
                      className="border border-red-500/20 rounded-lg bg-red-500/5"
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
                        className="w-full p-3 text-left hover:bg-red-500/10 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-500">
                              {error.error}
                            </p>
                            {error.context && (
                              <p className="text-xs text-gray-500 mt-1">
                                {error.context}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(error.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-red-500/20 p-3 bg-[#0a0a0f]">
                          <pre className="text-xs text-gray-400 font-mono overflow-auto bg-[#1a1a2e] p-2 rounded border border-[#1e1e2e]">
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
          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  Webhook URL
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={`https://api.example.com/webhooks/${connectionId}`}
                    readOnly
                    className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-xs text-gray-400 font-mono"
                  />
                  <button className="p-2 hover:bg-[#1a1a2e] rounded transition-colors">
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">
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
                        <span className="text-sm text-gray-400">
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
          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle>Connection Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Provider</p>
                <p className="text-white font-medium">
                  {connection.providerName}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Category</p>
                <p className="text-white font-medium">
                  {connection.category}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                <Badge variant="success">Connected</Badge>
              </div>
              {connection.credentialsExpireAt && (
                <div>
                  <p className="text-gray-500 mb-1">Credentials Expire</p>
                  <p className="text-white font-medium">
                    {new Date(connection.credentialsExpireAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentation */}
          <Card className="bg-blue-500/10 border border-blue-500/20">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-400 mb-4">
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
          open={showDisconnectModal}
          onOpenChange={setShowDisconnectModal}
        >
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Disconnect {connection.providerName}?
            </h2>
            <p className="text-gray-400">
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
                    // Redirect back
                    window.location.href = "/integrations/connected";
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
