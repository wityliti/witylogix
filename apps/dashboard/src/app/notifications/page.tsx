"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatRelativeTime, cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION TEMPLATES PAGE — Template management + preview
   ═══════════════════════════════════════════════════════════ */

type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK";

interface Variable {
  name: string;
  description: string;
  required: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  slug: string;
  channel: NotificationChannel;
  eventType: string;
  subject?: string;
  bodyTemplate: string;
  variables: Variable[];
  isActive: boolean;
  version: number;
  lastUpdated: string;
}

const TEMPLATES: NotificationTemplate[] = [
  {
    id: "tpl-1",
    name: "Shipment Created",
    slug: "shipment-created",
    channel: "EMAIL",
    eventType: "shipment.created",
    subject: "Your shipment {{shipmentId}} has been created",
    bodyTemplate:
      "Hi {{customerName}},\n\nYour shipment #{{shipmentId}} has been created and is being processed.\n\n{{#if estimatedDelivery}}Expected delivery: {{formatDate estimatedDelivery}}{{/if}}\n\nTrack your package: {{trackingUrl}}\n\nThank you!",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "estimatedDelivery", description: "Estimated delivery date", required: false },
      { name: "trackingUrl", description: "Public tracking URL", required: true },
    ],
    isActive: true,
    version: 3,
    lastUpdated: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "tpl-2",
    name: "Shipment Delivered",
    slug: "shipment-delivered",
    channel: "SMS",
    eventType: "shipment.delivered",
    bodyTemplate:
      "Hi {{customerName}}, your package #{{shipmentId}} has been delivered. Thank you for using our service!",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "tpl-3",
    name: "Shipment Failed",
    slug: "shipment-failed",
    channel: "EMAIL",
    eventType: "shipment.failed",
    subject: "Delivery attempt failed for shipment {{shipmentId}}",
    bodyTemplate:
      "Hi {{customerName}},\n\nWe encountered an issue delivering your shipment #{{shipmentId}}.\n\nReason: {{failureReason}}\n\nOur team will contact you shortly to arrange a new delivery.\n\nContact: {{supportPhone}}\nEmail: {{supportEmail}}\n\nWe apologize for the inconvenience.",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "failureReason", description: "Reason for delivery failure", required: true },
      { name: "supportPhone", description: "Support phone number", required: true },
      { name: "supportEmail", description: "Support email address", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "tpl-4",
    name: "Order Confirmation",
    slug: "order-confirmation",
    channel: "EMAIL",
    eventType: "order.created",
    subject: "Order #{{orderNumber}} confirmed",
    bodyTemplate:
      "Thank you {{customerName}} for your order!\n\nOrder ID: {{orderNumber}}\nTotal: {{orderTotal}}\nItems: {{itemCount}}\n\nEstimated delivery: {{estimatedDelivery}}\n\nTrack your order: {{trackingLink}}\n\nQuestions? Contact {{supportEmail}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "orderTotal", description: "Order total amount", required: true },
      { name: "itemCount", description: "Number of items", required: true },
      { name: "estimatedDelivery", description: "Estimated delivery date", required: false },
      { name: "trackingLink", description: "Link to tracking page", required: true },
      { name: "supportEmail", description: "Customer support email", required: true },
    ],
    isActive: true,
    version: 4,
    lastUpdated: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "tpl-5",
    name: "Order Assigned",
    slug: "order-assigned",
    channel: "SMS",
    eventType: "order.assigned",
    bodyTemplate:
      "Hi {{customerName}}, your order #{{orderNumber}} has been assigned to driver {{driverName}} ({{driverPhone}}). Your delivery is coming!",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "driverPhone", description: "Driver phone number", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "tpl-6",
    name: "Driver Assigned",
    slug: "driver-assigned",
    channel: "WHATSAPP",
    eventType: "driver.assigned",
    bodyTemplate:
      "Hello {{driverName}},\n\nYou have been assigned to delivery order #{{orderNumber}}.\n\nRecipient: {{recipientName}}\nAddress: {{deliveryAddress}}\n\nClick here to start: {{routeLink}}",
    variables: [
      { name: "driverName", description: "Driver name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "recipientName", description: "Recipient name", required: true },
      { name: "deliveryAddress", description: "Delivery address", required: true },
      { name: "routeLink", description: "Link to route", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "tpl-7",
    name: "Delivery Approaching",
    slug: "delivery-approaching",
    channel: "PUSH",
    eventType: "delivery.approaching",
    subject: "Driver nearby",
    bodyTemplate: "Hi {{customerName}}, driver {{driverName}} is {{minutesAway}} minutes away from your location!",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "minutesAway", description: "Minutes until arrival", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "tpl-8",
    name: "Payment Received",
    slug: "payment-received",
    channel: "EMAIL",
    eventType: "payment.received",
    subject: "Payment received - Invoice {{invoiceNumber}}",
    bodyTemplate:
      "Thank you {{businessName}}!\n\nWe have received your payment.\n\nAmount: {{amount}}\nMethod: {{paymentMethod}}\nDate: {{paymentDate}}\n\nInvoice: {{invoiceLink}}\n\nReference: {{transactionId}}",
    variables: [
      { name: "businessName", description: "Business/customer name", required: true },
      { name: "amount", description: "Payment amount", required: true },
      { name: "paymentMethod", description: "Payment method used", required: true },
      { name: "paymentDate", description: "Date of payment", required: true },
      { name: "invoiceLink", description: "Link to invoice", required: true },
      { name: "transactionId", description: "Transaction/reference ID", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "tpl-9",
    name: "Proof Uploaded",
    slug: "delivery-proof-uploaded",
    channel: "EMAIL",
    eventType: "delivery.proof_uploaded",
    subject: "Delivery proof for order {{orderNumber}}",
    bodyTemplate:
      "Hi {{recipientName}},\n\nDelivery proof for order #{{orderNumber}} has been uploaded.\n\nDelivery Date: {{deliveryDate}}\nDriver: {{driverName}}\n\nView proof: {{proofLink}}\n\nThank you!",
    variables: [
      { name: "recipientName", description: "Recipient name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "deliveryDate", description: "Delivery date", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "proofLink", description: "Link to delivery proof", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "tpl-10",
    name: "Webhook Alert",
    slug: "webhook-order-created",
    channel: "WEBHOOK",
    eventType: "order.created",
    bodyTemplate:
      '{\n  "event": "order.created",\n  "orderId": "{{orderId}}",\n  "customerEmail": "{{customerEmail}}",\n  "orderTotal": {{orderTotal}},\n  "items": {{itemsJson}},\n  "timestamp": "{{timestamp}}",\n  "retailerId": "{{retailerId}}"\n}',
    variables: [
      { name: "orderId", description: "Order ID", required: true },
      { name: "customerEmail", description: "Customer email", required: true },
      { name: "orderTotal", description: "Order total", required: true },
      { name: "itemsJson", description: "Items as JSON array", required: true },
      { name: "timestamp", description: "Event timestamp", required: true },
      { name: "retailerId", description: "Retailer ID", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: "tpl-11",
    name: "In Transit Update",
    slug: "in-transit-update",
    channel: "SMS",
    eventType: "shipment.in_transit",
    bodyTemplate:
      "Your package {{shipmentId}} is on its way! Current location: {{currentLocation}}. Track: {{trackingUrl}}",
    variables: [
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "currentLocation", description: "Current location", required: true },
      { name: "trackingUrl", description: "Tracking URL", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 11 * 86400000).toISOString(),
  },
  {
    id: "tpl-12",
    name: "Cancellation Notice",
    slug: "order-cancelled",
    channel: "EMAIL",
    eventType: "order.cancelled",
    subject: "Order #{{orderNumber}} has been cancelled",
    bodyTemplate:
      "Hi {{customerName}},\n\nYour order #{{orderNumber}} has been cancelled.\n\nReason: {{cancellationReason}}\n\nRefund status: {{refundStatus}}\nRefund amount: {{refundAmount}}\n\nIf you have questions, contact us at {{supportEmail}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "cancellationReason", description: "Reason for cancellation", required: true },
      { name: "refundStatus", description: "Refund processing status", required: true },
      { name: "refundAmount", description: "Refund amount", required: true },
      { name: "supportEmail", description: "Support email", required: true },
    ],
    isActive: false,
    version: 1,
    lastUpdated: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "tpl-13",
    name: "Rating Request",
    slug: "rating-request",
    channel: "PUSH",
    eventType: "delivery.completed",
    subject: "Rate your delivery",
    bodyTemplate:
      "Hi {{customerName}}, how was your delivery experience? Rate driver {{driverName}} and help us improve: {{ratingLink}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "ratingLink", description: "Link to rating form", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "tpl-14",
    name: "System Alert",
    slug: "system-alert",
    channel: "WEBHOOK",
    eventType: "system.alert",
    bodyTemplate:
      '{"alert_type": "{{alertType}}", "severity": "{{severity}}", "message": "{{alertMessage}}", "timestamp": "{{timestamp}}", "service": "{{affectedService}}"}',
    variables: [
      { name: "alertType", description: "Type of alert", required: true },
      { name: "severity", description: "Severity level", required: true },
      { name: "alertMessage", description: "Alert message", required: true },
      { name: "timestamp", description: "Alert timestamp", required: true },
      { name: "affectedService", description: "Affected service", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 13 * 86400000).toISOString(),
  },
  {
    id: "tpl-15",
    name: "Promo Announcement",
    slug: "promo-announcement",
    channel: "EMAIL",
    eventType: "promo.announced",
    subject: "Exclusive offer for {{customerName}}: {{promoTitle}}",
    bodyTemplate:
      "Hi {{customerName}},\n\nWe have an exclusive offer just for you!\n\nPromo: {{promoTitle}}\nDiscount: {{discountPercent}}% off\nValid until: {{expiryDate}}\n\nShop now: {{promoLink}}\n\nCode: {{promoCode}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "promoTitle", description: "Promotion title", required: true },
      { name: "discountPercent", description: "Discount percentage", required: true },
      { name: "expiryDate", description: "Expiry date", required: true },
      { name: "promoLink", description: "Link to promotion", required: true },
      { name: "promoCode", description: "Promo code", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const channelVariant = (channel: NotificationChannel): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<NotificationChannel, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
    WEBHOOK: "default",
  };
  return map[channel];
};

const channelIcon: Record<NotificationChannel, string> = {
  EMAIL: "✉️",
  SMS: "💬",
  WHATSAPP: "💭",
  PUSH: "🔔",
  WEBHOOK: "🔗",
};

export default function NotificationsPage() {
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | "ALL">("ALL");
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (channelFilter !== "ALL" && t.channel !== channelFilter) return false;
      return true;
    });
  }, [channelFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = TEMPLATES.length;
    const active = TEMPLATES.filter((t) => t.isActive).length;
    const channels = new Set(TEMPLATES.map((t) => t.channel)).size;
    const eventTypes = new Set(TEMPLATES.map((t) => t.eventType)).size;

    return { total, active, channels, eventTypes };
  }, []);

  const truncateText = (text: string, length: number) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const highlightVariables = (text: string) => {
    const parts = text.split(/({{[^}]+}})/);
    return parts.map((part, idx) => {
      if (part.match(/({{[^}]+}})/)) {
        return (
          <span key={idx} style={{ color: "var(--wl-primary-400)" }}>
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <>
      <Header
        title="Notification Templates"
        subtitle={`${TEMPLATES.length} total · ${stats.active} active`}
        actions={
          <Button variant="primary" size="md">
            + New Template
          </Button>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* KPI Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          <StatCard label="Total Templates" value={stats.total} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard label="Active Templates" value={stats.active} accentColor="var(--wl-success-400)" index={1} />
          <StatCard label="Channels Used" value={stats.channels} accentColor="var(--wl-info-400)" index={2} />
          <StatCard label="Event Types" value={stats.eventTypes} accentColor="var(--wl-warning-400)" index={3} />
        </div>

        {/* Channel Filter Pills */}
        <div style={{ display: "flex", gap: 4, marginBottom: "var(--wl-space-5)", flexWrap: "wrap" }}>
          {(["ALL", "EMAIL", "SMS", "WHATSAPP", "PUSH", "WEBHOOK"] as const).map((c) => {
            const count = c === "ALL" ? TEMPLATES.length : TEMPLATES.filter((t) => t.channel === c).length;
            return (
              <button
                key={c}
                onClick={() => setChannelFilter(c)}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-full)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  background: channelFilter === c ? "var(--wl-primary-500)" : "transparent",
                  color: channelFilter === c ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: channelFilter === c ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                }}
              >
                {c === "ALL" ? "All Channels" : c} <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Templates Grid + Detail Panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedTemplate ? "1fr 480px" : "1fr",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Templates Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "var(--wl-space-4)",
            }}
          >
            {filtered.map((template, i) => (
              <Card
                key={template.id}
                hover
                onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedTemplate?.id === template.id ? "var(--wl-primary-500)" : undefined,
                }}
              >
                {/* Active indicator line */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: template.isActive ? "var(--wl-success-400)" : "var(--wl-border-subtle)",
                  }}
                />

                {/* Template Name and Status */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        color: "var(--wl-text-primary)",
                        marginBottom: "var(--wl-space-1)",
                      }}
                    >
                      {template.name}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                        fontFamily: "var(--wl-font-mono)",
                      }}
                    >
                      {template.slug}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: template.isActive ? "var(--wl-success-bg)" : "var(--wl-border-subtle)",
                      fontSize: "12px",
                      color: template.isActive ? "var(--wl-success-400)" : "var(--wl-text-tertiary)",
                    }}
                  >
                    {template.isActive ? "●" : "○"}
                  </div>
                </div>

                {/* Channel Badge and Event Type */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-2)",
                    marginBottom: "var(--wl-space-3)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Badge variant={channelVariant(template.channel)}>
                    <span style={{ marginRight: 4 }}>{channelIcon[template.channel]}</span>
                    {template.channel}
                  </Badge>
                  <span
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      padding: "2px 8px",
                      borderRadius: "var(--wl-radius-sm)",
                      background: "var(--wl-info-bg)",
                      color: "var(--wl-info-400)",
                      fontFamily: "var(--wl-font-mono)",
                    }}
                  >
                    {template.eventType}
                  </span>
                </div>

                {/* Version */}
                <div
                  style={{
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-tertiary)",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  Version {template.version}
                </div>

                {/* Body Preview */}
                <div
                  style={{
                    background: "var(--wl-bg-overlay)",
                    padding: "var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    marginBottom: "var(--wl-space-3)",
                    borderLeft: "2px solid var(--wl-primary-400)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontFamily: "var(--wl-font-mono)",
                      color: "var(--wl-text-secondary)",
                      lineHeight: 1.5,
                      maxHeight: 80,
                      overflow: "hidden",
                    }}
                  >
                    {highlightVariables(truncateText(template.bodyTemplate, 100))}
                  </div>
                </div>

                {/* Last Updated */}
                <div
                  style={{
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-tertiary)",
                    marginBottom: "var(--wl-space-4)",
                  }}
                >
                  Updated {formatRelativeTime(template.lastUpdated)}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <Button variant="secondary" size="sm" style={{ flex: "1 1 auto" }}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" style={{ flex: "1 1 auto" }}>
                    Preview
                  </Button>
                  <Button variant="ghost" size="sm" style={{ flex: "1 1 auto" }}>
                    Duplicate
                  </Button>
                  {template.isActive && (
                    <Button variant="ghost" size="sm" style={{ flex: "1 1 auto" }}>
                      Deactivate
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Template Detail Panel */}
          {selectedTemplate && (
            <Card
              className="wl-animate-in"
              style={{
                position: "sticky",
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--wl-space-4)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-lg)",
                      fontWeight: 700,
                      color: "var(--wl-text-primary)",
                    }}
                  >
                    {selectedTemplate.name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      color: "var(--wl-text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {selectedTemplate.slug}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--wl-text-tertiary)",
                    cursor: "pointer",
                    fontSize: 18,
                    fontFamily: "var(--wl-font-sans)",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--wl-space-2)",
                  marginBottom: "var(--wl-space-4)",
                }}
              >
                <Badge variant={channelVariant(selectedTemplate.channel)}>
                  <span style={{ marginRight: 4 }}>{channelIcon[selectedTemplate.channel]}</span>
                  {selectedTemplate.channel}
                </Badge>
                <Badge variant="info">{selectedTemplate.eventType}</Badge>
                {selectedTemplate.isActive && <Badge variant="success">Active</Badge>}
                {!selectedTemplate.isActive && <Badge variant="default">Inactive</Badge>}
              </div>

              <div style={{ height: 1, background: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-4)" }} />

              {/* Template Body (Code Editor Look) */}
              <div style={{ marginBottom: "var(--wl-space-4)" }}>
                <div
                  style={{
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    color: "var(--wl-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Template Body
                </div>
                <div
                  style={{
                    background: "var(--wl-bg-overlay)",
                    padding: "var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border-subtle)",
                    fontFamily: "var(--wl-font-mono)",
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-secondary)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {highlightVariables(selectedTemplate.bodyTemplate)}
                </div>
              </div>

              {/* Subject if exists */}
              {selectedTemplate.subject && (
                <div style={{ marginBottom: "var(--wl-space-4)" }}>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Subject
                  </div>
                  <div
                    style={{
                      background: "var(--wl-bg-surface)",
                      padding: "var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      fontSize: "var(--wl-text-sm)",
                      color: "var(--wl-text-secondary)",
                      fontFamily: "var(--wl-font-mono)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {highlightVariables(selectedTemplate.subject)}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-4)" }} />

              {/* Variables */}
              <div style={{ marginBottom: "var(--wl-space-4)" }}>
                <div
                  style={{
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    color: "var(--wl-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  Variables ({selectedTemplate.variables.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
                  {selectedTemplate.variables.map((v) => (
                    <div
                      key={v.name}
                      style={{
                        padding: "var(--wl-space-2) var(--wl-space-3)",
                        background: "var(--wl-bg-surface)",
                        borderRadius: "var(--wl-radius-md)",
                        border: "1px solid var(--wl-border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <code
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 600,
                            color: "var(--wl-primary-400)",
                            fontFamily: "var(--wl-font-mono)",
                          }}
                        >
                          {`{{${v.name}}}`}
                        </code>
                        {v.required ? (
                          <span
                            style={{
                              fontSize: "var(--wl-text-xs)",
                              padding: "2px 6px",
                              borderRadius: "var(--wl-radius-sm)",
                              background: "var(--wl-danger-bg)",
                              color: "var(--wl-danger-400)",
                              fontWeight: 600,
                            }}
                          >
                            Required
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "var(--wl-text-xs)",
                              padding: "2px 6px",
                              borderRadius: "var(--wl-radius-sm)",
                              background: "var(--wl-info-bg)",
                              color: "var(--wl-info-400)",
                              fontWeight: 500,
                            }}
                          >
                            Optional
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-tertiary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {v.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-4)" }} />

              {/* Version Info */}
              <div style={{ marginBottom: "var(--wl-space-4)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--wl-space-3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      Version
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-primary)",
                      }}
                    >
                      v{selectedTemplate.version}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      Last Updated
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-sm)",
                        fontWeight: 600,
                        color: "var(--wl-text-secondary)",
                      }}
                    >
                      {formatRelativeTime(selectedTemplate.lastUpdated)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-4)" }} />

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--wl-space-2)",
                }}
              >
                <Button variant="primary" size="sm" style={{ width: "100%" }}>
                  Edit Template
                </Button>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Duplicate
                </Button>
                {selectedTemplate.isActive && (
                  <Button variant="ghost" size="sm" style={{ width: "100%" }}>
                    Deactivate
                  </Button>
                )}
                {!selectedTemplate.isActive && (
                  <Button variant="ghost" size="sm" style={{ width: "100%" }}>
                    Activate
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
