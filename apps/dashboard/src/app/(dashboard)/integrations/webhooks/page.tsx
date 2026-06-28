'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  useWebhookMonitor,
  type WebhookEndpoint,
} from '@/hooks/use-integration-health';
import {
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  BarChart3,
  Copy,
  Lock,
  ChevronDown,
} from 'lucide-react';

/**
 * Webhook Monitor
 * Endpoints, delivery logs, DLQ viewer, analytics, create/edit form
 */

interface ExpandedDelivery {
  [key: string]: boolean;
}

function EndpointCard({
  endpoint,
  onEdit,
}: {
  endpoint: WebhookEndpoint;
  onEdit: (endpoint: WebhookEndpoint) => void;
}) {
  return (
    <Card className="bg-wl-bg-surface border-neutral-700">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-gray-400 truncate">
                {endpoint.url}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge
                  variant={
                    endpoint.status === "active"
                      ? "success"
                      : endpoint.status === "inactive"
                        ? "info"
                        : "danger"
                  }
                >
                  {endpoint.status}
                </Badge>
                <Badge variant="default">
                  {endpoint.subscriptionCount} subscriptions
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(endpoint.url)}
              title="Copy URL"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400">Success Rate</p>
              <p className="font-medium text-white mt-1">
                {endpoint.successRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400">Last Delivery</p>
              <p className="font-medium text-white mt-1 truncate">
                {new Date(endpoint.lastDeliveryTime).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1">
              Test Webhook
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(endpoint)}
            >
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WebhooksPage() {
  const { webhooks, isLoading, error, revalidate, retryDelivery, purgeDLQ } =
    useWebhookMonitor();
  const [expandedDeliveries, setExpandedDeliveries] = useState<ExpandedDelivery>(
    {}
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEndpoint, setEditingEndpoint] =
    useState<WebhookEndpoint | null>(null);
  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
    secret: "",
    retryPolicy: "exponential",
    maxRetries: 3,
  });

  const successfulDeliveries = useMemo(() => {
    return webhooks?.deliveries.filter((d) => d.status === "success") || [];
  }, [webhooks?.deliveries]);

  const failedDeliveries = useMemo(() => {
    return webhooks?.deliveries.filter((d) => d.status === "failed") || [];
  }, [webhooks?.deliveries]);

  const toggleDeliveryExpand = (deliveryId: string) => {
    setExpandedDeliveries((prev) => ({
      ...prev,
      [deliveryId]: !prev[deliveryId],
    }));
  };

  const handleCreateEndpoint = () => {
    // API call would go here
    setShowCreateForm(false);
    setFormData({
      url: "",
      events: [],
      secret: "",
      retryPolicy: "exponential",
      maxRetries: 3,
    });
  };

  if (error) {
    return (
      <ErrorState
        title="Failed to load webhooks"
        message={error}
        onRetry={revalidate}
      />
    );
  }

  if (isLoading && !webhooks) {
    return (
      <div className="space-y-8 p-6">
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-wl-bg-elevated animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-wl-bg-elevated animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={revalidate}
          variant="secondary"
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
        <Button
          onClick={() => {
            setShowCreateForm(true);
            setEditingEndpoint(null);
          }}
          variant="primary"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Endpoint
        </Button>
        {(webhooks?.dlqCount ?? 0) > 0 && (
          <Button variant="danger" className="gap-2">
            <Trash2 className="w-4 h-4" />
            Purge DLQ ({webhooks?.dlqCount})
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingEndpoint) && (
        <Card className="bg-wl-bg-surface border-neutral-700">
          <CardHeader>
            <CardTitle>
              {editingEndpoint ? "Edit Webhook Endpoint" : "Create Webhook Endpoint"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-neutral-700 text-white placeholder-blue-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Event Types (select all that apply)
                </label>
                <div className="space-y-2">
                  {[
                    "payment.success",
                    "payment.failed",
                    "order.created",
                    "order.shipped",
                    "order.delivered",
                  ].map((event) => (
                    <label key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              events: [...formData.events, event],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter((ev) => ev !== event),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-white">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Webhook Secret
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Auto-generated"
                    value={formData.secret}
                    onChange={(e) =>
                      setFormData({ ...formData, secret: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-neutral-700 text-white placeholder-blue-500 focus:outline-none focus:border-blue-500"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Retry Policy
                  </label>
                  <select
                    value={formData.retryPolicy}
                    onChange={(e) =>
                      setFormData({ ...formData, retryPolicy: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="exponential">Exponential Backoff</option>
                    <option value="linear">Linear Backoff</option>
                    <option value="fixed">Fixed Delay</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    value={formData.maxRetries}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxRetries: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateEndpoint}
                  variant="primary"
                  className="flex-1"
                >
                  {editingEndpoint ? "Save Changes" : "Create Endpoint"}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingEndpoint(null);
                    setFormData({
                      url: "",
                      events: [],
                      secret: "",
                      retryPolicy: "exponential",
                      maxRetries: 3,
                    });
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoints */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Webhook Endpoints ({webhooks?.endpoints.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {webhooks?.endpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              onEdit={setEditingEndpoint}
            />
          ))}
        </div>
      </div>

      {/* Delivery Analytics */}
      {webhooks && (
        <Card className="bg-wl-bg-surface border-neutral-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Delivery Analytics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-3xl font-bold text-emerald-500 mt-2">
                  {webhooks.successRate?.toFixed(1) ?? 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Successful Deliveries</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {successfulDeliveries.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Failed Deliveries</p>
                <p className="text-3xl font-bold text-red-500 mt-2">
                  {failedDeliveries.length}
                </p>
              </div>
            </div>

            {/* Stacked Bar Chart (hourly) — bucketed from real deliveries */}
            {(() => {
              const hourly = Array.from({ length: 24 }, (_, h) => ({ success: 0, failed: 0 }));
              for (const d of webhooks?.deliveries ?? []) {
                const h = new Date(d.timestamp).getHours();
                if (h >= 0 && h < 24) {
                  if (d.status === 'success') hourly[h].success++;
                  else hourly[h].failed++;
                }
              }
              const maxTotal = Math.max(1, ...hourly.map((h) => h.success + h.failed));
              return (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">Hourly Delivery Status</p>
                  <div className="flex items-end gap-1 h-32 px-2 py-4 bg-wl-bg-root rounded-lg border border-neutral-700">
                    {hourly.map((bucket, i) => {
                      const total = bucket.success + bucket.failed;
                      const heightPercent = (total / maxTotal) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col-reverse gap-0 group relative"
                          title={`${i}:00 — Success: ${bucket.success}, Failed: ${bucket.failed}`}
                        >
                          <div className="w-full bg-red-500 rounded-t transition-all group-hover:opacity-80"
                            style={{ height: `${total > 0 ? (bucket.failed / total) * heightPercent : 0}%` }} />
                          <div className="w-full bg-emerald-500 rounded-t transition-all group-hover:opacity-80"
                            style={{ height: `${total > 0 ? (bucket.success / total) * heightPercent : 0}%` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Delivery Log */}
      {webhooks?.deliveries && webhooks.deliveries.length > 0 && (
        <Card className="bg-wl-bg-surface border-neutral-700">
          <CardHeader>
            <CardTitle>Delivery Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {webhooks.deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="border border-neutral-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleDeliveryExpand(delivery.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-wl-bg-sunken transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge
                        variant={
                          delivery.status === "success"
                            ? "success"
                            : delivery.status === "retry"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {delivery.status}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {delivery.eventType}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {delivery.endpoint}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {delivery.attempts} attempt{delivery.attempts !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-gray-400">
                        {delivery.latency}ms
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedDeliveries[delivery.id] && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {expandedDeliveries[delivery.id] && (
                    <div className="border-t border-neutral-700 bg-wl-bg-sunken p-3 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1">
                          Timestamp
                        </p>
                        <p className="text-sm text-white">
                          {new Date(delivery.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {delivery.payload && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">
                            Payload
                          </p>
                          <pre className="text-xs bg-wl-bg-surface p-2 rounded border border-neutral-700 overflow-x-auto text-white">
                            {JSON.stringify(delivery.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {delivery.status === "failed" && (
                        <Button
                          size="sm"
                          onClick={() => retryDelivery(delivery.id)}
                          className="w-full"
                        >
                          Retry Delivery
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DLQ Viewer */}
      {(webhooks?.dlqCount ?? 0) > 0 && (
        <Card className="bg-red-500/10 border border-red-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-red-500">
                Dead Letter Queue ({webhooks?.dlqCount})
              </CardTitle>
              <Button
                variant="danger"
                size="sm"
                onClick={() => purgeDLQ()}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Purge DLQ
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              {webhooks?.dlqCount} failed deliveries are waiting for retry.
            </p>
            <Button variant="secondary" size="sm" className="mt-3">
              View All
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
