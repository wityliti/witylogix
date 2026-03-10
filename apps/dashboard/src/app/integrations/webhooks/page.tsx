"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Table,
  Pagination,
  StatCard,
} from "@/components/ui";
import {
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  Copy,
  Download,
  Calendar,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   WEBHOOK DELIVERY DASHBOARD
   ═══════════════════════════════════════════════════════════ */

interface WebhookDelivery {
  id: string;
  eventType: string;
  endpointUrl: string;
  status: "success" | "failed" | "pending";
  responseCode: number | null;
  duration: number; // ms
  timestamp: Date;
  requestPayload: Record<string, any>;
  responsePayload: Record<string, any> | null;
}

// Mock data for demonstration
const MOCK_DELIVERIES: WebhookDelivery[] = [
  {
    id: "del_001",
    eventType: "order.created",
    endpointUrl: "https://api.example.com/webhooks/orders",
    status: "success",
    responseCode: 200,
    duration: 245,
    timestamp: new Date(Date.now() - 5 * 60000),
    requestPayload: { orderId: "123", total: 99.99 },
    responsePayload: { received: true },
  },
  {
    id: "del_002",
    eventType: "order.updated",
    endpointUrl: "https://api.example.com/webhooks/orders",
    status: "success",
    responseCode: 200,
    duration: 187,
    timestamp: new Date(Date.now() - 12 * 60000),
    requestPayload: { orderId: "124", status: "shipped" },
    responsePayload: { received: true },
  },
  {
    id: "del_003",
    eventType: "shipment.created",
    endpointUrl: "https://shipping.example.com/webhooks",
    status: "failed",
    responseCode: 502,
    duration: 5000,
    timestamp: new Date(Date.now() - 25 * 60000),
    requestPayload: { shipmentId: "ship_001", carrier: "FedEx" },
    responsePayload: null,
  },
  {
    id: "del_004",
    eventType: "payment.completed",
    endpointUrl: "https://api.example.com/webhooks/payments",
    status: "success",
    responseCode: 200,
    duration: 156,
    timestamp: new Date(Date.now() - 42 * 60000),
    requestPayload: { transactionId: "txn_123", amount: 99.99 },
    responsePayload: { received: true },
  },
  {
    id: "del_005",
    eventType: "order.cancelled",
    endpointUrl: "https://api.example.com/webhooks/orders",
    status: "pending",
    responseCode: null,
    duration: 0,
    timestamp: new Date(Date.now() - 2 * 60000),
    requestPayload: { orderId: "125", reason: "customer_request" },
    responsePayload: null,
  },
  {
    id: "del_006",
    eventType: "inventory.updated",
    endpointUrl: "https://inventory.example.com/webhooks",
    status: "failed",
    responseCode: 500,
    duration: 3200,
    timestamp: new Date(Date.now() - 58 * 60000),
    requestPayload: { sku: "SKU123", quantity: 50 },
    responsePayload: null,
  },
  {
    id: "del_007",
    eventType: "order.created",
    endpointUrl: "https://api.example.com/webhooks/orders",
    status: "success",
    responseCode: 200,
    duration: 198,
    timestamp: new Date(Date.now() - 95 * 60000),
    requestPayload: { orderId: "126", total: 299.99 },
    responsePayload: { received: true },
  },
  {
    id: "del_008",
    eventType: "shipment.tracking",
    endpointUrl: "https://tracking.example.com/webhooks",
    status: "success",
    responseCode: 201,
    duration: 432,
    timestamp: new Date(Date.now() - 120 * 60000),
    requestPayload: { trackingNumber: "1Z999AA10123456784", status: "in_transit" },
    responsePayload: { received: true, messageId: "msg_123" },
  },
];

const EVENT_TYPES = [
  "All Events",
  "order.created",
  "order.updated",
  "order.cancelled",
  "payment.completed",
  "shipment.created",
  "shipment.tracking",
  "inventory.updated",
];

export default function WebhookDeliveriesPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState("All Events");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);

  const itemsPerPage = 10;

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return MOCK_DELIVERIES.filter((delivery) => {
      const matchesEventType =
        eventTypeFilter === "All Events" || delivery.eventType === eventTypeFilter;
      const matchesStatus = statusFilter === "all" || delivery.status === statusFilter;
      const matchesDateRange =
        delivery.timestamp >= dateRange.start && delivery.timestamp <= dateRange.end;
      return matchesEventType && matchesStatus && matchesDateRange;
    });
  }, [eventTypeFilter, statusFilter, dateRange]);

  // Pagination
  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = filteredDeliveries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate stats for 24h
  const totalDeliveries24h = MOCK_DELIVERIES.length;
  const successCount = MOCK_DELIVERIES.filter((d) => d.status === "success").length;
  const failedCount = MOCK_DELIVERIES.filter((d) => d.status === "failed").length;
  const successRate = ((successCount / totalDeliveries24h) * 100).toFixed(1);
  const avgResponseTime = (
    MOCK_DELIVERIES.filter((d) => d.duration > 0).reduce((sum, d) => sum + d.duration, 0) /
    MOCK_DELIVERIES.filter((d) => d.duration > 0).length
  ).toFixed(0);

  const handleRetry = (delivery: WebhookDelivery) => {
    setSelectedDelivery(delivery);
    setShowRetryModal(true);
  };

  const handleViewPayload = (delivery: WebhookDelivery) => {
    setSelectedDelivery(delivery);
    setShowPayloadModal(true);
  };

  const confirmRetry = () => {
    // Mock retry action
    console.log("Retrying delivery:", selectedDelivery?.id);
    setShowRetryModal(false);
    setSelectedDelivery(null);
  };

  return (
    <>
      <Header
        title="Webhook Deliveries"
        subtitle="Monitor and manage webhook delivery logs"
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Stats Row */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <StatCard
            label="Total Deliveries (24h)"
            value={totalDeliveries24h}
            trend={{ value: 12, direction: "up" }}
            icon={<ArrowRight className="w-5 h-5" />}
          />
          <StatCard
            label="Success Rate"
            value={`${successRate}%`}
            trend={{ value: 2.5, direction: "up" }}
            icon={<CheckCircle className="w-5 h-5 text-wl-success-400" />}
          />
          <StatCard
            label="Avg Response Time"
            value={`${avgResponseTime}ms`}
            trend={{ value: 5, direction: "down" }}
            icon={<Clock className="w-5 h-5 text-wl-info-400" />}
          />
          <StatCard
            label="Failed Deliveries"
            value={failedCount}
            trend={{ value: 1, direction: "up" }}
            icon={<AlertCircle className="w-5 h-5 text-wl-danger-400" />}
          />
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className={cn("pt-6 space-y-4")}>
            <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
              {/* Event Type Filter */}
              <div className={cn("flex flex-col gap-2")}>
                <label className={cn("text-xs font-semibold text-wl-text-secondary")}>
                  Event Type
                </label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => {
                    setEventTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "p-2 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
                  )}
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className={cn("flex flex-col gap-2")}>
                <label className={cn("text-xs font-semibold text-wl-text-secondary")}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "p-2 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
                  )}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Date Range (simplified) */}
              <div className={cn("flex flex-col gap-2")}>
                <label className={cn("text-xs font-semibold text-wl-text-secondary")}>
                  From Date
                </label>
                <input
                  type="date"
                  value={dateRange.start.toISOString().split("T")[0]}
                  onChange={(e) => {
                    setDateRange({
                      ...dateRange,
                      start: new Date(e.target.value),
                    });
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "p-2 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
                  )}
                />
              </div>

              {/* Reset Filters */}
              <div className={cn("flex flex-col gap-2 justify-end")}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEventTypeFilter("All Events");
                    setStatusFilter("all");
                    setDateRange({
                      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                      end: new Date(),
                    });
                    setCurrentPage(1);
                  }}
                  className={cn("w-full")}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Log Table */}
        <Card>
          <CardContent className={cn("pt-6")}>
            {paginatedDeliveries.length === 0 ? (
              <div className={cn("text-center py-12 text-wl-text-tertiary")}>
                No webhook deliveries found matching your filters.
              </div>
            ) : (
              <>
                <div className={cn("overflow-x-auto")}>
                  <table className={cn("w-full text-sm")}>
                    <thead>
                      <tr className={cn("border-b border-wl-border-subtle")}>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Event Type
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Endpoint URL
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Status
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Response Code
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Duration (ms)
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Timestamp
                        </th>
                        <th
                          className={cn(
                            "text-left py-3 px-4 font-semibold text-wl-text-secondary text-xs uppercase tracking-wider"
                          )}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDeliveries.map((delivery) => (
                        <tr
                          key={delivery.id}
                          className={cn(
                            "border-b border-wl-border-subtle hover:bg-wl-bg-surface/50 transition-colors"
                          )}
                        >
                          <td className={cn("py-3 px-4")}>
                            <span className={cn("text-wl-text-primary font-medium")}>
                              {delivery.eventType}
                            </span>
                          </td>
                          <td className={cn("py-3 px-4")}>
                            <span className={cn("text-wl-text-secondary text-xs truncate max-w-[200px] block")}>
                              {delivery.endpointUrl}
                            </span>
                          </td>
                          <td className={cn("py-3 px-4")}>
                            <Badge
                              variant={
                                delivery.status === "success"
                                  ? "success"
                                  : delivery.status === "failed"
                                  ? "danger"
                                  : "default"
                              }
                              dot
                            >
                              {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                            </Badge>
                          </td>
                          <td className={cn("py-3 px-4")}>
                            {delivery.responseCode ? (
                              <span
                                className={cn(
                                  delivery.responseCode >= 200 && delivery.responseCode < 300
                                    ? "text-wl-success-400"
                                    : "text-wl-danger-400",
                                  "font-mono font-medium"
                                )}
                              >
                                {delivery.responseCode}
                              </span>
                            ) : (
                              <span className={cn("text-wl-text-tertiary")}>—</span>
                            )}
                          </td>
                          <td className={cn("py-3 px-4")}>
                            {delivery.duration > 0 ? (
                              <span className={cn("text-wl-text-primary font-mono")}>
                                {delivery.duration}ms
                              </span>
                            ) : (
                              <span className={cn("text-wl-text-tertiary")}>—</span>
                            )}
                          </td>
                          <td className={cn("py-3 px-4")}>
                            <span className={cn("text-wl-text-secondary text-xs")}>
                              {delivery.timestamp.toLocaleString()}
                            </span>
                          </td>
                          <td className={cn("py-3 px-4")}>
                            <div className={cn("flex gap-2")}>
                              {delivery.status === "failed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetry(delivery)}
                                  title="Retry delivery"
                                  className={cn("p-1 h-auto")}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPayload(delivery)}
                                title="View payload"
                                className={cn("p-1 h-auto")}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className={cn("mt-6 flex items-center justify-between")}>
                  <span className={cn("text-xs text-wl-text-tertiary")}>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, filteredDeliveries.length)} of{" "}
                    {filteredDeliveries.length} results
                  </span>
                  <Pagination
                    current={currentPage}
                    total={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retry Confirmation Modal */}
      {showRetryModal && selectedDelivery && (
        <Modal
          isOpen={showRetryModal}
          onClose={() => setShowRetryModal(false)}
          title="Retry Webhook Delivery"
          size="sm"
        >
          <div className={cn("space-y-4")}>
            <p className={cn("text-wl-text-secondary text-sm")}>
              Are you sure you want to retry this webhook delivery?
            </p>
            <div className={cn("bg-wl-bg-surface p-3 rounded-md space-y-2 text-xs")}>
              <div>
                <span className={cn("text-wl-text-tertiary")}>Event:</span>{" "}
                <span className={cn("text-wl-text-primary font-medium")}>
                  {selectedDelivery.eventType}
                </span>
              </div>
              <div>
                <span className={cn("text-wl-text-tertiary")}>Endpoint:</span>{" "}
                <span className={cn("text-wl-text-primary font-medium truncate block")}>
                  {selectedDelivery.endpointUrl}
                </span>
              </div>
            </div>
            <div className={cn("flex gap-3 justify-end pt-4")}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRetryModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmRetry}
              >
                Retry Delivery
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payload View Modal */}
      {showPayloadModal && selectedDelivery && (
        <Modal
          isOpen={showPayloadModal}
          onClose={() => setShowPayloadModal(false)}
          title="Webhook Delivery Details"
          size="lg"
        >
          <div className={cn("space-y-4 max-h-[70vh] overflow-y-auto")}>
            {/* Delivery Metadata */}
            <div className={cn("bg-wl-bg-surface p-4 rounded-md space-y-3 text-sm")}>
              <div className={cn("grid grid-cols-2 gap-4")}>
                <div>
                  <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                    Event Type
                  </span>
                  <span className={cn("text-wl-text-primary font-medium")}>
                    {selectedDelivery.eventType}
                  </span>
                </div>
                <div>
                  <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                    Status
                  </span>
                  <Badge
                    variant={
                      selectedDelivery.status === "success"
                        ? "success"
                        : selectedDelivery.status === "failed"
                        ? "danger"
                        : "default"
                    }
                    dot
                  >
                    {selectedDelivery.status.charAt(0).toUpperCase() + selectedDelivery.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                    Duration
                  </span>
                  <span className={cn("text-wl-text-primary font-medium")}>
                    {selectedDelivery.duration}ms
                  </span>
                </div>
                <div>
                  <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                    Response Code
                  </span>
                  <span
                    className={cn(
                      selectedDelivery.responseCode
                        ? selectedDelivery.responseCode >= 200 && selectedDelivery.responseCode < 300
                          ? "text-wl-success-400"
                          : "text-wl-danger-400"
                        : "text-wl-text-tertiary",
                      "font-mono"
                    )}
                  >
                    {selectedDelivery.responseCode || "—"}
                  </span>
                </div>
              </div>

              <div>
                <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                  Endpoint URL
                </span>
                <span className={cn("text-wl-text-primary font-mono text-xs break-all")}>
                  {selectedDelivery.endpointUrl}
                </span>
              </div>

              <div>
                <span className={cn("text-wl-text-tertiary block text-xs mb-1")}>
                  Timestamp
                </span>
                <span className={cn("text-wl-text-primary")}>
                  {selectedDelivery.timestamp.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Request Payload */}
            <div>
              <h4 className={cn("text-sm font-semibold text-wl-text-primary mb-2")}>
                Request Payload
              </h4>
              <pre
                className={cn(
                  "bg-wl-bg-elevated p-3 rounded-md text-xs text-wl-text-secondary overflow-x-auto"
                )}
              >
                {JSON.stringify(selectedDelivery.requestPayload, null, 2)}
              </pre>
            </div>

            {/* Response Payload */}
            {selectedDelivery.responsePayload ? (
              <div>
                <h4 className={cn("text-sm font-semibold text-wl-text-primary mb-2")}>
                  Response Payload
                </h4>
                <pre
                  className={cn(
                    "bg-wl-bg-elevated p-3 rounded-md text-xs text-wl-text-secondary overflow-x-auto"
                  )}
                >
                  {JSON.stringify(selectedDelivery.responsePayload, null, 2)}
                </pre>
              </div>
            ) : (
              <div
                className={cn(
                  "bg-wl-bg-surface p-3 rounded-md text-xs text-wl-text-tertiary"
                )}
              >
                No response received
              </div>
            )}

            {/* Actions */}
            <div className={cn("flex gap-3 justify-end pt-4 border-t border-wl-border-subtle")}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPayloadModal(false)}
              >
                Close
              </Button>
              {selectedDelivery.status === "failed" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowPayloadModal(false);
                    handleRetry(selectedDelivery);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
